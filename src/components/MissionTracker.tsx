// ---------------------------------------------------------------------------
// ONE active objective, its location, the hint ladder, and the flame counter.
// Locked or future objectives are never shown here — the full ladder lives in
// the Journey panel.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore, flameCount } from "../store/useGameStore";
import { currentObjective, missionGuide } from "../lib/missionMeta";
import { bus } from "../game/bus";
import { questSfx } from "../lib/questSfx";
import { PixelIcon } from "./pixel/MissionIcons";

export default function MissionTracker() {
  const state = useGameStore();
  const cur = currentObjective(state);
  const guide = missionGuide(state);
  const flames = flameCount(state);

  const [hintLevel, setHintLevel] = useState(0);
  const [flash, setFlash] = useState(false);

  // The ladder resets whenever the objective itself changes.
  useEffect(() => {
    setHintLevel(0);
  }, [cur?.stepId]);

  useEffect(() => {
    return bus.on("objective:done", () => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGameStore.getState().overlay) return;
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHintLevel((l) => {
          if (l >= 3) return l;
          questSfx.hint();
          return l + 1;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!cur) return null;

  return (
    <div
      className="pointer-events-auto w-[290px] border-2 border-[#7c141f] bg-[#0a0507]/88 px-3 py-2 backdrop-blur-[2px] transition-shadow"
      style={flash ? { boxShadow: "0 0 0 2px #d9b45b, 0 0 26px rgba(217,180,91,.6)" } : undefined}
    >
      <div className="flex items-center gap-2">
        <PixelIcon name={cur.mission.icon} size={14} />
        <span className="truncate text-[8px] tracking-[0.18em] text-[#d9b45b]">
          {cur.mission.title.toUpperCase()}
        </span>
        {cur.mission.boss && <span className="ml-auto text-[6px] text-[#b3252f]">BOSS</span>}
      </div>

      <div className="mt-1.5 flex items-start gap-1.5">
        <span className="mt-[1px] text-[9px] text-[#d9b45b]">→</span>
        <span className="text-[8px] leading-[1.7] text-[#f7e6c8]">
          {guide?.objective ?? cur.label}
        </span>
      </div>

      {guide && (
        <div className="mt-1 pl-4 text-[7px] leading-[1.7] text-[#8a7a6a]">📍 {guide.place}</div>
      )}

      {guide && hintLevel > 0 && (
        <div className="mt-2 border-t border-[#3a2229] pt-1.5">
          {guide.hints.slice(0, hintLevel).map((h, i) => (
            <div key={i} className="mb-1 flex gap-1.5 text-[7px] leading-[1.8] text-[#d9b45b] sb-rise">
              <span className="opacity-60">{i + 1}.</span>
              <span className="text-[#e8d9b8]">{h}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-[#3a2229] pt-1.5">
        <button
          onClick={() => {
            if (hintLevel >= 3) return;
            questSfx.hint();
            setHintLevel((l) => l + 1);
          }}
          disabled={hintLevel >= 3}
          className="text-[6px] tracking-[0.2em] text-[#d9b45b] disabled:text-[#4a3a3a]"
        >
          {hintLevel >= 3 ? "NO MORE HINTS" : `[H] HINT ${hintLevel + 1}/3`}
        </button>

        {flames > 0 && (
          <div className="flex items-center gap-1" title="Sacred Flames gathered">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ opacity: i < flames ? 1 : 0.22 }}>
                <PixelIcon name="flame" size={10} />
              </span>
            ))}
            <span className="text-[6px] text-[#d9b45b]">{flames}/3</span>
          </div>
        )}
      </div>
    </div>
  );
}
