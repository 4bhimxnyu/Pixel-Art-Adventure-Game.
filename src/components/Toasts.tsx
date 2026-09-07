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
      window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3400);
    });
  }, []);

  const color = (tone: Toast["tone"]) =>
    tone === "good" ? "#7ddca4" : tone === "warn" ? "#b3252f" : "#d9b45b";

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="sb-rise max-w-[280px] border-2 bg-[#0a0507]/94 px-3 py-2 text-[7px] leading-[1.8] tracking-wider"
          style={{ borderColor: color(t.tone), color: color(t.tone) }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
