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
  kind: "mission-start" | "mission-complete" | "region" | "objective" | "location";
  title: string;
  subtitle: string;
};

export default function MissionCinematic() {
  const [card, setCard] = useState<Payload | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

    const off = bus.on("cinematic", (p: Payload & { kind: string }) => {
      if (p.kind === "location") return;
      clear();
      setCard(p as Payload);
      setVisible(true);
      if (p.kind === "mission-complete") questSfx.missionComplete();
      else if (p.kind === "mission-start") questSfx.missionStart();
      else questSfx.objective();

      timers.current.push(window.setTimeout(() => setVisible(false), 2400));
      timers.current.push(window.setTimeout(() => setCard(null), 3100));
    });

    return () => { off(); clear(); };
  }, []);

  if (!card) return null;

  const complete = card.kind === "mission-complete";
  const accent = complete ? "#7ddca4" : "#d9b45b";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-600"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: "rgba(6,3,5,.66)" }} />
      <PetalRain count={14} opacity={0.45} />

      <div className="sb-pop relative flex min-w-[420px] flex-col items-center px-14 py-10">
        {/* framing rules rather than a heavy box */}
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="h-full w-24 opacity-[.14]"
            style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)`, animation: "sb-sweep 1.9s ease-in-out" }}
          />
        </div>

        <div className="mb-3 opacity-90">
          <PixelIcon name={complete ? "seal" : card.kind === "region" ? "region" : "flame"} size={26} />
        </div>

        <div
          className="title-lg text-[22px] tracking-[.2em]"
          style={{ color: accent, textShadow: `0 0 30px ${accent}55, 0 2px 12px rgba(0,0,0,.8)` }}
        >
          {complete ? "✦ " : ""}{card.title}
        </div>

        <div className="mt-3 text-[14px] text-[var(--ink-2)]">{card.subtitle}</div>
      </div>
    </div>
  );
}
