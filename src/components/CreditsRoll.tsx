import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";

const CREDITS: { head?: string; lines: string[] }[] = [
  { head: "SHAOLIN BADDIE", lines: ["Palakshi's Birthday Adventure"] },
  { head: "STARRING", lines: ["Palakshi — the Shaolin Baddie", "Mimo — Shih Tzu, unshakeable"] },
  { head: "WITH", lines: ["Abhimanyu and the white guitar", "Bidisha, who waited up", "Prakriti, rival and almost-friend", "Elder Shu of Lantern Village", "Prof. Kaajal, narrator"] },
  { head: "AND", lines: ["Arshiya — Style Academy"] },
  { head: "ART", lines: ["100% procedural pixel art", "Generated at runtime. No image files."] },
  { head: "MUSIC", lines: ["100% procedural WebAudio synthesis", "Sadeness-based foundation:", "Gregorian chant, shakuhachi, sub bass, half-time break", "Wuxia colour per region:", "guzheng · pipa · yangqin · erhu · dizi · xiao · sheng", "dagu · luo · bangzi · muyu"] },
  { head: "THE THREE SACRED FLAMES", lines: ["Stone · Petals · Echoes", "Returned to Lantern Village"] },
  { head: "", lines: ["Fifty-one years running."] },
];

export default function CreditsRoll() {
  const setScreen = useGameStore((s) => s.setScreen);
  const newGame = useGameStore((s) => s.newGame);
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowEnd(true), 26000);
    const skip = (e: KeyboardEvent) => {
      if (["Enter", " ", "Escape", "e", "E"].includes(e.key)) setShowEnd(true);
    };
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0507]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 60%, #2a0f16 0%, #0a0507 70%)" }}
      />
      <PetalRain count={26} opacity={0.55} />

      {!showEnd ? (
        <>
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-10 px-6 text-center"
            style={{ top: "100%", animation: "sb-credits 26s linear forwards" }}
          >
            <style>{`@keyframes sb-credits { from { transform: translateY(0) } to { transform: translateY(-260%) } }`}</style>
            {CREDITS.map((block, i) => (
              <div key={i}>
                {block.head && (
                  <div className="mb-3 text-[11px] tracking-[0.3em] text-[#d9b45b]">{block.head}</div>
                )}
                {block.lines.map((l, j) => (
                  <div key={j} className="text-[8px] leading-[2.4] tracking-wider text-[#f7e6c8]">
                    {l}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowEnd(true)}
            className="absolute bottom-4 right-5 text-[6px] tracking-[0.25em] text-[#5f5249] hover:text-[#d9b45b]"
          >
            PRESS ENTER TO SKIP
          </button>
        </>
      ) : (
        <div className="sb-pop relative flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex items-end gap-5">
            <Lantern size={30} />
            <div className="border-4 border-[#d9b45b] bg-[#0a0507] p-1 shadow-[0_0_44px_rgba(217,180,91,.3)]">
              <CharacterPortrait id="palakshi" size={96} />
            </div>
            <div className="border-4 border-[#d9b45b] bg-[#0a0507] p-1">
              <CharacterPortrait id="mimo" size={72} />
            </div>
            <Lantern size={30} delay={0.6} />
          </div>

          <h1
            className="text-[18px] leading-[1.8] tracking-[0.12em] text-[#d9b45b] sm:text-[24px]"
            style={{ textShadow: "0 0 22px rgba(179,37,47,.7), 3px 3px 0 #7c141f" }}
          >
            HAPPY BIRTHDAY,
            <br />
            PALAKSHI ❤
          </h1>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                questSfx.confirm();
                newGame();
              }}
              className="min-w-[190px] border-2 border-[#d9b45b] bg-[#7c141f] px-6 py-3 text-[9px] tracking-[0.25em] text-[#f2dfa6]"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={() => {
                questSfx.panelClose();
                setScreen("title");
              }}
              className="min-w-[190px] border-2 border-[#3a2229] bg-[#1a0f12] px-6 py-3 text-[9px] tracking-[0.25em] text-[#f7e6c8]"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
