// ---------------------------------------------------------------------------
// Arrival card: place name, the current objective, and hint 1. Auto-fades
// after 3.6s so it never becomes furniture.
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
      className="pointer-events-none absolute left-1/2 top-16 z-30 w-[380px] -translate-x-1/2 transition-all duration-700"
      style={{ opacity: visible ? 1 : 0, transform: `translateX(-50%) translateY(${visible ? 0 : -10}px)` }}
    >
      <div className="surface sb-pop px-5 py-4">
        <div className="flex items-center gap-3">
          <PixelIcon name={card.icon} size={18} />
          <span className="title-lg text-[17px] text-[#f2dfa6] glow-gold">{card.place}</span>
        </div>
        <div className="rule my-3" />
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
