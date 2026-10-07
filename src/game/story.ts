// ---------------------------------------------------------------------------
// The story engine, independent of the renderer.
//
// Everything that decides WHAT happens when the player interacts, finishes a
// dialogue or finishes a battle lives here. It was lifted out of the Phaser
// WorldScene so the 3D world and the classic 2D scene run the identical branch
// tables. The renderer only supplies a small WorldFx surface (refresh, battle,
// flash, shake, flourish, timers) and the current map.
//
// Rules preserved from the original scene:
//   * story branching hangs off `dialogue:end` (the store emits it) — never
//     inline branching into the dialogue component.
//   * NPC markers are skipped when that character is already in the party.
//   * interactables are solid; underfoot specials are the only walkable ones.
// ---------------------------------------------------------------------------

import { BARRIER_FLAG, SOLID, tileAt, mapWidth, mapHeight, type MapDef, type MapId } from "./maps";
import { bus } from "./bus";
import { useGameStore, type Flags } from "../store/useGameStore";
import { DOG, ABHIMANYU, QUEST_PRAKRITI, QUEST_HIDDEN, ITEMS, type ItemId } from "../data/content";
import { playBgm, sfx, gong } from "./sound";
import { questSfx } from "../lib/questSfx";
import { handleFinalChapterDialogue, handleFinalChapterInteract, FINAL_CHAPTER_PROMPTS } from "./storyFinal";

/** What the story needs from whichever renderer is active. */
export interface WorldFx {
  /** Re-read flags and rebuild the current map (collected items vanish, NPCs leave). */
  refresh(): void;
  startBattle(enemyId: string, boss: boolean): void;
  flash(ms: number, rgb: [number, number, number]): void;
  shake(ms: number, intensity: number): void;
  /** Golden burst at a tile. */
  flourish(x: number, y: number): void;
  delay(ms: number, fn: () => void): void;
  currentMap(): MapDef;
  /** Optional cinematic hook — the 3D world plays a camera move, Phaser ignores. */
  cinematic?(kind: string, payload?: any): void;
}

export const INTERACT_TILE: Record<string, string> = {
  s: "sign", b: "bed", D: "desk", B: "bookshelf", T: "tv", m: "stall", L: "lantern",
  u: "statue", z: "plate", "=": "barrier", $: "scroll", "!": "flame", "&": "sacred_lantern",
  i: "inscription", "*": "chest", "+": "viewpoint", "~": "dig", I: "incense",
  h: "hidden", y: "clue_toy", "%": "banner",
  // final chapter props
  S: "sofa", l: "guitar_stand", "@": "poster", "0": "window", "[": "counter", "]": "fridge", x: "weights", "7": "table",
  "6": "clutter", "8": "chair", "9": "snacks",
};

/** Tiles the player may stand ON and still interact with. */
export const UNDERFOOT = "zh~+I";

export function puzzleStatuesFor(id: MapId) { return id === "temple" ? 4 : 2; }
export function puzzlePlatesFor(id: MapId) { return id === "temple" ? 4 : 2; }

/** Entities that should no longer exist given story state. */
export function shouldSkipEntity(kind: string, partyId: string | undefined, flags: Flags) {
  const party = useGameStore.getState().party;
  if (partyId && party.some((p) => p.id === partyId)) return true;
  switch (kind) {
    case "npc_abhimanyu": return flags.abhimanyuJoined;
    case "mimo_here": return flags.mimoRecognized;
    case "ribbon_spot": return flags.ribbonFound;
    case "npc_prakriti": return flags.prakritiDone;
    case "npc_prakriti_duel": return flags.prakritiDone;
    case "npc_miniboss1": return flags.miniboss1Done;
    case "npc_miniboss2": return flags.miniboss2Done;
    case "npc_miniboss3": return flags.miniboss3Done;
    case "npc_guardian": return flags.guardianDone;
    case "npc_boss": return flags.bossDefeated;
    default: return false;
  }
}

