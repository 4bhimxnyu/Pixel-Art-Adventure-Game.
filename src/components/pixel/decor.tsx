// ---------------------------------------------------------------------------
// Shared UI primitives for the overlay layer.
//
// The world is pixel art; this layer is a designed interface sitting on top of
// it — real type, depth and soft light rather than hard 2px boxes.
// ---------------------------------------------------------------------------

import { useMemo, type ReactNode } from "react";

export function ThemeKeyframes() {
  return (
    <style>{`
      @keyframes sb-fall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 0 } 10% { opacity: .85 } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0 } }
      @keyframes sb-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
      @keyframes sb-rise { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      @keyframes sb-pop { 0% { transform: scale(.94); opacity: 0 } 60% { transform: scale(1.01); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
      @keyframes sb-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
      @keyframes sb-sweep { from { transform: translateX(-140%) } to { transform: translateX(360%) } }
      @keyframes sb-shake { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-4px,2px) } 50% { transform: translate(4px,-2px) } 75% { transform: translate(-2px,-1px) } }
      @keyframes sb-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
      .sb-rise { animation: sb-rise .34s cubic-bezier(.2,.8,.3,1) both }
      .sb-pop { animation: sb-pop .4s cubic-bezier(.2,1.1,.4,1) both }
      .sb-blink { animation: sb-blink 1.1s ease-in-out infinite }
      .sb-shake { animation: sb-shake .3s ease-in-out 2 }
      .sb-float { animation: sb-float 4s ease-in-out infinite }
    `}</style>
  );
}

export function Lantern({ size = 28, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <div style={{ animation: `sb-float 5s ease-in-out ${delay}s infinite` }}>
      <svg width={size} height={size * 1.5} viewBox="0 0 20 30" aria-hidden
           style={{ filter: "drop-shadow(0 0 14px rgba(179,37,47,.65))" }}>
        <defs>
          <radialGradient id={`lg${delay}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffd98a" />
            <stop offset="55%" stopColor="#b3252f" />
            <stop offset="100%" stopColor="#6d1119" />
          </radialGradient>
        </defs>
        <path d="M9 0h2v4H9z" fill="#d9b45b" />
        <ellipse cx="10" cy="13" rx="9" ry="9.5" fill={`url(#lg${delay})`} />
        <ellipse cx="10" cy="13" rx="9" ry="9.5" fill="none" stroke="rgba(242,223,166,.5)" strokeWidth=".7" />
        <path d="M2 13h16" stroke="rgba(0,0,0,.25)" strokeWidth=".6" />
        <rect x="7" y="21.5" width="6" height="2" rx="1" fill="#d9b45b" />
        <path d="M10 23.5v5" stroke="#d9b45b" strokeWidth="1.2" />
        <circle cx="10" cy="29" r="1.1" fill="#f2dfa6" />
      </svg>
    </div>
  );
}

export function Blossom({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="6" cy="2.6" rx="1.9" ry="2.6" fill="#e39cb2"
                 transform={`rotate(${a} 6 6)`} opacity={0.92} />
      ))}
      <circle cx="6" cy="6" r="1.3" fill="#f2dfa6" />
    </svg>
  );
}

export function PetalRain({ count = 18, opacity = 0.5 }: { count?: number; opacity?: number }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${(i * 0.53) % 7}s`,
        dur: `${8 + ((i * 1.7) % 7)}s`,
        size: 9 + ((i * 3) % 7),
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
  children, className = "", title, subtitle, onClose,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  return (
    <div className={`panel-sheet surface relative flex max-h-full flex-col overflow-hidden ${className}`}>
      {title && (
        <header className="gilded relative flex items-center justify-between border-b border-[rgba(217,180,91,.18)] px-5 py-3.5">
          <div>
            <h2 className="title-lg text-[15px] text-[#f2dfa6]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">{subtitle}</p>}
          </div>
          {onClose && (
            <button onClick={onClose}
                    className="btn px-3 py-1.5 text-[10px] tracking-[.18em]">
              ESC
            </button>
          )}
        </header>
      )}
      {children}
    </div>
  );
}

export function HpBar({
  hp, max, width = 120, showText = true, label,
}: {
  hp: number; max: number; width?: number; showText?: boolean; label?: string;
}) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const grad =
    pct > 0.5
      ? "linear-gradient(90deg,#4fae7a,#7ddca4)"
      : pct > 0.22
      ? "linear-gradient(90deg,#c79a3f,#f2dfa6)"
      : "linear-gradient(90deg,#8f1a24,#e0616b)";
  const glow = pct > 0.5 ? "rgba(125,220,164,.45)" : pct > 0.22 ? "rgba(217,180,91,.45)" : "rgba(179,37,47,.55)";

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative overflow-hidden rounded-full"
        style={{
          width, height: 7,
          background: "rgba(255,255,255,.07)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.7)",
        }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct * 100}%`, background: grad, boxShadow: `0 0 10px ${glow}` }}
        />
      </div>
      {showText && (
        <span className="tabular-nums text-[11px] font-medium text-[var(--ink-2)]">
          {label ? `${label} ` : ""}{Math.max(0, Math.round(hp))}<span className="text-[var(--ink-4)]">/{max}</span>
        </span>
      )}
    </div>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`rule my-3 ${className}`} />;
}
