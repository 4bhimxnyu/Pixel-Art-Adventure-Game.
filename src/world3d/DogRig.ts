// ---------------------------------------------------------------------------
// Mimo — a male Shih Tzu. Small and very fluffy: a long coat that hangs like
// a skirt under the body (the legs barely show), a round face with a short,
// flat muzzle and a slight underbite, big round dark eyes, long floppy
// fur-covered ears, a plumed tail curled over the back, and a topknot tied
// with a blue band. White coat with gold-tan on the ears, saddle and around
// the eyes; a blue collar with a gold tag. Walks, sits when bored, sniffs,
// barks, digs, jumps, bites (battle), and wags.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { BaseRig, ease } from "./BaseRig";
import { G, mat, glow } from "./materials";

export class DogRig extends BaseRig {
  private bodyMesh!: THREE.Mesh;
  private head!: THREE.Group;
  private tail!: THREE.Group;
  private earL!: THREE.Group;
  private earR!: THREE.Group;
  private legs: THREE.Group[] = [];
  private jaw!: THREE.Mesh;
  private idleTime = 0;
  private sitting = false;

  constructor(tint: "white" | "dusty" = "white") {
    super();
    this.height = 0.62;
    this.build(tint);
  }

  private build(tint: "white" | "dusty") {
    const fur = mat(tint === "white" ? "#f6f3ea" : "#d9d4c6");
    const furShade = mat(tint === "white" ? "#e6e1d2" : "#c3bdae");
    const tan = mat("#c9a06a");
    const tanDark = mat("#b08650");
    const dark = glow("#141014");
    const blue = mat("#2f6bd6");

    // --- body: a fluffy ellipsoid (own joint: it breathes by scaling, so it stays unbaked)
    const bodyJoint = this.joint(0, 0, 0);
    this.bodyMesh = this.mesh(G.sphere(0.25, 12), fur, 0, 0.36, -0.02);
    this.bodyMesh.scale.set(0.95, 0.78, 1.3);
    bodyJoint.add(this.bodyMesh);

    // overlapping fur: chest ruff, rump, and the long coat "skirt" that hides the legs
    const ruff = this.mesh(G.sphere(0.23, 10), fur, 0, 0.3, 0.2);
    ruff.scale.set(1.05, 0.85, 0.8);
    this.body.add(ruff);
    for (const s of [-1, 1]) this.body.add(this.sphere(0.1, fur, s * 0.17, 0.26, 0.24, 7));
    const rump = this.mesh(G.sphere(0.2, 10), fur, 0, 0.32, -0.24);
    rump.scale.set(0.95, 0.75, 0.8);
    this.body.add(rump);
    const skirt = this.mesh(G.sphere(0.28, 12), furShade, 0, 0.2, -0.02);
    skirt.scale.set(1.0, 0.55, 1.32);
    this.body.add(skirt);
    // a ring of loose fur clumps around the coat's edge, and a few hanging locks,
    // so the silhouette reads as long soft hair rather than a smooth shell
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rx = 0.27 + (i % 2) * 0.03;
      const rz = 0.34 + (i % 3) * 0.02;
      const clump = this.sphere(0.075 + (i % 3) * 0.012, i % 2 ? fur : furShade, Math.cos(a) * rx, 0.17 + (i % 2) * 0.04, Math.sin(a) * rz - 0.02, 7);
      clump.scale.set(1, 0.8, 1);
      this.body.add(clump);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      this.body.add(this.sphere(0.055, furShade, Math.cos(a) * 0.24, 0.09, Math.sin(a) * 0.3 - 0.02, 6));
    }
    // extra fluff along the back and flanks
    for (const [x, y, z, r] of [[-0.2, 0.42, 0.05, 0.11], [0.2, 0.42, 0.05, 0.11], [-0.18, 0.4, -0.2, 0.1], [0.18, 0.4, -0.2, 0.1], [0, 0.5, 0.12, 0.12], [-0.12, 0.47, -0.3, 0.09], [0.12, 0.47, -0.3, 0.09]] as const) {
      this.body.add(this.sphere(r, fur, x, y, z, 8));
    }
    // gold-tan saddle on the back
    const saddle = this.mesh(G.sphere(0.2, 10), tan, 0, 0.47, -0.06);
    saddle.scale.set(0.85, 0.4, 1.0);
    this.body.add(saddle);
    const saddle2 = this.mesh(G.sphere(0.12, 8), tanDark, 0.08, 0.5, -0.18);
    saddle2.scale.set(0.9, 0.35, 0.9);
    this.body.add(saddle2);

