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
  while (performance.now() - t0 < 12000) {
    if (S().overlay) { await sleep(60); if (opts.stopOnOverlay) return; continue; }
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
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

/** Fight the current battle: pick the strongest attack; swap when the active fighter is low; use potions if any. */
async function fight() {
  await until(() => S().overlay?.kind === "battle", 5000, "battle opens");
  const t0 = performance.now();
  while (S().overlay?.kind === "battle" && performance.now() - t0 < 120000) {
    await sleep(700);
    // the command bar accepts Enter when it is the player's phase; we just
    // keep choosing FIGHT → first move (the strongest for everyone) and
    // occasionally SWAP when the front fighter is low and a partner stands.
    const st = S();
    const party = st.party;
    const living = party.filter((p) => p.hp > 0);
    const front = party.find((p) => p.hp > 0);
    if (!front) break;
    const low = front.hp < front.maxHp * 0.3;
    const potion = st.inventory.find((i) => i.id === "potion" || i.id === "super_potion");
    if (low && potion) {
      key("ArrowDown"); await sleep(60); key("Enter"); await sleep(120); key("Enter"); await sleep(400);
      continue;
    }
    if (low && living.length > 1 && Math.random() < 0.5) {
      key("ArrowDown"); await sleep(60); key("ArrowDown"); await sleep(60); key("Enter"); await sleep(120);
      key("ArrowDown"); await sleep(60); key("Enter"); await sleep(400);
      continue;
    }
    key("Enter"); await sleep(120); key("Enter"); await sleep(300);
  }
  await until(() => S().overlay?.kind !== "battle", 8000, "battle closes");
  await sleep(600);
}

async function run() {
  log.length = 0;
  fails.length = 0;
  localStorage.removeItem("palakshi_save_v1");
  const store = window.__game.store;
  store.getState().setScreen("title");
  await sleep(300);
  store.getState().newGame();
  await until(() => !!window.__world && S().screen === "playing", 5000, "world created");
  await sleep(600);
  await dialogueThrough(() => S().flags.introDone);
  expect(S().flags.introDone, "intro done");

  // --- Mission 1: Find Mimo
  await walkTo(5, 7); await walkTo(5, 8, { untilMap: "house" });
  await until(() => S().map === "house", 3000, "entered house");
  expect(S().quests[0].step >= 1, "leaving the bedroom advanced the objective");
  await sleep(400);
  await walkTo(5, 5); placeAt(5, 5, "up"); await interact(); // Mum
  expect(S().flags.metMom, "met Mum");
  await walkTo(5, 8); await walkTo(5, 9, { untilMap: "town" });
  await until(() => S().map === "town", 3000, "entered town");
  await sleep(400);
  await walkTo(10, 7); placeAt(10, 7, "up"); await interact(); // Abhimanyu at (10,6)
  expect(S().flags.abhimanyuJoined, "Abhimanyu joined");
  expect(W().companion && W().companionId === "abhimanyu", "Abhimanyu follows as companion");
  await sleep(300);
  await walkTo(9, 10); placeAt(9, 10, "up"); await interact(); // witness at (9,9)
  expect(S().flags.clueWitnessHeard, "witness heard");
  await walkTo(17, 7); await walkTo(18, 7, { untilMap: "route1" });
  await until(() => S().map === "route1", 3000, "entered route1");
  await sleep(300);
  await walkTo(7, 8); placeAt(7, 8, "up"); await interact(); // toy at (7,7)
  expect(S().flags.clueToyFound, "toy found");
  await walkTo(8, 9); // paw print tile (8,8)/(8,9)
  await walkTo(8, 8, { stopOnOverlay: true });
  await dialogueThrough();
  expect(S().flags.cluePawsSeen, "paw prints seen");
  // avoid tall grass: go up the path x=8/9
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "forest" });
  await until(() => S().map === "forest", 3000, "entered forest");
  await sleep(300);
  await walkTo(8, 6); placeAt(8, 6, "down"); await interact(); // bush at (8,7)
  await fight();
  expect(S().flags.mimoRecognized, "Mimo recognised after the battle");
  await sleep(2800);
  expect(S().party.some((p) => p.id === "mimo") && !S().party.some((p) => p.id === "abhimanyu"), "Mimo in party, Abhimanyu left");
  expect(W().companionId === "mimo", "Mimo follows");
  // sniff ability
  window.__game.bus.emit("mimo:ping");
  await sleep(1600);
  // side quest: Prakriti
  await walkTo(4, 5); placeAt(4, 5, "up"); await interact();
  expect(S().quests.some((q) => q.id === "prakriti"), "Prakriti side quest accepted");
  await walkTo(16, 2); placeAt(16, 2, "right"); W().tryInteract(); await sleep(400); // ribbon at (17,1)? marker R at (16,1)
  placeAt(16, 2, "up"); W().tryInteract(); await sleep(400);
  expect(S().flags.ribbonFound, "ribbon found");
  await walkTo(4, 5); placeAt(4, 5, "up"); await interact();
  expect(S().quests.find((q) => q.id === "prakriti")?.done, "ribbon returned");

  // --- Mission: Lantern Village
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "village" });
  await until(() => S().map === "village", 3000, "entered village");
  await until(() => S().overlay?.kind === "dialogue", 6000, "village arrival dialogue");
  await dialogueThrough();
  await walkTo(8, 8); placeAt(8, 8, "up"); await interact(); // Elder at (8,7)
  expect(S().flags.elderBriefed, "elder briefed");
  await walkTo(14, 11); placeAt(14, 11, "up"); await interact(); // musician N at (14,10)
  expect(S().flags.musicianMet, "musician met");
  await walkTo(3, 11); placeAt(3, 11, "up"); await interact(); // merchant O at (3,10)
  expect(S().flags.villageSupplies, "supplies received");
  // --- Lost Scroll
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "bamboo" });
  await until(() => S().map === "bamboo", 3000, "entered bamboo");
  await sleep(3000); // arrival cinematic
  await walkTo(8, 12); placeAt(8, 12, "up"); await interact(); // barrier at (8,11)
  expect(S().flags.barrierBroken, "barrier broken");
  await sleep(400);
  await walkTo(8, 10); await walkTo(9, 2); placeAt(9, 2, "up"); await interact(); // scroll at (9,1)
  expect(S().flags.scrollFound, "scroll found");
  await walkTo(8, 13); await walkTo(8, 14, { untilMap: "village" });
  await until(() => S().map === "village", 3000, "back in village");
  await walkTo(8, 8); placeAt(8, 8, "up"); await interact();
  expect(S().flags.scrollDelivered, "scroll delivered");
  // --- Bamboo Trial
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "bamboo" });
  await until(() => S().map === "bamboo", 3000, "bamboo again");
  await walkTo(3, 3); placeAt(3, 3, "up"); W().tryInteract(); await sleep(300); await dialogueThroughIfAny();
  await walkTo(16, 3); placeAt(16, 3, "up"); W().tryInteract(); await sleep(300); await dialogueThroughIfAny();
  await walkTo(4, 4); W().tryInteract(); await sleep(300); await dialogueThroughIfAny();
  await walkTo(15, 4); W().tryInteract(); await sleep(300); await dialogueThroughIfAny();
  expect(S().flags.trialStarted, "trial started (2 statues + 2 plates)");
  await walkTo(5, 8); placeAt(5, 8, "up"); await interact(); // sentinel X at (5,7)
  await fight();
  expect(S().flags.trialDone, "trial done");
  await sleep(500);
  // --- Prakriti
  await walkTo(18, 7); await walkTo(19, 7, { untilMap: "garden" });
  await until(() => S().map === "garden", 3000, "entered garden");
  await sleep(3000);
  await walkTo(4, 9); placeAt(4, 9, "up"); await interact(); // Prakriti P at (4,8)
  await fight();
  expect(S().flags.prakritiDone, "Prakriti defeated");
  await sleep(500);
  await walkTo(14, 5); placeAt(14, 5, "up"); await interact(); // garden flame at (14,4)
  expect(S().flags.flameGarden, "garden flame");
  await sleep(2500);
  // --- Temple
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "mountain" });
  await until(() => S().map === "mountain", 3000, "entered mountain");
  await sleep(3000);
  await walkTo(6, 8); placeAt(6, 8, "up"); await interact(); // warden X at (6,7)
  await fight();
  expect(S().flags.miniboss2Done, "warden defeated");
  await sleep(500);
  await walkTo(14, 10); placeAt(14, 10, "up"); await interact(); // mountain flame at (14,9)
  expect(S().flags.flameMountain, "mountain flame");
  await sleep(2500);
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "temple" });
  await until(() => S().map === "temple", 3000, "entered temple");
  await sleep(3000);
  for (const [sx, sy] of [[3, 2], [16, 2], [3, 8], [16, 8]]) { await walkTo(sx, sy + 1); placeAt(sx, sy + 1, "up"); W().tryInteract(); await sleep(250); await dialogueThroughIfAny(); }
  for (const [px, py] of [[3, 4], [16, 4], [3, 10], [16, 10]]) { await walkTo(px, py); W().tryInteract(); await sleep(250); await dialogueThroughIfAny(); }
  expect(S().flags.templeOpened, "temple plates held");
  await walkTo(10, 13); placeAt(10, 13, "up"); await interact(); // guardian G at (10,12)
  await fight();
  expect(S().flags.guardianDone, "guardian defeated");
  await sleep(500);
  // --- Cave flame
  await walkTo(9, 13); await walkTo(9, 14, { untilMap: "mountain" });
  await until(() => S().map === "mountain", 3000, "mountain again");
  await walkTo(18, 7); await walkTo(19, 7, { untilMap: "cave" });
  await until(() => S().map === "cave", 3000, "entered cave");
  await sleep(3000);
  await walkTo(10, 10); placeAt(10, 10, "up"); await interact(); // cave flame at (10,9)
  expect(S().flags.flameCave, "cave flame");
  await sleep(2500);
  expect(S().quests[0].steps[S().quests[0].step].id === "lantern", "all three flames → lantern step");
  // --- Sacred Lantern
  await walkTo(1, 7); await walkTo(0, 7, { untilMap: "mountain" });
  await until(() => S().map === "mountain", 3000, "mountain from cave");
  await walkTo(8, 1); await walkTo(8, 0, { untilMap: "temple" });
  await until(() => S().map === "temple", 3000, "temple again");
  await walkTo(10, 5); placeAt(10, 5, "up"); await interact(); // lantern & at (10,4)
  expect(S().flags.lanternRestored, "lantern restored");
  await sleep(4500);
  // --- Academy
  S().setMap("town", 9, 12, "down"); window.__game.bus.emit("world:reload"); await sleep(800);
  await walkTo(9, 13); await walkTo(9, 14, { untilMap: "academy" });
  await until(() => S().map === "academy", 3000, "entered academy");
  await walkTo(9, 8); placeAt(9, 8, "up"); await interact(); // gatekeeper G at (9,7)
  expect(S().flags.gateOpen, "gate open");
  await sleep(400);
  await walkTo(9, 6); await walkTo(9, 3); placeAt(9, 3, "up"); await interact(); // Arshiya Y at (9,2)
  await fight();
  expect(S().flags.bossDefeated, "Arshiya defeated");
  await until(() => S().overlay?.kind === "dialogue", 8000, "finale dialogue");
  await dialogueThrough();
  expect(S().flags.finaleDone, "finale → mission 26");
  // --- Final chapter
  S().setMap("town", 1, 10, "left"); window.__game.bus.emit("world:reload"); await sleep(800);
  await walkTo(0, 10, { untilMap: "road" });
  await until(() => S().map === "road", 3000, "entered the west road");
  await sleep(3000);
  await walkTo(11, 6); await walkTo(11, 9); await walkTo(11, 12); await walkTo(11, 13, { untilMap: "f1205" });
  await until(() => S().map === "f1205", 3000, "entered F-1205");
  await sleep(3000);
  await walkTo(9, 6); placeAt(9, 6, "up"); await interact(); // Abhimanyu A at (9,5)
  expect(S().flags.f1205Arrived, "arrived at F-1205");
  await sleep(2800);
  await walkTo(2, 7); placeAt(2, 7, "up"); await interact(); // Faizal Z at (2,6)
  await walkTo(6, 5); placeAt(6, 5, "up"); await interact(); // Garv N at (6,4)
  await walkTo(4, 3); placeAt(4, 3, "up"); await interact(); // Hakim Q at (4,2)
  await walkTo(8, 8); placeAt(8, 8, "up"); await interact(); // Dev V at (8,7)
  expect(["metFaizal", "metGarv", "metHakim", "metDev"].every((k) => S().flags[k]), "met all four flatmates");
  await sleep(2800);
  await walkTo(9, 6); placeAt(9, 6, "up"); await interact(); // evening
  await until(() => S().overlay?.kind === "dialogue", 4000, "evening conversation");
  await dialogueThrough();
  expect(S().flags.eveningDone, "evening done");
  await sleep(500);
  await walkTo(7, 9); placeAt(7, 9, "up"); await interact(); // Abhimanyu by the door (7,8)
  await until(() => S().flags.hugDone, 4000, "hug");
  await until(() => S().screen === "end", 20000, "THE END");
  expect(S().screen === "end", "the game ends with THE END");
  say(`DONE — ${fails.length} failures`);
  return { log, fails };
}

async function dialogueThroughIfAny() {
  if (S().overlay?.kind === "dialogue") await dialogueThrough();
}

window.__e2e = { run, walkTo, placeAt, interact, fight, dialogueThrough, log, fails };