/** Collected pickups and spent tiles stop being drawn / blocking. */
export function isHidden(def: MapDef, ch: string, x: number, y: number, flags: Flags) {
  const key = `${def.id}_${x}_${y}`;
  if (ch === "h") return !!flags.hidden[key];
  if (ch === "*") return !!flags.chests[key];
  if (ch === "~") return !!flags.digs[key];
  if (ch === "$") return flags.scrollFound;
  if (ch === "y") return flags.clueToyFound;
  if (ch === "!") {
    if (def.id === "mountain") return flags.flameMountain;
    if (def.id === "garden") return flags.flameGarden;
    if (def.id === "cave") return flags.flameCave;
  }
  return false;
}

/** Is a cell walkable right now (ignoring entities)? */
export function cellBlocked(def: MapDef, x: number, y: number, flags: Flags) {
  if (x < 0 || y < 0 || x >= mapWidth(def) || y >= mapHeight(def)) return true;
  const ch = tileAt(def, x, y);
  if (ch === "=") {
    const f = BARRIER_FLAG[def.id];
    return f ? !(flags as any)[f] : true;
  }
  if (SOLID.has(ch)) {
    if ("$&*!y".includes(ch) && isHidden(def, ch, x, y, flags)) return false;
    return true;
  }
  return false;
}

export function promptLabel(kind: string, name?: string) {
  if (FINAL_CHAPTER_PROMPTS[kind]) return FINAL_CHAPTER_PROMPTS[kind];
  switch (kind) {
    case "mimo_here": return "Ask Mimo to investigate";
    case "clue_toy": case "clue_paws": return "Examine clue";
    case "hidden": case "chest": case "dig": case "ribbon_spot": return "Search";
    case "bed": return "Rest";
    case "npc_miniboss1": case "npc_miniboss2": case "npc_miniboss3": case "npc_guardian":
    case "npc_boss": case "npc_prakriti_duel": return "Begin the fight";
    case "sign": case "inscription": case "bookshelf": case "desk": case "tv":
    case "statue": case "banner": case "viewpoint": return "Examine";
    case "plate": return "Stand on the plate";
    case "barrier": return "Try the barrier";
    case "scroll": return "Take the scroll";
    case "flame": return "Take the flame";
    case "sacred_lantern": return "Light the lantern";
    case "lantern": return "Examine lantern";
    case "incense": return "Offer incense";
    case "stall": return "Browse";
    default:
      if (kind.startsWith("npc_")) return name ? `Talk to ${name}` : "Talk";
      return "Interact";
  }
}

export class StoryController {
  constructor(public readonly fx: WorldFx) {}

  say(text: string) {
    useGameStore.getState().openLines([{ who: "Palakshi", portrait: "palakshi", text }]);
  }

  /**
   * A defeated villain walks off before the world is rebuilt without them.
   * Their completion flag is already set, so the rebuilt map never spawns
   * them again and the battle can never re-trigger.
   */
  leaveThenRefresh(kind: string) {
    if (this.fx.cinematic) {
      this.fx.cinematic("villain-leaves", { kind });
      this.fx.delay(1700, () => this.fx.refresh());
    } else {
      this.fx.refresh();
    }
  }

  // ------------------------------------------------------------ interaction