    // --- legs: short stubs, mostly hidden by the coat
    const legPos: [number, number][] = [[-0.11, 0.18], [0.11, 0.18], [-0.11, -0.2], [0.11, -0.2]];
    for (const [x, z] of legPos) {
      const j = this.joint(x, 0.2, z);
      j.add(this.mesh(G.cyl(0.055, 0.07, 0.2, 7), fur, 0, -0.1, 0));
      j.add(this.sphere(0.065, furShade, 0, -0.19, 0.01, 6));
      this.legs.push(j);
    }

    // --- head: round, with a flat face
    this.head = this.joint(0, 0.46, 0.3);
    const skull = this.mesh(G.sphere(0.2, 12), fur, 0, 0.05, 0.0);
    skull.scale.set(1.08, 0.98, 0.95);
    this.head.add(skull);
    // fluffy cheeks / beard either side of the muzzle
    for (const s of [-1, 1]) {
      const cheek = this.mesh(G.sphere(0.1, 8), fur, s * 0.12, -0.04, 0.12);
      cheek.scale.set(1, 0.9, 0.9);
      this.head.add(cheek);
      // tan patch around each eye
      const patch = this.mesh(G.sphere(0.065, 8), tan, s * 0.085, 0.07, 0.14);
      patch.scale.set(1.1, 1, 0.6);
      this.head.add(patch);
    }
    // short flat muzzle, nose high and black, mouth with a slight underbite
    const muzzle = this.mesh(G.sphere(0.085, 10), furShade, 0, -0.03, 0.17);
    muzzle.scale.set(1.15, 0.75, 0.7);
    this.head.add(muzzle);
    this.head.add(this.sphere(0.034, dark, 0, 0.02, 0.22, 7));
    this.jaw = this.box(0.085, 0.025, 0.05, mat("#a8586a"), 0, -0.075, 0.2);
    this.head.add(this.jaw);
    this.head.add(this.box(0.06, 0.012, 0.02, mat("#f2f2ee"), 0, -0.06, 0.225)); // the underbite shows a little tooth line
    // big round eyes with a highlight
    for (const s of [-1, 1]) {
      const eye = this.sphere(0.038, dark, s * 0.08, 0.07, 0.165, 8);
      eye.castShadow = false;
      this.head.add(eye);
      const hi = this.sphere(0.012, glow("#ffffff"), s * 0.08 + 0.014, 0.085, 0.198, 4);
      hi.castShadow = false;
      this.head.add(hi);
    }
    // topknot: fur gathered up and tied with a blue band
    this.head.add(this.sphere(0.075, tan, 0, 0.22, -0.01, 8));
    this.head.add(this.sphere(0.05, fur, 0.03, 0.27, 0.02, 7));
    this.head.add(this.mesh(G.cyl(0.045, 0.045, 0.03, 8), blue, 0, 0.2, 0.0));
    // ears: long, droopy, covered in tan fur
    this.earL = this.joint(-0.17, 0.1, -0.02, this.head);
    this.earR = this.joint(0.17, 0.1, -0.02, this.head);
    for (const [ear, s] of [[this.earL, -1], [this.earR, 1]] as const) {
      const e = this.mesh(G.sphere(0.07, 8), tan, s * 0.02, -0.12, 0);
      e.scale.set(0.8, 1.9, 1.0);
      ear.add(e);
      const tip = this.mesh(G.sphere(0.055, 7), tanDark, s * 0.03, -0.24, 0.01);
      tip.scale.set(0.8, 1.2, 0.9);
      ear.add(tip);
      ear.rotation.z = s * -0.18;
    }
    // collar with a gold tag
    const collar = this.mesh(G.cyl(0.13, 0.13, 0.035, 12), blue, 0, 0.42, 0.22);
    collar.rotation.x = 0.35;
    this.body.add(collar);
    this.body.add(this.box(0.04, 0.045, 0.012, mat("#d9b45b"), 0, 0.35, 0.33));

    // --- tail: a plume curled up over the back
    this.tail = this.joint(0, 0.5, -0.3);
    this.tail.add(this.sphere(0.08, fur, 0, 0.06, -0.04, 7));
    this.tail.add(this.sphere(0.09, fur, 0, 0.16, 0.0, 7));
    this.tail.add(this.sphere(0.085, tan, 0, 0.22, 0.09, 7));
    this.tail.add(this.sphere(0.07, fur, 0, 0.2, 0.19, 7));
    this.tail.add(this.sphere(0.06, furShade, -0.06, 0.12, 0.06, 6));
    this.tail.add(this.sphere(0.06, furShade, 0.06, 0.13, 0.05, 6));
    this.tail.add(this.sphere(0.05, fur, 0.03, 0.25, 0.02, 6));

