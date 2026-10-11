// ---------------------------------------------------------------------------
// Shortest walking route over a map grid (4-neighbour breadth-first search).
// Shared by the world's ground trail and the minimap's route line, so both
// always agree. The goal cell is allowed even when it is blocked (an NPC
// stands on it); the start cell is the player's own.
// ---------------------------------------------------------------------------

export type Cell = { x: number; y: number };

export function gridPath(
  W: number,
  H: number,
  blocked: (x: number, y: number) => boolean,
  from: Cell,
  to: Cell,
  limit = 6000,
): Cell[] | null {
  if (from.x === to.x && from.y === to.y) return [from];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  if (!inside(from.x, from.y) || !inside(to.x, to.y)) return null;
  const prev = new Int32Array(W * H).fill(-1);
  const id = (x: number, y: number) => y * W + x;
  const queue: number[] = [id(from.x, from.y)];
  prev[queue[0]] = queue[0];
  const goal = id(to.x, to.y);
  let head = 0;
  while (head < queue.length && head < limit) {
    const cur = queue[head++];
    if (cur === goal) break;
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(nx, ny)) continue;
      const n = id(nx, ny);
      if (prev[n] !== -1) continue;
      if (n !== goal && blocked(nx, ny)) continue;
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const path: Cell[] = [];
  let cur = goal;
  while (cur !== prev[cur]) {
    path.push({ x: cur % W, y: Math.floor(cur / W) });
    cur = prev[cur];
  }
  path.push({ x: from.x, y: from.y });
  path.reverse();
  return path;
}