  handleInteract(kind: string, x: number, y: number) {
    const store = useGameStore.getState();
    const f = store.flags;
    const def = this.fx.currentMap();
    const key = `${def.id}_${x}_${y}`;
    const D = (k: string) => store.openDialogue(k);

    if (handleFinalChapterInteract(this, kind)) return;

    switch (kind) {
      // ---------------------------------------------------------- scenery
      case "sign": return D(def.id === "bedroom" ? "sign_bedroom" : "townie1");
      case "bed": {
        store.healParty();
        store.save();
        bus.emit("toast", { text: "Rested. Everyone back to full health.", tone: "good" });
        return D("bed");
      }
      case "desk": return D("desk");
      case "bookshelf": return D("bookshelf");
      case "tv": return D("tv");
      case "banner": return this.say("A festival banner, folded and put away too early.");
      case "lantern": return this.say(f.lanternRestored ? "The lantern burns steady and gold." : "Cold. The wick hasn't been lit in days.");
      case "stall": return this.say("Rice cakes, dried plums, and a very determined cat.");
      case "viewpoint": return D("viewpoint");
      case "inscription": {
        store.markRecord("lore", key);
        return D("inscription");
      }
      case "incense": {
        gong();
        store.healParty();
        store.save();
        bus.emit("toast", { text: "The incense restores the whole party.", tone: "good" });
        return this.say("You offer incense. The smoke goes straight up, and the ache goes out of your arms.");
      }

      // ---------------------------------------------------------- pickups
      case "hidden": {
        if (f.hidden[key]) return;
        store.markRecord("hidden", key);
        store.addQuest(QUEST_HIDDEN);
        const item: ItemId =
          def.id === "bedroom" ? "key_scarf" : def.id === "town" ? "hair_pin" :
          def.id === "forest" ? "berry" : "sparkle_shard";
        store.addItem(item);
        store.advanceQuest("hidden");
        questSfx.objective();
        bus.emit("toast", { text: `Found ${ITEMS[item].name}!`, tone: "good" });
        this.fx.flourish(x, y);
        return this.fx.refresh();
      }
      case "chest": {
        if (f.chests[key]) return;
        store.markRecord("chests", key);
        const item: ItemId = def.id === "cave" ? "super_potion" : def.id === "village" ? "lantern_oil" : "potion";
        store.addItem(item, 2);
        questSfx.objective();
        bus.emit("toast", { text: `Chest: ${ITEMS[item].name} x2`, tone: "good" });
        this.fx.flourish(x, y);
        return this.fx.refresh();
      }
      case "dig": {
        if (f.digs[key]) return;
        if (!store.party.some((p) => p.id === "mimo")) {
          return this.say("Soft earth. Somebody with paws could dig here.");
        }
        store.markRecord("digs", key);
        store.addItem("old_photo");
        questSfx.objective();
        bus.emit("toast", { text: "Mimo digs up an Old Photo.", tone: "good" });
        this.fx.cinematic?.("mimo-dig", { x, y });
        this.fx.flourish(x, y);
        return this.fx.refresh();
      }
      case "ribbon_spot": {
        store.setFlag("ribbonFound", true);
        store.addItem("lost_ribbon");
        store.advanceQuest("prakriti", "return");
        questSfx.objective();
        bus.emit("toast", { text: "Found the Lost Ribbon.", tone: "good" });
        return this.fx.refresh();
      }
      case "clue_toy": {
        if (f.clueToyFound) return;
        return D("clue_toy");
      }

      // ---------------------------------------------------------- puzzles
      case "statue": {
        if (f.statues[key]) return this.say("The statue's eyes are already lit.");
        store.markRecord("statues", key);
        gong();
        bus.emit("toast", { text: "The statue's eyes light up.", tone: "good" });
        this.fx.flourish(x, y);
        this.checkPuzzle();
        return;
      }
      case "plate": {
        if (f.plates[key]) return this.say("This plate is already held down.");
        const needed = puzzleStatuesFor(def.id);
        const lit = Object.keys(f.statues).filter((k) => k.startsWith(def.id)).length;
        if (lit < needed) {
          questSfx.denied();
          return this.say(`The plate won't hold. ${needed - lit} statue(s) still sleeping.`);
        }
        store.markRecord("plates", key);
        sfx("confirm");
        bus.emit("toast", { text: "The plate sinks with a stone click.", tone: "good" });
        this.checkPuzzle();
        return;
      }
      case "barrier": {
        if (def.id === "academy") return D("gatekeeper_locked");
        if (f.barrierBroken) return;
        if (!f.musicianMet) return D("barrier_locked");
        return D(store.party.some((p) => p.id === "abhimanyu") ? "barrier_break" : "barrier_break_mimo");
      }
      case "scroll": {
        if (f.scrollFound) return;
        return D("scroll_take");
      }
      case "flame": {
        const which =
          def.id === "mountain" ? "flameMountain" : def.id === "garden" ? "flameGarden" : "flameCave";
        if ((f as any)[which]) return;
        if (def.id === "mountain" && !f.miniboss2Done) {
          questSfx.denied();
          return this.say("The Warden's staff bars the shrine. Face him first.");
        }
        if (def.id === "garden" && !f.miniboss3Done) {
          questSfx.denied();
          return this.say("Wings beat the air around the shrine. The Blossom Warden won't let me near it.");
        }
        if (def.id === "cave" && Object.keys(f.plates).filter((k) => k.startsWith("cave")).length < 2) {
          questSfx.denied();
          return this.say("The brazier is sealed by the echo stones. Wake both statues, then hold both plates.");
        }
        store.setFlag(which as keyof Flags, true as never);
        const item: ItemId =
          def.id === "mountain" ? "sacred_flame_mountain" : def.id === "garden" ? "sacred_flame_garden" : "sacred_flame_cave";
        store.addItem(item);
        questSfx.flame();
        bus.emit("flame:collected", { which, name: ITEMS[item].name });
        this.fx.flourish(x, y);
        this.fx.cinematic?.("discovery", { x, y, title: ITEMS[item].name });

        const s2 = useGameStore.getState();
        const n = [s2.flags.flameMountain, s2.flags.flameGarden, s2.flags.flameCave].filter(Boolean).length;
        bus.emit("toast", { text: `Sacred Flame ${n}/3 — ${ITEMS[item].name}`, tone: "good" });
        if (n === 3) {
          store.advanceQuest("main", "lantern");
          bus.emit("cinematic", { kind: "objective", title: "ALL THREE FLAMES GATHERED", subtitle: "Return to the Temple of Echoes" });
        }
        return this.fx.refresh();
      }
      case "sacred_lantern": {
        if (f.lanternRestored) return this.say("The Sacred Lantern burns. The village will see it from the valley.");
        const n = [f.flameMountain, f.flameGarden, f.flameCave].filter(Boolean).length;
        if (n < 3) {
          questSfx.denied();
          return this.say(`The lantern is cold. ${3 - n} Sacred Flame(s) still out there.`);
        }
        return D("lantern_restored");
      }

      // ---------------------------------------------------------------- npcs
      case "npc_mom": return D(f.metMom ? "mom_after" : "mom");
      case "npc_abhimanyu": return D("abhimanyu_meet");
      case "npc_witness": return D(f.clueWitnessHeard ? "townie2" : "witness");
      case "npc_townie1": return D("townie1");
      case "npc_townie2": return D("townie2");
      case "npc_riddhi": {
        // Riddhi has three things to say wherever she turns up, then cycles the last two
        const where = def.id === "town" ? "town" : def.id === "village" ? "village" : "garden";
        const n = store.flags.villageTalks; // unused counter kept for saves; Riddhi tracks her own
        void n;
        const count = Object.keys(f.npcSpoken).filter((k) => k.startsWith(`riddhi_${where}_`)).length;
        const pick = count === 0 ? 1 : count === 1 ? 2 : count % 2 === 0 ? 3 : 2;
        store.markRecord("npcSpoken", `riddhi_${where}_${count}`);
        return D(`riddhi_${where}_${pick}`);
      }
      case "mimo_here": return D("mimo_bush");
      case "npc_prakriti": {
        const q = store.quests.find((qq) => qq.id === "prakriti");
        if (!q) return D("prakriti_meet");
        if (f.ribbonFound && !q.done) return D("prakriti_ribbon_return");
        return D("prakriti_wait");
      }
      case "npc_prakriti_duel": return D(f.miniboss3Done ? "prakriti_duel" : "prakriti_wait_guardian");
      case "npc_villager5": {
        store.markRecord("npcSpoken", `${def.id}_${kind}`);
        store.healParty();
        store.save();
        bus.emit("toast", { text: "The monk tends your wounds. Party restored.", tone: "good" });
        return D("monk_heal");
      }
      case "npc_villager1": case "npc_villager2": case "npc_villager3":
      case "npc_villager4": {
        store.markRecord("npcSpoken", `${def.id}_${kind}`);
        return D("villager");
      }
      case "npc_merchant": return D(f.villageSupplies ? "villager" : "merchant");
      case "npc_musician": return D(f.musicianMet ? "villager" : "musician");
      case "npc_elder": {
        if (!f.elderBriefed) return D("elder");
        if (f.scrollFound && !f.scrollDelivered) return D("elder_scroll");
        return D("elder_wait");
      }
      case "npc_monk": return D("monk");
      case "npc_miniboss1": return D("miniboss1");
      case "npc_miniboss2": return D("miniboss2");
      case "npc_miniboss3": return D("miniboss3");
      case "npc_guardian": {
        const needP = puzzlePlatesFor("temple");
        const lit = Object.keys(f.plates).filter((k) => k.startsWith("temple")).length;
        if (lit < needP) {
          questSfx.denied();
          return this.say("THE PLATES ARE NOT HELD. THE TEMPLE STAYS ASLEEP.");
        }
        return D("guardian");
      }
      case "npc_gatekeeper": {
        if (f.gateOpen) return this.say("Go on in. Mind the stairs.");
        if (!store.hasItem("fashion_pass")) return D("gatekeeper_locked");
        return D("gatekeeper_open");
      }
      case "npc_boss": return D("boss_meet");
      default:
        return;
    }
  }

