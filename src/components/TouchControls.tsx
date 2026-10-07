// ---------------------------------------------------------------------------
// On-screen controls for phones and tablets: a floating joystick on the left
// half, camera drag on the right half, and a cluster of large action buttons.
// They write into the shared InputManager (world actions) or send synthetic
// keys (menus / dialogue / battle), so every existing panel works by touch.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { input, type Action } from "../input/InputManager";
import { useGameStore } from "../store/useGameStore";
import { bus } from "../game/bus";

const STICK_R = 54;

export default function TouchControls() {
  const overlay = useGameStore((s) => s.overlay);
  const party = useGameStore((s) => s.party);
  const hasMimo = party.some((p) => p.id === "mimo");
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [prompt, setPrompt] = useState("");

  useEffect(() => bus.on("prompt", (l: string) => setPrompt(l || "")), []);

  // A panel, dialogue or battle opening unmounts the touch surface, so a finger
  // that is still down never sends its pointerup. Drop the stick and the look
  // drag the moment that happens, or Palakshi would keep walking afterwards.
  useEffect(() => {
    if (!overlay) return;
    stickId.current = null;
    lookId.current = null;
    setStick(null);
    input.touch.move.x = 0;
    input.touch.move.y = 0;
    input.touch.look.x = 0;
    input.touch.look.y = 0;
    input.touch.lookActive = false;
  }, [overlay]);

  useEffect(() => {
    input.touch.active = true;
    return () => {
      input.touch.active = false;
      input.touch.move.x = 0;
      input.touch.move.y = 0;
      input.touch.lookActive = false;
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (overlay) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events have no capture */ }
    if (x < r.width * 0.5 && stickId.current === null) {
      stickId.current = e.pointerId;
      setStick({ ox: x, oy: y, x, y });
    } else if (lookId.current === null) {
      lookId.current = e.pointerId;
      lookLast.current = { x: e.clientX, y: e.clientY };
      input.touch.lookActive = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId === stickId.current) {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setStick((s) => {
        if (!s) return s;
        let dx = x - s.ox;
        let dy = y - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_R) {
          dx = (dx / len) * STICK_R;
          dy = (dy / len) * STICK_R;
        }
        input.touch.move.x = dx / STICK_R;
        input.touch.move.y = -dy / STICK_R;
        return { ...s, x: s.ox + dx, y: s.oy + dy };
      });
    } else if (e.pointerId === lookId.current) {
      input.touch.look.x += e.clientX - lookLast.current.x;
      input.touch.look.y += e.clientY - lookLast.current.y;
      lookLast.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId === stickId.current) {
      stickId.current = null;
      setStick(null);
      input.touch.move.x = 0;
      input.touch.move.y = 0;
    } else if (e.pointerId === lookId.current) {
      lookId.current = null;
      input.touch.lookActive = false;
    }
  };

  const act = (a: Action, key?: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (useGameStore.getState().overlay) {
      if (key) input.sendKey(key);
      return;
    }
    input.press(a);
  };

  // Panels, dialogue and the battle bar are tappable on their own; the
  // on-screen controls belong to the world only.
  if (overlay) return null;

  return (
    <div className="absolute inset-0 z-30 select-none" style={{ touchAction: "none" }}>
      {/* movement + look surface */}
      <div
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* joystick */}
      {stick && (
        <div className="pointer-events-none absolute" style={{ left: stick.ox - STICK_R, top: stick.oy - STICK_R, width: STICK_R * 2, height: STICK_R * 2 }}>
          <div className="absolute inset-0 rounded-full border border-[rgba(242,223,166,.35)] bg-black/25" />
          <div
            className="absolute h-12 w-12 rounded-full"
            style={{
              left: stick.x - stick.ox + STICK_R - 24,
              top: stick.y - stick.oy + STICK_R - 24,
              background: "radial-gradient(circle at 40% 35%, #f2dfa6, #b8902f)",
              boxShadow: "0 4px 14px rgba(0,0,0,.6)",
            }}
          />
        </div>
      )}
      {!stick && (
        <div className="pointer-events-none absolute bottom-[18%] left-[9%] text-[10px] tracking-[.2em] text-[rgba(242,223,166,.35)]">
          DRAG TO MOVE · RIGHT SIDE TO LOOK
        </div>
      )}

      {/* action cluster */}
      <div className="absolute bottom-5 right-4 flex flex-col items-end gap-2.5">
        <div className="flex gap-2.5">
          <TouchBtn label="☰" small onPress={(e) => { e.preventDefault(); useGameStore.getState().setOverlay({ kind: "menu" }); }} />
          <TouchBtn label="◆" small title="Missions" onPress={(e) => { e.preventDefault(); useGameStore.getState().setOverlay({ kind: "quests" }); }} />
          <TouchBtn label="▣" small title="Items" onPress={(e) => { e.preventDefault(); useGameStore.getState().setOverlay({ kind: "inventory" }); }} />
          <TouchBtn label="?" small title="Hint" onPress={(e) => { e.preventDefault(); bus.emit("hint:next"); }} />
        </div>
        <div className="flex items-end gap-3">
          {hasMimo && <TouchBtn label="🐾" title="Mimo sniffs" onPress={act("sniff")} />}
          <TouchBtn label="↯" title="Dash" onPress={act("dodge")} />
          <TouchBtn label="●" primary title={prompt || "Interact"} onPress={act("interact", "e")} />
        </div>
      </div>
    </div>
  );
}

function TouchBtn({
  label, onPress, primary, small, title,
}: {
  label: string;
  onPress: (e: React.PointerEvent) => void;
  primary?: boolean;
  small?: boolean;
  title?: string;
}) {
  const size = primary ? 74 : small ? 46 : 60;
  return (
    <button
      aria-label={title ?? label}
      onPointerDown={onPress}
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-center justify-center rounded-full border text-[#fdf6e6] active:scale-95"
      style={{
        width: size,
        height: size,
        fontSize: primary ? 24 : small ? 16 : 20,
        background: primary ? "linear-gradient(180deg,#a3202c,#6e1119)" : "rgba(20,10,14,.72)",
        borderColor: primary ? "rgba(242,223,166,.7)" : "rgba(217,180,91,.4)",
        boxShadow: "0 6px 18px rgba(0,0,0,.6)",
        backdropFilter: "blur(6px)",
        touchAction: "none",
      }}
    >
      {label}
    </button>
  );
}
