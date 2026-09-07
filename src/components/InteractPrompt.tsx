import { useEffect, useState } from "react";
import { bus } from "../game/bus";

/** Contextual action prompt — never a bare "Interact" when we know better. */
export default function InteractPrompt() {
  const [label, setLabel] = useState("");

  useEffect(() => bus.on("prompt", (l: string) => setLabel(l || "")), []);

  if (!label) return null;

  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 sb-pop">
      <div className="flex items-center gap-2 border-2 border-[#d9b45b] bg-[#0a0507]/92 px-3 py-1.5 shadow-[0_0_18px_rgba(217,180,91,.28)]">
        <kbd className="border border-[#d9b45b] bg-[#7c141f] px-1.5 py-0.5 text-[7px] text-[#f2dfa6]">E</kbd>
        <span className="text-[7px] tracking-[0.14em] text-[#f7e6c8]">{label}</span>
        <span className="text-[6px] text-[#5f5249]">/</span>
        <kbd className="border border-[#3a2229] px-1 py-0.5 text-[6px] text-[#8a7a6a]">A</kbd>
      </div>
    </div>
  );
}
