// ---------------------------------------------------------------------------
// Journal grouping. Turns the flat main-quest step list into named Missions
// with regions, cast, rewards and a derived category.
// ---------------------------------------------------------------------------

import type { GameState } from "../store/useGameStore";
import { guideFor, type Guide } from "./guidance";
import type { IconName } from "../components/pixel/MissionIcons";

export type RegionId = "home" | "village" | "bamboo" | "mountain" | "temple" | "garden" | "cave" | "academy" | "f1205";

export type Region = { id: RegionId; name: string; x: number; y: number; icon: IconName };

/** x/y are 0..1 coordinates on the Journey panel's world map. */
export const REGIONS: Region[] = [
  { id: "home",     name: "Home & Sparkle Town",   x: 0.16, y: 0.74, icon: "home" },
  { id: "village",  name: "Lantern Village",       x: 0.33, y: 0.52, icon: "lantern" },
  { id: "bamboo",   name: "Bamboo Forest",         x: 0.48, y: 0.66, icon: "bamboo" },
  { id: "garden",   name: "Cherry Blossom Garden", x: 0.60, y: 0.42, icon: "blossom" },
  { id: "mountain", name: "Mountain Trail",        x: 0.72, y: 0.26, icon: "mountain" },
  { id: "temple",   name: "Temple of Echoes",      x: 0.86, y: 0.18, icon: "temple" },
  { id: "cave",     name: "Ancient Cave",          x: 0.78, y: 0.58, icon: "cave" },
  { id: "academy",  name: "Style Academy",         x: 0.88, y: 0.80, icon: "boss" },
  { id: "f1205",    name: "F-1205",                x: 0.08, y: 0.36, icon: "guitar" },
];

export type Reward = { kind: "ability" | "region" | "item" | "lore"; label: string };

export type MissionDef = {
  id: string;
  title: string;
  blurb: string;
  region: RegionId;
  icon: IconName;
  steps: string[];
  cast: string[];
  rewards: Reward[];
  finale?: boolean;
  boss?: boolean;
  /** Chapter number shown as a small tag (the final chapter is numbered 26–28). */
  code?: string;
};

export const MAIN_MISSIONS: MissionDef[] = [
  {
    id: "m_mimo", title: "Find Mimo", region: "home", icon: "paw",
    blurb: "Mimo slipped the gate before sunrise. Follow her trail across town, the road and the woods — and bring her home.",
    steps: ["wake", "mom", "abhi", "clue_npc", "clue_toy", "clue_paws", "mimo"],
    cast: ["palakshi", "bidisha", "abhimanyu", "mimo"],
    rewards: [
      { kind: "ability", label: "Mimo joins your party" },
      { kind: "item", label: "Super Potion" },
      { kind: "region", label: "Lantern Village opens" },
    ],
  },
  {
    id: "m_village", title: "Lantern Village", region: "village", icon: "lantern",
    blurb: "The Lantern Festival is cancelled for the first time in fifty years. The village knows why, and Elder Shu will say it plainly.",
    steps: ["village"],
    cast: ["palakshi", "mimo", "elder"],
    rewards: [
      { kind: "ability", label: "Sound Barrier" },
      { kind: "item", label: "Village Supplies" },
      { kind: "lore", label: "Who took the flame" },
    ],
  },
  {
    id: "m_scroll", title: "The Lost Scroll", region: "bamboo", icon: "scroll",
    blurb: "A teaching was carried into the bamboo and left behind a wall no hand can move. Sound can.",
    steps: ["scroll"],
    cast: ["palakshi", "mimo", "elder"],
    rewards: [
      { kind: "item", label: "Lost Scroll" },
      { kind: "lore", label: "The rite of three flames" },
    ],
  },
  {
    id: "m_trial", title: "Bamboo Forest Trial", region: "bamboo", icon: "bamboo",
    blurb: "The shrine tests footing before it tests strength. Wake the statues, hold the plates, then face what guards them.",
    steps: ["trial"],
    cast: ["palakshi", "mimo"],
    rewards: [
      { kind: "item", label: "Trial Talisman" },
      { kind: "region", label: "Cherry Blossom Garden opens" },
    ],
    boss: true,
  },
  {
    id: "m_prakriti", title: "Rival: Prakriti", region: "garden", icon: "sword",
    blurb: "You trained beside her. She has the pass you need, and no intention of being generous about it.",
    steps: ["prakriti"],
    cast: ["palakshi", "mimo", "prakriti"],
    rewards: [
      { kind: "item", label: "Fashion Pass" },
      { kind: "item", label: "Flame of Petals" },
    ],
    boss: true,
  },
  {
    id: "m_temple", title: "Temple of Echoes", region: "temple", icon: "temple",
    blurb: "Above the Mountain Trail the temple sleeps behind four plates and a Guardian with a long memory.",
    steps: ["temple"],
    cast: ["palakshi", "mimo"],
    rewards: [
      { kind: "region", label: "Ancient Cave opens" },
      { kind: "lore", label: "The Book of Echoes" },
    ],
    boss: true,
  },
  {
    id: "m_flames", title: "Restore the Sacred Lantern", region: "mountain", icon: "flame",
    blurb: "Stone, petals, echoes. Three flames, gathered and returned to the lantern they were split from.",
    steps: ["flames", "lantern"],
    cast: ["palakshi", "mimo", "elder"],
    rewards: [
      { kind: "item", label: "Sacred Lantern relit" },
      { kind: "region", label: "Style Academy opens" },
    ],
  },
  {
    id: "m_final", title: "Defeat Arshiya", region: "academy", icon: "boss",
    blurb: "The teacher who took a village's light for her own stage. She fights in three phases, and no single fighter outlasts her.",
    steps: ["pass", "boss"],
    cast: ["palakshi", "mimo", "arshiya"],
    rewards: [
      { kind: "lore", label: "The flame comes home" },
      { kind: "item", label: "Happy birthday, Palakshi" },
    ],
    boss: true,
  },
  {
    id: "m_find", title: "Find Abhimanyu & Faizal", region: "f1205", icon: "guitar", code: "26",
    blurb: "The flame is home and the village is lit. Abhimanyu slipped away before the lanterns went up — back to his place, F-1205, where the others are waiting.",
    steps: ["finale", "find_abhi"],
    cast: ["palakshi", "mimo", "abhimanyu", "faizal"],
    rewards: [{ kind: "region", label: "The West Road opens" }],
  },
  {
    id: "m_f1205", title: "F-1205", region: "f1205", icon: "home", code: "27",
    blurb: "Abhimanyu's flat. Five flatmates, one sofa, a guitar on a stand and an iPad that never gets put down.",
    steps: ["f1205"],
    cast: ["palakshi", "abhimanyu", "faizal", "garv", "hakim", "dev"],
    rewards: [{ kind: "lore", label: "The F-1205 flatmates" }],
  },
  {
    id: "m_evening", title: "One Last Evening", region: "f1205", icon: "lantern", code: "28",
    blurb: "A quiet evening after a long day. The adventure, Arshiya, Mimo, and what comes next — and then one goodbye, for now.",
    steps: ["evening", "goodbye"],
    cast: ["palakshi", "abhimanyu", "mimo"],
    rewards: [{ kind: "lore", label: "Goodbye, for now" }],
    finale: true,
  },
];

