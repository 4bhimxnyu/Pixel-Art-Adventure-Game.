// ---------------------------------------------------------------------------
// Circular minimap drawn on a canvas from the current map's rows: walls, floor,
// water and greenery, gates (gold open / red locked), NPC marks, the player as
// an arrow, and the objective as a pulsing gold dot (or a ring on the exit that
// leads to it). North is up: row 0 is the top of the map.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { MAPS, SOLID } from "../game/maps";
import { objectivePoint, objectivePath } from "./objective";
import { questSfx } from "../lib/questSfx";

const SIZE = 150; // css px of the canvas (phones scale it down via CSS)
const TILE = 7;

const WATER = new Set(["w", "o"]);
const GREEN = new Set(["t", "j", "q"]);
const GRASS = new Set([".", "g", "F", "v"]);
const PATH = new Set([",", ":", "k", "e"]);
const SPECIAL = new Set(["!", "*", "h", "u", "z", "$", "&", "s", "i", "I", "+", "~", "y", "p", "%", "m", "L"]);

function tileColor(ch: string): string | null {
  if (ch === "_" || ch === " ") return null;
  if (ch === "#" || ch === "K" || ch === "c" || ch === "H") return "#2b1b21";
  if (WATER.has(ch)) return "#1c3450";
  if (ch === "e") return "#6a5238";
  if (GREEN.has(ch)) return ch === "q" ? "#4a2a3c" : ch === "j" ? "#27452a" : "#1f3628";
  if (GRASS.has(ch)) return ch === "g" ? "#36593a" : ch === "v" ? "#4a2c3a" : "#2e4a32";
  if (PATH.has(ch)) return ch === "k" ? "#4a3f39" : "#5a4a38";
  if (ch === "r") return "#6b1c24";
  if (ch === "n") return "#3a3132";
  if (ch === "f") return "#3d2b25";
  if (ch === "b" || ch === "B" || ch === "D" || ch === "T") return "#5a3a2c";
  if (ch === "d") return "#8a6a3a";
  if (SOLID.has(ch)) return "#4a3a33";
  return "#3d2b25";
}

export default function Minimap() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const map = useGameStore((s) => s.map);
  const px = useGameStore((s) => s.playerX);
  const py = useGameStore((s) => s.playerY);
  const dir = useGameStore((s) => s.playerDir);
  const flags = useGameStore((s) => s.flags);
  const quests = useGameStore((s) => s.quests);
  const party = useGameStore((s) => s.party);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const def = MAPS[map];
    const state = useGameStore.getState();
    const obj = objectivePoint(state);
    const path = objectivePath(state);
    const partyIds = new Set(party.map((p) => p.id));
    const R = SIZE / 2;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 120) return; // the pulse does not need 60 fps
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();
      // parchment-dark ground
      ctx.fillStyle = "#120a0d";
      ctx.fillRect(0, 0, SIZE, SIZE);

      const ox = R - (px + 0.5) * TILE;
      const oy = R - (py + 0.5) * TILE;
      const reach = Math.ceil(R / TILE) + 1;
      for (let y = Math.max(0, py - reach); y <= Math.min(def.rows.length - 1, py + reach); y++) {
        const row = def.rows[y];
        for (let x = Math.max(0, px - reach); x <= Math.min(row.length - 1, px + reach); x++) {
          const ch = row[x];
          const c = tileColor(ch);
          if (!c) continue;
          ctx.fillStyle = c;
          ctx.fillRect(ox + x * TILE, oy + y * TILE, TILE, TILE);
          if (SPECIAL.has(ch)) {
            ctx.fillStyle = "rgba(217,180,91,.55)";
            ctx.fillRect(ox + x * TILE + 2, oy + y * TILE + 2, TILE - 4, TILE - 4);
          } else if (ch >= "A" && ch <= "Z" && def.interacts[ch]) {
            const pid = def.interacts[ch].partyId;
            if (!pid || !partyIds.has(pid)) {
              ctx.fillStyle = "#f4ead7";
              ctx.beginPath();
              ctx.arc(ox + (x + 0.5) * TILE, oy + (y + 0.5) * TILE, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // the route to the objective: a dotted gold line, brighter toward the goal
      if (path && path.length > 2) {
        for (let i = 1; i < path.length; i++) {
          const c = path[i];
          const wave = 0.5 + 0.5 * Math.sin(now / 160 - i * 0.6);
          ctx.beginPath();
          ctx.arc(ox + (c.x + 0.5) * TILE, oy + (c.y + 0.5) * TILE, 1.1 + wave * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(242,223,166,${0.45 + wave * 0.45})`;
          ctx.fill();
        }
      }

      // gates
      for (const p of def.portals) {
        const locked = !!p.requiresFlag && !(flags as unknown as Record<string, unknown>)[p.requiresFlag];
        const cx = ox + (p.x + 0.5) * TILE;
        const cy = oy + (p.y + 0.5) * TILE;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 3.6);
        ctx.lineTo(cx + 3.6, cy);
        ctx.lineTo(cx, cy + 3.6);
        ctx.lineTo(cx - 3.6, cy);
        ctx.closePath();
        ctx.fillStyle = locked ? "#8f1a24" : "#d9b45b";
        ctx.fill();
        if (locked) {
          ctx.strokeStyle = "#e0616b";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // objective
      if (obj) {
        const cx = ox + (obj.x + 0.5) * TILE;
        const cy = oy + (obj.y + 0.5) * TILE;
        // clamp to the rim so a far objective still shows its direction
        const dx = cx - R;
        const dy = cy - R;
        const d = Math.hypot(dx, dy);
        const lim = R - 9;
        const kx = d > lim ? R + (dx / d) * lim : cx;
        const ky = d > lim ? R + (dy / d) * lim : cy;
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        ctx.beginPath();
        ctx.arc(kx, ky, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217,180,91,${0.18 + pulse * 0.18})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(kx, ky, obj.direct ? 3 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "#f2dfa6";
        ctx.fill();
        if (!obj.direct) {
          ctx.beginPath();
          ctx.arc(kx, ky, 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#f2dfa6";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // player arrow
      const ang = dir === "up" ? 0 : dir === "right" ? Math.PI / 2 : dir === "down" ? Math.PI : -Math.PI / 2;
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(4.2, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4.2, 4);
      ctx.closePath();
      ctx.fillStyle = "#f2dfa6";
      ctx.strokeStyle = "rgba(10,5,7,.9)";
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // rim vignette
      const g = ctx.createRadialGradient(R, R, R * 0.55, R, R, R);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map, px, py, dir, flags, quests, party]);

  return (
    <button
      className="minimap pointer-events-auto relative shrink-0 rounded-full"
      onClick={() => { questSfx.panelOpen(); useGameStore.getState().setOverlay({ kind: "quests" }); }}
      aria-label="Open the world map"
      title="Map (Q)"
      style={{
        width: SIZE,
        height: SIZE,
        border: "1px solid rgba(217,180,91,.45)",
        boxShadow: "0 12px 30px -12px rgba(0,0,0,.9), 0 0 0 3px rgba(10,5,7,.6), inset 0 0 0 1px rgba(242,223,166,.08)",
        background: "#120a0d",
        overflow: "hidden",
      }}
    >
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
      <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[8px] font-bold tracking-[.2em] text-[rgba(242,223,166,.7)]">N</span>
    </button>
  );
}
