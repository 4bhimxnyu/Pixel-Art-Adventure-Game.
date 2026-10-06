import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel, HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";

export default function MenuPanel() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const save = useGameStore((s) => s.save);
  const reset = useGameStore((s) => s.reset);
  const party = useGameStore((s) => s.party);
  const lastAutosave = useGameStore((s) => s.lastAutosave);

  const go = (fn: () => void) => { questSfx.confirm(); fn(); };

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
            <Btn label="Missions" hint="Q" onClick={() => go(() => setOverlay({ kind: "quests" }))} />
            <Btn label="Items" hint="I" onClick={() => go(() => setOverlay({ kind: "inventory" }))} />
            <Btn label="Settings" onClick={() => go(() => setOverlay({ kind: "settings" }))} />
            <Btn label="Save game" hint="F5" onClick={() => go(() => { save(); setOverlay(null); })} />
            <Btn label="Resume" hint="Esc" primary onClick={() => go(() => setOverlay(null))} />

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
  label, hint, onClick, primary,
}: {
  label: string; hint?: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button onClick={onClick} className={`btn ${primary ? "btn-primary" : ""} flex items-center justify-between px-5 py-3 text-[14px]`}>
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
