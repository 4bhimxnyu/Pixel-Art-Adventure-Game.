// ---------------------------------------------------------------------------
// The guide trail: a line of small gold lights laid on the ground from the
// player to the current objective (or to the exit that leads to it), with a
// pulse of brightness running along it toward the goal. Built for players who
// have never played a game: the beacon says WHERE, the trail says HOW TO GET
// THERE. One InstancedMesh, one shared glow material, never more than MAX
// instances.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { G, glow } from "./materials";

const MAX = 240;

export class GuideTrail {
  readonly mesh: THREE.InstancedMesh;
  private pts: THREE.Vector3[] = [];
  private t = 0;
  private k = 0;
  private shown = false;
  private dummy = new THREE.Object3D();

  constructor() {
    this.mesh = new THREE.InstancedMesh(G.cyl(0.085, 0.085, 0.014, 10), glow("#f3c65a", 0.85), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** The route as cell centres in world units (x, z), player first, goal last; null hides it. */
  set(cells: { x: number; z: number }[] | null) {
    this.pts = [];
    if (!cells || cells.length < 2) {
      this.shown = false;
      return;
    }
    // two lights per tile, starting half a tile away from the player's own cell
    for (let i = 1; i < cells.length && this.pts.length < MAX; i++) {
      const a = cells[i - 1];
      const b = cells[i];
      this.pts.push(new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2));
      if (this.pts.length < MAX) this.pts.push(new THREE.Vector3(b.x, 0, b.z));
    }
    this.shown = true;
  }

  get active() {
    return this.shown;
  }

  update(dt: number) {
    this.t += dt;
    this.k += ((this.shown ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    const n = this.k < 0.02 ? 0 : this.pts.length;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      // a pulse of light runs along the trail toward the goal
      const wave = 0.5 + 0.5 * Math.sin(this.t * 4 - i * 0.55);
      const s = this.k * (0.55 + wave * 0.75);
      this.dummy.position.set(p.x, 0.03 + wave * 0.012, p.z);
      this.dummy.scale.set(s, 1, s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose(); // instance buffers only; geometry and material are shared caches
  }
}
