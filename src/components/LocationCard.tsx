// ---------------------------------------------------------------------------
// Arrival card: place name, the current objective, and hint 1. Auto-fades
// after 3.6s so it never becomes furniture. Styled like the other cards: an
// eyebrow, a title, a growing gold rule, then the objective.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { bus } from "../game/bus";
import { useGameStore } from "../store/useGameStore";
import { missionGuide, currentObjective } from "../lib/missionMeta";
import { MAPS, type MapId } from "../game/maps";
import { PixelIcon } from "./pixel/MissionIcons";

type Card = { place: string; objective: string; hint: string; icon: Parameters<typeof PixelIcon>[0]["name"] };

export default function LocationCard() {
  const [card, setCard] = useState<Card | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

    const off = bus.on("cinematic", (p: { kind: string; mapId?: MapId }) => {
      if (p.kind !== "location" || !p.mapId) return;
      const s = useGameStore.getState();
      const guide = missionGuide(s);
      const cur = currentObjective(s);
      clear();
      setCard({
        place: MAPS[p.mapId].name,
        objective: guide?.objective ?? cur?.label ?? "",
        hint: guide?.hints[0] ?? "",
        icon: cur?.mission.icon ?? "region",
      });
      setVisible(true);
      timers.current.push(window.setTimeout(() => setVisible(false), 3600));
      timers.current.push(window.setTimeout(() => setCard(null), 4300));
    });

    return () => { off(); clear(); };
  }, []);

  if (!card) return null;

  return (
    <div
      className="location-card ui-motion-long pointer-events-none absolute left-1/2 top-16 z-30 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 transition-all duration-700"
      style={{ opacity: visible ? 1 : 0, transform: `translateX(-50%) translateY(${visible ? 0 : -10}px)` }}
    >
      <div className="surface sb-pop relative overflow-hidden px-5 py-4">
        <div className="absolute inset-x-0 top-0 h-px ui-rule-grow" style={{ background: "linear-gradient(90deg, transparent, rgba(242,223,166,.85), transparent)" }} />
        <div className="eyebrow mb-1">Now entering</div>
        <div className="flex items-center gap-3">
          <PixelIcon name={card.icon} size={18} />
          <span className="title-lg text-[17px] text-[#f2dfa6] glow-gold">{card.place}</span>
        </div>
        <div className="rule ui-rule-grow my-3" style={{ animationDelay: ".15s" }} />
        {card.objective && (
          <div className="flex gap-2 text-[13px] leading-snug text-[var(--ink-1)]">
            <span className="text-[#d9b45b]">◆</span>
            <span>{card.objective}</span>
          </div>
        )}
        {card.hint && <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">{card.hint}</p>}
      </div>
    </div>
  );
}
