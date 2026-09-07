import { useGameStore } from "../store/useGameStore";
import { MAPS } from "../game/maps";
import MissionTracker from "./MissionTracker";
import { HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";

export default function HUD() {
  const map = useGameStore((s) => s.map);
  const party = useGameStore((s) => s.party);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 border-2 border-[#7c141f] bg-[#0a0507]/85 px-3 py-1.5">
            <span className="text-[7px] tracking-[0.3em] text-[#8a7a6a]">LOCATION</span>
            <span className="text-[9px] tracking-[0.14em] text-[#d9b45b]">{MAPS[map].name}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {party.map((p) => (
              <div key={p.id} className="flex w-fit items-center gap-2 border-2 border-[#3a2229] bg-[#0a0507]/85 px-2 py-1">
                <div className="border border-[#7c141f]">
                  <CharacterPortrait id={p.portrait} size={20} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] tracking-wider text-[#f7e6c8]">{p.name.toUpperCase()}</span>
                  <HpBar hp={p.hp} max={p.maxHp} width={92} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <MissionTracker />
      </div>

      <div className="flex items-end justify-between">
        <div className="text-[6px] leading-[2] tracking-[0.2em] text-[#5f5249]">
          E INTERACT · Q MISSIONS · I ITEMS · H HINT · ESC MENU · F5 SAVE
        </div>
      </div>
    </div>
  );
}
