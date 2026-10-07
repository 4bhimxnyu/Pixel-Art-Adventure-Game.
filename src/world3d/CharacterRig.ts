// ---------------------------------------------------------------------------
// Procedural stylised human rig. Built from a CharSpec: proportions, outfit
// type (robe / dress / tee / jacket / tank / cardigan / vest / hoodie), sleeve
// style, hair style, cape, headdress, necklace, eyes, beard, glasses and hand
// props. Walk, idle variants (iPad, lifting, arms crossed, strumming), attack,
// hit, hug, cheer and knock-out are all procedural, so every character
// animates with no asset files. A GLB in public/models/<id>.glb replaces the
// body when present (see loadOverride).
//
// Silhouette first: shoulders, hips, belly, head size, sleeves, skirt and
// hair are what make a character recognisable from across a map.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { BaseRig, ease } from "./BaseRig";
import { charSpec, type CharSpec } from "./characters";
import { G, mat, glow, C, checkerMaterial } from "./materials";

type Parts = {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  handR: THREE.Group;
  handL: THREE.Group;
  /** Abhimanyu's white bass, slung on the back while walking. */
  guitar?: THREE.Group;
  /** The same bass held in front while he plays. */
  guitarFront?: THREE.Group;
  ipad?: THREE.Group;
  phone?: THREE.Group;
  dumbbell?: THREE.Group;
  cape?: THREE.Group;
};

type Dims = {
  legLen: number;
  torsoH: number;
  torsoW: number;
  waistW: number;
  torsoD: number;
  armT: number;
  armLen: number;
  headR: number;
  hipY: number;
};

export class CharacterRig extends BaseRig {
  readonly spec: CharSpec;
  private p!: Parts;
  private d!: Dims;
  private capeJoint: THREE.Group | null = null;
  private lookUpTimer = 0;
  private laughTimer = 0;
  private lookingUp = false;
  private override: { root: THREE.Object3D; mixer: THREE.AnimationMixer; clips: Record<string, THREE.AnimationAction> } | null = null;

  constructor(id: string) {
    super();
    this.spec = charSpec(id);
    this.idle = this.spec.idle ?? "default";
    this.build();
  }

  // ------------------------------------------------------------------ build

  private build() {
    const s = this.spec;
    const scale = s.height ?? 1;
    this.bodyScale = scale;
    this.body.scale.setScalar(scale);

    const b = s.build;
    const shoulders = (s.shoulders ?? 1) * (b === "muscular" ? 1.3 : b === "heavy" ? 1.25 : b === "slim" ? 0.92 : 1);
    const hips = (s.hips ?? 1) * (b === "heavy" ? 1.3 : b === "slim" ? 0.92 : 1);
    const belly = s.belly ?? (b === "heavy" ? 1.1 : 0);
    const headR = 0.2 * (s.headSize ?? 1);
    const legs = (s.legs ?? 1) * (b === "heavy" ? 0.9 : 1);
    const legLen = 0.54 * legs;
    const torsoH = 0.5;
    const torsoW = 0.4 * shoulders;
    const waistW = 0.33 * hips;
    const torsoD = 0.24 * (b === "heavy" ? 1.45 : b === "muscular" ? 1.2 : b === "slim" ? 0.92 : 1);
    const armT = 0.12 * (b === "muscular" ? 1.45 : b === "heavy" ? 1.2 : 1);
    const armLen = 0.46 * (b === "heavy" ? 0.95 : 1);
    const hipY = legLen;
    this.d = { legLen, torsoH, torsoW, waistW, torsoD, armT, armLen, headR, hipY };
    this.height = (hipY + torsoH + 0.05 + headR * 2.3) * scale;

    const skin = mat(s.skin);
    const top = mat(s.top);
    const topAlt = mat(s.topAlt);
    const bottom = mat(s.bottom);
    const trim = mat(s.trim);
    const hair = mat(s.hair);

    // --- hips / legs
    const hipsJ = this.joint(0, hipY, 0);
    const legL = this.joint(-waistW * 0.28, 0, 0, hipsJ);
    const legR = this.joint(waistW * 0.28, 0, 0, hipsJ);
    const legW = Math.max(0.13, waistW * 0.42) * (s.legWidth ?? 1);
    const skirted = s.outfit === "robe" || s.outfit === "dress";
    for (const leg of [legL, legR]) {
      if (s.bottomPattern === "checker") {
        // loose trouser leg: a flared tube so the checks wrap around and read at a distance
        const cloth = checkerMaterial(s.bottom, "#f2efe6");
        const tube = this.mesh(G.cyl(legW * 0.5, legW * 0.66, legLen - 0.05, 10), cloth, 0, -legLen / 2 + 0.02, 0);
        tube.scale.z = 0.9;
        leg.add(tube);
        leg.add(this.mesh(G.cyl(legW * 0.68, legW * 0.68, 0.035, 10), mat("#f2efe6"), 0, -legLen + 0.07, 0)); // cuff
      } else {
        leg.add(this.box(legW, legLen, legW * 1.1, bottom, 0, -legLen / 2, 0));
      }
      if (s.sneakers) {
        // chunky white trainers with a dark sole and a coloured tab
        const sw = Math.min(legW, 0.2) + 0.05;
        leg.add(this.box(sw, 0.1, sw * 1.15 + 0.1, mat("#f4f2ee"), 0, -legLen + 0.05, 0.05));
        leg.add(this.box(sw + 0.01, 0.035, sw * 1.15 + 0.11, mat("#2a2a30"), 0, -legLen + 0.012, 0.05));
        leg.add(this.box(sw * 0.5, 0.03, 0.03, mat(s.accent ?? s.trim), 0, -legLen + 0.11, -sw * 0.45 + 0.05));
      } else {
        leg.add(this.box(Math.min(legW, 0.2) + 0.02, 0.08, Math.min(legW, 0.2) * 1.1 + 0.07, mat(skirted ? C.charcoal : "#2a2222"), 0, -legLen + 0.04, 0.03));
      }
    }

    // --- torso
    const torso = this.joint(0, 0, 0, hipsJ);
    this.buildTorso(torso, top, topAlt, bottom, trim, skin, belly);
    if (b === "elder") torso.rotation.x = 0.08;

    // --- arms
    const shoulderY = torsoH - 0.04;
    const armL = this.joint(-(torsoW / 2 + armT / 2 + 0.01), shoulderY, 0, torso);
    const armR = this.joint(torsoW / 2 + armT / 2 + 0.01, shoulderY, 0, torso);
    const handL = this.joint(0, -armLen, 0, armL);
    const handR = this.joint(0, -armLen, 0, armR);
    for (const [arm, hand] of [[armL, handL], [armR, handR]] as const) {
      this.buildArm(arm, hand, top, topAlt, skin);
    }

    // --- head
    const head = this.joint(0, torsoH + 0.05, 0, torso);
    this.buildHead(head, skin, hair);

    this.p = { hips: hipsJ, torso, head, armL, armR, legL, legR, handL, handR, cape: this.capeJoint ?? undefined };
    this.buildProps(torso, handR, handL);
    this.bake();
  }

