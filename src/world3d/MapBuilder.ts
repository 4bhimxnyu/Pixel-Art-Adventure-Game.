// ---------------------------------------------------------------------------
// Turns a MapDef (the same ASCII rows the pixel game uses) into a low-poly
// 3D region. One tile = one world unit; row index = z, column = x.
//
// Output is a single Group of InstancedMeshes (one per prop part) plus a
// per-cell coloured floor, a theme (sky / fog / light), and a few glow points
// the world can turn into point lights. Everything is rebuilt on refresh(),
// exactly as the 2D scene re-painted the map, so story state (lit statues,
// pressed plates, taken flames, opened barriers) is always right.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { tileAt, mapWidth, mapHeight, BARRIER_FLAG, type MapDef, type MapId } from "../game/maps";
import { isHidden } from "../game/story";
import type { Flags } from "../store/useGameStore";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { C, G, mat, hash01, disposeObject, waterMaterial } from "./materials";
import { prop, type PropDef } from "./props";

export type Theme = {
  sky: string;
  /** Zenith colour of the sky dome (sky is the horizon). */
  skyTop?: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ground: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  sunDir: [number, number, number];
  ambient: number;
  particles?: "petals" | "leaves" | "sparks" | "fireflies" | "dust" | "snowdust";
  indoor: boolean;
  /** Which prop ring surrounds the map beyond its edges. */
  border?: string;
  /** Taller silhouettes for the outer rings (mountain peaks). */
  border2?: string;
};

export const THEMES: Record<MapDef["theme"] | "road", Theme> = {
  indoor: {
    sky: "#0a0507", fog: "#0a0507", fogNear: 14, fogFar: 30, ground: "#5a3d2c",
    hemiSky: "#ffe0b8", hemiGround: "#3a2a24", hemi: 0.9, sun: "#ffd9a8", sunIntensity: 1.4,
    sunDir: [2, 6, 3], ambient: 0.25, indoor: true,
  },
  outdoor: {
    skyTop: "#4f8fc4", sky: "#9fc4d6", fog: "#b8d4dc", fogNear: 14, fogFar: 42, ground: C.grass1,
    hemiSky: "#cfe6f2", hemiGround: "#4a5a3a", hemi: 0.8, sun: "#fff1d6", sunIntensity: 1.9,
    sunDir: [3, 7, 2], ambient: 0.15, particles: "fireflies", indoor: false, border: "tree",
  },
  village: {
    skyTop: "#6a4a7a", sky: "#c88a6a", fog: "#d8a888", fogNear: 12, fogFar: 40, ground: "#7a7470",
    hemiSky: "#f2c8a8", hemiGround: "#4a3a3a", hemi: 0.75, sun: "#ffc890", sunIntensity: 1.6,
    sunDir: [-4, 5, 2], ambient: 0.2, particles: "dust", indoor: false, border: "pine",
  },
  bamboo: {
    skyTop: "#5c9a8a", sky: "#8fb98a", fog: "#a8cfa0", fogNear: 8, fogFar: 30, ground: "#3a5a36",
    hemiSky: "#d6f0c8", hemiGround: "#2a3a26", hemi: 0.85, sun: "#f4ffd8", sunIntensity: 1.5,
    sunDir: [2, 7, 1], ambient: 0.2, particles: "leaves", indoor: false, border: "bamboo",
  },
  mountain: {
    skyTop: "#4a74a8", sky: "#a9bcd0", fog: "#c2d0de", fogNear: 10, fogFar: 36, ground: "#5f5a66",
    hemiSky: "#dce8f4", hemiGround: "#3a3a42", hemi: 0.7, sun: "#fff4e6", sunIntensity: 1.35,
    sunDir: [4, 8, -2], ambient: 0.12, particles: "snowdust", indoor: false, border: "boulder", border2: "peak",
  },
  temple: {
    sky: "#120a0d", fog: "#1a0f12", fogNear: 10, fogFar: 32, ground: "#3a2a28",
    hemiSky: "#ffcf9a", hemiGround: "#2a1414", hemi: 0.7, sun: "#ffb070", sunIntensity: 1.3,
    sunDir: [1, 6, 2], ambient: 0.3, particles: "dust", indoor: true,
  },
  garden: {
    skyTop: "#8aa8d8", sky: "#f0c8d6", fog: "#f4d6e0", fogNear: 12, fogFar: 40, ground: "#5c8a52",
    hemiSky: "#fff0f6", hemiGround: "#5a4a4a", hemi: 0.9, sun: "#fff4e8", sunIntensity: 1.7,
    sunDir: [-3, 7, 3], ambient: 0.2, particles: "petals", indoor: false, border: "cherry",
  },
  cave: {
    sky: "#0a0710", fog: "#15101e", fogNear: 6, fogFar: 24, ground: "#2b2434",
    hemiSky: "#7a6aaa", hemiGround: "#141020", hemi: 0.85, sun: "#9e8cff", sunIntensity: 1.0,
    sunDir: [1, 6, 1], ambient: 0.5, particles: "sparks", indoor: true,
  },
  flat: {
    sky: "#1a1420", fog: "#1a1420", fogNear: 14, fogFar: 30, ground: "#8a6a4a",
    hemiSky: "#ffe6c0", hemiGround: "#3a2a2a", hemi: 0.95, sun: "#ffd2a0", sunIntensity: 1.3,
    sunDir: [-2, 6, 3], ambient: 0.3, indoor: true,
  },
  road: {
    skyTop: "#4a3a6a", sky: "#e0906a", fog: "#f0b28a", fogNear: 12, fogFar: 44, ground: "#4f6b3e",
    hemiSky: "#ffd0a8", hemiGround: "#3a3a2a", hemi: 0.8, sun: "#ffb27a", sunIntensity: 1.5,
    sunDir: [-6, 4, 2], ambient: 0.2, particles: "fireflies", indoor: false, border: "pine",
  },
};

