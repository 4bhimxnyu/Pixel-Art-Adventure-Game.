// ---------------------------------------------------------------------------
// Pooled "feel" effects. Everything here is allocated once per map and reused:
//
//   FxPool      one Points draw call for every short-lived particle in the
//               region (footstep dust, dash landing, impact sparks, hearts,
//               heal spirals, brazier embers, gate dissolve, chest sparkle).
//   DashStreak  one InstancedMesh of thin wind lines that trail a dash.
//   FocusRing   the soft gold ring + glow under whatever the player can use.
//   NameLabels  up to six camera-facing name tags, fading in within reach.
//   CrackDecal  a ground crack under a critical hit.
//
// No per-frame allocations: typed arrays, swap-remove, cached geometry.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { G, glow } from "./materials";

// ------------------------------------------------------------------ FxPool

export type FxSpawn = {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  /** Seconds alive. */
  life?: number;
  /** World-ish size (scaled by distance). */
  size?: number;
  /** Shrink toward the end (1) or hold (0). */
  shrink?: number;
  gravity?: number;
  drag?: number;
  color: string | THREE.Color;
  alpha?: number;
};

const CAP = 320;
const _c = new THREE.Color();

export class FxPool {
  readonly points: THREE.Points;
  private n = 0;
  private pos = new Float32Array(CAP * 3);
  private vel = new Float32Array(CAP * 3);
  private col = new Float32Array(CAP * 3);
  private size = new Float32Array(CAP);
  private alpha = new Float32Array(CAP);
  private age = new Float32Array(CAP);
  private dur = new Float32Array(CAP);
  private size0 = new Float32Array(CAP);
  private alpha0 = new Float32Array(CAP);
  private shrink = new Float32Array(CAP);
  private grav = new Float32Array(CAP);
  private drag = new Float32Array(CAP);
  private geo: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float uScale;
        varying vec4 vC;
        void main() {
          vC = vec4(aColor, aAlpha);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (uScale / max(0.2, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec4 vC;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.18, d);
          gl_FragColor = vec4(vC.rgb, vC.a * a);
        }`,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Drawing-buffer height in pixels, so point sizes stay in world units. */
  setViewport(heightPx: number) {
    this.material.uniforms.uScale.value = heightPx * 0.5;
  }

  get active() {
    return this.n;
  }

  spawn(s: FxSpawn) {
    if (this.n >= CAP) return;
    const i = this.n++;
    this.pos[i * 3] = s.x; this.pos[i * 3 + 1] = s.y; this.pos[i * 3 + 2] = s.z;
    this.vel[i * 3] = s.vx ?? 0; this.vel[i * 3 + 1] = s.vy ?? 0; this.vel[i * 3 + 2] = s.vz ?? 0;
    if (typeof s.color === "string") _c.set(s.color); else _c.copy(s.color);
    this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.age[i] = 0;
    this.dur[i] = s.life ?? 0.6;
    this.size0[i] = s.size ?? 0.1;
    this.alpha0[i] = s.alpha ?? 0.8;
    this.shrink[i] = s.shrink ?? 0.6;
    this.grav[i] = s.gravity ?? 0;
    this.drag[i] = s.drag ?? 1.5;
    this.size[i] = this.size0[i];
    this.alpha[i] = this.alpha0[i];
  }

  /** A small puff of n particles around a point (dust, landing, hearts). */
  puff(x: number, y: number, z: number, color: string, n = 4, spread = 0.18, up = 0.5, size = 0.16, life = 0.55) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.spawn({
        x: x + Math.cos(a) * r, y: y + Math.random() * 0.05, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * spread * 2.2, vy: up * (0.6 + Math.random() * 0.8), vz: Math.sin(a) * spread * 2.2,
        life: life * (0.8 + Math.random() * 0.4), size: size * (0.8 + Math.random() * 0.5), color, shrink: -0.6, gravity: 0.3, drag: 2.5, alpha: 0.55,
      });
    }
  }

  /** Fast bright sparks flying out of a point (impacts, embers, dissolving gates). */
  sparks(x: number, y: number, z: number, color: string, n = 12, speed = 2.4, life = 0.5, size = 0.09) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.3) * Math.PI * 0.8;
      const s = speed * (0.5 + Math.random());
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 0.8, vz: Math.sin(a) * Math.cos(b) * s,
        life: life * (0.7 + Math.random() * 0.6), size, color, shrink: 1, gravity: 5, drag: 1.2, alpha: 1,
      });
    }
  }

  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.dur[i]) {
        this.swapRemove(i);
        continue;
      }
      const k = this.age[i] / this.dur[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // negative shrink = grow (dust spreads out), positive = shrink (sparks die)
      const sh = this.shrink[i];
      this.size[i] = this.size0[i] * (sh >= 0 ? 1 - sh * k : 1 - sh * k * 1.5);
      this.alpha[i] = this.alpha0[i] * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7);
      i++;
    }
    const g = this.geo;
    g.setDrawRange(0, this.n);
    if (this.n > 0 || this.dirty) {
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
    this.dirty = this.n > 0;
  }
  private dirty = false;

  private swapRemove(i: number) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[j * 3 + k];
      this.vel[i * 3 + k] = this.vel[j * 3 + k];
      this.col[i * 3 + k] = this.col[j * 3 + k];
    }
    this.age[i] = this.age[j]; this.dur[i] = this.dur[j];
    this.size0[i] = this.size0[j]; this.alpha0[i] = this.alpha0[j];
    this.shrink[i] = this.shrink[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
    this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j];
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}

// -------------------------------------------------------------- DashStreak

const LINES = 14;

export class DashStreak {
  readonly mesh: THREE.InstancedMesh;
  private born = new Float32Array(LINES).fill(-1e9);
  private life = new Float32Array(LINES);
  private base: THREE.Matrix4[] = [];
  private next = 0;
  private t = 0;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor() {
    this.mesh = new THREE.InstancedMesh(G.box(0.025, 0.025, 0.7), glow("#fff6dc", 0.55), LINES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    for (let i = 0; i < LINES; i++) {
      this.base.push(new THREE.Matrix4().makeScale(0, 0, 0));
      this.mesh.setMatrixAt(i, this.base[i]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Wind lines around a point, aligned with the travel direction. */
  burst(x: number, z: number, heading: number, n = 6) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % LINES;
      this.born[i] = this.t;
      this.life[i] = 0.26 + Math.random() * 0.14;
      const side = (Math.random() - 0.5) * 0.9;
      const back = -0.2 - Math.random() * 0.5;
      this.p.set(
        x + Math.cos(heading) * side + Math.sin(heading) * back,
        0.35 + Math.random() * 0.9,
        z - Math.sin(heading) * side + Math.cos(heading) * back
      );
      this.e.set(0, heading, 0);
      this.q.setFromEuler(this.e);
      this.s.set(1, 1, 0.6 + Math.random() * 0.8);
      this.base[i].compose(this.p, this.q, this.s);
    }
  }

  update(dt: number) {
    this.t += dt;
    let dirty = false;
    for (let i = 0; i < LINES; i++) {
      const age = this.t - this.born[i];
      if (age > this.life[i] + 0.1) continue;
      const k = Math.max(0, 1 - age / this.life[i]);
      this.base[i].decompose(this.p, this.q, this.s);
      this.m.compose(this.p, this.q, this.s.set(k, k, this.s.z));
      this.mesh.setMatrixAt(i, this.m);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}

// --------------------------------------------------------------- FocusRing

export class FocusRing {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private disc: THREE.Mesh;
  private target = new THREE.Vector3();
  private shown = false;
  private k = 0;
  private t = 0;

  constructor() {
    this.ring = new THREE.Mesh(G.torus(0.46, 0.028, 6, 28), glow("#f2dfa6", 0.85));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.035;
    this.disc = new THREE.Mesh(G.cyl(0.5, 0.5, 0.012, 24), glow("#f2dfa6", 0.16));
    this.disc.position.y = 0.025;
    this.ring.renderOrder = 2;
    this.disc.renderOrder = 2;
    this.group.add(this.ring, this.disc);
    this.group.visible = false;
  }

  /** Show the ring under (x, z); call with null to hide. */
  set(x: number | null, z = 0) {
    if (x === null) {
      this.shown = false;
      return;
    }
    if (!this.shown) {
      // first appearance snaps so it never slides in from the last target
      this.group.position.set(x, 0, z);
      this.k = 0;
    }
    this.target.set(x, 0, z);
    this.shown = true;
  }

  update(dt: number) {
    this.t += dt;
    this.k += ((this.shown ? 1 : 0) - this.k) * Math.min(1, dt * 10);
    if (this.k < 0.01) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.lerp(this.target, Math.min(1, dt * 14));
    const pulse = 1 + Math.sin(this.t * 3.2) * 0.06;
    this.group.scale.setScalar(this.k * pulse);
    this.ring.rotation.z += dt * 0.6;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

// -------------------------------------------------------------- NameLabels

export type LabelTarget = { name: string; x: number; y: number; z: number };

const MAX_LABELS = 6;

export class NameLabels {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private names: string[] = new Array(MAX_LABELS).fill("");
  private opacity = new Float32Array(MAX_LABELS);
  private wanted = new Float32Array(MAX_LABELS);
  private textures = new Map<string, THREE.CanvasTexture>();

  constructor() {
    for (let i = 0; i < MAX_LABELS; i++) {
      const m = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
      const s = new THREE.Sprite(m);
      s.scale.set(1.5, 0.375, 1);
      s.visible = false;
      s.renderOrder = 20;
      this.sprites.push(s);
      this.group.add(s);
    }
  }

  private texture(name: string) {
    let t = this.textures.get(name);
    if (t) return t;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 30px 'Cinzel', 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(10,5,7,0.85)";
    ctx.strokeText(name, 128, 34);
    ctx.fillStyle = "#f7e6c8";
    ctx.fillText(name, 128, 34);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    this.textures.set(name, t);
    return t;
  }

  /**
   * Feed the labels that should be visible this frame (already sorted by
   * distance, at most six). Each entry carries a 0..1 fade weight.
   */
  update(dt: number, targets: { t: LabelTarget; fade: number }[]) {
    // keep a sprite on the same name while it is still wanted, so tags never jump
    for (let i = 0; i < MAX_LABELS; i++) this.wanted[i] = 0;
    const unplaced: { t: LabelTarget; fade: number }[] = [];
    for (const tg of targets) {
      const i = this.names.indexOf(tg.t.name);
      if (i >= 0 && this.wanted[i] === 0) {
        this.wanted[i] = tg.fade;
        this.sprites[i].position.set(tg.t.x, tg.t.y, tg.t.z);
      } else unplaced.push(tg);
    }
    for (const tg of unplaced) {
      // a free slot: unwanted and faded out
      let slot = -1;
      for (let i = 0; i < MAX_LABELS; i++) if (this.wanted[i] === 0 && this.opacity[i] < 0.05) { slot = i; break; }
      if (slot < 0) break;
      this.names[slot] = tg.t.name;
      (this.sprites[slot].material as THREE.SpriteMaterial).map = this.texture(tg.t.name);
      (this.sprites[slot].material as THREE.SpriteMaterial).needsUpdate = true;
      this.sprites[slot].position.set(tg.t.x, tg.t.y, tg.t.z);
      this.wanted[slot] = tg.fade;
    }
    for (let i = 0; i < MAX_LABELS; i++) {
      this.opacity[i] += (this.wanted[i] - this.opacity[i]) * Math.min(1, dt * 6);
      const s = this.sprites[i];
      const o = this.opacity[i];
      s.visible = o > 0.02;
      (s.material as THREE.SpriteMaterial).opacity = o;
      const sc = 0.9 + o * 0.1;
      s.scale.set(1.5 * sc, 0.375 * sc, 1);
    }
  }

  dispose() {
    for (const s of this.sprites) (s.material as THREE.Material).dispose();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.group.removeFromParent();
  }
}

// -------------------------------------------------------------- CrackDecal

let crackTex: THREE.CanvasTexture | null = null;
function crackTexture() {
  if (crackTex) return crackTex;
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, n, n);
  ctx.strokeStyle = "rgba(20,10,10,0.95)";
  ctx.lineCap = "round";
  const c = n / 2;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.6;
    let x = c, y = c;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rnd() * 3);
    for (let s = 0; s < segs; s++) {
      const len = 8 + rnd() * 10;
      const wob = a + (rnd() - 0.5) * 0.9;
      x += Math.cos(wob) * len;
      y += Math.sin(wob) * len;
      ctx.lineTo(x, y);
      ctx.lineWidth = Math.max(0.8, 3.2 - s * 0.7);
      if (rnd() < 0.5) {
        // a side split
        const bx = x + Math.cos(wob + 0.9) * (4 + rnd() * 8);
        const by = y + Math.sin(wob + 0.9) * (4 + rnd() * 8);
        ctx.moveTo(x, y);
        ctx.lineTo(bx, by);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  crackTex = new THREE.CanvasTexture(canvas);
  crackTex.colorSpace = THREE.SRGBColorSpace;
  return crackTex;
}

export class CrackDecal {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private age = 1e9;
  private dur = 1.8;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const geo = G.plane(1.5, 1.5);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.012;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  show(x: number, z: number) {
    this.mesh.position.set(x, 0.012, z);
    this.mesh.rotation.z = Math.random() * Math.PI * 2;
    this.age = 0;
    this.mesh.visible = true;
  }

  update(dt: number) {
    if (!this.mesh.visible) return;
    this.age += dt;
    const k = this.age / this.dur;
    if (k >= 1) {
      this.mesh.visible = false;
      this.material.opacity = 0;
      return;
    }
    this.material.opacity = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
    const s = 0.8 + Math.min(1, k * 8) * 0.2;
    this.mesh.scale.set(s, s, 1);
  }

  dispose() {
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
