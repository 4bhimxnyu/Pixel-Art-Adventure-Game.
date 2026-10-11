// ---------------------------------------------------------------------------
// Dialogue: a visual-novel style box. The speaker's portrait slides in on the
// left and bobs while the line types out; whoever spoke last sits dimmed on the
// right. First press completes the line, second advances. Auto (A / X button /
// tap) advances by itself; Skip (hold Esc or X, double-tap B, hold the button)
// runs the whole conversation to its end and fires its `onEnd` exactly once.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../game/sound";
import { CharacterPortrait } from "./pixel/Portrait";
import { useDevice, glyph } from "../input/useDevice";
import { useReducedMotion } from "./uiState";

const ADVANCE_KEYS = ["Enter", " ", "e", "E", "z", "Z"];
const AUTO_KEYS = ["a", "A", "i", "I"]; // keyboard A; gamepad X arrives as "i"
const SKIP_KEYS = ["Escape", "x", "X"]; // keyboard X / Esc; gamepad B arrives as Escape
const HOLD_MS = 650;

export default function DialogueBox() {
  const overlay = useGameStore((s) => s.overlay);
  const advance = useGameStore((s) => s.advanceDialogue);
  const textSpeed = useGameStore((s) => s.settings.textSpeed);
  const auto = useGameStore((s) => !!s.settings.autoDialogue);
  const setSettings = useGameStore((s) => s.setSettings);
  const device = useDevice();
  const reduced = useReducedMotion();

  const lines = overlay?.kind === "dialogue" ? overlay.lines : null;
  const idx = overlay?.kind === "dialogue" ? overlay.idx : 0;
  const line = lines ? lines[idx] : null;

  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const lastSkipTap = useRef(0);

  // The other party: the most recent different portrait before this line, else the next one after.
  const other = useMemo(() => {
    if (!lines || !line) return null;
    for (let i = idx - 1; i >= 0; i--) {
      const p = lines[i].portrait;
      if (p && p !== line.portrait) return { portrait: p, who: lines[i].who };
    }
    for (let i = idx + 1; i < lines.length; i++) {
      const p = lines[i].portrait;
      if (p && p !== line.portrait) return { portrait: p, who: lines[i].who };
    }
    return null;
  }, [lines, line, idx]);

  // ------------------------------------------------------------ typewriter
  useEffect(() => {
    if (!line) return;
    setShown("");
    setDone(false);
    let i = 0;
    const msPerChar = Math.max(6, 1000 / Math.max(4, textSpeed));
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last >= msPerChar) {
        // catch up when a frame was slow so the pace stays even
        const n = Math.max(1, Math.floor((now - last) / msPerChar));
        last = now;
        i = Math.min(line.text.length, i + n);
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

  const complete = useCallback(() => {
    if (!line) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    setShown(line.text);
    setDone(true);
  }, [line]);

  const step = useCallback(() => {
    if (!done) complete();
    else {
      sfx("confirm");
      advance();
    }
  }, [done, complete, advance]);

  /** Run this conversation to its end. Stops if the end handler opened a new one. */
  const skipAll = useCallback(() => {
    const start = useGameStore.getState().overlay;
    if (start?.kind !== "dialogue") return;
    const ref = start.lines;
    sfx("cancel");
    for (let guard = 0; guard < 400; guard++) {
      const ov = useGameStore.getState().overlay;
      if (!ov || ov.kind !== "dialogue" || ov.lines !== ref) break;
      useGameStore.getState().advanceDialogue();
    }
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  }, []);

  const beginHold = useCallback(() => {
    if (holdTimer.current) return;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      skipAll();
    }, HOLD_MS);
  }, [skipAll]);

  // ------------------------------------------------------------ auto
  useEffect(() => {
    if (!auto || !done || !line) return;
    const wait = 650 + Math.min(2600, line.text.length * 26);
    const t = window.setTimeout(() => {
      sfx("confirm");
      advance();
    }, wait);
    return () => window.clearTimeout(t);
  }, [auto, done, line, advance]);

  // ------------------------------------------------------------ keys
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (ADVANCE_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        step();
        return;
      }
      if (AUTO_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        sfx("menu");
        setSettings({ autoDialogue: !useGameStore.getState().settings.autoDialogue });
        return;
      }
      if (SKIP_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (e.isTrusted) {
          // real keyboard: hold, keyup cancels
          beginHold();
        } else {
          // synthetic (gamepad B): there is no keyup, so a double tap skips
          const now = performance.now();
          if (now - lastSkipTap.current < 700) {
            lastSkipTap.current = 0;
            cancelHold();
            skipAll();
          } else {
            lastSkipTap.current = now;
            setHolding(true);
            window.setTimeout(() => setHolding(false), 700);
          }
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (SKIP_KEYS.includes(e.key)) cancelHold();
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, [step, setSettings, beginHold, cancelHold, skipAll]);

  useEffect(() => () => cancelHold(), [cancelHold]);

  if (!line || !lines) return null;

  const last = idx === lines.length - 1;
  const total = lines.length;
  const k = device.kind;
  const portraitKey = `${line.portrait ?? ""}:${line.who}`;

  return (
    <div className="dialogue-box absolute inset-x-0 bottom-0 z-50 flex justify-center p-5">
      {/* light pools under the box so it sits in the scene instead of on it */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
        style={{ background: "linear-gradient(to top, rgba(5,2,4,.94), rgba(5,2,4,.4) 60%, transparent)" }}
      />

      <div className="relative flex w-full max-w-[900px] items-end gap-4">
        {/* speaker */}
        {line.portrait && (
          <div key={portraitKey} className={`dialogue-portrait shrink-0 pb-2 ${reduced ? "" : "ui-in-left"}`}>
            <div className={done ? "" : "ui-talk"}>
              <div
                className="overflow-hidden rounded-2xl"
                style={{
                  border: "1px solid rgba(217,180,91,.55)",
                  boxShadow: "0 16px 36px -12px rgba(0,0,0,.95), 0 0 30px -8px rgba(179,37,47,.5)",
                }}
              >
                <CharacterPortrait id={line.portrait} size={96} />
              </div>
            </div>
          </div>
        )}

        <div
          className="surface sb-rise relative min-w-0 flex-1 cursor-pointer"
          onClick={step}
          role="button"
          aria-label={done ? (last ? "Close" : "Continue") : "Show the whole line"}
        >
          {/* name plate */}
          <div className="dialogue-nameplate absolute -top-[15px] left-5 flex items-center gap-2.5">
            {line.portrait && (
              <div className="dialogue-mini-portrait hidden overflow-hidden rounded-lg" style={{ border: "1px solid rgba(217,180,91,.5)" }}>
                <CharacterPortrait id={line.portrait} size={34} />
              </div>
            )}
            <div
              key={portraitKey}
              className={`surface-raised px-3.5 py-1 ${reduced ? "" : "ui-in-left"}`}
              style={{ borderColor: "rgba(217,180,91,.5)" }}
            >
              <span className="dialogue-name title-lg text-[14px] text-[#f2dfa6] glow-gold">{line.who}</span>
            </div>
          </div>

          <div className="dialogue-body px-6 pb-3 pt-6">
            <p className="dialogue-text min-h-[66px] text-[15.5px] leading-[1.75] text-[var(--ink-1)]">
              {shown}
              {!done && <span className="sb-blink ml-0.5 text-[#d9b45b]">▍</span>}
            </p>
          </div>

          {/* footer: counter, auto, skip, continue */}
          <div className="dialogue-footer flex items-center justify-between gap-3 border-t border-[rgba(217,180,91,.12)] px-5 py-2">
            <div className="flex items-center gap-3 text-[10px] text-[var(--ink-4)]">
              {total <= 14 ? (
                <span className="dialogue-dots" aria-label={`Line ${idx + 1} of ${total}`}>
                  {lines.map((_, i) => <i key={i} className={i === idx ? "on" : i < idx ? "past" : ""} />)}
                </span>
              ) : (
                <span className="tabular-nums">{idx + 1} / {total}</span>
              )}
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { sfx("menu"); setSettings({ autoDialogue: !auto }); }}
                className={`dialogue-chip ${auto ? "on" : ""}`}
                aria-pressed={auto}
                title="Auto-advance"
              >
                <span className={`chip-dot ${auto ? "sb-blink" : ""}`} />
                Auto
                {k === "keyboard" && <kbd>A</kbd>}
                {k === "gamepad" && <kbd>X</kbd>}
              </button>
              <button
                onPointerDown={(e) => { e.preventDefault(); beginHold(); }}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                className={`dialogue-chip ${holding ? "holding" : ""}`}
                title="Hold to skip this conversation"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" className="chip-ring" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(217,180,91,.25)" strokeWidth="3" />
                  {holding && (
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#f2dfa6" strokeWidth="3" pathLength={100}
                            strokeDasharray="100" style={{ animation: `ui-ring ${HOLD_MS}ms linear forwards`, transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
                  )}
                </svg>
                {k === "touch" ? "Hold to skip" : "Skip"}
                {k === "keyboard" && <kbd>hold X</kbd>}
                {k === "gamepad" && <kbd>B B</kbd>}
              </button>
              <span className="dialogue-continue ml-1 flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                {done ? (
                  <>
                    <span>{last ? "Close" : "Continue"}</span>
                    {k !== "touch" && <kbd className="rounded border border-[rgba(217,180,91,.3)] bg-black/40 px-1.5 py-0.5 text-[9px]">{glyph("interact", k)}</kbd>}
                    <span className="sb-blink text-[#d9b45b]">▼</span>
                  </>
                ) : (
                  <span className="opacity-60">{k === "touch" ? "tap" : glyph("interact", k)} · show all</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* the other party, dimmed */}
        {other && (
          <div className="dialogue-portrait dialogue-portrait-other shrink-0 pb-2">
            <div className="dialogue-portrait-dim overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(217,180,91,.3)" }}>
              <CharacterPortrait id={other.portrait} size={84} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
