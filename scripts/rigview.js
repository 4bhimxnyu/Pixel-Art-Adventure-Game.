// Dev-only character line-up. With the dev server open, in the browser console:
//   await import("/scripts/rigview.js?x=" + Date.now()); await window.__rigview(["palakshi", "abhimanyu"])
// Draws the requested rigs side by side (front and three-quarter) on an overlay
// canvas so identity specs can be checked without walking to each NPC.
// Call window.__rigview.close() to remove it.

async function threeUrl() {
  // Use the exact pre-bundled three module the app uses, so instanceof checks hold.
  const src = await (await fetch("/src/world3d/CharacterRig.ts")).text();
  const m = src.match(/from\s+["']([^"']*\/three\.js[^"']*)["']/) || src.match(/from\s+["']([^"']*three[^"']*)["']/);
  return m ? m[1] : "three";
}

window.__rigview = async function (ids = ["palakshi", "abhimanyu", "faizal", "garv", "hakim", "dev"], opts = {}) {
  window.__rigview.close?.();
  const THREE = await import(/* @vite-ignore */ await threeUrl());
  const { CharacterRig } = await import("/src/world3d/CharacterRig.ts");
  const W = opts.width || 1200, H = opts.height || 520;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  Object.assign(canvas.style, { position: "fixed", left: "0", top: "0", zIndex: 99999, background: "#e9e4d8" });
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e9e4d8");
  scene.add(new THREE.HemisphereLight("#ffffff", "#8a8070", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(2, 4, 5);
  scene.add(sun);
  const spacing = 1.15;
  const rigs = [];
  ids.forEach((id, i) => {
    const rig = new CharacterRig(id);
    const x = (i - (ids.length - 1) / 2) * spacing;
    rig.group.position.set(x, 0, 0);
    rig.setHeading(opts.turn ?? 0.35, true);
    scene.add(rig.group);
    rigs.push(rig);
  });
  const cam = new THREE.PerspectiveCamera(opts.fov || 30, W / H, 0.1, 100);
  const span = ids.length * spacing;
  cam.position.set(0, opts.camY ?? 1.1, Math.max(3.2, span * 1.15) * (opts.zoom || 1));
  cam.lookAt(0, opts.lookY ?? 0.85, 0);
  let raf = 0, t = 0;
  const tick = () => {
    t += 1 / 60;
    for (const r of rigs) r.update(1 / 60);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  tick();
  window.__rigview.close = () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    canvas.remove();
    window.__rigview.close = null;
  };
  return { ids, canvasSize: [W, H] };
};
