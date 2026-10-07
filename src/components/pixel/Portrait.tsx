// ---------------------------------------------------------------------------
// SVG pixel busts. Every speaker, party member and boss has a real portrait —
// bosses never fall back to an animal or a placeholder.
// ---------------------------------------------------------------------------

type Rect = [x: number, y: number, w: number, h: number, fill: string];

type Spec = {
  bg: string;
  hair: string;
  hairHi?: string;
  skin: string;
  shade: string;
  robe: string;
  robeHi: string;
  trim: string;
  /** extra rects drawn last, in the same 16x16 grid */
  extra?: Rect[];
  longHair?: boolean;
  wide?: boolean;
};

const SPECS: Record<string, Spec> = {
  palakshi: {
    // shoulder-length bob with a straight fringe, large black glasses, black cardigan
    bg: "#241019", hair: "#120c10", hairHi: "#2a1a24", skin: "#e8b48c", shade: "#c1875f",
    robe: "#121014", robeHi: "#1e1b22", trim: "#1e1b22",
    extra: [
      [2, 3, 1, 9, "#120c10"], [13, 3, 1, 9, "#120c10"], [3, 3, 10, 1, "#120c10"],
      [4, 5, 4, 1, "#0a0a0c"], [4, 8, 4, 1, "#0a0a0c"], [4, 5, 1, 4, "#0a0a0c"], [7, 5, 1, 4, "#0a0a0c"],
      [8, 5, 4, 1, "#0a0a0c"], [8, 8, 4, 1, "#0a0a0c"], [8, 5, 1, 4, "#0a0a0c"], [11, 5, 1, 4, "#0a0a0c"],
      [7, 12, 2, 4, "#0a0a0c"],
    ],
  },
  mimo: {
    bg: "#1d2418", hair: "#f2f2ee", skin: "#f2f2ee", shade: "#c9a06a",
    robe: "#f2f2ee", robeHi: "#e0ddd4", trim: "#c9a06a",
    extra: [
      [3, 3, 3, 4, "#c9a06a"], [10, 3, 3, 4, "#c9a06a"],
      [5, 8, 2, 2, "#0a0507"], [9, 8, 2, 2, "#0a0507"],
      [7, 11, 2, 2, "#2a1a1a"], [6, 13, 4, 1, "#c9a06a"],
    ],
  },
  abhimanyu: {
    // messy fringe, light blue denim jacket over a black tee, the white bass
    bg: "#14202e", hair: "#16100f", hairHi: "#2a1e1a", skin: "#d9a074", shade: "#a87a52",
    robe: "#8db0d6", robeHi: "#a6c4e3", trim: "#6f93bd",
    extra: [
      [4, 3, 3, 2, "#16100f"], [8, 3, 3, 1, "#16100f"], [2, 2, 1, 4, "#16100f"], [13, 2, 1, 4, "#16100f"], [6, 0, 4, 1, "#16100f"],
      [6, 12, 4, 4, "#141416"],
      [11, 10, 4, 6, "#f2f2ee"], [12, 7, 2, 4, "#d8d4cc"], [12, 12, 2, 1, "#1a0f12"],
    ],
  },
  bidisha: {
    bg: "#2a121a", hair: "#2a1a1a", skin: "#e8b48c", shade: "#c1875f",
    robe: "#7c141f", robeHi: "#8f1a24", trim: "#d9b45b", longHair: true,
    extra: [[7, 2, 2, 1, "#d9b45b"]],
  },
  prakriti: {
    bg: "#10262a", hair: "#191021", skin: "#e5b291", shade: "#bd8763",
    robe: "#1f6b6b", robeHi: "#5a3d78", trim: "#f2dfa6", longHair: true,
    extra: [[4, 2, 3, 1, "#2fa3a3"], [10, 12, 3, 2, "#5a3d78"], [9, 2, 2, 1, "#f2dfa6"]],
  },
  arshiya: {
    bg: "#2b0d13", hair: "#241018", skin: "#dda57f", shade: "#b07a55",
    robe: "#3d0f18", robeHi: "#7c141f", trim: "#f2dfa6", longHair: true, wide: true,
    extra: [[4, 1, 8, 1, "#f2dfa6"], [6, 2, 4, 1, "#d9b45b"], [3, 12, 10, 1, "#d9b45b"]],
  },
  kaajal: {
    bg: "#161d2e", hair: "#1b1218", skin: "#e8b48c", shade: "#c1875f",
    robe: "#25304a", robeHi: "#39476b", trim: "#f7e6c8", longHair: true,
    extra: [[4, 7, 3, 1, "#f7e6c8"], [9, 7, 3, 1, "#f7e6c8"], [7, 7, 2, 1, "#f7e6c8"]],
  },
  elder: {
    bg: "#241a2b", hair: "#c9c4bb", skin: "#cfa079", shade: "#a87a52",
    robe: "#4a3c52", robeHi: "#5d4d66", trim: "#d9b45b",
    extra: [[6, 11, 4, 4, "#c9c4bb"], [7, 12, 2, 3, "#ddd8cf"]],
  },
  townie: {
    bg: "#1c2a20", hair: "#3a2a20", skin: "#dfa87e", shade: "#b07a55",
    robe: "#3f5a45", robeHi: "#4d6d54", trim: "#f7e6c8",
  },
  villager: {
    bg: "#2a2118", hair: "#4a3020", skin: "#d9a074", shade: "#a87a52",
    robe: "#5a4232", robeHi: "#6b5140", trim: "#d9b45b",
  },
  guardian: {
    bg: "#241f14", hair: "#6a5a48", skin: "#8a7458", shade: "#6a5a48",
    robe: "#6a5a48", robeHi: "#7d6c56", trim: "#d9b45b", wide: true,
    extra: [[4, 5, 3, 2, "#b3252f"], [9, 5, 3, 2, "#b3252f"], [5, 10, 6, 1, "#d9b45b"], [2, 1, 12, 2, "#4a3f32"]],
  },
  spirit: {
    bg: "#152415", hair: "#5d9a5a", skin: "#a8e08a", shade: "#5d9a5a",
    robe: "#4f7a3a", robeHi: "#679a4c", trim: "#a8e08a",
    extra: [[5, 6, 2, 2, "#0a0507"], [9, 6, 2, 2, "#0a0507"], [6, 10, 4, 1, "#a8e08a"]],
  },
  boar: {
    bg: "#241c14", hair: "#5a4a3a", skin: "#8a7458", shade: "#5a4a3a",
    robe: "#5a4a3a", robeHi: "#6d5b47", trim: "#8a7458",
    extra: [[4, 8, 2, 2, "#b3252f"], [10, 8, 2, 2, "#b3252f"], [3, 11, 2, 3, "#f7e6c8"], [11, 11, 2, 3, "#f7e6c8"]],
  },
  // ---- F-1205 flatmates
  faizal: {
    // short, heavy-set, curly hair, green tee
    bg: "#16261a", hair: "#2a1a12", hairHi: "#4a3220", skin: "#d9a074", shade: "#a87a52",
    robe: "#2f7a3f", robeHi: "#3f9a52", trim: "#2a5a33", wide: true,
    extra: [[2, 1, 12, 1, "#2a1a12"], [2, 2, 1, 2, "#2a1a12"], [13, 2, 1, 2, "#2a1a12"], [4, 0, 2, 1, "#2a1a12"], [10, 0, 2, 1, "#2a1a12"], [7, 0, 2, 1, "#2a1a12"]],
  },
  garv: {
    // oldest flatmate: grey at the temples, short beard, calm earth tones
    bg: "#241f1a", hair: "#3a3236", hairHi: "#8a8290", skin: "#cfa079", shade: "#a87a52",
    robe: "#5a4a3c", robeHi: "#6e5c4c", trim: "#c9b48a",
    extra: [[3, 2, 2, 1, "#8a8290"], [11, 2, 2, 1, "#8a8290"], [5, 10, 6, 2, "#4a3e40"], [6, 11, 4, 1, "#3a3236"]],
  },
  hakim: {
    // always on his iPad — the tablet is in frame, below the chin, never over the eyes
    bg: "#1a1f2e", hair: "#1c1416", skin: "#d4a07a", shade: "#a87a52",
    robe: "#3a3f5a", robeHi: "#4d546f", trim: "#c9c4bb",
    extra: [[3, 12, 10, 4, "#c9c4bb"], [4, 13, 8, 3, "#2a3a55"], [5, 14, 6, 1, "#5b7fb5"]],
  },
  dev: {
    // bodybuilder: wide shoulders, strong jaw, fitted vest
    bg: "#2a1a1a", hair: "#121010", hairHi: "#2a2424", skin: "#d0946a", shade: "#a8724e",
    robe: "#1f1f24", robeHi: "#2e2e36", trim: "#e0616b", wide: true,
    extra: [[0, 11, 3, 5, "#d0946a"], [13, 11, 3, 5, "#d0946a"], [4, 9, 8, 1, "#a8724e"]],
  },
  bunny:   { bg: "#1c2a22", hair: "#cfe0d2", skin: "#cfe0d2", shade: "#9fb8a6", robe: "#cfe0d2", robeHi: "#e2eee5", trim: "#7ddca4", extra: [[4, 0, 2, 6, "#cfe0d2"], [10, 0, 2, 6, "#cfe0d2"], [5, 8, 2, 2, "#0a0507"], [9, 8, 2, 2, "#0a0507"]] },
  sparrow: { bg: "#241f16", hair: "#8a6f4f", skin: "#8a6f4f", shade: "#6b563d", robe: "#8a6f4f", robeHi: "#a3865f", trim: "#f7e6c8", extra: [[11, 8, 4, 2, "#d9b45b"], [5, 7, 2, 2, "#0a0507"]] },
  wolf:    { bg: "#1b1a20", hair: "#4d4a55", skin: "#4d4a55", shade: "#38363f", robe: "#4d4a55", robeHi: "#67636f", trim: "#8a8698", extra: [[3, 1, 3, 4, "#4d4a55"], [10, 1, 3, 4, "#4d4a55"], [5, 8, 2, 2, "#b3252f"], [9, 8, 2, 2, "#b3252f"]] },
  monkey:  { bg: "#241a12", hair: "#8a5a34", skin: "#c99a68", shade: "#8a5a34", robe: "#8a5a34", robeHi: "#a67145", trim: "#c99a68", extra: [[2, 5, 3, 3, "#c99a68"], [11, 5, 3, 3, "#c99a68"], [5, 8, 2, 2, "#0a0507"], [9, 8, 2, 2, "#0a0507"]] },
  moth:    { bg: "#231a24", hair: "#c9a0c0", skin: "#e3b6d6", shade: "#a97fa0", robe: "#c9a0c0", robeHi: "#e39cb2", trim: "#f2dfa6", extra: [[1, 6, 4, 6, "#e39cb2"], [11, 6, 4, 6, "#e39cb2"], [6, 8, 1, 2, "#0a0507"], [9, 8, 1, 2, "#0a0507"]] },
  crane:   { bg: "#1a2028", hair: "#f2f2ee", skin: "#f2f2ee", shade: "#cfcfc9", robe: "#f2f2ee", robeHi: "#ffffff", trim: "#b3252f", extra: [[6, 1, 4, 2, "#b3252f"], [11, 8, 4, 2, "#d9b45b"], [5, 7, 2, 2, "#0a0507"]] },
  bat:     { bg: "#1a1420", hair: "#4a3a52", skin: "#7a5f88", shade: "#4a3a52", robe: "#4a3a52", robeHi: "#5f4a6b", trim: "#7a5f88", extra: [[0, 5, 5, 7, "#4a3a52"], [11, 5, 5, 7, "#4a3a52"], [5, 8, 2, 2, "#b3252f"], [9, 8, 2, 2, "#b3252f"]] },
  serpent: { bg: "#12241e", hair: "#3a6a58", skin: "#7ddca4", shade: "#3a6a58", robe: "#3a6a58", robeHi: "#4d8a70", trim: "#7ddca4", extra: [[5, 7, 2, 2, "#b3252f"], [9, 7, 2, 2, "#b3252f"], [7, 11, 2, 4, "#7ddca4"]] },
};

