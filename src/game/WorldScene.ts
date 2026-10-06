// ---------------------------------------------------------------------------
// The single Phaser scene. Owns map rendering, grid movement, the follower,
// interactions, encounters and the story branch table.
//
// Regressions this file is written to avoid — do not undo these:
//   * loadMap() destroys the previous player/entities and kills their tweens
//     FIRST, so map changes can never leave a duplicate Palakshi on screen.
//   * bus listeners are registered once and removed on scene SHUTDOWN.
//   * an NPC marker is skipped when that character is already in the party.
//   * story branching lives in game/story.ts (StoryController), driven by the
//     store's `dialogue:end` bus event — never inline in the dialogue component.
//
// This scene is the CLASSIC 2D renderer. The 3D world (src/world3d) is the
// default; both drive the very same StoryController.
// ---------------------------------------------------------------------------

import Phaser from "phaser";
import { MAPS, SOLID, BARRIER_FLAG, tileAt, mapWidth, mapHeight, type MapDef, type MapId } from "./maps";
import { TILE, buildAll } from "./textures";
import { buildExpansionTiles } from "./textures.expansion";
import { bus } from "./bus";
import { useGameStore, type Dir, type Flags } from "../store/useGameStore";
import { playBgm, sfx, gong } from "./sound";
import { questSfx } from "../lib/questSfx";
import {
  StoryController, shouldSkipEntity, isHidden, promptLabel, INTERACT_TILE, UNDERFOOT,
  type WorldFx,
} from "./story";

const STEP_MS = 150;
const DIR_FRAME: Record<Dir, number> = { down: 0, up: 2, left: 4, right: 6 };
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Key -> direction, for edge-triggered movement on keydown. */
const MOVE_KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right",
};

type Entity = {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  kind: string;
  name?: string;
};

export class WorldScene extends Phaser.Scene {
  private mapDef!: MapDef;
  private tileLayer: Phaser.GameObjects.Container | null = null;
  private decorLayer: Phaser.GameObjects.Container | null = null;
  private entities: Entity[] = [];
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private follower: Phaser.GameObjects.Sprite | null = null;
  private followerShadow: Phaser.GameObjects.Image | null = null;
  private trail: { x: number; y: number }[] = [];

  private px = 0;
  private py = 0;
  private dir: Dir = "down";
  private moving = false;
  private stepToggle = 0;
  private inputLocked = false;
  private busUnsubs: (() => void)[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastPrompt = "";
  private autosaveAt = 0;
  private story!: StoryController;

  constructor() {
    super("WorldScene");
  }

  // ------------------------------------------------------------------ setup

  create() {
    buildAll(this);
    buildExpansionTiles(this);

    const fx: WorldFx = {
      refresh: () => this.refresh(),
      startBattle: (id, boss) => this.startBattle(id, boss),
      flash: (ms, [r, g, b]) => this.cameras.main.flash(ms, r, g, b),
      shake: (ms, intensity) => this.cameras.main.shake(ms, intensity),
      flourish: (x, y) => this.flameFlourish(x, y),
      delay: (ms, fn) => void this.time.delayedCall(ms, fn),
      currentMap: () => this.mapDef,
    };
    this.story = new StoryController(fx);

    this.cameras.main.setBackgroundColor("#0a0507");
    this.cameras.main.roundPixels = true;

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,E,Z,ENTER,SPACE,ESC,X,I,Q,H,F5"
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown", this.onKeyDown, this);

    this.busUnsubs.push(bus.on("input:lock", (v: boolean) => { this.inputLocked = !!v; }));
    this.busUnsubs.push(bus.on("dialogue:end", (evt: string | null) => this.story.handleDialogueEnd(evt)));
    this.busUnsubs.push(bus.on("battle:end", (r: { enemyId: string; won: boolean; fled?: boolean }) => {
      this.inputLocked = false;
      this.story.handleBattleEnd(r);
    }));
    this.busUnsubs.push(bus.on("world:reload", () => this.loadMap(useGameStore.getState().map, true)));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);

    const s = useGameStore.getState();
    this.loadMap(s.map, true);

    if (!s.flags.introDone) {
      this.time.delayedCall(420, () => useGameStore.getState().openDialogue("intro"));
    }
  }

