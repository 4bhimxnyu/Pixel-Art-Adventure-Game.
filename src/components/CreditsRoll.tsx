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
    <div className="vignette relative h-full w-full overflow-hidden bg-[#0a0507]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 55%, #34131c 0%, #14090d 45%, #0a0507 78%)" }}
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
                  <div className="title-lg mb-3 text-[20px] tracking-[0.16em] text-[#f2dfa6] glow-gold">{block.head}</div>
                )}
                {block.lines.map((l, j) => (
                  <div key={j} className="text-[14px] leading-[2] text-[var(--ink-2)]">
                    {l}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowEnd(true)}
            className="absolute bottom-5 right-6 text-[11px] text-[var(--ink-4)] transition-colors hover:text-[#d9b45b]"
          >
            Press Enter to skip
          </button>
        </>
      ) : (
        <div className="sb-pop relative flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-8 flex items-end gap-6">
            <Lantern size={30} />
            <div className="overflow-hidden rounded-2xl bg-[#0a0507] p-1" style={{ border: "1px solid rgba(217,180,91,.5)", boxShadow: "0 22px 60px -16px rgba(0,0,0,.95), 0 0 50px -10px rgba(179,37,47,.5)" }}>
              <CharacterPortrait id="palakshi" size={96} />
            </div>
            <div className="overflow-hidden rounded-xl bg-[#0a0507] p-1" style={{ border: "1px solid rgba(217,180,91,.4)" }}>
              <CharacterPortrait id="mimo" size={72} />
            </div>
            <Lantern size={30} delay={0.6} />
          </div>

          <h1
            className="title-lg text-[34px] leading-[1.5] text-[#f2dfa6] glow-gold sm:text-[44px]"
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
              className="btn btn-primary min-w-[210px] px-7 py-3.5 text-[15px]"
            >
              Play again
            </button>
            <button
              onClick={() => {
                questSfx.panelClose();
                setScreen("title");
              }}
              className="btn min-w-[210px] px-7 py-3.5 text-[15px]"
            >
              Main menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
