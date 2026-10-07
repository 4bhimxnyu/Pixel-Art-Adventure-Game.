import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel } from "./pixel/decor";
import { useDevice } from "../input/useDevice";

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const device = useDevice();
  const [cursor, setCursor] = useState(0);

  const close = () => {
    questSfx.panelClose();
    if (onClose) onClose();
    else setOverlay(null);
  };

  // rows: 0 music, 1 sound, 2 text speed, 3 camera speed, 4 invert, 5 renderer, 6 close
  const ROWS = 7;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = (v: number, d: number) => Math.max(0, Math.min(1, v + d));
      if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c + 1) % ROWS); questSfx.select(); return; }
      if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c - 1 + ROWS) % ROWS); questSfx.select(); return; }
      const dir = ["ArrowRight", "d", "D"].includes(e.key) ? 1 : ["ArrowLeft", "a", "A"].includes(e.key) ? -1 : 0;
      const enter = ["Enter", " ", "e", "E"].includes(e.key);
      if (!dir && !enter) return;
      e.preventDefault();
      const s = useGameStore.getState().settings;
      switch (cursor) {
        case 0: if (dir) setSettings({ musicVol: step(s.musicVol, dir * 0.1) }); break;
        case 1: if (dir) setSettings({ sfxVol: step(s.sfxVol, dir * 0.1) }); break;
        case 2: if (dir) setSettings({ textSpeed: Math.max(4, Math.min(60, s.textSpeed + dir * 6)) }); break;
        case 3: if (dir) setSettings({ lookSens: Math.max(0.2, Math.min(2, (s.lookSens ?? 1) + dir * 0.2)) }); break;
        case 4: setSettings({ invertY: !s.invertY }); break;
        case 5: setSettings({ renderer: (s.renderer ?? "3d") === "3d" ? "classic" : "3d" }); break;
        case 6: if (enter) close(); break;
      }
      questSfx.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);
  const sel = (i: number) => (i === cursor ? { outline: "1px solid rgba(217,180,91,.55)", outlineOffset: 6, borderRadius: 8 } : undefined);

  return (
    <div className="panel-shell absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <ScrollPanel title="Settings" subtitle="Audio and pacing" onClose={close} className="w-full max-w-[520px]">
        <div className="flex flex-col gap-7 p-6">
          <div style={sel(0)} onMouseEnter={() => setCursor(0)}>
          <Slider label="Music" value={settings.musicVol} onChange={(v) => setSettings({ musicVol: v })}
                  hint="Sadeness-based score, Wuxia colour per region" />
          </div>
          <div style={sel(1)} onMouseEnter={() => setCursor(1)}>
          <Slider label="Sound" value={settings.sfxVol} onChange={(v) => setSettings({ sfxVol: v })}
                  hint="Footsteps, hits and menus" />
          </div>
          <div style={sel(2)} onMouseEnter={() => setCursor(2)}>
          <Slider label="Text speed" value={settings.textSpeed / 60}
                  onChange={(v) => setSettings({ textSpeed: Math.max(4, Math.round(v * 60)) })}
                  hint={`${settings.textSpeed} characters per second`} />
          </div>
          <div style={sel(3)} onMouseEnter={() => setCursor(3)}>
          <Slider label="Camera speed" value={(settings.lookSens ?? 1) / 2}
                  onChange={(v) => setSettings({ lookSens: Math.max(0.2, v * 2) })}
                  hint="How fast the camera turns with the mouse, stick or touch" />
          </div>

          <div className="flex items-center justify-between gap-4" style={sel(4)} onMouseEnter={() => setCursor(4)}>
            <div>
              <div className="title-lg text-[14px] text-[#f2dfa6]">Invert camera Y</div>
              <p className="mt-1 text-[11px] text-[var(--ink-4)]">Push up to look down</p>
            </div>
            <button onClick={() => setSettings({ invertY: !settings.invertY })}
                    className={`btn px-4 py-2 text-[11px] ${settings.invertY ? "btn-selected" : ""}`}>
              {settings.invertY ? "ON" : "OFF"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4" style={sel(5)} onMouseEnter={() => setCursor(5)}>
            <div>
              <div className="title-lg text-[14px] text-[#f2dfa6]">World renderer</div>
              <p className="mt-1 text-[11px] text-[var(--ink-4)]">
                3D is the game. Classic keeps the original pixel-art view. Applies when you next resume play.
              </p>
            </div>
            <button onClick={() => setSettings({ renderer: (settings.renderer ?? "3d") === "3d" ? "classic" : "3d" })}
                    className="btn px-4 py-2 text-[11px]">
              {(settings.renderer ?? "3d") === "3d" ? "3D" : "CLASSIC 2D"}
            </button>
          </div>

          <div className="border-t border-[rgba(217,180,91,.15)] pt-5">
            <div className="eyebrow mb-3">Controls</div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                ["Move", "WASD / Arrows · L-stick"], ["Look", "Drag mouse · R-stick"],
                ["Interact", "E · Enter · A"], ["Dash", "Shift · B"],
                ["Mimo sniffs", "F · RB"], ["Items", "I · X"],
                ["Missions", "Q · Y"], ["Hint", "H · LB"],
                ["Menu", "Esc · Start"], ["Save", "F5"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12px] text-[var(--ink-2)]">{k}</dt>
                  <dd className="text-[11px] text-[var(--ink-4)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <button onClick={close} onMouseEnter={() => setCursor(6)} className={`btn btn-primary py-3 text-[14px] ${cursor === 6 ? "btn-selected" : ""}`}>Close</button>
          {device.kind !== "keyboard" && (
            <p className="-mt-3 text-center text-[11px] text-[var(--ink-4)]">
              {device.kind === "gamepad" ? "D-pad moves · left/right adjusts · A toggles · B closes" : "Tap a row to change it"}
            </p>
          )}
        </div>
      </ScrollPanel>
    </div>
  );
}

function Slider({
  label, value, onChange, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; hint: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="title-lg text-[14px] text-[#f2dfa6]">{label}</span>
        <span className="tabular-nums text-[12px] text-[var(--ink-2)]">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
      <p className="mt-1.5 text-[11px] text-[var(--ink-4)]">{hint}</p>
    </label>
  );
}
