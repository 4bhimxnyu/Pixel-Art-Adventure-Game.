// ---------------------------------------------------------------------------
// Scripted end-to-end playthrough for the 3D build. Served by the Vite dev
// server; inject with:  await import("/scripts/e2e.js?x=" + Date.now())
// then  await window.__e2e.run()  — returns a log of every step and any
// assertion that failed. It walks the REAL engine: positions are reached by
// moving the player rig, portals/encounters fire from the world's own
// cell-change logic, dialogues advance via the store, and battles are played
// by dispatching the same key events a player would press.
// ---------------------------------------------------------------------------

const log = [];
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = () => window.__game.store.getState();
const W = () => window.__world;
const say = (m) => log.push(m);
const expect = (cond, msg) => { if (!cond) { fails.push(msg); say("FAIL: " + msg); } else say("ok: " + msg); };

async function until(fn, ms = 6000, label = "condition") {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(50);
  }
  fails.push("timeout waiting for " + label);
  say("TIMEOUT: " + label);
  return false;
}

/** Walk the rig to a cell along a straight line, letting the world handle cells. */
async function walkTo(x, y, opts = {}) {
  const w = W();
  const target = { x: x + 0.5, z: -(y + 0.5) };
  const t0 = performance.now();
  while (performance.now() - t0 < 20000) {
    if (opts.untilMap && S().map === opts.untilMap) return true;
    const ov = S().overlay?.kind;
    if (ov === "battle") { say("  (wild encounter on " + S().map + ")"); await fight(); continue; }
    if (ov === "dialogue") { if (opts.stopOnOverlay) return true; await dialogueThrough(); continue; }
    if (ov) { await sleep(60); continue; }
    if (w.inputLocked || w.cam.cinematicActive) { await sleep(60); continue; }
    const p = w.playerPos;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) return true;
    const step = Math.min(d, 0.09);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    w.heading = Math.atan2(dx, dz);
    w.player.setHeading(w.heading, true);
    await sleep(16);
    if (opts.untilMap && S().map === opts.untilMap) return true;
  }
  fails.push(`walkTo(${x},${y}) timed out on ${S().map}`);
  say(`TIMEOUT walkTo(${x},${y}) on ${S().map} overlay=${S().overlay?.kind ?? "-"}`);
  return false;
}

/** Teleport inside the current map (keeps map logic honest for cells). */
function placeAt(x, y, dir) {
  const w = W();
  w.playerPos.set(x + 0.5, 0, -(y + 0.5));
  const h = { down: Math.PI, up: 0, left: -Math.PI / 2, right: Math.PI / 2 }[dir || "down"];
  w.heading = h;
  w.player.setHeading(h, true);
}

async function dialogueThrough(expectEnd) {
  await until(() => S().overlay?.kind === "dialogue", 4000, "dialogue opens");
  let guard = 0;
  while (S().overlay?.kind === "dialogue" && guard++ < 60) {
    S().advanceDialogue();
    await sleep(40);
  }
  await sleep(250);
  if (expectEnd) await until(expectEnd, 4000, "dialogue effect");
}

async function interact(expectDialogue = true) {
  W().tryInteract();
  if (expectDialogue) await dialogueThrough();
}

function key(k) {
  // press AND release: a key left "held" would make the input layer walk the
  // player on its own (ArrowDown = backwards) after the battle ends
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true })), 40);
}

/**
 * Fight the current battle the way the game teaches: attack with the strongest
 * move, drink a potion when low, and against Arshiya rotate fighters when her
 * read deepens (she multiplies damage against whoever stays in front).
 */
