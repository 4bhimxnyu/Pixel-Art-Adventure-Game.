// ---------------------------------------------------------------------------
// Where the objective is, as a tile on the CURRENT map: the thing itself when
// it is here, otherwise the exit that leads towards it. Shared by the minimap
// (gold dot) and the tracker's compass line ("14 tiles north-east").
// ---------------------------------------------------------------------------

import { MAPS, type MapId } from "../game/maps";
import { currentStepId, type GameState } from "../store/useGameStore";
import { targetFor, routeBetween } from "../lib/targets";
import { MAP_PLACE } from "../lib/guidance";
import { gridPath, type Cell } from "../lib/gridPath";
import { cellBlocked } from "../game/story";

export type ObjectivePoint = {
  x: number;
  y: number;
  /** True when the point is the objective itself, false when it is the exit towards it. */
  direct: boolean;
  /** The map the objective is actually on. */
  map: MapId;
};

const DIRS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

/** Chars that a `kind` target maps to on this map (entity markers). */
function findKind(map: MapId, kind: string): { x: number; y: number } | null {
  const def = MAPS[map];
  const chars = Object.entries(def.interacts).filter(([, d]) => d.kind === kind).map(([c]) => c);
  if (!chars.length) return null;
  for (let y = 0; y < def.rows.length; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length; x++) if (chars.includes(row[x])) return { x, y };
  }
  return null;
}

/** Nearest tile of a char to the player. */
function findTile(map: MapId, ch: string, px: number, py: number): { x: number; y: number } | null {
  const def = MAPS[map];
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (let y = 0; y < def.rows.length; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ch) continue;
      const d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = { x, y }; }
    }
  }
  return best;
}

export function objectivePoint(s: GameState): ObjectivePoint | null {
  let target;
  try {
    target = targetFor(currentStepId(s), s);
  } catch {
    return null;
  }
  if (!target) return null;
  if (target.map === s.map) {
    const p = "kind" in target ? findKind(s.map, target.kind) : findTile(s.map, target.tile, s.playerX, s.playerY);
    return p ? { ...p, direct: true, map: target.map } : null;
  }
  const route = routeBetween(s.map, target.map);
  const next = route[1];
  if (!next) return null;
  const portal = MAPS[s.map].portals.find((p) => p.to === next);
  return portal ? { x: portal.x, y: portal.y, direct: false, map: target.map } : null;
}

/** The walking route from the player to the objective point, as cells; null when there is none. */
export function objectivePath(s: GameState): Cell[] | null {
  const p = objectivePoint(s);
  if (!p) return null;
  const def = MAPS[s.map];
  const W = def.rows[0].length;
  const H = def.rows.length;
  return gridPath(W, H, (x, y) => cellBlocked(def, x, y, s.flags), { x: s.playerX, y: s.playerY }, { x: p.x, y: p.y });
}

/** "14 tiles north-east" / "Here" / "Through the east exit to Lantern Village". */
export function compassLine(s: GameState): string | null {
  const p = objectivePoint(s);
  if (!p) return null;
  const dx = p.x - s.playerX;
  const dy = p.y - s.playerY;
  const dist = Math.round(Math.hypot(dx, dy));
  if (dist <= 1) return p.direct ? "Right here" : `This exit, towards ${MAP_PLACE[p.map]}`;
  // rows grow southward; screen north is -y
  const ang = Math.atan2(dx, -dy); // 0 = north, clockwise
  const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const dir = DIRS[idx];
  return p.direct ? `${dist} tiles ${dir}` : `${dist} tiles ${dir} to the exit`;
}