  private teardown() {
    this.busUnsubs.forEach((off) => off());
    this.busUnsubs = [];
    this.input.keyboard?.off("keydown", this.onKeyDown, this);
  }

  // --------------------------------------------------------------- map load

  loadMap(id: MapId, hard = false) {
    const store = useGameStore.getState();
    const def = MAPS[id];
    this.mapDef = def;

    // Destroy everything from the previous map FIRST — tweens included.
    if (this.player) {
      this.tweens.killTweensOf(this.player);
      this.player.destroy();
    }
    if (this.playerShadow) this.playerShadow.destroy();
    if (this.follower) {
      this.tweens.killTweensOf(this.follower);
      this.follower.destroy();
      this.follower = null;
    }
    if (this.followerShadow) {
      this.followerShadow.destroy();
      this.followerShadow = null;
    }
    for (const e of this.entities) {
      this.tweens.killTweensOf(e.sprite);
      e.sprite.destroy();
    }
    this.entities = [];
    this.tileLayer?.destroy(true);
    this.decorLayer?.destroy(true);
    this.tileLayer = this.add.container(0, 0).setDepth(0);
    this.decorLayer = this.add.container(0, 0).setDepth(50);

    const W = mapWidth(def);
    const H = mapHeight(def);

    // --- tiles
    const barrierFlag = BARRIER_FLAG[id];
    const barrierOpen = barrierFlag ? !!(store.flags as any)[barrierFlag] : false;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let ch = tileAt(def, x, y);
        const base = this.baseTileFor(def, ch);
        const img = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, base);
        this.tileLayer.add(img);

        if (ch === "=" && barrierOpen) continue;
        if (isHidden(def, ch, x, y, store.flags)) continue;

