// ---------------------------------------------------------------------------
// Mimo — a Shih Tzu. Fluffy white body with tan patches on the ears and back,
// a curled tail that wags, dark round eyes and a little black nose. Walks,
// sits when bored, sniffs, barks, digs, jumps, bites (battle), and wags.
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
    const fur = mat(tint === "white" ? "#f4f2ea" : "#d9d4c6");
    const furShade = mat(tint === "white" ? "#e3dfd2" : "#c3bdae");
    const tan = mat("#c9a06a");
    const dark = glow("#141014");

    // body: a fluffy ellipsoid (own joint: it breathes by scaling, so it stays unbaked)
    const bodyJoint = this.joint(0, 0, 0);
    this.bodyMesh = this.mesh(G.sphere(0.26, 12), fur, 0, 0.34, -0.02);
    this.bodyMesh.scale.set(0.95, 0.78, 1.3);
    bodyJoint.add(this.bodyMesh);
    const saddle = this.mesh(G.sphere(0.2, 10), tan, 0, 0.46, -0.08);
    saddle.scale.set(0.9, 0.45, 1.05);
    this.body.add(saddle);
    const chest = this.mesh(G.sphere(0.2, 10), furShade, 0, 0.26, 0.2);
    chest.scale.set(0.9, 0.7, 0.8);
    this.body.add(chest);

    // legs: short fluffy stubs
    const legPos: [number, number][] = [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]];
    for (const [x, z] of legPos) {
      const j = this.joint(x, 0.22, z);
      j.add(this.mesh(G.cyl(0.06, 0.075, 0.22, 7), fur, 0, -0.11, 0));
      j.add(this.sphere(0.07, furShade, 0, -0.21, 0.01, 6));
      this.legs.push(j);
    }

    // head
    this.head = this.joint(0, 0.46, 0.3);
    const skull = this.mesh(G.sphere(0.19, 12), fur, 0, 0.05, 0.02);
    skull.scale.set(1.05, 0.95, 1);
    this.head.add(skull);
    // muzzle (fluffy)
    const muzzle = this.mesh(G.sphere(0.12, 10), furShade, 0, -0.03, 0.17);
    muzzle.scale.set(1.1, 0.8, 0.9);
    this.head.add(muzzle);
    // nose + mouth
    this.head.add(this.sphere(0.035, dark, 0, 0.01, 0.28, 6));
    this.jaw = this.box(0.08, 0.02, 0.06, mat("#a8586a"), 0, -0.07, 0.24);
    this.head.add(this.jaw);
    // eyes
    for (const s of [-1, 1]) {
      const eye = this.sphere(0.03, dark, s * 0.075, 0.08, 0.16, 6);
      eye.castShadow = false;
      this.head.add(eye);
      const hi = this.sphere(0.01, glow("#ffffff"), s * 0.075 + 0.012, 0.09, 0.185, 4);
      hi.castShadow = false;
      this.head.add(hi);
    }
    // topknot (shih tzu fringe tied up)
    this.head.add(this.sphere(0.07, tan, 0, 0.22, -0.02, 7));
    this.head.add(this.box(0.06, 0.02, 0.02, mat("#b3252f"), 0, 0.26, 0.0));
    // ears: long and droopy, tan
    this.earL = this.joint(-0.17, 0.12, 0.0, this.head);
    this.earR = this.joint(0.17, 0.12, 0.0, this.head);
    const earGeo = G.box(0.07, 0.22, 0.09);
    const eL = this.mesh(earGeo, tan, 0, -0.1, 0);
    const eR = this.mesh(earGeo, tan, 0, -0.1, 0);
    this.earL.add(eL);
    this.earR.add(eR);
    this.earL.rotation.z = 0.25;
    this.earR.rotation.z = -0.25;

    // tail: curled over the back
    this.tail = this.joint(0, 0.5, -0.32);
    const t1 = this.mesh(G.sphere(0.075, 7), fur, 0, 0.06, -0.03);
    const t2 = this.mesh(G.sphere(0.065, 7), tan, 0, 0.14, 0.03);
    const t3 = this.mesh(G.sphere(0.05, 7), fur, 0, 0.17, 0.1);
    this.tail.add(t1, t2, t3);
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
    this.jaw.position.y = -0.07;
    this.legs.forEach((l) => l.rotation.set(0, 0, 0));
    this.earL.rotation.set(0, 0, 0.25);
    this.earR.rotation.set(0, 0, -0.25);

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
        // lunge + bite
        this.body.position.z = ease.bump(ph) * 0.8;
        this.body.position.y += ease.bump(ph) * 0.15;
        this.head.rotation.x = -0.3 + ease.bump(ph) * 0.5;
        this.jaw.position.y = -0.07 - ease.bump(Math.min(1, ph * 2)) * 0.05;
        break;
      }
      case "hit": {
        const k = ease.bump(ph);
        this.body.position.z = -0.25 * k;
        this.body.rotation.x = 0.3 * k;
        this.earL.rotation.z = 0.9 * k + 0.25;
        this.earR.rotation.z = -0.9 * k - 0.25;
        break;
      }
      case "bark": {
        const k = Math.sin(ph * Math.PI * 4);
        this.head.rotation.x = -0.35 * Math.abs(k);
        this.jaw.position.y = -0.07 - Math.abs(k) * 0.05;
        this.body.position.y += Math.abs(k) * 0.03;
        break;
      }
      case "sniff": {
        // nose to the ground, sweeping side to side
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
        // a tilt of the head and one raised paw
        this.head.rotation.z = 0.3;
        this.legs[1].rotation.x = -1.2;
        break;
      }
      default:
        break;
    }
  }
}
