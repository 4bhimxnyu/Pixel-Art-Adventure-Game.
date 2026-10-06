// ---------------------------------------------------------------------------
// Procedural stylised human rig. Built from a CharSpec: body proportions,
// hair style, robe or trousers, eyes, beard, glasses and hand props. Walk,
// idle variants (iPad, lifting, arms crossed, strumming), attack, hit, hug,
// cheer and knock-out are all procedural, so every character animates with
// no asset files. A GLB in public/models/<id>.glb replaces the body when
// present (see loadOverride).
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { BaseRig, ease } from "./BaseRig";
import { charSpec, type CharSpec } from "./characters";
import { G, mat, glow, C } from "./materials";

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
  guitar?: THREE.Group;
  guitarFront?: THREE.Group;
  ipad?: THREE.Group;
  dumbbell?: THREE.Group;
};

export class CharacterRig extends BaseRig {
  readonly spec: CharSpec;
  private p!: Parts;
  private lookUpTimer = 0;
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
    this.height = 1.5 * scale;

    const build = s.build;
    const torsoW = build === "slim" ? 0.36 : build === "heavy" ? 0.56 : build === "muscular" ? 0.5 : 0.42;
    const torsoD = build === "slim" ? 0.22 : build === "heavy" ? 0.42 : build === "muscular" ? 0.32 : 0.26;
    const legLen = build === "heavy" ? 0.46 : 0.54;
    const armT = build === "muscular" ? 0.17 : build === "heavy" ? 0.15 : 0.12;
    const hipY = legLen;

    const skin = mat(s.skin);
    const top = mat(s.top);
    const topAlt = mat(s.topAlt);
    const bottom = mat(s.bottom);
    const trim = mat(s.trim);
    const hair = mat(s.hair);

    // --- hips / legs
    const hips = this.joint(0, hipY, 0);
    const legL = this.joint(-0.1, 0, 0, hips);
    const legR = this.joint(0.1, 0, 0, hips);
    const legMat = s.robe ? bottom : bottom;
    legL.add(this.box(0.15, legLen, 0.17, legMat, 0, -legLen / 2, 0));
    legR.add(this.box(0.15, legLen, 0.17, legMat, 0, -legLen / 2, 0));
    // shoes
    legL.add(this.box(0.16, 0.08, 0.22, mat(C.charcoal), 0, -legLen + 0.04, 0.02));
    legR.add(this.box(0.16, 0.08, 0.22, mat(C.charcoal), 0, -legLen + 0.04, 0.02));

    // --- torso
    const torso = this.joint(0, 0, 0, hips);
    const torsoH = 0.5;
    if (build === "muscular") {
      torso.add(this.box(torsoW + 0.1, torsoH * 0.55, torsoD, top, 0, torsoH * 0.72, 0)); // chest
      torso.add(this.box(torsoW - 0.08, torsoH * 0.5, torsoD - 0.06, top, 0, torsoH * 0.25, 0)); // waist
    } else {
      torso.add(this.box(torsoW, torsoH, torsoD, top, 0, torsoH / 2, 0));
    }
    if (build === "heavy") torso.add(this.sphere(torsoW * 0.5, top, 0, torsoH * 0.35, torsoD * 0.25, 10));
    // sash / belt
    torso.add(this.box(torsoW + 0.02, 0.07, torsoD + 0.02, trim, 0, 0.1, 0));
    // collar
    torso.add(this.box(torsoW * 0.5, 0.05, torsoD * 0.6, trim, 0, torsoH - 0.02, 0.04));
    if (s.robe) {
      const robeLen = legLen - 0.06;
      const robe = this.mesh(G.cyl(torsoW * 0.5, torsoW * 0.7, robeLen, 10), bottom, 0, -robeLen / 2 + 0.04, 0);
      torso.add(robe);
      torso.add(this.mesh(G.cyl(torsoW * 0.52, torsoW * 0.54, 0.05, 10), trim, 0, 0.02, 0));
      // Palakshi's gold hem
      if (s.ornament) torso.add(this.mesh(G.cyl(torsoW * 0.69, torsoW * 0.71, 0.04, 10), trim, 0, -robeLen + 0.06, 0));
    }
    if (build === "elder") torso.rotation.x = 0.1;

