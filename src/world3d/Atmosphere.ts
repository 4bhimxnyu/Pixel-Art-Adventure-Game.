// ---------------------------------------------------------------------------
// Atmosphere extras, each one draw call, each skipped under reducedMotion:
//
//   FogPlanes    two or three big soft discs of mist drifting at ankle height
//                (forest, cave, mountain).
//   LightShafts  a few additive planes of light falling through the temple roof.
//   Birds        a handful of small flapping silhouettes circling the sky
//                (Route 1, the village).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { G } from "./materials";

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _hinge = new THREE.Matrix4();
const _out = new THREE.Matrix4();

let softTex: THREE.CanvasTexture | null = null;
/** A radial white-to-transparent disc, shared by every fog plane. */
function softDisc() {
  if (softTex) return softTex;
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(n / 2, n / 2, 4, n / 2, n / 2, n / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  softTex = new THREE.CanvasTexture(canvas);
  return softTex;
}

// --------------------------------------------------------------- FogPlanes

export class FogPlanes {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.MeshBasicMaterial;
  private centers: { x: number; z: number; r: number; s: number; w: number }[] = [];
  private t = Math.random() * 100;

  constructor(w: number, h: number, color: string, count = 3, opacity = 0.14) {
    this.material = new THREE.MeshBasicMaterial({ map: softDisc(), color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(G.plane(1, 1), this.material, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    for (let i = 0; i < count; i++) {
      this.centers.push({
        x: w * (0.2 + 0.6 * ((i + 0.5) / count)) + (Math.random() - 0.5) * w * 0.3,
        z: -h * (0.25 + Math.random() * 0.5),
        r: Math.min(w, h) * (0.45 + Math.random() * 0.35),
        s: 0.25 + Math.random() * 0.2,
        w: Math.random() * Math.PI * 2,
      });
    }
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    for (let i = 0; i < this.centers.length; i++) {
      const c = this.centers[i];
      _p.set(c.x + Math.sin(this.t * c.s + c.w) * 1.6, 0.28 + Math.sin(this.t * 0.4 + c.w) * 0.06, c.z + Math.cos(this.t * c.s * 0.7 + c.w) * 1.2);
      _e.set(-Math.PI / 2, 0, this.t * 0.02 * (i % 2 ? 1 : -1) + c.w);
      _q.setFromEuler(_e);
      const r = c.r * (1 + Math.sin(this.t * 0.3 + c.w) * 0.08);
      _s.set(r, r, 1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.material.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}

// ------------------------------------------------------------- LightShafts

export class LightShafts {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.MeshBasicMaterial;
  private t = 0;
  private base: number;

  constructor(spots: { x: number; z: number }[], color = "#ffd9a0", opacity = 0.07) {
    this.base = opacity;
    this.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.InstancedMesh(G.plane(0.9, 7), this.material, spots.length);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    spots.forEach((s, i) => {
      _p.set(s.x, 3.2, s.z);
      _e.set(0, (i * 1.7) % Math.PI, 0.22);
      _q.setFromEuler(_e);
      _s.set(1 + (i % 3) * 0.3, 1, 1);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    this.t += dt;
    this.material.opacity = this.base * (0.8 + Math.sin(this.t * 0.9) * 0.12 + Math.sin(this.t * 2.3) * 0.08);
  }

  dispose() {
    this.material.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}

// ------------------------------------------------------------------- Birds

const BIRDS = 5;

export class Birds {
  readonly group = new THREE.Group();
  private wingL: THREE.InstancedMesh;
  private wingR: THREE.InstancedMesh;
  private material: THREE.MeshBasicMaterial;
  private t = Math.random() * 50;
  private cx: number;
  private cz: number;
  private phase: number[] = [];
  private radius: number[] = [];
  private height: number[] = [];

  constructor(w: number, h: number, color = "#2a2024") {
    this.cx = w / 2;
    this.cz = -h / 2;
    this.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), fog: true });
    this.wingL = new THREE.InstancedMesh(G.box(0.3, 0.02, 0.08), this.material, BIRDS);
    this.wingR = new THREE.InstancedMesh(G.box(0.3, 0.02, 0.08), this.material, BIRDS);
    this.wingL.frustumCulled = false;
    this.wingR.frustumCulled = false;
    for (let i = 0; i < BIRDS; i++) {
      this.phase.push((i / BIRDS) * Math.PI * 2 + Math.random() * 0.5);
      this.radius.push(Math.max(w, h) * (0.35 + Math.random() * 0.3));
      this.height.push(7 + Math.random() * 2.5);
    }
    this.group.add(this.wingL, this.wingR);
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    for (let i = 0; i < BIRDS; i++) {
      const a = this.t * 0.18 + this.phase[i];
      const r = this.radius[i];
      const x = this.cx + Math.cos(a) * r;
      const z = this.cz + Math.sin(a) * r * 0.7;
      const y = this.height[i] + Math.sin(this.t * 0.7 + i) * 0.4;
      const yaw = -a; // tangent of the circle
      const flap = Math.sin(this.t * 9 + i * 1.3) * 0.65;
      for (const side of [-1, 1]) {
        _p.set(x, y, z);
        _e.set(0, yaw, 0);
        _q.setFromEuler(_e);
        _m.compose(_p, _q, _s.set(1, 1, 1));
        // wing hinge at the body: offset half a wing out, flap about the body axis
        _hinge.makeRotationZ(flap * side);
        _out.makeTranslation(side * 0.15, 0, 0);
        _m.multiply(_hinge).multiply(_out);
        (side < 0 ? this.wingL : this.wingR).setMatrixAt(i, _m);
      }
    }
    this.wingL.instanceMatrix.needsUpdate = true;
    this.wingR.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.material.dispose();
    this.wingL.dispose();
    this.wingR.dispose();
    this.group.removeFromParent();
  }
}