async function fight() {
  await until(() => S().overlay?.kind === "battle", 5000, "battle opens");
  const arshiya = S().overlay?.enemyId === "fashion_teacher";
  const t0 = performance.now();
  let frontIdx = 0;
  let lastAction = "";
  while (S().overlay?.kind === "battle" && performance.now() - t0 < 240000) {
    await sleep(400);
    // the command buttons only exist during the player's phase
    if (!document.querySelector(".battle-ui button.btn")) continue;
    const st = S();
    const party = st.party;
    if (!party[frontIdx] || party[frontIdx].hp <= 0) frontIdx = party.findIndex((p) => p.hp > 0);
    const front = party[frontIdx];
    if (!front) break;
    const lines = Array.from(document.querySelectorAll(".battle-log > div")).map((d) => d.textContent || "");
    const recent = lines.slice(-2).join(" ");
    const readM = recent.match(/deepens \(x(\d+)\)/);
    const read = readM ? +readM[1] : 0;
    const measure = /has your measure/.test(recent);
    const potion = st.inventory.find((i) => i.id === "super_potion" || i.id === "potion");
    const other = party.findIndex((p, i) => i !== frontIdx && p.hp > p.maxHp * 0.3);
    let act = "fight";
    if (front.hp < front.maxHp * 0.33 && potion) act = "item";
    else if (arshiya && other >= 0 && lastAction !== "swap" && (read >= 3 || measure || front.hp < front.maxHp * 0.45)) act = "swap";
    else if (!arshiya && other >= 0 && front.hp < front.maxHp * 0.2 && !potion) act = "swap";
    if (act === "item") {
      key("ArrowDown"); await sleep(120); key("Enter"); await sleep(250); key("Enter");
    } else if (act === "swap") {
      key("ArrowDown"); await sleep(120); key("ArrowDown"); await sleep(120); key("Enter"); await sleep(250);
      for (let i = 0; i < other; i++) { key("ArrowDown"); await sleep(120); }
      key("Enter");
      frontIdx = other;
    } else {
      key("Enter"); await sleep(250); key("Enter");
    }
    lastAction = act;
    await sleep(1400); // let the enemy phase play out
  }
  await until(() => S().overlay?.kind !== "battle", 8000, "battle closes");
  await sleep(600);
  // the story opens its follow-up dialogue 300ms after the battle closes
  await dialogueThroughIfAny();
}


/** Static reachability audit: every portal, NPC and interactable on every map must be walkable to. */
async function audit() {
  const maps = await import("/src/game/maps.ts");
  const story = await import("/src/game/story.ts");
  const store = await import("/src/store/useGameStore.ts");
  const flags = JSON.parse(JSON.stringify(store.INITIAL_FLAGS));
  for (const k of Object.keys(flags)) if (typeof flags[k] === "boolean") flags[k] = true;
  const key = (x, y) => x + "," + y;
  for (const def of Object.values(maps.MAPS)) {
    const W = maps.mapWidth(def), H = maps.mapHeight(def);
    const markers = Object.keys(def.interacts).map((m) => { for (let y = 0; y < H; y++) { const x = def.rows[y].indexOf(m); if (x >= 0) return { m, x, y }; } return null; }).filter(Boolean);
    const solid = (x, y) => story.cellBlocked(def, x, y, flags) || markers.some((c) => c.x === x && c.y === y);
    if (!def.portals.length) continue;
    const seen = new Set([key(def.portals[0].x, def.portals[0].y)]);
    const q = [def.portals[0]];
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(key(nx, ny)) || solid(nx, ny)) continue;
        seen.add(key(nx, ny)); q.push({ x: nx, y: ny });
      }
    }
    const near = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(x + dx, y + dy)));
    for (const p of def.portals) expect(seen.has(key(p.x, p.y)), `${def.id}: portal to ${p.to} reachable`);
    for (const c of markers) expect(near(c.x, c.y), `${def.id}: ${def.interacts[c.m].kind} reachable`);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = maps.tileAt(def, x, y);
      if ("$&!*~hyz".includes(ch)) expect((story.UNDERFOOT.includes(ch) && seen.has(key(x, y))) || near(x, y), `${def.id}: '${ch}' at ${x},${y} reachable`);
    }
  }
}

