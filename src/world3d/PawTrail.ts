// ---------------------------------------------------------------------------
// Mimo's paw prints. A small ring buffer of instanced paw-print decals laid
// on the ground as the dog walks: alternating left/right of the path line,
// pointing along the walking direction with a little wobble, fading (and
// shrinking) away after a few seconds. One draw call for the whole trail.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { pawGeometry, pawPrintColor } from "./paws";

const CAP = 56;
const LIFE = 9;
const STRIDE = 0.21;

export class PawTrail {
  readonly mesh: THREE.InstancedMesh;
  private born = new Float32Array(CAP).fill(-1e9);
  private base: THREE.Matrix4[] = [];
  private next = 0;
  private t = 0;
  private since = 0;
  private side = 1;
  private last = new THREE.Vector3();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pawPrintColor), transparent: true, opacity: 0.5, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(pawGeometry(), mat, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    for (let i = 0; i < CAP; i++) {
      this.base.push(new THREE.Matrix4().makeScale(0, 0, 0));
      this.mesh.setMatrixAt(i, this.base[i]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Call every frame with the dog's position / heading while it walks. */
  track(pos: THREE.Vector3, heading: number, moving: boolean, dt: number) {
    this.t += dt;
    if (moving) {
      this.since += pos.distanceTo(this.last);
      if (this.since >= STRIDE) {
        this.since = 0;
        this.side = -this.side;
        const px = pos.x - Math.cos(heading) * 0.075 * this.side;
        const pz = pos.z + Math.sin(heading) * 0.075 * this.side;
        this.stamp(px, pz, heading + (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.25);
      }
    }
    this.last.copy(pos);
    // fade: shrink during the last third of life
    let dirty = false;
    for (let i = 0; i < CAP; i++) {
      const age = this.t - this.born[i];
      if (age > LIFE + 1) continue;
      const k = age > LIFE * 0.66 ? Math.max(0, 1 - (age - LIFE * 0.66) / (LIFE * 0.34)) : 1;
      this.s.set(k, 1, k);
      this.base[i].decompose(this.p, this.q, new THREE.Vector3());
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  private stamp(x: number, z: number, heading: number, scale: number) {
    const i = this.next;
    this.next = (this.next + 1) % CAP;
    this.born[i] = this.t;
    this.p.set(x, 0.012, z);
    this.q.setFromEuler(new THREE.Euler(0, heading, 0));
    this.s.set(scale, 1, scale);
    this.base[i].compose(this.p, this.q, this.s);
  }

  dispose() {
    this.mesh.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.removeFromParent();
  }
}
