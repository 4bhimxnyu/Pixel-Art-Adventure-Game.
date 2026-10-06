// ---------------------------------------------------------------------------
// Final chapter — F-1205. Missions 26 (Find Abhimanyu & Faizal), 27 (F-1205)
// and 28 (One Last Evening), ending with the hug, THE END, and nothing after.
//
// Kept separate from the main branch table so the original story file stays
// readable; StoryController calls into here first and falls through when the
// event or interaction isn't ours.
// ---------------------------------------------------------------------------

import type { StoryController } from "./story";
import { bus } from "./bus";
import { useGameStore } from "../store/useGameStore";
import { playBgm, gong } from "./sound";
import { questSfx } from "../lib/questSfx";

export const FINAL_CHAPTER_PROMPTS: Record<string, string> = {
  sofa: "Sit for a moment",
  guitar_stand: "Look at the guitar",
  poster: "Look",
  window: "Look outside",
  counter: "Look",
  fridge: "Open the fridge",
  weights: "Try the weights",
  table: "Look",
  npc_abhimanyu_home: "Talk to Abhimanyu",
};

const FLATMATES = ["metFaizal", "metGarv", "metHakim", "metDev"] as const;

function allMet() {
  const f = useGameStore.getState().flags;
  return FLATMATES.every((k) => f[k]);
}

/** Returns true when the interaction was ours. */
export function handleFinalChapterInteract(story: StoryController, kind: string): boolean {
  const store = useGameStore.getState();
  const f = store.flags;
  const D = (k: string) => store.openDialogue(k);
  const npc = (who: "faizal" | "garv" | "hakim" | "dev", flag: (typeof FLATMATES)[number]) => {
    if (!f[flag]) return D(`${who}_meet`);
    if (f.eveningDone) return D(`${who}_late`);
    return D(`${who}_again`);
  };

  switch (kind) {
    case "sign": {
      if (story.fx.currentMap().id !== "road") return false;
      D("road_sign");
      return true;
    }
    case "npc_faizal": npc("faizal", "metFaizal"); return true;
    case "npc_garv": npc("garv", "metGarv"); return true;
    case "npc_hakim": npc("hakim", "metHakim"); return true;
    case "npc_dev": npc("dev", "metDev"); return true;
    case "npc_abhimanyu_home": {
      if (!f.f1205Arrived) D("f1205_arrive");
      else if (f.eveningDone) D("f1205_goodbye");
      else if (allMet()) D("abhi_home_evening");
      else D("abhi_home_wait");
      return true;
    }
    case "sofa": story.say(f.eveningDone ? "Still warm. Everyone was here a minute ago." : "A sofa that has clearly lost every argument it has ever had."); return true;
    case "guitar_stand": story.say("The white guitar, back on its stand. A new string, and a set list on the floor with one song circled."); return true;
    case "poster": story.say("A concert poster, a gym timetable, and a to-do list in four different handwritings."); return true;
    case "window": story.say(f.eveningDone ? "The valley, far off. One gold light where the lantern is." : "The river, the bridge, and the long road I just walked."); return true;
    case "counter": story.say("Rice on the stove. Faizal's doing, obviously."); return true;
    case "fridge": story.say("Three kinds of protein, one lonely vegetable, and a note: DEV — STOP LABELLING THINGS."); return true;
    case "weights": story.say("Heavier than they look. Dev is not looking, which is somehow worse."); return true;
    case "table": story.say("Garv's spot. A newspaper, folded exactly once."); return true;
    default:
      return false;
  }
}

/** Returns true when the dialogue:end event was ours. */
export function handleFinalChapterDialogue(
  story: StoryController,
  evt: string,
  adv: (step: string) => void
): boolean {
  const store = useGameStore.getState();
  const fx = story.fx;

  switch (evt) {
    case "after_finale":
      store.setFlag("finaleDone", true);
      bus.emit("cinematic", { kind: "mission-start", title: "MISSION 26", subtitle: "Find Abhimanyu & Faizal" });
      adv("find_abhi");
      fx.refresh();
      return true;

    case "f1205_arrived":
      store.setFlag("f1205Arrived", true);
      bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "Find Abhimanyu & Faizal" });
      adv("f1205");
      fx.delay(2600, () =>
        bus.emit("cinematic", { kind: "mission-start", title: "MISSION 27", subtitle: "F-1205" })
      );
      return true;

    case "met_faizal":
    case "met_garv":
    case "met_hakim":
    case "met_dev": {
      const flag = evt === "met_faizal" ? "metFaizal" : evt === "met_garv" ? "metGarv" : evt === "met_hakim" ? "metHakim" : "metDev";
      store.setFlag(flag, true);
      questSfx.objective();
      const n = FLATMATES.filter((k) => useGameStore.getState().flags[k]).length;
      bus.emit("toast", { text: `Met ${n}/4 flatmates.`, tone: "info" });
      if (allMet()) {
        bus.emit("cinematic", { kind: "mission-complete", title: "MISSION COMPLETE", subtitle: "F-1205" });
        adv("evening");
        fx.delay(2600, () =>
          bus.emit("cinematic", { kind: "mission-start", title: "MISSION 28", subtitle: "One Last Evening" })
        );
      }
      return true;
    }

    case "evening_start":
      fx.cinematic?.("evening-gather");
      fx.delay(900, () => useGameStore.getState().openDialogue("f1205_evening"));
      return true;

    case "evening_done":
      store.setFlag("eveningDone", true);
      playBgm("bgm_goodbye", 2.0);
      adv("goodbye");
      bus.emit("toast", { text: "The evening winds down. Abhimanyu is by the door.", tone: "info" });
      fx.refresh();
      return true;

    case "final_hug": {
      store.setFlag("hugDone", true);
      store.advanceQuest("main"); // past the last step — the story is complete
      store.save();
      gong();
      const finish = () => {
        const s = useGameStore.getState();
        s.setFlag("credits", true);
        s.save();
        s.setScreen("end");
      };
      if (fx.cinematic) fx.cinematic("final-hug", { onDone: finish });
      else fx.delay(2200, finish);
      return true;
    }

    default:
      return false;
  }
}