    this.bake();
  }

  protected pose(dt: number) {
    const t = this.t;
    const m = this.move;

    // reset
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.head.position.set(0, 0.46, 0.3);
    this.tail.rotation.set(0, 0, 0);
    this.jaw.position.y = -0.075;
    this.legs.forEach((l) => l.rotation.set(0, 0, 0));
    this.earL.rotation.set(0, 0, 0.18);
    this.earR.rotation.set(0, 0, -0.18);

    if (this.ko) {
      this.body.rotation.z = 1.4;
      this.body.position.y = 0.05;
      return;
    }

    // sit when idle for a while
    if (m < 0.05) this.idleTime += dt;
    else this.idleTime = 0;
    this.sitting = this.idleTime > 4.5 && !this.action;

    // walk / trot
    const freq = 13;
    const sw = Math.sin(t * freq) * m;
    this.legs[0].rotation.x = sw * 0.9;
    this.legs[3].rotation.x = sw * 0.9;
    this.legs[1].rotation.x = -sw * 0.9;
    this.legs[2].rotation.x = -sw * 0.9;
    this.body.position.y = Math.abs(Math.cos(t * freq)) * 0.04 * m;
    this.head.rotation.x = -0.1 * m + Math.sin(t * freq * 2) * 0.05 * m;
    this.earL.rotation.x = -sw * 0.3;
    this.earR.rotation.x = sw * 0.3;

    // idle: tail wag, breathing, head tilt
    const wag = Math.sin(t * 9) * (0.35 + 0.4 * m);
    this.tail.rotation.y = wag;
    this.tail.rotation.x = -0.2;
    const breathe = Math.sin(t * 2.4) * 0.012;
    this.bodyMesh.scale.set(0.95 + breathe, 0.78 + breathe, 1.3);
    if (m < 0.05) {
      this.head.rotation.z = Math.sin(t * 0.8) * 0.12;
      this.head.rotation.y = Math.sin(t * 0.5) * 0.2;
    }
    if (this.sitting) {
      this.body.rotation.x = -0.35;
      this.body.position.y = -0.05;
      this.legs[2].rotation.x = -1.2;
      this.legs[3].rotation.x = -1.2;
      this.head.rotation.x = 0.25;
    }

    const a = this.action;
    if (!a) return;
    const ph = Math.min(1, a.t / a.dur);
    switch (a.name) {
      case "attack": {
        this.body.position.z = ease.bump(ph) * 0.8;
        this.body.position.y += ease.bump(ph) * 0.15;
        this.head.rotation.x = -0.3 + ease.bump(ph) * 0.5;
        this.jaw.position.y = -0.075 - ease.bump(Math.min(1, ph * 2)) * 0.05;
        break;
      }
      case "hit": {
        const k = ease.bump(ph);
        this.body.position.z = -0.25 * k;
        this.body.rotation.x = 0.3 * k;
        this.earL.rotation.z = 0.9 * k + 0.18;
        this.earR.rotation.z = -0.9 * k - 0.18;
        break;
      }
      case "bark": {
        const k = Math.sin(ph * Math.PI * 4);
        this.head.rotation.x = -0.35 * Math.abs(k);
        this.jaw.position.y = -0.075 - Math.abs(k) * 0.05;
        this.body.position.y += Math.abs(k) * 0.03;
        break;
      }
      case "sniff": {
        this.head.rotation.x = 0.75;
        this.head.position.y = 0.3;
        this.head.rotation.y = Math.sin(ph * Math.PI * 6) * 0.35;
        this.body.rotation.x = 0.12;
        this.tail.rotation.y = Math.sin(t * 16) * 0.6;
        break;
      }
      case "dig": {
        this.body.rotation.x = 0.35;
        this.head.rotation.x = 0.5;
        const k = Math.sin(ph * Math.PI * 12);
        this.legs[0].rotation.x = -0.6 + k * 0.9;
        this.legs[1].rotation.x = -0.6 - k * 0.9;
        break;
      }
      case "jump":
      case "cheer": {
        const k = ease.bump(ph);
        this.body.position.y += 0.35 * k;
        this.body.rotation.x = -0.4 * k;
        this.legs.forEach((l, i) => (l.rotation.x = (i < 2 ? -0.8 : 0.6) * k));
        this.tail.rotation.y = Math.sin(t * 18) * 0.7;
        break;
      }
      case "wave": {
        this.head.rotation.z = 0.3;
        this.legs[1].rotation.x = -1.2;
        break;
      }
      default:
        break;
    }
  }
}
