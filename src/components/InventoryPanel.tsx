import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { ITEMS } from "../data/content";
import { questSfx } from "../lib/questSfx";
import { sfx } from "../game/sound";
import { ScrollPanel, HpBar } from "./pixel/decor";
import { PixelIcon, type IconName } from "./pixel/MissionIcons";
import { CharacterPortrait } from "./pixel/Portrait";

export default function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);
  const party = useGameStore((s) => s.party);
  const useItem = useGameStore((s) => s.useItem);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const [cursor, setCursor] = useState(0);
  const [target, setTarget] = useState<number | null>(null);

  const usable = inventory.filter((i) => ITEMS[i.id].heal);
  const keyItems = inventory.filter((i) => !ITEMS[i.id].heal);
  const list = [...usable, ...keyItems];
  const sel = list[cursor];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!list.length) return;
      if (["ArrowDown", "s", "S"].includes(e.key)) { setCursor((c) => (c + 1) % list.length); sfx("menu"); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { setCursor((c) => (c - 1 + list.length) % list.length); sfx("menu"); }
      else if (["Enter", "e", "E", "z", "Z", " "].includes(e.key)) {
        e.preventDefault();
        if (sel && ITEMS[sel.id].heal) { setTarget(0); questSfx.confirm(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length, sel]);

  const apply = (idx: number) => {
    if (!sel) return;
    if (useItem(sel.id, idx)) {
      questSfx.objective();
      setTarget(null);
      setCursor(0);
    } else {
      questSfx.denied();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0507]/85 p-4">
      <ScrollPanel title="ITEMS" onClose={() => { questSfx.panelClose(); setOverlay(null); }} className="w-full max-w-[720px]">
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_260px]">
          <div className="max-h-[340px] overflow-y-auto p-3">
            {!list.length && <div className="p-6 text-center text-[8px] text-[#8a7a6a]">Your bag is empty.</div>}

            {usable.length > 0 && <SectionLabel>CONSUMABLES</SectionLabel>}
            {usable.map((i, n) => (
              <Row key={i.id} item={i} active={cursor === n} onHover={() => setCursor(n)} onClick={() => setTarget(0)} />
            ))}

            {keyItems.length > 0 && <SectionLabel>KEY ITEMS</SectionLabel>}
            {keyItems.map((i, n) => (
              <Row
                key={i.id}
                item={i}
                active={cursor === usable.length + n}
                onHover={() => setCursor(usable.length + n)}
              />
            ))}
          </div>

          <aside className="border-l-2 border-[#3a2229] p-3">
            {sel ? (
              <>
                <div className="flex items-center gap-2">
                  <PixelIcon name={ITEMS[sel.id].icon as IconName} size={18} />
                  <span className="text-[9px] text-[#d9b45b]">{ITEMS[sel.id].name}</span>
                </div>
                <p className="mt-2 text-[7px] leading-[2] text-[#f7e6c8]">{ITEMS[sel.id].desc}</p>
                <p className="mt-2 text-[7px] text-[#8a7a6a]">Held: {sel.count}</p>

                {ITEMS[sel.id].heal && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-[6px] tracking-[0.2em] text-[#8a7a6a]">
                      {target === null ? "PRESS ENTER TO USE" : "USE ON WHO?"}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {party.map((p, idx) => (
                        <button
                          key={p.id}
                          onClick={() => apply(idx)}
                          className="flex items-center gap-2 border border-[#3a2229] px-2 py-1.5 text-left hover:border-[#d9b45b]"
                        >
                          <CharacterPortrait id={p.portrait} size={20} />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] text-[#f7e6c8]">{p.name}</span>
                            <HpBar hp={p.hp} max={p.maxHp} width={78} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-[7px] text-[#8a7a6a]">Nothing selected.</div>
            )}
          </aside>
        </div>
      </ScrollPanel>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 mt-2 text-[6px] tracking-[0.3em] text-[#7c141f]">{children}</div>;
}

function Row({
  item, active, onHover, onClick,
}: {
  item: { id: keyof typeof ITEMS; count: number };
  active: boolean;
  onHover: () => void;
  onClick?: () => void;
}) {
  const def = ITEMS[item.id];
  return (
    <button
      onMouseEnter={onHover}
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-2 border px-2 py-1.5 text-left"
      style={{ borderColor: active ? "#d9b45b" : "#241a1e", background: active ? "#2a1016" : "transparent" }}
    >
      <PixelIcon name={def.icon as IconName} size={14} />
      <span className="flex-1 text-[8px] text-[#f7e6c8]">{def.name}</span>
      <span className="text-[7px] text-[#8a7a6a]">x{item.count}</span>
    </button>
  );
}
