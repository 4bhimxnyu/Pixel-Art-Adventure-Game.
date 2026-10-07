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
import { ScrollPanel } from "./pixel/decor";
import { PixelIcon, REWARD_ICON, type IconName } from "./pixel/MissionIcons";
import { CharacterPortrait } from "./pixel/Portrait";

const TABS: { id: MissionCategory | "history"; label: string }[] = [
  { id: "main", label: "Main story" },
  { id: "side", label: "Side" },
  { id: "discovered", label: "Discovered" },
  { id: "history", label: "History" },
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
    <div className="panel-shell absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
      <ScrollPanel
        title="Journey"
        subtitle="Everything you know, and where to go next"
        onClose={() => { questSfx.panelClose(); setOverlay(null); }}
        className="flex h-full max-h-[720px] w-full max-w-[1040px] flex-col"
      >
        <div className="flex shrink-0 gap-1 border-b border-[rgba(217,180,91,.15)] px-4 pt-3">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); sfx("menu"); }}
                className="relative px-4 py-2.5 text-[12px] font-medium transition-colors"
                style={{ color: on ? "#f2dfa6" : "var(--ink-3)" }}
              >
                {t.label}
                {on && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#d9b45b]" />}
              </button>
            );
          })}
        </div>

        <div className="journey-grid grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[268px_1fr]">
          {/* list */}
          <div className="journey-list scroll-area min-h-0 overflow-y-auto border-r border-[rgba(217,180,91,.15)] p-3">
            {!shown.length && (
              <p className="p-8 text-center text-[12px] leading-relaxed text-[var(--ink-4)]">Nothing here yet.</p>
            )}
            {shown.map((m, i) => (
              <button
                key={m.id}
                onClick={() => { setSel(i); sfx("menu"); }}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                  i === sel ? "border-[rgba(217,180,91,.45)] bg-white/[.05]" : "border-transparent hover:bg-white/[.025]"
                }`}
              >
                <PixelIcon name={m.icon} size={17} />
                <span className="flex-1 truncate text-[13px] text-[var(--ink-1)]">{m.title}</span>
                {m.category === "completed" ? (
                  <span className="text-[13px] text-[#7ddca4]">✓</span>
                ) : (
                  <span className="text-[11px] tabular-nums text-[var(--ink-4)]">{Math.round(m.progress * 100)}%</span>
                )}
              </button>
            ))}
          </div>

          {/* detail */}
          <div className="scroll-area min-h-0 overflow-y-auto p-6">
            {!mission ? (
              <p className="text-[13px] text-[var(--ink-3)]">Select a mission.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <PixelIcon name={mission.icon} size={24} />
                  <h2 className="title-lg text-[22px] text-[#f2dfa6]">{mission.title}</h2>
                  {mission.finale && (
                    <span className="rounded-full border border-[rgba(224,97,107,.5)] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#e0616b]">
                      FINALE
                    </span>
                  )}
                  <span
                    className="ml-auto rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider"
                    style={{
                      color: mission.state === "COMPLETED" ? "#7ddca4" : mission.state === "ACTIVE" ? "#f2dfa6" : "var(--ink-4)",
                      borderColor: mission.state === "COMPLETED" ? "rgba(125,220,164,.5)" : mission.state === "ACTIVE" ? "rgba(217,180,91,.5)" : "rgba(255,255,255,.12)",
                    }}
                  >
                    {mission.state}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-2)]">{mission.blurb}</p>

                {mission.category !== "completed" && mission.guide && (
                  <section className="mt-5 rounded-xl border border-[rgba(217,180,91,.28)] bg-black/30 p-5">
                    <div className="eyebrow mb-3">What to do</div>
                    <Field label="Objective" value={mission.guide.objective} accent />
                    <Field label="Where" value={mission.guide.place} />
                    <Field label="Hint" value={mission.guide.hints[0]} />
                    {mission.guide.chain && (
                      <div className="mt-4">
                        <div className="eyebrow mb-2">Route</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {mission.guide.chain.map((s, i) => (
                            <span key={s + i} className="flex items-center gap-1.5">
                              <span className="rounded-md border border-[rgba(217,180,91,.22)] bg-black/40 px-2.5 py-1 text-[11px] text-[var(--ink-1)]">
                                {s}
                              </span>
                              {i < mission.guide!.chain!.length - 1 && <span className="text-[12px] text-[#d9b45b]">›</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="mt-6">
                  <div className="eyebrow mb-2.5">Objectives</div>
                  {mission.objectives.map((o) => (
                    <div key={o.stepId} className="flex items-start gap-2.5 py-1.5">
                      <span className="mt-[3px] text-[12px]"
                            style={{ color: o.done ? "#7ddca4" : o.active ? "#d9b45b" : "var(--ink-4)" }}>
                        {o.done ? "✓" : o.active ? "◆" : "○"}
                      </span>
                      <span className="text-[13px] leading-snug"
                            style={{
                              color: o.done ? "var(--ink-4)" : o.active ? "var(--ink-1)" : "var(--ink-4)",
                              textDecoration: o.done ? "line-through" : undefined,
                            }}>
                        {o.label}
                      </span>
                    </div>
                  ))}
                </section>

                <section className="mt-6">
                  <div className="eyebrow mb-3">Characters</div>
                  <div className="flex flex-wrap gap-4">
                    {mission.cast.map((c) => (
                      <div key={c} className="flex flex-col items-center gap-1.5">
                        <div className="overflow-hidden rounded-lg"
                             style={{ border: `1px solid ${c === "arshiya" ? "rgba(224,97,107,.5)" : "rgba(217,180,91,.4)"}` }}>
                          <CharacterPortrait id={c} size={46} />
                        </div>
                        <span className="text-[10px] capitalize text-[var(--ink-3)]">{c}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="eyebrow mb-2.5">Rewards</div>
                  <div className="flex flex-col gap-2">
                    {mission.rewards.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <PixelIcon name={(REWARD_ICON[r.kind] ?? "star") as IconName} size={14} />
                        <span className="text-[12px] text-[var(--ink-1)]">{r.label}</span>
                        <span className="text-[10px] text-[var(--ink-4)]">{r.kind}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6 rounded-xl border border-[rgba(217,180,91,.18)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="eyebrow">Sacred flames</span>
                    <span className="text-[12px] font-semibold text-[#d9b45b]">{flames}/3</span>
                  </div>
                  <div className="flex gap-5">
                    {([["Stone", state.flags.flameMountain], ["Petals", state.flags.flameGarden], ["Echoes", state.flags.flameCave]] as const).map(
                      ([name, got]) => (
                        <div key={name} className="flex items-center gap-2" style={{ opacity: got ? 1 : 0.32 }}>
                          <PixelIcon name="flame" size={14} />
                          <span className="text-[12px] text-[var(--ink-1)]">{name}</span>
                        </div>
                      )
                    )}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="eyebrow mb-2.5">World map</div>
                  <WorldMap targetRegion={mission.region} playerRegion={playerRegion} boss={!!mission.boss}
                            unlocked={new Set(missions.filter((m) => m.state !== "LOCKED").map((m) => m.region))} />
                  <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[var(--ink-4)]">
                    <span><span className="text-[#7ddca4]">●</span> You</span>
                    <span><span className="text-[#d9b45b]">◆</span> Mission</span>
                    <span><span className="text-[#e0616b]">⚔</span> Boss</span>
                    <span><span className="text-[var(--ink-4)]">🔒</span> Not yet open</span>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--ink-3)]">
                    Landmarks: {regionById(mission.region).landmark}
                  </p>
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
    <div className="mb-2.5 flex gap-3">
      <span className="w-[74px] shrink-0 text-[11px] uppercase tracking-wider text-[var(--ink-4)]">{label}</span>
      <span className="flex-1 text-[13px] leading-relaxed" style={{ color: accent ? "#f2dfa6" : "var(--ink-1)" }}>
        {value}
      </span>
    </div>
  );
}

function WorldMap({
  targetRegion, playerRegion, boss, unlocked,
}: {
  targetRegion: string; playerRegion: string; boss: boolean; unlocked: Set<string>;
}) {
  const target = regionById(targetRegion as never);
  return (
    <div className="relative h-[190px] w-full overflow-hidden rounded-xl border border-[rgba(217,180,91,.18)]"
         style={{ background: "radial-gradient(ellipse at 50% 50%, #16211a 0%, #0c1210 70%)" }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {REGIONS.slice(0, -1).map((r, i) => {
          const n = REGIONS[i + 1];
          return (
            <line key={r.id} x1={r.x * 100} y1={r.y * 100} x2={n.x * 100} y2={n.y * 100}
                  stroke="rgba(217,180,91,.16)" strokeWidth={0.5} strokeDasharray="2 2.5" />
          );
        })}
      </svg>

      {REGIONS.map((r) => {
        const isTarget = r.id === targetRegion;
        const isPlayer = r.id === playerRegion;
        const locked = !unlocked.has(r.id) && !isPlayer;
        return (
          <div key={r.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
               style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}>
            <div className="flex flex-col items-center gap-1"
                 style={isTarget ? { animation: "sb-glow 1.6s ease-in-out infinite" } : undefined}>
              {isTarget && (
                <span className="absolute -top-4 text-[13px]" style={{ color: boss ? "#e0616b" : "#d9b45b" }}>
                  {boss ? "⚔" : "◆"}
                </span>
              )}
              <span style={{ opacity: locked ? 0.4 : 1, filter: locked ? "grayscale(1)" : undefined }}>
                <PixelIcon name={r.icon} size={isTarget ? 19 : 13} />
              </span>
              <span className="whitespace-nowrap text-[9px] font-medium"
                    style={{ color: isTarget ? "#f2dfa6" : isPlayer ? "#7ddca4" : "var(--ink-4)", opacity: locked ? 0.6 : 1 }}>
                {locked ? "🔒 " : ""}{r.name}
              </span>
              {isPlayer && <span className="text-[9px] text-[#7ddca4]">●</span>}
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-2 right-3 text-[10px] tracking-wider text-[var(--ink-4)]">{target.name}</div>
    </div>
  );
}
