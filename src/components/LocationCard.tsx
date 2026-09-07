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
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

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
      timers.current.push(window.setTimeout(() => setCard(null), 4200));
    });

    return () => {
      off();
      clear();
    };
  }, []);

  if (!card) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-14 z-30 w-[330px] -translate-x-1/2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="sb-pop border-2 border-[#d9b45b] bg-[#0a0507]/94 px-4 py-3 shadow-[0_0_28px_rgba(217,180,91,.22)]">
        <div className="flex items-center gap-2">
          <PixelIcon name={card.icon} size={16} />
          <span className="text-[11px] tracking-[0.18em] text-[#d9b45b]">{card.place.toUpperCase()}</span>
        </div>
        <div className="my-2 h-px w-full bg-gradient-to-r from-[#d9b45b] via-[#7c141f] to-transparent" />
        {card.objective && (
          <div className="flex gap-1.5 text-[8px] leading-[1.8] text-[#f7e6c8]">
            <span className="text-[#d9b45b]">→</span>
            <span>{card.objective}</span>
          </div>
        )}
        {card.hint && (
          <div className="mt-1.5 text-[7px] leading-[1.9] text-[#8a7a6a]">{card.hint}</div>
        )}
      </div>
    </div>
  );
}
