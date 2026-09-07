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
  useEffect(() => { setHintLevel(0); }, [cur?.stepId]);

  useEffect(() => bus.on("objective:done", () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1100);
  }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGameStore.getState().overlay) return;
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHintLevel((l) => { if (l >= 3) return l; questSfx.hint(); return l + 1; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!cur) return null;

  return (
    <div
      className="surface pointer-events-auto w-[330px] overflow-hidden transition-shadow duration-500"
      style={flash ? { boxShadow: "0 0 0 1px rgba(217,180,91,.8), 0 0 40px -4px rgba(217,180,91,.6)" } : undefined}
    >
      <div className="flex items-center gap-2.5 border-b border-[rgba(217,180,91,.15)] px-4 py-2.5">
        <PixelIcon name={cur.mission.icon} size={16} />
        <span className="title-lg flex-1 truncate text-[12px] text-[#f2dfa6]">{cur.mission.title}</span>
        {cur.mission.boss && (
          <span className="rounded-full border border-[rgba(224,97,107,.5)] px-2 py-0.5 text-[9px] font-semibold tracking-wider text-[#e0616b]">
            BOSS
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-[3px] text-[11px] text-[#d9b45b]">◆</span>
          <span className="text-[13px] font-medium leading-snug text-[var(--ink-1)]">
            {guide?.objective ?? cur.label}
          </span>
        </div>

        {guide && (
          <div className="mt-2 flex items-center gap-1.5 pl-5 text-[11px] text-[var(--ink-3)]">
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 7.6V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {guide.place}
          </div>
        )}

        {guide && hintLevel > 0 && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-[rgba(217,180,91,.16)] bg-black/30 p-2.5">
            {guide.hints.slice(0, hintLevel).map((h, i) => (
              <div key={i} className="sb-rise flex gap-2 text-[11px] leading-relaxed">
                <span className="text-[var(--ink-4)]">{i + 1}</span>
                <span className="text-[var(--ink-2)]">{h}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[rgba(217,180,91,.15)] px-4 py-2">
        <button
          onClick={() => { if (hintLevel >= 3) return; questSfx.hint(); setHintLevel((l) => l + 1); }}
          disabled={hintLevel >= 3}
          className="text-[10px] font-semibold tracking-[.12em] text-[#d9b45b] transition-colors hover:text-[#f2dfa6] disabled:text-[var(--ink-4)]"
        >
          {hintLevel >= 3 ? "NO MORE HINTS" : `HINT ${hintLevel + 1} / 3  ·  H`}
        </button>

        {flames > 0 && (
          <div className="flex items-center gap-1.5" title="Sacred Flames gathered">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ opacity: i < flames ? 1 : 0.2 }}>
                <PixelIcon name="flame" size={11} />
              </span>
            ))}
            <span className="text-[10px] font-semibold text-[#d9b45b]">{flames}/3</span>
          </div>
        )}
      </div>
    </div>
  );
}
