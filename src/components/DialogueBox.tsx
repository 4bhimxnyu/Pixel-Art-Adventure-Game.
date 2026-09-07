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
        if (i % 3 === 0 && line.text[i - 1] !== " ") sfx("step");
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
    <div
      className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-3"
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
      <div className="sb-rise relative w-full max-w-[720px] border-[3px] border-[#d9b45b] bg-[#0a0507]/96 shadow-[0_0_0_3px_#0a0507,0_0_30px_rgba(179,37,47,.35)]">
        {/* speaker plate */}
        <div className="absolute -top-4 left-5 border-2 border-[#d9b45b] bg-[#7c141f] px-3 py-1">
          <span className="text-[8px] tracking-[0.2em] text-[#f2dfa6]">{line.who.toUpperCase()}</span>
        </div>

        <div className="flex items-start gap-4 px-5 pb-5 pt-6">
          {line.portrait && (
            <div className="shrink-0 border-2 border-[#7c141f] bg-[#0a0507]">
              <CharacterPortrait id={line.portrait} size={64} />
            </div>
          )}
          <p className="min-h-[52px] flex-1 text-[9px] leading-[2.1] tracking-wide text-[#f7e6c8]">
            {shown}
            {!done && <span className="sb-blink text-[#d9b45b]">▌</span>}
          </p>
        </div>

        {done && (
          <div className="absolute bottom-2 right-4 text-[7px] tracking-[0.2em] text-[#d9b45b] sb-blink">
            {last ? "▼ CLOSE" : "▼ NEXT"}
          </div>
        )}
      </div>
    </div>
  );
}
