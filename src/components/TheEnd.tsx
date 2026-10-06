// ---------------------------------------------------------------------------
// THE END. Shown once, after the final hug has faded to black. It holds, then
// hands over to the credits. Nothing returns to the world from here.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";

export default function TheEnd() {
  const setScreen = useGameStore((s) => s.setScreen);
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 1400);
    const t2 = window.setTimeout(() => setStage(2), 7200);
    const t3 = window.setTimeout(() => setScreen("credits"), 8400);
    const skip = (e: KeyboardEvent) => {
      if (["Enter", " ", "Escape", "e", "E"].includes(e.key)) setScreen("credits");
    };
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("keydown", skip);
    };
  }, [setScreen]);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center bg-[#000]"
      onClick={() => setScreen("credits")}
    >
      <div
        className="flex flex-col items-center transition-opacity duration-[1600ms]"
        style={{ opacity: stage === 1 ? 1 : 0 }}
      >
        <div className="h-px w-40" style={{ background: "linear-gradient(90deg,transparent,rgba(217,180,91,.7),transparent)" }} />
        <h1 className="title-lg my-8 text-[44px] tracking-[.42em] text-[#f2dfa6] glow-gold sm:text-[64px]">
          THE END
        </h1>
        <div className="h-px w-40" style={{ background: "linear-gradient(90deg,transparent,rgba(217,180,91,.7),transparent)" }} />
      </div>
    </div>
  );
}
