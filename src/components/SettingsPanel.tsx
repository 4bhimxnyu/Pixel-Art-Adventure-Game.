import { useGameStore } from "../store/useGameStore";
import { questSfx } from "../lib/questSfx";
import { ScrollPanel } from "./pixel/decor";

export default function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const setOverlay = useGameStore((s) => s.setOverlay);

  const close = () => {
    questSfx.panelClose();
    if (onClose) onClose();
    else setOverlay(null);
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#0a0507]/88 p-4">
      <ScrollPanel title="SETTINGS" onClose={close} className="w-full max-w-[440px]">
        <div className="flex flex-col gap-5 p-5">
          <Slider
            label="MUSIC"
            value={settings.musicVol}
            onChange={(v) => setSettings({ musicVol: v })}
            hint="Sadeness-based score, Wuxia colour per region"
          />
          <Slider
            label="SOUND"
            value={settings.sfxVol}
            onChange={(v) => setSettings({ sfxVol: v })}
            hint="Steps, hits, menus"
          />
          <Slider
            label="TEXT SPEED"
            value={settings.textSpeed / 60}
            onChange={(v) => setSettings({ textSpeed: Math.max(4, Math.round(v * 60)) })}
            hint={`${settings.textSpeed} characters per second`}
          />

          <div className="border-t border-[#3a2229] pt-4">
            <div className="mb-2 text-[7px] tracking-[0.25em] text-[#7c141f]">CONTROLS</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[6px] leading-[1.9] text-[#8a7a6a]">
              {[
                ["MOVE", "WASD / ARROWS"],
                ["INTERACT", "E / Z / ENTER"],
                ["CANCEL", "ESC / X"],
                ["ITEMS", "I"],
                ["MISSIONS", "Q"],
                ["HINT", "H"],
                ["MENU", "ESC"],
                ["SAVE", "F5"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-[#d9b45b]">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <button
            onClick={close}
            className="border-2 border-[#d9b45b] bg-[#7c141f] py-2 text-[8px] tracking-[0.25em] text-[#f2dfa6]"
          >
            CLOSE
          </button>
        </div>
      </ScrollPanel>
    </div>
  );
}

function Slider({
  label, value, onChange, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[8px] tracking-[0.2em] text-[#d9b45b]">{label}</span>
        <span className="text-[7px] text-[#f7e6c8]">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#b3252f]"
      />
      <div className="mt-1 text-[6px] leading-[1.8] text-[#5f5249]">{hint}</div>
    </label>
  );
}
