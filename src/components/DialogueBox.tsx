import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../game/sound";
import { CharacterPortrait } from "./pixel/Portrait";

export default function DialogueBox() {
  const overlay = useGameStore((s) => s.overlay);
  const advance = useGameStore((s) => s.advanceDialogue);
  const textSpeed = useGameStore((s) => s.settings.textSpeed);

  const line = overlay?.kind === "dialogue" ? overlay.lines[overlay.idx] : null;
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const raf = useRef<number | null>(null);

  // typewriter
  useEffect(() => {
    if (!line) return;
    setShown("");
    setDone(false);
    let i = 0;
    const msPerChar = Math.max(6, 1000 / Math.max(4, textSpeed));
    let last = performance.now();

    const tick = (now: number) => {
      if (now - last >= msPerChar) {
        last = now;
        i++;
        setShown(line.text.slice(0, i));
        if (i % 4 === 0 && line.text[i - 1] !== " ") sfx("step");
      }
      if (i < line.text.length) raf.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [line, textSpeed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!["Enter", " ", "e", "E", "z", "Z"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!done && line) {
        if (raf.current) cancelAnimationFrame(raf.current);
        setShown(line.text);
        setDone(true);
        return;
      }
      sfx("confirm");
      advance();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [done, line, advance]);

  if (!line || overlay?.kind !== "dialogue") return null;

  const last = overlay.idx === overlay.lines.length - 1;

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-5">
      {/* light pools under the box so it sits in the scene instead of on it */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52"
        style={{ background: "linear-gradient(to top, rgba(5,2,4,.92), transparent)" }}
      />

      <div
        className="surface sb-rise relative w-full max-w-[860px] cursor-pointer"
        onClick={() => {
          if (!done) {
            setShown(line.text);
            setDone(true);
          } else {
            sfx("confirm");
            advance();
          }
        }}
      >
        <div className="flex items-start gap-5 p-6">
          {line.portrait && (
            <div className="shrink-0">
              <div
                className="overflow-hidden rounded-xl"
                style={{
                  border: "1px solid rgba(217,180,91,.45)",
                  boxShadow: "0 12px 30px -10px rgba(0,0,0,.9), 0 0 26px -6px rgba(179,37,47,.45)",
                }}
              >
                <CharacterPortrait id={line.portrait} size={84} />
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="title-lg text-[16px] text-[#f2dfa6] glow-gold">{line.who}</span>
              <span className="h-px flex-1 bg-gradient-to-r from-[rgba(217,180,91,.45)] to-transparent" />
            </div>

            <p className="min-h-[62px] text-[15px] leading-[1.75] text-[var(--ink-1)]">
              {shown}
              {!done && <span className="sb-blink ml-0.5 text-[#d9b45b]">▍</span>}
            </p>
          </div>
        </div>

        {done && (
          <div className="absolute bottom-3 right-5 flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
            <span>{last ? "Close" : "Continue"}</span>
            <span className="sb-blink text-[#d9b45b]">▼</span>
          </div>
        )}
      </div>
    </div>
  );
}
