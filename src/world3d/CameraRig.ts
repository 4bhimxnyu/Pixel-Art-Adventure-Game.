// ---------------------------------------------------------------------------
// Third-person camera. Follows a target with smoothed yaw / pitch / distance,
// pulls in when a wall would block the view, softly re-aligns behind the
// player while they walk, and can be handed a cinematic (a list of keyframes
// to glide through) which overrides the follow until it ends.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { ease } from "./BaseRig";

export type Keyframe = {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  /** Seconds to reach this keyframe from the previous one. */
  dur: number;
  /** Hold at this keyframe for N seconds. */
  hold?: number;
  ease?: (t: number) => number;
};

export type Cinematic = { frames: Keyframe[]; onDone?: () => void; onFrame?: (i: number) => void };

const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI; // behind the player, looking +z → camera at -z... we look along +z by default
  pitch = 0.46;
  distance = 5.4;
  targetDistance = 5.4;
  /** Height of the look-at point above the target's feet. */
  lookHeight = 1.0;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private autoAlign = 0;
  private cine: Cinematic | null = null;
  private cineIdx = 0;
  private cineT = 0;
  private cineFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private shakeT = 0;
  private shakeAmp = 0;
  /** Height of whatever stands at (x, z): 0 when the ground there is open. */
  obstacle: (x: number, z: number) => number = () => 0;
  indoor = false;
  private lift = 0;
  /** A fixed pose the camera settles into (battles). Cinematics still win. */
  hold: { pos: THREE.Vector3; look: THREE.Vector3; sway?: number } | null = null;
  private holdT = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 120);
  }

  get cinematicActive() {
    return !!this.cine;
  }

  /** Mouse / stick / touch look input in radians. */
  rotate(dYaw: number, dPitch: number) {
    if (this.cine) return;
    this.yaw -= dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, this.indoor ? 0.42 : 0.12, 1.15);
    this.autoAlign = 0;
  }

  zoom(delta: number) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, 2.6, 8);
  }

  /** Snap behind the target immediately (map change, battle end). */
  snapBehind(target: THREE.Vector3, heading: number) {
    this.yaw = heading + Math.PI;
    this.distance = this.targetDistance;
    this.pos.copy(this.desiredPos(target));
    this.look.set(target.x, target.y + this.lookHeight, target.z);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  shake(ms: number, amp: number) {
    this.shakeT = ms / 1000;
    this.shakeAmp = amp;
  }

  playCinematic(c: Cinematic) {
    this.cine = c;
    this.cineIdx = 0;
    this.cineT = 0;
    this.cineFrom.pos.copy(this.camera.position);
    this.cineFrom.look.copy(this.look);
    c.onFrame?.(0);
  }

  stopCinematic() {
    const c = this.cine;
    this.cine = null;
    c?.onDone?.();
  }

  private desiredPos(target: THREE.Vector3) {
    const d = this.distance;
    const x = target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d;
    const z = target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d;
    const y = target.y + this.lookHeight + Math.sin(this.pitch) * d;
    return new THREE.Vector3(x, y, z);
  }

  update(dt: number, target: THREE.Vector3, heading: number, moving: boolean, lookInputActive: boolean) {
    // --- cinematic override
    if (this.cine) {
      const c = this.cine;
      const f = c.frames[this.cineIdx];
      if (!f) {
        this.stopCinematic();
      } else {
        this.cineT += dt;
        const k = f.dur <= 0 ? 1 : Math.min(1, this.cineT / f.dur);
        const e = (f.ease ?? ease.inOut)(k);
        this.camera.position.lerpVectors(this.cineFrom.pos, f.pos, e);
        this.look.lerpVectors(this.cineFrom.look, f.look, e);
        this.camera.lookAt(this.look);
        if (k >= 1 && this.cineT >= f.dur + (f.hold ?? 0)) {
          this.cineFrom.pos.copy(f.pos);
          this.cineFrom.look.copy(f.look);
          this.cineIdx++;
          this.cineT = 0;
          if (this.cineIdx < c.frames.length) c.onFrame?.(this.cineIdx);
          else this.stopCinematic();
        }
        this.pos.copy(this.camera.position);
        return;
      }
    }

    // --- held pose (battle stage)
    if (this.hold) {
      this.holdT += dt;
      const sway = this.hold.sway ?? 0.18;
      const p = this.hold.pos.clone();
      p.x += Math.sin(this.holdT * 0.35) * sway;
      p.y += Math.sin(this.holdT * 0.5) * sway * 0.4;
      this.pos.lerp(p, Math.min(1, dt * 4));
      this.look.lerp(this.hold.look, Math.min(1, dt * 6));
      this.camera.position.copy(this.pos);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
      }
      this.camera.lookAt(this.look);
      return;
    }

    // --- soft auto-align behind the player while walking without look input
    if (moving && !lookInputActive) {
      this.autoAlign = Math.min(1, this.autoAlign + dt * 0.5);
      const want = heading + Math.PI;
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * dt * 1.6 * this.autoAlign;
    } else if (!moving) {
      this.autoAlign = 0;
    }

    // --- distance with wall collision. Rooms are seen dollhouse-style: the
    // camera is allowed to rise over a wall it would clear at full distance,
    // and only pulls in when its resting spot is actually inside something,
    // or when something solid sits right behind the player's head.
    if (this.indoor) this.pitch = Math.max(this.pitch, 0.42);
    const maxD = this.indoor ? Math.min(this.targetDistance, 4.6) : this.targetDistance;
    let d = maxD;
    const steps = 14;
    const base = new THREE.Vector3(target.x, target.y + this.lookHeight, target.z);
    const at = (td: number) => new THREE.Vector3(
      base.x + Math.sin(this.yaw) * Math.cos(this.pitch) * td,
      base.y + Math.sin(this.pitch) * td,
      base.z + Math.cos(this.yaw) * Math.cos(this.pitch) * td
    );
    // Walk the ray from the player to the camera's resting spot. Anything that
    // would sit between them, or that the camera would end up inside, needs the
    // camera to either rise above it (preferred — rooms read like dollhouses) or,
    // if that would mean climbing more than a couple of units, pull in instead.
    let needClear = 0;
    let firstHit = -1;
    for (let i = 1; i <= steps; i++) {
      const td = (maxD * i) / steps;
      const p = at(td);
      const h = this.obstacle(p.x, p.z);
      if (h > 0 && p.y < h + 0.3) {
        needClear = Math.max(needClear, h + 0.3);
        if (firstHit < 0) firstHit = td;
      }
    }
    let wantLift = 0;
    if (needClear > 0) {
      const endY = at(maxD).y;
      const climb = needClear - endY;
      if (climb <= 2.4) wantLift = Math.max(0, climb);
      else d = Math.max(1.1, firstHit - 0.45);
    }
    // pull in fast, push out slow; lift eases both ways
    this.distance += (d - this.distance) * (d < this.distance ? Math.min(1, dt * 14) : Math.min(1, dt * 2.5));
    this.lift += (wantLift - this.lift) * Math.min(1, dt * 7);

    const want = this.desiredPos(target);
    want.y += this.lift;
    this.pos.lerp(want, Math.min(1, dt * 9));
    const lookWant = new THREE.Vector3(target.x, target.y + this.lookHeight, target.z);
    this.look.lerp(lookWant, Math.min(1, dt * 12));

    this.camera.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT > 0 ? 1 : 0);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.look);
    this.camera.up.copy(UP);
  }

  /** Camera forward on the ground plane — for camera-relative movement. */
  groundForward(out: THREE.Vector3) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }

  groundRight(out: THREE.Vector3) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }
}