  // ------------------------------------------------------------- puzzles

  checkPuzzle() {
    const store = useGameStore.getState();
    const id = this.fx.currentMap().id;
    const statues = Object.keys(store.flags.statues).filter((k) => k.startsWith(id)).length;
    const plates = Object.keys(store.flags.plates).filter((k) => k.startsWith(id)).length;
    bus.emit("puzzle", {
      mapId: id,
      statues, plates,
      needStatues: puzzleStatuesFor(id),
      needPlates: puzzlePlatesFor(id),
    });

    if (id === "bamboo" && statues >= 2 && plates >= 2 && !store.flags.trialStarted) {
      store.setFlag("trialStarted", true);
      gong();
      bus.emit("toast", { text: "The shrine stirs. The Sentinel is awake.", tone: "warn" });
    }
    if (id === "cave" && plates >= 2) {
      gong();
      bus.emit("toast", { text: "The echoes stop. The brazier is unsealed.", tone: "good" });
    }
    if (id === "temple" && statues >= 4 && plates >= 4 && !store.flags.templeOpened) {
      store.setFlag("templeOpened", true);
      gong();
      bus.emit("toast", { text: "Four plates held. The Guardian will see you now.", tone: "warn" });
    }
  }

  // -------------------------------------------------------------- battles

  handleBattleEnd(r: { enemyId: string; won: boolean; fled?: boolean }) {
    const store = useGameStore.getState();
    const def = this.fx.currentMap();
    if (r.fled) {
      playBgm(def.bgm, 1.0);
      return;
    }
    if (!r.won) {
      // Losing shouldn't end the adventure. You're patched up where you stand.
      store.healParty();
      store.save();
      playBgm(def.bgm, 1.0);
      bus.emit("toast", { text: "You were carried back and patched up. Try again.", tone: "warn" });
      this.fx.refresh();
      return;
    }
    playBgm(def.bgm, 1.0);
    const open = (k: string) => this.fx.delay(300, () => useGameStore.getState().openDialogue(k));
    switch (r.enemyId) {
      case "wild_mimo": return open("mimo_recognize");
      case "boss_sentinel": return open("miniboss1_done");
      case "boss_warden": return open("miniboss2_done");
      case "boss_blossom": return open("miniboss3_done");
      case "boss_guardian": return open("guardian_done");
      case "prakriti_boss": return open("prakriti_defeat");
      case "fashion_teacher": return open("boss_defeat");
      default: return;
    }
  }

