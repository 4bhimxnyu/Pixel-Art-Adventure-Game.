// ---------------------------------------------------------------------------
// Shared behaviour for every animated figure in the world: heading, movement
// blend, one-shot actions (attack / hit / cheer / hug...), knock-out pose,
// hit flash, and disposal. Subclasses build the body and implement pose().
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { G, glow } from "./materials";

export type RigAction = "attack" | "hit" | "cheer" | "hug" | "bark" | "sniff" | "dig" | "jump" | "enrage" | "wave";

export abstract class BaseRig {
  readonly group = new THREE.Group();
  /** Where the body hangs off — subclasses animate parts under this. */
  protected readonly body = new THREE.Group();
  heading = 0;
  /** 0 = standing, 1 = full walk. Blended by the owner. */
  protected move = 0;
  protected t = Math.random() * 10;
  protected action: { name: RigAction; t: number; dur: number; onDone?: () => void } | null = null;
  protected ko = false;
  protected flashUntil = 0;
  protected flashed: { mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
  /** Approximate top of the model, for prompts and camera framing. */
  height = 1.5;
  /** Procedural idle variant, set by subclasses from their spec. */
  idle = "default";
  /** Scale factor applied to the whole body. */
  protected bodyScale = 1;
  private targetHeading: number | null = null;

  constructor() {
    this.group.add(this.body);
  }

  setHeading(a: number, immediate = false) {
    this.targetHeading = a;
    if (immediate) {
      this.heading = a;
      this.group.rotation.y = a;
      this.targetHeading = null;
    }
  }

  /** Turn to look at a world point. */
  faceToward(x: number, z: number, immediate = false) {
    const dx = x - this.group.position.x;
    const dz = z - this.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    this.setHeading(Math.atan2(dx, dz), immediate);
  }

  setMoving(speed01: number) {
    this.move = Math.max(0, Math.min(1, speed01));
  }

  play(name: RigAction, dur = 0.6, onDone?: () => void) {
    this.action = { name, t: 0, dur, onDone };
  }

  get currentAction() {
    return this.action?.name ?? null;
  }

  setKO(v: boolean) {
    this.ko = v;
  }

  flash(color = "#ff6a5a", ms = 140) {
    this.unflash();
    this.flashUntil = performance.now() + ms;
    const m = glow(color);
    this.body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        this.flashed.push({ mesh, mat: mesh.material });
        mesh.material = m;
      }
    });
  }

  private unflash() {
    for (const f of this.flashed) f.mesh.material = f.mat;
    this.flashed = [];
  }

  update(dt: number) {
    this.t += dt;
    if (this.targetHeading !== null) {
      let d = this.targetHeading - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const step = Math.min(Math.abs(d), dt * 11);
      this.heading += Math.sign(d) * step;
      this.group.rotation.y = this.heading;
      if (Math.abs(d) < 0.01) {
        this.heading = this.targetHeading;
        this.group.rotation.y = this.heading;
        this.targetHeading = null;
      }
    }
    if (this.flashed.length && performance.now() > this.flashUntil) this.unflash();
    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= this.action.dur) {
        const done = this.action.onDone;
        this.action = null;
        done?.();
      }
    }
    this.pose(dt);
  }

  /** Action progress 0..1 or -1 when idle. */
  protected actionPhase(name?: RigAction) {
    if (!this.action) return -1;
    if (name && this.action.name !== name) return -1;
    return Math.min(1, this.action.t / this.action.dur);
  }

  protected abstract pose(dt: number): void;

  setShadows(on: boolean) {
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = on;
    });
  }

  dispose() {
    this.unflash();
    this.group.removeFromParent();
    // geometries / materials are shared caches — nothing else to free
  }

  // ------------------------------------------------------- build helpers

  protected mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  protected box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
    return this.mesh(G.box(w, h, d), material, x, y, z);
  }

  protected sphere(r: number, material: THREE.Material, x = 0, y = 0, z = 0, seg = 8) {
    return this.mesh(G.sphere(r, seg), material, x, y, z);
  }

  /** A pivot group at a joint; children hang below it. */
  protected joint(x: number, y: number, z: number, parent: THREE.Object3D = this.body) {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  }
}

export const ease = {
  outBack: (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  /** 0→1→0 bump */
  bump: (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))),
};
