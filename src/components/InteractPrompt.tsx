import { useEffect, useState } from "react";
import { bus } from "../game/bus";
import { useDevice, glyph } from "../input/useDevice";
import { useUi } from "./uiState";

const KIND_LABEL: Record<string, string> = {
  npc: "Someone", chest: "Chest", sign: "Sign", door: "Door", gate: "Gate", flame: "Sacred Flame",
  statue: "Statue", plate: "Pressure plate", scroll: "Scroll", lantern: "Lantern", portal: "Way out",
  brazier: "Brazier", dig: "Loose earth", hidden: "Something glints", item: "Item",
};

function kindLabel(kind: string): string {
  if (KIND_LABEL[kind]) return KIND_LABEL[kind];
  const k = kind.replace(/^npc_/, "").replace(/_/g, " ");
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/**
 * Contextual action prompt — never a bare "Interact" when we know better.
 * The world sends `prompt` (the verb) and, when it can, `near` (what it is):
 * the name plate shows the thing, the key shows what to do with it.
 */
export default function InteractPrompt() {
  const [label, setLabel] = useState("");
  const near = useUi((s) => s.near);
  const device = useDevice();

  useEffect(() => bus.on("prompt", (l: string) => setLabel(l || "")), []);

  if (!label && !near) return null;
  const name = near?.name || (near ? kindLabel(near.kind) : "");
  // avoid "Riddhi" above "Talk to Riddhi"
  const showName = !!name && !(label && label.toLowerCase().includes(name.toLowerCase()));

  // On touch the big round button IS the prompt; show only the label above it.
  if (device.kind === "touch") {
    if (!label) return null;
    return (
      <div className="pointer-events-none absolute bottom-[112px] right-4 z-30 sb-pop">
        <div className="surface px-3.5 py-2 text-right">
          {showName && <div className="eyebrow text-[9px] text-[#d9b45b]">{name}</div>}
          <div className="text-[13px] font-medium text-[var(--ink-1)]">{label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="interact-prompt-desktop pointer-events-none absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 sb-pop">
      {showName && (
        <div key={name} className="near-plate rounded-full border border-[rgba(217,180,91,.35)] bg-black/55 px-3 py-1 text-[10px] font-semibold tracking-[.16em] text-[#f2dfa6] uppercase backdrop-blur-sm ui-fade-in">
          {name}
        </div>
      )}
      {label && (
        <div className="surface flex items-center gap-2.5 px-4 py-2.5">
          <kbd
            className="rounded-md px-2 py-1 text-[11px] font-bold text-[#fdf6e6]"
            style={{ background: "linear-gradient(180deg,#a3202c,#7c141f)", border: "1px solid rgba(242,223,166,.5)" }}
          >
            {glyph("interact", device.kind)}
          </kbd>
          <span className="text-[13px] font-medium text-[var(--ink-1)]">{label}</span>
        </div>
      )}
    </div>
  );
}
