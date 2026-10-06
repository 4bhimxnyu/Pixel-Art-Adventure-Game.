import { useEffect, useState, type ReactNode } from "react";
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

  const usable = inventory.filter((i) => ITEMS[i.id].heal);
  const keyItems = inventory.filter((i) => !ITEMS[i.id].heal);
  const list = [...usable, ...keyItems];
  const sel = list[cursor];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!list.length) return;
      if (["ArrowDown", "s", "S"].includes(e.key)) { setCursor((c) => (c + 1) % list.length); sfx("menu"); }
      else if (["ArrowUp", "w", "W"].includes(e.key)) { setCursor((c) => (c - 1 + list.length) % list.length); sfx("menu"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  const apply = (idx: number) => {
    if (!sel) return;
    if (useItem(sel.id, idx)) { questSfx.objective(); setCursor(0); }
    else questSfx.denied();
  };

  return (
    <div className="panel-shell absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <ScrollPanel title="Items" subtitle={`${inventory.length} kinds carried`}
                   onClose={() => { questSfx.panelClose(); setOverlay(null); }}
                   className="w-full max-w-[780px]">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_290px]">
          <div className="scroll-area max-h-[400px] overflow-y-auto p-4">
            {!list.length && (
              <p className="py-12 text-center text-[13px] text-[var(--ink-3)]">Your bag is empty.</p>
            )}

            {usable.length > 0 && <Section>Consumables</Section>}
            {usable.map((i, n) => (
              <Row key={i.id} item={i} active={cursor === n} onHover={() => setCursor(n)} />
            ))}

            {keyItems.length > 0 && <Section>Key items</Section>}
            {keyItems.map((i, n) => (
              <Row key={i.id} item={i} active={cursor === usable.length + n}
                   onHover={() => setCursor(usable.length + n)} />
            ))}
          </div>

          <aside className="border-l border-[rgba(217,180,91,.15)] p-5">
            {sel ? (
              <>
                <div className="flex items-center gap-2.5">
                  <PixelIcon name={ITEMS[sel.id].icon as IconName} size={20} />
                  <span className="title-lg text-[15px] text-[#f2dfa6]">{ITEMS[sel.id].name}</span>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-2)]">{ITEMS[sel.id].desc}</p>
                <p className="mt-2 text-[11px] text-[var(--ink-4)]">Held: {sel.count}</p>

                {ITEMS[sel.id].heal && (
                  <div className="mt-5">
                    <div className="eyebrow mb-2.5">Use on</div>
                    <div className="flex flex-col gap-2">
                      {party.map((p, idx) => (
                        <button key={p.id} onClick={() => apply(idx)}
                                className="btn flex items-center gap-2.5 px-3 py-2 text-left">
                          <div className="overflow-hidden rounded-md" style={{ border: "1px solid rgba(217,180,91,.3)" }}>
                            <CharacterPortrait id={p.portrait} size={26} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[12px] font-semibold tracking-normal text-[var(--ink-1)]"
                                  style={{ fontFamily: "var(--font-body)" }}>{p.name}</span>
                            <HpBar hp={p.hp} max={p.maxHp} width={150} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[12px] text-[var(--ink-3)]">Nothing selected.</p>
            )}
          </aside>
        </div>
      </ScrollPanel>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-2 mt-4 first:mt-0">{children}</div>;
}

function Row({
  item, active, onHover,
}: {
  item: { id: keyof typeof ITEMS; count: number };
  active: boolean;
  onHover: () => void;
}) {
  const def = ITEMS[item.id];
  return (
    <button
      onMouseEnter={onHover}
      className={`mb-1.5 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active ? "border-[rgba(217,180,91,.5)] bg-white/[.045]" : "border-transparent hover:bg-white/[.02]"
      }`}
    >
      <PixelIcon name={def.icon as IconName} size={16} />
      <span className="flex-1 text-[13px] text-[var(--ink-1)]">{def.name}</span>
      <span className="text-[11px] text-[var(--ink-3)]">×{item.count}</span>
    </button>
  );
}
