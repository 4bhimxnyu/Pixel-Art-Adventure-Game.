import { create } from "zustand";
import {
  PALAKSHI, DOG, ABHIMANYU, ITEMS, QUEST_MAIN, QUEST_PRAKRITI, QUEST_HIDDEN, DIALOGUES,
  type Fighter, type ItemId, type Quest, type DialogueLine,
} from "../data/content";
import type { MapId } from "../game/maps";
import { bus } from "../game/bus";

export const SAVE_KEY = "palakshi_save_v1";

export type Overlay =
  | null
  | { kind: "dialogue"; lines: DialogueLine[]; idx: number }
  | { kind: "inventory" }
  | { kind: "quests" }
  | { kind: "settings" }
  | { kind: "menu" }
  | { kind: "battle"; enemyId: string; boss?: boolean };

export type Dir = "up" | "down" | "left" | "right";

export type Flags = {
  introDone: boolean;
  metMom: boolean;
  metAbhimanyu: boolean;
  abhimanyuJoined: boolean;
  metPrakriti: boolean;
  ribbonFound: boolean;
  clueToyFound: boolean;
  clueWitnessHeard: boolean;
  cluePawsSeen: boolean;
  mimoRecognized: boolean;
  prakritiDone: boolean;
  bossDefeated: boolean;
  credits: boolean;
  seenVillage: boolean;
  seenBamboo: boolean;
  seenMountain: boolean;
  seenTemple: boolean;
  seenGarden: boolean;
  seenCave: boolean;
  villageTalks: number;
  villageSupplies: boolean;
  musicianMet: boolean;
  guitarPerformed: boolean;
  elderBriefed: boolean;
  barrierBroken: boolean;
  scrollFound: boolean;
  scrollDelivered: boolean;
  trialStarted: boolean;
  trialDone: boolean;
  miniboss1Done: boolean;
  miniboss2Done: boolean;
  templeOpened: boolean;
  guardianDone: boolean;
  gateOpen: boolean;
  flameMountain: boolean;
  flameGarden: boolean;
  flameCave: boolean;
  lanternRestored: boolean;
  plates: Record<string, boolean>;
  statues: Record<string, boolean>;
  digs: Record<string, boolean>;
  chests: Record<string, boolean>;
  lore: Record<string, boolean>;
  hidden: Record<string, boolean>;
  npcSpoken: Record<string, boolean>;
  tutorialSeen: Record<string, boolean>;
};

export const INITIAL_FLAGS: Flags = {
  introDone: false, metMom: false, metAbhimanyu: false, abhimanyuJoined: false,
  metPrakriti: false, ribbonFound: false, clueToyFound: false, clueWitnessHeard: false,
  cluePawsSeen: false, mimoRecognized: false, prakritiDone: false, bossDefeated: false,
  credits: false, seenVillage: false, seenBamboo: false, seenMountain: false,
  seenTemple: false, seenGarden: false, seenCave: false, villageTalks: 0,
  villageSupplies: false, musicianMet: false, guitarPerformed: false, elderBriefed: false,
  barrierBroken: false, scrollFound: false, scrollDelivered: false, trialStarted: false,
  trialDone: false, miniboss1Done: false, miniboss2Done: false, templeOpened: false,
  guardianDone: false, gateOpen: false, flameMountain: false, flameGarden: false,
  flameCave: false, lanternRestored: false,
  plates: {}, statues: {}, digs: {}, chests: {}, lore: {}, hidden: {}, npcSpoken: {},
  tutorialSeen: {},
};

export type Settings = { musicVol: number; sfxVol: number; textSpeed: number };

export type InvEntry = { id: ItemId; count: number };

type SavePayload = {
  map: MapId; playerX: number; playerY: number; playerDir: Dir;
  party: Fighter[]; inventory: InvEntry[]; quests: Quest[]; flags: Flags;
  settings: Settings; ts: number;
};

