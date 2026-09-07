import { useEffect, useState } from "react";
import { bus } from "../game/bus";

type Toast = { id: number; text: string; tone: "good" | "warn" | "info" };

export default function Toasts() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    return bus.on("toast", (p: { text: string; tone?: Toast["tone"] }) => {
      const t: Toast = { id: ++n, text: p.text, tone: p.tone ?? "info" };
      setItems((cur) => [...cur, t].slice(-4));
      window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4200);
    });
  }, []);

  const accent = (tone: Toast["tone"]) =>
    tone === "good" ? "#7ddca4" : tone === "warn" ? "#e0616b" : "#d9b45b";

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-40 flex flex-col items-end gap-2.5">
      {items.map((t) => (
        <div key={t.id} className="surface sb-rise flex max-w-[330px] items-start gap-3 px-4 py-3">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ background: accent(t.tone), boxShadow: `0 0 10px ${accent(t.tone)}` }}
          />
          <span className="text-[12px] leading-relaxed text-[var(--ink-1)]">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
