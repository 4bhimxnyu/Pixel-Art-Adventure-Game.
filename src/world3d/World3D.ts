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
import { ease, type BaseRig } from "./BaseRig";
import { CameraRig, type Keyframe } from "./CameraRig";
import { AmbientParticles, Burst } from "./Particles";
import { PawTrail } from "./PawTrail";
import { FxPool, FocusRing, NameLabels, DashStreak, CrackDecal, type LabelTarget } from "./Fx";
import { floorFor, gateYaw, type GateInfo } from "./MapBuilder";
import { FogPlanes, LightShafts, Birds } from "./Atmosphere";

/** Settings the UI may add later; read defensively so an old save never breaks the world. */
type FeelSettings = { quality?: "auto" | "high" | "medium" | "low"; reducedMotion?: boolean };
const feelSettings = () => useGameStore.getState().settings as FeelSettings;

/** Dust colour kicked up per floor kind; floors that do not puff are missing. */
const DUST: Record<string, string> = {
  grass: "#9fcf7a", darkGrass: "#86b86c", dirt: "#c2a47c", gravel: "#c9bda8",
  stone: "#c4bfc8", plaza: "#c4bfc8", cave: "#8a7da8", temple: "#9a8078",
};
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
  /** Pooled feel effects (see Fx.ts); rebuilt with every map. */
  private fx: FxPool | null = null;
  /** Atmosphere extras; null when the region has none or reducedMotion is on. */
  private fog: FogPlanes | null = null;
  private shafts: LightShafts | null = null;
  private birds: Birds | null = null;
  private leaves: AmbientParticles | null = null;
  private reducedMotion = false;
  /** Base intensity of each point light, so the flicker has something to flicker around. */
  private lightBase: number[] = [0, 0, 0, 0];
  private lightSeed: number[] = [0, 0, 0, 0];
  private emberT = 0;
  private dash: DashStreak | null = null;
  private crack: CrackDecal | null = null;
  /** Gate bars coming apart: a copy of the bars prop whose pieces fall and fade while sparks fly. */
  private dissolves: { g: THREE.Group; t: number; seeds: number[] }[] = [];
  /** The beacon's own materials (not the shared cache) so it can dim and pulse by distance. */
  private beaconMats: THREE.MeshBasicMaterial[] = [];
  /** Seconds of frozen simulation left (hit-stop on impacts). */
  private hitStop = 0;
  /** Heal spirals in flight: particles are spawned along a rising helix over ~0.9 s. */
  private spirals: { x: number; z: number; t: number; color: string }[] = [];
  private dashLineT = 0;
  private prevHeading = 0;
  private leanV = 0;
  private stepSide = 1;
  private focus: FocusRing | null = null;
  private labels: NameLabels | null = null;
  private labelTargets: { t: LabelTarget; fade: number }[] = [];
  private labelSlots: LabelTarget[] = [];
  private lastNearKey = "";
  /** Photo mode: HUD hidden by the UI, free orbit camera, no interactions or encounters. */
  private photoMode = false;
  /** Hidden / uncollected things close enough to sparkle, rescanned a few times a second. */
  private sparkleCells: { x: number; z: number }[] = [];
  private sparkleT = 0;
  private sparkleScanT = 0;
  private lockedBefore = new Map<MapId, string>();
  private promptSeenAt = 0;
  private qual: { shadows: boolean; mobile: boolean; particles: number };
  private timers: number[] = [];
  private hugDone = false;

  constructor(parent: HTMLElement) {
    if (World3D.instance) World3D.instance.destroy();
    World3D.instance = this;
    this.parent = parent;

    const mobile = isTouchDevice() || Math.min(window.innerWidth, window.innerHeight) < 600;
    this.qual = { shadows: !mobile, mobile, particles: mobile ? 0.5 : 1 };

    this.renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = this.qual.shadows;
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

    this.sun.castShadow = this.qual.shadows;
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
    this.busUnsubs.push(bus.on("photo:mode", (on: boolean) => this.setPhotoMode(!!on)));
    this.busUnsubs.push(bus.on("camera:recenter", () => this.recenter()));
    this.busUnsubs.push(bus.on("world:snapshot", () => this.snapshot()));
    this.reducedMotion = !!feelSettings().reducedMotion;
    this.unsubStore = useGameStore.subscribe((s, prev) => {
      input.overlayOpen = !!s.overlay;
      if (s.settings !== prev.settings) {
        input.lookSens = s.settings.lookSens ?? 1;
        input.invertY = !!s.settings.invertY;
        const rm = !!(s.settings as FeelSettings).reducedMotion;
        if (rm !== this.reducedMotion) {
          this.reducedMotion = rm;
          if (this.mapDef) this.buildAtmosphere(this.mapDef, mapWidth(this.mapDef), mapHeight(this.mapDef));
        }
        this.applyQualitySetting();
      }
      if (s.quests !== prev.quests || s.flags !== prev.flags || s.party !== prev.party) this.beaconDirty = true;
    });
    input.overlayOpen = !!useGameStore.getState().overlay;

    const s = useGameStore.getState();
    // a pinned quality applies before the first region is built so its meshes get the right shadow flags
    const pinned = World3D.tierOf(feelSettings().quality);
    if (pinned !== null) {
      this.forcedTier = pinned;
      this.perfTier = pinned === 2 ? 1 : 2; // force applyTier to do its work
      this.applyTier(pinned);
    }
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
    this.fx?.setViewport(this.renderer.domElement.height);
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
    this.removeBeacon();
    for (const d of this.dissolves) disposeObject(d.g);
    this.dissolves = [];
    this.pawTrail?.dispose();
    this.pawTrail = null;
    this.trail = [];
    this.fx?.dispose();
    this.fx = null;
    this.clearAtmosphere();
    this.dash?.dispose();
    this.dash = null;
    this.crack?.dispose();
    this.crack = null;
    this.spirals.length = 0;
    this.hitStop = 0;
    this.focus?.dispose();
    this.focus = null;
    this.labels?.dispose();
    this.labels = null;
    this.labelSlots = [];
    this.sparkleCells = [];
    if (this.lastNearKey) {
      this.lastNearKey = "";
      bus.emit("near", null);
    }
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
    this.built = buildMap(def, store.flags, { shadows: this.qual.shadows });
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
      this.particles = new AmbientParticles(th.particles, W, H, this.qual.particles);
      this.particles.points.position.z = -H;
      this.scene.add(this.particles.points);
    }
    this.buildHighlights();
    this.buildAtmosphere(def, W, H);
    this.pawTrail = new PawTrail();
    this.scene.add(this.pawTrail.mesh);
    this.fx = new FxPool();
    this.fx.setViewport(this.renderer.domElement.height);
    this.scene.add(this.fx.points);
    this.dash = new DashStreak();
    this.scene.add(this.dash.mesh);
    this.crack = new CrackDecal();
    this.scene.add(this.crack.mesh);
    this.focus = new FocusRing();
    this.scene.add(this.focus.group);
    this.labels = new NameLabels();
    this.scene.add(this.labels.group);
    this.sparkleScanT = 0;

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
        rig.setShadows(this.qual.shadows);
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
    palakshi.setShadows(this.qual.shadows);
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
    this.prevHeading = this.heading;
    this.leanV = 0;
    this.lastCell = { x: Math.floor(this.playerPos.x), y: ROW(this.playerPos.z) };

    // --- companion (never a duplicate of an NPC: shouldSkipEntity handled that above)
    const comp = store.party.find((p) => p.id !== "palakshi");
    if (comp) {
      const rig = comp.id === "mimo" ? new DogRig() : new CharacterRig(comp.id);
      rig.setShadows(this.qual.shadows);
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
    this.barked.clear();
    this.perfT = -3; // a fresh map builds and warms caches: don't judge the frame rate yet

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
  private removeBeacon() {
    if (this.beacon) disposeObject(this.beacon);
    this.beacon = null;
    for (const m of this.beaconMats) m.dispose();
    this.beaconMats = [];
  }

  private updateBeacon() {
    this.beaconDirty = false;
    this.removeBeacon();
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
    const own = (opacity: number) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
      m.userData.base = opacity;
      this.beaconMats.push(m);
      return m;
    };
    const column = new THREE.Mesh(G.cyl(0.14, 0.22, 3.2, 10), own(0.16));
    column.position.y = 1.6;
    const ring = new THREE.Mesh(G.cyl(0.6, 0.6, 0.03, 20), own(0.35));
    ring.position.y = 0.03;
    ring.name = "ring";
    const gem = new THREE.Mesh(G.ico(0.17, 0), own(0.95));
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

  /** Gate bars falling apart: each piece drops, drifts and shrinks on its own timing, sparks all the while. */
  private updateDissolves(dt: number) {
    if (!this.dissolves.length) return;
    for (let i = this.dissolves.length - 1; i >= 0; i--) {
      const d = this.dissolves[i];
      d.t += dt;
      if (d.t < 0) continue; // still standing, the camera is on its way
      const DUR = 1.25;
      const k = Math.min(1, d.t / DUR);
      d.g.children.forEach((c, j) => {
        const s = d.seeds[j];
        const start = s * 0.35;
        const kk = THREE.MathUtils.clamp((k - start) / (1 - start), 0, 1);
        const e = kk * kk;
        c.position.y -= e * dt * (1.5 + s * 1.5);
        c.position.x += (s - 0.5) * dt * 0.8 * kk;
        c.rotation.z += (s - 0.5) * dt * 3 * kk;
        c.scale.setScalar(Math.max(0.001, 1 - e));
      });
      if (this.fx && Math.random() < 0.8) {
        const p = d.g.position;
        this.fx.sparks(p.x + (Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.3, p.z + (Math.random() - 0.5) * 0.2, Math.random() < 0.5 ? "#ffd27a" : "#f2dfa6", 2, 1.8, 0.5, 0.08);
      }
      if (k >= 1) {
        disposeObject(d.g);
        this.dissolves.splice(i, 1);
      }
    }
  }

  private gateOpensCinematic(gate: GateInfo) {
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
    // the bars are back for a moment, then come apart in sparks as the camera arrives
    const bars = propObject("gateBars");
    bars.position.set(gate.x, 0, gate.z);
    bars.rotation.y = gateYaw(this.mapDef, gate);
    this.scene.add(bars);
    this.dissolves.push({ g: bars, t: -0.7, seeds: bars.children.map(() => Math.random()) });
    this.delay(900, () => this.flourish(Math.floor(gate.x), Math.floor(-gate.z)));
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
  /** Cells Mimo has already barked at on this map (once per visit, so he is a hint, not a nag). */
  private barked = new Set<string>();
  private barkT = 0;
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
    // passive nose: walking past something hidden makes Mimo bark toward it
    this.barkT += dt;
    if (this.barkT > 0.4) {
      this.barkT = 0;
      if (this.inputLocked || useGameStore.getState().overlay || this.companion.currentAction) return;
      const near = this.nearestHidden();
      if (near && near.d < 2.6) {
        const k = `${near.x},${near.y}`;
        if (!this.barked.has(k)) {
          this.barked.add(k);
          this.companion.faceToward(near.x + 0.5, Z(near.y));
          this.companion.play("bark", 1.0);
          sfx("bark");
          this.tip("mimo-bark", {
            keyboard: "Mimo barks at something nearby. Press F and he'll sniff it out.",
            gamepad: "Mimo barks at something nearby. Press RB and he'll sniff it out.",
            touch: "Mimo barks at something nearby. Tap the paw button and he'll sniff it out.",
          });
        }
      }
    }
  }

  /** The closest hidden or uncollected thing on this map (buried items, chests, clues). */
  private nearestHidden() {
    const def = this.mapDef;
    const flags = useGameStore.getState().flags;
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
    return best;
  }

  // ============================================================== photo mode

  /**
   * Photo mode: the UI hides itself; here the player freezes (no steps, so no
   * portals or encounters; no interactions, so no dialogue), the camera orbits
   * freely with drag + wheel, and the world keeps breathing. Leaving snaps the
   * camera back behind the player and restores every limit.
   */
  private setPhotoMode(on: boolean) {
    if (this.photoMode === on) return;
    this.photoMode = on;
    this.cam.setPhoto(on);
    if (on) {
      this.vel.set(0, 0, 0);
      this.dashT = 0;
      this.player.setMoving(0);
      this.cam.shoulderTarget = 0;
      if (this.lastPrompt) {
        this.lastPrompt = "";
        bus.emit("prompt", "");
      }
    } else {
      this.recenter();
      // a cell reached before the freeze is re-evaluated on the next frame
      this.lastCell = { x: -1, y: -1 };
    }
  }

  private recenter() {
    this.cam.sinceLook = 10;
    if (this.mode === "battle" || this.cam.cinematicActive) return;
    this.cam.snapBehind(this.playerPos, this.heading);
  }

  /** One frame rendered straight into a PNG download (the drawing buffer is not preserved, so render first). */
  private snapshot() {
    try {
      this.renderer.render(this.scene, this.cam.camera);
      const url = this.renderer.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `shaolin-baddie-${ts}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      sfx("confirm");
      bus.emit("toast", { text: "Snapshot saved.", tone: "good" });
    } catch (err) {
      console.error("[world] snapshot failed", err);
      bus.emit("toast", { text: "Couldn't save a snapshot here.", tone: "warn" });
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
    // after the evening everyone is out on the balcony until the sutta is done
    if (flags.eveningDone && !flags.smokeDone) {
      const spot: Record<string, { x: number; y: number }> = {
        npc_dev: { x: 1, y: 16 }, npc_garv: { x: 2, y: 15 }, npc_hakim: { x: 3, y: 16 },
        npc_faizal: { x: 7, y: 15 }, npc_abhimanyu_home: { x: 8, y: 16 },
      };
      if (spot[kind]) return spot[kind];
    }
    if (kind === "npc_abhimanyu_home" && flags.smokeDone) return { x: 2, y: 7 };
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

  // ------------------------------------------------------------ adaptive quality
  /** Frame-rate watch: if a region runs slowly the renderer steps down (resolution, then shadows). */
  private fpsEma = 60;
  private perfT = -3;
  /** 2 = full, 1 = native resolution + small shadow map, 0 = no shadows. */
  private perfTier = 2;
  /** settings.quality other than "auto" pins the tier; the watch then stays out of it. */
  private forcedTier: 0 | 1 | 2 | null = null;

  /** What the renderer is doing right now (dev handle: window.__world.quality). */
  get quality() {
    return {
      tier: this.perfTier,
      forced: this.forcedTier,
      shadows: this.qual.shadows,
      pixelRatio: this.renderer.getPixelRatio(),
      fpsEma: Math.round(this.fpsEma),
      reducedMotion: this.reducedMotion,
    };
  }

  private static tierOf(q: FeelSettings["quality"]): 0 | 1 | 2 | null {
    return q === "high" ? 2 : q === "medium" ? 1 : q === "low" ? 0 : null;
  }

  /** Read settings.quality; a pinned tier applies at once, "auto" hands control back to the watch. */
  private applyQualitySetting() {
    const want = World3D.tierOf(feelSettings().quality);
    if (want === this.forcedTier && (want === null || want === this.perfTier)) return;
    this.forcedTier = want;
    if (want !== null) this.applyTier(want);
    else this.perfT = -3; // auto again: give the watch a moment before judging
  }

  /** @param announce emit "quality:tier" (the watch stepping down; a pinned setting is the player's own choice) */
  private applyTier(tier: 0 | 1 | 2, announce = false) {
    if (tier === this.perfTier) return;
    this.perfTier = tier;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(tier === 2 ? Math.min(dpr, this.qual.mobile ? 1.5 : 2) : 1);
    const size = tier === 2 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const shadows = tier > 0 && (!this.qual.mobile || this.forcedTier === 2);
    if (shadows !== this.qual.shadows) {
      this.qual.shadows = shadows;
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
      });
      // meshes decide castShadow when they are built: rebuild the region so shadows actually come back
      if (shadows && this.mapDef && this.mode === "explore" && !this.cam.cinematicActive && !this.inputLocked) this.refresh();
    }
    this.fpsEma = 60;
    if (announce) bus.emit("quality:tier", tier);
  }

  private watchPerformance(dt: number) {
    this.fpsEma += (1 / Math.max(dt, 1 / 240) - this.fpsEma) * 0.04;
    this.perfT += dt;
    if (this.forcedTier !== null) return;
    if (this.perfT < 5 || this.perfTier === 0) return;
    if (this.fpsEma >= 42) return;
    this.perfT = 0;
    this.applyTier((this.perfTier - 1) as 0 | 1, true);
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.watchPerformance(dt);
    // hit-stop: the world holds its frame for a few dozen ms on a heavy impact
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.renderer.render(this.scene, this.cam.camera);
      return;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  };

  private update(dt: number) {
    const store = useGameStore.getState();
    input.poll(dt);
    const st = input.state;
    const overlay = !!store.overlay;
    const locked = this.inputLocked || overlay || store.screen !== "playing" || this.mode !== "explore" || this.cam.cinematicActive || this.photoMode;

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
        const h = Math.atan2(this.dashDir.x, this.dashDir.z);
        this.dash?.burst(this.playerPos.x, this.playerPos.z, h, 8);
        this.dashLineT = 0;
      }
      if (this.dashT > 0) {
        this.dashT -= dt;
        want.copy(this.dashDir).multiplyScalar(DASH);
        // a few more wind lines mid-dash, then a landing puff where the feet come down
        this.dashLineT += dt;
        if (this.dashLineT > 0.07 && this.dashT > 0.08) {
          this.dashLineT = 0;
          this.dash?.burst(this.playerPos.x, this.playerPos.z, Math.atan2(this.dashDir.x, this.dashDir.z), 2);
        }
        if (this.dashT <= 0) this.landingPuff();
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
    // lean into turns: body rolls toward the inside of the turn, tilts forward on a dash
    {
      let dh = this.heading - this.prevHeading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.prevHeading = this.heading;
      const turnRate = dt > 0 ? dh / dt : 0;
      const wantLean = moving && !this.firstPerson ? THREE.MathUtils.clamp(turnRate * 0.045 * Math.min(1, speed01), -0.14, 0.14) : 0;
      this.leanV += (wantLean - this.leanV) * Math.min(1, dt * 7);
      this.player.lean = this.leanV;
      this.player.tilt += (((this.dashT > 0 ? 0.16 : speed01 > 1.05 ? 0.05 : 0)) - this.player.tilt) * Math.min(1, dt * 8);
    }
    this.player.setMoving(speed01);
    this.player.group.position.copy(this.playerPos);
    this.player.update(dt);
    // the camera slides over the shoulder while running, and settles back when the pace drops
    this.cam.shoulderTarget = !this.firstPerson && this.mode === "explore" && speed01 > 1.05 ? 0.42 : 0;

    // footsteps
    this.stepAccum += speed01 * dt;
    if (this.stepAccum > 0.33) {
      this.stepAccum = 0;
      sfx("step");
      if (speed01 > 0.3 && !this.firstPerson) this.footPuff(speed01);
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
    this.mimoGuidance(dt, moving || !!store.overlay || this.photoMode);
    if (this.pawTrail && this.companion && this.companionId === "mimo") {
      const c = this.companion;
      this.pawTrail.track(c.group.position, c.heading, c.group.position.distanceTo(this.pawLast) > 0.01, dt);
      this.pawLast.copy(c.group.position);
    }
    if (this.beaconDirty && this.mode === "explore") this.updateBeacon();
    if (this.beacon) {
      // the beacon calls louder the further away it is and settles down once you are close
      const bd = Math.hypot(this.beacon.position.x - this.playerPos.x, this.beacon.position.z - this.playerPos.z);
      const far = THREE.MathUtils.clamp((bd - 3) / 9, 0, 1);
      const now = this.timer.getElapsed();
      const pulse = 0.5 + 0.5 * Math.sin(now * (2.2 + far * 1.6));
      const gem = this.beacon.getObjectByName("gem");
      if (gem) {
        gem.rotation.y += dt * (1.4 + far);
        gem.position.y += Math.sin(now * 2.2) * 0.004;
        gem.scale.setScalar(1 + pulse * (0.08 + far * 0.3));
      }
      const ring = this.beacon.getObjectByName("ring");
      if (ring) ring.scale.setScalar(1 + pulse * far * 0.35);
      const dim = 0.35 + 0.65 * far;
      for (const m of this.beaconMats) m.opacity = (m.userData.base as number) * dim * (0.8 + pulse * 0.2 * (0.5 + far));
      this.beacon.visible = this.mode === "explore";
    }
    for (const e of this.entities) {
      if (e.rig) {
        const d = e.rig.group.position.distanceTo(this.playerPos);
        if (d < 2.4 && this.mode === "explore" && !this.cam.cinematicActive) e.rig.faceToward(this.playerPos.x, this.playerPos.z);
        // a little further out they only turn their head
        if (e.rig instanceof CharacterRig) e.rig.gaze = d < 4.5 && this.mode === "explore" ? this.playerPos : null;
        e.rig.update(dt);
      }
      e.update?.(dt);
    }
    if (this.battle) this.battle.enemy.update(dt);

    // --- ambience
    if (this.sky) this.sky.position.set(this.cam.camera.position.x, -8, this.cam.camera.position.z);
    if (this.water) ((this.water.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = this.timer.getElapsed();
    this.particles?.update(dt);
    this.updateSpirals(dt);
    this.updateDissolves(dt);
    this.fx?.update(dt);
    this.dash?.update(dt);
    this.crack?.update(dt);
    this.updateAtmosphere(dt);
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
    const fpp = this.firstPerson && !this.photoMode;
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
    this.interactionFeel(dt, hit);
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
        // ...then, left alone, he goes nosing at random spots nearby
        if (this.companionId === "mimo" && this.mimoIdle > 3 && !c.currentAction && this.mode === "explore") {
          this.mimoSniffT -= dt;
          if (this.mimoSniffT <= 0) {
            this.mimoSniffT = 6 + Math.random() * 6;
            const a = c.heading + (Math.random() - 0.5) * 2.4;
            c.setHeading(a);
            c.play("sniff", 1.0 + Math.random() * 0.5);
          }
        }
      }
      // Abhimanyu, waiting, keeps an eye on you
      if (c instanceof CharacterRig) c.gaze = this.playerPos;
    }
    // teleport if hopelessly far (fell behind through a door)
    if (distToPlayer > 6) pos.copy(this.playerPos).add(new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading)));
    c.update(dt);
  }
  private mimoSniffT = 5;

  /** True when Mimo stands in front of the player, close enough to pet. */
  private facingMimo() {
    const c = this.companion;
    if (!c || this.companionId !== "mimo") return false;
    const dx = c.group.position.x - this.playerPos.x;
    const dz = c.group.position.z - this.playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.5 || d < 1e-3) return false;
    const dot = (dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) / d;
    return dot > 0.55;
  }

  /** A pat on the head: Mimo spins, barks, and hearts go up. Story-free. */
  private petMimo() {
    const c = this.companion;
    if (!c || !this.fx) return;
    c.faceToward(this.playerPos.x, this.playerPos.z);
    c.play("spin", 0.9);
    sfx("bark");
    const p = c.group.position;
    const fx = this.fx;
    for (let i = 0; i < 7; i++) {
      this.delay(i * 70, () => {
        const a = Math.random() * Math.PI * 2;
        fx.spawn({
          x: p.x + Math.cos(a) * 0.2, y: 0.55 + Math.random() * 0.15, z: p.z + Math.sin(a) * 0.2,
          vx: Math.cos(a) * 0.25, vy: 0.9 + Math.random() * 0.4, vz: Math.sin(a) * 0.25,
          life: 1.1, size: 0.16, color: i % 2 ? "#ff7fa6" : "#ffb3c8", shrink: 0.4, drag: 0.6, alpha: 0.95,
        });
      });
    }
    bus.emit("toast", { text: "Mimo wags.", tone: "good" });
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
    if (this.mode !== "explore" || this.inputLocked) return;
    if (this.companionId !== "mimo" || !this.companion) {
      bus.emit("toast", { text: "You'd need a nose for that. Find Mimo first.", tone: "info" });
      return;
    }
    const c = this.companion;
    if (c.currentAction) return;
    const best = this.nearestHidden();
    // nothing to find right here and you are facing him: that is a pat, not a search
    if (this.facingMimo() && !(best && best.d < 2.6)) {
      this.petMimo();
      return;
    }
    c.play("sniff", 1.3);
    sfx("menu");
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

  /**
   * What the player can reach, made visible: the gold ring under the faced
   * interactable, name tags over nearby people, a faint sparkle on things
   * still to be found, and the "near" event the HUD listens to.
   */
  private interactionFeel(dt: number, hit: { kind: string; name?: string; x: number; y: number; entity?: Entity } | null) {
    // --- near event (only when the target changes)
    const key = hit ? `${hit.kind}|${hit.x},${hit.y}` : "";
    if (key !== this.lastNearKey) {
      this.lastNearKey = key;
      bus.emit("near", hit ? { kind: hit.kind, name: hit.name, x: hit.x, y: hit.y } : null);
    }
    // --- focus ring
    if (this.focus) {
      if (hit && this.mode === "explore") {
        const p = hit.entity ? hit.entity.object.position : null;
        this.focus.set(p ? p.x : hit.x + 0.5, p ? p.z : Z(hit.y));
      } else this.focus.set(null);
      this.focus.update(dt);
    }
    // --- name labels: the six closest named people within 3.5 units
    if (this.labels) {
      const list = this.labelTargets;
      list.length = 0;
      const show = this.mode === "explore" && !this.photoMode;
      if (show) {
        let slot = 0;
        for (const e of this.entities) {
          if (!e.rig || !e.name || !e.object.visible) continue;
          const d = e.object.position.distanceTo(this.playerPos);
          if (d > 3.5) continue;
          const fade = d < 2.6 ? 1 : 1 - (d - 2.6) / 0.9;
          let t = this.labelSlots[slot];
          if (!t) t = this.labelSlots[slot] = { name: "", x: 0, y: 0, z: 0 };
          slot++;
          t.name = e.name;
          t.x = e.object.position.x;
          t.y = e.rig.height + 0.32;
          t.z = e.object.position.z;
          list.push({ t, fade });
        }
        list.sort((a, b) => b.fade - a.fade);
        if (list.length > 6) list.length = 6;
      }
      this.labels.update(dt, list);
    }
    // --- sparkle on chests / buried things / clues within 4 units
    if (this.fx && this.mode === "explore") {
      this.sparkleScanT -= dt;
      if (this.sparkleScanT <= 0) {
        this.sparkleScanT = 0.5;
        this.sparkleCells.length = 0;
        const def = this.mapDef;
        const flags = useGameStore.getState().flags;
        const px = Math.floor(this.playerPos.x);
        const py = ROW(this.playerPos.z);
        for (let y = Math.max(0, py - 4); y <= Math.min(mapHeight(def) - 1, py + 4); y++) {
          for (let x = Math.max(0, px - 4); x <= Math.min(mapWidth(def) - 1, px + 4); x++) {
            const ch = tileAt(def, x, y);
            if (!"*h~$y".includes(ch) || isHidden(def, ch, x, y, flags)) continue;
            if (Math.hypot(x + 0.5 - this.playerPos.x, Z(y) - this.playerPos.z) > 4) continue;
            this.sparkleCells.push({ x: x + 0.5, z: Z(y) });
          }
        }
      }
      if (this.sparkleCells.length) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) {
          this.sparkleT = 0.22 / Math.min(3, this.sparkleCells.length);
          const c = this.sparkleCells[Math.floor(Math.random() * this.sparkleCells.length)];
          const a = Math.random() * Math.PI * 2;
          const r = 0.15 + Math.random() * 0.3;
          this.fx.spawn({
            x: c.x + Math.cos(a) * r, y: 0.2 + Math.random() * 0.5, z: c.z + Math.sin(a) * r,
            vy: 0.35, life: 0.9, size: 0.07, color: "#fff1b8", shrink: 1, drag: 0.5, alpha: 0.9,
          });
        }
      }
    }
  }

  /** The colour of dust the floor under the player kicks up, or null for floors that do not puff. */
  private dustHere() {
    const kind = floorFor(this.mapDef, tileAt(this.mapDef, Math.floor(this.playerPos.x), ROW(this.playerPos.z)));
    return DUST[kind] ?? null;
  }

  private footPuff(speed01: number) {
    const c = this.fx && this.dustHere();
    if (!c || !this.fx) return;
    this.stepSide = -this.stepSide;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const x = this.playerPos.x - fx * 0.12 + fz * 0.09 * this.stepSide;
    const z = this.playerPos.z - fz * 0.12 - fx * 0.09 * this.stepSide;
    const run = speed01 > 1.05;
    this.fx.puff(x, 0.03, z, c, run ? 4 : 2, run ? 0.16 : 0.1, run ? 0.5 : 0.3, run ? 0.17 : 0.13, 0.5);
  }

  private landingPuff() {
    const c = this.fx && this.dustHere();
    if (!c || !this.fx) return;
    this.fx.puff(this.playerPos.x, 0.03, this.playerPos.z, c, 9, 0.3, 0.7, 0.2, 0.6);
  }

  /** Heal spirals: two motes a frame climbing a helix around the healed fighter. */
  private updateSpirals(dt: number) {
    if (!this.spirals.length || !this.fx) return;
    for (let i = this.spirals.length - 1; i >= 0; i--) {
      const s = this.spirals[i];
      s.t += dt;
      if (s.t > 0.9) {
        this.spirals.splice(i, 1);
        continue;
      }
      for (let k = 0; k < 2; k++) {
        const a = s.t * 11 + k * Math.PI;
        const r = 0.42 - s.t * 0.2;
        this.fx.spawn({
          x: s.x + Math.cos(a) * r, y: 0.15 + s.t * 1.5, z: s.z + Math.sin(a) * r,
          vx: -Math.sin(a) * 0.4, vy: 0.9, vz: Math.cos(a) * 0.4,
          life: 0.6, size: 0.1, color: k ? s.color : "#c8ffe0", shrink: 0.8, drag: 0.4, alpha: 0.95,
        });
      }
    }
  }

  private flourish(x: number, y: number) {
    const b = new Burst(x + 0.5, 0.6, Z(y), "#f2dfa6", 40, 0.9, 2.4);
    this.bursts.push(b);
    this.scene.add(b.points);
    bus.emit("fade", { flash: true, ms: 260, color: "rgba(242,223,166,0.6)" });
  }

  // ============================================================ atmosphere

  private clearAtmosphere() {
    this.fog?.dispose();
    this.fog = null;
    this.shafts?.dispose();
    this.shafts = null;
    this.birds?.dispose();
    this.birds = null;
    this.leaves?.dispose();
    this.leaves = null;
  }

  /** Region-specific extras: ground mist, temple light, birds, drifting leaves. */
  private buildAtmosphere(def: MapDef, W: number, H: number) {
    this.clearAtmosphere();
    if (this.reducedMotion || !this.built) return;
    const th = this.built.theme;
    const id = def.id;
    if (id === "forest" || id === "cave" || id === "mountain") {
      const tint = id === "cave" ? "#8e80b8" : id === "mountain" ? "#e8eef6" : "#d6e6d0";
      this.fog = new FogPlanes(W, H, tint, 3, id === "cave" ? 0.12 : 0.15);
      this.scene.add(this.fog.mesh);
    }
    if (id === "temple") {
      const spots: { x: number; z: number }[] = [];
      for (let i = 0; i < 4; i++) spots.push({ x: W * (0.2 + 0.2 * i) + (i % 2) * 0.7, z: -H * (0.3 + 0.12 * i) });
      this.shafts = new LightShafts(spots, "#ffd9a0", 0.07);
      this.scene.add(this.shafts.mesh);
    }
    if (id === "route1" || id === "village" || id === "town") {
      this.birds = new Birds(W, H, th.indoor ? "#2a2024" : "#2e2630");
      this.scene.add(this.birds.group);
    }
    if (id === "route1" || id === "village") {
      this.leaves = new AmbientParticles("leaves", W, H, 0.35 * this.qual.particles);
      this.leaves.points.position.z = -H;
      this.scene.add(this.leaves.points);
    }
  }

  private updateAtmosphere(dt: number) {
    this.fog?.update(dt);
    this.shafts?.update(dt);
    this.birds?.update(dt);
    this.leaves?.update(dt);
    if (this.reducedMotion) return;
    // lantern / brazier flicker: a sum of two sines per light, never dropping far
    const t = this.timer.getElapsed();
    for (let i = 0; i < this.points.length; i++) {
      const base = this.lightBase[i];
      if (!base) continue;
      const s = this.lightSeed[i];
      this.points[i].intensity = base * (0.9 + Math.sin(t * 7.3 + s) * 0.05 + Math.sin(t * 13.1 + s * 2.1) * 0.05);
    }
    // embers: the braziers and the sacred lantern near the player throw the odd spark
    if (this.fx && this.built && this.mode === "explore") {
      this.emberT -= dt;
      if (this.emberT <= 0) {
        this.emberT = 0.09;
        const gp = this.built.glowPoints;
        // pick one at random; cheap and it reads as random anyway
        const g = gp[Math.floor(Math.random() * gp.length)];
        if (g && (g.color === "#ff8a3c" || g.color === "#ffb060") && Math.hypot(g.x - this.playerPos.x, g.z - this.playerPos.z) < 14) {
          this.fx.spawn({
            x: g.x + (Math.random() - 0.5) * 0.2, y: g.y - 0.1, z: g.z + (Math.random() - 0.5) * 0.2,
            vx: (Math.random() - 0.5) * 0.3, vy: 0.9 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.3,
            life: 0.7 + Math.random() * 0.5, size: 0.05, color: Math.random() < 0.5 ? "#ffb060" : "#ff7a3c", shrink: 1, drag: 0.8, gravity: -0.3, alpha: 1,
          });
        }
      }
    }
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
        this.lightBase[i] = 0;
        return;
      }
      p.position.set(e.g.x, e.g.y, e.g.z);
      p.color.set(e.g.color);
      p.intensity = e.g.intensity * (this.qual.mobile ? 0.8 : 1);
      this.lightBase[i] = p.intensity;
      this.lightSeed[i] = e.g.x * 1.7 + e.g.z * 0.9;
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
    rig.setShadows(this.qual.shadows);
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
          const tp = target.group.position;
          if (!this.reducedMotion) {
            this.cam.shake(p.crit ? 260 : 140, p.crit ? 0.09 : 0.045);
            this.cam.punch(p.crit ? 0.22 : 0.1, p.crit ? 190 : 140);
            this.hitStop = p.crit ? 0.09 : 0.06;
          }
          this.fx?.sparks(tp.x, target.height * 0.6, tp.z, p.crit ? "#fff0a0" : "#ff9a6a", p.crit ? 26 : 12, p.crit ? 3.2 : 2.2, 0.5, p.crit ? 0.11 : 0.08);
          if (p.crit) this.crack?.show(tp.x, tp.z);
        });
        break;
      }
      case "heal": {
        const target = p.side === "player" ? front : b.enemy;
        const tp = target.group.position;
        this.spirals.push({ x: tp.x, z: tp.z, t: 0, color: "#7ddca4" });
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
    // a slow dolly in from further out while the title shows, instead of a hard cut
    const wide = new THREE.Vector3(W / 2 + 9.5, 13.5, -H / 2 + 15);
    const mid = p.clone().add(new THREE.Vector3(-Math.sin(this.heading) * 4 + 3, 4.5, -Math.cos(this.heading) * 4 + 3));
    const centre = new THREE.Vector3(W / 2, 0.5, -H / 2);
    this.cam.camera.position.copy(wide);
    this.cam.playCinematic({
      frames: [
        { pos: wide, look: centre, dur: 0.01 },
        { pos: high, look: centre, dur: 1.9, ease: ease.out },
        { pos: mid, look: p.clone().setY(1), dur: 1.9 },
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
      case "smoke-scene": this.smokeScene(); break;
      case "smoke-end": {
        this.smokeOn = false;
        if (this.cam.cinematicActive) this.cam.stopCinematic();
        this.inputLocked = false;
        this.cam.snapBehind(this.playerPos, this.heading);
        break;
      }
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

  /** The balcony: everyone leans on the rail with a sutta, Riddhi loudest, smoke drifting up. */
  private smokeOn = false;
  private smokeScene() {
    const H = mapHeight(this.mapDef);
    const railZ = -(H - 1) - 0.1; // just inside the balcony's outer wall
    const stand: Record<string, number> = { npc_dev: 1.9, npc_garv: 2.8, npc_hakim: 3.7, npc_riddhi_flat: 5.5, npc_faizal: 6.5, npc_abhimanyu_home: 7.5 };
    const smokers: THREE.Object3D[] = [];
    for (const e of this.entities) {
      const x = stand[e.kind];
      if (x == null || !e.rig) continue;
      e.x = Math.floor(x);
      e.y = H - 2;
      this.walkEntity(e, new THREE.Vector3(x, 0, railZ + 0.55), Math.PI);
      if (e.kind !== "npc_hakim") smokers.push(e.object);
    }
    this.playerPos.set(4.6, 0, railZ + 0.6);
    this.heading = Math.PI;
    this.player.setHeading(Math.PI, true);
    if (this.companion) {
      this.companion.group.position.set(5.0, 0, railZ + 1.25);
      this.companion.setHeading(Math.PI, true);
    }
    this.inputLocked = true;
    this.smokeOn = true;
    // drifting smoke: small grey puffs rise from each person and thin out
    const puffMat = new THREE.MeshBasicMaterial({ color: "#d8d2cc", transparent: true, opacity: 0.35, depthWrite: false });
    const puffs: { m: THREE.Mesh; t: number; vx: number }[] = [];
    let acc = 0;
    let last = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.smokeOn) {
        acc += dt;
        if (acc > 0.35 && smokers.length) {
          acc = 0;
          const who = smokers[Math.floor(Math.random() * smokers.length)];
          const m = new THREE.Mesh(G.sphere(0.07, 6), puffMat);
          m.position.copy(who.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 1.45, -0.25));
          this.scene.add(m);
          puffs.push({ m, t: 0, vx: (Math.random() - 0.5) * 0.15 });
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.t += dt;
        p.m.position.y += dt * 0.42;
        p.m.position.x += p.vx * dt;
        p.m.position.z -= dt * 0.12;
        const k = Math.min(1, p.t / 2.6);
        p.m.scale.setScalar(0.6 + k * 2.2);
        (p.m.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - k);
        if (k >= 1) { this.scene.remove(p.m); puffs.splice(i, 1); }
      }
      if (this.smokeOn || puffs.length) requestAnimationFrame(tick);
      else puffMat.dispose();
    };
    tick();
    // camera: on the balcony itself (the room wall is right behind the row), sliding
    // along the rail past everyone's faces, then settling a little above the group
    const mid = new THREE.Vector3(4.6, 1.15, railZ + 0.5);
    this.cam.playCinematic({
      frames: [
        { pos: new THREE.Vector3(0.8, 1.5, railZ + 1.7), look: new THREE.Vector3(3.6, 1.2, railZ + 0.5), dur: 1.2 },
        { pos: new THREE.Vector3(8.9, 1.45, railZ + 1.7), look: new THREE.Vector3(6.0, 1.2, railZ + 0.5), dur: 18 },
        { pos: new THREE.Vector3(4.6, 2.2, railZ + 1.75), look: mid, dur: 12 },
        { pos: new THREE.Vector3(1.0, 1.6, railZ + 1.5), look: mid, dur: 14 },
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