  private buildTorso(torso: THREE.Group, top: THREE.Material, topAlt: THREE.Material, bottom: THREE.Material, trim: THREE.Material, skin: THREE.Material, belly: number) {
    const s = this.spec;
    const { torsoH, torsoW, waistW, torsoD, legLen } = this.d;
    const b = s.build;

    // core body: wider at the shoulders than the waist; V-shape for the athlete
    if (b === "muscular") {
      torso.add(this.box(torsoW + 0.08, torsoH * 0.55, torsoD, top, 0, torsoH * 0.72, 0));
      torso.add(this.box(waistW, torsoH * 0.5, torsoD - 0.06, top, 0, torsoH * 0.25, 0));
      // chest plates read as "built" even in silhouette
      torso.add(this.box(torsoW * 0.42, 0.1, 0.05, top, -torsoW * 0.22, torsoH * 0.78, torsoD / 2));
      torso.add(this.box(torsoW * 0.42, 0.1, 0.05, top, torsoW * 0.22, torsoH * 0.78, torsoD / 2));
    } else {
      const chest = this.mesh(G.cyl(torsoW * 0.56, waistW * 0.56, torsoH, 10), top, 0, torsoH / 2, 0);
      chest.scale.z = torsoD / (torsoW * 1.1);
      torso.add(chest);
    }
    if (belly > 0) {
      const bl = this.sphere(waistW * 0.62 * belly, top, 0, torsoH * 0.3, torsoD * 0.3, 12);
      bl.scale.set(1.05, 0.85, 0.9);
      torso.add(bl);
    }

    switch (s.outfit) {
      case "tee": {
        torso.add(this.box(torsoW * 0.4, 0.05, torsoD * 0.7, trim, 0, torsoH - 0.01, 0.02)); // neckline
        torso.add(this.box(waistW * 1.05, 0.06, torsoD + 0.02, trim, 0, 0.04, 0)); // belt line
        break;
      }
      case "tank": {
        // bare shoulders: skin caps either side, narrow straps
        torso.add(this.sphere(torsoW * 0.22, skin, -torsoW * 0.4, torsoH - 0.03, 0, 8));
        torso.add(this.sphere(torsoW * 0.22, skin, torsoW * 0.4, torsoH - 0.03, 0, 8));
        torso.add(this.box(0.06, 0.12, torsoD * 0.8, top, -torsoW * 0.28, torsoH - 0.02, 0));
        torso.add(this.box(0.06, 0.12, torsoD * 0.8, top, torsoW * 0.28, torsoH - 0.02, 0));
        torso.add(this.box(waistW * 1.05, 0.06, torsoD + 0.02, trim, 0, 0.04, 0));
        break;
      }
      case "jacket":
      case "cardigan": {
        const longer = s.outfit === "cardigan" ? 0.14 : 0.02;
        const panelW = torsoW * 0.36;
        for (const side of [-1, 1]) {
          torso.add(this.box(panelW, torsoH + longer, 0.05, topAlt, side * torsoW * 0.33, (torsoH - longer) / 2 + 0.02, torsoD / 2 + 0.01));
          torso.add(this.box(0.05, torsoH + longer, torsoD + 0.04, topAlt, side * (torsoW / 2 + 0.01), (torsoH - longer) / 2 + 0.02, 0));
        }
        torso.add(this.box(torsoW + 0.06, torsoH + longer, 0.05, topAlt, 0, (torsoH - longer) / 2 + 0.02, -torsoD / 2 - 0.01));
        // collar / lapels
        torso.add(this.box(torsoW * 0.5, 0.07, 0.06, s.outfit === "cardigan" ? topAlt : trim, 0, torsoH, torsoD / 2 + 0.02));
        if (s.outfit === "cardigan") {
          for (let i = 0; i < 3; i++) torso.add(this.sphere(0.015, mat("#2a2020"), 0, torsoH * 0.6 - i * 0.12, torsoD / 2 + 0.05, 5));
        }
        break;
      }
      case "vest": {
        torso.add(this.box(torsoW * 0.9, torsoH * 0.9, torsoD + 0.06, top, 0, torsoH * 0.45, 0));
        torso.add(this.box(torsoW * 0.5, 0.06, torsoD * 0.6, topAlt, 0, torsoH - 0.01, 0.03)); // shirt collar
        torso.add(this.box(waistW * 1.05, 0.06, torsoD + 0.08, trim, 0, 0.05, 0));
        break;
      }
      case "hoodie": {
        const hood = this.sphere(torsoW * 0.42, topAlt, 0, torsoH + 0.02, -torsoD * 0.45, 10);
        hood.scale.set(1, 0.7, 0.9);
        torso.add(hood);
        torso.add(this.box(torsoW * 0.55, 0.14, 0.05, topAlt, 0, torsoH * 0.3, torsoD / 2 + 0.01)); // pocket
        torso.add(this.box(0.015, 0.16, 0.02, mat("#e8e2d0"), -0.04, torsoH * 0.72, torsoD / 2 + 0.02)); // drawstrings
        torso.add(this.box(0.015, 0.16, 0.02, mat("#e8e2d0"), 0.04, torsoH * 0.72, torsoD / 2 + 0.02));
        break;
      }
      case "robe":
      case "dress": {
        const skirt = (s.skirt ?? 1) * legLen;
        const flare = s.outfit === "dress" ? 0.95 : 0.8;
        const rt = waistW * 0.55;
        const rb = waistW * flare * (s.build === "heavy" ? 1.1 : 1);
        torso.add(this.mesh(G.cyl(rt, rb, skirt, 12), bottom, 0, -skirt / 2 + 0.04, 0));
        // sash + hem
        torso.add(this.mesh(G.cyl(rt + 0.015, rt + 0.03, 0.07, 12), trim, 0, 0.03, 0));
        torso.add(this.mesh(G.cyl(rb - 0.01, rb + 0.01, 0.035, 12), trim, 0, -skirt + 0.06, 0));
        // crossed collar
        for (const side of [-1, 1]) {
          const lapel = this.box(0.05, torsoH * 0.55, 0.03, trim, side * torsoW * 0.14, torsoH * 0.7, torsoD / 2 + 0.01);
          lapel.rotation.z = side * -0.5;
          torso.add(lapel);
        }
        if (s.outfit === "robe" && s.build !== "heavy") {
          torso.add(this.box(torsoW * 0.6, torsoH * 0.9, 0.03, topAlt, 0, torsoH * 0.45, -torsoD / 2 - 0.005));
        }
        break;
      }
    }

    if (s.necklace) {
      torso.add(this.mesh(G.cyl(0.085, 0.085, 0.02, 10), mat(s.accent ?? s.trim), 0, torsoH - 0.03, 0.02));
      torso.add(this.sphere(0.022, glow(s.accent ?? s.trim), 0, torsoH - 0.1, torsoD / 2 + 0.03, 6));
    }

    if (s.cape) {
      const capeJ = this.joint(0, torsoH - 0.02, -torsoD / 2 - 0.02, torso);
      const capeH = torsoH + legLen * 0.9;
      capeJ.add(this.mesh(G.box(torsoW * 1.25, capeH, 0.05), bottom, 0, -capeH / 2, -0.03));
      capeJ.add(this.box(torsoW * 1.3, 0.06, 0.06, trim, 0, -capeH + 0.03, -0.03));
      capeJ.add(this.box(torsoW * 1.3, 0.06, 0.06, trim, 0, -0.03, -0.03));
      capeJ.rotation.x = 0.1;
      this.capeJoint = capeJ;
    }
  }