export type GameState = {
  screen: "title" | "playing" | "credits";
  overlay: Overlay;
  map: MapId;
  playerX: number;
  playerY: number;
  playerDir: Dir;
  party: Fighter[];
  inventory: InvEntry[];
  quests: Quest[];
  flags: Flags;
  settings: Settings;
  hasSave: boolean;
  lastAutosave: number;

  setScreen: (s: GameState["screen"]) => void;
  setOverlay: (o: Overlay) => void;
  openDialogue: (key: string) => void;
  openLines: (lines: DialogueLine[]) => void;
  advanceDialogue: () => void;
  setPlayer: (x: number, y: number, dir?: Dir) => void;
  setMap: (m: MapId, x: number, y: number, dir?: Dir) => void;
  addItem: (id: ItemId, count?: number) => void;
  removeItem: (id: ItemId, count?: number) => void;
  useItem: (id: ItemId, fighterIdx: number) => boolean;
  hasItem: (id: ItemId) => boolean;
  setFlag: <K extends keyof Flags>(k: K, v: Flags[K]) => void;
  markRecord: (rec: "plates" | "statues" | "digs" | "chests" | "lore" | "hidden" | "npcSpoken" | "tutorialSeen", key: string) => void;
  hasRecord: (rec: "plates" | "statues" | "digs" | "chests" | "lore" | "hidden" | "npcSpoken" | "tutorialSeen", key: string) => boolean;
  advanceQuest: (id: Quest["id"], toStepId?: string) => void;
  addQuest: (q: Quest) => void;
  addFighter: (f: Fighter) => void;
  removeFighter: (id: string) => void;
  damage: (idx: number, amount: number) => number;
  heal: (idx: number, amount: number) => void;
  healParty: () => void;
  setSettings: (s: Partial<Settings>) => void;
  save: () => void;
  load: () => boolean;
  reset: () => void;
  newGame: () => void;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function detectSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function freshState() {
  return {
    map: "bedroom" as MapId,
    playerX: 4,
    playerY: 4,
    playerDir: "down" as Dir,
    party: [clone(PALAKSHI)],
    inventory: [{ id: "potion" as ItemId, count: 2 }],
    quests: [clone(QUEST_MAIN)],
    flags: clone(INITIAL_FLAGS),
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: "title",
  overlay: null,
  ...freshState(),
  settings: { musicVol: 0.7, sfxVol: 0.8, textSpeed: 26 },
  hasSave: detectSave(),
  lastAutosave: 0,

  setScreen: (s) => set({ screen: s }),
  setOverlay: (o) => set({ overlay: o }),

  openDialogue: (key) => {
    const lines = DIALOGUES[key];
    if (!lines) {
      console.warn(`[store] missing dialogue "${key}"`);
      return;
    }
    set({ overlay: { kind: "dialogue", lines: clone(lines), idx: 0 } });
  },

  openLines: (lines) => set({ overlay: { kind: "dialogue", lines: clone(lines), idx: 0 } }),

  /**
   * On the LAST line this closes the box and emits `dialogue:end` with that
   * line's `onEnd` string. All story branching hangs off that event in
   * WorldScene.handleDialogueEnd — this decoupling fixes an old race condition
   * between the React overlay closing and Phaser reacting. Do not inline the
   * branching back into here.
   */
  advanceDialogue: () => {
    const ov = get().overlay;
    if (!ov || ov.kind !== "dialogue") return;
    if (ov.idx < ov.lines.length - 1) {
      set({ overlay: { ...ov, idx: ov.idx + 1 } });
      return;
    }
    const onEnd = ov.lines[ov.lines.length - 1].onEnd;
    set({ overlay: null });
    bus.emit("dialogue:end", onEnd ?? null);
  },

  setPlayer: (x, y, dir) => set((s) => ({ playerX: x, playerY: y, playerDir: dir ?? s.playerDir })),

  setMap: (m, x, y, dir) => {
    set((s) => ({ map: m, playerX: x, playerY: y, playerDir: dir ?? s.playerDir }));
    get().save();
  },

  addItem: (id, count = 1) =>
    set((s) => {
      const inv = [...s.inventory];
      const e = inv.find((i) => i.id === id);
      if (e) e.count += count;
      else inv.push({ id, count });
      return { inventory: inv };
    }),

  removeItem: (id, count = 1) =>
    set((s) => {
      const inv = s.inventory
        .map((i) => (i.id === id ? { ...i, count: i.count - count } : i))
        .filter((i) => i.count > 0);
      return { inventory: inv };
    }),

  hasItem: (id) => get().inventory.some((i) => i.id === id && i.count > 0),

  useItem: (id, fighterIdx) => {
    const def = ITEMS[id];
    if (!def?.heal) return false;
    const f = get().party[fighterIdx];
    if (!f || f.hp >= f.maxHp) return false;
    get().heal(fighterIdx, def.heal);
    get().removeItem(id, 1);
    return true;
  },

  setFlag: (k, v) => set((s) => ({ flags: { ...s.flags, [k]: v } })),

  markRecord: (rec, key) =>
    set((s) => ({ flags: { ...s.flags, [rec]: { ...s.flags[rec], [key]: true } } })),

  hasRecord: (rec, key) => !!get().flags[rec][key],

  advanceQuest: (id, toStepId) =>
    set((s) => {
      const quests = s.quests.map((q) => {
        if (q.id !== id) return q;
        let step = q.step;
        if (toStepId) {
          const i = q.steps.findIndex((st) => st.id === toStepId);
          // Never move a quest backwards — replayed dialogue must be idempotent.
          step = i >= 0 ? Math.max(step, i) : step;
        } else {
          step = q.step + 1;
        }
        const done = step >= q.steps.length;
        return { ...q, step: Math.min(step, q.steps.length), done };
      });
      return { quests };
    }),

  addQuest: (q) =>
    set((s) => (s.quests.some((x) => x.id === q.id) ? s : { quests: [...s.quests, clone(q)] })),

  addFighter: (f) =>
    set((s) => (s.party.some((p) => p.id === f.id) ? s : { party: [...s.party, clone(f)] })),

  removeFighter: (id) => set((s) => ({ party: s.party.filter((p) => p.id !== id) })),

  /** Palakshi takes 40% reduced damage — resilient, not invincible. */
  damage: (idx, amount) => {
    const s = get();
    const f = s.party[idx];
    if (!f) return 0;
    const dealt = Math.max(1, Math.round(f.id === "palakshi" ? amount * 0.6 : amount));
    const party = s.party.map((p, i) => (i === idx ? { ...p, hp: Math.max(0, p.hp - dealt) } : p));
    set({ party });
    return dealt;
  },

  heal: (idx, amount) =>
    set((s) => ({
      party: s.party.map((p, i) => (i === idx ? { ...p, hp: Math.min(p.maxHp, p.hp + amount) } : p)),
    })),

  healParty: () => set((s) => ({ party: s.party.map((p) => ({ ...p, hp: p.maxHp })) })),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  save: () => {
    const s = get();
    const payload: SavePayload = {
      map: s.map, playerX: s.playerX, playerY: s.playerY, playerDir: s.playerDir,
      party: s.party, inventory: s.inventory, quests: s.quests, flags: s.flags,
      settings: s.settings, ts: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      set({ hasSave: true, lastAutosave: payload.ts });
    } catch (err) {
      console.warn("[store] save failed", err);
    }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const p = JSON.parse(raw) as SavePayload;
      set({
        map: p.map, playerX: p.playerX, playerY: p.playerY, playerDir: p.playerDir,
        party: p.party, inventory: p.inventory, quests: p.quests,
        // Merge over INITIAL_FLAGS so saves from an older build keep loading.
        flags: { ...clone(INITIAL_FLAGS), ...p.flags },
        settings: { ...get().settings, ...p.settings },
        screen: "playing", overlay: null, hasSave: true,
      });
      return true;
    } catch (err) {
      console.warn("[store] load failed", err);
      return false;
    }
  },

  reset: () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
    set({ ...freshState(), screen: "title", overlay: null, hasSave: false });
  },

  newGame: () => {
    set({ ...freshState(), screen: "playing", overlay: null });
    get().save();
  },
}));

// --------------------------------------------------------------------------- selectors

export const mainQuest = (s: GameState) => s.quests.find((q) => q.id === "main")!;
export const currentStepId = (s: GameState) => {
  const q = mainQuest(s);
  return q.steps[Math.min(q.step, q.steps.length - 1)].id;
};
export const flameCount = (s: GameState) =>
  [s.flags.flameMountain, s.flags.flameGarden, s.flags.flameCave].filter(Boolean).length;