  // ---------------------------------------------------- story branch table

  handleDialogueEnd(evt: string | null) {
    if (!evt) return;
    const store = useGameStore.getState();
    const fx = this.fx;
    const adv = (step: string) => {
      store.advanceQuest("main", step);
      questSfx.objective();
      bus.emit("objective:done");
    };

    if (handleFinalChapterDialogue(this, evt, adv)) {
      useGameStore.getState().save();
      return;
    }

    switch (evt) {
      case "intro_done":
        store.setFlag("introDone", true);
        break;

      case "give_super_potion":
        store.setFlag("metMom", true);
        store.addItem("super_potion");
        bus.emit("toast", { text: "Received Super Potion.", tone: "good" });
        adv("abhi");
        break;

      case "abhi_join":
        store.setFlag("metAbhimanyu", true);
        store.setFlag("abhimanyuJoined", true);
        store.addFighter(ABHIMANYU);
        bus.emit("toast", { text: "Abhimanyu joined you.", tone: "good" });
        adv("clue_npc");
        fx.refresh();
        break;

      case "clue_witness":
        store.setFlag("clueWitnessHeard", true);
        adv("clue_toy");
        break;

      case "clue_toy_found":
        store.setFlag("clueToyFound", true);
        adv("clue_paws");
        fx.refresh();
        break;

      case "clue_paws_found":
        store.setFlag("cluePawsSeen", true);
        adv("mimo");
        break;

      case "start_mimo_battle":
        fx.startBattle("wild_mimo", false);
        break;

      case "mimo_join":
        store.setFlag("mimoRecognized", true);
        store.removeFighter("abhimanyu");
        store.addFighter(DOG);
        store.healParty();
        playBgm("bgm_reunion", 1.0);
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Find Mimo" });
        adv("village");
        fx.delay(2600, () => {
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "Lantern Village" });
          playBgm(fx.currentMap().bgm, 1.4);
        });
        fx.refresh();
        break;

