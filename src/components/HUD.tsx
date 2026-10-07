import { useGameStore } from "../store/useGameStore";
import { MAPS } from "../game/maps";
import MissionTracker from "./MissionTracker";
import { HpBar } from "./pixel/decor";
import { CharacterPortrait } from "./pixel/Portrait";
import { useDevice, glyph } from "../input/useDevice";
import { useEffect, useState } from "react";
import { bus } from "../game/bus";

export default function HUD() {
  const map = useGameStore((s) => s.map);
  const party = useGameStore((s) => s.party);
  const device = useDevice();
  const k = device.kind;
  const hasMimo = party.some((p) => p.id === "mimo");
  const [stuck, setStuck] = useState(false);
  useEffect(() => bus.on("stuck", (v: boolean) => setStuck(!!v)), []);

  return (
    <div className="hud pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          {/* place */}
          <div className="surface inline-flex w-fit items-center gap-2.5 px-4 py-2">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="5" r="3" fill="none" stroke="#d9b45b" strokeWidth="1.3" />
              <path d="M6 8v3" stroke="#d9b45b" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="title-lg text-[13px] text-[#f2dfa6]">{MAPS[map].name}</span>
          </div>

          {/* party */}
          <div className="flex flex-col gap-2">
            {party.map((p) => (
              <div key={p.id} className="surface flex w-fit items-center gap-3 px-3 py-2">
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: "1px solid rgba(217,180,91,.4)", boxShadow: "0 4px 12px -4px rgba(0,0,0,.8)" }}
                >
                  <CharacterPortrait id={p.portrait} size={30} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-[var(--ink-1)]">{p.name}</span>
                  <HpBar hp={p.hp} max={p.maxHp} width={104} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <MissionTracker />
      </div>

      {stuck && (
        <div className="pointer-events-auto absolute left-1/2 top-[26%] -translate-x-1/2 sb-pop">
          <div className="surface flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-6">
              <span className="title-lg text-[13px] text-[#f2dfa6]">Need help?</span>
              <button onClick={() => { setStuck(false); bus.emit("stuck", false); }} className="text-[11px] text-[var(--ink-4)] hover:text-[var(--ink-2)]">Close</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { bus.emit("help:direction"); setStuck(false); }} className="btn px-3 py-2 text-[11px]" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}>Show direction</button>
              <button onClick={() => { setStuck(false); useGameStore.getState().setOverlay({ kind: "quests" }); }} className="btn px-3 py-2 text-[11px]" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}>Show objective</button>
              <button onClick={() => bus.emit("unstuck")} className="btn btn-primary flex items-center gap-2 px-3 py-2 text-[11px]" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}>
                Reset position
                <kbd className="rounded border border-[rgba(242,223,166,.4)] bg-black/30 px-1.5 py-0.5 text-[9px]">{k === "gamepad" ? "Select" : k === "touch" ? "" : "R"}</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {k !== "touch" && (
        <div className="hud-keys flex items-end justify-between">
          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-full bg-black/55 px-3 py-1.5 text-[10px] text-[var(--ink-2)] backdrop-blur-sm">
            {(
              [
                [glyph("move", k), "Move"], [glyph("look", k), "Look"], [glyph("interact", k), "Interact"],
                [glyph("dodge", k), "Dash"], ...(hasMimo ? [[glyph("sniff", k), "Mimo sniffs"]] : []),
                [glyph("quests", k), "Missions"], [glyph("items", k), "Items"], [glyph("hint", k), "Hint"],
                [glyph("menu", k), "Menu"], ...(k === "keyboard" ? [["F5", "Save"]] : []),
              ] as string[][]
            ).map(([key, v]) => (
              <span key={v} className="flex items-center gap-1.5">
                <kbd className="rounded border border-[rgba(217,180,91,.25)] bg-black/50 px-1.5 py-0.5 text-[9px] text-[var(--ink-2)]">{key}</kbd>
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
