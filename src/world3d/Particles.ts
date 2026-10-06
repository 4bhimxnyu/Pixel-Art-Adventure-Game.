// ---------------------------------------------------------------------------
// Ambient particles: petals, bamboo leaves, cave sparks, fireflies, dust.
// One Points object per map, a few hundred points at most, drifting on a
// seeded path and wrapping within the map bounds. Also a short-lived burst
// (flourish) used for pickups and flames.
// ---------------------------------------------------------------------------

import * as THREE from "three";

export type ParticleKind = "petals" | "leaves" | "sparks" | "fireflies" | "dust" | "snowdust";

const KIND: Record<ParticleKind, { color: string; size: number; count: number; fall: number; drift: number; height: [number, number]; opacity: number }> = {
  petals:    { color: "#e88fb0", size: 0.09, count: 160, fall: 0.35, drift: 0.5, height: [0.2, 5], opacity: 0.8 },
  leaves:    { color: "#7fb75f", size: 0.08, count: 110, fall: 0.3, drift: 0.6, height: [0.3, 5], opacity: 0.8 },
  sparks:    { color: "#b9a8ff", size: 0.07, count: 140, fall: -0.15, drift: 0.2, height: [0.2, 2.6], opacity: 0.9 },
  fireflies: { color: "#ffe08a", size: 0.08, count: 60, fall: 0, drift: 0.4, height: [0.5, 2.2], opacity: 0.9 },
  dust:      { color: "#ffd9a8", size: 0.05, count: 120, fall: 0.03, drift: 0.15, height: [0.3, 2.4], opacity: 0.45 },
  snowdust:  { color: "#eef4ff", size: 0.05, count: 110, fall: 0.25, drift: 0.7, height: [0.5, 5], opacity: 0.6 },
};

export class AmbientParticles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private seeds: Float32Array;
  private cfg: (typeof KIND)[ParticleKind];
  private t = 0;

  constructor(kind: ParticleKind, private w: number, private h: number, scale = 1) {
    const cfg = (this.cfg = KIND[kind]);
    const n = Math.round(cfg.count * scale);
    this.pos = new Float32Array(n * 3);
    this.seeds = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = Math.random() * (w + 6) - 3;
      this.pos[i * 3 + 1] = cfg.height[0] + Math.random() * (cfg.height[1] - cfg.height[0]);
      this.pos[i * 3 + 2] = Math.random() * (h + 6) - 3;
      this.seeds[i * 2] = Math.random() * Math.PI * 2;
      this.seeds[i * 2 + 1] = 0.5 + Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(cfg.color),
      size: cfg.size,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  update(dt: number) {
    this.t += dt;
    const c = this.cfg;
    const p = this.pos;
    const n = p.length / 3;
    for (let i = 0; i < n; i++) {
      const s = this.seeds[i * 2];
      const k = this.seeds[i * 2 + 1];
      p[i * 3] += Math.sin(this.t * k + s) * c.drift * dt;
      p[i * 3 + 1] -= c.fall * k * dt;
      p[i * 3 + 2] += Math.cos(this.t * k * 0.7 + s) * c.drift * 0.6 * dt;
      if (c.fall === 0) p[i * 3 + 1] += Math.sin(this.t * 1.3 * k + s) * 0.25 * dt;
      if (p[i * 3 + 1] < c.height[0]) p[i * 3 + 1] = c.height[1];
      if (p[i * 3 + 1] > c.height[1] + 0.5) p[i * 3 + 1] = c.height[0];
      if (p[i * 3] < -3) p[i * 3] = this.w + 3;
      if (p[i * 3] > this.w + 3) p[i * 3] = -3;
      if (p[i * 3 + 2] < -3) p[i * 3 + 2] = this.h + 3;
      if (p[i * 3 + 2] > this.h + 3) p[i * 3 + 2] = -3;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.points.removeFromParent();
  }
}

/** A one-shot golden burst at a point. Returns an updater that reports done. */
export class Burst {
  readonly points: THREE.Points;
  private vel: Float32Array;
  private pos: Float32Array;
  private life = 0;
  readonly dur: number;

  constructor(x: number, y: number, z: number, color = "#f2dfa6", n = 36, dur = 0.8, speed = 2.2) {
    this.dur = dur;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.5 + Math.random());
      this.vel[i * 3] = Math.cos(a) * Math.cos(b) * s;
      this.vel[i * 3 + 1] = Math.sin(b) * s + 1.5;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(color), size: 0.12, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
  }

  /** @returns false when finished */
  update(dt: number) {
    this.life += dt;
    const k = 1 - this.life / this.dur;
    const n = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      this.vel[i * 3 + 1] -= 6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.material as THREE.PointsMaterial).opacity = Math.max(0, k);
    if (k <= 0) {
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
      this.points.removeFromParent();
      return false;
    }
    return true;
  }
}
