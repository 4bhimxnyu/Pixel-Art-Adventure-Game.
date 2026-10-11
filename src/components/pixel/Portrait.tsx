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
  /** Hair that stops at the shoulders. */
  shoulderHair?: boolean;
  wide?: boolean;
};

const SPECS: Record<string, Spec> = {
  palakshi: {
    // shoulder-length dark hair, large black glasses, black cardigan over a black top
    bg: "#241019", hair: "#150d12", hairHi: "#2a1a24", skin: "#e8b48c", shade: "#c1875f",
    robe: "#141216", robeHi: "#1c1a1f", trim: "#2a2a2e", shoulderHair: true,
    extra: [
      // frames
      [4, 5, 4, 1, "#0e0e12"], [4, 8, 4, 1, "#0e0e12"], [4, 6, 1, 2, "#0e0e12"], [7, 6, 1, 2, "#0e0e12"],
      [8, 5, 4, 1, "#0e0e12"], [8, 8, 4, 1, "#0e0e12"], [8, 6, 1, 2, "#0e0e12"], [11, 6, 1, 2, "#0e0e12"],
      [7, 6, 2, 1, "#0e0e12"],
      // cardigan edge + green/white check hint at the hem
      [7, 12, 2, 4, "#1c1a1f"], [3, 15, 1, 1, "#3f8a4f"], [5, 15, 1, 1, "#3f8a4f"], [10, 15, 1, 1, "#3f8a4f"], [12, 15, 1, 1, "#3f8a4f"],
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
    // messy dark fringe, light-blue denim jacket open over a black T-shirt; the white bass
    bg: "#14202e", hair: "#1d1414", skin: "#d9a074", shade: "#a87a52",
    robe: "#7fa3cf", robeHi: "#9bbbe0", trim: "#17171a",
    extra: [
      [6, 11, 4, 5, "#17171a"], // black tee inside the open jacket
      [4, 3, 3, 1, "#1d1414"], [8, 3, 4, 1, "#1d1414"], [5, 4, 1, 1, "#1d1414"], [10, 4, 2, 1, "#1d1414"], // fringe
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
    // from his photo: tall dark quiff swept back off the forehead and down to the ears, strong brows,
    // stubble on the jaw, green knitted polo with beige stripes and a buttoned placket
    bg: "#16261e", hair: "#1a1412", hairHi: "#2e2622", skin: "#c9a076", shade: "#9a7452",
    robe: "#1f3a2a", robeHi: "#1f3a2a", trim: "#c9b58f",
    extra: [
      [3, 0, 10, 1, "#1a1412"], [5, 0, 3, 1, "#2e2622"], [4, 1, 2, 1, "#2e2622"], // the quiff
      [2, 4, 1, 6, "#1a1412"], [13, 4, 1, 6, "#1a1412"], // hair down to the ears
      [5, 5, 2, 1, "#1a1412"], [9, 5, 2, 1, "#1a1412"], // strong brows
      [5, 11, 6, 1, "#8f6e52"], // stubble along the jaw
      [5, 11, 1, 2, "#1f3a2a"], [10, 11, 1, 2, "#1f3a2a"], // collar flaps
      [2, 12, 12, 1, "#c9b58f"], [7, 13, 2, 1, "#2a2420"], // second stripe, placket buttons
    ],
  },
  riddhi: {
    // from her photo: hair pulled back tight into a low bun, slim black rectangular glasses, small gold hoops, white V-neck tank, smirk
    bg: "#1d2230", hair: "#1c120f", hairHi: "#2e1f1a", skin: "#c48860", shade: "#9e6b48",
    robe: "#f4f1e8", robeHi: "#e9e4d6", trim: "#8fb0cf",
    extra: [
      [3, 2, 1, 3, "#1c120f"], [12, 2, 1, 3, "#1c120f"],
      [4, 6, 3, 1, "#111114"], [9, 6, 3, 1, "#111114"], [4, 9, 3, 1, "#111114"], [9, 9, 3, 1, "#111114"],
      [4, 7, 1, 2, "#111114"], [6, 7, 1, 2, "#111114"], [9, 7, 1, 2, "#111114"], [11, 7, 1, 2, "#111114"], [7, 7, 2, 1, "#111114"],
      [2, 8, 1, 2, "#d4af37"], [13, 8, 1, 2, "#d4af37"],
      [6, 11, 3, 1, "#b85e6a"], [9, 10, 1, 1, "#b85e6a"],
      [7, 12, 2, 2, "#c98f66"],
    ],
  },
  hakim: {
    // from his photo: side-parted hair swept across the forehead, a big toothy grin, no glasses,
    // navy zip-up hoodie open over a navy V-neck tee, a "3" patch on the left sleeve; the iPad
    // stays in frame at the bottom corner, never over the face
    bg: "#1a1f2e", hair: "#1c1416", hairHi: "#2a2024", skin: "#d4a07a", shade: "#a87a52",
    robe: "#232b4a", robeHi: "#1f2742", trim: "#232b4a",
    extra: [
      [4, 4, 6, 1, "#1c1416"], [10, 3, 1, 1, "#d4a07a"], // sweep across the forehead, the parting
      [5, 10, 6, 1, "#5a2430"], [6, 10, 4, 1, "#f6f2ea"], // grin with teeth
      [6, 12, 4, 4, "#1f2742"], [7, 12, 2, 1, "#d4a07a"], // the V-neck tee inside the open hoodie
      [5, 12, 1, 4, "#9a9aa2"], [10, 12, 1, 4, "#9a9aa2"], // zip tapes
      [12, 13, 2, 2, "#d8c08a"], // sleeve patch
      [1, 13, 4, 3, "#c9c4bb"], [2, 14, 2, 2, "#5b7fb5"], // iPad corner
    ],
  },
  dev: {
    // from his photo: lean, not bulky; wavy hair pushed back with volume, half-lidded sleepy eyes,
    // a slight smile, stubble, black tank with bare shoulders
    bg: "#2a1a1a", hair: "#161210", hairHi: "#2a2220", skin: "#c98a5e", shade: "#a06a46",
    robe: "#1a1a1e", robeHi: "#1a1a1e", trim: "#1a1a1e",
    extra: [
      [4, 0, 3, 1, "#161210"], [8, 0, 4, 1, "#161210"], [6, 0, 2, 1, "#2a2220"], [3, 1, 1, 1, "#2a2220"], // waves on top
      [5, 6, 2, 1, "#a06a46"], [9, 6, 2, 1, "#a06a46"], // half-lidded eyes
      [5, 10, 1, 1, "#b37256"], [10, 10, 1, 1, "#b37256"], // smile corners
      [5, 11, 6, 1, "#8a5e42"], // stubble
      [2, 11, 3, 5, "#c98a5e"], [11, 11, 3, 5, "#c98a5e"], // bare shoulders either side of the tank
      [5, 11, 1, 5, "#1a1a1e"], [10, 11, 1, 5, "#1a1a1e"], // tank straps
    ],
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
  if (spec.shoulderHair) {
    r.push([2, 4, 1, 7, hair]);
    r.push([13, 4, 1, 7, hair]);
    r.push([3, 10, 1, 1, hair]);
    r.push([12, 10, 1, 1, hair]);
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
