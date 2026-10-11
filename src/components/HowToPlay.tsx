// ---------------------------------------------------------------------------
// "How to play": the controls per device and the four things worth knowing.
// Shown once on first launch (settings.howToSeen) and from the pause menu and
// the title screen after that. Tabs follow the device in use.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { useUi } from "./uiState";
import { useDevice } from "../input/useDevice";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel } from "./pixel/decor";
import { PixelIcon } from "./pixel/MissionIcons";

type Tab = "keyboard" | "gamepad" | "touch";
const TABS: { id: Tab; label: string }[] = [
  { id: "keyboard", label: "Keyboard" },
  { id: "gamepad", label: "Controller" },
  { id: "touch", label: "Touch" },
];

const CONTROLS: Record<Tab, [string, string][]> = {
  keyboard: [
    ["Move", "WASD / Arrows"], ["Look", "Drag the mouse · wheel zooms"], ["Interact / advance", "E · Enter · Space"],
    ["Dash", "Shift"], ["Mimo sniffs", "F"], ["Items", "I"], ["Journey", "Q"], ["Hint", "H"],
    ["Menu", "Esc"], ["Save", "F5"], ["Dialogue auto / skip", "A · hold X"], ["Reset position", "R"],
  ],
  gamepad: [
    ["Move", "Left stick / D-pad"], ["Look", "Right stick · triggers zoom"], ["Interact / advance", "A"],
    ["Dash", "B (hold)"], ["Mimo sniffs", "RB"], ["Items", "X"], ["Journey", "Y"], ["Hint", "LB"],
    ["Menu", "Start"], ["Back", "B"], ["Dialogue auto / skip", "X · B twice"], ["Reset position", "Select"],
  ],
  touch: [
    ["Move", "Drag on the left half"], ["Look", "Drag on the right half"], ["Interact / advance", "The big red button"],
    ["Dash", "↯"], ["Mimo sniffs", "🐾"], ["Items", "▣"], ["Journey", "◆"], ["Hint", "?"],
    ["Menu", "☰"], ["Dialogue auto / skip", "Auto · hold Skip"], ["Map", "Tap the minimap"],
  ],
};

const TIPS: { icon: Parameters<typeof PixelIcon>[0]["name"]; title: string; text: string }[] = [
  { icon: "paw", title: "Follow the tracker", text: "The card at the top right always shows the one thing to do next, and where. Press the hint key three times for a clearer and clearer nudge." },
  { icon: "sword", title: "Fights are turn-based", text: "Pick a move, use an item, or swap fighters. Bosses change moves as they weaken. Arshiya reads whoever stays in front of her: rotate." },
  { icon: "flame", title: "Gates open with the story", text: "Every region beyond the first opens when its chapter does. The minimap shows locked gates in red and the next objective in gold." },
  { icon: "seal", title: "It saves itself", text: "The game autosaves every half minute and whenever you change region. A tick at the top says so. F5 or the menu saves on demand." },
];

export default function HowToPlay({ onClose }: { onClose?: () => void }) {
  const device = useDevice();
  const [tab, setTab] = useState<Tab>(device.kind);
  const [cursor, setCursor] = useState(0);

  const close = () => {
    questSfx.panelClose();
    useGameStore.getState().setSettings({ howToSeen: true });
    useUi.getState().setHowTo(false);
    onClose?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ti = TABS.findIndex((t) => t.id === tab);
      if (["ArrowRight", "d", "D"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); setTab(TABS[(ti + 1) % TABS.length].id); questSfx.select(); }
      else if (["ArrowLeft", "a", "A"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); setTab(TABS[(ti - 1 + TABS.length) % TABS.length].id); questSfx.select(); }
      else if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); setCursor(1); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); setCursor(0); }
      else if (["Enter", " ", "e", "E", "Escape"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="panel-shell absolute inset-0 z-[80] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md">
      <ScrollPanel title="How to play" subtitle="Controls per device, and four things worth knowing" onClose={close} className="flex max-h-full w-full max-w-[760px] flex-col">
        <div className="flex shrink-0 gap-1 border-b border-[rgba(217,180,91,.15)] px-4 pt-3">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); questSfx.select(); }} className="relative px-4 py-2.5 text-[12px] font-medium transition-colors" style={{ color: on ? "#f2dfa6" : "var(--ink-3)" }}>
                {t.label}
                {on && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#d9b45b]" />}
              </button>
            );
          })}
          <span className="ml-auto self-center pr-2 text-[10px] text-[var(--ink-4)]">◂ ▸ switch</span>
        </div>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {CONTROLS[tab].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[rgba(217,180,91,.08)] py-1.5">
                <dt className="text-[12.5px] text-[var(--ink-1)]">{k}</dt>
                <dd className="text-right text-[11.5px] text-[var(--ink-3)]">{v}</dd>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TIPS.map((t) => (
              <div key={t.title} className="flex gap-3 rounded-xl border border-[rgba(217,180,91,.16)] bg-black/30 p-3.5">
                <span className="mt-0.5 shrink-0"><PixelIcon name={t.icon} size={18} /></span>
                <div>
                  <div className="title-lg text-[12px] text-[#f2dfa6]">{t.title}</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-2)]">{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-[rgba(217,180,91,.15)] p-4">
          <button onClick={close} onMouseEnter={() => setCursor(1)} className={`btn btn-primary w-full py-3 text-[14px] ${cursor === 1 ? "btn-selected" : ""}`}>
            Got it
          </button>
        </div>
      </ScrollPanel>
    </div>
  );
}
