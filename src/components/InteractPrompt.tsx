import { useEffect, useState } from "react";
import { bus } from "../game/bus";
import { useDevice, glyph } from "../input/useDevice";

/** Contextual action prompt — never a bare "Interact" when we know better. */
export default function InteractPrompt() {
  const [label, setLabel] = useState("");
  const device = useDevice();

  useEffect(() => bus.on("prompt", (l: string) => setLabel(l || "")), []);

  if (!label) return null;
  // On touch the big round button IS the prompt; show only the label above it.
  if (device.kind === "touch") {
    return (
      <div className="pointer-events-none absolute bottom-[112px] right-4 z-30 sb-pop">
        <div className="surface px-3.5 py-2 text-[13px] font-medium text-[var(--ink-1)]">{label}</div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 sb-pop">
      <div className="surface flex items-center gap-2.5 px-4 py-2.5">
        <kbd
          className="rounded-md px-2 py-1 text-[11px] font-bold text-[#fdf6e6]"
          style={{ background: "linear-gradient(180deg,#a3202c,#7c141f)", border: "1px solid rgba(242,223,166,.5)" }}
        >
          {glyph("interact", device.kind)}
        </kbd>
        <span className="text-[13px] font-medium text-[var(--ink-1)]">{label}</span>
      </div>
    </div>
  );
}
