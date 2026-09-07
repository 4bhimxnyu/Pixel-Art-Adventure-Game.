// ---------------------------------------------------------------------------
// The full mission journal: tabs, detail pane with WHAT TO DO (objective /
// WHERE / HINT / ROUTE), the full objective ladder, cast, rewards, the Sacred
// Flames tracker, and a world map with a gold marker on the target region.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useGameStore, flameCount } from "../store/useGameStore";
import { buildMissions, REGIONS, regionById, type Mission, type MissionCategory } from "../lib/missionMeta";
import { MAP_REGION } from "../lib/guidance";
import { questSfx } from "../lib/questSfx";
import { sfx } from "../game/sound";
import { ScrollPanel, GoldRule } from "./pixel/decor";
import { PixelIcon, REWARD_ICON, type IconName } from "./pixel/MissionIcons";
import { FramedPortrait } from "./pixel/Portrait";

const TABS: { id: MissionCategory | "history"; label: string }[] = [
  { id: "main", label: "MAIN STORY" },
  { id: "side", label: "SIDE" },
  { id: "discovered", label: "DISCOVERED" },
  { id: "history", label: "HISTORY" },
];

export default function JourneyPanel() {
  const state = useGameStore();
  const setOverlay = useGameStore((s) => s.setOverlay);
  const missions = useMemo(() => buildMissions(state), [state]);
  const flames = flameCount(state);

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("main");
  const [sel, setSel] = useState(0);

  const shown = useMemo(() => {
    if (tab === "history") return missions.filter((m) => m.category === "completed");
    return missions.filter((m) => m.category === tab);
  }, [missions, tab]);

  useEffect(() => setSel(0), [tab]);

  const mission: Mission | undefined = shown[sel];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ti = TABS.findIndex((t) => t.id === tab);
      if (["ArrowRight", "d", "D"].includes(e.key)) { setTab(TABS[(ti + 1) % TABS.length].id); sfx("menu"); }
      else if (["ArrowLeft", "a", "A"].includes(e.key)) { setTab(TABS[(ti - 1 + TABS.length) % TABS.length].id); sfx("menu"); }
      else if (["ArrowDown", "s", "S"].includes(e.key)) { setSel((c) => (shown.length ? (c + 1) % shown.length : 0)); sfx("menu"); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { setSel((c) => (shown.length ? (c - 1 + shown.length) % shown.length : 0)); sfx("menu"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, shown.length]);

  const playerRegion = MAP_REGION[state.map];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0507]/90 p-3">
      <ScrollPanel
        title="JOURNEY"
        onClose={() => { questSfx.panelClose(); setOverlay(null); }}
        className="flex h-full max-h-[640px] w-full max-w-[960px] flex-col"
      >
        {/* tabs */}
        <div className="flex shrink-0 border-b-2 border-[#3a2229]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); sfx("menu"); }}
              className="flex-1 border-r border-[#241a1e] px-2 py-2 text-[7px] tracking-[0.18em] last:border-r-0"
              style={{
                color: tab === t.id ? "#f2dfa6" : "#6d5f57",
                background: tab === t.id ? "#7c141f" : "transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="shrink-0 px-3 py-1 text-right text-[6px] tracking-[0.2em] text-[#5f5249]">
          [LB/RB] or ←/→ SWITCH TAB
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[240px_1fr]">
          {/* list */}
          <div className="min-h-0 overflow-y-auto border-r-2 border-[#3a2229] p-2">
            {!shown.length && (
              <div className="p-6 text-center text-[7px] leading-[2] text-[#5f5249]">
                Nothing here yet.
              </div>
            )}
            {shown.map((m, i) => (
              <button
                key={m.id}
                onClick={() => { setSel(i); sfx("menu"); }}
                className="mb-1.5 flex w-full items-center gap-2 border px-2 py-2 text-left"
                style={{
                  borderColor: i === sel ? "#d9b45b" : "#241a1e",
                  background: i === sel ? "#2a1016" : "transparent",
                }}
              >
                <PixelIcon name={m.icon} size={14} />
                <span className="flex-1 truncate text-[7px] text-[#f7e6c8]">{m.title}</span>
                {m.category === "completed" ? (
                  <span className="text-[7px] text-[#7ddca4]">✓</span>
                ) : (
                  <span className="text-[6px] text-[#8a7a6a]">{Math.round(m.progress * 100)}%</span>
                )}
              </button>
            ))}
          </div>

          {/* detail */}
          <div className="min-h-0 overflow-y-auto p-4">
            {!mission ? (
              <div className="text-[8px] text-[#8a7a6a]">Select a mission.</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <PixelIcon name={mission.icon} size={20} />
                  <h2 className="text-[12px] tracking-[0.14em] text-[#d9b45b]">{mission.title}</h2>
                  {mission.finale && <span className="border border-[#b3252f] px-1 text-[6px] text-[#b3252f]">FINALE</span>}
                  {mission.category === "completed" && (
                    <span className="ml-auto text-[7px] tracking-widest text-[#7ddca4]">COMPLETE</span>
                  )}
                </div>
                <p className="mt-2 text-[7px] leading-[2.1] text-[#c9b9a5]">{mission.blurb}</p>

                <GoldRule />

                {/* WHAT TO DO */}
                {mission.category !== "completed" && mission.guide && (
                  <section className="border-2 border-[#7c141f] bg-[#150b0f] p-3">
                    <div className="mb-2 text-[7px] tracking-[0.28em] text-[#d9b45b]">WHAT TO DO</div>
                    <Field label="OBJECTIVE" value={mission.guide.objective} accent />
                    <Field label="WHERE" value={mission.guide.place} />
                    <Field label="HINT" value={mission.guide.hints[0]} />
                    {mission.guide.chain && (
                      <div className="mt-2">
                        <div className="mb-1 text-[6px] tracking-[0.22em] text-[#8a7a6a]">ROUTE</div>
                        <div className="flex flex-wrap items-center gap-1">
                          {mission.guide.chain.map((step, i) => (
                            <span key={step + i} className="flex items-center gap-1">
                              <span className="border border-[#3a2229] bg-[#0a0507] px-1.5 py-0.5 text-[6px] text-[#f7e6c8]">
                                {step}
                              </span>
                              {i < mission.guide!.chain!.length - 1 && <span className="text-[7px] text-[#d9b45b]">›</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* objective ladder */}
                <section className="mt-4">
                  <div className="mb-1.5 text-[6px] tracking-[0.28em] text-[#7c141f]">OBJECTIVES</div>
                  {mission.objectives.map((o) => (
                    <div key={o.stepId} className="flex items-start gap-2 py-1">
                      <span
                        className="mt-[2px] text-[8px]"
                        style={{ color: o.done ? "#7ddca4" : o.active ? "#d9b45b" : "#3a2229" }}
                      >
                        {o.done ? "✓" : o.active ? "→" : "○"}
                      </span>
                      <span
                        className="text-[7px] leading-[1.9]"
                        style={{
                          color: o.done ? "#5f7a68" : o.active ? "#f7e6c8" : "#4a3e3a",
                          textDecoration: o.done ? "line-through" : undefined,
                        }}
                      >
                        {o.label}
                      </span>
                    </div>
                  ))}
                </section>

                {/* cast */}
                <section className="mt-4">
                  <div className="mb-2 text-[6px] tracking-[0.28em] text-[#7c141f]">CHARACTERS</div>
                  <div className="flex flex-wrap gap-3">
                    {mission.cast.map((c) => (
                      <FramedPortrait key={c} id={c} size={40} label={c} tone={c === "arshiya" ? "crimson" : "gold"} />
                    ))}
                  </div>
                </section>

                {/* rewards */}
                <section className="mt-4">
                  <div className="mb-1.5 text-[6px] tracking-[0.28em] text-[#7c141f]">REWARDS</div>
                  <div className="flex flex-col gap-1">
                    {mission.rewards.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <PixelIcon name={(REWARD_ICON[r.kind] ?? "star") as IconName} size={12} />
                        <span className="text-[7px] text-[#f7e6c8]">{r.label}</span>
                        <span className="text-[6px] text-[#5f5249]">({r.kind})</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* flames */}
                <section className="mt-4 border border-[#3a2229] p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[6px] tracking-[0.28em] text-[#7c141f]">SACRED FLAMES</span>
                    <span className="text-[7px] text-[#d9b45b]">{flames}/3</span>
                  </div>
                  <div className="flex gap-3">
                    {[
                      ["Stone", state.flags.flameMountain],
                      ["Petals", state.flags.flameGarden],
                      ["Echoes", state.flags.flameCave],
                    ].map(([name, got]) => (
                      <div key={name as string} className="flex items-center gap-1" style={{ opacity: got ? 1 : 0.3 }}>
                        <PixelIcon name="flame" size={12} />
                        <span className="text-[6px] text-[#f7e6c8]">{name as string}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* world map */}
                <section className="mt-4">
                  <div className="mb-1.5 text-[6px] tracking-[0.28em] text-[#7c141f]">WORLD MAP</div>
                  <WorldMap targetRegion={mission.region} playerRegion={playerRegion} boss={!!mission.boss} />
                  <div className="mt-2 flex flex-wrap gap-3 text-[6px] text-[#8a7a6a]">
                    <span><span className="text-[#7ddca4]">●</span> You</span>
                    <span><span className="text-[#d9b45b]">◆</span> Mission</span>
                    <span>🏯 Location</span>
                    <span><span className="text-[#b3252f]">⚔</span> Boss</span>
                    <span><span className="text-[#8a7a6a]">◇</span> Optional</span>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </ScrollPanel>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="mb-1.5 flex gap-2">
      <span className="w-[62px] shrink-0 text-[6px] tracking-[0.18em] text-[#8a7a6a]">{label}</span>
      <span className="flex-1 text-[7px] leading-[1.9]" style={{ color: accent ? "#f2dfa6" : "#f7e6c8" }}>
        {value}
      </span>
    </div>
  );
}

function WorldMap({
  targetRegion, playerRegion, boss,
}: {
  targetRegion: string;
  playerRegion: string;
  boss: boolean;
}) {
  const target = regionById(targetRegion as never);
  return (
    <div className="relative h-[150px] w-full border-2 border-[#3a2229] bg-[#0f1512]">
      {/* connective paths */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {REGIONS.slice(0, -1).map((r, i) => {
          const n = REGIONS[i + 1];
          return (
            <line
              key={r.id}
              x1={r.x * 100} y1={r.y * 100} x2={n.x * 100} y2={n.y * 100}
              stroke="#2a2028" strokeWidth={0.6} strokeDasharray="2 2"
            />
          );
        })}
      </svg>

      {REGIONS.map((r) => {
        const isTarget = r.id === targetRegion;
        const isPlayer = r.id === playerRegion;
        return (
          <div
            key={r.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
          >
            <div
              className="flex flex-col items-center gap-0.5"
              style={isTarget ? { animation: "sb-glow 1.4s ease-in-out infinite" } : undefined}
            >
              <PixelIcon name={r.icon} size={isTarget ? 16 : 11} />
              <span
                className="whitespace-nowrap text-[5px] tracking-wider"
                style={{ color: isTarget ? "#d9b45b" : isPlayer ? "#7ddca4" : "#5f5249" }}
              >
                {r.name}
              </span>
              <span className="text-[6px]" style={{ color: isPlayer ? "#7ddca4" : "transparent" }}>●</span>
            </div>
            {isTarget && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-[#d9b45b]">
                {boss ? "⚔" : "◆"}
              </div>
            )}
          </div>
        );
      })}

      <div className="absolute bottom-1 right-2 text-[5px] tracking-widest text-[#3a2229]">
        {target.name.toUpperCase()}
      </div>
    </div>
  );
}
