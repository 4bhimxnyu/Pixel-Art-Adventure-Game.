import { useGameStore } from "../store/useGameStore";
import { MAPS } from "../game/maps";
import MissionTracker from "./MissionTracker";
import { HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";

export default function HUD() {
  const map = useGameStore((s) => s.map);
  const party = useGameStore((s) => s.party);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          {/* place */}
          <div className="surface inline-flex w-fit items-center gap-2.5 px-4 py-2">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="5" r="3" fill="none" stroke="#d9b45b" strokeWidth="1.3" />
              <path d="M6 8v3" stroke="#d9b45b" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="title-lg text-[13px] text-[#f2dfa6]">{MAPS[map].name}</span>
          </div>

          {/* party */}
          <div className="flex flex-col gap-2">
            {party.map((p) => (
              <div key={p.id} className="surface flex w-fit items-center gap-3 px-3 py-2">
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: "1px solid rgba(217,180,91,.4)", boxShadow: "0 4px 12px -4px rgba(0,0,0,.8)" }}
                >
                  <CharacterPortrait id={p.portrait} size={30} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-[var(--ink-1)]">{p.name}</span>
                  <HpBar hp={p.hp} max={p.maxHp} width={104} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <MissionTracker />
      </div>

      <div className="flex items-end justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--ink-4)]">
          {[["E","Interact"],["Q","Missions"],["I","Items"],["H","Hint"],["Esc","Menu"],["F5","Save"]].map(([k,v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <kbd className="rounded border border-[rgba(217,180,91,.25)] bg-black/50 px-1.5 py-0.5 text-[9px] text-[var(--ink-2)]">{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
