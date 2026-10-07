// ---------------------------------------------------------------------------
// Where the current objective physically IS. The world turns this into a
// beacon over the thing to reach and, when it is on another map, over the
// exit that leads there. Keyed by main-quest step id (and side steps).
// ---------------------------------------------------------------------------

import { MAPS, type MapId } from "../game/maps";
import type { GameState } from "../store/useGameStore";

export type Target =
  | { map: MapId; kind: string }          // an entity (NPC / interactable marker)
  | { map: MapId; tile: string }          // the nearest not-yet-done tile of this char
  | null;

type Resolver = (s: GameState) => Target;

const FLATMATES: [keyof GameState["flags"], string][] = [
  ["metFaizal", "npc_faizal"], ["metGarv", "npc_garv"], ["metHakim", "npc_hakim"], ["metDev", "npc_dev"],
];

export const STEP_TARGET: Record<string, Resolver> = {
  wake: () => ({ map: "bedroom", tile: "d" }),
  mom: () => ({ map: "house", kind: "npc_mom" }),
  abhi: () => ({ map: "town", kind: "npc_abhimanyu" }),
  clue_npc: () => ({ map: "town", kind: "npc_witness" }),
  clue_toy: () => ({ map: "route1", tile: "y" }),
  clue_paws: () => ({ map: "route1", tile: "p" }),
  mimo: () => ({ map: "forest", kind: "mimo_here" }),
  village: () => ({ map: "village", kind: "npc_elder" }),
  scroll: (s) => {
    if (!s.flags.musicianMet) return { map: "village", kind: "npc_musician" };
    if (!s.flags.barrierBroken) return { map: "bamboo", tile: "=" };
    return { map: "bamboo", tile: "$" };
  },
  trial: (s) => {
    if (!s.flags.trialStarted) {
      const statues = Object.keys(s.flags.statues).filter((k) => k.startsWith("bamboo")).length;
      return statues < 2 ? { map: "bamboo", tile: "u" } : { map: "bamboo", tile: "z" };
    }
    return { map: "bamboo", kind: "npc_miniboss1" };
  },
  prakriti: () => ({ map: "garden", kind: "npc_prakriti_duel" }),
  temple: (s) => {
    if (s.map === "mountain" && !s.flags.miniboss2Done) return { map: "mountain", kind: "npc_miniboss2" };
    if (!s.flags.templeOpened) {
      const statues = Object.keys(s.flags.statues).filter((k) => k.startsWith("temple")).length;
      return statues < 4 ? { map: "temple", tile: "u" } : { map: "temple", tile: "z" };
    }
    return { map: "temple", kind: "npc_guardian" };
  },
  flames: (s) => {
    const f = s.flags;
    // nearest-first: the one on the current map, else garden → mountain → cave
    const order: MapId[] = ["garden", "mountain", "cave"];
    const has: Record<string, boolean> = { garden: f.flameGarden, mountain: f.flameMountain, cave: f.flameCave };
    const cur = order.includes(s.map) && !has[s.map] ? s.map : order.find((m) => !has[m]);
    if (!cur) return null;
    if (cur === "mountain" && !f.miniboss2Done) return { map: "mountain", kind: "npc_miniboss2" };
    return { map: cur, tile: "!" };
  },
  lantern: () => ({ map: "temple", tile: "&" }),
  pass: () => ({ map: "academy", kind: "npc_gatekeeper" }),
  boss: () => ({ map: "academy", kind: "npc_boss" }),
  finale: () => null,
  find_abhi: () => ({ map: "f1205", kind: "npc_abhimanyu_home" }),
  f1205: (s) => {
    const next = FLATMATES.find(([flag]) => !s.flags[flag]);
    return next ? { map: "f1205", kind: next[1] } : { map: "f1205", kind: "npc_abhimanyu_home" };
  },
  evening: () => ({ map: "f1205", kind: "npc_abhimanyu_home" }),
  goodbye: () => ({ map: "f1205", kind: "npc_abhimanyu_home" }),
};

export function targetFor(stepId: string, s: GameState): Target {
  return STEP_TARGET[stepId]?.(s) ?? null;
}

/** Shortest route between maps over the portal graph; returns the map sequence (from..to). */
export function routeBetween(from: MapId, to: MapId): MapId[] {
  if (from === to) return [from];
  const prev = new Map<MapId, MapId>();
  const seen = new Set<MapId>([from]);
  const queue: MapId[] = [from];
  while (queue.length) {
    const m = queue.shift()!;
    for (const p of MAPS[m].portals) {
      if (seen.has(p.to)) continue;
      seen.add(p.to);
      prev.set(p.to, m);
      if (p.to === to) {
        const path: MapId[] = [to];
        let cur: MapId = to;
        while (prev.has(cur)) {
          cur = prev.get(cur)!;
          path.unshift(cur);
        }
        return path;
      }
      queue.push(p.to);
    }
  }
  return [from];
}