// ---------------------------------------------------------------- map-aware helpers
let MAPS_MOD = null;
async function mapsMod() { return (MAPS_MOD ??= await import("/src/game/maps.ts")); }
async function def(id) { return (await mapsMod()).MAPS[id]; }
/** Cell of a marker letter on a map. */
async function cellOf(mapId, marker) {
  const d = await def(mapId);
  for (let y = 0; y < d.rows.length; y++) { const x = d.rows[y].indexOf(marker); if (x >= 0) return { x, y }; }
  throw new Error(`marker ${marker} not on ${mapId}`);
}
/** All cells of a tile char on a map, in row order. */
async function tileCells(mapId, ch) {
  const d = await def(mapId);
  const out = [];
  for (let y = 0; y < d.rows.length; y++) for (let x = 0; x < d.rows[y].length; x++) if (d.rows[y][x] === ch) out.push({ x, y });
  return out;
}
/** The first portal on `mapId` that leads to `to`. */
async function portalTo(mapId, to) {
  const d = await def(mapId);
  const p = d.portals.find((q) => q.to === to);
  if (!p) throw new Error(`no portal ${mapId} -> ${to}`);
  return p;
}
/** Walk through the gate to another map. */
async function go(to) {
  const from = S().map;
  const d0 = await def(from);
  if (!d0.portals.some((q) => q.to === to)) {
    const pp = W().playerPos;
    fails.push(`go(${to}): no portal from ${from} (player at ${pp.x.toFixed(2)},${pp.z.toFixed(2)})`);
    say(`FAIL go(${to}) from ${from}; recent: ${trace.slice(-6).join(" | ")}`);
    return;
  }
  const p = await portalTo(from, to);
  const d = await def(from);
  const W0 = d.rows[0].length, H0 = d.rows.length;
  const inward = p.x === 0 ? { x: 1, y: 0 } : p.x === W0 - 1 ? { x: -1, y: 0 } : p.y === 0 ? { x: 0, y: 1 } : p.y === H0 - 1 ? { x: 0, y: -1 } : { x: 0, y: -1 };
  await walkTo(p.x + inward.x, p.y + inward.y);
  await walkTo(p.x, p.y, { untilMap: to });
  await until(() => S().map === to, 4000, `entered ${to}`);
  await sleep(400);
}
/** Stand next to a cell on an open side and face it. */
async function standBy(cell) {
  const story = await import("/src/game/story.ts");
  const d = await def(S().map);
  const flags = S().flags;
  const sides = [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]];
  for (const [dx, dy, dir] of sides) {
    const x = cell.x + dx, y = cell.y + dy;
    if (x < 0 || y < 0 || y >= d.rows.length || x >= d.rows[0].length) continue;
    if (story.cellBlocked(d, x, y, flags)) continue;
    if (W().entities.some((e) => e.x === x && e.y === y)) continue;
    await walkTo(x, y);
    placeAt(x, y, dir);
    return true;
  }
  fails.push(`no open side next to ${cell.x},${cell.y} on ${S().map}`);
  return false;
}
async function talk(marker, expectDialogue = true) { await standBy(await cellOf(S().map, marker)); await interact(expectDialogue); }
async function useTile(ch, nth = 0, expectDialogue = false) {
  const cells = await tileCells(S().map, ch);
  const c = cells[nth];
  if (!c) { fails.push(`no '${ch}' #${nth} on ${S().map}`); return; }
  await standBy(c);
  await interact(expectDialogue);
}
/** Underfoot tiles (plates) are used by standing on them. */
async function standOn(ch, nth = 0) {
  const c = (await tileCells(S().map, ch))[nth];
  await walkTo(c.x, c.y);
  W().tryInteract(); await sleep(250); await dialogueThroughIfAny();
}

const trace = [];
let traceOff = null;
function startTrace() {
  traceOff?.();
  trace.length = 0;
  const t0 = performance.now();
  traceOff = window.__game.store.subscribe((n, o) => {
    try {
      const t = Math.round(performance.now() - t0);
      if (n.map !== o.map) { const p = W()?.playerPos; trace.push(`${t}ms map ${o.map}->${n.map} @${p ? p.x.toFixed(1) + "," + p.z.toFixed(1) : "?"}`); }
      const ok = o.overlay?.kind ?? null, nk = n.overlay?.kind ?? null;
      if (ok !== nk) trace.push(`${t}ms overlay ${ok}->${nk}${nk === "dialogue" ? ":" + (n.overlay.id ?? "") : ""}`);
    } catch { /* noop */ }
  });
}

