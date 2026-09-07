// ---------------------------------------------------------------------------
// Shared decorative primitives for the React overlay layer.
// ---------------------------------------------------------------------------

import { useMemo, type ReactNode } from "react";

export function ThemeKeyframes() {
  return (
    <style>{`
      @keyframes sb-fall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 0 } 10% { opacity: .9 } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0 } }
      @keyframes sb-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
      @keyframes sb-rise { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      @keyframes sb-pop { 0% { transform: scale(.86); opacity: 0 } 60% { transform: scale(1.04); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
      @keyframes sb-flash { 0%,100% { background: transparent } 50% { background: rgba(217,180,91,.35) } }
      @keyframes sb-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
      @keyframes sb-sweep { from { transform: translateX(-120%) } to { transform: translateX(320%) } }
      @keyframes sb-shake { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-3px,2px) } 50% { transform: translate(3px,-2px) } 75% { transform: translate(-2px,-1px) } }
      .sb-rise { animation: sb-rise .28s ease-out both }
      .sb-pop { animation: sb-pop .34s cubic-bezier(.2,1.4,.5,1) both }
      .sb-blink { animation: sb-blink 1s steps(2,end) infinite }
      .sb-shake { animation: sb-shake .28s steps(2,end) 2 }
    `}</style>
  );
}

export function Lantern({ size = 28, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 10 14" shapeRendering="crispEdges" aria-hidden
         style={{ animation: `sb-glow 2.2s ease-in-out ${delay}s infinite` }}>
      <rect x={4} y={0} width={2} height={2} fill="#d9b45b" />
      <rect x={1} y={2} width={8} height={7} fill="#8f1a24" />
      <rect x={2} y={3} width={6} height={5} fill="#b3252f" />
      <rect x={0} y={3} width={1} height={5} fill="#7c141f" />
      <rect x={9} y={3} width={1} height={5} fill="#7c141f" />
      <rect x={1} y={9} width={8} height={1} fill="#d9b45b" />
      <rect x={4} y={10} width={2} height={3} fill="#d9b45b" />
    </svg>
  );
}

export function Blossom({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      <rect x={3} y={0} width={2} height={2} fill="#e39cb2" />
      <rect x={3} y={6} width={2} height={2} fill="#e39cb2" />
      <rect x={0} y={3} width={2} height={2} fill="#e39cb2" />
      <rect x={6} y={3} width={2} height={2} fill="#e39cb2" />
      <rect x={2} y={2} width={4} height={4} fill="#f0bcd0" />
      <rect x={3} y={3} width={2} height={2} fill="#d9b45b" />
    </svg>
  );
}

export function PetalRain({ count = 18, opacity = 0.5 }: { count?: number; opacity?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${(i * 0.53) % 7}s`,
        dur: `${7 + ((i * 1.7) % 6)}s`,
        size: 8 + ((i * 3) % 6),
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity }} aria-hidden>
      {petals.map((p, i) => (
        <div key={i} className="absolute top-0" style={{ left: p.left, animation: `sb-fall ${p.dur} linear ${p.delay} infinite` }}>
          <Blossom size={p.size} />
        </div>
      ))}
    </div>
  );
}

export function ScrollPanel({
  children, className = "", title, onClose,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  onClose?: () => void;
}) {
  return (
    <div className={`panel pixel-border relative ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b-2 border-[#7c141f] bg-[#1a0f12] px-3 py-2">
          <span className="text-[10px] tracking-[0.2em] text-[#d9b45b]">{title}</span>
          {onClose && (
            <button onClick={onClose} className="text-[8px] text-[#f7e6c8] hover:text-[#d9b45b]">
              [ESC]
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function HpBar({ hp, max, width = 120, showText = true }: { hp: number; max: number; width?: number; showText?: boolean }) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const color = pct > 0.5 ? "#7ddca4" : pct > 0.22 ? "#d9b45b" : "#b3252f";
  return (
    <div className="flex items-center gap-2">
      <div className="relative border-2 border-[#0a0507] bg-[#1a0f12]" style={{ width, height: 8 }}>
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </div>
      {showText && (
        <span className="text-[7px] tabular-nums text-[#f7e6c8]">
          {Math.max(0, Math.round(hp))}/{max}
        </span>
      )}
    </div>
  );
}

export function GoldRule() {
  return <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-[#d9b45b] to-transparent opacity-60" />;
}
