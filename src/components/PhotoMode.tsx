// ---------------------------------------------------------------------------
// Photo mode: every bit of HUD goes away, a thin frame and one line of
// instructions remain. The world is told through the bus (photo:mode on/off,
// world:snapshot to download the frame, camera:recenter). A Riddhi-style
// caption can sit in the corner ("mera photo le").
//
// Gamepad buttons are read here directly: with no overlay open the input
// layer would route them to world actions, and this screen is not a world.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { bus } from "../game/bus";
import { useGameStore } from "../store/useGameStore";
import { useUi } from "./uiState";
import { useDevice } from "../input/useDevice";
import { questSfx } from "../lib/questSfx";

const CAPTIONS = ["mera photo le", "ek aur. is baar smile.", "yeh wala frame kar", "pose maar na", "aesthetic hai bro"];

export default function PhotoMode() {
  const device = useDevice();
  const caption = useGameStore((s) => !!s.settings.photoCaption);
  const setSettings = useGameStore((s) => s.setSettings);
  const [flash, setFlash] = useState(0);
  const [saved, setSaved] = useState(0);
  const [line, setLine] = useState(0);
  const [hideUi, setHideUi] = useState(false);
  const pad = useRef<boolean[]>([]);

  const exit = () => {
    questSfx.panelClose();
    useUi.getState().setPhotoMode(false);
  };
  const snap = () => {
    setFlash(Date.now());
    setSaved(Date.now());
    questSfx.objective();
    bus.emit("world:snapshot");
  };
  const toggleCaption = () => {
    questSfx.select();
    setLine((l) => (l + 1) % CAPTIONS.length);
    setSettings({ photoCaption: !useGameStore.getState().settings.photoCaption });
  };
  const recenter = () => {
    questSfx.select();
    bus.emit("camera:recenter");
  };

  useEffect(() => {
    bus.emit("photo:mode", true);
    bus.emit("input:lock", true);
    return () => {
      bus.emit("photo:mode", false);
      bus.emit("input:lock", !!useGameStore.getState().overlay);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === "Escape" || k === "x" || k === "X") { e.preventDefault(); e.stopImmediatePropagation(); exit(); }
      else if (k === "s" || k === "S") { e.preventDefault(); e.stopImmediatePropagation(); snap(); }
      else if (k === "c" || k === "C") { e.preventDefault(); e.stopImmediatePropagation(); toggleCaption(); }
      else if (k === "r" || k === "R") { e.preventDefault(); e.stopImmediatePropagation(); recenter(); }
      else if (k === "h" || k === "H") { e.preventDefault(); e.stopImmediatePropagation(); setHideUi((v) => !v); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // gamepad: B exits, X saves, Y captions, RB recenters, LB hides the frame
  useEffect(() => {
    let raf = 0;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const gp = navigator.getGamepads?.()?.[0];
      if (!gp) return;
      gp.buttons.forEach((b, i) => {
        const was = pad.current[i] ?? false;
        pad.current[i] = b.pressed;
        if (!b.pressed || was) return;
        if (i === 1) exit();
        else if (i === 2) snap();
        else if (i === 3) toggleCaption();
        else if (i === 5) recenter();
        else if (i === 4) setHideUi((v) => !v);
      });
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const k = device.kind;
  const help =
    k === "gamepad"
      ? [["R-stick", "orbit"], ["LT / RT", "zoom"], ["X", "save"], ["Y", "caption"], ["RB", "recenter"], ["LB", "hide frame"], ["B", "exit"]]
      : k === "touch"
      ? [["Drag", "orbit"], ["Pinch", "zoom"]]
      : [["Drag", "orbit"], ["Scroll", "zoom"], ["S", "save"], ["C", "caption"], ["R", "recenter"], ["H", "hide frame"], ["Esc", "exit"]];

  return (
    <div className="photo-mode pointer-events-none absolute inset-0 z-[55]">
      {/* shutter flash */}
      {flash > 0 && <div key={flash} className="absolute inset-0 bg-white" style={{ animation: "sb-flash .35s ease-out forwards" }} />}
      <style>{`@keyframes sb-flash { from { opacity: .85 } to { opacity: 0 } }`}</style>

      {!hideUi && (
        <>
          {/* thin frame with gilded corners */}
          <div className="absolute inset-4 rounded-[14px] border border-[rgba(217,180,91,.28)]" />
          {(["lt", "rt", "lb", "rb"] as const).map((c) => (
            <svg key={c} width="34" height="34" viewBox="0 0 34 34" aria-hidden
                 className="absolute"
                 style={{
                   left: c.startsWith("l") ? 10 : undefined, right: c.startsWith("r") ? 10 : undefined,
                   top: c.endsWith("t") ? 10 : undefined, bottom: c.endsWith("b") ? 10 : undefined,
                   transform: `scale(${c.startsWith("r") ? -1 : 1}, ${c.endsWith("b") ? -1 : 1})`,
                 }}>
              <path d="M2 24V8a6 6 0 0 1 6-6h16" fill="none" stroke="#f2dfa6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ))}

          <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-[10px] font-semibold tracking-[.28em] text-[#f2dfa6] backdrop-blur-sm">
            PHOTO MODE
          </div>

          {/* instructions */}
          <div className="absolute inset-x-0 bottom-7 flex justify-center px-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-full bg-black/55 px-4 py-2 text-[10.5px] text-[var(--ink-2)] backdrop-blur-sm">
              {help.map(([key, v]) => (
                <span key={v} className="flex items-center gap-1.5">
                  <kbd className="rounded border border-[rgba(217,180,91,.3)] bg-black/50 px-1.5 py-0.5 text-[9px] text-[var(--ink-1)]">{key}</kbd>
                  {v}
                </span>
              ))}
            </div>
          </div>

          {saved > 0 && (
            <div key={saved} className="absolute left-1/2 top-14 -translate-x-1/2 text-[11px] font-semibold tracking-[.14em] text-[#7ddca4]" style={{ animation: "ui-tick 2s ease-out both" }}>
              FRAME SAVED
            </div>
          )}
        </>
      )}

      {caption && (
        <div className="absolute bottom-16 left-8 max-w-[70%] sm:bottom-20 sm:left-12">
          <div className="rotate-[-2deg] rounded-md bg-[#d9a52b] px-3 py-1.5 text-[18px] font-semibold tracking-tight text-[#1a0f12] shadow-[0_10px_24px_-10px_rgba(0,0,0,.9)] sm:text-[22px]"
               style={{ fontFamily: "var(--font-body)" }}>
            {CAPTIONS[line]}
          </div>
          <div className="mt-1.5 pl-1 text-[10px] tracking-[.2em] text-[rgba(242,223,166,.7)]">— RIDDHI</div>
        </div>
      )}

      {/* touch buttons */}
      {k === "touch" && (
        <div className="pointer-events-auto absolute bottom-20 right-4 flex flex-col items-end gap-2.5">
          <PhotoBtn label="Save" onPress={snap} primary />
          <PhotoBtn label={caption ? "Caption off" : "Caption"} onPress={toggleCaption} />
          <PhotoBtn label="Recenter" onPress={recenter} />
          <PhotoBtn label="Exit" onPress={exit} />
        </div>
      )}
    </div>
  );
}

function PhotoBtn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPress(); }}
      className={`btn ${primary ? "btn-primary" : ""} px-4 py-2 text-[11px]`}
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}