    // --- arms
    const shoulderY = torsoH - 0.04;
    const armL = this.joint(-(torsoW / 2 + armT / 2 + 0.01), shoulderY, 0, torso);
    const armR = this.joint(torsoW / 2 + armT / 2 + 0.01, shoulderY, 0, torso);
    const armLen = 0.46;
    for (const [arm, side] of [[armL, -1], [armR, 1]] as const) {
      arm.add(this.box(armT, armLen * 0.55, armT, topAlt, 0, -armLen * 0.27, 0)); // sleeve
      arm.add(this.box(armT * 0.85, armLen * 0.45, armT * 0.85, skin, 0, -armLen * 0.77, 0)); // forearm
      if (build === "muscular") arm.add(this.sphere(armT * 0.7, topAlt, 0, -armLen * 0.3, 0, 8));
      void side;
    }
    const handL = this.joint(0, -armLen, 0, armL);
    const handR = this.joint(0, -armLen, 0, armR);
    handL.add(this.sphere(armT * 0.55, skin, 0, 0, 0, 6));
    handR.add(this.sphere(armT * 0.55, skin, 0, 0, 0, 6));

    // --- head
    const head = this.joint(0, torsoH + 0.05, 0, torso);
    const headR = 0.2;
    const headMesh = this.mesh(G.sphere(headR, 12), skin, 0, headR, 0);
    headMesh.scale.set(1, 1.06, 0.96);
    head.add(headMesh);
    // neck
    head.add(this.mesh(G.cyl(0.06, 0.07, 0.1, 6), skin, 0, 0.0, 0));
    // eyes
    const eyeMat = glow("#141014");
    const almond = s.eyes !== "round";
    for (const side of [-1, 1]) {
      const eye = this.box(almond ? 0.075 : 0.05, almond ? 0.026 : 0.05, 0.02, eyeMat, side * 0.075, headR + 0.02, headR - 0.015);
      if (almond) eye.rotation.z = side * -0.22; // outer corners lifted
      eye.castShadow = false;
      head.add(eye);
      const brow = this.box(0.07, 0.014, 0.015, hair, side * 0.075, headR + 0.065, headR - 0.01);
      brow.rotation.z = side * -0.15;
      brow.castShadow = false;
      head.add(brow);
    }
    // mouth
    const mouth = this.box(0.05, 0.012, 0.015, mat("#a8586a"), 0, headR - 0.07, headR - 0.012);
    mouth.castShadow = false;
    head.add(mouth);
    if (s.glasses) {
      const gl = mat("#2a2a30");
      head.add(this.box(0.2, 0.012, 0.012, gl, 0, headR + 0.02, headR + 0.01));
      head.add(this.mesh(G.cyl(0.045, 0.045, 0.012, 8), gl, -0.075, headR + 0.02, headR + 0.012)).rotation.x = Math.PI / 2;
      head.add(this.mesh(G.cyl(0.045, 0.045, 0.012, 8), gl, 0.075, headR + 0.02, headR + 0.012)).rotation.x = Math.PI / 2;
    }
    if (s.beard) {
      head.add(this.box(0.16, 0.08, 0.06, mat(s.beard), 0, headR - 0.11, headR - 0.06));
    }
    this.buildHair(head, headR, hair);

