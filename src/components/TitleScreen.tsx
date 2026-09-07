import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { initAudio, playBgm } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import SettingsPanel from "./SettingsPanel";

export default function TitleScreen() {
  const hasSave = useGameStore((s) => s.hasSave);
  const newGame = useGameStore((s) => s.newGame);
  const load = useGameStore((s) => s.load);
  const [idx, setIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [armed, setArmed] = useState(false);

  const options = [
    { label: hasSave ? "CONTINUE" : "NEW GAME", action: () => (hasSave ? load() : newGame()) },
    ...(hasSave ? [{ label: "NEW GAME", action: () => newGame() }] : []),
    { label: "SETTINGS", action: () => setShowSettings(true) },
  ];

  // Browsers block audio until the first gesture — arm on any input.
  useEffect(() => {
    const arm = () => {
      if (armed) return;
      setArmed(true);
      initAudio();
      playBgm("bgm_title", 1.4);
    };
    window.addEventListener("keydown", arm);
    window.addEventListener("pointerdown", arm);
    return () => {
      window.removeEventListener("keydown", arm);
      window.removeEventListener("pointerdown", arm);
    };
  }, [armed]);

  useEffect(() => {
    if (showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "s", "S"].includes(e.key)) {
        setIdx((i) => (i + 1) % options.length);
        questSfx.select();
      } else if (["ArrowUp", "w", "W"].includes(e.key)) {
        setIdx((i) => (i - 1 + options.length) % options.length);
        questSfx.select();
      } else if (["Enter", "e", "E", "z", "Z", " "].includes(e.key)) {
        e.preventDefault();
        questSfx.confirm();
        options[idx].action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, options, showSettings]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0a0507]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #2a0f16 0%, #0a0507 68%)" }}
      />
      <PetalRain count={22} opacity={0.4} />

      <div className="pointer-events-none absolute left-[8%] top-[12%] hidden md:block">
        <Lantern size={38} />
      </div>
      <div className="pointer-events-none absolute right-[9%] top-[18%] hidden md:block">
        <Lantern size={30} delay={0.8} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <div className="mb-6 opacity-95" style={{ animation: "sb-glow 3.2s ease-in-out infinite" }}>
          <div className="border-4 border-[#d9b45b] bg-[#0a0507] p-1 shadow-[0_0_40px_rgba(217,180,91,.25)]">
            <CharacterPortrait id="palakshi" size={104} />
          </div>
        </div>

        <h1
          className="text-[20px] leading-[1.7] tracking-[0.12em] text-[#d9b45b] sm:text-[28px]"
          style={{ textShadow: "0 0 18px rgba(179,37,47,.7), 3px 3px 0 #7c141f" }}
        >
          SHAOLIN BADDIE
        </h1>
        <div className="mt-3 text-[9px] tracking-[0.4em] text-[#f7e6c8] opacity-80 sm:text-[11px]">
          PALAKSHI&apos;S BIRTHDAY ADVENTURE
        </div>
        <div className="mt-2 h-px w-56 bg-gradient-to-r from-transparent via-[#d9b45b] to-transparent" />

        <nav className="mt-10 flex flex-col items-center gap-4">
          {options.map((o, i) => (
            <button
              key={o.label}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                questSfx.confirm();
                o.action();
              }}
              className={`min-w-[220px] border-2 px-6 py-3 text-[10px] tracking-[0.25em] transition-all ${
                i === idx
                  ? "border-[#d9b45b] bg-[#7c141f] text-[#f2dfa6] shadow-[0_0_20px_rgba(217,180,91,.35)]"
                  : "border-[#3a2229] bg-[#1a0f12] text-[#8a7a6a] hover:border-[#7c141f]"
              }`}
            >
              {i === idx && <span className="mr-2 text-[#d9b45b]">▶</span>}
              {o.label}
            </button>
          ))}
        </nav>

        <p className="mt-10 max-w-md text-[7px] leading-[2] tracking-wider text-[#6d5f57]">
          WASD / ARROWS MOVE · E INTERACT · Q MISSIONS · I ITEMS · H HINT · ESC MENU
        </p>
        {!armed && <p className="mt-3 text-[7px] tracking-[0.3em] text-[#d9b45b] sb-blink">PRESS ANY KEY</p>}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
