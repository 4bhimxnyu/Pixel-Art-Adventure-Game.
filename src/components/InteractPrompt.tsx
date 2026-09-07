import { useEffect, useState } from "react";
import { bus } from "../game/bus";

/** Contextual action prompt — never a bare "Interact" when we know better. */
export default function InteractPrompt() {
  const [label, setLabel] = useState("");

  useEffect(() => bus.on("prompt", (l: string) => setLabel(l || "")), []);

  if (!label) return null;

  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 sb-pop">
      <div className="surface flex items-center gap-2.5 px-4 py-2.5">
        <kbd
          className="rounded-md px-2 py-1 text-[11px] font-bold text-[#fdf6e6]"
          style={{ background: "linear-gradient(180deg,#a3202c,#7c141f)", border: "1px solid rgba(242,223,166,.5)" }}
        >
          E
        </kbd>
        <span className="text-[13px] font-medium text-[var(--ink-1)]">{label}</span>
      </div>
    </div>
  );
}
