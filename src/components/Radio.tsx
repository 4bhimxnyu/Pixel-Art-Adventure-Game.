// ---------------------------------------------------------------------------
// A small radio under the minimap: the game's own tracks with play / pause,
// previous and next. It drives the playlist in game/sound.ts and never
// touches the note's track or the ending. Drawn like a little wooden set:
// an antenna, a speaker grille, a lit dial that names the track, three keys.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { onRadio, radioNext, radioPrev, radioState, radioToggle, type RadioState } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import { TRACK_INFO } from "../data/tracks";

const WIDTH = 150; // the minimap's width, so the two line up

function Key({ label, onPress, title, wide }: { label: React.ReactNode; onPress: () => void; title: string; wide?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="flex h-[22px] items-center justify-center rounded-[6px] text-[#f2dfa6] transition-transform active:translate-y-px"
      style={{
        width: wide ? 40 : 30,
        background: "linear-gradient(180deg, #4a2a1c 0%, #2b1710 100%)",
        border: "1px solid rgba(217,180,91,.45)",
        boxShadow: "0 2px 0 #140a07, inset 0 1px 0 rgba(242,223,166,.18)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        questSfx.select();
        onPress();
      }}
    >
      {label}
    </button>
  );
}

export default function Radio() {
  const [s, setS] = useState<RadioState>(() => radioState());
  useEffect(() => {
    const off = onRadio(setS);
    // the paused flag and the probe result arrive without an event; look now and then
    const t = window.setInterval(() => setS(radioState()), 1000);
    return () => {
      off();
      window.clearInterval(t);
    };
  }, []);

  if (!s.available || s.tracks.length === 0) return null;
  const name = s.index >= 0 ? s.tracks[s.index] : s.tracks[0];
  const info = TRACK_INFO[name] ?? { title: name.replace(/^game\s*/i, "Track ") };

  return (
    <div className="radio pointer-events-auto relative shrink-0" style={{ width: WIDTH }} onPointerDown={(e) => e.stopPropagation()}>
      {/* antenna */}
      <div
        className="absolute -top-[14px] right-[22px] h-[16px] w-[2px] origin-bottom rotate-[18deg] rounded-full"
        style={{ background: "linear-gradient(180deg, #f2dfa6, #8a6a3a)" }}
      />
      <div
        className="relative rounded-[12px] px-2.5 pb-2 pt-2"
        style={{
          background: "linear-gradient(180deg, #3b2217 0%, #22120c 100%)",
          border: "1px solid rgba(217,180,91,.5)",
          boxShadow: "0 12px 30px -12px rgba(0,0,0,.9), 0 0 0 3px rgba(10,5,7,.6), inset 0 1px 0 rgba(242,223,166,.12)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* speaker grille */}
          <div
            className="radio-grille h-[34px] w-[34px] shrink-0 rounded-[7px]"
            style={{
              background: "radial-gradient(circle, rgba(242,223,166,.55) 1px, transparent 1.4px) 0 0 / 5px 5px, #1a0e09",
              border: "1px solid rgba(217,180,91,.35)",
              boxShadow: "inset 0 0 8px rgba(0,0,0,.8)",
            }}
          />
          {/* dial */}
          <div
            className="flex h-[34px] min-w-0 flex-1 flex-col justify-center rounded-[6px] px-2"
            style={{
              background: s.playing ? "linear-gradient(180deg, #4b3a12, #2e2208)" : "#1a120a",
              border: "1px solid rgba(217,180,91,.4)",
              boxShadow: s.playing ? "inset 0 0 10px rgba(242,223,166,.25), 0 0 10px -2px rgba(242,223,166,.35)" : "inset 0 0 8px rgba(0,0,0,.7)",
            }}
          >
            <div className="truncate text-[11px] font-semibold tracking-[.06em] text-[#f2dfa6]" title={info.title}>
              {s.playing ? "♪ " : ""}
              {info.title}
            </div>
            <div className="truncate text-[8px] tracking-[.14em] text-[rgba(242,223,166,.6)]">
              {info.artist ? `${info.artist} · ` : ""}
              {s.playing ? "ON AIR" : "PAUSED"} {Math.max(0, s.index) + 1}/{s.tracks.length}
            </div>
          </div>
        </div>
        {/* keys */}
        <div className="mt-2 flex items-center justify-between">
          <Key title="Previous track" onPress={radioPrev} label={<span className="text-[10px]">◀◀</span>} />
          <Key
            title={s.playing ? "Pause" : "Play"}
            onPress={radioToggle}
            wide
            label={<span className="text-[11px]">{s.playing ? "❚❚" : "▶"}</span>}
          />
          <Key title="Next track" onPress={radioNext} label={<span className="text-[10px]">▶▶</span>} />
        </div>
      </div>
    </div>
  );
}
