// ---------------------------------------------------------------------------
// The prop catalogue: every tile character becomes a small low-poly assembly.
//
// A prop is a list of PARTS (geometry + material + local matrix). The map
// builder gathers every instance of every part across the map and draws each
// part as ONE InstancedMesh, so a bamboo forest of 200 stalks costs 3 draw
// calls, not 600. Props must therefore be made only of shared cached
// geometries/materials (see materials.ts).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { C, G, mat, glow } from "./materials";

export type Part = {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  m: THREE.Matrix4;
  shadow?: boolean;
};

export type PropDef = {
  parts: Part[];
  /** Random yaw per instance. */
  spin?: boolean;
  /** Random uniform scale range per instance. */
  scale?: [number, number];
  /** Random position jitter (units) per instance. */
  jitter?: number;
  /** Several copies per cell with jitter (grass, bamboo). */
  copies?: number;
};

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

function P(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number, y: number, z: number,
  opts: { rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number; shadow?: boolean } = {}
): Part {
  tmpP.set(x, y, z);
  tmpQ.setFromEuler(new THREE.Euler(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0));
  tmpS.set(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
  return { geo, mat: material, m: tmpM.clone().compose(tmpP, tmpQ, tmpS), shadow: opts.shadow ?? true };
}

// --------------------------------------------------------------- catalogue

const defs: Record<string, () => PropDef> = {
  // ---------------------------------------------------------------- nature
  tree: () => ({
    spin: true, scale: [0.85, 1.15], jitter: 0.12,
    parts: [
      P(G.cyl(0.09, 0.14, 0.9, 6), mat(C.wood1), 0, 0.45, 0),
      P(G.ico(0.52, 0), mat(C.leaf1), 0, 1.25, 0),
      P(G.ico(0.4, 0), mat(C.leaf2), 0.1, 1.7, -0.05),
      P(G.ico(0.3, 0), mat(C.leafDark), -0.22, 1.0, 0.18),
    ],
  }),
  pine: () => ({
    spin: true, scale: [0.9, 1.2], jitter: 0.1,
    parts: [
      P(G.cyl(0.08, 0.12, 0.7, 6), mat(C.wood1), 0, 0.35, 0),
      P(G.cone(0.55, 0.9, 7), mat(C.leafDark), 0, 0.95, 0),
      P(G.cone(0.42, 0.8, 7), mat(C.leaf1), 0, 1.45, 0),
      P(G.cone(0.28, 0.6, 7), mat(C.leaf2), 0, 1.9, 0),
    ],
  }),
  cherry: () => ({
    spin: true, scale: [0.9, 1.15], jitter: 0.1,
    parts: [
      P(G.cyl(0.08, 0.13, 0.9, 6), mat("#4a3028"), 0, 0.45, 0),
      P(G.ico(0.5, 0), mat(C.petal1), 0, 1.25, 0),
      P(G.ico(0.38, 0), mat(C.petal2), 0.18, 1.6, 0.1),
      P(G.ico(0.32, 0), mat(C.petal2), -0.25, 1.45, -0.12),
    ],
  }),
  bamboo: () => ({
    copies: 3, jitter: 0.3, scale: [0.85, 1.25],
    parts: [
      P(G.cyl(0.045, 0.055, 2.6, 5), mat(C.bamboo1), 0, 1.3, 0),
      P(G.cyl(0.06, 0.06, 0.05, 5), mat(C.bambooDark), 0, 0.8, 0),
      P(G.cyl(0.06, 0.06, 0.05, 5), mat(C.bambooDark), 0, 1.6, 0),
      P(G.box(0.5, 0.02, 0.12), mat(C.bamboo2), 0.22, 2.2, 0, { ry: 0.4, rz: 0.3, shadow: false }),
      P(G.box(0.45, 0.02, 0.1), mat(C.bamboo2), -0.2, 2.5, 0.1, { ry: -0.9, rz: -0.25, shadow: false }),
    ],
  }),
  bambooWall: () => ({
    parts: [
      ...[-0.35, -0.12, 0.12, 0.35].map((x) => P(G.cyl(0.06, 0.07, 2.2, 5), mat(C.bamboo1), x, 1.1, 0)),
      P(G.box(1, 0.06, 0.08), mat(C.wood2), 0, 0.6, 0),
      P(G.box(1, 0.06, 0.08), mat(C.wood2), 0, 1.5, 0),
    ],
  }),
  grass: () => ({
    copies: 4, jitter: 0.35, spin: true, scale: [0.7, 1.2],
    parts: [
      P(G.cone(0.08, 0.5, 4), mat(C.grass2), 0, 0.25, 0, { rz: 0.15, shadow: false }),
      P(G.cone(0.07, 0.42, 4), mat(C.grass3), 0.1, 0.21, 0.06, { rz: -0.2, shadow: false }),
    ],
  }),
  flower: () => ({
    copies: 3, jitter: 0.3, spin: true,
    parts: [
      P(G.cyl(0.015, 0.015, 0.3, 4), mat(C.leaf2), 0, 0.15, 0, { shadow: false }),
      P(G.sphere(0.06, 6), mat(C.red), 0, 0.32, 0, { shadow: false }),
      P(G.sphere(0.025, 5), mat(C.brightgold), 0, 0.37, 0, { shadow: false }),
    ],
  }),
  bush: () => ({
    spin: true, scale: [0.9, 1.1],
    parts: [
      P(G.ico(0.34, 0), mat(C.leaf1), 0, 0.3, 0),
      P(G.ico(0.26, 0), mat(C.leaf2), 0.2, 0.36, 0.1),
      P(G.ico(0.22, 0), mat(C.leafDark), -0.2, 0.26, 0.15),
    ],
  }),
  boulder: () => ({
    spin: true, scale: [0.85, 1.2], jitter: 0.08,
    parts: [
      P(G.ico(0.5, 0), mat(C.stone1), 0, 0.4, 0, { sy: 0.8 }),
      P(G.ico(0.3, 0), mat(C.stone2), 0.3, 0.3, 0.2, { sy: 0.7 }),
    ],
  }),
  peak: () => ({
    spin: true, scale: [0.8, 1.6], jitter: 0.3,
    parts: [
      P(G.cone(1.1, 3.6, 6), mat("#6c6675"), 0, 1.8, 0),
      P(G.cone(0.42, 1.2, 6), mat("#eef2f8"), 0, 3.0, 0),
      P(G.cone(0.8, 2.2, 5), mat("#5a5563"), 0.9, 1.1, 0.4),
    ],
  }),
  templeWall: () => ({
    parts: [
      P(G.box(1, 1.9, 1), mat("#4a1c1c"), 0, 0.95, 0),
      P(G.box(1.04, 0.14, 1.04), mat(C.gold), 0, 1.9, 0),
      P(G.box(1.04, 0.12, 1.04), mat("#2a0e0e"), 0, 0.06, 0),
      P(G.cyl(0.2, 0.22, 1.9, 8), mat(C.red), 0, 0.95, 0, { sx: 2.8, sz: 2.8 }),
    ],
  }),
  caveWall: () => ({
    parts: [
      P(G.hex(0.6, 2.4), mat(C.cave2), 0, 1.2, 0),
      P(G.ico(0.4, 0), mat(C.cave3), 0.1, 2.3, 0.05),
    ],
  }),
  crystal: () => ({
    spin: true, scale: [0.6, 1.1], jitter: 0.2,
    parts: [
      P(G.cone(0.1, 0.5, 5), glow("#8e7cff"), 0, 0.25, 0, { shadow: false }),
      P(G.cone(0.06, 0.32, 5), glow("#c4b8ff"), 0.14, 0.16, 0.08, { rz: -0.4, shadow: false }),
    ],
  }),
  petalGround: () => ({
    parts: [P(G.box(1, 0.02, 1), mat(C.petal2), 0, 0.01, 0, { shadow: false })],
  }),
  water: () => ({
    parts: [P(G.box(1, 0.08, 1), mat(C.water2, { opacity: 0.85 }), 0, -0.06, 0, { shadow: false })],
  }),
  pond: () => ({
    parts: [
      P(G.box(1, 0.08, 1), mat(C.water1, { opacity: 0.85 }), 0, -0.06, 0, { shadow: false }),
      P(G.cyl(0.14, 0.14, 0.03, 6), mat(C.leaf2), 0.2, 0.0, -0.15, { shadow: false }),
    ],
  }),
  bridge: () => ({
    parts: [
      P(G.box(1, 0.1, 1), mat(C.wood2), 0, 0.05, 0),
      P(G.box(0.08, 0.5, 1), mat(C.wood1), -0.46, 0.3, 0),
      P(G.box(0.08, 0.5, 1), mat(C.wood1), 0.46, 0.3, 0),
      P(G.box(0.1, 0.05, 1), mat(C.gold), -0.46, 0.55, 0, { shadow: false }),
      P(G.box(0.1, 0.05, 1), mat(C.gold), 0.46, 0.55, 0, { shadow: false }),
    ],
  }),
  dirtMound: () => ({
    parts: [
      P(G.ico(0.3, 0), mat(C.dirt1), 0, 0.05, 0, { sy: 0.45 }),
      P(G.ico(0.18, 0), mat(C.dirt2), 0.15, 0.08, 0.1, { sy: 0.5 }),
    ],
  }),
  pawPrints: () => ({
    parts: [
      ...[[-0.2, -0.3], [0.15, -0.05], [-0.15, 0.2], [0.2, 0.4]].map(([x, z]) =>
        P(G.cyl(0.07, 0.07, 0.02, 6), mat("#2a1a1a"), x, 0.012, z, { shadow: false })
      ),
    ],
  }),

  // ------------------------------------------------------------ structures
  wall: () => ({
    parts: [
      P(G.box(1, 1.7, 1), mat(C.plaster), 0, 0.85, 0),
      P(G.box(1.02, 0.14, 1.02), mat(C.wood1), 0, 1.7, 0),
      P(G.box(1.02, 0.1, 1.02), mat(C.wood1), 0, 0.05, 0),
    ],
  }),
  stoneWall: () => ({
    parts: [
      P(G.box(1, 1.4, 1), mat(C.stone1), 0, 0.7, 0),
      P(G.box(1.04, 0.16, 1.04), mat(C.stone2), 0, 1.45, 0),
    ],
  }),
  house: () => ({
    parts: [
      P(G.box(1, 1.6, 1), mat(C.plaster), 0, 0.8, 0),
      P(G.box(1.1, 0.25, 1.1), mat(C.roofDark), 0, 1.7, 0),
      P(G.cone(0.85, 0.7, 4), mat(C.roof), 0, 2.15, 0, { ry: Math.PI / 4 }),
      P(G.box(0.06, 1.6, 0.06), mat(C.wood1), -0.48, 0.8, -0.49),
      P(G.box(0.06, 1.6, 0.06), mat(C.wood1), 0.48, 0.8, -0.49),
    ],
  }),
  flatBlock: () => ({
    parts: [
      P(G.box(1, 2.6, 1), mat("#cfc4b2"), 0, 1.3, 0),
      P(G.box(0.5, 0.4, 0.05), glow("#ffd98a", 0.9), 0, 1.0, 0.5, { shadow: false }),
      P(G.box(0.5, 0.4, 0.05), glow("#ffe6b0", 0.7), 0, 1.9, 0.5, { shadow: false }),
      P(G.box(1.04, 0.14, 1.04), mat("#8a7f6e"), 0, 2.65, 0),
    ],
  }),
  door: () => ({
    parts: [
      P(G.box(0.1, 1.5, 0.12), mat(C.wood1), -0.42, 0.75, 0),
      P(G.box(0.1, 1.5, 0.12), mat(C.wood1), 0.42, 0.75, 0),
      P(G.box(0.95, 0.12, 0.14), mat(C.wood1), 0, 1.5, 0),
      P(G.box(0.14, 0.14, 0.14), glow(C.lanternGlow), 0, 1.72, 0, { shadow: false }),
    ],
  }),
  doorway: () => ({
    parts: [
      P(G.box(0.12, 1.6, 0.9), mat(C.wood1), -0.44, 0.8, 0),
      P(G.box(0.12, 1.6, 0.9), mat(C.wood1), 0.44, 0.8, 0),
      P(G.box(1, 0.12, 0.9), mat(C.wood1), 0, 1.66, 0),
      P(G.box(0.76, 1.55, 0.04), mat("#3a2418"), 0, 0.78, 0, { shadow: false }),
      P(G.box(0.76, 0.05, 0.05), glow("#ffd9a8", 0.8), 0, 1.58, 0, { shadow: false }),
    ],
  }),
  dogBowl: () => ({
    parts: [
      P(G.cyl(0.16, 0.12, 0.08, 10), mat(C.red), 0, 0.04, 0),
      P(G.cyl(0.13, 0.13, 0.03, 10), mat("#b89a6a"), 0, 0.085, 0, { shadow: false }),
      P(G.box(0.08, 0.03, 0.03), mat(C.brightgold), 0, 0.09, -0.12, { shadow: false }),
    ],
  }),
  lanternPost: () => ({
    parts: [
      P(G.cyl(0.05, 0.07, 1.9, 6), mat(C.wood1), 0, 0.95, 0),
      P(G.box(0.5, 0.05, 0.05), mat(C.wood1), 0.2, 1.85, 0),
      P(G.box(0.26, 0.34, 0.26), glow("#d9402a", 0.95), 0.4, 1.62, 0, { shadow: false }),
      P(G.box(0.3, 0.05, 0.3), mat(C.gold), 0.4, 1.82, 0, { shadow: false }),
      P(G.box(0.3, 0.05, 0.3), mat(C.gold), 0.4, 1.43, 0, { shadow: false }),
    ],
  }),
  lanternPostDark: () => ({
    parts: [
      P(G.cyl(0.05, 0.07, 1.9, 6), mat(C.wood1), 0, 0.95, 0),
      P(G.box(0.5, 0.05, 0.05), mat(C.wood1), 0.2, 1.85, 0),
      P(G.box(0.26, 0.34, 0.26), mat("#5a2a2a"), 0.4, 1.62, 0, { shadow: false }),
      P(G.box(0.3, 0.05, 0.3), mat(C.gold), 0.4, 1.82, 0, { shadow: false }),
      P(G.box(0.3, 0.05, 0.3), mat(C.gold), 0.4, 1.43, 0, { shadow: false }),
    ],
  }),
  stall: () => ({
    parts: [
      P(G.box(0.9, 0.5, 0.6), mat(C.wood2), 0, 0.25, 0),
      P(G.box(0.08, 1.5, 0.08), mat(C.wood1), -0.42, 0.75, 0.25),
      P(G.box(0.08, 1.5, 0.08), mat(C.wood1), 0.42, 0.75, 0.25),
      P(G.box(1.0, 0.06, 0.9), mat(C.red), 0, 1.5, 0, { rx: 0.2 }),
      P(G.box(0.2, 0.15, 0.2), mat(C.brightgold), -0.2, 0.58, 0.1, { shadow: false }),
      P(G.box(0.18, 0.12, 0.18), mat(C.petal1), 0.2, 0.56, 0.05, { shadow: false }),
    ],
  }),
  banner: () => ({
    parts: [
      P(G.cyl(0.04, 0.05, 2.2, 6), mat(C.wood1), 0, 1.1, 0),
      P(G.box(0.5, 1.1, 0.03), mat(C.red), 0.28, 1.5, 0),
      P(G.box(0.3, 0.08, 0.04), mat(C.gold), 0.28, 1.2, 0, { shadow: false }),
    ],
  }),
  sign: () => ({
    parts: [
      P(G.cyl(0.04, 0.05, 1.0, 6), mat(C.wood1), 0, 0.5, 0),
      P(G.box(0.7, 0.4, 0.06), mat(C.wood2), 0, 0.95, 0),
      P(G.box(0.5, 0.04, 0.07), mat(C.brightgold), 0, 1.0, 0, { shadow: false }),
      P(G.box(0.35, 0.04, 0.07), mat(C.brightgold), -0.05, 0.9, 0, { shadow: false }),
    ],
  }),
  statue: () => ({
    parts: [
      P(G.box(0.7, 0.3, 0.7), mat(C.stone3), 0, 0.15, 0),
      P(G.hex(0.3, 0.9), mat(C.stone1), 0, 0.75, 0),
      P(G.sphere(0.2, 8), mat(C.stone2), 0, 1.4, 0),
      P(G.box(0.5, 0.15, 0.3), mat(C.stone1), 0, 1.1, 0),
    ],
  }),
  statueLit: () => ({
    parts: [
      P(G.box(0.7, 0.3, 0.7), mat(C.stone3), 0, 0.15, 0),
      P(G.hex(0.3, 0.9), mat(C.stone1), 0, 0.75, 0),
      P(G.sphere(0.2, 8), mat(C.stone2), 0, 1.4, 0),
      P(G.box(0.5, 0.15, 0.3), mat(C.stone1), 0, 1.1, 0),
      P(G.box(0.06, 0.04, 0.04), glow(C.brightgold), -0.07, 1.43, -0.19, { shadow: false }),
      P(G.box(0.06, 0.04, 0.04), glow(C.brightgold), 0.07, 1.43, -0.19, { shadow: false }),
    ],
  }),
  plate: () => ({
    parts: [P(G.box(0.7, 0.08, 0.7), mat(C.stone2), 0, 0.04, 0), P(G.box(0.5, 0.02, 0.5), mat(C.stone3), 0, 0.09, 0, { shadow: false })],
  }),
  platePressed: () => ({
    parts: [P(G.box(0.7, 0.03, 0.7), mat(C.stone3), 0, 0.015, 0), P(G.box(0.5, 0.02, 0.5), glow(C.gold, 0.8), 0, 0.03, 0, { shadow: false })],
  }),
  gate: () => ({
    parts: [
      P(G.box(0.12, 1.9, 0.2), mat(C.stone3), -0.44, 0.95, 0),
      P(G.box(0.12, 1.9, 0.2), mat(C.stone3), 0.44, 0.95, 0),
      P(G.box(1, 0.12, 0.3), mat(C.red), 0, 1.95, 0),
      P(G.box(0.8, 1.7, 0.06), mat(C.charcoal), 0, 0.88, 0),
      P(G.box(0.1, 1.5, 0.08), mat(C.gold), 0, 0.88, -0.03, { shadow: false }),
    ],
  }),
  brazier: () => ({
    parts: [
      P(G.hex(0.3, 0.3), mat(C.stone3), 0, 0.15, 0),
      P(G.cyl(0.25, 0.15, 0.4, 8), mat("#3a2a1a"), 0, 0.5, 0),
      P(G.cone(0.2, 0.5, 6), glow(C.flame), 0, 0.9, 0, { shadow: false }),
      P(G.cone(0.1, 0.35, 5), glow("#ffd98a"), 0.05, 1.0, 0.03, { shadow: false }),
    ],
  }),
  brazierCold: () => ({
    parts: [
      P(G.hex(0.3, 0.3), mat(C.stone3), 0, 0.15, 0),
      P(G.cyl(0.25, 0.15, 0.4, 8), mat("#3a2a1a"), 0, 0.5, 0),
    ],
  }),
  scrollStand: () => ({
    parts: [
      P(G.hex(0.3, 0.6), mat(C.stone1), 0, 0.3, 0),
      P(G.cyl(0.07, 0.07, 0.5, 8), mat(C.offwhite), 0, 0.68, 0, { rz: Math.PI / 2 }),
      P(G.cyl(0.04, 0.04, 0.6, 6), mat(C.wood1), 0, 0.68, 0, { rz: Math.PI / 2 }),
    ],
  }),
  sacredLantern: () => ({
    parts: [
      P(G.hex(0.45, 0.4), mat(C.stone3), 0, 0.2, 0),
      P(G.cyl(0.08, 0.1, 1.2, 6), mat(C.gold), 0, 1.0, 0),
      P(G.box(0.6, 0.7, 0.6), mat("#5a2a2a"), 0, 1.9, 0),
      P(G.box(0.66, 0.08, 0.66), mat(C.gold), 0, 2.3, 0, { shadow: false }),
      P(G.box(0.66, 0.08, 0.66), mat(C.gold), 0, 1.5, 0, { shadow: false }),
      P(G.cone(0.3, 0.3, 4), mat(C.gold), 0, 2.48, 0, { ry: Math.PI / 4 }),
    ],
  }),
  sacredLanternLit: () => ({
    parts: [
      P(G.hex(0.45, 0.4), mat(C.stone3), 0, 0.2, 0),
      P(G.cyl(0.08, 0.1, 1.2, 6), mat(C.gold), 0, 1.0, 0),
      P(G.box(0.6, 0.7, 0.6), glow("#ff8a3c"), 0, 1.9, 0, { shadow: false }),
      P(G.box(0.66, 0.08, 0.66), mat(C.gold), 0, 2.3, 0, { shadow: false }),
      P(G.box(0.66, 0.08, 0.66), mat(C.gold), 0, 1.5, 0, { shadow: false }),
      P(G.cone(0.3, 0.3, 4), mat(C.gold), 0, 2.48, 0, { ry: Math.PI / 4 }),
    ],
  }),
  stele: () => ({
    parts: [
      P(G.box(0.5, 0.15, 0.4), mat(C.stone3), 0, 0.07, 0),
      P(G.box(0.4, 1.1, 0.12), mat(C.stone1), 0, 0.65, 0),
      P(G.box(0.26, 0.6, 0.02), mat(C.stone3), 0, 0.7, -0.07, { shadow: false }),
    ],
  }),
  chest: () => ({
    spin: false,
    parts: [
      P(G.box(0.6, 0.35, 0.42), mat(C.wood2), 0, 0.18, 0),
      P(G.box(0.62, 0.18, 0.44), mat(C.wood1), 0, 0.44, 0),
      P(G.box(0.1, 0.12, 0.05), mat(C.gold), 0, 0.36, -0.23, { shadow: false }),
    ],
  }),
  viewpoint: () => ({
    parts: [
      P(G.box(0.8, 0.12, 0.8), mat(C.stone2), 0, 0.06, 0),
      P(G.cyl(0.04, 0.04, 0.9, 6), mat(C.wood1), -0.3, 0.55, 0.3),
      P(G.cyl(0.04, 0.04, 0.9, 6), mat(C.wood1), 0.3, 0.55, 0.3),
      P(G.box(0.7, 0.05, 0.05), mat(C.wood1), 0, 1.0, 0.3),
    ],
  }),
  incense: () => ({
    parts: [
      P(G.box(0.5, 0.5, 0.3), mat("#6a4a2a"), 0, 0.25, 0),
      P(G.cyl(0.015, 0.015, 0.5, 4), mat("#3a2a1a"), -0.08, 0.7, 0, { shadow: false }),
      P(G.cyl(0.015, 0.015, 0.5, 4), mat("#3a2a1a"), 0.08, 0.72, 0.03, { shadow: false }),
      P(G.sphere(0.025, 5), glow(C.flame), -0.08, 0.95, 0, { shadow: false }),
      P(G.sphere(0.025, 5), glow(C.flame), 0.08, 0.97, 0.03, { shadow: false }),
    ],
  }),
  toyBall: () => ({
    parts: [P(G.sphere(0.14, 8), mat(C.red), 0, 0.14, 0), P(G.box(0.1, 0.03, 0.3), mat(C.brightgold), 0, 0.26, 0, { shadow: false })],
  }),
  sparkleBush: () => ({
    spin: true,
    parts: [
      P(G.ico(0.32, 0), mat(C.leaf1), 0, 0.28, 0),
      P(G.ico(0.22, 0), mat(C.leaf2), 0.18, 0.34, 0.1),
      P(G.sphere(0.06, 6), glow(C.brightgold), 0.05, 0.62, 0.05, { shadow: false }),
    ],
  }),

  // ---------------------------------------------------------------- indoor
  bed: () => ({
    parts: [
      P(G.box(0.9, 0.3, 1.0), mat(C.wood2), 0, 0.15, 0),
      P(G.box(0.84, 0.16, 0.9), mat(C.offwhite), 0, 0.38, 0),
      P(G.box(0.84, 0.12, 0.5), mat(C.crimson), 0, 0.43, -0.2),
      P(G.box(0.5, 0.1, 0.25), mat(C.brightgold), 0, 0.5, 0.3, { shadow: false }),
      P(G.box(0.9, 0.5, 0.08), mat(C.wood1), 0, 0.5, 0.5),
    ],
  }),
  bookshelf: () => ({
    parts: [
      P(G.box(0.9, 1.5, 0.4), mat(C.wood1), 0, 0.75, 0),
      P(G.box(0.8, 0.05, 0.36), mat(C.wood2), 0, 0.5, -0.02, { shadow: false }),
      P(G.box(0.8, 0.05, 0.36), mat(C.wood2), 0, 1.0, -0.02, { shadow: false }),
      P(G.box(0.14, 0.32, 0.2), mat(C.red), -0.25, 0.68, -0.08, { shadow: false }),
      P(G.box(0.14, 0.36, 0.2), mat(C.gold), -0.05, 0.7, -0.08, { shadow: false }),
      P(G.box(0.14, 0.3, 0.2), mat(C.green), 0.15, 0.67, -0.08, { shadow: false }),
      P(G.box(0.14, 0.34, 0.2), mat(C.offwhite), 0.3, 1.19, -0.08, { shadow: false }),
      P(G.box(0.14, 0.3, 0.2), mat(C.crimson), -0.2, 1.17, -0.08, { shadow: false }),
    ],
  }),
  desk: () => ({
    parts: [
      P(G.box(0.9, 0.06, 0.6), mat(C.wood2), 0, 0.6, 0),
      P(G.box(0.06, 0.6, 0.06), mat(C.wood1), -0.4, 0.3, -0.25),
      P(G.box(0.06, 0.6, 0.06), mat(C.wood1), 0.4, 0.3, -0.25),
      P(G.box(0.06, 0.6, 0.06), mat(C.wood1), -0.4, 0.3, 0.25),
      P(G.box(0.06, 0.6, 0.06), mat(C.wood1), 0.4, 0.3, 0.25),
      P(G.box(0.3, 0.02, 0.22), mat(C.offwhite), -0.15, 0.64, 0.05, { shadow: false }),
      P(G.cyl(0.05, 0.04, 0.08, 6), mat(C.charcoal), 0.25, 0.67, -0.1, { shadow: false }),
    ],
  }),
  tv: () => ({
    parts: [
      P(G.box(0.8, 0.4, 0.5), mat(C.wood1), 0, 0.2, 0),
      P(G.box(0.7, 0.5, 0.1), mat(C.charcoal), 0, 0.68, 0),
      P(G.box(0.6, 0.4, 0.02), glow("#2b5171"), 0, 0.68, -0.06, { shadow: false }),
    ],
  }),
  rug: () => ({
    parts: [
      P(G.box(0.96, 0.02, 0.96), mat(C.burgundy), 0, 0.012, 0, { shadow: false }),
      P(G.box(0.7, 0.01, 0.7), mat(C.crimson), 0, 0.03, 0, { shadow: false }),
      P(G.box(0.3, 0.01, 0.3), mat(C.gold), 0, 0.04, 0, { shadow: false }),
    ],
  }),
  pillar: () => ({
    parts: [
      P(G.box(0.7, 0.2, 0.7), mat(C.stone3), 0, 0.1, 0),
      P(G.cyl(0.22, 0.26, 2.4, 8), mat(C.red), 0, 1.4, 0),
      P(G.box(0.7, 0.2, 0.7), mat(C.gold), 0, 2.7, 0),
    ],
  }),

  // ---------------------------------------------------------------- F-1205
  sofa: () => ({
    parts: [
      P(G.box(1, 0.4, 0.8), mat("#3a4a6a"), 0, 0.2, 0),
      P(G.box(1, 0.5, 0.22), mat("#2e3c58"), 0, 0.6, 0.29),
      P(G.box(0.9, 0.12, 0.55), mat("#4a5c80"), 0, 0.46, -0.08, { shadow: false }),
    ],
  }),
  sofaArm: () => ({
    parts: [P(G.box(0.2, 0.5, 0.8), mat("#2e3c58"), 0, 0.25, 0)],
  }),
  guitarStand: () => ({
    parts: [
      P(G.cyl(0.03, 0.03, 0.6, 5), mat(C.charcoal), 0, 0.3, 0),
      P(G.box(0.4, 0.04, 0.4), mat(C.charcoal), 0, 0.02, 0),
      P(G.box(0.34, 0.5, 0.08), mat(C.white), 0, 0.45, -0.1, { rz: 0.12 }),
      P(G.box(0.08, 0.6, 0.05), mat("#d8d4cc"), 0.08, 0.98, -0.1, { rz: 0.12 }),
      P(G.box(0.14, 0.14, 0.03), mat(C.charcoal), -0.02, 0.47, -0.15, { shadow: false }),
    ],
  }),
  poster: () => ({
    parts: [
      P(G.box(0.6, 0.8, 0.03), mat(C.crimson), 0, 1.2, -0.47, { shadow: false }),
      P(G.box(0.4, 0.1, 0.04), mat(C.brightgold), 0, 1.4, -0.48, { shadow: false }),
      P(G.box(0.44, 0.5, 0.03), mat(C.offwhite), 0, 1.25, -0.49, { shadow: false }),
      P(G.box(0.3, 0.4, 0.04), glow("#2b4a6a"), 0.02, 1.0, -0.49, { shadow: false }),
    ],
  }),
  window: () => ({
    parts: [
      P(G.box(0.8, 0.8, 0.06), mat(C.wood1), 0, 1.15, -0.47),
      P(G.box(0.7, 0.7, 0.04), glow("#9fc4e8", 0.95), 0, 1.15, -0.5, { shadow: false }),
      P(G.box(0.04, 0.7, 0.05), mat(C.wood1), 0, 1.15, -0.51, { shadow: false }),
      P(G.box(0.7, 0.04, 0.05), mat(C.wood1), 0, 1.15, -0.51, { shadow: false }),
    ],
  }),
  counter: () => ({
    parts: [
      P(G.box(1, 0.8, 0.7), mat("#8a7760"), 0, 0.4, 0),
      P(G.box(1.04, 0.06, 0.74), mat("#d8d0c0"), 0, 0.83, 0),
      P(G.cyl(0.14, 0.12, 0.12, 8), mat("#8a8a8a"), 0.2, 0.92, 0, { shadow: false }),
      P(G.box(0.2, 0.1, 0.2), mat(C.offwhite), -0.25, 0.9, 0.1, { shadow: false }),
    ],
  }),
  fridge: () => ({
    parts: [
      P(G.box(0.8, 1.7, 0.7), mat("#dfe3e6"), 0, 0.85, 0),
      P(G.box(0.04, 0.5, 0.05), mat("#8a8a8a"), 0.3, 1.1, -0.36, { shadow: false }),
      P(G.box(0.3, 0.2, 0.02), mat(C.brightgold), -0.15, 1.3, -0.36, { shadow: false }),
    ],
  }),
  weights: () => ({
    parts: [
      P(G.box(0.9, 0.08, 0.5), mat(C.charcoal), 0, 0.04, 0),
      P(G.cyl(0.02, 0.02, 0.7, 6), mat("#9a9aa0"), -0.2, 0.2, 0, { rz: Math.PI / 2 }),
      P(G.cyl(0.11, 0.11, 0.08, 10), mat("#2a2a30"), -0.5, 0.2, 0, { rz: Math.PI / 2 }),
      P(G.cyl(0.11, 0.11, 0.08, 10), mat("#2a2a30"), 0.1, 0.2, 0, { rz: Math.PI / 2 }),
      P(G.cyl(0.02, 0.02, 0.4, 6), mat("#9a9aa0"), 0.3, 0.13, 0.15, { rz: Math.PI / 2 }),
      P(G.cyl(0.07, 0.07, 0.06, 8), mat("#2a2a30"), 0.12, 0.13, 0.15, { rz: Math.PI / 2 }),
      P(G.cyl(0.07, 0.07, 0.06, 8), mat("#2a2a30"), 0.48, 0.13, 0.15, { rz: Math.PI / 2 }),
    ],
  }),
  table: () => ({
    parts: [
      P(G.box(0.9, 0.06, 0.9), mat(C.wood3), 0, 0.55, 0),
      P(G.cyl(0.05, 0.08, 0.55, 6), mat(C.wood1), 0, 0.27, 0),
      P(G.box(0.3, 0.02, 0.4), mat(C.offwhite), 0.15, 0.59, -0.1, { shadow: false }),
      P(G.cyl(0.06, 0.05, 0.1, 8), mat(C.white), -0.2, 0.63, 0.15, { shadow: false }),
    ],
  }),
  plant: () => ({
    parts: [
      P(G.cyl(0.16, 0.12, 0.3, 7), mat("#9a5a3a"), 0, 0.15, 0),
      P(G.ico(0.26, 0), mat(C.leaf1), 0, 0.5, 0),
      P(G.ico(0.18, 0), mat(C.leaf2), 0.14, 0.66, 0.1),
    ],
  }),
  flatWall: () => ({
    parts: [
      P(G.box(1, 1.7, 1), mat("#ead9c3"), 0, 0.85, 0),
      P(G.box(1.02, 0.12, 1.02), mat("#6b5a4a"), 0, 0.06, 0),
    ],
  }),
  flatDoor: () => ({
    parts: [
      P(G.box(0.1, 1.6, 0.12), mat("#6b5a4a"), -0.42, 0.8, 0),
      P(G.box(0.1, 1.6, 0.12), mat("#6b5a4a"), 0.42, 0.8, 0),
      P(G.box(0.95, 0.1, 0.14), mat("#6b5a4a"), 0, 1.6, 0),
      P(G.box(0.3, 0.12, 0.03), mat(C.brightgold), 0, 1.75, -0.08, { shadow: false }),
    ],
  }),
};

const cache = new Map<string, PropDef>();
export function prop(key: string): PropDef | null {
  let d = cache.get(key);
  if (!d) {
    const make = defs[key];
    if (!make) return null;
    d = make();
    cache.set(key, d);
  }
  return d;
}

export const PROP_KEYS = Object.keys(defs);