export type MissionCategory = "completed" | "main" | "discovered" | "side";

export type Mission = MissionDef & {
  category: MissionCategory;
  objectives: { stepId: string; label: string; done: boolean; active: boolean }[];
  guide: Guide | null;
  progress: number;
};

const MAIN_STEP_ORDER = MAIN_MISSIONS.flatMap((m) => m.steps);

export function buildMissions(state: GameState): Mission[] {
  const main = state.quests.find((q) => q.id === "main")!;
  const currentIdx = Math.min(main.step, main.steps.length - 1);
  const currentStep = main.steps[currentIdx].id;
  const reached = (stepId: string) => MAIN_STEP_ORDER.indexOf(stepId) < MAIN_STEP_ORDER.indexOf(currentStep);
  const label = (stepId: string) => main.steps.find((s) => s.id === stepId)?.label ?? stepId;

  const list: Mission[] = MAIN_MISSIONS.map((def) => {
    const objectives = def.steps.map((sid) => ({
      stepId: sid,
      label: label(sid),
      done: main.done || reached(sid),
      active: !main.done && sid === currentStep,
    }));
    const started = objectives.some((o) => o.active || o.done);
    const allDone = objectives.every((o) => o.done);
    const category: MissionCategory = allDone ? "completed" : started ? "main" : "discovered";
    const done = objectives.filter((o) => o.done).length;
    return {
      ...def,
      category,
      objectives,
      guide: guideFor(objectives.find((o) => o.active)?.stepId ?? def.steps[0]),
      progress: done / objectives.length,
    };
  });

  // Side quests
  for (const q of state.quests) {
    if (q.id === "main") continue;
    const idx = Math.min(q.step, q.steps.length - 1);
    const objectives = q.steps.map((s, i) => ({
      stepId: s.id,
      label: s.label,
      done: q.done || i < q.step,
      active: !q.done && i === idx,
    }));
    list.push({
      id: `side_${q.id}`,
      title: q.name,
      blurb:
        q.id === "prakriti"
          ? "Prakriti lost a teal ribbon in the Whispering Woods. She'd rather die than ask nicely, so she didn't."
          : "Four small things worth finding, tucked into corners across the world.",
      region: q.id === "prakriti" ? "home" : "home",
      icon: q.id === "prakriti" ? "star" : "seal",
      steps: q.steps.map((s) => s.id),
      cast: q.id === "prakriti" ? ["palakshi", "prakriti"] : ["palakshi"],
      rewards: q.id === "prakriti" ? [{ kind: "item", label: "Jade Charm" }] : [{ kind: "item", label: "Assorted treasures" }],
      category: q.done ? "completed" : "side",
      objectives,
      guide: guideFor(objectives.find((o) => o.active)?.stepId ?? q.steps[0].id),
      progress: objectives.filter((o) => o.done).length / objectives.length,
    });
  }

  return list;
}

/** The single mission the tracker should show. */
export function activeMission(state: GameState): Mission | null {
  const list = buildMissions(state);
  return list.find((m) => m.category === "main") ?? list.find((m) => m.category === "discovered") ?? null;
}

export function currentObjective(state: GameState): { mission: Mission; stepId: string; label: string } | null {
  const m = activeMission(state);
  if (!m) return null;
  const o = m.objectives.find((x) => x.active) ?? m.objectives[m.objectives.length - 1];
  return { mission: m, stepId: o.stepId, label: o.label };
}

export function missionGuide(state: GameState): Guide | null {
  const cur = currentObjective(state);
  return cur ? guideFor(cur.stepId) : null;
}

export function regionById(id: RegionId) {
  return REGIONS.find((r) => r.id === id)!;
}