export type GateInfo = { to: MapId; x: number; z: number; locked: boolean; cells: { x: number; y: number }[] };

export type BuiltMap = {
  group: THREE.Group;
  theme: Theme;
  glowPoints: { x: number; z: number; color: string; intensity: number; y: number }[];
  highlights: { x: number; y: number }[];
  gates: GateInfo[];
  dispose(): void;
};

/** The entrance that announces each destination. */
const GATE_FOR: Partial<Record<MapId, string>> = {
  village: "gatePaifang", bamboo: "gateBamboo", garden: "gateMoon", mountain: "gateStone",
  temple: "gateTemple", cave: "gateCave", academy: "gatePaifang", road: "gateArch",
  town: "gateArch", route1: "gateArch", forest: "gateArch", f1205: "gatePlaque",
};

/** Group a map's portals into entrances: adjacent cells with the same destination become one gate. */
export function gatesOf(def: MapDef, flags: Flags): GateInfo[] {
  const used = new Set<number>();
  const out: GateInfo[] = [];
  def.portals.forEach((p, i) => {
    if (used.has(i)) return;
    const cells = [{ x: p.x, y: p.y }];
    used.add(i);
    def.portals.forEach((q, j) => {
      if (used.has(j) || q.to !== p.to) return;
      if (cells.some((c) => Math.abs(c.x - q.x) + Math.abs(c.y - q.y) === 1)) {
        cells.push({ x: q.x, y: q.y });
        used.add(j);
      }
    });
    const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length + 0.5;
    const cy = cells.reduce((a, c) => a + c.y, 0) / cells.length + 0.5;
    const locked = !!p.requiresFlag && !(flags as any)[p.requiresFlag];
    out.push({ to: p.to, x: cx, z: -cy, locked, cells });
  });
  return out;
}

type Instance = { def: PropDef; mats: THREE.Matrix4[] };

const FLOOR_COLORS: Record<string, [string, string]> = {
  grass: [C.grass1, C.grass2],
  darkGrass: ["#355a34", "#3f6b3e"],
  dirt: [C.dirt1, C.dirt2],
  stone: ["#7a7580", "#8a8590"],
  plaza: ["#8a8580", "#9a9590"],
  gravel: ["#8a8278", "#9a9288"],
  wood: ["#8a5c3c", "#9a6a46"],
  lightWood: ["#c4a078", "#d2ae86"],
  temple: ["#4a2e2a", "#5a3a34"],
  cave: ["#2f2735", "#3a3146"],
  void: ["#000000", "#000000"],
};