      case "prakriti_quest":
        store.setFlag("metPrakriti", true);
        store.addQuest(QUEST_PRAKRITI);
        store.advanceQuest("prakriti", "ribbon");
        bus.emit("toast", { text: "New side mission: Prakriti's Ribbon", tone: "info" });
        break;

      case "prakriti_reward":
        store.addItem("jade_charm");
        store.advanceQuest("prakriti");
        store.advanceQuest("prakriti");
        bus.emit("cinematic", { kind: "mission-complete", title: "SIDE MISSION COMPLETE", subtitle: "Prakriti's Ribbon" });
        break;

      case "village_talk":
        store.setFlag("villageTalks", store.flags.villageTalks + 1);
        break;

      case "riddhi_chat":
        // nothing to unlock; she is company, not a quest
        break;

      case "give_supplies":
        store.setFlag("villageSupplies", true);
        store.addItem("village_supplies");
        store.addItem("potion", 4);
        store.addItem("super_potion", 2);
        store.healParty();
        bus.emit("toast", { text: "Received supplies: 4 Potions and 2 Super Potions.", tone: "good" });
        break;

      case "guitar_learned":
        store.setFlag("musicianMet", true);
        store.setFlag("guitarPerformed", true);
        bus.emit("toast", { text: "Learned SOUND BARRIER.", tone: "good" });
        break;