        if (base !== `t_${ch}` && this.textures.exists(`t_${ch}`)) {
          const over = this.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, `t_${ch}`);
          this.tileLayer.add(over);
          this.animateTile(over, ch, x, y);
        } else {
          this.animateTile(img, ch, x, y);
        }
      }
    }

    // --- entities from markers
    for (const [marker, idef] of Object.entries(def.interacts)) {
      const pos = this.findMarker(def, marker);
      if (!pos) continue;
      if (shouldSkipEntity(idef.kind, idef.partyId, store.flags)) continue;

      const spriteKey = idef.sprite ? `ch_${idef.sprite}` : "";
      let sprite: Phaser.GameObjects.Sprite;
      if (spriteKey && this.textures.exists(spriteKey)) {
        sprite = this.add.sprite(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2 - 2, spriteKey, 0);
      } else {
        // scenery interactable (rustling bush, undergrowth) — draw a bush
        sprite = this.add.sprite(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, "t_h");
      }
      sprite.setDepth(10 + pos.y);
      this.entities.push({ sprite, x: pos.x, y: pos.y, kind: idef.kind, name: idef.name });

      if (spriteKey) {
        const sh = this.add.image(sprite.x, sprite.y + 7, "fx_shadow").setDepth(9 + pos.y);
        this.decorLayer.add(sh);
        this.tweens.add({
          targets: sprite, y: sprite.y - 1, duration: 1400 + Math.random() * 600,
          yoyo: true, repeat: -1, ease: "Sine.InOut",
        });
      }
    }

    // --- highlight the few objects that matter right now
    this.addObjectHighlights(def, store.flags);

    // --- player + follower
    this.px = store.playerX;
    this.py = store.playerY;
    this.dir = store.playerDir;

    this.playerShadow = this.add.image(0, 0, "fx_shadow").setDepth(98);
    this.player = this.add.sprite(0, 0, "ch_palakshi", DIR_FRAME[this.dir]).setDepth(100);
    this.placeSprite(this.player, this.px, this.py);
    this.playerShadow.setPosition(this.player.x, this.player.y + 7);

    const companion = store.party.find((p) => p.id !== "palakshi");
    if (companion) {
      const key = companion.id === "mimo" ? "ch_mimo" : `ch_${companion.id}`;
      this.followerShadow = this.add.image(0, 0, "fx_shadow").setDepth(96);
      this.follower = this.add.sprite(0, 0, key, DIR_FRAME[this.dir]).setDepth(97);
      this.placeSprite(this.follower, this.px, this.py);
      this.followerShadow.setPosition(this.follower.x, this.follower.y + 7);
    }
    this.trail = [];

    // --- camera
    this.cameras.main.setBounds(0, 0, W * TILE, H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);

    this.spawnAmbience(def);

    // --- audio + arrival UI
    playBgm(def.bgm, hard ? 0.6 : 1.2);
    bus.emit("prompt", "");

    const cine = def.cinematic;
    if (cine && !(store.flags as any)[cine.flag]) {
      store.setFlag(cine.flag as keyof Flags, true as never);
      this.playArrivalCinematic(cine.title, cine.subtitle, def.id);
    }
    store.save();
  }

  /** The ground texture painted under every tile of this map. */
  private baseTileFor(def: MapDef, ch: string) {
    if (this.textures.exists(`t_${ch}`) && "._,gFwtfbBDTsdr#kK:jqvcnHLm%eo^uz=!$&~i*+Ihyp".includes(ch)) {
      // solid props still want ground under them
      if ("tHLm%^uq=$&*z!$iI+h~ypsBDTb".includes(ch)) {
        return def.indoor ? "t_f" : def.theme === "cave" ? "t_n" : def.theme === "bamboo" ? "t_." :
               def.theme === "temple" ? "t_f" : def.theme === "village" ? "t_k" :
               def.theme === "mountain" ? "t_:" : def.theme === "garden" ? "t_." : "t_.";
      }
      return `t_${ch}`;
    }
    return def.indoor ? "t_f" : "t_.";
  }

  private findMarker(def: MapDef, marker: string) {
    for (let y = 0; y < def.rows.length; y++) {
      const x = def.rows[y].indexOf(marker);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  /** Small glow + sparkle on genuinely interactive story objects only. */
  private addObjectHighlights(def: MapDef, flags: Flags) {
    const marks: { x: number; y: number }[] = [];
    for (let y = 0; y < def.rows.length; y++) {
      for (let x = 0; x < def.rows[y].length; x++) {
        const ch = def.rows[y][x];
        if (!"$&!".includes(ch)) continue;
        if (isHidden(def, ch, x, y, flags)) continue;
        if (ch === "&" && !flags.guardianDone) continue;
        marks.push({ x, y });
      }
    }
    for (const m of marks) {
      const glow = this.add.image(m.x * TILE + TILE / 2, m.y * TILE + TILE / 2, "fx_glow").setDepth(5);
      this.decorLayer!.add(glow);
      this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 1 }, scale: { from: 0.9, to: 1.15 }, duration: 1100, yoyo: true, repeat: -1 });

      const spark = this.add.image(m.x * TILE + TILE / 2 + 5, m.y * TILE + 3, "fx_spark").setDepth(60);
      this.decorLayer!.add(spark);
      this.tweens.add({ targets: spark, alpha: { from: 1, to: 0.2 }, y: spark.y - 4, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  // ----------------------------------------------------------- ambient life

  private animateTile(img: Phaser.GameObjects.Image, ch: string, x: number, y: number) {
    const phase = ((x * 7 + y * 13) % 10) * 90;
    if (ch === "g" || ch === "F") {
      this.tweens.add({ targets: img, scaleX: 1.06, duration: 900, delay: phase, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    } else if (ch === "t" || ch === "q" || ch === "j") {
      this.tweens.add({ targets: img, angle: 1.1, duration: 1800, delay: phase, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    } else if (ch === "w" || ch === "o") {
      this.tweens.add({ targets: img, alpha: { from: 0.85, to: 1 }, duration: 1200, delay: phase, yoyo: true, repeat: -1 });
    } else if (ch === "L" || ch === "!" || ch === "&" || ch === "I") {
      this.tweens.add({ targets: img, alpha: { from: 0.86, to: 1 }, duration: 520, delay: phase, yoyo: true, repeat: -1 });
    } else if (ch === "=") {
      this.tweens.add({ targets: img, alpha: { from: 0.6, to: 0.95 }, duration: 1000, yoyo: true, repeat: -1 });
    }
  }

  private spawnAmbience(def: MapDef) {
    const W = mapWidth(def) * TILE;
    const H = mapHeight(def) * TILE;
    const add = (key: string, count: number, depth: number, speed: number, drift: number, alpha = 0.55, scale = 0.75) => {
      for (let i = 0; i < count; i++) {
        const s = this.add
          .image(Math.random() * W, Math.random() * H, key)
          .setDepth(depth)
          .setAlpha(alpha)
          .setScale(scale);
        this.decorLayer!.add(s);
        this.tweens.add({
          targets: s,
          x: `+=${drift}`,
          y: `+=${drift * 0.6}`,
          duration: speed + Math.random() * speed,
          yoyo: true, repeat: -1, ease: "Sine.InOut",
          delay: Math.random() * 1500,
        });
      }
    };

    // Ambience is atmosphere, not furniture — kept small and semi-transparent so
    // it never competes with things the player can actually interact with.
    if (def.theme === "garden") add("fx_petal", 22, 120, 3200, 40, 0.6, 0.8);
    if (def.theme === "bamboo") add("fx_leaf", 14, 120, 3600, 34, 0.5, 0.7);
    if (!def.indoor && (def.theme === "outdoor" || def.theme === "village")) {
      add("fx_butterfly", 5, 120, 2400, 26, 0.4, 0.55);
      add("fx_bird", 3, 200, 5200, 90, 0.35, 0.6);
    }
    if (def.theme === "cave") add("fx_spark", 8, 120, 2600, 8, 0.35, 0.5);
  }

  private playArrivalCinematic(title: string, subtitle: string, mapId: MapId) {
    this.inputLocked = true;
    bus.emit("cinematic", { kind: "region", title, subtitle });
    gong();
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2 - 40, 900, "Sine.easeInOut");
    this.time.delayedCall(2600, () => {
      cam.startFollow(this.player, true, 0.16, 0.16);
      this.inputLocked = false;
      if (mapId === "village") useGameStore.getState().openDialogue("village_arrive");
    });
  }

  // --------------------------------------------------------------- movement

  private placeSprite(s: Phaser.GameObjects.Sprite, x: number, y: number) {
    s.setPosition(x * TILE + TILE / 2, y * TILE + TILE / 2 - 2);
  }

  private blocked(x: number, y: number) {
    const def = this.mapDef;
    if (x < 0 || y < 0 || x >= mapWidth(def) || y >= mapHeight(def)) return true;
    const ch = tileAt(def, x, y);

    if (ch === "=") {
      const f = BARRIER_FLAG[def.id];
      const open = f ? !!(useGameStore.getState().flags as any)[f] : false;
      return !open;
    }
    if (SOLID.has(ch)) {
      // collected pickups / spent props stop blocking
      if ("$&*!y".includes(ch) && isHidden(def, ch, x, y, useGameStore.getState().flags)) return false;
      return true;
    }
    return this.entities.some((e) => e.x === x && e.y === y);
  }

  private tryMove(dir: Dir) {
    if (this.moving || this.inputLocked) return;
    this.dir = dir;
    useGameStore.getState().setPlayer(this.px, this.py, dir);
    const [dx, dy] = DELTA[dir];
    const nx = this.px + dx;
    const ny = this.py + dy;

    this.player.setFrame(DIR_FRAME[dir]);
    if (this.blocked(nx, ny)) {
      this.player.setFrame(DIR_FRAME[dir] + (this.stepToggle ^= 1));
      return;
    }

    const prev = { x: this.px, y: this.py };
    this.moving = true;
    this.px = nx;
    this.py = ny;
    this.stepToggle ^= 1;
    this.player.setFrame(DIR_FRAME[dir] + this.stepToggle);
    sfx("step");

    this.tweens.add({
      targets: [this.player, this.playerShadow],
      x: nx * TILE + TILE / 2,
      y: (t: any) => ny * TILE + TILE / 2 - (t === this.playerShadow ? -5 : 2),
      duration: STEP_MS,
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
        this.player.setFrame(DIR_FRAME[dir]);
        this.afterStep();
      },
    });

    this.moveFollower(prev, dir);
  }

  /** The follower always walks the tile the player just left — never teleports. */
  private moveFollower(prev: { x: number; y: number }, dir: Dir) {
    if (!this.follower) return;
    this.trail.push(prev);
    if (this.trail.length > 2) this.trail.shift();
    const target = this.trail[0];
    const f = this.follower;
    const fs = this.followerShadow!;
    const fdx = target.x * TILE + TILE / 2 - f.x;
    const fdy = target.y * TILE + TILE / 2 - 2 - f.y;
    if (Math.abs(fdx) < 1 && Math.abs(fdy) < 1) return;

    const fdir: Dir = Math.abs(fdx) > Math.abs(fdy) ? (fdx > 0 ? "right" : "left") : fdy > 0 ? "down" : "up";
    f.setFrame(DIR_FRAME[fdir] + (this.stepToggle ^ 1));
    this.tweens.add({
      targets: [f, fs],
      x: target.x * TILE + TILE / 2,
      y: (t: any) => target.y * TILE + TILE / 2 - (t === fs ? -5 : 2),
      duration: STEP_MS,
      ease: "Linear",
      onComplete: () => f.setFrame(DIR_FRAME[fdir]),
    });
    if (dir) { /* direction already applied */ }
  }

  private afterStep() {
    const store = useGameStore.getState();
    const def = this.mapDef;
    store.setPlayer(this.px, this.py, this.dir);

    // portal?
    const portal = def.portals.find((p) => p.x === this.px && p.y === this.py);
    if (portal) {
      if (portal.requiresFlag && !(store.flags as any)[portal.requiresFlag]) {
        questSfx.denied();
        bus.emit("toast", { text: portal.lockedText ?? "That way is closed for now.", tone: "warn" });
        // step back off the portal tile
        const [dx, dy] = DELTA[this.dir];
        this.px -= dx;
        this.py -= dy;
        this.placeSprite(this.player, this.px, this.py);
        this.playerShadow.setPosition(this.player.x, this.player.y + 7);
        store.setPlayer(this.px, this.py, this.dir);
        return;
      }
      this.transition(portal.to, portal.tx, portal.ty, portal.dir ?? this.dir);
      return;
    }

    const ch = tileAt(def, this.px, this.py);

    // paw-print clue, first time only
    if (ch === "p" && !store.flags.cluePawsSeen && store.quests[0].step >= 4) {
      store.openDialogue("clue_paws");
      return;
    }

    // wild encounters
    if (ch === "g" && def.encounterEnemies?.length) {
      if (Math.random() < (def.encounterRate ?? 0.1)) {
        const id = Phaser.Utils.Array.GetRandom(def.encounterEnemies);
        this.startBattle(id, false);
        return;
      }
    }

    if (this.time.now - this.autosaveAt > 30000) {
      this.autosaveAt = this.time.now;
      store.save();
    }
  }

  private transition(to: MapId, tx: number, ty: number, dir: Dir) {
    this.inputLocked = true;
    const cam = this.cameras.main;
    cam.fadeOut(180, 10, 5, 7);
    cam.once("camerafadeoutcomplete", () => {
      const store = useGameStore.getState();
      // Leaving the bedroom is what completes the opening objective.
      if (to === "house" && store.quests[0].step === 0) {
        store.advanceQuest("main", "mom");
        questSfx.objective();
        bus.emit("objective:done");
      }
      store.setMap(to, tx, ty, dir);
      this.loadMap(to);
      cam.fadeIn(220, 10, 5, 7);
      this.inputLocked = false;
      bus.emit("cinematic", { kind: "location", mapId: to });
    });
  }

  // ------------------------------------------------------------ interaction

  private facedTile() {
    const [dx, dy] = DELTA[this.dir];
    return { x: this.px + dx, y: this.py + dy };
  }

  /** What is in front of the player right now, entity or tile. */
  private facedInteract(): { kind: string; name?: string; x: number; y: number } | null {
    const { x, y } = this.facedTile();
    const ent = this.entities.find((e) => e.x === x && e.y === y);
    if (ent) return { kind: ent.kind, name: ent.name, x, y };

    const def = this.mapDef;
    const ch = tileAt(def, x, y);
    const flags = useGameStore.getState().flags;
    if (isHidden(def, ch, x, y, flags)) return null;

    const map = INTERACT_TILE;
    // also allow interacting with the tile you're standing on for underfoot props
    if (map[ch] && !(ch in def.interacts)) return { kind: map[ch], x, y };

    const here = tileAt(def, this.px, this.py);
    if (map[here] && UNDERFOOT.includes(here) && !isHidden(def, here, this.px, this.py, flags)) {
      return { kind: map[here], x: this.px, y: this.py };
    }
    return null;
  }

  private tryInteract() {
    if (this.moving || this.inputLocked) return;
    const hit = this.facedInteract();
    if (!hit) return;
    sfx("confirm");
    this.story.handleInteract(hit.kind, hit.x, hit.y);
  }

  private refresh() {
    this.loadMap(this.mapDef.id);
  }

  private flameFlourish(x: number, y: number) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    for (let i = 0; i < 12; i++) {
      const p = this.add.image(cx, cy, "fx_spark").setDepth(200);
      const a = (i / 12) * Math.PI * 2;
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(a) * 30,
        y: cy + Math.sin(a) * 30,
        alpha: 0,
        scale: 0.4,
        duration: 700,
        onComplete: () => p.destroy(),
      });
    }
    this.cameras.main.flash(280, 217, 180, 91);
  }

  // -------------------------------------------------------------- battles

  private startBattle(enemyId: string, boss: boolean) {
    this.inputLocked = true;
    this.cameras.main.flash(220, 217, 180, 91);
    this.time.delayedCall(240, () => {
      useGameStore.getState().setOverlay({ kind: "battle", enemyId, boss });
    });
  }

  // ----------------------------------------------------------------- input

  private onKeyDown(ev: KeyboardEvent) {
    const store = useGameStore.getState();
    if (ev.key === "F5") {
      ev.preventDefault();
      store.save();
      bus.emit("toast", { text: "Game saved.", tone: "info" });
      return;
    }
    if (this.inputLocked || store.overlay) return;
    if (["e", "z", "Enter", " "].includes(ev.key)) {
      ev.preventDefault();
      this.tryInteract();
      return;
    }

    // Movement is edge-triggered here as well as polled in update(). Polling
    // alone drops a quick tap whose keyup lands between two frames, which makes
    // single-tile steps feel unreliable; tryMove() ignores the extra call while
    // a step is already tweening, so holding a key still repeats normally.
    const dir = MOVE_KEYS[ev.key];
    if (dir) {
      ev.preventDefault();
      this.tryMove(dir);
    }
  }

  update() {
    const store = useGameStore.getState();
    const locked = this.inputLocked || !!store.overlay || store.screen !== "playing";

    if (!locked && !this.moving) {
      const k = this.keys;
      const pad = this.input.gamepad?.getPad(0);
      const ax = pad ? pad.axes[0]?.getValue() ?? 0 : 0;
      const ay = pad ? pad.axes[1]?.getValue() ?? 0 : 0;

      if (k.LEFT.isDown || k.A.isDown || pad?.left || ax < -0.4) this.tryMove("left");
      else if (k.RIGHT.isDown || k.D.isDown || pad?.right || ax > 0.4) this.tryMove("right");
      else if (k.UP.isDown || k.W.isDown || pad?.up || ay < -0.4) this.tryMove("up");
      else if (k.DOWN.isDown || k.S.isDown || pad?.down || ay > 0.4) this.tryMove("down");
      else if (pad?.A && Phaser.Input.Keyboard.JustDown(k.E) === false) {
        // gamepad confirm is edge-detected in GameApp; nothing to do here
      }
    }

    // contextual prompt
    const hit = locked ? null : this.facedInteract();
    const label = hit ? promptLabel(hit.kind, hit.name) : "";
    if (label !== this.lastPrompt) {
      this.lastPrompt = label;
      bus.emit("prompt", label);
    }
  }

  /** Called by GameApp when a gamepad A press should act as interact. */
  gamepadConfirm() {
    this.tryInteract();
  }
}