function floorFor(def: MapDef, ch: string): string {
  const t = def.theme;
  if (ch === "_") return "void";
  if (ch === "," ) return t === "mountain" ? "gravel" : t === "village" ? "plaza" : "dirt";
  if (ch === "k") return "plaza";
  if (ch === ":") return "gravel";
  if (ch === "n") return "cave";
  if (ch === "f" || ch === "r" || ch === "d") return t === "temple" ? "temple" : t === "flat" ? "lightWood" : "wood";
  if (t === "indoor" || t === "flat") return t === "flat" ? "lightWood" : "wood";
  if (t === "temple") return "temple";
  if (t === "cave") return "cave";
  if (t === "mountain") return "stone";
  if (t === "bamboo") return "darkGrass";
  if (t === "village") return "plaza";
  return "grass";
}

/** Which props a cell gets, given story state. */
function propsFor(def: MapDef, ch: string, x: number, y: number, flags: Flags): string[] {
  const t = def.theme;
  const hidden = isHidden(def, ch, x, y, flags);
  const key = `${def.id}_${x}_${y}`;
  // Entity markers are drawn by the world as characters; the floor is enough.
  if (ch in def.interacts) return [];
  switch (ch) {
    case "g": return ["grass"];
    case "F": return ["flower"];
    case "w": return []; // water is one animated mesh per map (see buildMap)
    case "o": return ["pondLily"];
    case "e": return ["bridge"];
    case "t": {
      const r = hash01(x, y, 1);
      if (t === "outdoor" && r < 0.3) return ["pine"];
      return r < 0.6 ? ["tree"] : ["tree2"];
    }
    case ".": {
      if (def.indoor || t === "village" || t === "mountain") return t === "mountain" && hash01(x, y, 5) < 0.12 ? ["pebble"] : [];
      const r = hash01(x, y, 5);
      return r < 0.22 ? ["tuft"] : r < 0.26 ? ["pebble"] : [];
    }
    case "j": return ["bamboo"];
    case "q": return ["cherry"];
    case "v": return ["petalGround"];
    case "^": return ["boulder"];
    case "c": return hash01(x, y, 2) < 0.18 ? ["caveWall", "crystal"] : ["caveWall"];
    case "#": return t === "flat" ? ["flatWall"] : ["wall"];
    case "K": return t === "temple" ? ["templeWall"] : ["stoneWall"];
    case "H": {
      if (def.id === "road") return ["flatBlock"];
      const above = tileAt(def, x, y - 1) === "H";
      const below = tileAt(def, x, y + 1) === "H" || tileAt(def, x, y + 1) === "d";
      if (above && !below) return ["houseS"];
      if (below && !above) return ["houseN"];
      return ["houseSingle"];
    }
    case "d": return def.id === "road" ? ["flatDoor"] : def.indoor ? ["doorway"] : ["door"];
    case "L": return def.id === "village" && !flags.lanternRestored ? ["lanternPostDark"] : ["lanternPost"];
    case "m": return ["stall"];
    case "%": return ["banner"];
    case "s": return def.id === "bedroom" ? ["dogBowl"] : ["sign"];
    case "u": return flags.statues[key] ? ["statueLit"] : ["statue"];
    case "z": return flags.plates[key] ? ["platePressed"] : ["plate"];
    case "=": {
      const f = BARRIER_FLAG[def.id];
      const open = f ? !!(flags as any)[f] : false;
      if (open) return [];
      return def.id === "academy" ? ["gate"] : ["bambooWall"];
    }
    case "!": return hidden ? ["brazierCold"] : ["brazier"];
    case "$": return hidden ? [] : ["scrollStand"];
    case "&": return flags.lanternRestored ? ["sacredLanternLit"] : ["sacredLantern"];
    case "~": return hidden ? [] : ["dirtMound"];
    case "i": return ["stele"];
    case "*": return hidden ? [] : ["chest"];
    case "+": return ["viewpoint"];
    case "I": return ["incense"];
    case "h": return hidden ? [] : ["sparkleBush"];
    case "y": return hidden ? [] : ["toyBall"];
    case "p": return ["pawPrints"];
    case "b": return ["bed"];
    case "B": return ["bookshelf"];
    case "D": return ["desk"];
    case "T": return ["tv"];
    case "r": return ["rug"];
    case "S": return ["sofa"];
    case "l": return ["guitarStand"];
    case "@": return ["poster"];
    case "0": return ["window"];
    case "[": return ["counter"];
    case "]": return ["fridge"];
    case "x": return ["weights"];
    case "7": return ["table"];
    case "a": return ["plant"];
    default: return [];
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export function buildMap(def: MapDef, flags: Flags, quality: { shadows: boolean }): BuiltMap {
  const theme = THEMES[def.id === "road" ? "road" : def.theme];
  const W = mapWidth(def);
  const H = mapHeight(def);
  const group = new THREE.Group();
  group.name = `map:${def.id}`;

  const instances = new Map<string, Instance>();
  const glowPoints: BuiltMap["glowPoints"] = [];
  const highlights: BuiltMap["highlights"] = [];
  const gates = gatesOf(def, flags);

  const place = (key: string, x: number, z: number, salt: number) => {
    const d = prop(key);
    if (!d) return;
    let inst = instances.get(key);
    if (!inst) {
      inst = { def: d, mats: [] };
      instances.set(key, inst);
    }
    const copies = d.copies ?? 1;
    for (let c = 0; c < copies; c++) {
      const r1 = hash01(x, z, salt + c * 7);
      const r2 = hash01(x, z, salt + c * 7 + 3);
      const r3 = hash01(x, z, salt + c * 7 + 5);
      const j = d.jitter ?? 0;
      _p.set(x + 0.5 + (r1 - 0.5) * 2 * j, 0, -(z + 0.5 + (r2 - 0.5) * 2 * j));
      _e.set(0, d.spin ? r3 * Math.PI * 2 : 0, 0);
      _q.setFromEuler(_e);
      const sc = d.scale ? d.scale[0] + (d.scale[1] - d.scale[0]) * hash01(x, z, salt + c * 7 + 9) : 1;
      _s.set(sc, sc, sc);
      inst.mats.push(_m.clone().compose(_p, _q, _s));
    }
  };

  // --- floor: one instanced slab with a colour per cell
  const floorCells: { x: number; z: number; color: THREE.Color }[] = [];
  const tmpColor = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = tileAt(def, x, y);
      if (ch === "w" || ch === "o") continue; // water is its own mesh
      const kind = floorFor(def, ch);
      if (kind === "void") continue;
      const [a, b] = FLOOR_COLORS[kind];
      tmpColor.set(a).lerp(new THREE.Color(b), hash01(x, y, 11));
      floorCells.push({ x, z: y, color: tmpColor.clone() });
      for (const key of propsFor(def, ch, x, y, flags)) place(key, x, y, key.length);

      // glow points for sparse point lights
      const wz = -(y + 0.5);
      if (ch === "L" && !(def.id === "village" && !flags.lanternRestored)) glowPoints.push({ x: x + 0.9, z: wz, y: 1.6, color: "#ff9a4a", intensity: 1.6 });
      if (ch === "!" && !isHidden(def, ch, x, y, flags)) glowPoints.push({ x: x + 0.5, z: wz, y: 1.0, color: "#ff8a3c", intensity: 2.2 });
      if (ch === "&" && flags.lanternRestored) glowPoints.push({ x: x + 0.5, z: wz, y: 2.0, color: "#ffb060", intensity: 3 });
      if (ch === "c" && hash01(x, y, 2) < 0.18) glowPoints.push({ x: x + 0.5, z: wz, y: 0.6, color: "#8e7cff", intensity: 1.0 });
      if (ch === "0") glowPoints.push({ x: x + 0.5, z: wz - 0.4, y: 1.3, color: "#9fc4e8", intensity: 0.8 });

      // the few objects that matter right now get a highlight
      if ("$&!".includes(ch) && !isHidden(def, ch, x, y, flags) && !(ch === "&" && !flags.guardianDone)) highlights.push({ x, y });
    }
  }

  // --- water: one animated surface for every river / pond cell
  const waterCells: { x: number; z: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("wo".includes(tileAt(def, x, y))) waterCells.push({ x, z: y });
  if (waterCells.length) {
    const geos = waterCells.map((c) => {
      const g = new THREE.PlaneGeometry(1.02, 1.02, 2, 2);
      g.rotateX(-Math.PI / 2);
      g.translate(c.x + 0.5, -0.03, -(c.z + 0.5));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (merged) {
      const water = new THREE.Mesh(merged, waterMaterial(theme.indoor ? "#1e3a52" : C.water1, theme.indoor ? "#2b5171" : C.water2));
      water.name = "water";
      water.receiveShadow = false;
      group.add(water);
    }
    // the bed under the water
    for (const c of waterCells) {
      const bed = new THREE.Mesh(G.box(1, 0.12, 1), mat("#1c2f44"));
      bed.position.set(c.x + 0.5, -0.2, -(c.z + 0.5));
      group.add(bed);
    }
  }

  const floorGeo = G.box(1, 0.12, 1);
  const floorMat = mat("#ffffff");
  const floor = new THREE.InstancedMesh(floorGeo, floorMat, floorCells.length);
  floorCells.forEach((c, i) => {
    _p.set(c.x + 0.5, -0.06, -(c.z + 0.5));
    _q.identity();
    _s.set(1, 1, 1);
    floor.setMatrixAt(i, _m.compose(_p, _q, _s));
    floor.setColorAt(i, c.color);
  });
  floor.receiveShadow = quality.shadows;
  floor.name = "floor";
  group.add(floor);

  // --- the world beyond the walls
  if (!theme.indoor) {
    const base = new THREE.Mesh(G.plane(W + 40, H + 40), mat(theme.ground));
    base.rotation.x = -Math.PI / 2;
    base.position.set(W / 2, -0.14, -H / 2);
    base.receiveShadow = quality.shadows;
    group.add(base);
    if (theme.border) {
      for (let ring = 1; ring <= 4; ring++) {
        // the ring touching the map is low shrubs so the camera never sits inside a canopy
        const key = ring === 1 ? (theme.border === "boulder" ? "pebble" : "bush") : ring >= 3 && theme.border2 ? theme.border2 : theme.border;
        const density = ring === 4 ? 0.35 : ring === 1 ? 0.5 : 0.8;
        for (let x = -ring; x < W + ring; x++) {
          for (const z of [-ring, H - 1 + ring]) if (hash01(x, z, 31) < density) place(key, x, z, 41);
        }
        for (let z = -ring + 1; z < H - 1 + ring; z++) {
          for (const x of [-ring, W - 1 + ring]) if (hash01(x, z, 31) < density) place(key, x, z, 41);
        }
      }
    }
  } else {
    const base = new THREE.Mesh(G.plane(W + 8, H + 8), mat(theme.sky));
    base.rotation.x = -Math.PI / 2;
    base.position.set(W / 2, -0.2, -H / 2);
    group.add(base);
  }

  // --- entrances: a gate on every portal that leads somewhere worth announcing
  for (const g of gates) {
    const key = GATE_FOR[g.to];
    if (!key) continue;
    if (def.indoor && def.theme !== "temple") continue;
    if (def.id === "road" && g.to === "f1205") {
      // the flat's own door carries the plaque; nothing to build on the road's floor
    }
    const W0 = mapWidth(def);
    const H0 = mapHeight(def);
    const onNS = g.cells.every((c) => c.y === 0 || c.y === H0 - 1) || (g.cells.length === 2 && g.cells[0].y === g.cells[1].y);
    const ry = onNS ? 0 : Math.PI / 2;
    const add = (k: string) => {
      const d = prop(k);
      if (!d) return;
      let inst = instances.get(k);
      if (!inst) {
        inst = { def: d, mats: [] };
        instances.set(k, inst);
      }
      _p.set(g.x, 0, g.z);
      _e.set(0, ry, 0);
      _q.setFromEuler(_e);
      _s.set(1, 1, 1);
      inst.mats.push(_m.clone().compose(_p, _q, _s));
    };
    add(key);
    if (g.locked) add("gateBars");
    else if (key !== "gatePlaque") glowPoints.push({ x: g.x, z: g.z, y: 2.1, color: key === "gateMoon" ? "#ffb4c8" : "#ffb060", intensity: 1.4 });
    void W0;
  }

  // --- instanced props
  for (const [, inst] of instances) {
    inst.def.parts.forEach((part) => {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, inst.mats.length);
      for (let i = 0; i < inst.mats.length; i++) {
        mesh.setMatrixAt(i, _m.multiplyMatrices(inst.mats[i], part.m));
      }
      mesh.castShadow = quality.shadows && part.shadow !== false;
      mesh.receiveShadow = quality.shadows;
      mesh.frustumCulled = true;
      group.add(mesh);
    });
  }

  return {
    group,
    theme,
    glowPoints,
    highlights,
    gates,
    dispose: () => disposeObject(group),
  };
}

/** A single, non-instanced copy of a prop (for entities and battle dressing). */
export function propObject(key: string): THREE.Group {
  const g = new THREE.Group();
  const d = prop(key);
  if (!d) return g;
  for (const part of d.parts) {
    const m = new THREE.Mesh(part.geo, part.mat);
    m.applyMatrix4(part.m);
    m.castShadow = part.shadow !== false;
    g.add(m);
  }
  return g;
}
