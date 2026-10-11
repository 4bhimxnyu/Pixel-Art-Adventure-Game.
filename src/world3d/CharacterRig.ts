// ---------------------------------------------------------------------------
// Procedural stylised human rig. Built from a CharSpec: proportions, outfit
// type (robe / dress / tee / jacket / tank / cardigan / vest / hoodie / polo),
// sleeve style, hair style, cape, headdress, necklace, eyes, beard, glasses
// and hand props. Walk, idle variants (iPad, lifting, arms crossed, hands on
// hips, stretching, strumming), attack, hit, hug, cheer and knock-out are all
// procedural, so every character animates with no asset files. A GLB in
// public/models/<id>.glb replaces the body when present (see loadOverride).
//
// Silhouette first: shoulders, hips, belly, head size, sleeves, skirt and
// hair are what make a character recognisable from across a map. Up close
// the face carries it: every head is built on the same skull model (see
// buildHead: one smooth egg) so eyes, brows, nose, lips and the hairline
// always land on the skin, and every hair style is layered on the same scalp cap.
//
// Arms have an elbow: shoulder joint -> forearm joint -> hand joint, so idles
// can fold arms, rest hands on hips or hold things in front of the chest.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { BaseRig, ease } from "./BaseRig";
import { charSpec, type CharSpec } from "./characters";
import { G, mat, glow, C, checkerMaterial } from "./materials";

/** Whole-head scale: faces are built at skull radius HR and shrunk to adult proportion. */
const HEAD_K = 0.72;
/**
 * Skull radius the head is built at. Everything in buildHead / buildHair is in
 * these units: skull centre (0, 0.25, 0), eyes at y 0.255, brows 0.31,
 * hairline 0.36, skull top 0.46, chin bottom 0.01, mouth 0.14.
 */
const HR = 0.2;