    this.p = { hips, torso, head, armL, armR, legL, legR, handL, handR };
    this.buildProps(torso, handR, handL, armT);
    this.bake();
  }

  private buildHair(head: THREE.Group, r: number, hair: THREE.Material) {
    const s = this.spec;
    const style = s.hairStyle;
    if (style === "bald") return;
    const cap = this.mesh(G.sphere(r + 0.018, 12), hair, 0, r + 0.025, -0.01);
    cap.scale.set(1, 0.92, 1);
    // clip the cap so the face shows: shift it back a touch and sit it higher
    cap.position.z = -0.035;
    head.add(cap);

    if (style === "crop") {
      cap.scale.set(1.0, 0.72, 1.0);
      cap.position.y = r + 0.06;
    }
    if (style === "short") {
      head.add(this.box(0.3, 0.08, 0.1, hair, 0, r + 0.15, r - 0.05)); // fringe
    }
    if (style === "long") {
      const back = this.box(0.34, 0.5, 0.1, hair, 0, r - 0.12, -r + 0.02);
      head.add(back);
      head.add(this.box(0.09, 0.34, 0.1, hair, -r + 0.02, r - 0.08, 0.03));
      head.add(this.box(0.09, 0.34, 0.1, hair, r - 0.02, r - 0.08, 0.03));
      head.add(this.box(0.26, 0.07, 0.08, hair, 0, r + 0.15, r - 0.03)); // fringe
      if (s.ornament) {
        const pin = this.box(0.14, 0.03, 0.03, mat(s.ornament), 0.08, r + 0.2, 0.02);
        pin.rotation.y = 0.5;
        head.add(pin);
        head.add(this.sphere(0.03, glow(s.accent ?? s.ornament), 0.15, r + 0.2, -0.02, 6));
      }
    }
    if (style === "bun") {
      head.add(this.sphere(0.09, hair, 0, r + 0.2, -0.12, 8));
      if (s.ornament) head.add(this.box(0.2, 0.02, 0.02, mat(s.ornament), 0, r + 0.22, -0.12));
      head.add(this.box(0.26, 0.06, 0.08, hair, 0, r + 0.15, r - 0.03));
    }
    if (style === "curly") {
      cap.scale.set(1.05, 0.85, 1.05);
      const hi = mat(s.hairHi ?? s.hair);
      const pts: [number, number, number][] = [
        [-0.14, 0.15, 0.1], [0.14, 0.15, 0.1], [0, 0.22, 0.08], [-0.17, 0.08, -0.08], [0.17, 0.08, -0.08],
        [-0.08, 0.23, -0.1], [0.08, 0.23, -0.1], [0, 0.12, -0.2],
      ];
      pts.forEach(([x, y, z], i) => head.add(this.sphere(0.075, i % 3 === 0 ? hi : hair, x, r + y, z, 6)));
    }
    if (style === "grey") {
      cap.scale.set(1.0, 0.78, 1.0);
      cap.position.y = r + 0.05;
      const hi = mat(s.hairHi ?? "#8a8290");
      head.add(this.box(0.05, 0.12, 0.12, hi, -r - 0.005, r - 0.0, -0.02));
      head.add(this.box(0.05, 0.12, 0.12, hi, r + 0.005, r - 0.0, -0.02));
    }
  }

  private buildProps(torso: THREE.Group, handR: THREE.Group, handL: THREE.Group, armT: number) {
    const props = this.spec.props ?? [];
    if (props.includes("guitar")) {
      const white = mat(C.white);
      const mk = () => {
        const g = new THREE.Group();
        g.add(this.box(0.3, 0.42, 0.07, white, 0, 0, 0));
        g.add(this.box(0.26, 0.34, 0.07, white, 0, 0.3, 0));
        g.add(this.box(0.06, 0.55, 0.04, mat("#d8d4cc"), 0, 0.62, 0));
        g.add(this.box(0.09, 0.09, 0.08, mat(C.charcoal), 0, 0.02, 0.0));
        g.add(this.box(0.08, 0.1, 0.05, mat(C.charcoal), 0, 0.92, 0));
        return g;
      };
      const back = mk();
      back.position.set(0.05, 0.1, -0.22);
      back.rotation.set(0.1, Math.PI, -0.45);
      torso.add(back);
      const front = mk();
      front.position.set(-0.05, 0.05, 0.26);
      front.rotation.set(0.2, 0.15, 1.15);
      front.visible = false;
      torso.add(front);
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
    if (props.includes("staff")) {
      const st = this.mesh(G.cyl(0.02, 0.025, 1.7, 6), mat(C.wood2), 0, 0.5, 0);
      handR.add(st);
      handR.add(this.sphere(0.05, mat(C.gold), 0, 1.35, 0, 6));
    }
    if (props.includes("fan")) {
      const fan = this.box(0.28, 0.16, 0.012, mat(C.brightgold), 0.12, 0.05, 0.04);
      fan.rotation.z = 0.5;
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
    void armT;
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

    // reset
    p.hips.position.y = (this.spec.build === "heavy" ? 0.46 : 0.54);
    p.hips.rotation.set(0, 0, 0);
    p.torso.rotation.set(this.spec.build === "elder" ? 0.1 : 0, 0, 0);
    p.head.rotation.set(0, 0, 0);
    p.armL.rotation.set(0, 0, 0.06);
    p.armR.rotation.set(0, 0, -0.06);
    p.legL.rotation.set(0, 0, 0);
    p.legR.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    if (p.guitar) p.guitar.visible = true;
    if (p.guitarFront) p.guitarFront.visible = false;

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
    p.hips.position.y += Math.abs(Math.cos(t * freq)) * 0.035 * m;
    p.torso.rotation.y = sw * 0.08;
    p.hips.rotation.z = -sw * 0.03;

    // --- idle
    const breathe = Math.sin(t * 2.1) * 0.012;
    p.torso.position.y = breathe * (1 - m);
    p.head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - m);
    p.armL.rotation.x += Math.sin(t * 1.3) * 0.03 * (1 - m);
    p.armR.rotation.x += Math.sin(t * 1.3 + 1) * 0.03 * (1 - m);

    const idleW = 1 - m;
    switch (this.idle) {
      case "ipad": {
        // arms up holding the tablet, head down; every so often look up at you
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
      case "lift": {
        const curl = (Math.sin(t * 1.6) + 1) / 2; // 0..1
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
      case "strum":
      case "sway": {
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
      default:
        break;
    }

    // --- one-shot actions
    const a = this.action;
    if (!a) return;
    const ph = Math.min(1, a.t / a.dur);
    switch (a.name) {
      case "attack": {
        // palm strike: wind up, lunge forward, recover
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
        // settles into the embrace and holds it for the rest of the action
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
        break;
      }
      default:
        break;
    }
  }
}
