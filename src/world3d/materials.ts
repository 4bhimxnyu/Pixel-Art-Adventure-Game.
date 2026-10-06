// ---------------------------------------------------------------------------
// Shared palette, materials and tiny geometry helpers for the 3D world.
//
// Everything is stylised, low-poly and toon-lit: a 3-step gradient map on
// MeshToonMaterial gives the cel-shaded wuxia look at almost zero cost. All
// materials are cached by colour so the whole world shares a few dozen.
// ---------------------------------------------------------------------------

import * as THREE from "three";

/** The theme palette, carried over from the pixel renderer. */
export const C = {
  black: "#0a0507",
  charcoal: "#1a0f12",
  crimson: "#8f1a24",
  red: "#b3252f",
  burgundy: "#7c141f",
  gold: "#d9b45b",
  brightgold: "#f2dfa6",
  offwhite: "#f7e6c8",
  green: "#7ddca4",
  white: "#f2f2ee",

  grass1: "#3f6b3e",
  grass2: "#4d7d49",
  grass3: "#35593a",
  dirt1: "#7a6246",
  dirt2: "#8b7152",
  stone1: "#6c6675",
  stone2: "#807a8a",
  stone3: "#4a4552",
  water1: "#2d5c82",
  water2: "#3e7aa6",
  wood1: "#5a3d2c",
  wood2: "#7a5538",
  wood3: "#9a6f49",
  bamboo1: "#5f944a",
  bamboo2: "#7fb75f",
  bambooDark: "#3f6b32",
  petal1: "#d9859c",
  petal2: "#eeb0c3",
  cave1: "#2b2434",
  cave2: "#3a3146",
  cave3: "#4a3f5c",
  leaf1: "#3f7a44",
  leaf2: "#5c9b5a",
  leafDark: "#2d5a35",
  roof: "#7c2a2a",
  roofDark: "#5a1c1c",
  plaster: "#e8dcc4",
  skin: "#e8b48c",
  lanternGlow: "#ffb347",
  flame: "#ff9a3c",
} as const;

let gradient: THREE.DataTexture | null = null;
export function toonGradient() {
  if (gradient) return gradient;
  // 4 shade steps: deep shadow, mid, lit, highlight
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const matCache = new Map<string, THREE.Material>();

/** Toon-lit solid colour. Cached. */
export function mat(color: string, opts: { emissive?: string; emissiveIntensity?: number; opacity?: number; side?: THREE.Side } = {}) {
  const key = `t|${color}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? ""}|${opts.opacity ?? ""}|${opts.side ?? ""}`;
  let m = matCache.get(key);
  if (!m) {
    const t = new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      gradientMap: toonGradient(),
      emissive: new THREE.Color(opts.emissive ?? "#000000"),
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    m = t;
    matCache.set(key, m);
  }
  return m;
}

/** Unlit glow (lantern paper, fire, crystal). Cached. */
export function glow(color: string, opacity = 1) {
  const key = `g|${color}|${opacity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: opacity < 1, opacity });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cachedGeo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export const G = {
  box: (w: number, h: number, d: number) => cachedGeo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt: number, rb: number, h: number, seg = 8) =>
    cachedGeo(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 6) => cachedGeo(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  sphere: (r: number, seg = 8) => cachedGeo(`sph${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2))),
  ico: (r: number, detail = 0) => cachedGeo(`ico${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)),
  plane: (w: number, h: number) => cachedGeo(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
  /** Hexagonal prism, a nicer low-poly rock/pillar than a box. */
  hex: (r: number, h: number) => cachedGeo(`hex${r},${h}`, () => new THREE.CylinderGeometry(r, r * 1.1, h, 6)),
};

/** Deterministic hash → 0..1, so props never shimmer between map reloads. */
export function hash01(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 10000) / 10000;
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((m as any).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
    // Geometries and materials are shared caches; never dispose them here.
  });
  root.removeFromParent();
}

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
