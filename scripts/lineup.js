// ---------------------------------------------------------------------------
// Character line-up harness for visual review. Served by the Vite dev server;
// inject from the page console with:
//   await import("/scripts/lineup.js?x=" + Date.now())
// It builds one CharacterRig per id in CHARACTERS, stands them in a row on the
// current map (origin = the player's position + offsetX, 0.85 units apart along
// +x, facing -z) and exposes window.__lineup. The cleanest stage is the top
// road of Lantern Village: store.setMap("village", 1, 1, "down") + reload puts
// the row along row 1 with the north wall as a backdrop and nothing in front.
// window.__lineupOpts (read on import) may set { offsetX, spacing, ids, origin,
// hideEntities } — defaults: offsetX 0, spacing 0.85, all ids, hide map NPCs.
//
// Exposed:
//   __lineup.rigs            { id: CharacterRig }
//   __lineup.ids             the ids in row order
//   __lineup.frame(id, mode, {solo, dur})  camera close-up: "face" | "full" | "side"
//                            (solo defaults to true: only that rig is shown)
//   __lineup.capture(modes)  every id in every mode -> { "<id>-<mode>": dataURL }
//   __lineup.hideUI(on)      hide the React HUD so screenshots show only the canvas
//   __lineup.clear()         dispose rigs, restore the camera, player and UI
// Rigs are animated through their own requestAnimationFrame loop so idles show.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { CharacterRig } from "/src/world3d/CharacterRig.ts";
import { CHARACTERS } from "/src/world3d/characters.ts";

const HOLD = 120; // seconds a frame() shot is held before the camera returns

function world() {
  const w = window.__world;
  if (!w) throw new Error("window.__world is missing: start a game first (screen must be 'playing').");
  return w;
}

/** World-space eye point and body height of a rig (head joint is private in TS, public at runtime). */
function headOf(rig) {
  const scale = rig.spec.height ?? 1;
  rig.group.updateMatrixWorld(true);
  const head = rig.p?.head;
  const v = new THREE.Vector3();
  if (head) {
    head.getWorldPosition(v);
    v.y += 0.15 * scale * (rig.spec.headSize ?? 1); // neck joint -> eye line
  } else {
    v.copy(rig.group.position);
    v.y += rig.height - 0.16 * scale;
  }
  return v;
}

