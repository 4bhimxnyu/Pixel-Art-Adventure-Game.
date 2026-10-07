// ---------------------------------------------------------------------------
// The 3D world. One instance, created when the game starts playing and
// destroyed when it stops — exactly where the Phaser game used to live.
//
// It owns: renderer, scene, lights, the current region (MapBuilder), the
// player rig, the companion rig, NPC/object entities, the third-person camera,
// movement + collision on the tile grid, interactions, portals, encounters,
// the battle stage, and cinematics. Everything that decides what HAPPENS goes
// through the shared StoryController — this file only decides how it looks.
//
// Duplicate-character guarantees (the old sprite bug, fixed at the root):
//   * World3D.instance is a singleton; a second construction destroys the
//     first. React StrictMode / re-renders can never produce two worlds.
//   * loadMap() disposes every rig and entity FIRST, then rebuilds from the
//     store, so a map change cannot leave a second Palakshi, Mimo or Abhimanyu.
//   * rigs are keyed by character id in a Map — one id, one rig.
//   * NPC markers are skipped when that character is in the party.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { MAPS, tileAt, mapWidth, mapHeight, type MapDef, type MapId } from "../game/maps";
import { bus } from "../game/bus";
import { useGameStore, type Dir, type Flags } from "../store/useGameStore";
import { ENEMIES } from "../data/content";
import { playBgm, sfx, gong } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import {
  StoryController, shouldSkipEntity, isHidden, cellBlocked, promptLabel, INTERACT_TILE, UNDERFOOT,
  type WorldFx,
} from "../game/story";
import { buildMap, propObject, type BuiltMap } from "./MapBuilder";
import { CharacterRig } from "./CharacterRig";
import { DogRig } from "./DogRig";
import { makeEnemyRig } from "./EnemyRig";
import type { BaseRig } from "./BaseRig";
import { CameraRig, type Keyframe } from "./CameraRig";
import { AmbientParticles, Burst } from "./Particles";
import { PawTrail } from "./PawTrail";
import { G, glow, mat, disposeObject, skyMaterial } from "./materials";
import { input, isTouchDevice } from "../input/InputManager";
import { currentStepId } from "../store/useGameStore";
import { targetFor, routeBetween } from "../lib/targets";
import { MAP_PLACE, guideFor } from "../lib/guidance";

type Entity = {
  kind: string;
  name?: string;
  x: number;
  y: number;
  rig: BaseRig | null;
  object: THREE.Object3D;
  update?: (dt: number) => void;
};

type Battle = {
  enemyId: string;
  enemy: BaseRig;
  center: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
  frontId: string;
  playerPos: THREE.Vector3;
  enemyPos: THREE.Vector3;
};

const WALK = 3.4;
const DASH = 7.5;
const RADIUS = 0.27;
/**
 * Grid ↔ world. Columns run along +x; rows run along -z (row 0 is the far,
 * "north" edge), so a camera behind the player sees east on the right.
 * A rig at rotation 0 faces +z; heading π faces "down" the map.
 */
const Z = (row: number) => -(row + 0.5);
const ROW = (wz: number) => Math.floor(-wz);
const DIR_HEADING: Record<Dir, number> = { down: Math.PI, up: 0, left: -Math.PI / 2, right: Math.PI / 2 };

function headingToDir(h: number): Dir {
  const s = Math.sin(h);
  const c = Math.cos(h);
  if (Math.abs(s) > Math.abs(c)) return s > 0 ? "right" : "left";
  return c > 0 ? "up" : "down";
}

/** Camera-blocking height per tile char. */
function tileHeight(ch: string) {
  if ("#Kc".includes(ch)) return 1.9;
  if ("tq".includes(ch)) return 2.1;
  if (ch === "j") return 2.6;
  if (ch === "H") return 2.9;
  if ("wo".includes(ch)) return 0;
  if (ch === "^") return 1.0;
  return 1.1;
}

export class World3D {
  static instance: World3D | null = null;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam: CameraRig;
  private timer = new THREE.Timer();
  private raf = 0;
  private running = false;
  private parent: HTMLElement;
  private resizeObs: ResizeObserver;

  private mapDef!: MapDef;
  private built: BuiltMap | null = null;
  private sky: THREE.Mesh | null = null;
  private water: THREE.Mesh | null = null;
  private hemi = new THREE.HemisphereLight("#ffffff", "#444444", 1);
  private sun = new THREE.DirectionalLight("#ffffff", 1);
  private ambient = new THREE.AmbientLight("#ffffff", 0.2);
  private points: THREE.PointLight[] = [];
  private particles: AmbientParticles | null = null;
  private bursts: Burst[] = [];
  private highlightGroup: THREE.Group | null = null;
  private highlightDiscs: THREE.Mesh[] = [];
  private pingMarker: THREE.Group | null = null;
  private pingUntil = 0;

  /** Rigs keyed by character id — the one-id-one-rig rule. */
  private rigs = new Map<string, BaseRig>();
  private player!: CharacterRig;
  private playerPos = new THREE.Vector3();
  private heading = 0;
  private companion: BaseRig | null = null;
  private companionId: string | null = null;
  private trail: THREE.Vector3[] = [];
  private entities: Entity[] = [];
  private story: StoryController;
  private busUnsubs: (() => void)[] = [];
  private unsubStore: (() => void) | null = null;

  private inputLocked = false;
  private lastPrompt = "";
  private lastCell = { x: -1, y: -1 };
  private dashT = 0;
  private dashDir = new THREE.Vector3();
  private warnCooldown = 0;
  private mimoIdle = 0;
  private battle: Battle | null = null;
  private mode: "explore" | "battle" | "cinematic" = "explore";
  /** The NPC the player last spoke to — hidden while their own battle rig stands in. */
  private lastTalked: Entity | null = null;
  private hiddenForBattle: Entity | null = null;
  /** Objective beacon: over the thing to reach, or over the exit that leads to it. */
  private beacon: THREE.Group | null = null;
  private beaconDirty = true;
  private vel = new THREE.Vector3();
  private stuckT = 0;
  private stuckShown = false;
  private lastStuckPos = new THREE.Vector3();
  private pawTrail: PawTrail | null = null;
  private lockedBefore = new Map<MapId, string>();
  private promptSeenAt = 0;
  private quality: { shadows: boolean; mobile: boolean; particles: number };
  private timers: number[] = [];
  private hugDone = false;

