// ---------------------------------------------------------------------------
// Settings: audio, dialogue, camera, display and accessibility. One row model
// drives mouse, keys and gamepad alike: up/down moves, left/right adjusts,
// Enter toggles or activates. Everything persists through setSettings (the
// save carries settings).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGameStore, type Settings } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel } from "./pixel/decor";
import { useDevice } from "../input/useDevice";
import { useUi } from "./uiState";

type Row =
  | { kind: "slider"; id: string; label: string; hint: string; get: (s: Settings) => number; set: (v: number) => void; format?: (v: number) => string }
  | { kind: "toggle"; id: string; label: string; hint: string; get: (s: Settings) => boolean; set: (v: boolean) => void }
  | { kind: "cycle"; id: string; label: string; hint: string; options: { value: string; label: string }[]; get: (s: Settings) => string; set: (v: string) => void }
  | { kind: "button"; id: string; label: string; hint?: string; primary?: boolean; run: () => void };

type Section = { title: string; rows: Row[] };

const QUALITY = [
  { value: "auto", label: "Auto" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" },
];

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const screen = useGameStore((s) => s.screen);
  const tier = useUi((s) => s.qualityTier);
  const device = useDevice();
  const [cursor, setCursor] = useState(0);

  const close = () => {
    questSfx.panelClose();
    if (onClose) onClose();
    else setOverlay(null);
  };

  const sections: Section[] = useMemo(() => [
    {
      title: "Audio",
      rows: [
        { kind: "slider", id: "music", label: "Music", hint: "The game's soundtrack, in rotation", get: (s) => s.musicVol, set: (v) => setSettings({ musicVol: v }) },
        { kind: "slider", id: "sfx", label: "Sound", hint: "Footsteps, hits and menus", get: (s) => s.sfxVol, set: (v) => setSettings({ sfxVol: v }) },
      ],
    },
    {
      title: "Dialogue and text",
      rows: [
        { kind: "slider", id: "text", label: "Text speed", hint: "How fast lines type out", get: (s) => s.textSpeed / 60, set: (v) => setSettings({ textSpeed: Math.max(4, Math.round(v * 60)) }), format: (v) => `${Math.max(4, Math.round(v * 60))} cps` },
        { kind: "toggle", id: "auto", label: "Auto-advance dialogue", hint: "Lines continue by themselves once typed out (A in a conversation)", get: (s) => !!s.autoDialogue, set: (v) => setSettings({ autoDialogue: v }) },
        { kind: "toggle", id: "large", label: "Larger text", hint: "Bigger dialogue, battle log and tracker type", get: (s) => !!s.largeText, set: (v) => setSettings({ largeText: v }) },
      ],
    },
    {
      title: "Camera",
      rows: [
        { kind: "slider", id: "look", label: "Camera speed", hint: "How fast the view turns with the mouse, stick or touch", get: (s) => (s.lookSens ?? 1) / 2, set: (v) => setSettings({ lookSens: Math.max(0.2, Math.round(v * 20) / 10) }), format: (v) => `${(Math.max(0.2, Math.round(v * 20) / 10)).toFixed(1)}x` },
        { kind: "toggle", id: "invert", label: "Invert camera Y", hint: "Push up to look down", get: (s) => !!s.invertY, set: (v) => setSettings({ invertY: v }) },
      ],
    },
    {
      title: "Display and comfort",
      rows: [
        {
          kind: "cycle", id: "quality", label: "Render quality",
          hint: tier > 0 && (settings.quality ?? "auto") === "auto"
            ? `Auto stepped down to ${tier === 1 ? "medium" : "low"} to hold the frame rate`
            : "Auto lowers detail by itself when a region runs slow",
          options: QUALITY, get: (s) => s.quality ?? "auto", set: (v) => setSettings({ quality: v as Settings["quality"] }),
        },
        { kind: "toggle", id: "motion", label: "Reduced motion", hint: "No petals, shakes or long transitions", get: (s) => s.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches), set: (v) => setSettings({ reducedMotion: v }) },
        { kind: "toggle", id: "fps", label: "Show frame rate", hint: "A small readout at the bottom of the screen", get: (s) => !!s.showFps, set: (v) => setSettings({ showFps: v }) },
        {
          kind: "cycle", id: "renderer", label: "World renderer", hint: "3D is the game. Classic keeps the original pixel-art view. Applies when you next resume play.",
          options: [{ value: "3d", label: "3D" }, { value: "classic", label: "Classic 2D" }], get: (s) => s.renderer ?? "3d", set: (v) => setSettings({ renderer: v as Settings["renderer"] }),
        },
      ],
    },
    {
      title: "Help",
      rows: [
        { kind: "button", id: "howto", label: "How to play", hint: "Controls per device and the basics", run: () => { if (screen === "playing") setOverlay(null); else onClose?.(); useUi.getState().setHowTo(true); } },
        { kind: "button", id: "close", label: "Close", primary: true, run: close },
      ],
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [setSettings, tier, settings.quality, screen]);

  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const ROWS = rows.length;

  const adjust = (row: Row, dir: 1 | -1 | 0, enter: boolean) => {
    const s = useGameStore.getState().settings;
    switch (row.kind) {
      case "slider": if (dir) row.set(Math.max(0, Math.min(1, Math.round((row.get(s) + dir * 0.1) * 100) / 100))); break;
      case "toggle": if (dir || enter) row.set(dir ? dir > 0 : !row.get(s)); break;
      case "cycle": {
        const i = row.options.findIndex((o) => o.value === row.get(s));
        const n = row.options.length;
        const next = dir ? (i + dir + n) % n : enter ? (i + 1) % n : i;
        row.set(row.options[next].value);
        break;
      }
      case "button": if (enter) { questSfx.confirm(); row.run(); return; } break;
    }
    questSfx.select();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setCursor((c) => (c + 1) % ROWS); questSfx.select(); return; }
      if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setCursor((c) => (c - 1 + ROWS) % ROWS); questSfx.select(); return; }
      const dir = ["ArrowRight", "d", "D"].includes(e.key) ? 1 : ["ArrowLeft", "a", "A"].includes(e.key) ? -1 : 0;
      const enter = ["Enter", " ", "e", "E"].includes(e.key);
      if (!dir && !enter) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      adjust(rows[cursor], dir, enter);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, rows]);

  // keep the focused row in view for keyboard / gamepad users
  useEffect(() => {
    document.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let idx = -1;

  return (
    <div className="panel-shell absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-md">
      <ScrollPanel title="Settings" subtitle="Audio, text, camera, display" onClose={close} className="flex max-h-full w-full max-w-[560px] flex-col">
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {sections.map((sec) => (
            <section key={sec.title} className="mb-6 last:mb-0">
              <div className="eyebrow mb-2.5">{sec.title}</div>
              <div className="flex flex-col gap-1">
                {sec.rows.map((row) => {
                  idx += 1;
                  const i = idx;
                  const on = i === cursor;
                  return (
                    <RowShell key={row.id} index={i} selected={on} onHover={() => setCursor(i)} button={row.kind === "button"}>
                      {row.kind === "slider" && (
                        <SliderRow row={row} value={row.get(settings)} />
                      )}
                      {row.kind === "toggle" && (
                        <ChoiceRow label={row.label} hint={row.hint}>
                          <button onClick={() => adjust(row, 0, true)} className={`btn min-w-[64px] px-3 py-1.5 text-[11px] ${row.get(settings) ? "btn-selected" : ""}`} aria-pressed={row.get(settings)}>
                            {row.get(settings) ? "ON" : "OFF"}
                          </button>
                        </ChoiceRow>
                      )}
                      {row.kind === "cycle" && (
                        <ChoiceRow label={row.label} hint={row.hint}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => adjust(row, -1, false)} className="btn px-2 py-1.5 text-[11px]" aria-label="Previous">‹</button>
                            <span className="min-w-[82px] text-center text-[12px] font-semibold text-[#f2dfa6]">{row.options.find((o) => o.value === row.get(settings))?.label}</span>
                            <button onClick={() => adjust(row, 1, false)} className="btn px-2 py-1.5 text-[11px]" aria-label="Next">›</button>
                          </div>
                        </ChoiceRow>
                      )}
                      {row.kind === "button" && (
                        <button onClick={() => { questSfx.confirm(); row.run(); }} className={`btn ${row.primary ? "btn-primary" : ""} ${on ? "btn-selected" : ""} flex w-full items-center justify-between px-4 py-2.5 text-[13px]`}>
                          <span>{row.label}</span>
                          {row.hint && <span className="text-[10px] font-normal tracking-normal text-[var(--ink-3)]" style={{ fontFamily: "var(--font-body)" }}>{row.hint}</span>}
                        </button>
                      )}
                    </RowShell>
                  );
                })}
              </div>
            </section>
          ))}

          {device.kind !== "keyboard" && (
            <p className="mt-2 text-center text-[11px] text-[var(--ink-4)]">
              {device.kind === "gamepad" ? "D-pad moves · left/right adjusts · A toggles · B closes" : "Tap a row to change it"}
            </p>
          )}
        </div>
      </ScrollPanel>
    </div>
  );
}

function RowShell({ children, index, selected, onHover, button }: { children: ReactNode; index: number; selected: boolean; onHover: () => void; button?: boolean }) {
  return (
    <div
      data-row={index}
      onMouseEnter={onHover}
      className={`rounded-xl px-3 py-2.5 transition-colors ${button ? "" : selected ? "bg-white/[.045]" : ""}`}
      style={!button && selected ? { boxShadow: "inset 0 0 0 1px rgba(217,180,91,.45)" } : undefined}
    >
      {children}
    </div>
  );
}

function ChoiceRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="title-lg text-[13px] text-[#f2dfa6]">{label}</div>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-4)]">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SliderRow({ row, value }: { row: Extract<Row, { kind: "slider" }>; value: number }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="title-lg text-[13px] text-[#f2dfa6]">{row.label}</span>
        <span className="tabular-nums text-[12px] text-[var(--ink-2)]">{row.format ? row.format(value) : `${Math.round(value * 100)}%`}</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => row.set(parseFloat(e.target.value))} className="w-full" />
      <p className="mt-1 text-[11px] text-[var(--ink-4)]">{row.hint}</p>
    </label>
  );
}