function shade(hex: string, k: number) {
  return "#" + new THREE.Color(hex).multiplyScalar(k).getHexString();
}
function mix(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

type Parts = {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
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
    // The head is built in its own units (skull radius HR) and scaled down as a
    // whole, so faces, hair and glasses keep their detail while the body gets
    // adult proportions: about five and a half heads tall.
    const headK = HEAD_K * (s.headSize ?? 1);
    const legs = (s.legs ?? 1) * (b === "heavy" ? 0.9 : 1);
    const legLen = 0.68 * legs;
    const torsoH = 0.56;
    const torsoW = 0.36 * shoulders;
    const waistW = 0.29 * hips;
    const torsoD = 0.2 * (b === "heavy" ? 1.45 : b === "muscular" ? 1.2 : b === "slim" ? 0.92 : 1);
    const armT = 0.095 * (b === "muscular" ? 1.45 : b === "heavy" ? 1.2 : 1);
    const armLen = 0.6 * (b === "heavy" ? 0.95 : 1);
    const hipY = legLen;
    this.d = { legLen, torsoH, torsoW, waistW, torsoD, armT, armLen, hipY };
    this.height = (hipY + torsoH + 0.07 + 0.5 * headK) * scale;

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
    this.buildLegs([legL, legR], bottom, skin);

    // --- torso
    const torso = this.joint(0, 0, 0, hipsJ);
    this.buildTorso(torso, top, topAlt, bottom, trim, skin, belly);
    if (b === "elder") torso.rotation.x = 0.08;

    // --- arms: shoulder -> forearm -> hand
    const shoulderY = torsoH - 0.04;
    const armL = this.joint(-(torsoW / 2 + armT / 2 + 0.01), shoulderY, 0, torso);
    const armR = this.joint(torsoW / 2 + armT / 2 + 0.01, shoulderY, 0, torso);
    const foreL = this.joint(0, -armLen * 0.5, 0, armL);
    const foreR = this.joint(0, -armLen * 0.5, 0, armR);
    const handL = this.joint(0, -armLen * 0.5, 0, foreL);
    const handR = this.joint(0, -armLen * 0.5, 0, foreR);
    this.buildArm(armL, foreL, handL, -1, top, topAlt, skin);
    this.buildArm(armR, foreR, handR, 1, top, topAlt, skin);

    // --- neck + head
    torso.add(this.mesh(G.cyl(0.045, 0.058, 0.12, 8), skin, 0, torsoH + 0.03, 0));
    const head = this.joint(0, torsoH + 0.07, 0, torso);
    head.scale.setScalar(headK);
    this.buildHead(head, skin, hair);

    this.p = { hips: hipsJ, torso, head, armL, armR, foreL, foreR, legL, legR, handL, handR, cape: this.capeJoint ?? undefined };
    this.buildProps(torso, handR, handL);
    this.bake();
  }

  private buildLegs(legsJ: THREE.Group[], bottom: THREE.Material, skin: THREE.Material) {
    const s = this.spec;
    const { legLen, waistW } = this.d;
    const legW = Math.max(0.13, waistW * 0.42) * (s.legWidth ?? 1);
    const skirted = s.outfit === "robe" || s.outfit === "dress";
    const seam = mat(shade(s.bottom, 0.7));
    const hem = mat(shade(s.bottom, 0.86));
    const footwear = s.footwear ?? (s.sneakers ? "sneakers" : "shoes");
    for (const leg of legsJ) {
      const outer = leg.position.x < 0 ? -1 : 1;
      if (s.bottomPattern === "checker") {
        // loose trouser leg: a flared tube so the checks wrap around and read at a distance
        const cloth = checkerMaterial(s.bottom, "#f2efe6");
        const tube = this.mesh(G.cyl(legW * 0.5, legW * 0.66, legLen - 0.05, 10), cloth, 0, -legLen / 2 + 0.02, 0);
        tube.scale.z = 0.9;
        leg.add(tube);
        leg.add(this.mesh(G.cyl(legW * 0.68, legW * 0.68, 0.035, 10), mat("#f2efe6"), 0, -legLen + 0.07, 0)); // cuff
      } else {
        const tube = this.mesh(G.cyl(legW * 0.5, legW * 0.6, legLen - 0.04, 10), bottom, 0, -legLen / 2 + 0.02, 0);
        tube.scale.z = 1.05;
        leg.add(tube);
        if (!skirted) {
          // outer seam line follows the flare of the leg, plus a turned hem
          const sm = this.box(0.012, legLen - 0.1, 0.022, seam, outer * (legW * 0.55 + 0.004), -legLen / 2 + 0.02, 0);
          sm.rotation.z = outer * Math.atan((legW * 0.1) / legLen);
          sm.castShadow = false;
          leg.add(sm);
          leg.add(this.mesh(G.cyl(legW * 0.63, legW * 0.63, 0.035, 10), hem, 0, -legLen + 0.06, 0)).scale.z = 1.05;
        }
      }
      const fl = Math.min(legW, 0.2);
      switch (footwear) {
        case "sneakers": {
          // chunky white trainers with a dark sole and a coloured tab
          const sw = fl + 0.05;
          leg.add(this.box(sw, 0.1, sw * 1.15 + 0.1, mat("#f4f2ee"), 0, -legLen + 0.05, 0.05));
          leg.add(this.box(sw + 0.01, 0.035, sw * 1.15 + 0.11, mat("#2a2a30"), 0, -legLen + 0.012, 0.05));
          leg.add(this.box(sw * 0.5, 0.03, 0.03, mat(s.accent ?? s.trim), 0, -legLen + 0.11, -sw * 0.45 + 0.05));
          leg.add(this.box(0.01, 0.06, sw * 0.5, mat("#d8d4cc"), outer * sw * 0.5, -legLen + 0.06, 0.08)); // side stripe
          break;
        }
        case "sandals": {
          leg.add(this.box(fl + 0.02, 0.025, fl * 1.1 + 0.08, mat("#8a6a48"), 0, -legLen + 0.012, 0.04)); // sole
          leg.add(this.box(fl * 0.8, 0.045, fl + 0.06, skin, 0, -legLen + 0.045, 0.04)); // foot
          leg.add(this.box(fl + 0.02, 0.022, 0.03, mat("#4a3a30"), 0, -legLen + 0.07, 0.06)); // strap
          break;
        }
        case "boots": {
          const dark = mat(C.charcoal);
          leg.add(this.box(fl + 0.02, 0.16, fl * 1.1 + 0.07, dark, 0, -legLen + 0.08, 0.03));
          leg.add(this.box(fl + 0.03, 0.03, fl * 1.1 + 0.08, mat("#1a1416"), 0, -legLen + 0.015, 0.03));
          break;
        }
        default: {
          const shoe = mat(skirted ? C.charcoal : "#2a2222");
          leg.add(this.box(fl + 0.02, 0.07, fl * 1.1 + 0.06, shoe, 0, -legLen + 0.035, 0.03));
          const toe = this.sphere(fl * 0.5 + 0.01, shoe, 0, -legLen + 0.035, fl * 0.55 + 0.06, 7);
          toe.scale.set(1, 0.65, 0.9);
          leg.add(toe);
          leg.add(this.box(fl + 0.025, 0.02, fl * 1.1 + 0.07, mat("#151012"), 0, -legLen + 0.01, 0.03)); // sole
        }
      }
    }
  }

  private buildTorso(torso: THREE.Group, top: THREE.Material, topAlt: THREE.Material, bottom: THREE.Material, trim: THREE.Material, skin: THREE.Material, belly: number) {
    const s = this.spec;
    const { torsoH, torsoW, waistW, torsoD, legLen } = this.d;
    const b = s.build;
    const chestZ = torsoD / (torsoW * 1.1);
    const trousers = !(s.outfit === "robe" || s.outfit === "dress");

    // core body: wider at the shoulders than the waist; V-shape for the athlete.
    // Under a vest the body is the shirt (topAlt), so the vest reads as a layer over it.
    const bodyMat = s.outfit === "vest" ? topAlt : top;
    if (b === "muscular") {
      torso.add(this.box(torsoW + 0.08, torsoH * 0.55, torsoD, bodyMat, 0, torsoH * 0.72, 0));
      torso.add(this.box(waistW, torsoH * 0.5, torsoD - 0.06, bodyMat, 0, torsoH * 0.25, 0));
      // chest plates read as "built" even in silhouette
      torso.add(this.box(torsoW * 0.42, 0.1, 0.05, bodyMat, -torsoW * 0.22, torsoH * 0.78, torsoD / 2));
      torso.add(this.box(torsoW * 0.42, 0.1, 0.05, bodyMat, torsoW * 0.22, torsoH * 0.78, torsoD / 2));
    } else {
      // with a belly the chest flares toward the waist so the shirt drapes over the gut
      const flare = belly > 0 ? 1 + 0.06 * Math.min(belly, 1.4) : 1;
      const chest = this.mesh(G.cyl(torsoW * 0.56, waistW * 0.56 * flare, torsoH, 12), bodyMat, 0, torsoH / 2, 0);
      chest.scale.z = chestZ;
      torso.add(chest);
    }
    if (belly > 0) {
      // a round gut under the shirt: centred, the shirt's own material, and sunk into
      // the chest so only a smooth bulge comes through the front, 0.035 proud of it
      const br = Math.min(waistW * 0.42 * Math.min(belly, 1.4), torsoH * 0.36);
      const chestFront = waistW * 0.56 * chestZ;
      const bl = this.sphere(br, bodyMat, 0, torsoH * 0.3, 0, 14);
      bl.scale.set(1.0, 0.8, (chestFront + 0.035) / br);
      torso.add(bl);
    }
    if (trousers) {
      // waistband of the trousers, flattened to the chest's ellipse
      const band = this.mesh(G.cyl(waistW * 0.58, waistW * 0.6, 0.06, 12), mat(shade(s.bottom, 0.9)), 0, 0.02, 0);
      band.scale.z = chestZ * 1.15;
      torso.add(band);
      if (s.drawstring) {
        const str = mat(s.accent ?? shade(s.bottom, 0.45));
        torso.add(this.box(0.012, 0.09, 0.012, str, -0.028, -0.025, torsoD / 2 * 1.15 + 0.004)).rotation.z = 0.3;
        torso.add(this.box(0.012, 0.09, 0.012, str, 0.028, -0.025, torsoD / 2 * 1.15 + 0.004)).rotation.z = -0.3;
        torso.add(this.sphere(0.014, str, 0, 0.018, torsoD / 2 * 1.15 + 0.006, 5)); // knot
      }
    }
    if (s.stripes && (s.outfit === "polo" || s.outfit === "tee")) {
      const st = mat(s.stripes);
      for (const yk of [0.3, 0.62]) {
        const rt = torsoW * 0.56 - (torsoW * 0.56 - waistW * 0.56) * (yk + 0.08);
        const rb = torsoW * 0.56 - (torsoW * 0.56 - waistW * 0.56) * (yk - 0.08);
        const ring = this.mesh(G.cyl(rt + 0.006, rb + 0.006, torsoH * 0.16, 10), st, 0, torsoH * yk, 0);
        ring.scale.z = chestZ;
        torso.add(ring);
      }
    }

    switch (s.outfit) {
      case "tee": {
        // round neckline ribbing + hem
        const neck = this.mesh(G.torus(0.075, 0.012, 6, 14), trim, 0, torsoH - 0.005, 0.01);
        neck.rotation.x = Math.PI / 2;
        torso.add(neck);
        if (s.vneck) {
          const v = this.box(0.09, 0.09, 0.03, skin, 0, torsoH - 0.06, torsoD / 2 - 0.005);
          v.rotation.z = Math.PI / 4;
          torso.add(v);
        }
        break;
      }
      case "tank": {
        // bare shoulders: small rounded deltoids either side, a thin domed skin cap over
        // the top of the chest (not a slab), narrow straps
        for (const side of [-1, 1]) {
          const delt = this.sphere(torsoW * 0.17, skin, side * torsoW * 0.42, torsoH - 0.035, 0, 10);
          delt.scale.set(1, 0.85, 0.9);
          torso.add(delt);
          torso.add(this.box(0.045, 0.11, torsoD * 0.78, top, side * torsoW * 0.27, torsoH - 0.045, 0));
        }
        const upper = this.sphere(torsoW * 0.56, skin, 0, torsoH - 0.012, 0, 12);
        upper.scale.set(1, 0.12, chestZ);
        torso.add(upper);
        if (s.vneck) {
          // a skin wedge at the neckline reads as the V
          const v = this.box(0.09, 0.09, 0.03, skin, 0, torsoH - 0.06, torsoD / 2 - 0.005);
          v.rotation.z = Math.PI / 4;
          torso.add(v);
        } else {
          // scooped neckline edge
          torso.add(this.box(torsoW * 0.5, 0.012, 0.02, mat(shade(s.top, 0.8)), 0, torsoH - 0.09, torsoD / 2 + 0.004));
        }
        break;
      }
      case "jacket":
      case "cardigan": {
        const longer = s.outfit === "cardigan" ? 0.14 : 0.02;
        // an open jacket shows a full panel of tee between two narrow fronts; a cardigan hangs closer to closed
        const jacket = s.outfit === "jacket";
        const panelW = torsoW * (jacket ? 0.24 : 0.36);
        const panelX = torsoW * (jacket ? 0.39 : 0.33);
        if (jacket) torso.add(this.box(torsoW * 0.6, torsoH * 0.96, 0.03, top, 0, torsoH / 2, torsoD / 2 - 0.004));
        for (const side of [-1, 1]) {
          torso.add(this.box(panelW, torsoH + longer, 0.05, topAlt, side * panelX, (torsoH - longer) / 2 + 0.02, torsoD / 2 + 0.01));
          torso.add(this.box(0.05, torsoH + longer, torsoD + 0.04, topAlt, side * (torsoW / 2 + 0.01), (torsoH - longer) / 2 + 0.02, 0));
        }
        torso.add(this.box(torsoW + 0.06, torsoH + longer, 0.05, topAlt, 0, (torsoH - longer) / 2 + 0.02, -torsoD / 2 - 0.01));
        if (s.outfit === "cardigan") {
          // ribbed edge down each front, buttons, a soft shawl collar
          for (const side of [-1, 1]) {
            torso.add(this.box(0.03, torsoH + longer, 0.06, mat(shade(s.topAlt, 1.25)), side * torsoW * 0.16, (torsoH - longer) / 2 + 0.02, torsoD / 2 + 0.012));
            const collar = this.box(0.05, 0.16, 0.05, topAlt, side * torsoW * 0.22, torsoH - 0.06, torsoD / 2 + 0.03);
            collar.rotation.z = side * -0.35;
            torso.add(collar);
          }
          for (let i = 0; i < 3; i++) torso.add(this.sphere(0.015, mat("#2a2020"), 0, torsoH * 0.6 - i * 0.12, torsoD / 2 + 0.05, 5));
        } else {
          // denim: small collar points, a chest pocket on each front, a dark hem band
          for (const side of [-1, 1]) {
            const flap = this.box(0.065, 0.045, 0.03, trim, side * torsoW * 0.31, torsoH - 0.012, torsoD / 2 + 0.035);
            flap.rotation.z = side * 0.5;
            torso.add(flap);
            torso.add(this.box(0.055, 0.06, 0.012, mat(shade(s.topAlt, 0.88)), side * panelX, torsoH * 0.62, torsoD / 2 + 0.04));
          }
          torso.add(this.box(torsoW * 0.72, 0.012, 0.04, trim, 0, torsoH + 0.02, torsoD / 2 - 0.01)); // collar stand
        }
        // the tee's round neckline inside the open front
        torso.add(this.box(torsoW * 0.3, 0.012, 0.02, mat(shade(s.top, 1.6)), 0, torsoH - 0.03, torsoD / 2 + 0.004));
        break;
      }
      case "polo": {
        // knitted collar: two pointed flaps either side of a three-button placket
        for (const side of [-1, 1]) {
          const flap = this.box(0.11, 0.075, 0.035, top, side * torsoW * 0.2, torsoH - 0.015, torsoD / 2 + 0.03);
          flap.rotation.z = side * 0.5;
          flap.rotation.x = 0.25;
          torso.add(flap);
        }
        torso.add(this.box(torsoW * 0.55, 0.05, torsoD * 0.9, top, 0, torsoH + 0.02, -0.01)); // collar stand around the neck
        torso.add(this.box(0.045, 0.17, 0.016, mat(shade(s.top, 1.15)), 0, torsoH - 0.12, torsoD / 2 + 0.004)); // placket
        for (let i = 0; i < 3; i++) torso.add(this.sphere(0.011, mat("#2a2420"), 0, torsoH - 0.07 - i * 0.045, torsoD / 2 + 0.014, 5));
        break;
      }
      case "vest": {
        // a vest over the shirt: a lighter piped edge down each front opening and
        // around the armholes so it reads as its own layer; a sash with a knot and
        // tails on the left hip
        const vw = torsoW * 0.9;
        const vh = torsoH * 0.9;
        const vd = torsoD + 0.06;
        const edge = mat(s.accent ?? shade(s.top, 1.7));
        torso.add(this.box(vw, vh, vd, top, 0, torsoH * 0.45, 0));
        for (const side of [-1, 1]) {
          torso.add(this.box(0.028, vh, 0.012, edge, side * torsoW * 0.2, torsoH * 0.45, vd / 2 + 0.004));
          torso.add(this.box(0.02, vh * 0.55, vd + 0.008, edge, side * (vw / 2 - 0.006), torsoH * 0.65, 0));
        }
        torso.add(this.box(torsoW * 0.5, 0.06, torsoD * 0.6, topAlt, 0, torsoH - 0.01, 0.03)); // shirt collar
        torso.add(this.box(waistW * 1.05, 0.075, torsoD + 0.08, trim, 0, 0.05, 0)); // sash
        torso.add(this.sphere(0.03, trim, -waistW * 0.5, 0.05, torsoD * 0.3, 6)); // knot
        const tail = this.box(0.04, 0.14, 0.02, trim, -waistW * 0.52, -0.04, torsoD * 0.3);
        tail.rotation.z = 0.15;
        torso.add(tail);
        break;
      }
      case "hoodie": {
        // a zip-up worn open: two front panels, sides and back in the hoodie colour, the tee shows between them
        const panelW = torsoW * 0.3;
        for (const side of [-1, 1]) {
          torso.add(this.box(panelW, torsoH + 0.04, 0.05, topAlt, side * torsoW * 0.36, torsoH / 2, torsoD / 2 + 0.01));
          torso.add(this.box(0.05, torsoH + 0.04, torsoD + 0.04, topAlt, side * (torsoW / 2 + 0.01), torsoH / 2, 0));
          // zip tape + pocket on each panel
          torso.add(this.box(0.012, torsoH * 0.9, 0.012, mat("#9a9aa2"), side * torsoW * 0.22, torsoH * 0.47, torsoD / 2 + 0.04));
          torso.add(this.box(panelW * 0.8, 0.12, 0.02, mat(shade(s.topAlt, 0.85)), side * torsoW * 0.38, torsoH * 0.25, torsoD / 2 + 0.04));
        }
        torso.add(this.box(torsoW + 0.06, torsoH + 0.04, 0.05, topAlt, 0, torsoH / 2, -torsoD / 2 - 0.01));
        const hood = this.sphere(torsoW * 0.42, topAlt, 0, torsoH + 0.02, -torsoD * 0.45, 10);
        hood.scale.set(1, 0.7, 0.9);
        torso.add(hood);
        torso.add(this.box(0.015, 0.14, 0.02, mat("#e8e2d0"), -torsoW * 0.2, torsoH * 0.78, torsoD / 2 + 0.045)); // drawstrings
        torso.add(this.box(0.015, 0.14, 0.02, mat("#e8e2d0"), torsoW * 0.2, torsoH * 0.78, torsoD / 2 + 0.045));
        if (s.vneck) {
          const v = this.box(0.08, 0.08, 0.03, skin, 0, torsoH - 0.055, torsoD / 2 - 0.005);
          v.rotation.z = Math.PI / 4;
          torso.add(v);
        }
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

  /** side: -1 = left arm (the character's left), 1 = right. */
  private buildArm(arm: THREE.Group, fore: THREE.Group, hand: THREE.Group, side: number, top: THREE.Material, topAlt: THREE.Material, skin: THREE.Material) {
    const s = this.spec;
    const { armT, armLen } = this.d;
    const U = armLen * 0.5;
    const F = armLen * 0.5;
    const bare = s.outfit === "tee" || s.outfit === "tank" || s.outfit === "hoodie" || s.outfit === "polo";
    const sleeveMat = bare ? top : topAlt;
    const sleeveHex = bare ? s.top : s.topAlt;
    const cuff = mat(shade(sleeveHex, 0.78));
    const defined = s.build === "muscular" || s.shoulders !== undefined && s.shoulders >= 1.1 && s.sleeves === "none";
    switch (s.sleeves) {
      case "wide": {
        const k = s.sleeveScale ?? 1;
        arm.add(this.mesh(G.cyl(armT * 0.6, armT * 0.95, U + 0.02, 10), sleeveMat, 0, -U / 2, 0));
        fore.add(this.mesh(G.cyl(armT * 0.95, armT * 1.5 * k, F * 0.95, 10), sleeveMat, 0, -F * 0.47, 0));
        fore.add(this.mesh(G.cyl(armT * 1.5 * k + 0.01, armT * 1.5 * k + 0.01, 0.04, 10), mat(s.trim), 0, -F * 0.9, 0));
        fore.add(this.sphere(armT * 0.9, sleeveMat, 0, 0, 0, 8)); // elbow
        break;
      }
      case "long":
        arm.add(this.mesh(G.cyl(armT * 0.6, armT * 0.52, U + 0.02, 8), sleeveMat, 0, -U / 2, 0));
        fore.add(this.sphere(armT * 0.52, sleeveMat, 0, 0, 0, 8)); // elbow
        fore.add(this.mesh(G.cyl(armT * 0.5, armT * 0.42, F, 8), sleeveMat, 0, -F / 2, 0));
        fore.add(this.mesh(G.cyl(armT * 0.47, armT * 0.47, 0.035, 8), cuff, 0, -F + 0.025, 0)); // cuff
        if (s.stripes) fore.add(this.mesh(G.cyl(armT * 0.5, armT * 0.47, F * 0.3, 8), mat(s.stripes), 0, -F * 0.45, 0));
        break;
      case "short":
        arm.add(this.mesh(G.cyl(armT * 0.64, armT * 0.58, U * 0.85, 8), sleeveMat, 0, -U * 0.42, 0));
        arm.add(this.mesh(G.cyl(armT * 0.6, armT * 0.6, 0.03, 8), cuff, 0, -U * 0.82, 0)); // sleeve hem
        arm.add(this.mesh(G.cyl(armT * 0.48, armT * 0.44, U * 0.3, 8), skin, 0, -U * 0.9, 0));
        fore.add(this.sphere(armT * 0.44, skin, 0, 0, 0, 8)); // elbow
        fore.add(this.mesh(G.cyl(armT * 0.43, armT * 0.36, F, 8), skin, 0, -F / 2, 0));
        break;
      case "none":
        arm.add(this.sphere(armT * 0.62, skin, 0, -armT * 0.05, 0, 8)); // shoulder
        arm.add(this.mesh(G.cyl(armT * 0.52, armT * 0.44, U, 8), skin, 0, -U / 2, 0));
        if (defined) arm.add(this.sphere(armT * (s.build === "muscular" ? 0.75 : 0.6), skin, 0, -U * 0.5, 0, 8)); // bicep
        fore.add(this.sphere(armT * 0.42, skin, 0, 0, 0, 8)); // elbow
        fore.add(this.mesh(G.cyl(armT * 0.44, armT * 0.34, F, 8), skin, 0, -F / 2, 0));
        break;
    }
    if (s.patch && side === -1) {
      // a small square patch on the outer upper sleeve
      arm.add(this.box(0.012, 0.055, 0.045, mat(s.patch), side * (armT * 0.6 + 0.004), -U * 0.5, 0));
    }

    // --- hand: a palm about three quarters of the arm's thickness, thumb toward the
    // body, four thin fingers fanned below the palm
    const palmW = armT * 0.58;
    const palmH = armT * 0.68;
    hand.add(this.box(palmW, palmH, armT * 0.3, skin, 0, -palmH / 2 - 0.005, 0));
    const inward = -side; // thumbs point toward the body
    const thumb = this.box(armT * 0.18, armT * 0.36, armT * 0.2, skin, inward * armT * 0.35, -armT * 0.28, armT * 0.08);
    thumb.rotation.z = -inward * 0.55;
    hand.add(thumb);
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) * armT * 0.145;
      const f = this.box(armT * 0.115, armT * 0.4, armT * 0.22, skin, fx, -palmH - armT * 0.17, 0);
      f.rotation.z = (i - 1.5) * 0.06;
      f.rotation.x = 0.12;
      hand.add(f);
    }

    // --- wrist accessories live on the left wrist
    if (side === -1) {
      if (s.bracelet) {
        const thin = s.braceletStyle === "thread";
        const beads = this.mesh(G.torus(armT * 0.58, thin ? 0.006 : 0.012, 6, 14), mat(s.bracelet), 0, 0.035, 0);
        beads.rotation.x = Math.PI / 2;
        hand.add(beads);
      }
      if (s.watch) {
        const strap = this.mesh(G.torus(armT * 0.56, 0.009, 6, 14), mat("#2a2a30"), 0, 0.06, 0);
        strap.rotation.x = Math.PI / 2;
        hand.add(strap);
        hand.add(this.box(0.014, 0.04, 0.036, mat("#1a1c22"), side * (armT * 0.56 + 0.004), 0.06, 0)); // case
        const face = this.box(0.006, 0.028, 0.026, glow("#c8d4e0"), side * (armT * 0.56 + 0.014), 0.06, 0);
        face.castShadow = false;
        hand.add(face);
      }
    }
  }

  private buildHead(head: THREE.Group, skin: THREE.Material, hair: THREE.Material) {
    const s = this.spec;
    const heavy = s.build === "heavy";
    const skinDark = mat(shade(s.skin, 0.6));
    const stubble = s.stubble ? mat(s.stubble) : null;

    // --- skull: ONE smooth egg (a high-segment sphere scaled taller than wide)
    // so the skin reads as a single continuous surface. The only other skin
    // volume is a small chin that sits almost entirely inside the egg and
    // just rounds out the bottom of the face. No jaw mass, no cheek spheres:
    // separate spheres shade as lumps under the toon gradient.
    const skull = this.mesh(G.sphere(HR, 20), skin, 0, 0.25, 0);
    skull.scale.set(heavy ? 1.06 : 0.95, heavy ? 1.02 : 1.1, heavy ? 1.0 : 0.97);
    head.add(skull);
    const chin = this.sphere(heavy ? 0.08 : 0.07, skin, 0, heavy ? 0.08 : 0.07, heavy ? 0.045 : 0.06, 12);
    chin.scale.set(heavy ? 1.3 : 1.15, heavy ? 0.72 : 0.75, heavy ? 0.95 : 1.0);
    head.add(chin);
    for (const side of [-1, 1]) {
      const ear = this.sphere(0.04, skin, side * (heavy ? 0.205 : 0.19), 0.25, -0.01, 7);
      ear.scale.set(0.45, 1.0, 0.7);
      head.add(ear);
      const inner = this.sphere(0.02, skinDark, side * (heavy ? 0.216 : 0.201), 0.25, -0.005, 6);
      inner.scale.set(0.3, 0.6, 0.5);
      inner.castShadow = false;
      head.add(inner);
    }
    if (stubble) {
      // a shadow of stubble over the lower face: a sphere that sits inside the
      // egg at mouth level and comes through only below the lip and along the jaw
      const st = this.sphere(0.148, stubble, 0, 0.115, 0.01, 14);
      st.scale.set(1.0, 0.68, 0.98);
      st.castShadow = false;
      head.add(st);
    }

    // --- eyes: sunken eyeballs with iris, pupil, an upper lid and (for women) a lash line
    const almond = s.eyes !== "round";
    const irisMat = mat(s.iris ?? "#3a2214");
    const white = mat("#f3efe9");
    const pupil = glow("#0a0806");
    const lashMat = mat("#1a0f0c");
    const browMat = mat(s.hairStyle === "bald" ? shade(s.skin, 0.45) : s.hair);
    const browT = s.brows === "strong" ? 0.022 : s.brows === "thin" ? 0.011 : 0.015;
    const lashes = s.lashes ?? !!s.female;
    // a round (heavy) skull is a touch deeper at the brow, so its features sit a hair further forward
    const fz = heavy ? 0.006 : 0;
    for (const side of [-1, 1]) {
      const ex = side * 0.072;
      const ey = 0.255;
      // the eyeball centre sits 0.03 behind the skin, so only a small cap of white shows around the iris
      const ez = 0.151 + fz;
      const ball = this.sphere(0.046, white, ex, ey, ez, 9);
      ball.scale.set(1.05, almond ? 0.72 : 0.9, 0.75);
      ball.castShadow = false;
      head.add(ball);
      const iris = this.sphere(0.023, irisMat, ex, ey - (s.sleepy ? 0.004 : 0), ez + 0.028, 8);
      iris.scale.z = 0.5;
      iris.castShadow = false;
      head.add(iris);
      const pu = this.sphere(0.011, pupil, ex, ey - (s.sleepy ? 0.004 : 0), ez + 0.037, 6);
      pu.castShadow = false;
      head.add(pu);
      // upper lid: a skin hood over the top of the eyeball; sleepy eyes drop it half-way
      const lidY = s.sleepy ? 0.01 : almond ? 0.026 : 0.034;
      const lid = this.box(0.1, s.sleepy ? 0.03 : 0.02, 0.05, skin, ex, ey + lidY, ez + 0.012);
      lid.rotation.z = side * (almond ? 0.1 : 0.03);
      head.add(lid);
      if (lashes || s.sleepy) {
        const lash = this.box(0.098, 0.007, 0.012, lashMat, ex, ey + lidY - 0.009, ez + 0.035);
        lash.rotation.z = lid.rotation.z;
        lash.castShadow = false;
        head.add(lash);
      }
      // brow: an inner segment rising outward, an outer segment falling toward the temple
      const inner = this.box(0.048, browT, 0.022, browMat, side * 0.047, 0.305, 0.179 + fz);
      inner.rotation.z = side * 0.18;
      inner.castShadow = false;
      head.add(inner);
      const outer = this.box(0.052, browT * 0.9, 0.022, browMat, side * 0.095, 0.312, 0.156 + fz);
      outer.rotation.z = side * -0.4;
      outer.rotation.y = side * 0.35;
      outer.castShadow = false;
      head.add(outer);
    }

    // --- nose: a wedge with a rounded tip and two nostrils; a philtrum above the lip
    const nose = this.mesh(G.cone(0.03, 0.09, 4), skin, 0, 0.205, 0.2 + fz);
    nose.rotation.x = Math.PI / 2 - 0.35;
    nose.rotation.y = Math.PI / 4;
    head.add(nose);
    head.add(this.sphere(0.021, skin, 0, 0.188, 0.225 + fz, 6));
    for (const side of [-1, 1]) {
      const nostril = this.sphere(0.008, skinDark, side * 0.016, 0.176, 0.205 + fz, 5);
      nostril.castShadow = false;
      head.add(nostril);
      head.add(this.box(0.006, 0.026, 0.01, skin, side * 0.008, 0.163, 0.181 + fz)); // philtrum ridges
    }

    // --- mouth: two-tone lips with a dark seam, or a toothy grin
    const lipMat = mat(mix(s.skin, "#8a3a48", s.female ? 0.62 : 0.4));
    const lipDark = mat(mix(s.skin, "#3a1218", 0.7));
    if (!s.grin) {
      const upper = this.box(0.076, 0.012, 0.016, lipMat, 0, 0.145, 0.168 + fz);
      upper.castShadow = false;
      head.add(upper);
      const lower = this.box(0.064, 0.016, 0.018, lipMat, 0, 0.129, 0.16 + fz);
      lower.castShadow = false;
      head.add(lower);
      const seam = this.box(0.07, 0.004, 0.006, lipDark, 0, 0.137, 0.173 + fz);
      seam.castShadow = false;
      head.add(seam);
      if (s.smirk || s.smile) {
        for (const side of s.smirk ? [1] : [-1, 1]) {
          const corner = this.box(0.028, 0.011, 0.014, lipMat, side * 0.047, 0.15, 0.164 + fz);
          corner.rotation.z = side * 0.5;
          corner.castShadow = false;
          head.add(corner);
        }
      }
    } else {
      // a wide smile showing teeth: one white tooth line framed by the lips, corners lifted
      const upper = this.box(0.1, 0.012, 0.016, lipMat, 0, 0.152, 0.167 + fz);
      upper.castShadow = false;
      head.add(upper);
      const teeth = this.box(0.092, 0.016, 0.016, mat("#f6f2ea"), 0, 0.138, 0.168 + fz);
      teeth.castShadow = false;
      head.add(teeth);
      const lower = this.box(0.096, 0.013, 0.018, lipMat, 0, 0.124, 0.163 + fz);
      lower.castShadow = false;
      head.add(lower);
      for (const side of [-1, 1]) {
        const corner = this.box(0.03, 0.013, 0.015, lipMat, side * 0.058, 0.156, 0.16 + fz);
        corner.rotation.z = side * 0.55;
        corner.castShadow = false;
        head.add(corner);
      }
    }
    if (s.moustache) {
      const m = this.box(0.1, 0.028, 0.03, mat(s.moustache), 0, 0.16, 0.184 + fz);
      m.castShadow = false;
      head.add(m);
    }
    if (s.beard) {
      const bm = mat(s.beard);
      head.add(this.box(0.17, 0.1, 0.07, bm, 0, 0.07, 0.11));
      head.add(this.box(0.1, 0.03, 0.03, bm, 0, 0.16, 0.184)); // moustache
      for (const side of [-1, 1]) head.add(this.box(0.05, 0.14, 0.09, bm, side * 0.13, 0.13, 0.06)); // sideburns down the jaw
      if (s.beardLong) {
        const tip = this.mesh(G.cone(0.075, 0.24, 6), bm, 0, -0.09, 0.07);
        tip.rotation.x = Math.PI;
        head.add(tip);
      }
    }

    if (s.earrings) {
      // hoops hanging from the ear lobes
      for (const side of [-1, 1]) {
        const hoop = this.mesh(G.torus(0.04, 0.007, 6, 14), mat(s.earrings), side * 0.2, 0.195, -0.01);
        hoop.rotation.y = Math.PI / 2;
        hoop.castShadow = false;
        head.add(hoop);
      }
    }

    // --- glasses: every frame sits on the nose bridge with temples back to the ears
    const temples = (gl: THREE.Material, cx: number, lw: number, cy: number, t: number) => {
      for (const side of [-1, 1]) {
        head.add(this.box(0.07, t, t, gl, side * (cx + lw / 2 + 0.03), cy, 0.192));
        head.add(this.box(t, t, 0.22, gl, side * 0.2, cy, 0.085));
      }
    };
    if (s.glasses === "rect") {
      // slim black rectangular frames
      const gl = mat("#111114");
      const lw = 0.1;
      const lh = 0.062;
      const t = 0.011;
      const cy = 0.258;
      for (const side of [-1, 1]) {
        const cx = side * 0.074;
        const z = 0.2;
        head.add(this.box(lw, t, t, gl, cx, cy + lh / 2, z));
        head.add(this.box(lw, t, t, gl, cx, cy - lh / 2, z));
        head.add(this.box(t, lh, t, gl, cx - lw / 2, cy, z));
        head.add(this.box(t, lh, t, gl, cx + lw / 2, cy, z));
      }
      head.add(this.box(0.05, t, t, gl, 0, cy + 0.008, 0.21));
      temples(gl, 0.074, lw, cy, t);
    } else if (s.glasses === "large") {
      // big black rounded-rectangular frames: a hollow frame per lens, a bridge, temple arms
      const gl = mat("#0e0e12");
      const lw = 0.12;
      const lh = 0.095;
      const t = 0.016;
      const cy = 0.255;
      for (const side of [-1, 1]) {
        const cx = side * 0.078;
        const z = 0.2;
        head.add(this.box(lw, t, t, gl, cx, cy + lh / 2, z));
        head.add(this.box(lw, t, t, gl, cx, cy - lh / 2, z));
        head.add(this.box(t, lh, t, gl, cx - lw / 2, cy, z));
        head.add(this.box(t, lh, t, gl, cx + lw / 2, cy, z));
      }
      head.add(this.box(0.04, t, t, gl, 0, cy + 0.01, 0.212));
      temples(gl, 0.078, lw, cy, t);
    } else if (s.glasses) {
      // thin round frames
      const gl = mat("#2a2a30");
      for (const side of [-1, 1]) {
        head.add(this.mesh(G.torus(0.046, 0.006, 6, 16), gl, side * 0.074, 0.255, 0.2));
      }
      head.add(this.box(0.04, 0.008, 0.008, gl, 0, 0.262, 0.21));
      temples(gl, 0.074, 0.092, 0.255, 0.008);
    }

    this.buildHair(head, hair);
  }

  /**
   * Hair is layered: a scalp cap that clears the brows, temples and cheeks, a
   * flattened dome whose lower edge is the hairline (0.05 above the brows),
   * then per-style side masses, backs, fringes and tufts. Nothing but a fringe
   * may come below y 0.345 at the front, so brows and eyes always stay clear.
   */
  private buildHair(head: THREE.Group, hair: THREE.Material) {
    const s = this.spec;
    const style = s.hairStyle;
    if (style === "bald") return;
    const heavy = s.build === "heavy";
    const hi = mat(s.hairHi ?? shade(s.hair, 1.35));
    const orn = mat(s.ornament ?? s.trim);
    const skin = mat(s.skin);

    const cap = this.mesh(G.sphere(HR, 14), hair, 0, 0.31, -0.03);
    cap.scale.set(heavy ? 1.08 : 1.025, 0.95, 1.0);
    head.add(cap);
    const band = this.mesh(G.sphere(0.16, 12), hair, 0, 0.4, 0.06);
    band.scale.set(1.1, 0.4, 0.9);
    head.add(band);

    /** A fringe piece over the forehead: a flattened ellipsoid whose lower edge stays above the brows. */
    const fringe = (w: number, x: number, tilt = 0, m: THREE.Material = hair) => {
      const f = this.sphere(0.1, m, x, 0.375, 0.16, 10);
      f.scale.set(w / 0.2, 0.28, 0.32);
      f.rotation.z = tilt;
      head.add(f);
      return f;
    };
    /**
     * A hanging mass of hair: an elliptical column (w across, depth deep) with a
     * rounded top shoulder and a rounded end, the end tucked slightly toward `curl`.
     * taper < 1 narrows it toward the end; 1 keeps a straight-cut bob.
     */
    const lock = (x: number, top: number, h: number, w: number, depth: number, zc: number, taper: number, curlX = 0, curlZ = 0) => {
      const col = this.mesh(G.cyl(1, taper, 1, 12), hair, x, top - h / 2, zc);
      col.scale.set(w / 2, h, depth / 2);
      head.add(col);
      const shoulder = this.sphere(1, hair, x, top, zc, 10);
      shoulder.scale.set(w / 2, 0.05, depth / 2);
      head.add(shoulder);
      const end = this.sphere(1, hair, x + curlX, top - h, zc + curlZ, 10);
      end.scale.set((w / 2) * taper, 0.035, (depth / 2) * taper);
      head.add(end);
    };
    /** Side masses from the temples down, outside the cheeks, ends curled in toward the jaw. */
    const sides = (h: number, depth = 0.26, zc = -0.03, w = 0.09, taper = 0.85) => {
      for (const side of [-1, 1]) lock(side * (0.19 + w / 2 - 0.015), 0.4, h, w, depth, zc, taper, -side * 0.012);
    };
    /** The back of the hair, hanging from the crown, its end curled in toward the neck. */
    const back = (h: number, w = 0.42, thick = 0.1) => lock(0, 0.38, h, w, thick, -0.2, 0.9, 0, 0.012);
    /** Height of the hair surface (scalp cap or hairline band) over a point of the scalp. */
    const scalpY = (x: number, z: number) => {
      const c = (x / (HR * cap.scale.x)) ** 2 + ((z + 0.03) / (HR * cap.scale.z)) ** 2;
      const b = (x / 0.176) ** 2 + ((z - 0.06) / 0.144) ** 2;
      return Math.max(c < 1 ? 0.31 + HR * cap.scale.y * Math.sqrt(1 - c) : 0, b < 1 ? 0.4 + 0.064 * Math.sqrt(1 - b) : 0);
    };
    /** A skin parting line laid along the scalp surface from zFront back to zBack. */
    const parting = (x: number, zFront: number, zBack: number, n = 5) => {
      const step = (zFront - zBack) / n;
      for (let i = 0; i < n; i++) {
        const z0 = zFront - i * step;
        const z1 = z0 - step;
        const y0 = scalpY(x, z0);
        const y1 = scalpY(x, z1);
        const len = Math.hypot(step, y1 - y0) + 0.006;
        const p = this.box(0.014, 0.012, Math.round(len * 1000) / 1000, skin, x, (y0 + y1) / 2 + 0.004, (z0 + z1) / 2);
        p.rotation.x = Math.atan2(y1 - y0, step);
        p.castShadow = false;
        head.add(p);
      }
    };

    switch (style) {
      case "crop":
        cap.scale.set(heavy ? 1.06 : 1.0, 0.93, 0.98);
        band.scale.set(1.05, 0.3, 0.85);
        band.position.y = 0.41;
        break;
      case "short":
        fringe(0.2, 0, 0);
        for (const side of [-1, 1]) head.add(this.box(0.06, 0.12, 0.16, hair, side * 0.2, 0.3, -0.05));
        back(0.16, 0.36, 0.08);
        break;
      case "grey": {
        // thin on top, white and fuller over the ears and at the nape
        cap.scale.set(1.0, 0.9, 0.98);
        band.scale.set(1.0, 0.25, 0.8);
        band.position.y = 0.43;
        for (const side of [-1, 1]) {
          const tuft = this.box(0.06, 0.12, 0.14, hi, side * 0.205, 0.28, -0.04);
          head.add(tuft);
        }
        head.add(this.box(0.34, 0.14, 0.08, hi, 0, 0.26, -0.2));
        break;
      }
      case "shoulder": {
        // a straight-cut bob with a parted fringe: hair to the shoulders all the way round,
        // no taper, rounded corners and ends tucked in
        fringe(0.1, -0.1, 0.15);
        fringe(0.17, 0.065, -0.1);
        sides(0.42, 0.3, -0.05, 0.1, 1.0);
        back(0.44, 0.46, 0.14);
        break;
      }
      case "long": {
        // long straight hair: tapering side masses that curl in at the ends, a rounded back
        fringe(0.26, 0);
        sides(0.5, 0.3, -0.05, 0.1);
        back(0.55, 0.46, 0.14);
        if (s.ornament) {
          head.add(this.box(0.12, 0.03, 0.06, orn, 0, 0.4, -0.2));
          head.add(this.box(0.03, 0.18, 0.02, orn, -0.04, 0.3, -0.27));
          head.add(this.box(0.03, 0.18, 0.02, orn, 0.04, 0.3, -0.27));
        }
        break;
      }
      case "messy": {
        // medium length, tousled: tilted strands over the hairline, tufts on top, full sides and nape.
        // Every strand bottom stays above the brows.
        const strands: [number, number, number, number][] = [
          [-0.11, 0.425, 0.15, 0.35], [-0.03, 0.42, 0.17, -0.1], [0.06, 0.425, 0.16, 0.25], [0.13, 0.43, 0.13, -0.4],
        ];
        for (const [x, y, z, rz] of strands) {
          const st = this.box(0.075, 0.11, 0.05, hair, x, y, z);
          st.rotation.z = rz;
          st.rotation.x = 0.3;
          head.add(st);
        }
        for (const side of [-1, 1]) head.add(this.box(0.09, 0.22, 0.18, hair, side * 0.2, 0.3, -0.05));
        back(0.24, 0.38);
        // rounded tufts that ride just over the crown, inside the hair silhouette
        for (const [x, y, z, rz, m] of [[-0.12, 0.465, -0.06, 0.35, hair], [0.1, 0.465, -0.1, -0.3, hi], [0.0, 0.498, 0.0, 0.1, hair], [-0.04, 0.465, -0.14, 0.2, hair], [0.11, 0.47, 0.04, -0.25, hair]] as const) {
          const tuft = this.sphere(0.06, m, x, y, z, 8);
          tuft.scale.set(1.25, 0.6, 1.1);
          tuft.rotation.z = rz;
          head.add(tuft);
        }
        break;
      }
      case "wavy": {
        // wavy, messy hair with volume on top, pushed back off the forehead: a sweep
        // rising off the hairline and three large overlapping waves over the crown
        cap.scale.set(1.04, 1.0, 1.03);
        const sweep = this.sphere(0.13, hair, 0, 0.43, 0.1, 12);
        sweep.scale.set(1.1, 0.45, 0.6);
        sweep.rotation.x = -0.5;
        head.add(sweep);
        const waves: [number, number, number, number, number, THREE.Material][] = [
          [-0.05, 0.47, 0.0, 0.12, 0.25, hair], [0.09, 0.48, -0.06, 0.11, -0.3, hi], [0.0, 0.46, -0.14, 0.1, 0.1, hair],
        ];
        for (const [x, y, z, r, rz, m] of waves) {
          const w = this.sphere(r, m, x, y, z, 12);
          w.scale.set(1.3, 0.7, 1.1);
          w.rotation.z = rz;
          head.add(w);
        }
        for (const side of [-1, 1]) {
          const s1 = this.sphere(0.085, hair, side * 0.2, 0.31, -0.06, 10);
          s1.scale.set(0.8, 1.0, 1.0);
          head.add(s1);
        }
        back(0.2, 0.36, 0.09);
        break;
      }
      case "quiff": {
        // thick hair swept back and up from the hairline: overlapping ellipsoids, a big
        // volume tilting back over the crown, a swell rising off the forehead, a lighter
        // crest, rounded sides falling to the ears and a soft nape mass. No boxes.
        const mass = this.sphere(0.18, hair, 0, 0.45, -0.04, 14);
        mass.scale.set(1.1, 0.85, 1.15);
        mass.rotation.x = -0.3;
        head.add(mass);
        const front = this.sphere(0.12, hair, 0, 0.46, 0.07, 12);
        front.scale.set(1.3, 0.8, 0.9);
        front.rotation.x = -0.35;
        head.add(front);
        const crest = this.sphere(0.09, hi, 0.02, 0.53, 0.02, 10);
        crest.scale.set(1.2, 0.6, 1.0);
        crest.rotation.x = -0.4;
        crest.rotation.z = -0.15;
        head.add(crest);
        for (const side of [-1, 1]) {
          const s1 = this.sphere(0.1, hair, side * 0.19, 0.3, -0.05, 10);
          s1.scale.set(0.7, 1.2, 1.0);
          head.add(s1);
        }
        const nape = this.sphere(0.16, hair, 0, 0.22, -0.16, 12);
        nape.scale.set(1.1, 0.6, 0.6);
        head.add(nape);
        break;
      }
      case "sidepart": {
        // medium hair parted on the left: a flattened mass swept across the forehead to the
        // right, lifting off the parting, a smaller flat lobe on the near side, and a skin
        // parting line laid along the scalp between them. No crown knob.
        const sweep = this.sphere(0.15, hair, 0.0975, 0.43, 0.075, 12);
        sweep.scale.set(0.95, 0.4, 0.62);
        sweep.rotation.z = -0.12;
        sweep.rotation.x = 0.1;
        head.add(sweep);
        const lobe = this.sphere(0.1, hair, -0.16, 0.42, 0.06, 10);
        lobe.scale.set(0.75, 0.35, 0.6);
        lobe.rotation.z = 0.3;
        head.add(lobe);
        parting(-0.065, 0.13, -0.1);
        for (const side of [-1, 1]) head.add(this.box(0.07, 0.16, 0.18, hair, side * 0.2, 0.3, -0.04));
        back(0.2, 0.36, 0.08);
        break;
      }
      case "spiky": {
        const spikes: [number, number, number, number][] = [
          [0, 0.47, -0.02, -0.25], [-0.09, 0.45, 0.02, 0.2], [0.09, 0.45, 0.02, -0.2], [-0.14, 0.4, -0.08, 0.5], [0.14, 0.4, -0.08, -0.5], [0.03, 0.44, -0.14, -0.7],
        ];
        for (const [x, y, z, rz] of spikes) {
          const sp = this.mesh(G.cone(0.05, 0.16, 5), hair, x, y + 0.05, z);
          sp.rotation.z = rz;
          sp.rotation.x = z < -0.05 ? -0.6 : 0.2;
          head.add(sp);
        }
        break;
      }
      case "ponytail": {
        fringe(0.24, 0);
        head.add(this.sphere(0.07, hair, 0, 0.42, -0.2, 8));
        head.add(this.mesh(G.cyl(0.04, 0.04, 0.05, 8), orn, 0, 0.4, -0.24)).rotation.x = Math.PI / 2;
        const tail = this.mesh(G.cyl(0.055, 0.025, 0.55, 8), hair, 0, 0.1, -0.27);
        tail.rotation.x = 0.18;
        head.add(tail);
        head.add(this.sphere(0.028, hair, 0, -0.17, -0.32, 7)); // rounded tip
        if (s.female) {
          sides(0.3, 0.09, 0.02, 0.08);
          if (s.ornament) {
            const pin = this.box(0.16, 0.025, 0.025, orn, 0.1, 0.45, 0.02);
            pin.rotation.y = 0.5;
            head.add(pin);
            head.add(this.sphere(0.03, glow(s.accent ?? s.ornament), 0.17, 0.45, -0.02, 6));
          }
        }
        break;
      }
      case "braid": {
        fringe(0.24, 0);
        for (let i = 0; i < 5; i++) head.add(this.sphere(0.05 - i * 0.004, hair, 0, 0.22 - i * 0.1, -0.22 - i * 0.01, 7));
        head.add(this.box(0.05, 0.03, 0.03, orn, 0, -0.24, -0.26));
        break;
      }
      case "bun":
        fringe(0.24, 0);
        head.add(this.sphere(0.09, hair, 0, 0.47, -0.1, 8));
        if (s.ornament) head.add(this.box(0.22, 0.02, 0.02, orn, 0, 0.49, -0.1));
        break;
      case "lowbun": {
        // pulled back tight from the forehead with a centre parting into a low bun at the nape; ears clear
        parting(0, 0.15, -0.12, 6);
        for (const side of [-1, 1]) {
          head.add(this.box(0.06, 0.2, 0.16, hair, side * 0.2, 0.3, -0.11)); // behind the ears to the nape
          const wisp = this.box(0.022, 0.09, 0.025, hair, side * 0.2, 0.33, 0.07);
          wisp.rotation.z = side * -0.2;
          head.add(wisp);
        }
        head.add(this.box(0.34, 0.2, 0.08, hair, 0, 0.26, -0.2));
        const bun = this.sphere(0.09, hair, 0, 0.17, -0.25, 9);
        bun.scale.set(1.2, 0.95, 0.85);
        head.add(bun);
        head.add(this.sphere(0.04, hi, 0.07, 0.19, -0.3, 6));
        head.add(this.mesh(G.cyl(0.05, 0.05, 0.03, 8), orn, 0, 0.17, -0.19)).rotation.x = Math.PI / 2; // tie
        break;
      }
      case "messybun": {
        // a high, lopsided bun with a bright scrunchie, loose wavy strands and bits over the forehead
        const bun = this.sphere(0.12, hair, 0.03, 0.6, -0.08, 9);
        bun.scale.set(1.15, 0.9, 1.05);
        head.add(bun);
        head.add(this.sphere(0.06, hi, 0.12, 0.62, -0.1, 7));
        head.add(this.sphere(0.055, hair, -0.08, 0.64, -0.04, 7));
        const scrunchie = this.mesh(G.torus(0.085, 0.03, 6, 14), orn, 0.03, 0.49, -0.08);
        scrunchie.rotation.x = Math.PI / 2 - 0.3;
        head.add(scrunchie);
        for (const [x, y, z, rz, len] of [[-0.2, 0.22, 0.03, 0.25, 0.3], [0.2, 0.19, 0.0, -0.2, 0.26], [-0.12, 0.14, -0.18, 0.15, 0.22], [0.1, 0.16, -0.18, -0.3, 0.2]] as const) {
          const strand = this.box(0.05, len, 0.06, hair, x, y, z);
          strand.rotation.z = rz;
          head.add(strand);
        }
        fringe(0.08, -0.1, 0.35);
        fringe(0.06, 0.01, -0.2, hi);
        fringe(0.05, 0.11, -0.5);
        break;
      }
      case "headdress": {
        fringe(0.26, 0);
        head.add(this.sphere(0.13, hair, 0, 0.5, -0.06, 10));
        head.add(this.sphere(0.08, hair, -0.13, 0.4, -0.08, 8));
        head.add(this.sphere(0.08, hair, 0.13, 0.4, -0.08, 8));
        const gold = mat(s.accent ?? C.gold);
        for (let i = -2; i <= 2; i++) {
          const spike = this.mesh(G.cone(0.025, 0.2, 5), gold, i * 0.06, 0.68, -0.06);
          spike.rotation.z = -i * 0.22;
          head.add(spike);
        }
        head.add(this.box(0.34, 0.05, 0.05, gold, 0, 0.56, -0.04));
        head.add(this.box(0.3, 0.025, 0.025, orn, 0, 0.48, -0.06));
        for (const side of [-1, 1]) {
          head.add(this.mesh(G.cyl(0.012, 0.012, 0.3, 5), gold, side * 0.2, 0.24, -0.06));
          head.add(this.sphere(0.03, glow(s.ornament ?? C.brightgold), side * 0.2, 0.08, -0.06, 6));
        }
        break;
      }
      case "curly": {
        cap.scale.set(heavy ? 1.1 : 1.06, 1.0, 1.06);
        const pts: [number, number, number][] = [
          [-0.14, 0.43, 0.1], [0.14, 0.43, 0.1], [0, 0.48, 0.1], [-0.19, 0.34, -0.06], [0.19, 0.34, -0.06],
          [-0.08, 0.5, -0.1], [0.08, 0.5, -0.1], [0, 0.4, -0.22], [-0.17, 0.44, -0.04], [0.17, 0.44, -0.04],
          [-0.12, 0.33, -0.18], [0.12, 0.33, -0.18], [0.0, 0.52, 0.0],
        ];
        pts.forEach(([x, y, z], i) => head.add(this.sphere(0.075, i % 3 === 0 ? hi : hair, x, y, z, 6)));
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
      // the strap runs over the right shoulder (+x), down across the chest to the left hip, and back up the back
      const strapMat = mat("#2a2024");
      const { torsoW } = this.d;
      const strap = this.box(0.05, torsoH * 1.1, 0.02, strapMat, 0, torsoH * 0.5, torsoD / 2 + 0.03);
      strap.rotation.z = -0.55;
      torso.add(strap);
      torso.add(this.box(0.05, 0.02, torsoD + 0.1, strapMat, torsoW * 0.42, torsoH + 0.012, 0));
      const strapBack = this.box(0.05, torsoH * 0.95, 0.02, strapMat, 0.05, torsoH * 0.52, -torsoD / 2 - 0.03);
      strapBack.rotation.z = 0.35;
      torso.add(strapBack);
      this.p.guitar = back;
      this.p.guitarFront = front;
    }
    if (props.includes("ipad")) {
      const pad = new THREE.Group();
      pad.add(this.box(0.3, 0.02, 0.22, mat("#2a2d38"), 0, 0, 0));
      const screen = this.box(0.27, 0.012, 0.19, glow("#9fd0ff"), 0, 0.012, 0);
      screen.castShadow = false;
      pad.add(screen);
      pad.position.set(-0.15, -0.06, 0.06);
      pad.rotation.x = -0.35;
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
      ph.position.set(-0.03, -0.03, 0.06);
      ph.rotation.set(-0.5, 0.35, 0.15);
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
      fan.position.set(0.05, -0.08, 0.05);
      fan.rotation.z = 0.4;
      handL.add(fan);
    }
    if (this.idle === "lift") {
      const d = new THREE.Group();
      d.add(this.mesh(G.cyl(0.015, 0.015, 0.3, 6), mat("#9a9aa0"), 0, 0, 0)).rotation.z = Math.PI / 2;
      d.add(this.mesh(G.cyl(0.06, 0.06, 0.05, 8), mat("#2a2a30"), -0.13, 0, 0)).rotation.z = Math.PI / 2;
      d.add(this.mesh(G.cyl(0.06, 0.06, 0.05, 8), mat("#2a2a30"), 0.13, 0, 0)).rotation.z = Math.PI / 2;
      d.position.y = -0.08;
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
    const bounce = this.spec.bounce ?? 1;

    // reset
    p.hips.position.y = baseHip;
    p.hips.position.x = 0;
    p.hips.rotation.set(0, 0, 0);
    p.torso.rotation.set(this.spec.build === "elder" ? 0.08 : 0, 0, 0);
    p.torso.position.y = 0;
    p.head.rotation.set(0, 0, 0);
    p.armL.rotation.set(0, 0, 0.06);
    p.armR.rotation.set(0, 0, -0.06);
    p.foreL.rotation.set(-0.12, 0, 0);
    p.foreR.rotation.set(-0.12, 0, 0);
    p.legL.rotation.set(0, 0, 0);
    p.legR.rotation.set(0, 0, 0);
    p.handR.rotation.set(0, 0, 0);
    p.handL.rotation.set(0, 0, 0);
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

    // --- walk cycle: legs scissor, arms swing with a bent elbow on the forward swing
    const freq = 9;
    const sw = Math.sin(t * freq) * m;
    p.legL.rotation.x = sw * 0.75;
    p.legR.rotation.x = -sw * 0.75;
    p.armL.rotation.x = -sw * 0.55;
    p.armR.rotation.x = sw * 0.55;
    p.foreL.rotation.x += (-0.2 - Math.max(0, sw) * 0.6) * m;
    p.foreR.rotation.x += (-0.2 - Math.max(0, -sw) * 0.6) * m;
    p.hips.position.y += Math.abs(Math.cos(t * freq)) * 0.035 * m * bounce;
    p.torso.rotation.y = sw * 0.08;
    p.hips.rotation.z = -sw * 0.03 * bounce;
    // a bouncy walker also rolls the shoulders and bobs the head
    p.torso.rotation.z = -sw * 0.03 * (bounce - 1);
    p.head.rotation.z = sw * 0.06 * (bounce - 1);
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
        // tablet held in both hands at chest height, eyes on the screen, the odd glance up
        this.lookUpTimer += dt;
        if (!this.lookingUp && this.lookUpTimer > 5.5) { this.lookingUp = true; this.lookUpTimer = 0; }
        if (this.lookingUp && this.lookUpTimer > 1.8) { this.lookingUp = false; this.lookUpTimer = 0; }
        p.armR.rotation.x += -0.45 * idleW;
        p.armR.rotation.z += -0.15 * idleW;
        p.foreR.rotation.x += -1.25 * idleW;
        p.armL.rotation.x += -0.45 * idleW;
        p.armL.rotation.z += 0.25 * idleW;
        p.foreL.rotation.x += -1.2 * idleW;
        p.foreL.rotation.z += 0.45 * idleW;
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
        p.armR.rotation.x += -0.35 * idleW;
        p.armR.rotation.z += -0.25 * idleW;
        p.foreR.rotation.x += (-1.9 + Math.sin(t * 5.5) * 0.02) * idleW;
        p.foreR.rotation.z += -0.45 * idleW;
        p.handR.rotation.y = Math.sin(t * 6) * 0.08 * idleW; // thumb scroll
        p.armL.rotation.x += -0.25 * idleW;
        p.armL.rotation.z += 0.2 * idleW;
        p.head.rotation.x = (0.3 + Math.sin(t * 2.6) * 0.03) * idleW;
        p.head.rotation.z = Math.sin(t * 0.9) * 0.1 * idleW;
        this.body.rotation.z = Math.sin(t * 1.1) * 0.025 * idleW;
        break;
      }
      case "lift": {
        // a slow dumbbell curl from the elbow
        const curl = (Math.sin(t * 1.6) + 1) / 2;
        p.armR.rotation.x += -0.15 * idleW;
        p.foreR.rotation.x += (-0.2 - ease.inOut(curl) * 2.0) * idleW;
        p.torso.rotation.z = Math.sin(t * 1.6) * 0.02 * idleW;
        break;
      }
      case "crossed": {
        // arms folded: elbows near the body, each forearm angled up across the chest
        // toward the opposite shoulder, the left forearm in front of the right
        p.armR.rotation.x += -0.42 * idleW;
        p.armR.rotation.z += 0.1 * idleW;
        p.foreR.rotation.x += 0.77 * idleW;
        p.foreR.rotation.z = -2.3 * idleW;
        p.armL.rotation.x += -0.78 * idleW;
        p.armL.rotation.z += -0.1 * idleW;
        p.foreL.rotation.x += 1.12 * idleW;
        p.foreL.rotation.z = 2.3 * idleW;
        p.head.rotation.x = Math.sin(t * 0.9) * 0.04 * idleW;
        break;
      }
      case "hips": {
        // both hands on the hips, weight on the right leg, chin up
        p.armR.rotation.z += 0.55 * idleW;
        p.armR.rotation.x += 0.05 * idleW;
        p.foreR.rotation.x += 0.12 * idleW;
        p.foreR.rotation.y = 0.15 * idleW;
        p.foreR.rotation.z = -1.3 * idleW;
        p.armL.rotation.z += -0.55 * idleW;
        p.armL.rotation.x += 0.05 * idleW;
        p.foreL.rotation.x += 0.12 * idleW;
        p.foreL.rotation.y = -0.15 * idleW;
        p.foreL.rotation.z = 1.3 * idleW;
        p.hips.position.x += 0.025 * idleW;
        p.legL.rotation.z += 0.07 * idleW;
        this.body.rotation.z = -0.03 * idleW;
        p.head.rotation.x = (-0.12 + Math.sin(t * 1.7) * 0.02) * idleW;
        p.head.rotation.z = Math.sin(t * 0.8) * 0.05 * idleW;
        break;
      }
      case "stretch": {
        // a lazy stretch: upper arms out to the sides and up at about 55 degrees, pulled
        // back so the elbows sit beside and slightly behind the head; forearms fold back
        // behind the head with the hands at the nape. The face stays clear from every angle.
        const k = 1 + Math.sin(t * 1.1) * 0.04;
        p.armR.rotation.x += -0.6 * idleW;
        p.armR.rotation.z += 2.5 * k * idleW;
        p.foreR.rotation.x += 0.3 * idleW;
        p.foreR.rotation.z = 2.23 * idleW;
        p.armL.rotation.x += -0.6 * idleW;
        p.armL.rotation.z += -2.5 * k * idleW;
        p.foreL.rotation.x += 0.3 * idleW;
        p.foreL.rotation.z = -2.23 * idleW;
        p.torso.rotation.x += -0.08 * idleW;
        p.head.rotation.x = (-0.18 + Math.sin(t * 1.1) * 0.03) * idleW;
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
        // right hand plucks over the body of the bass (low, in front), left hand out on the neck (up-left)
        p.armR.rotation.x += -0.4 * idleW;
        p.armR.rotation.z += -0.55 * idleW;
        p.foreR.rotation.x += (-0.3 + Math.sin(t * 7) * 0.18) * idleW;
        p.armL.rotation.x += -0.3 * idleW;
        p.armL.rotation.z += -0.8 * idleW;
        p.foreL.rotation.x += -0.9 * idleW;
        p.foreL.rotation.z += -0.2 * idleW;
        p.head.rotation.x = 0.15 * idleW;
        p.head.rotation.z = Math.sin(t * 1.8) * 0.06 * idleW;
        break;
      }
      case "sway": {
        this.body.rotation.z = Math.sin(t * 1.4) * 0.04 * idleW;
        p.armR.rotation.x += -0.6 * idleW;
        p.armR.rotation.z += -0.5 * idleW;
        p.foreR.rotation.x += -0.9 * idleW;
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
        p.armR.rotation.z = -0.06;
        p.foreR.rotation.set(-0.9 + ease.bump(Math.min(1, ph * 1.3)) * 0.8, 0, 0);
        p.armL.rotation.x = 0.6 * ease.bump(ph);
        p.foreL.rotation.set(-0.8 * ease.bump(ph), 0, 0);
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
        p.foreL.rotation.set(-0.3 * k, 0, 0);
        p.foreR.rotation.set(-0.3 * k, 0, 0);
        break;
      }
      case "wave": {
        p.armR.rotation.set(-2.4, 0, -0.3);
        p.foreR.rotation.set(-0.5, 0, -0.2 + Math.sin(ph * 20) * 0.4);
        break;
      }
      case "hug": {
        const k = ease.out(Math.min(1, ph * 2.2));
        p.armL.rotation.x = -1.0 * k;
        p.armL.rotation.z = 0.45 * k;
        p.foreL.rotation.set(-0.7 * k, 0, 0.5 * k);
        p.armR.rotation.x = -0.9 * k;
        p.armR.rotation.z = -0.4 * k;
        p.foreR.rotation.set(-0.7 * k, 0, -0.5 * k);
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
        p.foreL.rotation.set(-0.5 * k, 0, 0);
        p.foreR.rotation.set(-0.5 * k, 0, 0);
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
