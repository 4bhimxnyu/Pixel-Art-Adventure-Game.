import { lazy, Suspense, useEffect, useState } from "react";

const GameApp = lazy(() => import("../components/GameApp"));

export function IndexPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.title = "Shaolin Baddie's Adventure — Palakshi's Birthday Quest";
    setMounted(true);
  }, []);

  if (!mounted) return <Booting />;

  return (
    <Suspense fallback={<Booting />}>
      <GameApp />
    </Suspense>
  );
}

function Booting() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0507]">
      <div className="animate-pulse text-[10px] tracking-widest text-[#d9b45b]">LOADING…</div>
    </div>
  );
}
