// ---------------------------------------------------------------------------
// Battle enemies. Every species in content.ts gets its own low-poly creature
// (no placeholder boxes): jade bunny, temple sparrow, pine wolf, staff monkey,
// blossom moth, bamboo spirit / sentinel, white crane, echo bat, stone boar /
// mountain warden, coil serpent, temple guardian. Human bosses (Prakriti,
// Arshiya) use CharacterRig; the frightened dog is Mimo's own rig, dusty.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { BaseRig, ease } from "./BaseRig";
import { CharacterRig } from "./CharacterRig";
import { DogRig } from "./DogRig";
import { G, mat, glow, C } from "./materials";

export type Species =
  | "bunny" | "sparrow" | "wolf" | "monkey" | "moth" | "spirit" | "crane" | "bat" | "boar" | "serpent" | "guardian";

export function makeEnemyRig(portrait: string, boss: boolean): BaseRig {
  switch (portrait) {
    case "prakriti": return new CharacterRig("prakriti");
    case "arshiya": return new CharacterRig("arshiya");
    case "mimo": return new DogRig("dusty");
    default: return new CreatureRig(portrait as Species, boss);
  }
}

export class CreatureRig extends BaseRig {
  private parts: Record<string, THREE.Object3D> = {};
  private wings: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private hover = false;

  constructor(readonly species: Species, readonly boss: boolean) {
    super();
    this.build();
    this.bake();
    if (boss) {
      const s = this.species === "guardian" ? 1.25 : 1.3;
      this.body.scale.setScalar(s);
      this.height *= s;
    }
  }

