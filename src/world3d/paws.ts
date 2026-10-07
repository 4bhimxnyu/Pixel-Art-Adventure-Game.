// ---------------------------------------------------------------------------
// A small dog's paw print: one oval main pad and four toe pads in an arc in
// front of it. Flat in the XZ plane at y = 0, toes pointing along +z, about
// 0.09 units long — right for a Shih Tzu. Built once and shared.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const pawPrintColor = "#3a2a22";

let cached: THREE.BufferGeometry | null = null;

function pad(rx: number, rz: number, x: number, z: number, rot = 0) {
  const g = new THREE.CircleGeometry(1, 12);
  g.rotateX(-Math.PI / 2); // lie flat, normal up
  g.scale(rx, 1, rz);
  g.rotateY(rot);
  g.translate(x, 0, z);
  return g;
}

export function pawGeometry(): THREE.BufferGeometry {
  if (cached) return cached;
  const parts: THREE.BufferGeometry[] = [
    // main pad: a slightly heart-shaped oval, widest at the front
    pad(0.028, 0.024, 0, -0.012),
    pad(0.018, 0.016, -0.011, -0.004),
    pad(0.018, 0.016, 0.011, -0.004),
  ];
  // toes: four small ovals on an arc, outer toes angled outward
  const arc: [number, number, number][] = [
    [-0.03, 0.022, -0.5],
    [-0.011, 0.034, -0.18],
    [0.011, 0.034, 0.18],
    [0.03, 0.022, 0.5],
  ];
  for (const [x, z, rot] of arc) parts.push(pad(0.0085, 0.012, x, z, rot));
  const merged = mergeGeometries(parts, false) ?? parts[0];
  parts.forEach((p) => p !== merged && p.dispose());
  merged.computeVertexNormals();
  cached = merged;
  return merged;
}
