import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { HpBar } from "./pixel/decor";

export default function MenuPanel() {
  const setOverlay = useGameStore((s) => s.setOverlay);
  const save = useGameStore((s) => s.save);
  const reset = useGameStore((s) => s.reset);
  const party = useGameStore((s) => s.party);
  const lastAutosave = useGameStore((s) => s.lastAutosave);

  const go = (fn: () => void) => {
    questSfx.confirm();
    fn();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0507]/85 p-4">
      <ScrollPanel title="MENU" onClose={() => { questSfx.panelClose(); setOverlay(null); }} className="w-full max-w-[420px]">
        <div className="p-4">
          <div className="mb-4 flex flex-col gap-2">
            {party.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-[#3a2229] px-2 py-1.5">
                <CharacterPortrait id={p.portrait} size={26} />
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[8px] text-[#f7e6c8]">{p.name}</span>
                  <HpBar hp={p.hp} max={p.maxHp} width={200} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Btn label="MISSIONS  [Q]" onClick={() => go(() => setOverlay({ kind: "quests" }))} />
            <Btn label="ITEMS  [I]" onClick={() => go(() => setOverlay({ kind: "inventory" }))} />
            <Btn label="SETTINGS" onClick={() => go(() => setOverlay({ kind: "settings" }))} />
            <Btn
              label="SAVE GAME  [F5]"
              onClick={() =>
                go(() => {
                  save();
                  setOverlay(null);
                })
              }
            />
            <Btn label="RESUME  [ESC]" onClick={() => go(() => setOverlay(null))} />
            <Btn
              label="QUIT TO TITLE"
              tone="danger"
              onClick={() => {
                if (!confirm("Quit to the title screen? Your last save is kept.")) return;
                go(() => {
                  save();
                  useGameStore.getState().setOverlay(null);
                  useGameStore.getState().setScreen("title");
                });
              }}
            />
            <button
              onClick={() => {
                if (!confirm("Erase the save and start over? This cannot be undone.")) return;
                questSfx.denied();
                reset();
              }}
              className="mt-1 text-[6px] tracking-[0.2em] text-[#5f5249] hover:text-[#b3252f]"
            >
              ERASE SAVE DATA
            </button>
          </div>

          {lastAutosave > 0 && (
            <div className="mt-3 text-center text-[6px] text-[#5f5249]">
              LAST SAVED {new Date(lastAutosave).toLocaleTimeString()}
            </div>
          )}
        </div>
      </ScrollPanel>
    </div>
  );
}

function Btn({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      className="border-2 px-4 py-2.5 text-left text-[8px] tracking-[0.2em] transition-colors"
      style={{
        borderColor: tone === "danger" ? "#7c141f" : "#3a2229",
        color: tone === "danger" ? "#b3252f" : "#f7e6c8",
        background: "#120a0d",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#d9b45b";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tone === "danger" ? "#7c141f" : "#3a2229";
      }}
    >
      {label}
    </button>
  );
}