  constructor(parent: HTMLElement) {
    if (World3D.instance) World3D.instance.destroy();
    World3D.instance = this;
    this.parent = parent;

    const mobile = isTouchDevice() || Math.min(window.innerWidth, window.innerHeight) < 600;
    this.quality = { shadows: !mobile, mobile, particles: mobile ? 0.5 : 1 };

    this.renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    parent.appendChild(this.renderer.domElement);

    this.cam = new CameraRig(parent.clientWidth / Math.max(1, parent.clientHeight));
    this.cam.obstacle = (x, z) => this.cameraObstacle(x, z);

    this.sun.castShadow = this.quality.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.ambient);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PointLight("#ffaa66", 0, 7, 2);
      this.points.push(p);
      this.scene.add(p);
    }

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(parent);
    this.resize();

    input.bind(this.renderer.domElement);
    const settings = useGameStore.getState().settings;
    input.lookSens = settings.lookSens ?? 1;
    input.invertY = !!settings.invertY;

    const fx: WorldFx = {
      refresh: () => this.refresh(),
      startBattle: (id, boss) => this.startBattle(id, boss),
      flash: (ms, rgb) => bus.emit("fade", { flash: true, ms, color: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }),
      shake: (ms, intensity) => this.cam.shake(ms, intensity * 40),
      flourish: (x, y) => this.flourish(x, y),
      delay: (ms, fn) => this.delay(ms, fn),
      currentMap: () => this.mapDef,
      cinematic: (kind, payload) => this.cinematic(kind, payload),
    };
    this.story = new StoryController(fx);

    this.busUnsubs.push(bus.on("input:lock", (v: boolean) => { if (!this.cam.cinematicActive) this.inputLocked = !!v; }));
    this.busUnsubs.push(bus.on("dialogue:end", (evt: string | null) => this.story.handleDialogueEnd(evt)));
    this.busUnsubs.push(bus.on("battle:end", (r: { enemyId: string; won: boolean; fled?: boolean }) => this.endBattle(r)));
    this.busUnsubs.push(bus.on("battle:fx", (p: any) => this.battleFx(p)));
    this.busUnsubs.push(bus.on("world:reload", () => this.loadMap(useGameStore.getState().map, true)));
    this.busUnsubs.push(bus.on("mimo:ping", () => this.mimoSniff()));
    this.busUnsubs.push(bus.on("unstuck", () => this.resetPosition()));
    this.busUnsubs.push(bus.on("help:direction", () => this.showDirection()));
    this.unsubStore = useGameStore.subscribe((s, prev) => {
      input.overlayOpen = !!s.overlay;
      if (s.settings !== prev.settings) {
        input.lookSens = s.settings.lookSens ?? 1;
        input.invertY = !!s.settings.invertY;
      }
      if (s.quests !== prev.quests || s.flags !== prev.flags || s.party !== prev.party) this.beaconDirty = true;
    });
    input.overlayOpen = !!useGameStore.getState().overlay;

    const s = useGameStore.getState();
    this.loadMap(s.map, true);
    if (!s.flags.introDone) this.delay(420, () => useGameStore.getState().openDialogue("intro"));

    this.running = true;
    this.loop();
    if (import.meta.env.DEV) (window as any).__world = this;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.busUnsubs.forEach((off) => off());
    this.busUnsubs = [];
    this.unsubStore?.();
    this.resizeObs.disconnect();
    this.clearMap();
    input.unbind();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (World3D.instance === this) World3D.instance = null;
  }

  private delay(ms: number, fn: () => void) {
    const t = window.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      if (this.running) fn();
    }, ms);
    this.timers.push(t);
  }

  private resize() {
    const w = Math.max(1, this.parent.clientWidth);
    const h = Math.max(1, this.parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.cam.camera.aspect = w / h;
    this.cam.camera.fov = w < h ? 62 : 50;
    this.cam.camera.updateProjectionMatrix();
  }

  // ================================================================== map

  private clearMap() {
    for (const e of this.entities) {
      e.rig?.dispose();
      disposeObject(e.object);
    }
    this.entities = [];
    for (const r of this.rigs.values()) r.dispose();
    this.rigs.clear();
    this.companion = null;
    this.companionId = null;
    if (this.battle) {
      this.battle.enemy.dispose();
      this.battle = null;
    }
    this.built?.dispose();
    this.built = null;
    this.particles?.dispose();
    this.particles = null;
    for (const b of this.bursts) disposeObject(b.points);
    this.bursts = [];
    if (this.highlightGroup) disposeObject(this.highlightGroup);
    this.highlightGroup = null;
    this.highlightDiscs = [];
    if (this.pingMarker) disposeObject(this.pingMarker);
    this.pingMarker = null;
    if (this.beacon) disposeObject(this.beacon);
    this.beacon = null;
    this.pawTrail?.dispose();
    this.pawTrail = null;
    this.trail = [];
  }

  loadMap(id: MapId, hard = false) {
    const store = useGameStore.getState();
    const def = MAPS[id];
    const sameMap = this.mapDef?.id === id && !hard;
    const keepPos = sameMap ? this.playerPos.clone() : null;
    const keepHeading = this.heading;
    const keepCompanion = sameMap && this.companion ? this.companion.group.position.clone() : null;

    this.clearMap();
    this.mapDef = def;
    this.mode = "explore";

    // --- region geometry + theme
    this.built = buildMap(def, store.flags, { shadows: this.quality.shadows });
    this.scene.add(this.built.group);
    const th = this.built.theme;
    this.scene.background = new THREE.Color(th.sky);
    if (!th.indoor) {
      const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), skyMaterial(th.skyTop ?? th.sky, th.fog));
      sky.name = "sky";
      sky.frustumCulled = false;
      this.built.group.add(sky);
      this.sky = sky;
    } else {
      this.sky = null;
    }
    this.water = this.built.group.getObjectByName("water") as THREE.Mesh | null;
    this.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.hemi.color.set(th.hemiSky);
    this.hemi.groundColor.set(th.hemiGround);
    this.hemi.intensity = th.hemi;
    this.ambient.intensity = th.ambient;
    this.sun.color.set(th.sun);
    this.sun.intensity = th.sunIntensity;
    const W = mapWidth(def);
    const H = mapHeight(def);
    const cx = W / 2;
    const cz = H / 2;
    const sd = new THREE.Vector3(...th.sunDir).normalize();
    this.sun.position.set(cx + sd.x * 30, sd.y * 30, -cz + sd.z * 30);
    this.sun.target.position.set(cx, 0, -cz);
    const ext = Math.max(W, H) / 2 + 4;
    const sc = this.sun.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80;
    sc.updateProjectionMatrix();
    this.cam.indoor = th.indoor;

    if (th.particles) {
      this.particles = new AmbientParticles(th.particles, W, H, this.quality.particles);
      this.particles.points.position.z = -H;
      this.scene.add(this.particles.points);
    }
    this.buildHighlights();
    this.pawTrail = new PawTrail();
    this.scene.add(this.pawTrail.mesh);

    // a gate that was closed last time we stood here has just opened
    const lockedNow = this.built.gates.filter((g) => g.locked).map((g) => g.to).sort().join(",");
    const lockedThen = this.lockedBefore.get(id);
    const opened = sameMap && lockedThen !== undefined && lockedThen !== lockedNow
      ? this.built.gates.find((g) => !g.locked && lockedThen.split(",").includes(g.to)) ?? null
      : null;
    this.lockedBefore.set(id, lockedNow);

    // --- entities from markers
    for (const [marker, idef] of Object.entries(def.interacts)) {
      let pos = this.findMarker(def, marker);
      if (!pos) continue;
      if (shouldSkipEntity(idef.kind, idef.partyId, store.flags)) continue;
      pos = this.entityOverride(def, idef.kind, pos, store.flags);

      let rig: BaseRig | null = null;
      let object: THREE.Object3D;
      let update: Entity["update"];
      if (idef.sprite) {
        // "enemy:<species>" puts a creature in the world (the Blossom Warden at its shrine)
        rig = idef.sprite === "mimo" ? new DogRig()
          : idef.sprite.startsWith("enemy:") ? makeEnemyRig(idef.sprite.slice(6), true)
          : new CharacterRig(idef.sprite);
        object = rig.group;
        rig.setShadows(this.quality.shadows);
        rig.setHeading(this.npcHeading(def, idef.kind, pos), true);
        if (!idef.sprite.startsWith("enemy:")) this.tryOverride(rig, idef.sprite);
      } else {
        // scenery interactable: the rustling bush, the undergrowth with a ribbon in it
        const g = propObject(idef.kind === "ribbon_spot" ? "bush" : "sparkleBush");
        if (idef.kind === "ribbon_spot") {
          const rib = new THREE.Mesh(G.box(0.18, 0.03, 0.06), glow("#2fa3a3"));
          rib.position.set(0.15, 0.5, 0.2);
          rib.rotation.z = 0.5;
          g.add(rib);
        }
        object = g;
        if (idef.kind === "mimo_here") {
          let t = Math.random() * 10;
          update = (dt) => {
            t += dt;
            const k = Math.sin(t * 18) * (Math.sin(t * 1.3) > 0.4 ? 0.06 : 0.01);
            g.rotation.z = k;
            g.scale.set(1 + k, 1 - k * 0.5, 1 + k);
          };
        }
      }
      object.position.set(pos.x + 0.5, 0, Z(pos.y));
      this.scene.add(object);
      this.entities.push({ kind: idef.kind, name: idef.name, x: pos.x, y: pos.y, rig, object, update });
    }

    // --- player
    const palakshi = new CharacterRig("palakshi");
    palakshi.setShadows(this.quality.shadows);
    this.tryOverride(palakshi, "palakshi");
    this.rigs.set("palakshi", palakshi);
    this.player = palakshi;
    this.scene.add(palakshi.group);
    if (keepPos) {
      this.playerPos.copy(keepPos);
      this.heading = keepHeading;
    } else {
      this.playerPos.set(store.playerX + 0.5, 0, Z(store.playerY));
      this.heading = DIR_HEADING[store.playerDir];
    }
    palakshi.group.position.copy(this.playerPos);
    palakshi.setHeading(this.heading, true);
    this.lastCell = { x: Math.floor(this.playerPos.x), y: ROW(this.playerPos.z) };

    // --- companion (never a duplicate of an NPC: shouldSkipEntity handled that above)
    const comp = store.party.find((p) => p.id !== "palakshi");
    if (comp) {
      const rig = comp.id === "mimo" ? new DogRig() : new CharacterRig(comp.id);
      rig.setShadows(this.quality.shadows);
      if (comp.id !== "mimo") this.tryOverride(rig, comp.id);
      this.rigs.set(comp.id, rig);
      this.companion = rig;
      this.companionId = comp.id;
      const back = keepCompanion ?? this.playerPos.clone().add(new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading)).multiplyScalar(0.9));
      rig.group.position.copy(back);
      rig.setHeading(this.heading, true);
      this.scene.add(rig.group);
    }
    this.trail = [this.playerPos.clone()];

    // --- camera
    this.cam.firstPerson = def.id === "f1205";
    if (!sameMap) this.cam.snapBehind(this.playerPos, this.heading);

    // --- audio + arrival UI
    playBgm(def.bgm, hard ? 0.6 : 1.2);
    bus.emit("prompt", "");
    this.lastPrompt = "";

    const cine = def.cinematic;
    if (cine && !(store.flags as any)[cine.flag]) {
      store.setFlag(cine.flag as keyof Flags, true as never);
      this.arrivalCinematic(cine.title, cine.subtitle, def.id);
    } else if (opened) {
      this.delay(600, () => this.gateOpensCinematic(opened));
    }
    this.beaconDirty = true;
    this.vel.set(0, 0, 0);
    this.stuckT = 0;
    store.save();
  }

  // ================================================================ guidance

  /** A gold column + floating diamond over the current objective (or the exit toward it). */
  private updateBeacon() {
    this.beaconDirty = false;
    if (this.beacon) {
      disposeObject(this.beacon);
      this.beacon = null;
    }
    const s = useGameStore.getState();
    const main = s.quests.find((q) => q.id === "main");
    if (!main || main.done) return;
    const target = targetFor(currentStepId(s), s);
    if (!target) return;
    let pos: THREE.Vector3 | null = null;
    let exit = false;
    if (target.map === this.mapDef.id) {
      if ("kind" in target) {
        const e = this.entities.find((x) => x.kind === target.kind);
        if (e) pos = new THREE.Vector3(e.x + 0.5, 0, Z(e.y));
      } else {
        pos = this.nearestTile(target.tile);
      }
    } else {
      const route = routeBetween(this.mapDef.id, target.map);
      const next = route[1];
      const gate = this.built?.gates.find((g) => g.to === next);
      if (gate) {
        pos = new THREE.Vector3(gate.x, 0, gate.z);
        exit = true;
      }
    }
    if (!pos) return;
    const g = new THREE.Group();
    const color = exit ? "#9fe3ff" : "#f2dfa6";
    const column = new THREE.Mesh(G.cyl(0.14, 0.22, 3.2, 10), glow(color, 0.16));
    column.position.y = 1.6;
    const ring = new THREE.Mesh(G.cyl(0.6, 0.6, 0.03, 20), glow(color, 0.35));
    ring.position.y = 0.03;
    const gem = new THREE.Mesh(G.ico(0.17, 0), glow(color, 0.95));
    gem.position.y = exit ? 3.0 : 2.4;
    gem.name = "gem";
    g.add(column, ring, gem);
    g.position.copy(pos);
    this.scene.add(g);
    this.beacon = g;
  }

  /** Nearest cell of a tile char that is still "to do" (unlit statue, unheld plate, uncollected item). */
  private nearestTile(ch: string) {
    const def = this.mapDef;
    const flags = useGameStore.getState().flags;
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (let y = 0; y < mapHeight(def); y++) {
      for (let x = 0; x < mapWidth(def); x++) {
        if (tileAt(def, x, y) !== ch) continue;
        const key = `${def.id}_${x}_${y}`;
        if (ch === "u" && flags.statues[key]) continue;
        if (ch === "z" && flags.plates[key]) continue;
        if (isHidden(def, ch, x, y, flags)) continue;
        if (ch === "=" && !cellBlocked(def, x, y, flags)) continue;
        if (ch === "d" && !def.portals.some((p) => p.x === x && p.y === y)) continue;
        const d = Math.hypot(x + 0.5 - this.playerPos.x, Z(y) - this.playerPos.z);
        if (d < bestD) {
          bestD = d;
          best = new THREE.Vector3(x + 0.5, 0, Z(y));
        }
      }
    }
    return best;
  }

  private gateOpensCinematic(gate: { to: MapId; x: number; z: number }) {
    if (this.cam.cinematicActive || this.mode !== "explore") return;
    const from = this.cam.camera.position.clone();
    const look = new THREE.Vector3(gate.x, 1.4, gate.z);
    const toPlayer = this.playerPos.clone().sub(look).setY(0);
    const dist = toPlayer.length();
    toPlayer.normalize();
    const pos = look.clone().addScaledVector(toPlayer, Math.min(5, Math.max(3, dist * 0.6)));
    pos.y = 2.6;
    this.inputLocked = true;
    gong();
    bus.emit("toast", { text: `The way to ${MAP_PLACE[gate.to]} is open.`, tone: "good" });
    this.flourish(Math.floor(gate.x), Math.floor(-gate.z));
    this.cam.playCinematic({
      frames: [
        { pos, look, dur: 1.0, hold: 1.4 },
        { pos: from, look: this.playerPos.clone().setY(1), dur: 0.9 },
      ],
      onDone: () => { this.inputLocked = false; },
    });
  }

  /** "Show direction": swing the camera toward the objective and let Mimo point the way. */
  private showDirection() {
    if (!this.beacon || this.mode !== "explore") {
      bus.emit("toast", { text: "Open the Journey (Q) to see the next step.", tone: "info" });
      return;
    }
    const b = this.beacon.position;
    const dx = b.x - this.playerPos.x;
    const dz = b.z - this.playerPos.z;
    if (Math.hypot(dx, dz) > 0.5) {
      // camera sits behind the player, looking toward the beacon
      this.cam.yaw = Math.atan2(-dx, -dz) + Math.PI;
      this.heading = Math.atan2(dx, dz);
      this.player.setHeading(this.heading);
    }
    if (this.companion && this.companionId === "mimo") {
      this.companion.faceToward(b.x, b.z);
      this.companion.play("sniff", 1.2);
      this.delay(1200, () => this.companion?.play("bark", 0.7));
    }
    const s = useGameStore.getState();
    const main = s.quests.find((q) => q.id === "main")!;
    const stepId = main.steps[Math.min(main.step, main.steps.length - 1)].id;
    const g = guideFor(stepId);
    bus.emit("toast", { text: g ? `${g.objective}. ${g.hints[0]}` : "This way.", tone: "info" });
  }

  /** Mimo nudges: while you stand still he looks toward the objective now and then. */
  private mimoNudgeT = 0;
  private idleT = 0;
  private mimoGuidance(dt: number, moving: boolean) {
    if (!this.companion || this.companionId !== "mimo" || this.mode !== "explore") return;
    this.idleT = moving ? 0 : this.idleT + dt;
    this.mimoNudgeT += dt;
    if (this.idleT > 6 && this.mimoNudgeT > 35 && this.beacon && !this.companion.currentAction) {
      this.mimoNudgeT = 0;
      const b = this.beacon.position;
      this.companion.faceToward(b.x, b.z);
      this.companion.play("sniff", 1.4);
      this.tip("mimo-nudge", {
        keyboard: "Mimo keeps looking the same way. He knows where to go; follow him or press R for help.",
        gamepad: "Mimo keeps looking the same way. He knows where to go; follow him or press Select for help.",
        touch: "Mimo keeps looking the same way. He knows where to go.",
      });
    }
    // a soft hint after a long idle, once per objective
    if (this.idleT > 25) {
      this.idleT = 0;
      bus.emit("stuck", true);
    }
  }

  // ================================================================ recovery

  /** Nearest open cell by breadth-first search; never resets any progress. */
  private resetPosition() {
    const def = this.mapDef;
    const start = { x: Math.floor(this.playerPos.x), y: ROW(this.playerPos.z) };
    const seen = new Set<string>();
    const queue = [start];
    let found: { x: number; y: number } | null = null;
    while (queue.length && !found) {
      const c = queue.shift()!;
      const k = `${c.x},${c.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (c.x >= 0 && c.y >= 0 && c.x < mapWidth(def) && c.y < mapHeight(def)) {
        const open = !this.blockedCell(c.x, c.y) && !def.portals.some((p) => p.x === c.x && p.y === c.y) && this.circleFree(c.x + 0.5, Z(c.y));
        if (open && !(c.x === start.x && c.y === start.y)) { found = c; break; }
      }
      if (seen.size > 400) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: c.x + dx, y: c.y + dy });
    }
    if (!found) {
      const s = useGameStore.getState();
      found = { x: s.playerX, y: s.playerY };
    }
    this.playerPos.set(found.x + 0.5, 0, Z(found.y));
    this.lastCell = { ...found };
    this.vel.set(0, 0, 0);
    this.stuckT = 0;
    this.stuckShown = false;
    bus.emit("stuck", false);
    bus.emit("fade", { flash: true, ms: 260, color: "rgba(242,223,166,0.5)" });
    bus.emit("toast", { text: "Back on solid ground.", tone: "info" });
    if (this.companion) this.companion.group.position.copy(this.playerPos).add(new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading)));
    this.trail = [this.playerPos.clone()];
    this.cam.snapBehind(this.playerPos, this.heading);
  }

  // ================================================================ teaching

  /** One-time, device-specific hints. Seen state lives in the save. */
  private tip(key: string, text: { keyboard: string; gamepad: string; touch: string }) {
    const s = useGameStore.getState();
    if (s.hasRecord("tutorialSeen", key)) return;
    s.markRecord("tutorialSeen", key);
    bus.emit("toast", { text: text[input.device] ?? text.keyboard, tone: "info" });
  }

  refresh() {
    this.loadMap(this.mapDef.id);
  }

  private findMarker(def: MapDef, marker: string) {
    for (let y = 0; y < def.rows.length; y++) {
      const x = def.rows[y].indexOf(marker);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  /** A few NPCs move with the story (Abhimanyu waits by the door after the evening). */
  private entityOverride(def: MapDef, kind: string, pos: { x: number; y: number }, flags: Flags) {
    if (def.id !== "f1205") return pos;
    if (kind === "npc_abhimanyu_home" && flags.eveningDone) return { x: 2, y: 7 };
    // once everyone has said hello the flat rearranges itself: Abhimanyu drifts to the
    // living room with the bass, Garv wanders over to heckle Faizal in the kitchen
    const allMet = flags.metAbhiHome && flags.metFaizal && flags.metGarv && flags.metHakim && flags.metDev;
    if (allMet && !flags.eveningDone) {
      if (kind === "npc_abhimanyu_home") return { x: 6, y: 4 };
      if (kind === "npc_garv") return { x: 11, y: 3 };
    }
    return pos;
  }

  /** Little things the flatmates say to each other (or to you) when you wander near. */
  private ambientAt = new Map<string, number>();
  private ambientLines: Record<string, string[]> = {
    npc_garv: ["Garv: \"Faizal, rice kab banega?\"", "Garv: \"Red hi hai. Red hi chalega.\""],
    npc_faizal: ["Faizal: \"Jab tu bartan dhoega, tab banega.\"", "Faizal: \"Kisi ne namak dekha? Nahi? Theek hai.\""],
    npc_hakim: ["Hakim: \"...bas do minute.\"", "Hakim: \"Compile ho raha hai. Mat bolo kuch.\""],
    npc_dev: ["Dev: \"One more set.\"", "Dev: \"Protein khatam. Yeh emergency hai.\""],
    npc_abhimanyu_home: ["Abhimanyu strums the same four chords, slower this time.", "Abhimanyu: \"Yeh wala sun. Nahi, yeh wala.\""],
  };

  private ambientChatter() {
    const f = useGameStore.getState().flags;
    if (this.mapDef.id !== "f1205" || !f.metDev || f.eveningDone) return;
    const now = performance.now();
    for (const e of this.entities) {
      const lines = this.ambientLines[e.kind];
      if (!lines) continue;
      const d = e.object.position.distanceTo(this.playerPos);
      if (d > 2.6) continue;
      const last = this.ambientAt.get(e.kind) ?? -1e9;
      if (now - last < 28000) continue;
      this.ambientAt.set(e.kind, now);
      bus.emit("toast", { text: lines[Math.floor(Math.random() * lines.length)], tone: "info" });
      e.rig?.play("wave", 0.8);
    }
  }

  /** F-1205 is explored through Palakshi's own eyes. */
  private get firstPerson() {
    return this.mapDef?.id === "f1205" && this.mode === "explore" && !this.cam.cinematicActive;
  }

  private npcHeading(def: MapDef, kind: string, pos: { x: number; y: number }) {
    // face the nearest open floor, preferring south (toward the usual approach)
    const flags = useGameStore.getState().flags;
    const order: [Dir, number, number][] = [["down", 0, 1], ["left", -1, 0], ["right", 1, 0], ["up", 0, -1]];
    for (const [d, dx, dy] of order) {
      if (!cellBlocked(def, pos.x + dx, pos.y + dy, flags) && !(pos.x + dx in {})) return DIR_HEADING[d];
    }
    void kind;
    return 0;
  }

  private tryOverride(rig: BaseRig, id: string) {
    if (!(rig instanceof CharacterRig)) return;
    const url = `${import.meta.env.BASE_URL}models/${id}.glb`;
    if (!overrideChecked.has(id)) {
      overrideChecked.set(id, fetch(url, { method: "HEAD" }).then((r) => r.ok && (r.headers.get("content-type") ?? "").includes("model")).catch(() => false));
    }
    overrideChecked.get(id)!.then((ok) => {
      if (ok && this.running) rig.loadOverride(url);
    });
  }

  private buildHighlights() {
    if (!this.built) return;
    const g = new THREE.Group();
    for (const h of this.built.highlights) {
      const disc = new THREE.Mesh(G.cyl(0.55, 0.55, 0.02, 16), glow("#f2dfa6", 0.35));
      disc.position.set(h.x + 0.5, 0.02, Z(h.y));
      g.add(disc);
      this.highlightDiscs.push(disc);
    }
    this.scene.add(g);
    this.highlightGroup = g;
  }

  // ============================================================== collision

  private blockedCell(cx: number, cy: number) {
    const def = this.mapDef;
    if (cellBlocked(def, cx, cy, useGameStore.getState().flags)) return true;
    return this.entities.some((e) => e.x === cx && e.y === cy);
  }

  private circleFree(x: number, z: number) {
    const minX = Math.floor(x - RADIUS);
    const maxX = Math.floor(x + RADIUS);
    const minRow = ROW(z + RADIUS);
    const maxRow = ROW(z - RADIUS);
    for (let cy = minRow; cy <= maxRow; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (!this.blockedCell(cx, cy)) continue;
        // circle vs cell AABB (row cy spans z ∈ [-(cy+1), -cy])
        const nx = Math.max(cx, Math.min(x, cx + 1));
        const nz = Math.max(-(cy + 1), Math.min(z, -cy));
        if ((nx - x) ** 2 + (nz - z) ** 2 < RADIUS * RADIUS) return false;
      }
    }
    return true;
  }

  /** How tall the thing standing at a world x/z is — 0 when the camera may be there. */
  private cameraObstacle(x: number, z: number) {
    const def = this.mapDef;
    const cx = Math.floor(x);
    const cz = ROW(z);
    if (cx < 0 || cz < 0 || cx >= mapWidth(def) || cz >= mapHeight(def)) {
      return this.built?.theme.indoor ? 1.9 : 2.9;
    }
    const ch = tileAt(def, cx, cz);
    if (!cellBlocked(def, cx, cz, useGameStore.getState().flags)) return 0;
    return tileHeight(ch);
  }

  // ================================================================= loop

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  };

  private update(dt: number) {
    const store = useGameStore.getState();
    input.poll(dt);
    const st = input.state;
    const overlay = !!store.overlay;
    const locked = this.inputLocked || overlay || store.screen !== "playing" || this.mode !== "explore" || this.cam.cinematicActive;

    // --- camera look always allowed unless a menu is up
    if (!overlay && !this.cam.cinematicActive) {
      if (st.lookActive) this.cam.rotate(st.look.x, st.look.y);
      if (st.zoom) this.cam.zoom(st.zoom);
    }

    // --- movement: input → target velocity, eased so starts and stops feel weighty but never laggy
    let speed01 = 0;
    let moving = false;
    const want = new THREE.Vector3();
    if (!locked) {
      const fwd = this.cam.groundForward(new THREE.Vector3());
      const right = this.cam.groundRight(new THREE.Vector3());
      const dir = new THREE.Vector3().addScaledVector(right, st.move.x).addScaledVector(fwd, st.move.y);
      const len = dir.length();
      if (st.pressed.has("dodge") && this.dashT <= 0 && len > 0.1) {
        this.dashT = 0.32;
        this.dashDir.copy(dir).normalize();
        this.player.play("jump", 0.4);
        sfx("step");
      }
      if (this.dashT > 0) {
        this.dashT -= dt;
        want.copy(this.dashDir).multiplyScalar(DASH);
      } else if (len > 0.06) {
        const k = Math.min(1, len);
        want.copy(dir).normalize().multiplyScalar(WALK * k * (st.held.has("dodge") ? 1.45 : 1));
      }
    }
    const accel = want.lengthSq() > this.vel.lengthSq() ? 16 : 24;
    this.vel.lerp(want, Math.min(1, dt * accel));
    if (this.vel.length() < 0.04) this.vel.set(0, 0, 0);
    const spd = this.vel.length();
    if (spd > 0) {
      const dir = this.vel.clone().normalize();
      this.moveBy(dir, spd * dt);
      moving = true;
      speed01 = Math.min(1.2, spd / WALK);
      if (spd > 0.5 && this.dashT <= 0) {
        this.heading = Math.atan2(dir.x, dir.z);
        this.player.setHeading(this.heading);
      }
    }
    if (!locked) {
      // stuck watch: pushing hard but going nowhere
      if (want.length() > 1.5) {
        this.stuckT += dt;
        if (this.stuckT > 0.5) {
          if (this.lastStuckPos.distanceTo(this.playerPos) > 0.12) { this.stuckT = 0; this.lastStuckPos.copy(this.playerPos); }
          else if (this.stuckT > 5 && !this.stuckShown) { this.stuckShown = true; bus.emit("stuck", true); }
        }
      } else {
        this.stuckT = 0;
        this.lastStuckPos.copy(this.playerPos);
      }
      if (st.pressed.has("unstuck") && this.stuckShown) this.resetPosition();
      if (!Number.isFinite(this.playerPos.x) || !Number.isFinite(this.playerPos.z) ||
          this.playerPos.x < -1 || this.playerPos.z > 1 || this.playerPos.x > mapWidth(this.mapDef) + 1 || this.playerPos.z < -mapHeight(this.mapDef) - 1) {
        this.resetPosition();
      }

      if (st.pressed.has("interact")) this.tryInteract();
      if (st.pressed.has("sniff")) this.mimoSniff();
      if (st.pressed.has("save")) {
        store.save();
        bus.emit("toast", { text: "Game saved.", tone: "info" });
      }
      if (st.pressed.has("menu")) { questSfx.panelOpen(); store.setOverlay({ kind: "menu" }); }
      else if (st.pressed.has("items")) { questSfx.panelOpen(); store.setOverlay({ kind: "inventory" }); }
      else if (st.pressed.has("quests") || st.pressed.has("map")) { questSfx.panelOpen(); store.setOverlay({ kind: "quests" }); }
      else if (st.pressed.has("hint")) bus.emit("hint:next");
    }
    this.player.setMoving(speed01);
    this.player.group.position.copy(this.playerPos);
    this.player.update(dt);

    // footsteps
    this.stepAccum += speed01 * dt;
    if (this.stepAccum > 0.33) {
      this.stepAccum = 0;
      sfx("step");
    }

    // --- cell change → portals, clues, encounters
    // (a cell reached while input was locked, e.g. during a cinematic, is
    // re-evaluated the moment control returns, so a portal is never skipped)
    if (this.wasLocked && !locked) this.lastCell = { x: -1, y: -1 };
    this.wasLocked = locked;
    const cx = Math.floor(this.playerPos.x);
    const cy = ROW(this.playerPos.z);
    if (cx !== this.lastCell.x || cy !== this.lastCell.y) {
      const prev = this.lastCell;
      this.lastCell = { x: cx, y: cy };
      if (!locked) this.afterStep(cx, cy, prev);
    }

    // --- companion + entities
    this.updateCompanion(dt, moving);
    this.mimoGuidance(dt, moving || !!store.overlay);
    if (this.pawTrail && this.companion && this.companionId === "mimo") {
      const c = this.companion;
      this.pawTrail.track(c.group.position, c.heading, c.group.position.distanceTo(this.pawLast) > 0.01, dt);
      this.pawLast.copy(c.group.position);
    }
    if (this.beaconDirty && this.mode === "explore") this.updateBeacon();
    if (this.beacon) {
      const gem = this.beacon.getObjectByName("gem");
      if (gem) {
        gem.rotation.y += dt * 1.4;
        gem.position.y += Math.sin(this.timer.getElapsed() * 2.2) * 0.004;
      }
      this.beacon.visible = this.mode === "explore";
    }
    for (const e of this.entities) {
      if (e.rig) {
        const d = e.rig.group.position.distanceTo(this.playerPos);
        if (d < 2.4 && this.mode === "explore" && !this.cam.cinematicActive) e.rig.faceToward(this.playerPos.x, this.playerPos.z);
        e.rig.update(dt);
      }
      e.update?.(dt);
    }
    if (this.battle) this.battle.enemy.update(dt);

    // --- ambience
    if (this.sky) this.sky.position.set(this.cam.camera.position.x, -8, this.cam.camera.position.z);
    if (this.water) ((this.water.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = this.timer.getElapsed();
    this.particles?.update(dt);
    this.bursts = this.bursts.filter((b) => b.update(dt));
    const now = this.timer.getElapsed();
    const pulse = 0.25 + Math.abs(Math.sin(now * 2.2)) * 0.3;
    for (const d of this.highlightDiscs) {
      (d.material as THREE.MeshBasicMaterial).opacity = pulse;
      d.scale.setScalar(0.9 + pulse * 0.4);
    }
    if (this.pingMarker) {
      if (performance.now() > this.pingUntil) {
        disposeObject(this.pingMarker);
        this.pingMarker = null;
      } else {
        this.pingMarker.rotation.y += dt * 1.5;
        this.pingMarker.position.y = 0.2 + Math.sin(now * 4) * 0.1;
      }
    }
    this.updatePointLights();

    // --- camera
    const camTarget = this.mode === "battle" && this.battle ? this.battle.center : this.playerPos;
    // re-align behind the player only while they walk away from the camera;
    // strafing or backing up must never swing the view around under them
    const walkingForward = moving && st.move.y > 0.35 && Math.abs(st.move.x) < 0.6;
    const fpp = this.firstPerson;
    if (fpp) {
      // the body faces where the player looks; the eye is the camera
      this.heading = this.cam.yaw + Math.PI;
      this.player.setHeading(this.heading, true);
    }
    this.player.group.visible = !fpp || this.mode !== "explore";
    this.cam.update(dt, camTarget, this.heading, walkingForward, st.lookActive);

    // --- contextual prompt
    const hit = locked ? null : this.facedInteract();
    const label = hit ? promptLabel(hit.kind, hit.name) : "";
    if (label !== this.lastPrompt) {
      this.lastPrompt = label;
      bus.emit("prompt", label);
      if (label && this.promptSeenAt === 0) {
        this.promptSeenAt = 1;
        this.tip("interact", {
          keyboard: "Press E to talk or use what's in front of you.",
          gamepad: "Press A to talk or use what's in front of you.",
          touch: "Tap the big red button to talk or use what's in front of you.",
        });
      }
    }
    if (!locked && store.flags.introDone) {
      this.tip("move", {
        keyboard: "Move with WASD. Hold a mouse button and drag to look around. The gold beacon marks your objective.",
        gamepad: "Left stick moves, right stick looks around. The gold beacon marks your objective.",
        touch: "Drag on the left half to walk, on the right half to look around. The gold beacon marks your objective.",
      });
    }
    if (this.warnCooldown > 0) this.warnCooldown -= dt;
    if (!locked) this.ambientChatter();
  }
  private stepAccum = 0;
  private wasLocked = false;
  private pawLast = new THREE.Vector3();

  private moveBy(dir: THREE.Vector3, dist: number) {
    const nx = this.playerPos.x + dir.x * dist;
    const nz = this.playerPos.z + dir.z * dist;
    // resolve axes separately so the player slides along walls
    if (this.circleFree(nx, this.playerPos.z)) this.playerPos.x = nx;
    if (this.circleFree(this.playerPos.x, nz)) this.playerPos.z = nz;
    // breadcrumbs for the companion
    const last = this.trail[this.trail.length - 1];
    if (!last || last.distanceTo(this.playerPos) > 0.18) {
      this.trail.push(this.playerPos.clone());
      if (this.trail.length > 60) this.trail.shift();
    }
  }

  private afterStep(cx: number, cy: number, prev: { x: number; y: number }) {
    const store = useGameStore.getState();
    const def = this.mapDef;
    store.setPlayer(cx, cy, headingToDir(this.heading));

    const portal = def.portals.find((p) => p.x === cx && p.y === cy);
    if (portal) {
      if (portal.requiresFlag && !(store.flags as any)[portal.requiresFlag]) {
        questSfx.denied();
        bus.emit("toast", { text: portal.lockedText ?? "That way is closed for now.", tone: "warn" });
        this.playerPos.set(prev.x + 0.5, 0, Z(prev.y));
        this.lastCell = { ...prev };
        store.setPlayer(prev.x, prev.y, headingToDir(this.heading));
        return;
      }
      this.transition(portal.to, portal.tx, portal.ty, portal.dir ?? headingToDir(this.heading));
      return;
    }

    const ch = tileAt(def, cx, cy);
    if (ch === "p" && !store.flags.cluePawsSeen && store.quests[0].step >= 4) {
      store.openDialogue("clue_paws");
      return;
    }
    if (ch === "g" && def.encounterEnemies?.length) {
      if (this.companionId === "mimo" && this.warnCooldown <= 0 && Math.random() < 0.3) this.mimoWarn("Mimo growls at the grass. Something's in there.");
      if (Math.random() < (def.encounterRate ?? 0.1)) {
        const id = def.encounterEnemies[Math.floor(Math.random() * def.encounterEnemies.length)];
        this.startBattle(id, false);
        return;
      }
    }
    // Mimo warns about a boss ahead
    if (this.companionId === "mimo" && this.warnCooldown <= 0) {
      const boss = this.entities.find((e) => ["npc_miniboss1", "npc_miniboss2", "npc_miniboss3", "npc_guardian", "npc_boss", "npc_prakriti_duel"].includes(e.kind));
      if (boss && Math.hypot(boss.x - cx, boss.y - cy) < 4.5) this.mimoWarn(`Mimo stops and growls. ${boss.name ?? "Something"} is close.`);
    }
  }

  private transition(to: MapId, tx: number, ty: number, dir: Dir) {
    this.inputLocked = true;
    bus.emit("fade", { to: 1, ms: 200 });
    this.delay(220, () => {
      const store = useGameStore.getState();
      if (to === "house" && store.quests[0].step === 0) {
        store.advanceQuest("main", "mom");
        questSfx.objective();
        bus.emit("objective:done");
      }
      store.setMap(to, tx, ty, dir);
      this.loadMap(to);
      bus.emit("fade", { to: 0, ms: 320 });
      // an arrival cinematic keeps control until it has finished
      if (!this.cam.cinematicActive) this.inputLocked = false;
      bus.emit("cinematic", { kind: "location", mapId: to });
    });
  }

  // ============================================================= companion

  private updateCompanion(dt: number, playerMoving: boolean) {
    const c = this.companion;
    if (!c) return;
    if (this.companionId === "mimo") {
      this.tip("sniff", {
        keyboard: "Mimo is with you. Press F and he'll sniff out hidden things nearby.",
        gamepad: "Mimo is with you. Press RB and he'll sniff out hidden things nearby.",
        touch: "Mimo is with you. Tap the paw button and he'll sniff out hidden things nearby.",
      });
    }
    if (this.mode === "battle") {
      c.setMoving(0);
      c.update(dt);
      return;
    }
    if (c.currentAction === "sniff" || c.currentAction === "dig" || c.currentAction === "hug") {
      c.setMoving(0);
      c.update(dt);
      return;
    }
    // find the breadcrumb ~1.1 units behind the player along the trail
    const followDist = this.companionId === "mimo" ? 1.05 : 1.2;
    let acc = 0;
    let target = this.trail[0] ?? this.playerPos;
    for (let i = this.trail.length - 1; i > 0; i--) {
      acc += this.trail[i].distanceTo(this.trail[i - 1]);
      if (acc >= followDist) {
        target = this.trail[i - 1];
        this.trail.splice(0, Math.max(0, i - 2));
        break;
      }
    }
    const pos = c.group.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const d = Math.hypot(dx, dz);
    const distToPlayer = pos.distanceTo(this.playerPos);
    if (d > 0.12 && distToPlayer > 0.7) {
      const speed = Math.min(WALK * 1.25, d * 6 + 0.8);
      const step = Math.min(d, speed * dt);
      pos.x += (dx / d) * step;
      pos.z += (dz / d) * step;
      c.setHeading(Math.atan2(dx, dz));
      c.setMoving(Math.min(1, speed / WALK));
      this.mimoIdle = 0;
    } else {
      c.setMoving(0);
      if (!playerMoving) {
        this.mimoIdle += dt;
        // Mimo looks at you when you stop
        if (distToPlayer < 2) c.faceToward(this.playerPos.x, this.playerPos.z);
      }
    }
    // teleport if hopelessly far (fell behind through a door)
    if (distToPlayer > 6) pos.copy(this.playerPos).add(new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading)));
    c.update(dt);
  }

  private mimoWarn(text: string) {
    const c = this.companion;
    if (!c || this.companionId !== "mimo") return;
    this.warnCooldown = 18;
    c.play("bark", 0.9);
    sfx("error");
    bus.emit("toast", { text, tone: "warn" });
  }

  /** Mimo's nose: points at the nearest hidden thing on this map. */
  private mimoSniff() {
    const store = useGameStore.getState();
    if (this.mode !== "explore" || this.inputLocked) return;
    if (this.companionId !== "mimo" || !this.companion) {
      bus.emit("toast", { text: "You'd need a nose for that. Find Mimo first.", tone: "info" });
      return;
    }
    const c = this.companion;
    if (c.currentAction) return;
    c.play("sniff", 1.3);
    sfx("menu");
    const def = this.mapDef;
    const flags = store.flags;
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y < mapHeight(def); y++) {
      for (let x = 0; x < mapWidth(def); x++) {
        const ch = tileAt(def, x, y);
        if (!"h~*$y".includes(ch)) continue;
        if (isHidden(def, ch, x, y, flags)) continue;
        const d = Math.hypot(x + 0.5 - this.playerPos.x, Z(y) - this.playerPos.z);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    this.delay(1300, () => {
      if (!best) {
        bus.emit("toast", { text: "Mimo sniffs around. Nothing buried here.", tone: "info" });
        return;
      }
      const dx = best.x + 0.5 - this.playerPos.x;
      const dz = Z(best.y) - this.playerPos.z;
      const dirWord = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "east" : "west") : dz > 0 ? "north" : "south";
      const near = best.d < 2.2;
      c.play("bark", 0.8);
      questSfx.objective();
      bus.emit("toast", { text: near ? "Mimo barks — it's right here!" : `Mimo catches a scent to the ${dirWord}.`, tone: "good" });
      this.showPing(best.x, best.y);
    });
  }

  private showPing(x: number, y: number) {
    if (this.pingMarker) disposeObject(this.pingMarker);
    const g = new THREE.Group();
    const ring = new THREE.Mesh(G.cyl(0.5, 0.5, 0.04, 16), glow("#7ddca4", 0.6));
    const beam = new THREE.Mesh(G.cyl(0.06, 0.12, 3, 8), glow("#7ddca4", 0.35));
    beam.position.y = 1.5;
    g.add(ring, beam);
    g.position.set(x + 0.5, 0.2, Z(y));
    this.scene.add(g);
    this.pingMarker = g;
    this.pingUntil = performance.now() + 8000;
    this.bursts.push(new Burst(x + 0.5, 0.6, Z(y), "#7ddca4", 24, 0.9, 1.6));
    this.scene.add(this.bursts[this.bursts.length - 1].points);
  }

  // =========================================================== interaction

  private facedInteract(): { kind: string; name?: string; x: number; y: number; entity?: Entity } | null {
    const def = this.mapDef;
    const flags = useGameStore.getState().flags;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const here = { x: Math.floor(this.playerPos.x), y: ROW(this.playerPos.z) };

    const cellAt = (dist: number) => ({ x: Math.floor(this.playerPos.x + fx * dist), y: ROW(this.playerPos.z + fz * dist) });
    let front = cellAt(0.8);
    if (front.x === here.x && front.y === here.y) front = cellAt(1.25);

    const ent = this.entities.find((e) => e.x === front.x && e.y === front.y);
    if (ent) return { kind: ent.kind, name: ent.name, x: ent.x, y: ent.y, entity: ent };

    // a nearby NPC in a forgiving cone, so talking never needs pixel-perfect facing
    let bestE: Entity | null = null;
    let bestD = 1.7;
    for (const e of this.entities) {
      const dx = e.x + 0.5 - this.playerPos.x;
      const dz = Z(e.y) - this.playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * fx + dz * fz) / Math.max(1e-4, d);
      if (dot < 0.45) continue;
      bestD = d;
      bestE = e;
    }
    if (bestE) return { kind: bestE.kind, name: bestE.name, x: bestE.x, y: bestE.y, entity: bestE };

    const ch = tileAt(def, front.x, front.y);
    if (!isHidden(def, ch, front.x, front.y, flags) && INTERACT_TILE[ch] && !(ch in def.interacts)) {
      return { kind: INTERACT_TILE[ch], x: front.x, y: front.y };
    }
    const hereCh = tileAt(def, here.x, here.y);
    if (INTERACT_TILE[hereCh] && UNDERFOOT.includes(hereCh) && !isHidden(def, hereCh, here.x, here.y, flags)) {
      return { kind: INTERACT_TILE[hereCh], x: here.x, y: here.y };
    }
    return null;
  }

  private tryInteract() {
    // always re-evaluate: the player may have turned since the last frame
    const hit = this.facedInteract();
    if (!hit) return;
    sfx("confirm");
    if (hit.entity?.rig) {
      hit.entity.rig.faceToward(this.playerPos.x, this.playerPos.z);
      this.player.faceToward(hit.entity.object.position.x, hit.entity.object.position.z);
      this.heading = this.player.heading;
      this.lastTalked = hit.entity;
    }
    this.story.handleInteract(hit.kind, hit.x, hit.y);
  }

  private flourish(x: number, y: number) {
    const b = new Burst(x + 0.5, 0.6, Z(y), "#f2dfa6", 40, 0.9, 2.4);
    this.bursts.push(b);
    this.scene.add(b.points);
    bus.emit("fade", { flash: true, ms: 260, color: "rgba(242,223,166,0.6)" });
  }

  // ================================================================ lights

  private lightTimer = 0;
  private updatePointLights() {
    if (!this.built) return;
    this.lightTimer -= 1 / 60;
    if (this.lightTimer > 0) return;
    this.lightTimer = 0.4;
    const pts = this.built.glowPoints
      .map((g) => ({ g, d: Math.hypot(g.x - this.playerPos.x, g.z - this.playerPos.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.points.length);
    this.points.forEach((p, i) => {
      const e = pts[i];
      if (!e) {
        p.intensity = 0;
        return;
      }
      p.position.set(e.g.x, e.g.y, e.g.z);
      p.color.set(e.g.color);
      p.intensity = e.g.intensity * (this.quality.mobile ? 0.8 : 1);
    });
  }

  // ================================================================ battle

  private startBattle(enemyId: string, boss: boolean) {
    if (this.battle) return;
    const enemy = ENEMIES[enemyId];
    if (!enemy) return;
    this.inputLocked = true;
    bus.emit("fade", { flash: true, ms: 260, color: "rgba(242,223,166,0.75)" });
    this.player.setMoving(0);

    // where the enemy stands: a free spot ahead of the player
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    let enemyPos: THREE.Vector3 | null = null;
    const candidates: THREE.Vector3[] = [];
    for (const dist of [2.6, 2.2, 3.0, 1.9])
      for (const side of [0, 0.6, -0.6, 1.2, -1.2])
        candidates.push(this.playerPos.clone().addScaledVector(fwd, dist).addScaledVector(right, side));
    for (const c of candidates) {
      const cx = Math.floor(c.x);
      const cy = ROW(c.z);
      if (!this.blockedCell(cx, cy) && !(cx === Math.floor(this.playerPos.x) && cy === ROW(this.playerPos.z))) {
        enemyPos = c;
        break;
      }
    }
    if (!enemyPos) {
      // turn around and try behind
      this.heading += Math.PI;
      fwd.multiplyScalar(-1);
      right.multiplyScalar(-1);
      enemyPos = this.playerPos.clone().addScaledVector(fwd, 2.4);
    }

    // the character we just challenged steps into the ring as the enemy rig
    if (boss && this.lastTalked && this.lastTalked.kind.startsWith("npc_")) {
      this.lastTalked.object.visible = false;
      this.hiddenForBattle = this.lastTalked;
      enemyPos.copy(this.lastTalked.object.position);
      const toPlayer = this.playerPos.clone().sub(enemyPos);
      toPlayer.y = 0;
      if (toPlayer.length() > 0.01) {
        toPlayer.normalize();
        fwd.copy(toPlayer).multiplyScalar(-1);
        right.set(fwd.z, 0, -fwd.x);
      }
    }
    const rig = makeEnemyRig(enemy.portrait, boss);
    rig.setShadows(this.quality.shadows);
    rig.group.position.copy(enemyPos);
    rig.faceToward(this.playerPos.x, this.playerPos.z, true);
    this.scene.add(rig.group);
    this.player.faceToward(enemyPos.x, enemyPos.z, true);
    this.heading = this.player.heading;

    const center = this.playerPos.clone().lerp(enemyPos, 0.5);
    this.battle = {
      enemyId, enemy: rig, center, right, forward: fwd, frontId: "palakshi",
      playerPos: this.playerPos.clone(), enemyPos: enemyPos.clone(),
    };
    this.mode = "battle";

    // bench the companion off to the side
    if (this.companion) {
      const bench = this.playerPos.clone().addScaledVector(fwd, -0.9).addScaledVector(right, 0.8);
      this.companion.group.position.copy(bench);
      this.companion.faceToward(enemyPos.x, enemyPos.z, true);
    }

    // camera: boss intro or quick glide to the battle view
    const view = this.battleView();
    const frames: Keyframe[] = [];
    if (boss) {
      const face = enemyPos.clone().addScaledVector(fwd, -1.6).addScaledVector(right, 0.5);
      face.y = rig.height * 0.7;
      frames.push({ pos: face, look: enemyPos.clone().setY(rig.height * 0.75), dur: 0.9, hold: 1.1 });
    }
    frames.push({ pos: view.pos, look: view.look, dur: boss ? 1.2 : 0.7 });
    this.cam.playCinematic({ frames, onDone: () => { if (this.battle) this.cam.hold = { pos: view.pos, look: view.look }; } });
    this.delay(boss ? 1700 : 320, () => {
      useGameStore.getState().setOverlay({ kind: "battle", enemyId, boss });
      this.tip("battle", {
        keyboard: "Battle: FIGHT picks a move, ITEM heals, SWAP changes who stands in front. Arrows choose, Enter confirms.",
        gamepad: "Battle: FIGHT picks a move, ITEM heals, SWAP changes who stands in front. D-pad chooses, A confirms, B backs out.",
        touch: "Battle: FIGHT picks a move, ITEM heals, SWAP changes who stands in front. Tap a button to choose.",
      });
    });
  }

  /** Side-on battle framing; picks the side with open space, rising over walls if neither has it. */
  private battleView() {
    const b = this.battle!;
    const span = b.playerPos.distanceTo(b.enemyPos);
    const look = b.center.clone().setY(0.9);
    const make = (side: number, dist: number, height: number) => {
      const pos = b.center.clone().addScaledVector(b.right, side * dist);
      pos.y = height;
      pos.addScaledVector(b.forward, -0.4);
      return pos;
    };
    // portrait phones need the camera further out to fit both fighters
    const aspect = this.cam.camera.aspect;
    const dist = (span * 1.15 + 2.6) * (aspect < 1 ? Math.min(2.1, 0.85 / aspect) : 1);
    for (const side of [1, -1]) {
      const pos = make(side, dist, 1.9);
      let clear = true;
      for (let k = 0.25; k <= 1; k += 0.25) {
        const p = look.clone().lerp(pos, k);
        if (this.cameraObstacle(p.x, p.z) > p.y) { clear = false; break; }
      }
      if (clear) return { pos, look };
    }
    // walls on both sides: look down from above the near side (further out on portrait phones)
    const portrait = aspect < 1 ? Math.min(1.8, 0.85 / aspect) : 1;
    const pos = make(1, Math.min(dist, 3.2 * portrait), 4.2 + (portrait - 1) * 2.0);
    return { pos, look };
  }

  private partyRig(id: string) {
    return this.rigs.get(id) ?? null;
  }

  private battleFx(p: { kind: string; side?: "player" | "enemy"; crit?: boolean; fighterId?: string; heal?: boolean }) {
    const b = this.battle;
    if (!b) return;
    const front = this.partyRig(b.frontId) ?? this.player;
    switch (p.kind) {
      case "attack": {
        const attacker = p.side === "player" ? front : b.enemy;
        const target = p.side === "player" ? b.enemy : front;
        attacker.play("attack", 0.55);
        this.delay(220, () => {
          target.flash(p.crit ? "#fff0a0" : "#ff6a5a", p.crit ? 220 : 140);
          target.play("hit", 0.4);
          this.cam.shake(p.crit ? 260 : 140, p.crit ? 0.09 : 0.045);
          const tp = target.group.position;
          const burst = new Burst(tp.x, target.height * 0.6, tp.z, p.crit ? "#fff0a0" : "#ff9a6a", p.crit ? 30 : 16, 0.5, 2.2);
          this.bursts.push(burst);
          this.scene.add(burst.points);
        });
        break;
      }
      case "heal": {
        const target = p.side === "player" ? front : b.enemy;
        const tp = target.group.position;
        const burst = new Burst(tp.x, 0.4, tp.z, "#7ddca4", 28, 0.9, 1.2);
        this.bursts.push(burst);
        this.scene.add(burst.points);
        target.play("cheer", 0.5);
        break;
      }
      case "swap": {
        if (!p.fighterId || p.fighterId === b.frontId) break;
        const outgoing = this.partyRig(b.frontId);
        const incoming = this.partyRig(p.fighterId);
        if (!incoming) break;
        b.frontId = p.fighterId;
        const bench = b.playerPos.clone().addScaledVector(b.forward, -0.9).addScaledVector(b.right, 0.8);
        outgoing?.group.position.copy(bench);
        outgoing?.faceToward(b.enemyPos.x, b.enemyPos.z, true);
        incoming.group.position.copy(b.playerPos);
        incoming.faceToward(b.enemyPos.x, b.enemyPos.z, true);
        incoming.play("jump", 0.5);
        if (incoming === this.player) this.playerPos.copy(b.playerPos);
        break;
      }
      case "enrage": {
        b.enemy.play("enrage", 0.9);
        b.enemy.flash("#ff3a3a", 300);
        this.cam.shake(400, 0.08);
        break;
      }
      case "ko": {
        const target = p.side === "player" ? front : b.enemy;
        target.setKO(true);
        break;
      }
      case "win": {
        b.enemy.setKO(true);
        front.play("cheer", 1.2);
        this.companion?.play("jump", 0.8);
        break;
      }
      case "lose": {
        front.setKO(true);
        break;
      }
    }
  }

  private endBattle(r: { enemyId: string; won: boolean; fled?: boolean }) {
    const b = this.battle;
    if (this.hiddenForBattle) {
      this.hiddenForBattle.object.visible = true;
      this.hiddenForBattle = null;
    }
    if (b) {
      b.enemy.dispose();
      for (const rig of this.rigs.values()) rig.setKO(false);
      // everyone back to their places
      this.playerPos.copy(b.playerPos);
      this.player.group.position.copy(this.playerPos);
      if (this.companion) {
        this.companion.group.position.copy(this.playerPos).addScaledVector(b.forward, -1.0);
        this.companion.setHeading(this.heading, true);
      }
      this.battle = null;
    }
    this.mode = "explore";
    this.cam.hold = null;
    this.cam.stopCinematic();
    this.cam.snapBehind(this.playerPos, this.heading);
    this.inputLocked = false;
    this.story.handleBattleEnd(r);
  }

  // ============================================================ cinematics

  private arrivalCinematic(title: string, subtitle: string, mapId: MapId) {
    this.inputLocked = true;
    bus.emit("cinematic", { kind: "region", title, subtitle });
    gong();
    const W = mapWidth(this.mapDef);
    const H = mapHeight(this.mapDef);
    const p = this.playerPos.clone();
    const high = new THREE.Vector3(W / 2 + 6, 11, -H / 2 + 10);
    const mid = p.clone().add(new THREE.Vector3(-Math.sin(this.heading) * 4 + 3, 4.5, -Math.cos(this.heading) * 4 + 3));
    this.cam.camera.position.copy(high);
    this.cam.playCinematic({
      frames: [
        { pos: high, look: new THREE.Vector3(W / 2, 0.5, -H / 2), dur: 0.01, hold: 0.9 },
        { pos: mid, look: p.clone().setY(1), dur: 2.0 },
      ],
      onDone: () => {
        this.cam.snapBehind(this.playerPos, this.heading);
        this.inputLocked = false;
        if (mapId === "village") useGameStore.getState().openDialogue("village_arrive");
      },
    });
  }

  private cinematic(kind: string, payload?: any) {
    switch (kind) {
      case "discovery": {
        const x = payload.x + 0.5;
        const z = Z(payload.y);
        const p = this.playerPos.clone();
        const from = this.cam.camera.position.clone();
        const close = new THREE.Vector3(x + (p.x - x) * 0.6 + 0.8, 1.6, z + (p.z - z) * 0.6 + 0.8);
        this.inputLocked = true;
        this.cam.playCinematic({
          frames: [
            { pos: close, look: new THREE.Vector3(x, 0.9, z), dur: 0.8, hold: 0.9 },
            { pos: from, look: p.clone().setY(1), dur: 0.8 },
          ],
          onDone: () => { this.inputLocked = false; },
        });
        break;
      }
      case "lantern-lit": {
        const e = this.findLantern();
        if (!e) break;
        const from = this.cam.camera.position.clone();
        this.inputLocked = true;
        this.cam.playCinematic({
          frames: [
            { pos: new THREE.Vector3(e.x + 2.5, 1.2, e.z + 2.5), look: new THREE.Vector3(e.x, 1.8, e.z), dur: 0.9, hold: 0.6 },
            { pos: new THREE.Vector3(e.x + 4, 6, e.z + 5), look: new THREE.Vector3(e.x, 1.5, e.z), dur: 2.2, hold: 0.4 },
            { pos: from, look: this.playerPos.clone().setY(1), dur: 0.9 },
          ],
          onDone: () => { this.inputLocked = false; },
        });
        break;
      }
      case "mimo-dig": {
        const c = this.companion;
        if (!c || this.companionId !== "mimo") break;
        c.group.position.set(payload.x + 0.5 - Math.sin(this.heading) * 0.3, 0, Z(payload.y) - Math.cos(this.heading) * 0.3);
        c.faceToward(payload.x + 0.5, Z(payload.y), true);
        c.play("dig", 1.3);
        const b = new Burst(payload.x + 0.5, 0.2, Z(payload.y), "#8b7152", 30, 1.0, 1.6);
        this.bursts.push(b);
        this.scene.add(b.points);
        break;
      }
      case "villain-leaves": {
        const e = this.entities.find((x) => x.kind === payload?.kind);
        if (!e || !e.rig) break;
        // a bow, then they turn and walk out of the scene; the rebuilt map never spawns them again
        const away = e.object.position.clone().sub(this.playerPos).setY(0);
        if (away.length() < 0.01) away.set(0, 0, 1);
        away.normalize();
        e.rig.play("wave", 0.9);
        const rig = e.rig;
        const obj = e.object;
        this.entities = this.entities.filter((x) => x !== e); // no longer blocks or talks
        this.delay(900, () => {
          rig.setHeading(Math.atan2(away.x, away.z));
          let t = 0;
          const walk = () => {
            if (!this.running) return;
            t += 1 / 60;
            obj.position.addScaledVector(away, 2.2 / 60);
            rig.setMoving(1);
            rig.update(1 / 60);
            const k = Math.max(0, 1 - t / 1.1);
            obj.scale.setScalar(k);
            if (t < 1.1) requestAnimationFrame(walk);
            else { rig.dispose(); disposeObject(obj); }
          };
          walk();
        });
        break;
      }
      case "evening-gather": this.eveningGather(); break;
      case "evening-end": {
        // the conversation is over: hand the camera back at once instead of
        // finishing the slow orbit (a quick reader would otherwise wait ~30 s)
        if (this.cam.cinematicActive) this.cam.stopCinematic();
        this.inputLocked = false;
        this.cam.snapBehind(this.playerPos, this.heading);
        break;
      }
      case "final-hug": this.finalHug(payload?.onDone); break;
      default:
        break;
    }
  }

  private findLantern() {
    const def = this.mapDef;
    for (let y = 0; y < mapHeight(def); y++)
      for (let x = 0; x < mapWidth(def); x++) if (tileAt(def, x, y) === "&") return { x: x + 0.5, z: Z(y) };
    return null;
  }

  /** Everyone drifts to the sofa for the last conversation; the camera circles slowly. */
  private eveningGather() {
    // [column, row, heading] — everyone gathers in the living room, facing the middle
    const seats: Record<string, [number, number, number]> = {
      npc_hakim: [4.5, 2.4, Math.PI],
      npc_garv: [7.2, 3.4, -Math.PI / 2],
      npc_faizal: [2.0, 3.6, Math.PI / 2],
      npc_dev: [6.6, 1.8, Math.PI],
      npc_abhimanyu_home: [3.4, 4.3, 0.3],
    };
    for (const e of this.entities) {
      const s = seats[e.kind];
      if (!s || !e.rig) continue;
      e.x = Math.floor(s[0]);
      e.y = Math.floor(s[1]);
      this.walkEntity(e, new THREE.Vector3(s[0], 0, -s[1]), s[2]);
    }
    this.playerPos.set(5.2, 0, -4.6);
    this.player.setHeading(0, true);
    this.heading = 0;
    this.player.group.visible = true;
    if (this.companion) {
      this.companion.group.position.set(6.2, 0, -4.4);
      this.companion.setHeading(0, true);
    }
    this.inputLocked = true;
    const look = new THREE.Vector3(4.6, 0.8, -3.1);
    const ring = (a: number, r: number, h: number) => new THREE.Vector3(4.6 + Math.sin(a) * r, h, -3.1 + Math.cos(a) * r);
    this.cam.playCinematic({
      frames: [
        { pos: ring(0.3, 4.2, 2.4), look, dur: 1.2 },
        { pos: ring(-0.5, 4.0, 2.2), look, dur: 14 },
        { pos: ring(0.6, 3.6, 2.0), look, dur: 14 },
        { pos: ring(-0.2, 4.4, 2.6), look, dur: 14 },
      ],
      onDone: () => { this.inputLocked = false; },
    });
    this.delay(60000, () => { if (this.cam.cinematicActive) this.cam.stopCinematic(); });
  }

  /** An NPC strolls to a spot over a couple of seconds (straight line; rooms are open enough). */
  private walkEntity(e: Entity, to: THREE.Vector3, finalHeading: number) {
    const rig = e.rig!;
    const from = e.object.position.clone();
    const dist = from.distanceTo(to);
    const dur = Math.max(0.4, dist / 1.6);
    let t = 0;
    rig.setHeading(Math.atan2(to.x - from.x, to.z - from.z));
    const step = () => {
      if (!this.running) return;
      t += 1 / 60;
      const k = Math.min(1, t / dur);
      e.object.position.lerpVectors(from, to, k);
      rig.setMoving(k < 1 ? 0.7 : 0);
      if (k < 1) requestAnimationFrame(step);
      else rig.setHeading(finalHeading);
    };
    step();
  }

  /** The end: Palakshi walks to Abhimanyu, they hold the hug, the camera pulls away, fade to black. */
  private finalHug(onDone?: () => void) {
    if (this.hugDone) return;
    this.hugDone = true;
    const abhi = this.entities.find((e) => e.kind === "npc_abhimanyu_home");
    if (!abhi || !abhi.rig) {
      onDone?.();
      return;
    }
    this.inputLocked = true;
    this.mode = "cinematic";
    this.player.group.visible = true;
    playBgm("bgm_hug", 2.5);
    const ap = abhi.object.position.clone();
    const dir = this.playerPos.clone().sub(ap);
    dir.y = 0;
    if (dir.length() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const stand = ap.clone().addScaledVector(dir, 0.62);
    const start = this.playerPos.clone();
    const walkT = 1.3;
    let t = 0;
    const walk = () => {
      t += 1 / 60;
      const k = Math.min(1, t / walkT);
      this.playerPos.lerpVectors(start, stand, k);
      this.player.setMoving(k < 1 ? 0.6 : 0);
      this.player.faceToward(ap.x, ap.z);
      abhi.rig!.faceToward(this.playerPos.x, this.playerPos.z);
      if (k < 1 && this.running) requestAnimationFrame(walk);
      else {
        this.player.setMoving(0);
        this.player.play("hug", 30);
        abhi.rig!.play("hug", 30);
        this.companion?.play("wave", 2);
        gong();
      }
    };
    walk();
    // Mimo sits a little away and watches
    if (this.companion) {
      this.companion.group.position.copy(stand).addScaledVector(dir, 1.1).add(new THREE.Vector3(0.6, 0, 0));
      this.companion.faceToward(stand.x, stand.z, true);
    }

    const mid = ap.clone().lerp(stand, 0.5);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const close = mid.clone().addScaledVector(side, 1.9).addScaledVector(dir, 0.6);
    close.y = 1.35;
    const back = mid.clone().addScaledVector(side, 5.5).addScaledVector(dir, 2.5);
    back.y = 3.6;
    const far = mid.clone().addScaledVector(side, 9).addScaledVector(dir, 7);
    far.y = 8.5;
    this.cam.playCinematic({
      frames: [
        { pos: close, look: mid.clone().setY(1.05), dur: 1.6, hold: 3.2 },
        { pos: back, look: mid.clone().setY(1.0), dur: 4.5 },
        { pos: far, look: mid.clone().setY(0.8), dur: 6.0 },
      ],
      onFrame: (i) => {
        if (i === 2) bus.emit("fade", { to: 1, ms: 5200 });
      },
      onDone: () => {
        this.delay(400, () => onDone?.());
      },
    });
  }
}

const overrideChecked = new Map<string, Promise<boolean>>();
void mat;
