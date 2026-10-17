// ---------------------------------------------------------------------------
// The credits: a slow roll of real photographs with words beside each one,
// then the birthday card. The pictures alternate sides: picture on the left,
// words on the right; a gap; picture on the right, words on the left; and so
// on down the roll. The pictures are "alive": each one breathes inside its
// frame (a slow zoom and drift), floats a little, its gold glow pulses and a
// soft light sweeps across it, every frame on its own rhythm. Pictures and
// words come from data/credits.ts.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { CREDIT_PHOTOS, CREDIT_TAIL } from "../data/credits";

/** Seconds the roll takes: a title, then every picture at a reading pace, then the tail. */
const ROLL_SECONDS = 10 + Math.max(1, CREDIT_PHOTOS.length) * 6.5;

const ALIVE_CSS = `
@keyframes sb-credits-roll { from { transform: translateY(0) } to { transform: translateY(calc(-100% - 100vh)) } }
@keyframes sb-alive-breathe { from { transform: scale(1.04) translate(0, 0) } to { transform: scale(1.18) translate(var(--dx), var(--dy)) } }
@keyframes sb-alive-float { 0%, 100% { transform: translateY(0) rotate(var(--tilt)) } 50% { transform: translateY(-8px) rotate(calc(var(--tilt) * -1)) } }
@keyframes sb-alive-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(217,180,91,.55), 0 22px 50px -14px rgba(0,0,0,.95), 0 0 26px -8px rgba(217,180,91,.35) }
  50% { box-shadow: 0 0 0 1px rgba(242,223,166,.85), 0 22px 50px -14px rgba(0,0,0,.95), 0 0 48px -4px rgba(217,180,91,.6) }
}
@keyframes sb-alive-sheen { from { transform: translateX(-160%) rotate(18deg) } to { transform: translateX(160%) rotate(18deg) } }
.sb-alive { position: relative; overflow: hidden; border-radius: 18px; background: #0a0507; flex: none; animation: sb-alive-float var(--float) ease-in-out infinite, sb-alive-glow var(--glow) ease-in-out infinite; animation-delay: var(--delay), var(--delay); }
.sb-alive > img, .sb-alive > .sb-alive-portrait { display: block; width: 100%; height: 100%; object-fit: cover; animation: sb-alive-breathe var(--breathe) ease-in-out infinite alternate; animation-delay: var(--delay); will-change: transform; }
.sb-alive > .sb-alive-portrait { display: flex; align-items: center; justify-content: center; }
.sb-alive::after { content: ""; position: absolute; inset: -40% -60%; background: linear-gradient(100deg, transparent 42%, rgba(255,245,220,.16) 50%, transparent 58%); animation: sb-alive-sheen var(--sheen) ease-in-out infinite; animation-delay: var(--delay); pointer-events: none; }
.sb-alive::before { content: ""; position: absolute; inset: 0; z-index: 1; border-radius: inherit; box-shadow: inset 0 0 40px rgba(10,5,7,.55); pointer-events: none; }
/* one row: picture and words side by side, the side alternating down the roll; stacked on a phone */
.sb-credit-row { display: flex; align-items: center; justify-content: center; gap: 36px; width: 100%; max-width: 960px; }
.sb-credit-row.right { flex-direction: row-reverse; }
.sb-credit-words { flex: 1 1 0; min-width: 0; max-width: 420px; text-align: left; }
.sb-credit-row.right .sb-credit-words { text-align: right; }
@media (max-width: 720px) {
  .sb-credit-row, .sb-credit-row.right { flex-direction: column; gap: 18px; }
  .sb-credit-words, .sb-credit-row.right .sb-credit-words { text-align: center; }
}
`;

/** The rhythm of one frame; i staggers it so no two pictures move together. */
function rhythm(i: number) {
  return {
    "--delay": `${-(i * 1.7)}s`,
    "--float": `${5.5 + (i % 3) * 0.8}s`,
    "--glow": `${4 + (i % 4) * 0.7}s`,
    "--breathe": `${9 + (i % 5) * 1.3}s`,
    "--sheen": `${11 + (i % 3) * 2}s`,
    "--dx": `${(i % 2 ? 1 : -1) * (3 + (i % 3))}%`,
    "--dy": `${(i % 3 ? -1 : 1) * 2.5}%`,
    "--tilt": `${(i % 2 ? 1 : -1) * 0.8}deg`,
  } as React.CSSProperties;
}

/** A photograph that breathes, floats and glows. The frame takes the picture's own shape. */
function AlivePhoto({ src, alt, i }: { src: string; alt: string; i: number }) {
  const [ratio, setRatio] = useState(0.8);
  const landscape = ratio > 1.05;
  return (
    <div
      className="sb-alive"
      style={{ ...rhythm(i), width: landscape ? "min(440px, 86vw)" : "min(300px, 72vw)", aspectRatio: ratio }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
        }}
      />
    </div>
  );
}

/** A drawn portrait in the same living frame (the birthday card). */
function AlivePortrait({ id, i, size }: { id: string; i: number; size: number }) {
  return (
    <div className="sb-alive" style={{ ...rhythm(i), width: size, height: Math.round(size * 1.22) }}>
      <div className="sb-alive-portrait">
        <CharacterPortrait id={id} size={Math.round(size * 0.78)} />
      </div>
    </div>
  );
}

export default function CreditsRoll() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowEnd(true), ROLL_SECONDS * 1000 + 400);
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
      <style>{ALIVE_CSS}</style>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 55%, #34131c 0%, #14090d 45%, #0a0507 78%)" }}
      />
      <PetalRain count={26} opacity={0.55} />

      {!showEnd ? (
        <>
          <div
            className="absolute inset-x-0 flex flex-col items-center gap-24 px-6 text-center"
            style={{ top: "100%", animation: `sb-credits-roll ${ROLL_SECONDS}s linear forwards` }}
          >
            <div>
              <div className="title-lg mb-3 text-[24px] tracking-[0.16em] text-[#f2dfa6] glow-gold">SHAOLIN BADDIE</div>
              <div className="text-[14px] leading-[2] text-[var(--ink-2)]">Palakshi's Birthday Adventure</div>
            </div>

            {CREDIT_PHOTOS.map((p, i) => (
              <div key={p.file} className={`sb-credit-row ${i % 2 ? "right" : "left"}`}>
                <AlivePhoto src={p.src} alt={p.title} i={i} />
                <div className="sb-credit-words">
                  <div className="title-lg text-[20px] leading-[1.4] tracking-[0.08em] text-[#f2dfa6] glow-gold">{p.title}</div>
                  {p.text && (
                    <div
                      className="mt-3 text-[15px] leading-[1.75] text-[var(--ink-2)]"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
                    >
                      {p.text}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {CREDIT_TAIL.map((block, i) => (
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
            <AlivePortrait id="palakshi" i={0} size={120} />
            <AlivePortrait id="mimo" i={1} size={84} />
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

          <p className="mt-6 text-[12px] tracking-[.3em] text-[var(--ink-3)]">GOODBYE, FOR NOW</p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                questSfx.panelClose();
                setScreen("title");
              }}
              className="btn btn-primary min-w-[210px] px-7 py-3.5 text-[15px]"
            >
              Main menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
