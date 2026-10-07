import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel, HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { useDevice, glyph } from "../input/useDevice";

export default function MenuPanel() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const save = useGameStore((s) => s.save);
  const reset = useGameStore((s) => s.reset);
  const party = useGameStore((s) => s.party);
  const lastAutosave = useGameStore((s) => s.lastAutosave);
  const device = useDevice();
  const [cursor, setCursor] = useState(4);

  const go = (fn: () => void) => { questSfx.confirm(); fn(); };

  const items: { label: string; hint?: string; primary?: boolean; run: () => void }[] = [
    { label: "Missions", hint: glyph("quests", device.kind), run: () => setOverlay({ kind: "quests" }) },
    { label: "Items", hint: glyph("items", device.kind), run: () => setOverlay({ kind: "inventory" }) },
    { label: "Settings", run: () => setOverlay({ kind: "settings" }) },
    { label: "Save game", hint: device.kind === "keyboard" ? "F5" : undefined, run: () => { save(); setOverlay(null); } },
    { label: "Resume", hint: glyph("cancel", device.kind), primary: true, run: () => setOverlay(null) },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c + 1) % items.length); questSfx.select(); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c - 1 + items.length) % items.length); questSfx.select(); }
      else if (["Enter", " ", "e", "E"].includes(e.key)) { e.preventDefault(); go(items[cursor].run); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  return (
    <div className="panel-shell absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <ScrollPanel title="Menu" onClose={() => { questSfx.panelClose(); setOverlay(null); }} className="w-full max-w-[480px]">
        <div className="p-6">
          <div className="mb-6 flex flex-col gap-2.5">
            {party.map((p) => (
              <div key={p.id} className="surface-raised flex items-center gap-3 px-3 py-2.5">
                <div className="overflow-hidden rounded-lg" style={{ border: "1px solid rgba(217,180,91,.35)" }}>
                  <CharacterPortrait id={p.portrait} size={34} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[var(--ink-1)]">{p.name}</span>
                  <HpBar hp={p.hp} max={p.maxHp} width={230} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {items.map((it, i) => (
              <Btn key={it.label} label={it.label} hint={it.hint} primary={it.primary} selected={i === cursor}
                   onHover={() => setCursor(i)} onClick={() => go(it.run)} />
            ))}

            <div className="mt-2 flex items-center justify-between border-t border-[rgba(217,180,91,.15)] pt-3">
              <button
                onClick={() => {
                  if (!confirm("Quit to the title screen? Your last save is kept.")) return;
                  go(() => {
                    save();
                    useGameStore.getState().setOverlay(null);
                    useGameStore.getState().setScreen("title");
                  });
                }}
                className="text-[11px] text-[var(--ink-3)] transition-colors hover:text-[#e0616b]"
              >
                Quit to title
              </button>
              <button
                onClick={() => {
                  if (!confirm("Erase the save and start over? This cannot be undone.")) return;
                  questSfx.denied();
                  reset();
                }}
                className="text-[11px] text-[var(--ink-4)] transition-colors hover:text-[#e0616b]"
              >
                Erase save data
              </button>
            </div>
          </div>

          {lastAutosave > 0 && (
            <p className="mt-4 text-center text-[11px] text-[var(--ink-4)]">
              Last saved {new Date(lastAutosave).toLocaleTimeString()}
            </p>
          )}
        </div>
      </ScrollPanel>
    </div>
  );
}

function Btn({
  label, hint, onClick, primary, selected, onHover,
}: {
  label: string; hint?: string; onClick: () => void; primary?: boolean; selected?: boolean; onHover?: () => void;
}) {
  return (
    <button onClick={onClick} onMouseEnter={onHover}
            className={`btn ${primary ? "btn-primary" : ""} ${selected ? "btn-selected" : ""} flex items-center justify-between px-5 py-3 text-[14px]`}>
      <span>{label}</span>
      {hint && (
        <kbd className="rounded border border-[rgba(217,180,91,.25)] bg-black/40 px-1.5 py-0.5 text-[10px] font-normal tracking-normal text-[var(--ink-3)]"
             style={{ fontFamily: "var(--font-body)" }}>
          {hint}
        </kbd>
      )}
    </button>
  );
}