  private buildArm(arm: THREE.Group, hand: THREE.Group, top: THREE.Material, topAlt: THREE.Material, skin: THREE.Material) {
    const s = this.spec;
    const { armT, armLen } = this.d;
    const sleeveMat = s.outfit === "tee" || s.outfit === "tank" || s.outfit === "hoodie" ? top : topAlt;
    switch (s.sleeves) {
      case "wide": {
        const k = s.sleeveScale ?? 1;
        arm.add(this.mesh(G.cyl(armT * 0.55, armT * 1.5 * k, armLen * 0.86, 10), sleeveMat, 0, -armLen * 0.43, 0));
        arm.add(this.mesh(G.cyl(armT * 1.5 * k + 0.01, armT * 1.5 * k + 0.01, 0.04, 10), mat(s.trim), 0, -armLen * 0.85, 0));
        break;
      }
      case "long":
        arm.add(this.box(armT, armLen * 0.95, armT, sleeveMat, 0, -armLen * 0.47, 0));
        break;
      case "short":
        arm.add(this.box(armT + 0.02, armLen * 0.45, armT + 0.02, sleeveMat, 0, -armLen * 0.22, 0));
        arm.add(this.box(armT * 0.85, armLen * 0.55, armT * 0.85, skin, 0, -armLen * 0.72, 0));
        break;
      case "none":
        arm.add(this.box(armT, armLen * 0.95, armT, skin, 0, -armLen * 0.47, 0));
        if (s.build === "muscular") arm.add(this.sphere(armT * 0.75, skin, 0, -armLen * 0.28, 0, 8));
        break;
    }
    hand.add(this.sphere(armT * 0.55, skin, 0, 0, 0, 6));
  }