      case "elder_brief":
        store.setFlag("elderBriefed", true);
        bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "The Bamboo Forest" });
        adv("scroll");
        break;

      case "barrier_broken":
        store.setFlag("barrierBroken", true);
        gong();
        fx.shake(320, 0.01);
        bus.emit("toast", { text: "The bamboo wall splits open.", tone: "good" });
        fx.refresh();
        break;

      case "scroll_taken":
        store.setFlag("scrollFound", true);
        store.addItem("lost_scroll");
        bus.emit("toast", { text: "Obtained the Lost Scroll.", tone: "good" });
        fx.refresh();
        break;

      case "scroll_given":
        store.setFlag("scrollDelivered", true);
        bus.emit("cinematic", { kind: "objective", title: "THE LOST SCROLL RETURNED", subtitle: "Now the shrine's trial: wake the statues, hold the plates" });
        adv("trial");
        break;

      case "start_miniboss1": fx.startBattle("boss_sentinel", true); break;
      case "miniboss1_end":
        store.healParty();
        store.setFlag("miniboss1Done", true);
        store.setFlag("trialDone", true);
        store.addItem("trial_talisman");
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "The Bamboo Forest" });
        adv("prakriti");
        fx.delay(2600, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "The Hidden Garden" })
        );
        this.leaveThenRefresh("npc_miniboss1");
        break;

      case "start_prakriti": fx.startBattle("prakriti_boss", true); break;
      case "prakriti_done":
        store.healParty();
        store.setFlag("prakritiDone", true);
        store.addItem("fashion_pass");
        bus.emit("toast", { text: "Received the Fashion Pass.", tone: "good" });
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "The Hidden Garden" });
        adv("temple");
        fx.delay(2600, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "The Mountain Path" })
        );
        this.leaveThenRefresh("npc_prakriti_duel");
        break;

      case "start_miniboss3": fx.startBattle("boss_blossom", true); break;
      case "miniboss3_end":
        store.healParty();
        store.setFlag("miniboss3Done", true);
        bus.emit("toast", { text: "The blossom shrine is quiet. Prakriti is waiting by the pond.", tone: "good" });
        this.leaveThenRefresh("npc_miniboss3");
        break;

      case "start_miniboss2": fx.startBattle("boss_warden", true); break;
      case "miniboss2_end":
        store.healParty();
        store.setFlag("miniboss2Done", true);
        bus.emit("toast", { text: "The Mountain Shrine is open.", tone: "good" });
        this.leaveThenRefresh("npc_miniboss2");
        break;

      case "start_guardian": fx.startBattle("boss_guardian", true); break;
      case "guardian_end":
        store.healParty();
        store.setFlag("guardianDone", true);
        store.setFlag("templeOpened", true);
        store.addItem("lore_book");
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "The Mountain Path" });
        adv("flames");
        fx.delay(2400, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "The Three Flames" })
        );
        this.leaveThenRefresh("npc_guardian");
        break;

      case "lantern_restored":
        store.setFlag("lanternRestored", true);
        store.buffFighter("palakshi", { atk: 14, def: 4, maxHp: 22 });
        store.buffFighter("mimo", { atk: 8, def: 5, maxHp: 16 });
        store.addItem("super_potion", 2);
        bus.emit("toast", { text: "The Sacred Lantern's light stays with you. Palakshi and Mimo grow stronger.", tone: "good" });
        gong();
        fx.flash(600, [242, 223, 166]);
        fx.cinematic?.("lantern-lit");
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "The Three Flames" });
        adv("pass");
        fx.delay(2400, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "NEW MISSION", subtitle: "Arshiya" })
        );
        fx.refresh();
        break;

      case "gate_open":
        store.setFlag("gateOpen", true);
        adv("boss");
        fx.refresh();
        break;

      case "start_boss": fx.startBattle("fashion_teacher", true); break;

      case "boss_end":
        store.setFlag("bossDefeated", true);
        store.advanceQuest("main", "finale");
        store.healParty();
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Arshiya" });
        fx.delay(2600, () => useGameStore.getState().openDialogue("finale"));
        this.leaveThenRefresh("npc_boss");
        break;

      case "credits":
        store.setFlag("credits", true);
        store.save();
        store.setScreen("credits");
        break;

      default:
        console.warn(`[story] unhandled dialogue:end "${evt}"`);
    }
    useGameStore.getState().save();
  }
}