export type PortraitId = keyof typeof SPECS;

function bustRects(spec: Spec): Rect[] {
  const r: Rect[] = [];
  const { hair, hairHi, skin, shade, robe, robeHi, trim } = spec;
  const wide = spec.wide ? 1 : 0;

  // shoulders
  r.push([2 - wide, 12, 12 + wide * 2, 4, robe]);
  r.push([3 - wide, 11, 10 + wide * 2, 2, robeHi]);
  r.push([2 - wide, 14, 12 + wide * 2, 1, trim]);
  r.push([6, 11, 4, 2, skin]); // neck

  // head
  r.push([4, 3, 8, 9, skin]);
  r.push([4, 9, 8, 1, shade]);
  r.push([3, 5, 1, 5, shade]);
  r.push([12, 5, 1, 5, shade]);

  // hair
  r.push([3, 1, 10, 3, hair]);
  r.push([3, 3, 2, 4, hair]);
  r.push([11, 3, 2, 4, hair]);
  if (hairHi) r.push([5, 1, 4, 1, hairHi]);
  if (spec.longHair) {
    r.push([2, 4, 1, 9, hair]);
    r.push([13, 4, 1, 9, hair]);
  }

  // face
  r.push([5, 6, 2, 2, "#0a0507"]);
  r.push([9, 6, 2, 2, "#0a0507"]);
  r.push([5, 6, 1, 1, "#f7e6c8"]);
  r.push([9, 6, 1, 1, "#f7e6c8"]);
  r.push([7, 8, 2, 1, shade]);
  r.push([6, 10, 4, 1, "#a8586a"]);

  return r;
}

export function CharacterPortrait({ id, size = 64 }: { id: string; size?: number }) {
  const spec = SPECS[id] ?? SPECS.townie;
  const rects = [...bustRects(spec), ...(spec.extra ?? [])];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", display: "block" }}
      aria-hidden
    >
      <rect x={0} y={0} width={16} height={16} fill={spec.bg} />
      {rects.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}

export function FramedPortrait({
  id, size = 64, label, tone = "gold",
}: {
  id: string;
  size?: number;
  label?: string;
  tone?: "gold" | "crimson";
}) {
  const border = tone === "gold" ? "#d9b45b" : "#b3252f";
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{
          border: `3px solid ${border}`,
          boxShadow: `0 0 0 2px #0a0507, 0 0 14px ${border}44`,
          background: "#0a0507",
          lineHeight: 0,
        }}
      >
        <CharacterPortrait id={id} size={size} />
      </div>
      {label && (
        <span className="text-[6px] tracking-wider text-[#d9b45b]" style={{ maxWidth: size + 8 }}>
          {label.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export const KNOWN_PORTRAITS = Object.keys(SPECS);