  private buildHead(head: THREE.Group, skin: THREE.Material, hair: THREE.Material) {
    const s = this.spec;
    const headR = this.d.headR;
    const headMesh = this.mesh(G.sphere(headR, 12), skin, 0, headR, 0);
    headMesh.scale.set(s.build === "heavy" ? 1.1 : 1, s.build === "heavy" ? 1.0 : 1.06, 0.96);
    head.add(headMesh);
    head.add(this.mesh(G.cyl(0.055, 0.065, 0.1, 6), skin, 0, 0.0, 0)); // neck
    if (s.build === "heavy") head.add(this.sphere(headR * 0.55, skin, 0, headR * 0.35, headR * 0.35, 8)); // chin

    // face
    const eyeMat = glow("#141014");
    const almond = s.eyes !== "round";
    for (const side of [-1, 1]) {
      const eye = this.box(almond ? 0.075 : 0.055, almond ? 0.026 : 0.05, 0.02, eyeMat, side * headR * 0.38, headR + 0.02, headR - 0.015);
      if (almond) eye.rotation.z = side * -0.22;
      eye.castShadow = false;
      head.add(eye);
      const brow = this.box(0.07, 0.014, 0.015, hair, side * headR * 0.38, headR + 0.065, headR - 0.01);
      brow.rotation.z = side * -0.15;
      brow.castShadow = false;
      head.add(brow);
    }
    if (s.grin) {
      // a wide open grin: dark mouth, white teeth line, lifted corners
      const grin = this.box(0.12, 0.035, 0.015, mat("#6a2a38"), 0, headR - 0.07, headR - 0.01);
      grin.castShadow = false;
      head.add(grin);
      const teeth = this.box(0.1, 0.012, 0.016, mat("#f6f2ea"), 0, headR - 0.06, headR - 0.008);
      teeth.castShadow = false;
      head.add(teeth);
      for (const side of [-1, 1]) {
        const corner = this.box(0.025, 0.02, 0.015, mat("#6a2a38"), side * 0.068, headR - 0.055, headR - 0.012);
        corner.castShadow = false;
        head.add(corner);
      }
    } else {
      const mouth = this.box(0.05, 0.012, 0.015, mat("#a8586a"), 0, headR - 0.07, headR - 0.012);
      mouth.castShadow = false;
      head.add(mouth);
    }
    if (s.earrings) {
      // big hoops hanging from the ears
      const ring = new THREE.TorusGeometry(0.045, 0.007, 6, 14);
      for (const side of [-1, 1]) {
        const hoop = new THREE.Mesh(ring, mat(s.earrings));
        hoop.position.set(side * (headR + 0.01), headR - 0.06, 0.01);
        hoop.rotation.y = Math.PI / 2;
        hoop.castShadow = false;
        head.add(hoop);
      }
    }
    if (s.female) {
      head.add(this.box(0.04, 0.02, 0.012, mat("#e39cb2"), -headR * 0.55, headR - 0.03, headR - 0.03));
      head.add(this.box(0.04, 0.02, 0.012, mat("#e39cb2"), headR * 0.55, headR - 0.03, headR - 0.03));
    }
    if (s.glasses === "large") {
      // big black rounded-rectangular frames: a hollow frame per lens, a bridge, temple arms
      const gl = mat("#0e0e12");
      const lens = glow("#dfe8f2", 0.22);
      const lw = 0.12;
      const lh = 0.095;
      const t = 0.016;
      for (const side of [-1, 1]) {
        const cx = side * headR * 0.4;
        const cy = headR + 0.02;
        const z = headR + 0.008;
        head.add(this.box(lw, t, t, gl, cx, cy + lh / 2, z));
        head.add(this.box(lw, t, t, gl, cx, cy - lh / 2, z));
        head.add(this.box(t, lh, t, gl, cx - lw / 2, cy, z));
        head.add(this.box(t, lh, t, gl, cx + lw / 2, cy, z));
        const glass = this.box(lw - t, lh - t, 0.006, lens, cx, cy, z - 0.004);
        glass.castShadow = false;
        head.add(glass);
        // temple arm back along the side of the head
        head.add(this.box(t, t, headR * 1.1, gl, side * (headR * 0.4 + lw / 2), cy, headR * 0.45));
      }
      head.add(this.box(0.03, t, t, gl, 0, headR + 0.03, headR + 0.008));
    } else if (s.glasses) {
      const gl = mat("#2a2a30");
      head.add(this.box(0.2, 0.012, 0.012, gl, 0, headR + 0.02, headR + 0.01));
      head.add(this.mesh(G.cyl(0.045, 0.045, 0.012, 8), gl, -0.075, headR + 0.02, headR + 0.012)).rotation.x = Math.PI / 2;
      head.add(this.mesh(G.cyl(0.045, 0.045, 0.012, 8), gl, 0.075, headR + 0.02, headR + 0.012)).rotation.x = Math.PI / 2;
    }
    if (s.beard) {
      head.add(this.box(0.17, 0.09, 0.07, mat(s.beard), 0, headR - 0.11, headR - 0.07));
      head.add(this.box(0.1, 0.03, 0.03, mat(s.beard), 0, headR - 0.045, headR - 0.005));
    }
    this.buildHair(head, headR, hair);
  }

