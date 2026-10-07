import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { initAudio, playBgm } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import SettingsPanel from "./SettingsPanel";
import { useDevice } from "../input/useDevice";

export default function TitleScreen() {
  const hasSave = useGameStore((s) => s.hasSave);
  const newGame = useGameStore((s) => s.newGame);
  const load = useGameStore((s) => s.load);
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [armed, setArmed] = useState(false);
  const device = useDevice();

  const options = [
    { label: hasSave ? "Continue" : "New Game", hint: hasSave ? "Pick up where you left off" : "Begin the birthday", action: () => (hasSave ? load() : newGame()) },
    ...(hasSave ? [{ label: "New Game", hint: "Start the adventure over", action: () => newGame() }] : []),
    { label: "Settings", hint: "Audio and text speed", action: () => setShowSettings(true) },
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
    if (showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "s", "S"].includes(e.key)) { setIdx((i) => (i + 1) % options.length); questSfx.select(); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { setIdx((i) => (i - 1 + options.length) % options.length); questSfx.select(); }
      else if (["Enter", "e", "E", "z", "Z", " "].includes(e.key)) { e.preventDefault(); questSfx.confirm(); options[idx].action(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, options, showSettings]);

  return (
    <div className="vignette relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0a0507]">
      <div className="pointer-events-none absolute inset-0"
           style={{ background: "radial-gradient(ellipse at 50% 32%, #34131c 0%, #14090d 45%, #0a0507 75%)" }} />
      <PetalRain count={20} opacity={0.35} />

      <div className="pointer-events-none absolute left-[10%] top-[14%] hidden md:block"><Lantern size={34} /></div>
      <div className="pointer-events-none absolute right-[11%] top-[20%] hidden md:block"><Lantern size={27} delay={1.1} /></div>
      <div className="pointer-events-none absolute left-[18%] bottom-[16%] hidden lg:block"><Lantern size={22} delay={2.2} /></div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="mb-8">
          <div
            className="overflow-hidden rounded-2xl p-1"
            style={{
              background: "linear-gradient(160deg, rgba(217,180,91,.5), rgba(124,20,31,.4))",
              boxShadow: "0 24px 60px -18px rgba(0,0,0,.95), 0 0 60px -12px rgba(179,37,47,.5)",
            }}
          >
            <div className="overflow-hidden rounded-xl bg-[#0a0507]">
              <CharacterPortrait id="palakshi" size={112} />
            </div>
          </div>
        </div>

        <h1 className="title-lg text-[40px] leading-none text-[#f2dfa6] glow-gold sm:text-[56px]">
          SHAOLIN BADDIE
        </h1>
        <div className="mt-4 flex items-center gap-4">
          <span className="h-px w-14 bg-gradient-to-r from-transparent to-[rgba(217,180,91,.6)]" />
          <p className="text-[12px] font-medium tracking-[.34em] text-[var(--ink-2)] uppercase">
            Palakshi&apos;s Birthday Adventure
          </p>
          <span className="h-px w-14 bg-gradient-to-l from-transparent to-[rgba(217,180,91,.6)]" />
        </div>

        <nav className="mt-12 flex w-[300px] flex-col gap-3">
          {options.map((o, i) => (
            <button
              key={o.label + i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => { questSfx.confirm(); o.action(); }}
              className={`btn ${i === idx ? "btn-primary" : ""} group px-6 py-3.5 text-left`}
            >
              <span className="flex items-center justify-between">
                <span className="text-[15px]">{o.label}</span>
                {i === idx && <span className="text-[13px] opacity-80">›</span>}
              </span>
              <span className="mt-0.5 block text-[11px] font-normal tracking-normal opacity-65"
                    style={{ fontFamily: "var(--font-body)" }}>
                {o.hint}
              </span>
            </button>
          ))}
        </nav>

        <p className="mt-12 text-[11px] tracking-wide text-[var(--ink-4)]">
          {device.kind === "gamepad"
            ? "Left stick moves · right stick looks · A interacts · Y missions"
            : device.kind === "touch"
            ? "Drag left to walk · drag right to look · the red button interacts"
            : "WASD to move · drag the mouse to look · E to interact · Q for missions"}
        </p>
        {!armed && (
          <p className="sb-blink mt-4 text-[11px] font-semibold tracking-[.3em] text-[#d9b45b]">
            {device.kind === "touch" ? "TAP TO BEGIN" : "PRESS ANY KEY"}
          </p>
        )}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