async function run() {
  log.length = 0;
  fails.length = 0;
  startTrace();
  await audit();
  localStorage.removeItem("palakshi_save_v1");
  const store = window.__game.store;
  store.getState().setScreen("title");
  await sleep(300);
  store.getState().newGame();
  await until(() => !!window.__world && S().screen === "playing", 5000, "world created");
  await sleep(600);
  await dialogueThrough(() => S().flags.introDone);
  expect(S().flags.introDone, "intro done");

  // --- Chapter 1: Find Mimo
  await go("house");
  expect(S().quests[0].step >= 1, "leaving the bedroom advanced the objective");
  expectBeacon("house");
  await talk("M");
  expect(S().flags.metMom, "met Mum");
  await go("town");
  await talk("A");
  expect(S().flags.abhimanyuJoined, "Abhimanyu joined");
  expect(W().companion && W().companionId === "abhimanyu", "Abhimanyu follows as companion");
  await talk("R"); await talk("R"); // Riddhi, twice: she must have more than one thing to say
  expect(Object.keys(S().flags.npcSpoken).filter((k) => k.startsWith("riddhi_town")).length === 2, "Riddhi chatted twice in town");
  await talk("W");
  expect(S().flags.clueWitnessHeard, "witness heard");
  await go("route1");
  await useTile("y", 0, true);
  expect(S().flags.clueToyFound, "toy found");
  { const paws = await tileCells("route1", "p"); const last = paws[paws.length - 1]; await walkTo(last.x, last.y, { stopOnOverlay: true }); await dialogueThroughIfAny(); }
  expect(S().flags.cluePawsSeen, "paw prints seen");
  await go("forest");
  await talk("C"); // the rustling bush
  await fight();
  expect(S().flags.mimoRecognized, "Mimo recognised after the battle");
  await sleep(2800);
  expect(S().party.some((p) => p.id === "mimo") && !S().party.some((p) => p.id === "abhimanyu"), "Mimo in party, Abhimanyu left");
  expect(W().companionId === "mimo", "Mimo follows");
  window.__game.bus.emit("mimo:ping"); await sleep(1600);
  await talk("P");
  expect(S().quests.some((q) => q.id === "prakriti"), "Prakriti side quest accepted");
  await talk("R", false); await sleep(400);
  expect(S().flags.ribbonFound, "ribbon found");
  await talk("P");
  expect(S().quests.find((q) => q.id === "prakriti")?.done, "ribbon returned");

  // --- Chapter 2: Lantern Village
  await go("village");
  expectBeacon("village");
  if (!(await until(() => S().overlay?.kind === "dialogue", 9000, "village arrival dialogue"))) say(`  trace: ${trace.slice(-8).join(" | ")} lock=${W().inputLocked} cin=${W().cam.cinematicActive} seenVillage=${S().flags.seenVillage}`);
  else await dialogueThrough();
  await talk("E");
  expect(S().flags.elderBriefed, "elder briefed");
  await talk("N");
  expect(S().flags.musicianMet, "musician met");
  await talk("O");
  expect(S().flags.villageSupplies, "supplies received");
  await talk("R");
  expect(Object.keys(S().flags.npcSpoken).some((k) => k.startsWith("riddhi_village")), "Riddhi met in the village");

  // --- Chapter 3: The Bamboo Forest
  await go("bamboo");
  await sleep(3200);
  await useTile("=", 0, true);
  expect(S().flags.barrierBroken, "barrier broken");
  await sleep(500);
  await useTile("$", 0, true);
  expect(S().flags.scrollFound, "scroll found");
  await go("village");
  await talk("E");
  expect(S().flags.scrollDelivered, "scroll delivered");
  await go("bamboo");
  await useTile("u", 0); await useTile("u", 1);
  await standOn("z", 0); await standOn("z", 1);
  expect(S().flags.trialStarted, "trial started (2 statues + 2 plates)");
  await talk("X");
  await fight();
  expect(S().flags.trialDone, "trial done");
  await expectGone("npc_miniboss1", "Bamboo Sentinel");
  expectBeacon("after trial");

  // --- Chapter 4: The Hidden Garden
  await go("garden");
  await sleep(3200);
  await talk("R");
  expect(Object.keys(S().flags.npcSpoken).some((k) => k.startsWith("riddhi_garden")), "Riddhi met in the garden");
  await talk("X");
  await fight();
  expect(S().flags.miniboss3Done, "Blossom Warden defeated");
  await expectGone("npc_miniboss3", "Blossom Warden");
  await talk("P");
  await fight();
  expect(S().flags.prakritiDone, "Prakriti defeated");
  await expectGone("npc_prakriti_duel", "Prakriti");
  await useTile("!");
  expect(S().flags.flameGarden, "garden flame");
  await sleep(2500);

  // --- Chapter 5: The Mountain Path
  await go("mountain");
  await sleep(3200);
  await talk("X");
  await fight();
  expect(S().flags.miniboss2Done, "warden defeated");
  await expectGone("npc_miniboss2", "Mountain Warden");
  await useTile("!");
  expect(S().flags.flameMountain, "mountain flame");
  await sleep(2500);
  await go("temple");
  await sleep(3200);
  for (let i = 0; i < 4; i++) await useTile("u", i);
  for (let i = 0; i < 4; i++) await standOn("z", i);
  expect(S().flags.templeOpened, "temple plates held");
  await talk("G");
  await fight();
  expect(S().flags.guardianDone, "guardian defeated");
  await expectGone("npc_guardian", "Temple Guardian");

  // --- Chapter 6: The Three Flames
  await go("mountain");
  await go("cave");
  await sleep(3200);
  await useTile("u", 0); await useTile("u", 1);
  await standOn("z", 0); await standOn("z", 1);
  await useTile("!");
  expect(S().flags.flameCave, "cave flame");
  await sleep(2500);
  expect(S().quests[0].steps[S().quests[0].step].id === "lantern", "all three flames: lantern step");
  await go("mountain");
  await go("temple");
  await useTile("&", 0, true);
  expect(S().flags.lanternRestored, "lantern restored");
  await sleep(4500);

  // --- Chapter 7: Arshiya
  { const p = await portalTo("town", "academy"); S().setMap("town", p.x, p.y - 1, "down"); window.__game.bus.emit("world:reload"); await sleep(800); }
  await go("academy");
  await talk("G");
  expect(S().flags.gateOpen, "gate open");
  await sleep(400);
  await talk("Y");
  await fight();
  expect(S().flags.bossDefeated, "Arshiya defeated");
  expect(!W().entities.some((e) => e.kind === "npc_boss"), "Arshiya has left the Academy");
  await until(() => S().overlay?.kind === "dialogue", 8000, "finale dialogue");
  await dialogueThrough();
  expect(S().flags.finaleDone, "finale: the West Road opens");

  // --- Chapter 8: The West Road
  { const p = await portalTo("town", "road"); S().setMap("town", p.x + 1, p.y, "left"); window.__game.bus.emit("world:reload"); await sleep(800); }
  await go("road");
  await sleep(3200);
  await go("f1205");
  await sleep(3200);
  expect(W().cam.firstPerson === true, "F-1205 is first-person");

  // --- Chapter 9: F-1205
  await talk("Z"); // Faizal holds the door
  expect(S().flags.f1205Arrived, "arrived at F-1205");
  await sleep(2800);
  await talk("A");
  expect(S().flags.metAbhiHome, "met Abhimanyu in his room");
  await talk("Q"); await talk("N"); await talk("V"); await talk("Z");
  expect(["metFaizal", "metGarv", "metHakim", "metDev"].every((k) => S().flags[k]), "met all four flatmates");
  await sleep(3400); // the flat rearranges
  { const a = W().entities.find((e) => e.kind === "npc_abhimanyu_home"); expect(a && a.y <= 5, "Abhimanyu moved to the living room"); await standBy({ x: a.x, y: a.y }); await interact(); }
  await until(() => S().overlay?.kind === "dialogue", 9000, "evening conversation");
  await dialogueThrough();
  expect(S().flags.eveningDone, "evening done");
  await sleep(600);
  { const a = W().entities.find((e) => e.kind === "npc_abhimanyu_home"); await standBy({ x: a.x, y: a.y }); await interact(); }
  await until(() => S().flags.hugDone, 4000, "hug");
  await until(() => S().screen === "end", 25000, "THE END");
  expect(S().screen === "end", "the game ends with THE END");
  say(`DONE: ${fails.length} failures`);
  return { log, fails };
}

/** The villain we just beat must be gone from the world and never fight again. */
async function expectGone(kind, label) {
  await sleep(2200); // leave animation + rebuild
  expect(!W().entities.some((e) => e.kind === kind), `${label} has left the scene`);
}

/** The objective beacon must exist whenever the main quest is unfinished. */
function expectBeacon(label) {
  const q = S().quests.find((x) => x.id === "main");
  if (q.done) return;
  expect(!!W().beacon, `beacon shown: ${label}`);
}

async function dialogueThroughIfAny() {
  if (S().overlay?.kind === "dialogue") await dialogueThrough();
}

window.__e2e = { run, walkTo, placeAt, interact, fight, dialogueThrough, go, talk, useTile, standOn, cellOf, log, fails, trace };
