// ---------------------------------------------------------------------------
// Pause menu (Esc / Start): the active mission, playtime and party at a
// glance, then Resume / Journey / Items / Settings / How to play / Photo mode
// / Save / Quit. Quit and Erase confirm inline so a controller never meets a
// browser dialog. Fully navigable by keys and gamepad.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel, HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { PixelIcon } from "./pixel/MissionIcons";
import { useDevice, glyph } from "../input/useDevice";
import { currentObjective, missionGuide } from "../lib/missionMeta";
import { MAPS } from "../game/maps";
import { useUi, playtimeNow, formatPlaytime } from "./uiState";

type Item = { id: string; label: string; hint?: string; primary?: boolean; danger?: boolean; run: () => void };

export default function MenuPanel() {
  const state = useGameStore();
  const setOverlay = state.setOverlay;
  const save = state.save;
  const reset = state.reset;
  const party = state.party;
  const lastAutosave = state.lastAutosave;
  const device = useDevice();
  const [cursor, setCursor] = useState(0);
  const [confirm, setConfirm] = useState<null | "quit" | "erase">(null);
  const [confirmCursor, setConfirmCursor] = useState(1);
  const [savedAt, setSavedAt] = useState(0);
  const [clock, setClock] = useState(() => playtimeNow());

  const cur = currentObjective(state);
  const guide = missionGuide(state);

  useEffect(() => {
    const t = window.setInterval(() => setClock(playtimeNow()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const go = (fn: () => void) => { questSfx.confirm(); fn(); };

  const items: Item[] = [
    { id: "resume", label: "Resume", hint: device.kind === "keyboard" ? "Esc" : glyph("cancel", device.kind), primary: true, run: () => setOverlay(null) },
    { id: "journey", label: "Journey", hint: glyph("quests", device.kind), run: () => setOverlay({ kind: "quests" }) },
    { id: "items", label: "Items", hint: glyph("items", device.kind), run: () => setOverlay({ kind: "inventory" }) },
    { id: "settings", label: "Settings", run: () => setOverlay({ kind: "settings" }) },
    { id: "howto", label: "How to play", run: () => { setOverlay(null); useUi.getState().setHowTo(true); } },
    { id: "photo", label: "Photo mode", run: () => { setOverlay(null); useUi.getState().setPhotoMode(true); } },
    { id: "save", label: "Save game", hint: device.kind === "keyboard" ? "F5" : undefined, run: () => { useUi.getState().flushPlaytime(); save(); setSavedAt(Date.now()); } },
    { id: "quit", label: "Quit to title", danger: true, run: () => { setConfirm("quit"); setConfirmCursor(1); } },
  ];

  const doQuit = () => {
    useUi.getState().flushPlaytime();
    save();
    useGameStore.getState().setOverlay(null);
    useGameStore.getState().setScreen("title");
  };
  const doErase = () => {
    questSfx.denied();
    reset();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirm) {
        // stopImmediatePropagation: synthetic gamepad keys are dispatched on window itself,
        // where plain stopPropagation would not keep them from GameApp's Escape handler.
        if (["ArrowLeft", "a", "A", "ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setConfirmCursor(0); questSfx.select(); }
        else if (["ArrowRight", "d", "D", "ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setConfirmCursor(1); questSfx.select(); }
        else if (["Escape", "x", "X"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setConfirm(null); questSfx.panelClose(); }
        else if (["Enter", " ", "e", "E"].includes(e.key)) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (confirmCursor === 0) go(confirm === "quit" ? doQuit : doErase);
          else { setConfirm(null); questSfx.panelClose(); }
        }
        return;
      }
      if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c + 1) % items.length); questSfx.select(); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); setCursor((c) => (c - 1 + items.length) % items.length); questSfx.select(); }
      else if (["Enter", " ", "e", "E"].includes(e.key)) { e.preventDefault(); go(items[cursor].run); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, confirm, confirmCursor]);

  return (
    <div className="panel-shell absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-md">
      <ScrollPanel title="Paused" subtitle={`${MAPS[state.map].name} · ${formatPlaytime(clock)} played`} onClose={() => { questSfx.panelClose(); setOverlay(null); }} className="flex max-h-full w-full max-w-[860px] flex-col">
        <div className="pause-grid scroll-area grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-[1fr_300px]">
          {/* left: the state of things */}
          <div className="border-b border-[rgba(217,180,91,.15)] p-6 sm:border-b-0 sm:border-r">
            {cur && (
              <div className="rounded-xl border border-[rgba(217,180,91,.24)] bg-black/30 p-4">
                <div className="flex items-center gap-2.5">
                  <PixelIcon name={cur.mission.icon} size={16} />
                  <span className="eyebrow">Chapter {cur.mission.code ?? ""}</span>
                  <span className="title-lg ml-auto truncate text-[12px] text-[#f2dfa6]">{cur.mission.title}</span>
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <span className="mt-[2px] text-[11px] text-[#d9b45b]">◆</span>
                  <span className="text-[13.5px] font-medium leading-snug text-[var(--ink-1)]">{guide?.objective ?? cur.label}</span>
                </div>
                {guide && <p className="mt-1.5 pl-5 text-[11px] text-[var(--ink-3)]">{guide.place}</p>}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              {party.map((p) => (
                <div key={p.id} className="surface-raised flex items-center gap-3 px-3 py-2.5">
                  <div className="overflow-hidden rounded-lg" style={{ border: "1px solid rgba(217,180,91,.35)" }}>
                    <CharacterPortrait id={p.portrait} size={34} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--ink-1)]">{p.name}</span>
                    <HpBar hp={p.hp} max={p.maxHp} width={200} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-[var(--ink-3)]">
              <Fact label="Playtime" value={formatPlaytime(clock)} />
              <Fact label="Last saved" value={lastAutosave ? new Date(lastAutosave).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
            </div>
          </div>

          {/* right: actions */}
          <div className="flex flex-col gap-2 p-5">
            {items.map((it, i) => (
              <Btn key={it.id} label={it.label} hint={it.hint} primary={it.primary} danger={it.danger} selected={i === cursor && !confirm}
                   onHover={() => setCursor(i)} onClick={() => go(it.run)} />
            ))}
            {savedAt > 0 && (
              <p key={savedAt} className="text-center text-[11px] text-[#7ddca4]" style={{ animation: "ui-tick 2.4s ease-out both" }}>Saved.</p>
            )}
            <button
              onClick={() => { setConfirm("erase"); setConfirmCursor(1); }}
              className="mt-auto pt-2 text-[10.5px] text-[var(--ink-4)] transition-colors hover:text-[#e0616b]"
            >
              Erase save data
            </button>
          </div>
        </div>

        {confirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-5 ui-fade-in">
            <div className="surface sb-pop w-full max-w-[380px] p-6 text-center">
              <div className="title-lg text-[16px] text-[#f2dfa6]">{confirm === "quit" ? "Quit to the title screen?" : "Erase the save and start over?"}</div>
              <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                {confirm === "quit" ? "Your progress is saved first." : "This cannot be undone."}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button onClick={() => go(confirm === "quit" ? doQuit : doErase)} onMouseEnter={() => setConfirmCursor(0)}
                        className={`btn py-2.5 text-[12px] ${confirmCursor === 0 ? "btn-selected" : ""}`} style={{ borderColor: confirmCursor === 0 ? "rgba(224,97,107,.7)" : undefined }}>
                  {confirm === "quit" ? "Quit" : "Erase"}
                </button>
                <button onClick={() => { setConfirm(null); questSfx.panelClose(); }} onMouseEnter={() => setConfirmCursor(1)}
                        className={`btn btn-primary py-2.5 text-[12px] ${confirmCursor === 1 ? "btn-selected" : ""}`}>
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
      </ScrollPanel>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgba(217,180,91,.12)] bg-black/25 px-3 py-2">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="mt-0.5 text-[12px] tabular-nums text-[var(--ink-1)]">{value}</div>
    </div>
  );
}

function Btn({
  label, hint, onClick, primary, danger, selected, onHover,
}: {
  label: string; hint?: string; onClick: () => void; primary?: boolean; danger?: boolean; selected?: boolean; onHover?: () => void;
}) {
  return (
    <button onClick={onClick} onMouseEnter={onHover}
            className={`btn ${primary ? "btn-primary" : ""} ${selected ? "btn-selected" : ""} flex items-center justify-between px-4 py-2.5 text-[13px]`}
            style={danger && !selected ? { color: "var(--ink-3)" } : undefined}>
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
