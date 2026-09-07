// ---------------------------------------------------------------------------
// NEW MISSION / MISSION COMPLETE / region-arrival cards. Short flourish, then
// straight back to play — never a wall the player has to dismiss.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { bus } from "../game/bus";
import { questSfx } from "../lib/questSfx";
import { PetalRain } from "./pixel/decor";
import { PixelIcon } from "./pixel/MissionIcons";

type Payload = {
  kind: "mission-start" | "mission-complete" | "region" | "objective";
  title: string;
  subtitle: string;
};

export default function MissionCinematic() {
  const [card, setCard] = useState<Payload | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const off = bus.on("cinematic", (p: Payload & { kind: string }) => {
      if (p.kind === "location") return;
      clear();
      setCard(p as Payload);
      setVisible(true);
      if (p.kind === "mission-complete") questSfx.missionComplete();
      else if (p.kind === "mission-start") questSfx.missionStart();
      else questSfx.objective();

      timers.current.push(window.setTimeout(() => setVisible(false), 2200));
      timers.current.push(window.setTimeout(() => setCard(null), 2800));
    });

    return () => {
      off();
      clear();
    };
  }, []);

  if (!card) return null;

  const complete = card.kind === "mission-complete";
  const accent = complete ? "#7ddca4" : "#d9b45b";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="absolute inset-0 bg-[#0a0507]/62" />
      <PetalRain count={16} opacity={0.5} />

      <div
        className="sb-pop relative flex min-w-[340px] flex-col items-center border-y-2 bg-[#0a0507]/92 px-10 py-7"
        style={{ borderColor: accent, boxShadow: `0 0 46px ${accent}33` }}
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full w-14 opacity-25"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, animation: "sb-sweep 1.6s ease-in-out" }}
          />
        </div>

        <div className="mb-2">
          <PixelIcon name={complete ? "seal" : card.kind === "region" ? "region" : "flame"} size={22} />
        </div>
        <div className="text-[13px] tracking-[0.28em]" style={{ color: accent, textShadow: `0 0 16px ${accent}66` }}>
          {complete ? "✓ " : ""}
          {card.title}
        </div>
        <div className="mt-2 h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div className="mt-3 text-[8px] tracking-[0.2em] text-[#f7e6c8]">{card.subtitle}</div>
      </div>
    </div>
  );
}