  private build() {
    const dark = glow("#141014");
    const red = glow("#ff4a4a");
    switch (this.species) {
      case "bunny": {
        const fur = mat("#cfe0d2");
        const b = this.mesh(G.sphere(0.22, 10), fur, 0, 0.24, 0);
        b.scale.set(1, 0.85, 1.2);
        this.body.add(b);
        const head = this.joint(0, 0.42, 0.18);
        head.add(this.sphere(0.16, fur, 0, 0, 0, 10));
        for (const s of [-1, 1]) {
          const ear = this.joint(s * 0.07, 0.12, -0.02, head);
          ear.add(this.box(0.07, 0.3, 0.05, fur, 0, 0.15, 0));
          ear.add(this.box(0.03, 0.22, 0.02, mat(C.petal2), 0, 0.15, 0.02));
          ear.rotation.z = s * -0.2;
          this.parts[`ear${s}`] = ear;
          head.add(this.sphere(0.025, dark, s * 0.06, 0.03, 0.14, 5));
        }
        head.add(this.sphere(0.02, mat(C.petal1), 0, -0.02, 0.16, 5));
        this.body.add(this.sphere(0.07, mat("#ffffff"), 0, 0.26, -0.26, 6));
        this.parts.head = head;
        this.height = 0.7;
        break;
      }
      case "sparrow": {
        const f = mat("#8a6f4f");
        const b = this.mesh(G.sphere(0.18, 10), f, 0, 0.3, 0);
        b.scale.set(0.9, 0.85, 1.25);
        this.body.add(b);
        this.body.add(this.sphere(0.12, mat("#a3865f"), 0, 0.42, 0.16, 8));
        this.body.add(this.mesh(G.cone(0.03, 0.1, 5), mat(C.gold), 0, 0.42, 0.3)).rotation.x = Math.PI / 2;
        for (const s of [-1, 1]) {
          const w = this.joint(s * 0.1, 0.36, 0);
          w.add(this.box(0.3, 0.03, 0.2, f, s * 0.15, 0, -0.02));
          this.wings.push(w);
          this.body.add(this.sphere(0.02, dark, s * 0.05, 0.46, 0.25, 5));
        }
        this.body.add(this.box(0.08, 0.02, 0.18, f, 0, 0.3, -0.26));
        this.hover = true;
        this.height = 0.6;
        break;
      }
      case "wolf": {
        const f = mat("#4d4a55");
        const b = this.mesh(G.sphere(0.26, 10), f, 0, 0.42, 0);
        b.scale.set(0.9, 0.8, 1.5);
        this.body.add(b);
        const head = this.joint(0, 0.52, 0.38);
        head.add(this.sphere(0.17, f, 0, 0, 0, 10));
        head.add(this.box(0.14, 0.1, 0.18, mat("#67636f"), 0, -0.04, 0.16));
        head.add(this.sphere(0.03, dark, 0, -0.02, 0.26, 5));
        for (const s of [-1, 1]) {
          head.add(this.mesh(G.cone(0.05, 0.12, 4), f, s * 0.09, 0.14, -0.02));
          head.add(this.sphere(0.025, red, s * 0.07, 0.05, 0.14, 5));
        }
        this.parts.head = head;
        for (const [x, z] of [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]] as const) {
          const l = this.joint(x, 0.3, z);
          l.add(this.box(0.08, 0.3, 0.09, f, 0, -0.15, 0));
          this.legs.push(l);
        }
        const tail = this.joint(0, 0.5, -0.38);
        tail.add(this.box(0.07, 0.07, 0.3, f, 0, 0.05, -0.15));
        this.parts.tail = tail;
        this.height = 0.85;
        break;
      }
      case "monkey": {
        const f = mat("#8a5a34");
        const sk = mat("#c99a68");
        this.body.add(this.mesh(G.sphere(0.2, 10), f, 0, 0.45, 0));
        const head = this.joint(0, 0.72, 0.05);
        head.add(this.sphere(0.15, f, 0, 0, 0, 10));
        head.add(this.sphere(0.1, sk, 0, -0.02, 0.1, 8));
        for (const s of [-1, 1]) {
          head.add(this.sphere(0.05, sk, s * 0.15, 0.02, 0, 6));
          head.add(this.sphere(0.02, dark, s * 0.045, 0.03, 0.17, 5));
          const arm = this.joint(s * 0.2, 0.58, 0);
          arm.add(this.box(0.08, 0.4, 0.08, f, 0, -0.2, 0));
          this.parts[`arm${s}`] = arm;
          const leg = this.joint(s * 0.1, 0.28, 0);
          leg.add(this.box(0.09, 0.28, 0.09, f, 0, -0.14, 0));
          this.legs.push(leg);
        }
        // staff
        const staff = this.mesh(G.cyl(0.02, 0.02, 1.1, 6), mat(C.wood2), 0, -0.3, 0.05);
        (this.parts["arm1"] as THREE.Group).add(staff);
        const tail = this.joint(0, 0.4, -0.18);
        tail.add(this.mesh(G.cyl(0.025, 0.02, 0.5, 5), f, 0, 0.2, -0.1)).rotation.x = -0.6;
        this.parts.tail = tail;
        this.parts.head = head;
        this.height = 0.95;
        break;
      }
      case "moth": {
        const f = mat("#c9a0c0");
        const wingMat = mat("#e39cb2", { opacity: 0.9 });
        const b = this.mesh(G.sphere(0.12, 8), f, 0, 0.6, 0);
        b.scale.set(0.8, 0.8, 1.6);
        this.body.add(b);
        this.body.add(this.sphere(0.09, f, 0, 0.64, 0.18, 8));
        for (const s of [-1, 1]) {
          const w = this.joint(s * 0.05, 0.62, 0);
          const upper = this.box(0.42, 0.02, 0.3, wingMat, s * 0.24, 0, 0.05);
          const lower = this.box(0.3, 0.02, 0.22, wingMat, s * 0.18, -0.01, -0.18);
          w.add(upper, lower);
          w.add(this.sphere(0.05, glow(C.brightgold), s * 0.26, 0.015, 0.06, 6));
          this.wings.push(w);
          this.body.add(this.mesh(G.cyl(0.01, 0.01, 0.2, 4), f, s * 0.04, 0.78, 0.2)).rotation.x = -0.6;
        }
        this.hover = true;
        this.height = 0.9;
        break;
      }
      case "spirit": {
        // bamboo spirit / sentinel: a tall green figure of woven stalks, glowing eyes
        const g = mat("#4f7a3a");
        const g2 = mat("#679a4c");
        this.body.add(this.mesh(G.cyl(0.18, 0.3, 0.9, 7), g, 0, 0.45, 0));
        this.body.add(this.mesh(G.cyl(0.22, 0.18, 0.5, 7), g2, 0, 1.15, 0));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.body.add(this.mesh(G.cyl(0.03, 0.035, 1.5, 5), i % 2 ? g : g2, Math.cos(a) * 0.24, 0.75, Math.sin(a) * 0.24));
        }
        const head = this.joint(0, 1.55, 0);
        head.add(this.sphere(0.22, g, 0, 0, 0, 9));
        head.add(this.mesh(G.cone(0.14, 0.4, 5), g2, 0, 0.3, 0));
        for (const s of [-1, 1]) head.add(this.box(0.07, 0.04, 0.03, glow("#c8ffb0"), s * 0.08, 0.02, 0.2));
        for (const s of [-1, 1]) {
          const arm = this.joint(s * 0.3, 1.25, 0);
          arm.add(this.mesh(G.cyl(0.04, 0.05, 0.7, 5), g, 0, -0.35, 0));
          arm.add(this.sphere(0.07, g2, 0, -0.72, 0, 6));
          this.parts[`arm${s}`] = arm;
        }
        this.parts.head = head;
        this.height = 1.9;
        break;
      }
      case "crane": {
        const w = mat(C.white);
        const b = this.mesh(G.sphere(0.2, 10), w, 0, 0.75, 0);
        b.scale.set(0.8, 0.8, 1.4);
        this.body.add(b);
        const neck = this.joint(0, 0.85, 0.2);
        neck.add(this.mesh(G.cyl(0.04, 0.05, 0.5, 6), w, 0, 0.25, 0.08)).rotation.x = -0.3;
        neck.add(this.sphere(0.08, w, 0, 0.52, 0.18, 8));
        neck.add(this.box(0.06, 0.04, 0.05, mat(C.red), 0, 0.58, 0.18));
        neck.add(this.mesh(G.cone(0.025, 0.2, 5), mat(C.gold), 0, 0.5, 0.32)).rotation.x = Math.PI / 2;
        neck.add(this.sphere(0.018, dark, 0.05, 0.53, 0.22, 4));
        neck.add(this.sphere(0.018, dark, -0.05, 0.53, 0.22, 4));
        this.parts.head = neck;
        for (const s of [-1, 1]) {
          const wing = this.joint(s * 0.12, 0.82, 0);
          wing.add(this.box(0.6, 0.03, 0.28, w, s * 0.3, 0, -0.02));
          wing.add(this.box(0.2, 0.03, 0.26, mat(C.charcoal), s * 0.62, 0, -0.02));
          this.wings.push(wing);
          const leg = this.joint(s * 0.06, 0.6, -0.02);
          leg.add(this.mesh(G.cyl(0.015, 0.015, 0.6, 4), mat(C.charcoal), 0, -0.3, 0));
          this.legs.push(leg);
        }
        this.height = 1.4;
        break;
      }
      case "bat": {
        const f = mat("#4a3a52");
        const b = this.mesh(G.sphere(0.14, 8), f, 0, 0.9, 0);
        b.scale.set(1, 0.9, 1.1);
        this.body.add(b);
        for (const s of [-1, 1]) {
          const w = this.joint(s * 0.1, 0.92, 0);
          w.add(this.box(0.5, 0.02, 0.32, mat("#5f4a6b", { opacity: 0.95 }), s * 0.28, 0, -0.02));
          w.add(this.box(0.5, 0.025, 0.03, f, s * 0.28, 0.005, 0.14));
          this.wings.push(w);
          this.body.add(this.mesh(G.cone(0.04, 0.1, 4), f, s * 0.08, 1.05, 0));
          this.body.add(this.sphere(0.022, red, s * 0.05, 0.93, 0.12, 5));
        }
        this.hover = true;
        this.height = 1.2;
        break;
      }
      case "boar": {
        const f = mat(this.boss ? "#6a5a48" : "#5a4a3a");
        const b = this.mesh(G.sphere(0.32, 10), f, 0, 0.45, 0);
        b.scale.set(1, 0.85, 1.5);
        this.body.add(b);
        const head = this.joint(0, 0.5, 0.45);
        head.add(this.sphere(0.22, f, 0, 0, 0, 10));
        head.add(this.box(0.16, 0.14, 0.14, mat("#8a7458"), 0, -0.06, 0.22));
        head.add(this.mesh(G.cone(0.03, 0.14, 4), mat(C.offwhite), -0.1, -0.08, 0.2)).rotation.x = -0.8;
        head.add(this.mesh(G.cone(0.03, 0.14, 4), mat(C.offwhite), 0.1, -0.08, 0.2)).rotation.x = -0.8;
        for (const s of [-1, 1]) {
          head.add(this.sphere(0.03, red, s * 0.1, 0.06, 0.18, 5));
          head.add(this.mesh(G.cone(0.05, 0.1, 4), f, s * 0.13, 0.2, -0.02));
        }
        if (this.boss) {
          // warden's staff, strapped across the back
          const st = this.mesh(G.cyl(0.025, 0.03, 1.4, 6), mat(C.wood2), 0, 0.72, -0.05);
          st.rotation.z = 1.2;
          this.body.add(st);
          this.body.add(this.box(0.5, 0.06, 0.6, mat(C.crimson), 0, 0.72, 0));
        }
        this.parts.head = head;
        for (const [x, z] of [[-0.16, 0.28], [0.16, 0.28], [-0.16, -0.28], [0.16, -0.28]] as const) {
          const l = this.joint(x, 0.3, z);
          l.add(this.box(0.1, 0.3, 0.1, f, 0, -0.15, 0));
          this.legs.push(l);
        }
        this.height = 0.9;
        break;
      }
      case "serpent": {
        const f = mat("#3a6a58");
        const f2 = mat("#4d8a70");
        // coiled body: a ring of spheres rising to a raised head
        for (let i = 0; i < 9; i++) {
          const a = i * 0.8;
          const r = 0.32 - i * 0.015;
          const y = 0.12 + i * 0.07;
          this.body.add(this.sphere(0.11 - i * 0.004, i % 2 ? f : f2, Math.cos(a) * r, y, Math.sin(a) * r, 8));
        }
        const head = this.joint(Math.cos(9 * 0.8) * 0.2, 0.8, Math.sin(9 * 0.8) * 0.2);
        head.add(this.mesh(G.cyl(0.07, 0.1, 0.3, 6), f, 0, -0.1, 0));
        const sk = this.mesh(G.sphere(0.12, 9), f2, 0, 0.08, 0.04);
        sk.scale.set(1, 0.8, 1.25);
        head.add(sk);
        head.add(this.sphere(0.025, red, -0.05, 0.12, 0.14, 5));
        head.add(this.sphere(0.025, red, 0.05, 0.12, 0.14, 5));
        head.add(this.box(0.01, 0.01, 0.12, mat(C.red), 0, 0.03, 0.22));
        this.parts.head = head;
        this.height = 1.0;
        break;
      }
      case "guardian": {
        // a stone colossus with crimson eyes and a gold belt
        const st = mat("#6a5a48");
        const st2 = mat("#7d6c56");
        this.body.add(this.box(0.9, 0.9, 0.55, st, 0, 1.0, 0));
        this.body.add(this.box(1.1, 0.3, 0.6, st2, 0, 1.5, 0));
        this.body.add(this.box(0.9, 0.1, 0.56, mat(C.gold), 0, 0.6, 0));
        const head = this.joint(0, 1.68, 0);
        head.add(this.box(0.5, 0.45, 0.45, st2, 0, 0.22, 0));
        head.add(this.box(0.6, 0.12, 0.5, st, 0, 0.5, 0));
        for (const s of [-1, 1]) head.add(this.box(0.12, 0.06, 0.03, glow("#ff3a3a"), s * 0.13, 0.22, 0.23));
        for (const s of [-1, 1]) {
          const arm = this.joint(s * 0.68, 1.45, 0);
          arm.add(this.box(0.3, 0.9, 0.32, st, 0, -0.45, 0));
          arm.add(this.box(0.36, 0.3, 0.36, st2, 0, -0.95, 0));
          this.parts[`arm${s}`] = arm;
          const leg = this.joint(s * 0.26, 0.55, 0);
          leg.add(this.box(0.34, 0.55, 0.36, st, 0, -0.27, 0));
          this.legs.push(leg);
        }
        this.parts.head = head;
        this.height = 2.3;
        break;
      }
    }
  }

  protected pose(dt: number) {
    void dt;
    const t = this.t;
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    const head = this.parts.head as THREE.Group | undefined;
    if (head) head.rotation.set(0, 0, 0);
    this.wings.forEach((w, i) => w.rotation.set(0, 0, 0 * i));
    this.legs.forEach((l) => l.rotation.set(0, 0, 0));
    for (const k of ["arm-1", "arm1"]) (this.parts[k] as THREE.Group | undefined)?.rotation.set(0, 0, 0);

    if (this.ko) {
      this.body.rotation.z = 1.4;
      this.body.position.y = 0.2;
      return;
    }

    // idle life
    if (this.hover) {
      this.body.position.y = Math.sin(t * 3) * 0.08 + 0.1;
      this.wings.forEach((w, i) => (w.rotation.z = Math.sin(t * 14 + i) * 0.6 * (i === 0 ? 1 : -1)));
    } else {
      this.body.position.y = Math.abs(Math.sin(t * 2)) * 0.015;
      this.wings.forEach((w, i) => (w.rotation.z = Math.sin(t * 2 + i) * 0.1 * (i === 0 ? 1 : -1)));
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.9) * 0.15;
      head.rotation.x = Math.sin(t * 1.7) * 0.06;
    }
    const tail = this.parts.tail as THREE.Group | undefined;
    if (tail) tail.rotation.y = Math.sin(t * 5) * 0.4;
    if (this.species === "serpent") this.body.rotation.y = Math.sin(t * 1.2) * 0.12;
    if (this.species === "bunny") {
      (this.parts["ear-1"] as THREE.Group).rotation.x = Math.sin(t * 2) * 0.15;
      (this.parts["ear1"] as THREE.Group).rotation.x = Math.sin(t * 2 + 1) * 0.15;
    }

    const a = this.action;
    if (!a) return;
    const ph = Math.min(1, a.t / a.dur);
    switch (a.name) {
      case "attack": {
        const k = ease.bump(ph);
        this.body.position.z = k * 0.9;
        this.body.position.y += k * 0.25;
        if (head) head.rotation.x = -0.4 * k;
        this.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? 0.7 : -0.7) * k));
        (this.parts["arm1"] as THREE.Group | undefined)?.rotation.set(-2.2 * k, 0, 0);
        (this.parts["arm-1"] as THREE.Group | undefined)?.rotation.set(-1.0 * k, 0, 0);
        break;
      }
      case "hit": {
        const k = ease.bump(ph);
        this.body.position.z = -0.3 * k;
        this.body.rotation.x = -0.2 * k;
        break;
      }
      case "enrage": {
        const k = ease.bump(ph);
        this.body.position.y += 0.3 * k;
        this.body.rotation.x = -0.15 * k;
        (this.parts["arm1"] as THREE.Group | undefined)?.rotation.set(-2.8 * k, 0, -0.5 * k);
        (this.parts["arm-1"] as THREE.Group | undefined)?.rotation.set(-2.8 * k, 0, 0.5 * k);
        if (head) head.rotation.x = -0.4 * k;
        break;
      }
      default:
        break;
    }
  }
}