function makeLineup(opts = {}) {
  const w = world();
  // 0.85 keeps all 18 rigs west of the village's north gate when the row starts at x = 1.5
  const spacing = opts.spacing ?? 0.85;
  const origin = (opts.origin ? new THREE.Vector3().copy(opts.origin) : w.playerPos.clone()).add(new THREE.Vector3(opts.offsetX ?? 0, 0, 0));
  const ids = opts.ids ?? Object.keys(CHARACTERS);
  const rigs = {};
  ids.forEach((id, i) => {
    const rig = new CharacterRig(id);
    rig.group.position.set(origin.x + i * spacing, 0, origin.z);
    rig.setHeading(Math.PI, true); // face -z (toward the camera)
    w.scene.add(rig.group);
    rigs[id] = rig;
  });

  // hide the real player/companion so they don't photobomb the first slots
  // (World3D rewrites player.group.visible every frame, so hide the body under it)
  const hidden = [];
  for (const r of [w.player, w.companion]) {
    const g = r?.body ?? r?.group;
    if (g) { hidden.push([g, g.visible]); g.visible = false; }
  }
  // ...and the map's own NPCs / pickups, or Elder Shu stands in Elder Shu's portrait
  if (opts.hideEntities ?? true) {
    for (const e of w.entities ?? []) {
      if (e.object) { hidden.push([e.object, e.object.visible]); e.object.visible = false; }
    }
  }

  let last = performance.now();
  let raf = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const id of ids) rigs[id].update(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const uiHidden = [];
  function hideUI(on = true) {
    const canvas = w.renderer.domElement;
    if (on) {
      for (const el of document.body.querySelectorAll("body > *, #root > *")) {
        if (el === canvas || el.contains(canvas)) continue;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
        uiHidden.push([el, el.style.visibility]);
        el.style.visibility = "hidden";
      }
      // siblings of the canvas inside its container (HUD, dialogue, tracker)
      let p = canvas.parentElement;
      while (p && p !== document.body) {
        for (const el of p.children) {
          if (el === canvas || el.contains(canvas)) continue;
          uiHidden.push([el, el.style.visibility]);
          el.style.visibility = "hidden";
        }
        p = p.parentElement;
      }
    } else {
      for (const [el, v] of uiHidden) el.style.visibility = v;
      uiHidden.length = 0;
    }
  }

  /**
   * Point the camera at one rig. mode:
   *   "face" - 1.3 units in front at eye height, looking at the head
   *   "full" - 3 units in front, slightly above, looking at mid-body
   *   "side" - three-quarter view from the rig's front-right (+x)
   * Returns a promise that resolves when the camera has settled (dur elapsed).
   */
  function frame(id, mode = "face", opts = {}) {
    const rig = rigs[id];
    if (!rig) throw new Error("no rig " + id + " (ids: " + ids.join(", ") + ")");
    const dur = opts.dur ?? 0.01;
    // solo (default): only the framed rig is visible, so neighbours don't photobomb
    const solo = opts.solo ?? true;
    for (const other of ids) rigs[other].group.visible = !solo || other === id;
    const eye = headOf(rig);
    const base = rig.group.position.clone();
    const h = rig.height;
    // rig faces -z, so "in front" is -z from the rig
    const fwd = new THREE.Vector3(0, 0, -1);
    let pos, look;
    if (mode === "face") {
      pos = eye.clone().add(fwd.clone().multiplyScalar(1.3));
      pos.y = eye.y + 0.02;
      look = eye.clone();
    } else if (mode === "full") {
      pos = base.clone().add(fwd.clone().multiplyScalar(3));
      pos.y = h * 0.75 + 0.25;
      look = base.clone().setY(h * 0.5);
    } else if (mode === "side") {
      // from the rig's front-right (+x): the row grows along +x, so this side is never inside a wall
      const dir = new THREE.Vector3(0.75, 0, -1).normalize();
      pos = eye.clone().add(dir.multiplyScalar(2.4));
      pos.y = h * 0.8;
      look = base.clone().setY(h * 0.55);
    } else {
      throw new Error("mode must be face | full | side");
    }
    return new Promise((resolve) => {
      w.cam.playCinematic({ frames: [{ pos, look, dur, hold: HOLD }], onDone: () => {} });
      setTimeout(resolve, Math.max(80, dur * 1000 + 60));
    });
  }

  /**
   * Batch capture: frames every id in every mode, renders synchronously and
   * returns { "<id>-<mode>": "data:image/png;base64,..." }. Pipe the result
   * into a file and decode it with scripts/lineup-decode.js.
   */
  async function capture(modes = ["face", "full"], only = ids, settle = 160) {
    const out = {};
    hideUI(true);
    for (const id of only) {
      for (const mode of modes) {
        await frame(id, mode);
        await new Promise((r) => setTimeout(r, settle));
        w.renderer.render(w.scene, w.cam.camera);
        out[id + "-" + mode] = w.renderer.domElement.toDataURL("image/png");
      }
    }
    return out;
  }

  function clear() {
    cancelAnimationFrame(raf);
    for (const id of ids) {
      const rig = rigs[id];
      w.scene.remove(rig.group);
      rig.dispose?.();
    }
    for (const [g, v] of hidden) g.visible = v;
    hideUI(false);
    if (w.cam.cinematicActive) w.cam.stopCinematic();
    if (window.__lineup === api) delete window.__lineup;
  }

  const api = { rigs, ids, frame, capture, clear, hideUI, origin, spacing, CHARACTERS };
  return api;
}

if (window.__lineup) {
  try { window.__lineup.clear(); } catch { /* stale instance after HMR */ }
}
window.__lineup = makeLineup(window.__lineupOpts ?? {});
window.__lineup.make = makeLineup;
export default window.__lineup;
