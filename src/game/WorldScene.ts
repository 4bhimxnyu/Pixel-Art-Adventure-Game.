// ---------------------------------------------------------------------------
// The single Phaser scene. Owns map rendering, grid movement, the follower,
// interactions, encounters and the story branch table.
//
// Regressions this file is written to avoid — do not undo these:
//   * loadMap() destroys the previous player/entities and kills their tweens
//     FIRST, so map changes can never leave a duplicate Palakshi on screen.
//   * bus listeners are registered once and removed on scene SHUTDOWN.
//   * an NPC marker is skipped when that character is already in the party.
//   * story branching lives in handleDialogueEnd(), driven by the store's
//     `dialogue:end` bus event — never inline in the dialogue component.
// ---------------------------------------------------------------------------

import Phaser from "phaser";
import { MAPS, SOLID, BARRIER_FLAG, tileAt, mapWidth, mapHeight, type MapDef, type MapId } from "./maps";
import { TILE, buildAll } from "./textures";
import { buildExpansionTiles } from "./textures.expansion";
import { bus } from "./bus";
import { useGameStore, type Dir, type Flags } from "../store/useGameStore";
import { DOG, ABHIMANYU, QUEST_PRAKRITI, QUEST_HIDDEN, ITEMS, type ItemId } from "../data/content";
import { playBgm, sfx, gong } from "./sound";
import { questSfx } from "../lib/questSfx";

