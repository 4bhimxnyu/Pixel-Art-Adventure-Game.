// ---------------------------------------------------------------------------
// Title: a living backdrop (slow petal drift, lantern glow, parallax on the
// mouse), the save slot card (chapter, place, playtime, party), and the menu:
// Continue / New Game / Settings / How to play / Credits. First launch shows
// the How-to sheet before the game starts.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore, SAVE_KEY, type GameState } from "../store/useGameStore";
import { initAudio, playBgm } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { PixelIcon } from "./pixel/MissionIcons";
import SettingsPanel from "./SettingsPanel";
import HowToPlay from "./HowToPlay";
import { useDevice } from "../input/useDevice";
import { buildMissions } from "../lib/missionMeta";
import { MAP_PLACE } from "../lib/guidance";
import { useUi, useReducedMotion, formatPlaytime } from "./uiState";
import type { MapId } from "../game/maps";

type Slot = {
  place: string;
  chapter: string;
  chapterCode: string;
  objectiveDone: boolean;
  playtime: string;
  savedAt: string;
  party: { id: string; portrait: string; name: string }[];
};

function readSlot(): Slot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { map: MapId; party: Slot["party"]; quests: GameState["quests"]; settings?: { playtimeMs?: number }; ts: number };
    const missions = buildMissions({ quests: p.quests } as GameState);
    const active = missions.find((m) => m.category === "main") ?? missions.find((m) => m.category === "discovered");
    const allDone = missions.filter((m) => m.code).every((m) => m.state === "COMPLETED");
    return {
      place: MAP_PLACE[p.map] ?? p.map,
      chapter: allDone ? "The End" : active?.title ?? "Find Mimo",
      chapterCode: allDone ? "✦" : active?.code ?? "1",
      objectiveDone: allDone,
      playtime: formatPlaytime(p.settings?.playtimeMs ?? 0),
      savedAt: new Date(p.ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      party: (p.party ?? []).map((f) => ({ id: f.id, portrait: f.portrait, name: f.name })),
    };
  } catch {
    return null;
  }
}

