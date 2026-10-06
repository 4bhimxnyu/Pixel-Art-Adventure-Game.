// ---------------------------------------------------------------------------
// Full-screen fade / flash driven by the bus so the 3D world never has to
// draw UI. `fade` { to: 0..1, ms } eases to black; `fade` { flash, ms, color }
// pops a colour and fades it out.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { bus } from "../game/bus";

export default function FadeOverlay() {
  const [black, setBlack] = useState({ to: 0, ms: 0 });
  const [flash, setFlash] = useState<{ color: string; ms: number; key: number } | null>(null);
  const n = useRef(0);

  useEffect(
    () =>
      bus.on("fade", (p: { to?: number; ms?: number; flash?: boolean; color?: string }) => {
        if (p.flash) {
          setFlash({ color: p.color ?? "rgba(255,255,255,.7)", ms: p.ms ?? 200, key: ++n.current });
          return;
        }
        setBlack({ to: p.to ?? 0, ms: p.ms ?? 300 });
      }),
    []
  );

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[70] bg-black"
        style={{ opacity: black.to, transition: `opacity ${black.ms}ms ease` }}
      />
      {flash && (
        <div
          key={flash.key}
          className="pointer-events-none absolute inset-0 z-[69]"
          style={{ background: flash.color, animation: `sb-flash ${flash.ms}ms ease-out forwards` }}
        />
      )}
      <style>{`@keyframes sb-flash { from { opacity: 1 } to { opacity: 0 } }`}</style>
    </>
  );
}
