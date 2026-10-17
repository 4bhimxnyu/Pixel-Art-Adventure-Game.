// ---------------------------------------------------------------------------
// The credits: a slow roll of everyone in the story, one picture each with a
// line underneath, then the birthday card. Pictures are "alive": each one
// breathes inside its frame (a slow zoom and drift), floats a little, and its
// gold glow pulses, with every frame on its own rhythm. A photo dropped in as
// public/credits/<id>.jpg|jpeg|png|webp replaces the drawn portrait
// (see data/credits.ts).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { PetalRain, Lantern } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { CREDIT_CAST, CREDIT_TAIL } from "../data/credits";

const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"];
/** Seconds the roll takes: a title, then every card at a reading pace, then the tail. */
const ROLL_SECONDS = 12 + CREDIT_CAST.length * 4.6;

/** Which cast members have a real photo under public/credits/. */
function useCreditPhotos() {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const found: Record<string, string> = {};
      await Promise.all(
        CREDIT_CAST.map(async (c) => {
          for (const ext of PHOTO_EXTS) {
            const f = `credits/${c.id}.${ext}`;
            try {
              const r = await fetch(f, { method: "HEAD" });
              // the SPA rewrite answers missing files with index.html, hence the type check
              if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) {
                found[c.id] = f;
                return;
              }
            } catch {
              /* keep looking */
            }
          }
        }),
      );
      if (alive) setPhotos(found);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return photos;
}

const ALIVE_CSS = `
@keyframes sb-credits-roll { from { transform: translateY(0) } to { transform: translateY(calc(-100% - 100vh)) } }
@keyframes sb-alive-breathe { from { transform: scale(1.04) translate(0, 0) } to { transform: scale(1.2) translate(var(--dx), var(--dy)) } }
@keyframes sb-alive-float { 0%, 100% { transform: translateY(0) rotate(var(--tilt)) } 50% { transform: translateY(-8px) rotate(calc(var(--tilt) * -1)) } }
@keyframes sb-alive-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(217,180,91,.55), 0 22px 50px -14px rgba(0,0,0,.95), 0 0 26px -8px rgba(217,180,91,.35) }
  50% { box-shadow: 0 0 0 1px rgba(242,223,166,.85), 0 22px 50px -14px rgba(0,0,0,.95), 0 0 48px -4px rgba(217,180,91,.6) }
}
@keyframes sb-alive-sheen { from { transform: translateX(-160%) rotate(18deg) } to { transform: translateX(160%) rotate(18deg) } }
.sb-alive { position: relative; overflow: hidden; border-radius: 18px; background: #0a0507; animation: sb-alive-float var(--float) ease-in-out infinite, sb-alive-glow var(--glow) ease-in-out infinite; animation-delay: var(--delay), var(--delay); }
.sb-alive > img, .sb-alive > .sb-alive-portrait { display: block; width: 100%; height: 100%; object-fit: cover; animation: sb-alive-breathe var(--breathe) ease-in-out infinite alternate; animation-delay: var(--delay); will-change: transform; }
.sb-alive > .sb-alive-portrait { display: flex; align-items: center; justify-content: center; }
.sb-alive::after { content: ""; position: absolute; inset: -40% -60%; background: linear-gradient(100deg, transparent 42%, rgba(255,245,220,.16) 50%, transparent 58%); animation: sb-alive-sheen var(--sheen) ease-in-out infinite; animation-delay: var(--delay); pointer-events: none; }
.sb-alive::before { content: ""; position: absolute; inset: 0; z-index: 1; border-radius: inherit; box-shadow: inset 0 0 40px rgba(10,5,7,.55); pointer-events: none; }
`;

/** One picture that breathes, floats and glows on its own rhythm (i staggers the rhythms). */
function AlivePicture({ src, portrait, name, i, size }: { src?: string; portrait: string; name: string; i: number; size: number }) {
  const style = {
    width: size,
    height: Math.round(size * 1.22),
    "--delay": `${-(i * 1.7)}s`,
    "--float": `${5.5 + (i % 3) * 0.8}s`,
    "--glow": `${4 + (i % 4) * 0.7}s`,
    "--breathe": `${9 + (i % 5) * 1.3}s`,
    "--sheen": `${11 + (i % 3) * 2}s`,
    "--dx": `${(i % 2 ? 1 : -1) * (3 + (i % 3))}%`,
    "--dy": `${(i % 3 ? -1 : 1) * 2.5}%`,
    "--tilt": `${(i % 2 ? 1 : -1) * 0.8}deg`,
  } as React.CSSProperties;
  return (
    <div className="sb-alive" style={style}>
      {src ? (
        <img src={src} alt={name} draggable={false} />
      ) : (
        <div className="sb-alive-portrait">
          <CharacterPortrait id={portrait} size={Math.round(size * 0.78)} />
        </div>
      )}
    </div>
  );
}

export default function CreditsRoll() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [showEnd, setShowEnd] = useState(false);
  const photos = useCreditPhotos();
  const cast = useMemo(() => CREDIT_CAST, []);

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
            className="absolute inset-x-0 flex flex-col items-center gap-12 px-6 text-center"
            style={{ top: "100%", animation: `sb-credits-roll ${ROLL_SECONDS}s linear forwards` }}
          >
            <div>
              <div className="title-lg mb-3 text-[24px] tracking-[0.16em] text-[#f2dfa6] glow-gold">SHAOLIN BADDIE</div>
              <div className="text-[14px] leading-[2] text-[var(--ink-2)]">Palakshi's Birthday Adventure</div>
            </div>

            {cast.map((c, i) => (
              <div key={c.id} className="flex flex-col items-center">
                <AlivePicture src={photos[c.id]} portrait={c.portrait ?? c.id} name={c.name} i={i} size={176} />
                <div className="title-lg mt-5 text-[19px] tracking-[0.12em] text-[#f2dfa6] glow-gold">{c.name}</div>
                <div className="mt-1 max-w-[300px] text-[13px] leading-[1.7] text-[var(--ink-2)]">{c.caption}</div>
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
            <AlivePicture src={photos.palakshi} portrait="palakshi" name="Palakshi" i={0} size={120} />
            <AlivePicture src={photos.mimo} portrait="mimo" name="Mimochi" i={1} size={84} />
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