const STEP_MS = 150;
const DIR_FRAME: Record<Dir, number> = { down: 0, up: 2, left: 4, right: 6 };
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

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
  private pendingLines: string | null = null;

  constructor() {
    super("WorldScene");
  }

  // ------------------------------------------------------------------ setup

  create() {
    buildAll(this);
    buildExpansionTiles(this);

    this.cameras.main.setBackgroundColor("#0a0507");
    this.cameras.main.roundPixels = true;

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,E,Z,ENTER,SPACE,ESC,X,I,Q,H,F5"
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on("keydown", this.onKeyDown, this);

    this.busUnsubs.push(bus.on("input:lock", (v: boolean) => { this.inputLocked = !!v; }));
    this.busUnsubs.push(bus.on("dialogue:end", (evt: string | null) => this.handleDialogueEnd(evt)));
    this.busUnsubs.push(bus.on("battle:end", (r: { enemyId: string; won: boolean }) => this.handleBattleEnd(r)));
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
        if (this.isHidden(def, ch, x, y, store.flags)) continue;

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
      if (this.shouldSkipEntity(idef.kind, idef.partyId, store.flags)) continue;

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

  /** Entities that should no longer exist given story state. */
  private shouldSkipEntity(kind: string, partyId: string | undefined, flags: Flags) {
    const party = useGameStore.getState().party;
    if (partyId && party.some((p) => p.id === partyId)) return true;
    switch (kind) {
      case "npc_abhimanyu": return flags.abhimanyuJoined;
      case "mimo_here": return flags.mimoRecognized;
      case "ribbon_spot": return flags.ribbonFound;
      case "npc_prakriti": return flags.prakritiDone;
      case "npc_miniboss1": return flags.miniboss1Done;
      case "npc_miniboss2": return flags.miniboss2Done;
      case "npc_guardian": return flags.guardianDone;
      case "npc_boss": return flags.bossDefeated;
      default: return false;
    }
  }

  /** Collected pickups and spent tiles stop being drawn. */
  private isHidden(def: MapDef, ch: string, x: number, y: number, flags: Flags) {
    const key = `${def.id}_${x}_${y}`;
    if (ch === "h") return !!flags.hidden[key];
    if (ch === "*") return !!flags.chests[key];
    if (ch === "~") return !!flags.digs[key];
    if (ch === "$") return flags.scrollFound;
    if (ch === "y") return flags.clueToyFound;
    if (ch === "!") {
      if (def.id === "mountain") return flags.flameMountain;
      if (def.id === "garden") return flags.flameGarden;
      if (def.id === "cave") return flags.flameCave;
    }
    return false;
  }

  /** Small glow + sparkle on genuinely interactive story objects only. */
  private addObjectHighlights(def: MapDef, flags: Flags) {
    const marks: { x: number; y: number }[] = [];
    for (let y = 0; y < def.rows.length; y++) {
      for (let x = 0; x < def.rows[y].length; x++) {
        const ch = def.rows[y][x];
        if (!"$&!".includes(ch)) continue;
        if (this.isHidden(def, ch, x, y, flags)) continue;
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
    const add = (key: string, count: number, depth: number, speed: number, drift: number) => {
      for (let i = 0; i < count; i++) {
        const s = this.add.image(Math.random() * W, Math.random() * H, key).setDepth(depth).setAlpha(0.85);
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

    if (def.theme === "garden") add("fx_petal", 22, 120, 3200, 40);
    if (def.theme === "bamboo") add("fx_leaf", 14, 120, 3600, 34);
    if (!def.indoor && (def.theme === "outdoor" || def.theme === "village")) {
      add("fx_butterfly", 6, 120, 2400, 26);
      add("fx_bird", 3, 200, 5200, 90);
    }
    if (def.theme === "cave") add("fx_spark", 8, 120, 2600, 8);
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
      if ("$&*".includes(ch) && this.isHidden(def, ch, x, y, useGameStore.getState().flags)) return false;
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
    if (this.isHidden(def, ch, x, y, flags)) return null;

    const map: Record<string, string> = {
      s: "sign", b: "bed", D: "desk", B: "bookshelf", T: "tv", m: "stall", L: "lantern",
      u: "statue", z: "plate", "=": "barrier", $: "scroll", "!": "flame", "&": "sacred_lantern",
      i: "inscription", "*": "chest", "+": "viewpoint", "~": "dig", I: "incense",
      h: "hidden", y: "clue_toy", "%": "banner",
    };
    // also allow interacting with the tile you're standing on for underfoot props
    if (map[ch]) return { kind: map[ch], x, y };

    const here = tileAt(def, this.px, this.py);
    if (map[here] && "zh~+I".includes(here) && !this.isHidden(def, here, this.px, this.py, flags)) {
      return { kind: map[here], x: this.px, y: this.py };
    }
    return null;
  }

  private promptLabel(kind: string, name?: string) {
    switch (kind) {
      case "mimo_here": return "Ask Mimo to investigate";
      case "clue_toy": case "clue_paws": return "Examine clue";
      case "hidden": case "chest": case "dig": case "ribbon_spot": return "Search";
      case "bed": return "Rest";
      case "npc_miniboss1": case "npc_miniboss2": case "npc_guardian":
      case "npc_boss": case "npc_prakriti_duel": return "Begin the fight";
      case "sign": case "inscription": case "bookshelf": case "desk": case "tv":
      case "statue": case "banner": case "viewpoint": return "Examine";
      case "plate": return "Stand on the plate";
      case "barrier": return "Try the barrier";
      case "scroll": return "Take the scroll";
      case "flame": return "Take the flame";
      case "sacred_lantern": return "Light the lantern";
      case "lantern": return "Examine lantern";
      case "incense": return "Offer incense";
      case "stall": return "Browse";
      default:
        if (kind.startsWith("npc_")) return name ? `Talk to ${name}` : "Talk";
        return "Interact";
    }
  }

  private tryInteract() {
    if (this.moving || this.inputLocked) return;
    const hit = this.facedInteract();
    if (!hit) return;
    sfx("confirm");
    this.handleInteract(hit.kind, hit.x, hit.y);
  }

  private handleInteract(kind: string, x: number, y: number) {
    const store = useGameStore.getState();
    const f = store.flags;
    const def = this.mapDef;
    const key = `${def.id}_${x}_${y}`;
    const D = (k: string) => store.openDialogue(k);

    switch (kind) {
      // ---------------------------------------------------------- scenery
      case "sign": return D(def.id === "bedroom" ? "sign_bedroom" : "townie1");
      case "bed": return D("bed");
      case "desk": return D("desk");
      case "bookshelf": return D("bookshelf");
      case "tv": return D("tv");
      case "banner": return this.say("A festival banner, folded and put away too early.");
      case "lantern": return this.say(f.lanternRestored ? "The lantern burns steady and gold." : "Cold. The wick hasn't been lit in days.");
      case "stall": return this.say("Rice cakes, dried plums, and a very determined cat.");
      case "viewpoint": return D("viewpoint");
      case "inscription": {
        store.markRecord("lore", key);
        return D("inscription");
      }
      case "incense": {
        gong();
        return this.say("You offer incense. The smoke goes straight up — the temple is listening.");
      }

      // ---------------------------------------------------------- pickups
      case "hidden": {
        if (f.hidden[key]) return;
        store.markRecord("hidden", key);
        store.addQuest(QUEST_HIDDEN);
        const item: ItemId =
          def.id === "bedroom" ? "key_scarf" : def.id === "town" ? "hair_pin" :
          def.id === "forest" ? "berry" : "sparkle_shard";
        store.addItem(item);
        store.advanceQuest("hidden");
        questSfx.objective();
        bus.emit("toast", { text: `Found ${ITEMS[item].name}!`, tone: "good" });
        return this.refresh();
      }
      case "chest": {
        if (f.chests[key]) return;
        store.markRecord("chests", key);
        const item: ItemId = def.id === "cave" ? "super_potion" : def.id === "village" ? "lantern_oil" : "potion";
        store.addItem(item, 2);
        questSfx.objective();
        bus.emit("toast", { text: `Chest: ${ITEMS[item].name} x2`, tone: "good" });
        return this.refresh();
      }
      case "dig": {
        if (f.digs[key]) return;
        if (!store.party.some((p) => p.id === "mimo")) {
          return this.say("Soft earth. Somebody with paws could dig here.");
        }
        store.markRecord("digs", key);
        store.addItem("old_photo");
        questSfx.objective();
        bus.emit("toast", { text: "Mimo digs up an Old Photo.", tone: "good" });
        return this.refresh();
      }
      case "ribbon_spot": {
        store.setFlag("ribbonFound", true);
        store.addItem("lost_ribbon");
        store.advanceQuest("prakriti", "return");
        questSfx.objective();
        bus.emit("toast", { text: "Found the Lost Ribbon.", tone: "good" });
        return this.refresh();
      }
      case "clue_toy": {
        if (f.clueToyFound) return;
        return D("clue_toy");
      }

      // ---------------------------------------------------------- puzzles
      case "statue": {
        if (f.statues[key]) return this.say("The statue's eyes are already lit.");
        store.markRecord("statues", key);
        gong();
        bus.emit("toast", { text: "The statue's eyes light up.", tone: "good" });
        this.checkPuzzle();
        return;
      }
      case "plate": {
        if (f.plates[key]) return this.say("This plate is already held down.");
        const needed = this.puzzleStatuesFor(def.id);
        const lit = Object.keys(f.statues).filter((k) => k.startsWith(def.id)).length;
        if (lit < needed) {
          questSfx.denied();
          return this.say(`The plate won't hold. ${needed - lit} statue(s) still sleeping.`);
        }
        store.markRecord("plates", key);
        sfx("confirm");
        bus.emit("toast", { text: "The plate sinks with a stone click.", tone: "good" });
        this.checkPuzzle();
        return;
      }
      case "barrier": {
        if (def.id === "academy") return D("gatekeeper_locked");
        if (f.barrierBroken) return;
        if (!f.musicianMet) return D("barrier_locked");
        return D(store.party.some((p) => p.id === "abhimanyu") ? "barrier_break" : "barrier_break_mimo");
      }
      case "scroll": {
        if (f.scrollFound) return;
        return D("scroll_take");
      }
      case "flame": {
        const which =
          def.id === "mountain" ? "flameMountain" : def.id === "garden" ? "flameGarden" : "flameCave";
        if ((f as any)[which]) return;
        if (def.id === "mountain" && !f.miniboss2Done) {
          questSfx.denied();
          return this.say("The Warden's staff bars the shrine. Face him first.");
        }
        store.setFlag(which as keyof Flags, true as never);
        const item: ItemId =
          def.id === "mountain" ? "sacred_flame_mountain" : def.id === "garden" ? "sacred_flame_garden" : "sacred_flame_cave";
        store.addItem(item);
        questSfx.flame();
        bus.emit("flame:collected", { which, name: ITEMS[item].name });
        this.flameFlourish(x, y);

        const s2 = useGameStore.getState();
        const n = [s2.flags.flameMountain, s2.flags.flameGarden, s2.flags.flameCave].filter(Boolean).length;
        bus.emit("toast", { text: `Sacred Flame ${n}/3 — ${ITEMS[item].name}`, tone: "good" });
        if (n === 3) {
          store.advanceQuest("main", "lantern");
          bus.emit("cinematic", { kind: "objective", title: "ALL THREE FLAMES GATHERED", subtitle: "Return to the Temple of Echoes" });
        }
        return this.refresh();
      }
      case "sacred_lantern": {
        if (f.lanternRestored) return this.say("The Sacred Lantern burns. The village will see it from the valley.");
        const n = [f.flameMountain, f.flameGarden, f.flameCave].filter(Boolean).length;
        if (n < 3) {
          questSfx.denied();
          return this.say(`The lantern is cold. ${3 - n} Sacred Flame(s) still out there.`);
        }
        return D("lantern_restored");
      }

      // ---------------------------------------------------------------- npcs
      case "npc_mom": return D(f.metMom ? "mom_after" : "mom");
      case "npc_abhimanyu": return D("abhimanyu_meet");
      case "npc_witness": return D(f.clueWitnessHeard ? "townie2" : "witness");
      case "npc_townie1": return D("townie1");
      case "npc_townie2": return D("townie2");
      case "mimo_here": return D("mimo_bush");
      case "npc_prakriti": {
        const q = store.quests.find((qq) => qq.id === "prakriti");
        if (!q) return D("prakriti_meet");
        if (f.ribbonFound && !q.done) return D("prakriti_ribbon_return");
        return D("prakriti_wait");
      }
      case "npc_prakriti_duel": return D("prakriti_duel");
      case "npc_villager1": case "npc_villager2": case "npc_villager3":
      case "npc_villager4": case "npc_villager5": {
        store.markRecord("npcSpoken", `${def.id}_${kind}`);
        return D("villager");
      }
      case "npc_merchant": return D(f.villageSupplies ? "villager" : "merchant");
      case "npc_musician": return D(f.musicianMet ? "villager" : "musician");
      case "npc_elder": {
        if (!f.elderBriefed) return D("elder");
        if (f.scrollFound && !f.scrollDelivered) return D("elder_scroll");
        return D("elder_wait");
      }
      case "npc_monk": return D("monk");
      case "npc_miniboss1": return D("miniboss1");
      case "npc_miniboss2": return D("miniboss2");
      case "npc_guardian": {
        const needP = this.puzzlePlatesFor("temple");
        const lit = Object.keys(f.plates).filter((k) => k.startsWith("temple")).length;
        if (lit < needP) {
          questSfx.denied();
          return this.say("THE PLATES ARE NOT HELD. THE TEMPLE STAYS ASLEEP.");
        }
        return D("guardian");
      }
      case "npc_gatekeeper": {
        if (f.gateOpen) return this.say("Go on in. Mind the stairs.");
        if (!store.hasItem("fashion_pass")) return D("gatekeeper_locked");
        return D("gatekeeper_open");
      }
      case "npc_boss": return D("boss_meet");
      default:
        return;
    }
  }

  private say(text: string) {
    useGameStore.getState().openLines([{ who: "Palakshi", portrait: "palakshi", text }]);
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

  // ------------------------------------------------------------- puzzles

  private puzzleStatuesFor(id: MapId) {
    return id === "temple" ? 4 : 2;
  }
  private puzzlePlatesFor(id: MapId) {
    return id === "temple" ? 4 : 2;
  }

  private checkPuzzle() {
    const store = useGameStore.getState();
    const id = this.mapDef.id;
    const statues = Object.keys(store.flags.statues).filter((k) => k.startsWith(id)).length;
    const plates = Object.keys(store.flags.plates).filter((k) => k.startsWith(id)).length;
    bus.emit("puzzle", {
      mapId: id,
      statues, plates,
      needStatues: this.puzzleStatuesFor(id),
      needPlates: this.puzzlePlatesFor(id),
    });

    if (id === "bamboo" && statues >= 2 && plates >= 2 && !store.flags.trialStarted) {
      store.setFlag("trialStarted", true);
      gong();
      bus.emit("toast", { text: "The shrine stirs. The Sentinel is awake.", tone: "warn" });
    }
    if (id === "temple" && statues >= 4 && plates >= 4 && !store.flags.templeOpened) {
      store.setFlag("templeOpened", true);
      gong();
      bus.emit("toast", { text: "Four plates held. The Guardian will see you now.", tone: "warn" });
    }
  }

  // -------------------------------------------------------------- battles

  private startBattle(enemyId: string, boss: boolean) {
    this.inputLocked = true;
    this.cameras.main.flash(220, 217, 180, 91);
    this.time.delayedCall(240, () => {
      useGameStore.getState().setOverlay({ kind: "battle", enemyId, boss });
    });
  }

  private handleBattleEnd(r: { enemyId: string; won: boolean }) {
    const store = useGameStore.getState();
    this.inputLocked = false;
    if (!r.won) {
      store.setScreen("title");
      return;
    }
    playBgm(this.mapDef.bgm, 1.0);
    switch (r.enemyId) {
      case "wild_mimo": return void this.time.delayedCall(300, () => store.openDialogue("mimo_recognize"));
      case "boss_sentinel": return void this.time.delayedCall(300, () => store.openDialogue("miniboss1_done"));
      case "boss_warden": return void this.time.delayedCall(300, () => store.openDialogue("miniboss2_done"));
      case "boss_guardian": return void this.time.delayedCall(300, () => store.openDialogue("guardian_done"));
      case "prakriti_boss": return void this.time.delayedCall(300, () => store.openDialogue("prakriti_defeat"));
      case "fashion_teacher": return void this.time.delayedCall(300, () => store.openDialogue("boss_defeat"));
      default: return;
    }
  }

  // ---------------------------------------------------- story branch table

  private handleDialogueEnd(evt: string | null) {
    if (!evt) return;
    const store = useGameStore.getState();
    const adv = (step: string) => {
      store.advanceQuest("main", step);
      questSfx.objective();
      bus.emit("objective:done");
    };

    switch (evt) {
      case "intro_done":
        store.setFlag("introDone", true);
        break;

      case "give_super_potion":
        store.setFlag("metMom", true);
        store.addItem("super_potion");
        bus.emit("toast", { text: "Received Super Potion.", tone: "good" });
        adv("abhi");
        break;

      case "abhi_join":
        store.setFlag("metAbhimanyu", true);
        store.setFlag("abhimanyuJoined", true);
        store.addFighter(ABHIMANYU);
        bus.emit("toast", { text: "Abhimanyu joined you.", tone: "good" });
        adv("clue_toy");
        this.refresh();
        break;

      case "clue_toy_found":
        store.setFlag("clueToyFound", true);
        adv("clue_npc");
        this.refresh();
        break;

      case "clue_witness":
        store.setFlag("clueWitnessHeard", true);
        adv("clue_paws");
        break;

      case "clue_paws_found":
        store.setFlag("cluePawsSeen", true);
        adv("mimo");
        break;

      case "start_mimo_battle":
        this.startBattle("wild_mimo", false);
        break;

      case "mimo_join":
        store.setFlag("mimoRecognized", true);
        store.removeFighter("abhimanyu");
        store.addFighter(DOG);
        store.healParty();
        playBgm("bgm_reunion", 1.0);
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Find Mimo" });
        adv("village");
        this.time.delayedCall(2600, () => {
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "Lantern Village" });
          playBgm(this.mapDef.bgm, 1.4);
        });
        this.refresh();
        break;

      case "prakriti_quest":
        store.setFlag("metPrakriti", true);
        store.addQuest(QUEST_PRAKRITI);
        store.advanceQuest("prakriti", "ribbon");
        bus.emit("toast", { text: "New side mission: Prakriti's Ribbon", tone: "info" });
        break;

      case "prakriti_reward":
        store.addItem("jade_charm");
        store.advanceQuest("prakriti");
        store.advanceQuest("prakriti");
        bus.emit("cinematic", { kind: "mission-complete", title: "SIDE MISSION COMPLETE", subtitle: "Prakriti's Ribbon" });
        break;

      case "village_talk":
        store.setFlag("villageTalks", store.flags.villageTalks + 1);
        break;

      case "give_supplies":
        store.setFlag("villageSupplies", true);
        store.addItem("village_supplies");
        store.addItem("potion", 2);
        bus.emit("toast", { text: "Received Village Supplies and 2 Potions.", tone: "good" });
        break;

      case "guitar_learned":
        store.setFlag("musicianMet", true);
        store.setFlag("guitarPerformed", true);
        bus.emit("toast", { text: "Learned SOUND BARRIER.", tone: "good" });
        break;

      case "elder_brief":
        store.setFlag("elderBriefed", true);
        bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "The Lost Scroll" });
        adv("scroll");
        break;

      case "barrier_broken":
        store.setFlag("barrierBroken", true);
        gong();
        this.cameras.main.shake(320, 0.01);
        bus.emit("toast", { text: "The bamboo wall splits open.", tone: "good" });
        this.refresh();
        break;

      case "scroll_taken":
        store.setFlag("scrollFound", true);
        store.addItem("lost_scroll");
        bus.emit("toast", { text: "Obtained the Lost Scroll.", tone: "good" });
        this.refresh();
        break;

      case "scroll_given":
        store.setFlag("scrollDelivered", true);
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "The Lost Scroll" });
        adv("trial");
        this.time.delayedCall(2400, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "Bamboo Forest Trial" })
        );
        break;

      case "start_miniboss1": this.startBattle("boss_sentinel", true); break;
      case "miniboss1_end":
        store.setFlag("miniboss1Done", true);
        store.setFlag("trialDone", true);
        store.addItem("trial_talisman");
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Bamboo Forest Trial" });
        adv("prakriti");
        this.refresh();
        break;

      case "start_prakriti": this.startBattle("prakriti_boss", true); break;
      case "prakriti_done":
        store.setFlag("prakritiDone", true);
        store.addItem("fashion_pass");
        bus.emit("toast", { text: "Received the Fashion Pass.", tone: "good" });
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Rival: Prakriti" });
        adv("temple");
        this.refresh();
        break;

      case "start_miniboss2": this.startBattle("boss_warden", true); break;
      case "miniboss2_end":
        store.setFlag("miniboss2Done", true);
        bus.emit("toast", { text: "The Mountain Shrine is open.", tone: "good" });
        this.refresh();
        break;

      case "start_guardian": this.startBattle("boss_guardian", true); break;
      case "guardian_end":
        store.setFlag("guardianDone", true);
        store.setFlag("templeOpened", true);
        store.addItem("lore_book");
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Temple of Echoes" });
        adv("flames");
        this.time.delayedCall(2400, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "Restore the Sacred Lantern" })
        );
        this.refresh();
        break;

      case "lantern_restored":
        store.setFlag("lanternRestored", true);
        gong();
        this.cameras.main.flash(600, 242, 223, 166);
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Restore the Sacred Lantern" });
        adv("pass");
        this.time.delayedCall(2400, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "FINAL MISSION", subtitle: "Defeat Arshiya" })
        );
        this.refresh();
        break;

      case "gate_open":
        store.setFlag("gateOpen", true);
        adv("boss");
        this.refresh();
        break;

      case "start_boss": this.startBattle("fashion_teacher", true); break;

      case "boss_end":
        store.setFlag("bossDefeated", true);
        store.advanceQuest("main");
        store.healParty();
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Defeat Arshiya" });
        this.time.delayedCall(2600, () => useGameStore.getState().openDialogue("finale"));
        this.refresh();
        break;

      case "credits":
        store.setFlag("credits", true);
        store.save();
        store.setScreen("credits");
        break;

      default:
        console.warn(`[WorldScene] unhandled dialogue:end "${evt}"`);
    }
    useGameStore.getState().save();
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
    const label = hit ? this.promptLabel(hit.kind, hit.name) : "";
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
