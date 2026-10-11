// ---------------------------------------------------------------------------
// One toast stack for the whole game. Each tone has an icon; the same text
// arriving twice in a row refreshes the existing toast instead of stacking
// (locked gates used to pile four identical cards up). Reduced motion keeps
// the cards but cuts the slide.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { bus } from "../game/bus";

type Tone = "good" | "warn" | "info";
type Toast = { id: number; text: string; tone: Tone; until: number };

const LIFE = 4200;

const TONE = {
  good: { color: "#7ddca4", label: "Done" },
  warn: { color: "#e0616b", label: "Heads up" },
  info: { color: "#d9b45b", label: "Note" },
} as const;

function Icon({ tone }: { tone: Tone }) {
  const c = TONE[tone].color;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="6" fill="none" stroke={c} strokeWidth="1.2" opacity=".7" />
      {tone === "good" && <path d="M4 7.3l2 2L10 5" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      {tone === "warn" && <path d="M7 3.8v4M7 10.2v.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />}
      {tone === "info" && <path d="M7 6.2v4M7 3.8v.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    const off = bus.on("toast", (p: { text: string; tone?: Tone }) => {
      if (!p?.text) return;
      const tone = p.tone ?? "info";
      setItems((cur) => {
        const now = Date.now();
        const dup = cur.find((t) => t.text === p.text);
        if (dup) return cur.map((t) => (t === dup ? { ...t, until: now + LIFE } : t));
        return [...cur, { id: ++n, text: p.text, tone, until: now + LIFE }].slice(-4);
      });
    });
    const t = window.setInterval(() => {
      const now = Date.now();
      setItems((cur) => (cur.some((x) => x.until <= now) ? cur.filter((x) => x.until > now) : cur));
    }, 250);
    return () => { off(); window.clearInterval(t); };
  }, []);

  return (
    <div className="toasts pointer-events-none absolute bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {items.map((t) => (
        <div key={t.id} className="surface ui-in-right relative flex max-w-[340px] items-start gap-2.5 overflow-hidden px-3.5 py-2.5"
             style={{ borderColor: `${TONE[t.tone].color}44` }}>
          <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: TONE[t.tone].color, boxShadow: `0 0 10px ${TONE[t.tone].color}` }} />
          <span className="mt-[1px] shrink-0"><Icon tone={t.tone} /></span>
          <span className="toast-text text-[12px] leading-relaxed text-[var(--ink-1)]">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