export default function TitleScreen() {
  const hasSave = useGameStore((s) => s.hasSave);
  const newGame = useGameStore((s) => s.newGame);
  const load = useGameStore((s) => s.load);
  const setScreen = useGameStore((s) => s.setScreen);
  const setSettings = useGameStore((s) => s.setSettings);
  const howToSeen = useGameStore((s) => !!s.settings.howToSeen);
  const howTo = useUi((s) => s.howTo);
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [armed, setArmed] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmCursor, setConfirmCursor] = useState(1);
  const pendingStart = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const device = useDevice();

  const slot = useMemo(() => (hasSave ? readSlot() : null), [hasSave]);

  const start = () => {
    setSettings({ playtimeMs: 0 });
    newGame();
  };
  const startNew = () => {
    if (!howToSeen) {
      pendingStart.current = true;
      useUi.getState().setHowTo(true);
      return;
    }
    start();
  };

  const options = [
    ...(hasSave ? [{ id: "continue", label: "Continue", hint: slot ? `${slot.chapter} · ${slot.place}` : "Pick up where you left off", action: () => load() }] : []),
    { id: "new", label: "New Game", hint: hasSave ? "Start the adventure over" : "Begin the birthday", action: () => (hasSave ? (setConfirmNew(true), setConfirmCursor(1)) : startNew()) },
    { id: "settings", label: "Settings", hint: "Audio, text, camera, display", action: () => setShowSettings(true) },
    { id: "howto", label: "How to play", hint: "Controls per device", action: () => useUi.getState().setHowTo(true) },
    { id: "credits", label: "Credits", hint: "Who made this, and for whom", action: () => setScreen("credits") },
  ];

  useEffect(() => {
    const arm = () => {
      if (armed) return;
      setArmed(true);
      initAudio();
      playBgm("bgm_title", 1.4);
    };
    window.addEventListener("keydown", arm);
    window.addEventListener("pointerdown", arm);
    return () => { window.removeEventListener("keydown", arm); window.removeEventListener("pointerdown", arm); };
  }, [armed]);

  useEffect(() => {
    if (showSettings || howTo) return;
    const onKey = (e: KeyboardEvent) => {
      if (confirmNew) {
        if (["ArrowLeft", "a", "A", "ArrowUp", "w", "W"].includes(e.key)) { setConfirmCursor(0); questSfx.select(); }
        else if (["ArrowRight", "d", "D", "ArrowDown", "s", "S"].includes(e.key)) { setConfirmCursor(1); questSfx.select(); }
        else if (["Escape", "x", "X"].includes(e.key)) { setConfirmNew(false); questSfx.panelClose(); }
        else if (["Enter", "e", "E", " "].includes(e.key)) { e.preventDefault(); if (confirmCursor === 0) { questSfx.confirm(); setConfirmNew(false); startNew(); } else { setConfirmNew(false); questSfx.panelClose(); } }
        return;
      }
      if (["ArrowDown", "s", "S"].includes(e.key)) { setIdx((i) => (i + 1) % options.length); questSfx.select(); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { setIdx((i) => (i - 1 + options.length) % options.length); questSfx.select(); }
      else if (["Enter", "e", "E", "z", "Z", " "].includes(e.key)) { e.preventDefault(); questSfx.confirm(); options[idx].action(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, options.length, showSettings, howTo, confirmNew, confirmCursor]);

  // parallax: the backdrop layers lean away from the pointer
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  return (
    <div ref={rootRef} className="title-screen vignette relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0a0507]">
      {/* backdrop layers */}
      <div className="title-layer pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 32%, #34131c 0%, #14090d 45%, #0a0507 75%)" }} />
      <div className="title-layer title-layer-far pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: "linear-gradient(to top, rgba(60,20,28,.55), transparent)" }} />
        <svg className="absolute bottom-0 left-0 h-[30%] w-full opacity-[.35]" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
          <path d="M0 30 L0 20 Q10 12 20 18 T40 14 T60 19 T80 12 T100 17 L100 30 Z" fill="#1a0b10" />
          <path d="M0 30 L0 25 Q12 19 24 24 T48 22 T72 26 T100 23 L100 30 Z" fill="#120609" />
        </svg>
      </div>
      <div className="title-layer title-layer-mid pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[14%] hidden md:block ui-lantern"><Lantern size={34} /></div>
        <div className="absolute right-[11%] top-[20%] hidden md:block ui-lantern" style={{ animationDelay: "1.3s" }}><Lantern size={27} delay={1.1} /></div>
        <div className="absolute left-[18%] bottom-[16%] hidden lg:block ui-lantern" style={{ animationDelay: "2.1s" }}><Lantern size={22} delay={2.2} /></div>
        <div className="absolute right-[20%] bottom-[22%] hidden lg:block ui-lantern" style={{ animationDelay: "0.6s" }}><Lantern size={18} delay={3.1} /></div>
      </div>
      <div className="title-layer title-layer-near pointer-events-none absolute inset-0">
        <PetalRain count={22} opacity={0.4} drift />
      </div>

      <div className="title-content relative z-10 flex w-full max-w-[920px] flex-col items-center px-6 text-center">
        <div className="title-portrait mb-6">
          <div
            className="overflow-hidden rounded-2xl p-1"
            style={{
              background: "linear-gradient(160deg, rgba(217,180,91,.5), rgba(124,20,31,.4))",
              boxShadow: "0 24px 60px -18px rgba(0,0,0,.95), 0 0 60px -12px rgba(179,37,47,.5)",
            }}
          >
            <div className="overflow-hidden rounded-xl bg-[#0a0507]">
              <CharacterPortrait id="palakshi" size={104} />
            </div>
          </div>
        </div>

        <h1 className="title-lg text-[38px] leading-none text-[#f2dfa6] glow-gold sm:text-[56px]">
          SHAOLIN BADDIE
        </h1>
        <div className="mt-4 flex items-center gap-4">
          <span className="h-px w-14 bg-gradient-to-r from-transparent to-[rgba(217,180,91,.6)]" />
          <p className="text-[11px] font-medium tracking-[.34em] text-[var(--ink-2)] uppercase sm:text-[12px]">
            Palakshi&apos;s Birthday Adventure
          </p>
          <span className="h-px w-14 bg-gradient-to-l from-transparent to-[rgba(217,180,91,.6)]" />
        </div>

        <div className={`title-grid mt-9 grid w-full gap-5 ${slot ? "sm:grid-cols-[320px_300px] sm:justify-center" : "justify-center"}`}>
          {slot && (
            <div className="surface sb-rise relative self-start overflow-hidden p-4 text-left">
              <div className="absolute inset-x-0 top-0 h-px ui-rule-grow" style={{ background: "linear-gradient(90deg, transparent, rgba(242,223,166,.8), transparent)" }} />
              <div className="flex items-center justify-between">
                <span className="eyebrow">Your journey</span>
                <span className="text-[10px] text-[var(--ink-4)]">{slot.savedAt}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(217,180,91,.4)] bg-black/40 text-[11px] font-bold text-[#f2dfa6]" style={{ fontFamily: "var(--font-display)" }}>{slot.chapterCode}</span>
                <div className="min-w-0">
                  <div className="title-lg truncate text-[14px] text-[#f2dfa6]">{slot.chapter}</div>
                  <div className="truncate text-[11px] text-[var(--ink-3)]">{slot.place}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {slot.party.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-lg" title={p.name} style={{ border: "1px solid rgba(217,180,91,.45)", boxShadow: "0 4px 10px -4px rgba(0,0,0,.9)" }}>
                      <CharacterPortrait id={p.portrait} size={30} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--ink-2)]">
                  <PixelIcon name="seal" size={11} />
                  {slot.playtime}
                </div>
              </div>
            </div>
          )}

          <nav className="flex w-full flex-col gap-2.5 sm:w-[300px]">
            {options.map((o, i) => (
              <button
                key={o.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { questSfx.confirm(); o.action(); }}
                className={`btn ${i === idx ? "btn-primary" : ""} group px-5 py-2.5 text-left`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-[14px]">{o.label}</span>
                  {i === idx && <span className="text-[13px] opacity-80">›</span>}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] font-normal tracking-normal opacity-65" style={{ fontFamily: "var(--font-body)" }}>
                  {o.hint}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-[11px] tracking-wide text-[var(--ink-4)]">
          {device.kind === "gamepad"
            ? "Left stick moves · right stick looks · A interacts · Y missions"
            : device.kind === "touch"
            ? "Drag left to walk · drag right to look · the red button interacts"
            : "WASD to move · arrows or mouse drag to look · E to interact · Q for missions"}
        </p>
        {!armed && (
          <p className="sb-blink mt-3 text-[11px] font-semibold tracking-[.3em] text-[#d9b45b]">
            {device.kind === "touch" ? "TAP TO BEGIN" : "PRESS ANY KEY"}
          </p>
        )}
      </div>

      {confirmNew && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-5 ui-fade-in backdrop-blur-sm">
          <div className="surface sb-pop w-full max-w-[380px] p-6 text-center">
            <div className="title-lg text-[16px] text-[#f2dfa6]">Start over?</div>
            <p className="mt-2 text-[12px] text-[var(--ink-3)]">A new game replaces the saved journey{slot ? ` (${slot.chapter}, ${slot.playtime})` : ""}.</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button onClick={() => { questSfx.confirm(); setConfirmNew(false); startNew(); }} onMouseEnter={() => setConfirmCursor(0)}
                      className={`btn py-2.5 text-[12px] ${confirmCursor === 0 ? "btn-selected" : ""}`} style={{ borderColor: confirmCursor === 0 ? "rgba(224,97,107,.7)" : undefined }}>
                Start over
              </button>
              <button onClick={() => { setConfirmNew(false); questSfx.panelClose(); }} onMouseEnter={() => setConfirmCursor(1)}
                      className={`btn btn-primary py-2.5 text-[12px] ${confirmCursor === 1 ? "btn-selected" : ""}`}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {howTo && (
        <HowToPlay
          onClose={() => {
            if (pendingStart.current) {
              pendingStart.current = false;
              start();
            }
          }}
        />
      )}
    </div>
  );
}