  private buildHair(head: THREE.Group, r: number, hair: THREE.Material) {
    const s = this.spec;
    const style = s.hairStyle;
    if (style === "bald") return;
    const cap = this.mesh(G.sphere(r + 0.018, 12), hair, 0, r + 0.025, -0.035);
    cap.scale.set(1, 0.92, 1);
    head.add(cap);
    const fringe = () => head.add(this.box(r * 1.3, 0.07, 0.08, hair, 0, r + 0.15, r - 0.03));
    const orn = mat(s.ornament ?? s.trim);

    switch (style) {
      case "crop":
        cap.scale.set(1.0, 0.72, 1.0);
        cap.position.y = r + 0.06;
        break;
      case "short":
        fringe();
        break;
      case "shoulder": {
        // straight, parted fringe, ends at the shoulders all the way round
        head.add(this.box(r * 0.9, 0.06, 0.08, hair, -r * 0.32, r + 0.16, r - 0.02));
        head.add(this.box(r * 0.7, 0.05, 0.08, hair, r * 0.42, r + 0.17, r - 0.02));
        head.add(this.box(r * 1.9, 0.38, 0.1, hair, 0, r - 0.05, -r + 0.03)); // back
        head.add(this.box(0.1, 0.36, r * 1.5, hair, -r + 0.01, r - 0.04, -0.02)); // sides
        head.add(this.box(0.1, 0.36, r * 1.5, hair, r - 0.01, r - 0.04, -0.02));
        // slightly inward-curled ends
        head.add(this.box(0.11, 0.05, r * 1.5, hair, -r + 0.03, r - 0.24, -0.02));
        head.add(this.box(0.11, 0.05, r * 1.5, hair, r - 0.03, r - 0.24, -0.02));
        break;
      }
      case "messy": {
        // medium length, tousled: a fuller cap, side panels and a tilted fringe over the forehead
        cap.scale.set(1.06, 1.0, 1.06);
        cap.position.y = r + 0.04;
        const strands: [number, number, number, number][] = [
          [-0.11, 0.1, 0.17, 0.35], [-0.03, 0.09, 0.19, -0.1], [0.06, 0.1, 0.18, 0.25], [0.13, 0.11, 0.15, -0.4],
        ];
        for (const [x, y, z, rz] of strands) {
          const st = this.box(0.075, 0.16, 0.05, hair, x, r + y, z);
          st.rotation.z = rz;
          st.rotation.x = 0.25;
          head.add(st);
        }
        head.add(this.box(0.09, 0.24, 0.16, hair, -r + 0.01, r + 0.02, -0.04));
        head.add(this.box(0.09, 0.24, 0.16, hair, r - 0.01, r + 0.02, -0.04));
        head.add(this.box(r * 1.6, 0.2, 0.1, hair, 0, r - 0.0, -r + 0.03));
        for (const [x, y, z, rz] of [[-0.12, 0.26, -0.06, 0.5], [0.1, 0.27, -0.1, -0.45], [0, 0.29, 0.02, 0.1]] as const) {
          const tuft = this.mesh(G.cone(0.045, 0.12, 5), hair, x, r + y, z);
          tuft.rotation.z = rz;
          head.add(tuft);
        }
        break;
      }
      case "spiky": {
        cap.scale.set(1.0, 0.8, 1.0);
        const spikes: [number, number, number, number][] = [
          [0, 0.19, -0.02, -0.25], [-0.09, 0.17, 0.02, 0.2], [0.09, 0.17, 0.02, -0.2], [-0.14, 0.12, -0.08, 0.5], [0.14, 0.12, -0.08, -0.5], [0.03, 0.16, -0.14, -0.7],
        ];
        for (const [x, y, z, rz] of spikes) {
          const sp = this.mesh(G.cone(0.05, 0.16, 5), hair, x, r + y + 0.05, z);
          sp.rotation.z = rz;
          sp.rotation.x = z < -0.05 ? -0.6 : 0.2;
          head.add(sp);
        }
        break;
      }
      case "long": {
        head.add(this.box(r * 1.7, 0.5, 0.1, hair, 0, r - 0.12, -r + 0.02));
        head.add(this.box(0.09, 0.34, 0.1, hair, -r + 0.02, r - 0.08, 0.03));
        head.add(this.box(0.09, 0.34, 0.1, hair, r - 0.02, r - 0.08, 0.03));
        fringe();
        if (s.ornament) {
          head.add(this.box(0.12, 0.03, 0.06, orn, 0, r + 0.17, -r + 0.04));
          head.add(this.box(0.03, 0.18, 0.02, orn, -0.04, r + 0.05, -r - 0.03));
          head.add(this.box(0.03, 0.18, 0.02, orn, 0.04, r + 0.05, -r - 0.03));
        }
        break;
      }
      case "ponytail": {
        fringe();
        head.add(this.sphere(0.07, hair, 0, r + 0.18, -r + 0.02, 8));
        head.add(this.mesh(G.cyl(0.04, 0.04, 0.05, 8), orn, 0, r + 0.15, -r - 0.02)).rotation.x = Math.PI / 2;
        const tail = this.mesh(G.cyl(0.055, 0.025, 0.55, 8), hair, 0, r - 0.15, -r - 0.05);
        tail.rotation.x = 0.18;
        head.add(tail);
        if (s.female) {
          head.add(this.box(0.08, 0.3, 0.09, hair, -r + 0.02, r - 0.05, 0.02));
          head.add(this.box(0.08, 0.3, 0.09, hair, r - 0.02, r - 0.05, 0.02));
          if (s.ornament) {
            const pin = this.box(0.16, 0.025, 0.025, orn, 0.1, r + 0.2, 0.02);
            pin.rotation.y = 0.5;
            head.add(pin);
            head.add(this.sphere(0.03, glow(s.accent ?? s.ornament), 0.17, r + 0.2, -0.02, 6));
          }
        }
        break;
      }
      case "braid": {
        fringe();
        for (let i = 0; i < 5; i++) head.add(this.sphere(0.05 - i * 0.004, hair, 0, r - 0.02 - i * 0.1, -r - 0.02 - i * 0.01, 7));
        head.add(this.box(0.05, 0.03, 0.03, orn, 0, r - 0.48, -r - 0.06));
        break;
      }
      case "bun":
        fringe();
        head.add(this.sphere(0.09, hair, 0, r + 0.2, -0.12, 8));
        if (s.ornament) head.add(this.box(0.22, 0.02, 0.02, orn, 0, r + 0.22, -0.12));
        break;
      case "messybun": {
        // a high, lopsided bun with a bright scrunchie, loose wavy strands and bits over the forehead
        cap.scale.set(1.04, 0.95, 1.04);
        const hi = mat(s.hairHi ?? s.hair);
        const bun = this.sphere(0.12, hair, 0.03, r + 0.33, -0.08, 9);
        bun.scale.set(1.15, 0.9, 1.05);
        head.add(bun);
        head.add(this.sphere(0.06, hi, 0.12, r + 0.38, -0.1, 7));
        head.add(this.sphere(0.055, hair, -0.08, r + 0.4, -0.04, 7));
        const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 6, 14), orn);
        scrunchie.position.set(0.03, r + 0.24, -0.08);
        scrunchie.rotation.x = Math.PI / 2 - 0.3;
        head.add(scrunchie);
        // loose wavy strands down the sides and neck
        for (const [x, y, z, rz, len] of [[-r + 0.02, r - 0.02, 0.03, 0.25, 0.3], [r - 0.02, r - 0.05, 0.0, -0.2, 0.26], [-r * 0.6, r - 0.1, -r + 0.04, 0.15, 0.22], [r * 0.5, r - 0.08, -r + 0.04, -0.3, 0.2]] as const) {
          const strand = this.box(0.05, len, 0.06, hair, x, y, z);
          strand.rotation.z = rz;
          head.add(strand);
        }
        // a few short bits over the forehead, kept above the brows so the face stays clear
        head.add(this.box(0.08, 0.04, 0.06, hair, -r * 0.5, r + 0.19, r - 0.04)).rotation.z = 0.35;
        head.add(this.box(0.06, 0.04, 0.06, hi, r * 0.05, r + 0.2, r - 0.03)).rotation.z = -0.2;
        head.add(this.box(0.05, 0.05, 0.05, hair, r * 0.55, r + 0.18, r - 0.04)).rotation.z = -0.5;
        break;
      }
      case "headdress": {
        fringe();
        head.add(this.sphere(0.13, hair, 0, r + 0.24, -0.06, 10));
        head.add(this.sphere(0.08, hair, -0.13, r + 0.14, -0.08, 8));
        head.add(this.sphere(0.08, hair, 0.13, r + 0.14, -0.08, 8));
        const gold = mat(s.accent ?? C.gold);
        for (let i = -2; i <= 2; i++) {
          const spike = this.mesh(G.cone(0.025, 0.2, 5), gold, i * 0.06, r + 0.42, -0.06);
          spike.rotation.z = -i * 0.22;
          head.add(spike);
        }
        head.add(this.box(0.34, 0.05, 0.05, gold, 0, r + 0.3, -0.04));
        head.add(this.box(0.3, 0.025, 0.025, orn, 0, r + 0.22, -0.06));
        for (const side of [-1, 1]) {
          head.add(this.mesh(G.cyl(0.012, 0.012, 0.3, 5), gold, side * 0.2, r - 0.02, -0.06));
          head.add(this.sphere(0.03, glow(s.ornament ?? C.brightgold), side * 0.2, r - 0.18, -0.06, 6));
        }
        break;
      }
      case "curly": {
        cap.scale.set(1.08, 0.85, 1.08);
        const hi = mat(s.hairHi ?? s.hair);
        const pts: [number, number, number][] = [
          [-0.14, 0.15, 0.1], [0.14, 0.15, 0.1], [0, 0.22, 0.08], [-0.17, 0.08, -0.08], [0.17, 0.08, -0.08],
          [-0.08, 0.23, -0.1], [0.08, 0.23, -0.1], [0, 0.12, -0.2], [-0.16, 0.16, -0.02], [0.16, 0.16, -0.02],
        ];
        pts.forEach(([x, y, z], i) => head.add(this.sphere(0.08, i % 3 === 0 ? hi : hair, x, r + y, z, 6)));
        break;
      }
      case "grey": {
        cap.scale.set(1.0, 0.78, 1.0);
        cap.position.y = r + 0.05;
        const hi = mat(s.hairHi ?? "#8a8290");
        head.add(this.box(0.05, 0.12, 0.12, hi, -r - 0.005, r - 0.0, -0.02));
        head.add(this.box(0.05, 0.12, 0.12, hi, r + 0.005, r - 0.0, -0.02));
        break;
      }
    }
  }

  private buildProps(torso: THREE.Group, handR: THREE.Group, handL: THREE.Group) {
    const props = this.spec.props ?? [];
    const { torsoD, torsoH } = this.d;
    if (props.includes("bass")) {
      const white = mat(C.white);
      const dark = mat("#1a1a1e");
      const mk = () => {
        const g = new THREE.Group();
        // offset double-cutaway body: large lower bout, smaller upper bout
        const lower = this.mesh(G.cyl(0.19, 0.19, 0.07, 14), white, 0, -0.05, 0);
        lower.rotation.x = Math.PI / 2;
        lower.scale.set(1, 1, 0.9);
        g.add(lower);
        const upper = this.mesh(G.cyl(0.14, 0.14, 0.07, 14), white, 0.02, 0.2, 0);
        upper.rotation.x = Math.PI / 2;
        g.add(upper);
        g.add(this.box(0.08, 0.16, 0.07, white, -0.13, 0.3, 0)); // horns
        g.add(this.box(0.08, 0.12, 0.07, white, 0.14, 0.28, 0));
        // pickups, bridge, controls
        g.add(this.box(0.16, 0.035, 0.03, dark, 0, 0.02, 0.04));
        g.add(this.box(0.16, 0.035, 0.03, dark, 0, -0.08, 0.04));
        g.add(this.box(0.12, 0.03, 0.03, dark, 0, -0.17, 0.04));
        g.add(this.sphere(0.012, dark, 0.12, -0.1, 0.045, 5));
        g.add(this.sphere(0.012, dark, 0.15, -0.14, 0.045, 5));
        // long bass neck and a 2+2 headstock with four tuning pegs
        g.add(this.box(0.065, 0.92, 0.04, mat("#d8d4cc"), 0, 0.76, 0));
        g.add(this.box(0.065, 0.92, 0.012, mat("#2a2024"), 0, 0.76, 0.024)); // fretboard
        g.add(this.box(0.09, 0.2, 0.035, white, 0.01, 1.3, 0));
        for (const [x, y] of [[-0.065, 1.26], [-0.065, 1.34], [0.075, 1.26], [0.075, 1.34]] as const) {
          g.add(this.mesh(G.cyl(0.012, 0.012, 0.035, 6), dark, x, y, 0)).rotation.z = Math.PI / 2;
        }
        // four thick strings
        for (let i = 0; i < 4; i++) g.add(this.box(0.006, 1.35, 0.004, mat("#bdbdb8"), -0.024 + i * 0.016, 0.55, 0.034));
        return g;
      };
      // a bass is about two-thirds of a person: scaled to the rig
      const back = mk();
      back.scale.setScalar(0.72);
      back.position.set(0.1, 0.0, -torsoD / 2 - 0.08);
      back.rotation.set(0.1, Math.PI, -0.4);
      torso.add(back);
      const front = mk();
      front.scale.setScalar(0.72);
      front.position.set(-0.12, 0.05, torsoD / 2 + 0.1);
      front.rotation.set(0.15, 0.1, 1.25);
      front.visible = false;
      torso.add(front);
      const strap = this.box(0.05, torsoH * 1.1, 0.02, mat("#2a2024"), 0, torsoH * 0.5, torsoD / 2 + 0.03);
      strap.rotation.z = 0.6;
      torso.add(strap);
      this.p.guitar = back;
      this.p.guitarFront = front;
    }
    if (props.includes("ipad")) {
      const pad = new THREE.Group();
      pad.add(this.box(0.3, 0.02, 0.22, mat("#2a2d38"), 0, 0, 0));
      const screen = this.box(0.27, 0.012, 0.19, glow("#9fd0ff"), 0, 0.012, 0);
      screen.castShadow = false;
      pad.add(screen);
      pad.position.set(-0.17, -0.02, 0.1);
      pad.rotation.x = -0.6;
      handR.add(pad);
      this.p.ipad = pad;
    }
    if (props.includes("phone")) {
      // a phone in the right hand, screen lit, angled toward the face
      const ph = new THREE.Group();
      ph.add(this.box(0.075, 0.15, 0.012, mat("#15151a"), 0, 0, 0));
      const screen = this.box(0.065, 0.135, 0.006, glow("#bfe3ff"), 0, 0, 0.007);
      screen.castShadow = false;
      ph.add(screen);
      ph.position.set(-0.03, 0.03, 0.07);
      ph.rotation.set(-0.9, 0.35, 0.15);
      handR.add(ph);
      this.p.phone = ph;
    }
    if (props.includes("staff")) {
      handR.add(this.mesh(G.cyl(0.02, 0.025, 1.7, 6), mat(C.wood2), 0, 0.5, 0));
      handR.add(this.sphere(0.05, mat(C.gold), 0, 1.35, 0, 6));
    }
    if (props.includes("fan")) {
      const fan = new THREE.Group();
      for (let i = -3; i <= 3; i++) {
        const blade = this.box(0.03, 0.22, 0.008, mat(this.spec.accent ?? C.brightgold), 0, 0.11, 0);
        blade.rotation.z = i * 0.22;
        fan.add(blade);
      }
      fan.add(this.box(0.3, 0.06, 0.01, mat(C.crimson), 0, 0.2, 0.004));
      fan.position.set(0.05, 0, 0.05);
      fan.rotation.z = 0.4;
      handL.add(fan);
    }
    if (this.idle === "lift") {
      const d = new THREE.Group();
      d.add(this.mesh(G.cyl(0.015, 0.015, 0.3, 6), mat("#9a9aa0"), 0, 0, 0)).rotation.z = Math.PI / 2;
      d.add(this.mesh(G.cyl(0.06, 0.06, 0.05, 8), mat("#2a2a30"), -0.13, 0, 0)).rotation.z = Math.PI / 2;
      d.add(this.mesh(G.cyl(0.06, 0.06, 0.05, 8), mat("#2a2a30"), 0.13, 0, 0)).rotation.z = Math.PI / 2;
      handR.add(d);
      this.p.dumbbell = d;
    }
  }

  // ----------------------------------------------------------- GLB override

  async loadOverride(url: string) {
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(url);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      const mixer = new THREE.AnimationMixer(root);
      const clips: Record<string, THREE.AnimationAction> = {};
      for (const c of gltf.animations) clips[c.name.toLowerCase()] = mixer.clipAction(c);
      this.body.visible = false;
      this.group.add(root);
      this.override = { root, mixer, clips };
      clips.idle?.play();
    } catch {
      /* keep the procedural rig */
    }
  }

  // ------------------------------------------------------------------- pose

  protected pose(dt: number) {
    if (this.override) {
      const o = this.override;
      o.mixer.update(dt);
      const walk = o.clips.walk ?? o.clips.run;
      if (walk && o.clips.idle) {
        walk.enabled = true;
        walk.setEffectiveWeight(this.move);
        o.clips.idle.setEffectiveWeight(1 - this.move);
        if (!walk.isRunning()) walk.play();
      }
      return;
    }
    const p = this.p;
    const t = this.t;
    const m = this.move;
    const baseHip = this.d.hipY;

    // reset
    p.hips.position.y = baseHip;
    p.hips.position.x = 0;
    p.hips.rotation.set(0, 0, 0);
    p.torso.rotation.set(this.spec.build === "elder" ? 0.08 : 0, 0, 0);
    p.torso.position.y = 0;
    p.head.rotation.set(0, 0, 0);
    p.armL.rotation.set(0, 0, 0.06);
    p.armR.rotation.set(0, 0, -0.06);
    p.legL.rotation.set(0, 0, 0);
    p.legR.rotation.set(0, 0, 0);
    p.handR.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    if (p.guitar) p.guitar.visible = true;
    if (p.guitarFront) p.guitarFront.visible = false;
    if (p.cape) p.cape.rotation.x = 0.1;

    if (this.ko) {
      this.body.rotation.x = -1.35;
      this.body.position.y = 0.25;
      p.armL.rotation.z = 0.9;
      p.armR.rotation.z = -0.9;
      return;
    }

    // --- walk cycle
    const freq = 9;
    const sw = Math.sin(t * freq) * m;
    p.legL.rotation.x = sw * 0.75;
    p.legR.rotation.x = -sw * 0.75;
    p.armL.rotation.x = -sw * 0.55;
    p.armR.rotation.x = sw * 0.55;
    p.hips.position.y += Math.abs(Math.cos(t * freq)) * 0.035 * m * (this.spec.bounce ?? 1);
    p.torso.rotation.y = sw * 0.08;
    p.hips.rotation.z = -sw * 0.03;
    if (p.cape) p.cape.rotation.x = 0.1 + m * 0.25 + Math.sin(t * freq) * 0.04 * m;

    // --- idle
    const breathe = Math.sin(t * 2.1) * 0.012;
    p.torso.position.y = breathe * (1 - m);
    p.head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - m);
    p.armL.rotation.x += Math.sin(t * 1.3) * 0.03 * (1 - m);
    p.armR.rotation.x += Math.sin(t * 1.3 + 1) * 0.03 * (1 - m);

    const idleW = 1 - m;
    switch (this.idle) {
      case "ipad": {
        this.lookUpTimer += dt;
        if (!this.lookingUp && this.lookUpTimer > 5.5) { this.lookingUp = true; this.lookUpTimer = 0; }
        if (this.lookingUp && this.lookUpTimer > 1.8) { this.lookingUp = false; this.lookUpTimer = 0; }
        p.armR.rotation.x += -1.25 * idleW;
        p.armR.rotation.z += -0.3 * idleW;
        p.armL.rotation.x += -1.2 * idleW;
        p.armL.rotation.z += 0.45 * idleW;
        p.head.rotation.x = (this.lookingUp ? 0.02 : 0.42 + Math.sin(t * 3) * 0.02) * idleW;
        break;
      }
      case "phone": {
        // scrolling with the thumb, head down at the screen, the odd laugh and head tilt
        this.laughTimer += dt;
        if (this.laughTimer > 7 && !this.action) {
          this.laughTimer = 0;
          this.play("cheer", 0.45);
        }
        p.armR.rotation.x += (-1.6 + Math.sin(t * 5.5) * 0.02) * idleW;
        p.armR.rotation.z += -0.6 * idleW;
        p.handR.rotation.y = Math.sin(t * 6) * 0.08 * idleW; // thumb scroll
        p.armL.rotation.x += -0.25 * idleW;
        p.armL.rotation.z += 0.2 * idleW;
        p.head.rotation.x = (0.2 + Math.sin(t * 2.6) * 0.03) * idleW;
        p.head.rotation.z = Math.sin(t * 0.9) * 0.1 * idleW;
        this.body.rotation.z = Math.sin(t * 1.1) * 0.025 * idleW;
        break;
      }
      case "lift": {
        const curl = (Math.sin(t * 1.6) + 1) / 2;
        p.armR.rotation.x += (-0.3 - ease.inOut(curl) * 1.9) * idleW;
        p.armR.rotation.z += -0.1 * idleW;
        p.torso.rotation.z = Math.sin(t * 1.6) * 0.02 * idleW;
        break;
      }
      case "crossed": {
        p.armL.rotation.x += -1.35 * idleW;
        p.armL.rotation.z += 1.0 * idleW;
        p.armR.rotation.x += -1.15 * idleW;
        p.armR.rotation.z += -1.0 * idleW;
        p.head.rotation.x = Math.sin(t * 0.9) * 0.04 * idleW;
        break;
      }
      case "lean": {
        this.body.rotation.z = 0.06 * idleW;
        p.hips.position.x = -0.03 * idleW;
        p.armL.rotation.z += 0.25 * idleW;
        break;
      }
      case "strum": {
        if (p.guitar && p.guitarFront) {
          p.guitar.visible = m > 0.3;
          p.guitarFront.visible = m <= 0.3;
        }
        p.armR.rotation.x += (-0.9 + Math.sin(t * 7) * 0.15) * idleW;
        p.armR.rotation.z += -0.4 * idleW;
        p.armL.rotation.x += -1.1 * idleW;
        p.armL.rotation.z += 0.8 * idleW;
        p.head.rotation.x = 0.15 * idleW;
        p.head.rotation.z = Math.sin(t * 1.8) * 0.06 * idleW;
        break;
      }
      case "sway": {
        this.body.rotation.z = Math.sin(t * 1.4) * 0.04 * idleW;
        p.armR.rotation.x += -1.0 * idleW;
        p.armR.rotation.z += -0.5 * idleW;
        p.head.rotation.x = -0.12 * idleW;
        p.head.rotation.z = Math.sin(t * 1.4) * 0.08 * idleW;
        break;
      }
      default:
        break;
    }

    // --- one-shot actions
    const a = this.action;
    if (!a) return;
    const ph = Math.min(1, a.t / a.dur);
    switch (a.name) {
      case "attack": {
        const lunge = ease.bump(ph) * 0.7;
        this.body.position.z = lunge;
        p.armR.rotation.x = -0.4 - ease.bump(Math.min(1, ph * 1.3)) * 1.9;
        p.armL.rotation.x = 0.6 * ease.bump(ph);
        p.torso.rotation.y = -0.5 * ease.bump(ph);
        p.torso.rotation.x = 0.2 * ease.bump(ph);
        break;
      }
      case "hit": {
        const k = ease.bump(ph);
        this.body.position.z = -0.25 * k;
        p.torso.rotation.x = -0.35 * k;
        p.head.rotation.x = -0.3 * k;
        p.armL.rotation.z = -0.6 * k;
        p.armR.rotation.z = 0.6 * k;
        break;
      }
      case "cheer":
      case "jump": {
        const k = ease.bump(ph);
        this.body.position.y = 0.3 * k;
        p.armL.rotation.x = -2.8 * k;
        p.armR.rotation.x = -2.8 * k;
        p.armL.rotation.z = 0.3 * k;
        p.armR.rotation.z = -0.3 * k;
        break;
      }
      case "wave": {
        p.armR.rotation.x = -2.6;
        p.armR.rotation.z = -0.3 + Math.sin(ph * 20) * 0.35;
        break;
      }
      case "hug": {
        const k = ease.out(Math.min(1, ph * 2.2));
        p.armL.rotation.x = -1.35 * k;
        p.armL.rotation.z = 0.55 * k;
        p.armR.rotation.x = -1.2 * k;
        p.armR.rotation.z = -0.5 * k;
        p.head.rotation.z = 0.18 * k;
        p.head.rotation.x = 0.12 * k;
        p.torso.rotation.x = 0.08 * k;
        this.body.position.z = 0.08 * k;
        break;
      }
      case "enrage": {
        const k = ease.bump(ph);
        p.armL.rotation.x = -1.5 * k;
        p.armR.rotation.x = -1.5 * k;
        p.armL.rotation.z = 0.8 * k;
        p.armR.rotation.z = -0.8 * k;
        p.torso.rotation.x = -0.2 * k;
        this.body.position.y = 0.1 * k;
        if (p.cape) p.cape.rotation.x = 0.1 + 0.5 * k;
        break;
      }
      default:
        break;
    }
  }
}
