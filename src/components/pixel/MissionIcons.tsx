// ---------------------------------------------------------------------------
// Pixel mission icons, drawn as 12x12 SVG rect grids.
// ---------------------------------------------------------------------------

export type IconName =
  | "lantern" | "scroll" | "bamboo" | "blossom" | "temple" | "flame" | "sword"
  | "boss" | "paw" | "guitar" | "star" | "seal" | "region" | "ability"
  | "mountain" | "cave" | "home";

type R = [number, number, number, number, string];

const G = "#d9b45b";
const BG_ = "#f2dfa6";
const RED = "#b3252f";
const DARK = "#1a0f12";
const GRN = "#7ddca4";
const PNK = "#e39cb2";

const ICONS: Record<IconName, R[]> = {
  lantern: [[4, 1, 4, 1, G], [3, 2, 6, 6, RED], [2, 3, 1, 4, RED], [9, 3, 1, 4, RED], [4, 8, 4, 1, G], [5, 9, 2, 2, G]],
  scroll: [[2, 2, 8, 8, BG_], [2, 2, 8, 1, G], [2, 9, 8, 1, G], [3, 4, 6, 1, DARK], [3, 6, 6, 1, DARK], [1, 1, 1, 10, RED], [10, 1, 1, 10, RED]],
  bamboo: [[3, 1, 2, 10, GRN], [7, 1, 2, 10, GRN], [3, 4, 2, 1, DARK], [7, 6, 2, 1, DARK], [5, 3, 2, 1, GRN], [5, 7, 2, 1, GRN]],
  blossom: [[5, 1, 2, 3, PNK], [5, 8, 2, 3, PNK], [1, 5, 3, 2, PNK], [8, 5, 3, 2, PNK], [4, 4, 4, 4, "#f0bcd0"], [5, 5, 2, 2, G]],
  temple: [[1, 3, 10, 2, RED], [2, 5, 8, 5, "#7a6248"], [3, 1, 6, 2, RED], [5, 6, 2, 4, DARK], [1, 10, 10, 1, G]],
  flame: [[5, 1, 2, 2, BG_], [4, 3, 4, 3, G], [3, 5, 6, 4, RED], [4, 9, 4, 1, "#7c141f"], [5, 5, 2, 3, BG_]],
  sword: [[5, 1, 2, 7, "#c9c4bb"], [3, 8, 6, 1, G], [5, 9, 2, 2, "#5e4231"], [5, 1, 1, 7, BG_]],
  boss: [[2, 2, 8, 6, DARK], [3, 1, 6, 2, RED], [4, 4, 1, 2, RED], [7, 4, 1, 2, RED], [3, 8, 6, 1, G], [4, 9, 4, 2, "#3d0f18"]],
  paw: [[2, 3, 2, 2, DARK], [5, 2, 2, 2, DARK], [8, 3, 2, 2, DARK], [3, 6, 6, 4, DARK], [4, 7, 4, 2, "#3a2a30"]],
  guitar: [[4, 6, 5, 5, "#f2f2ee"], [5, 1, 2, 5, "#d8d4cc"], [5, 8, 3, 2, DARK], [4, 0, 4, 1, G]],
  star: [[5, 0, 2, 12, G], [0, 5, 12, 2, G], [3, 3, 6, 6, BG_], [4, 4, 4, 4, G]],
  seal: [[2, 2, 8, 8, RED], [3, 3, 6, 6, "#7c141f"], [4, 4, 4, 1, BG_], [4, 6, 4, 1, BG_], [4, 8, 4, 1, BG_]],
  region: [[1, 2, 10, 8, "#2c4a32"], [1, 2, 10, 1, G], [3, 4, 3, 3, G], [7, 6, 3, 2, "#7ddca4"]],
  ability: [[5, 1, 2, 4, BG_], [3, 5, 6, 2, G], [5, 7, 2, 4, BG_], [1, 5, 2, 2, G], [9, 5, 2, 2, G]],
  mountain: [[1, 8, 10, 3, "#5b5563"], [3, 4, 4, 5, "#6b645c"], [6, 2, 4, 7, "#7a7269"], [6, 2, 2, 2, BG_], [3, 4, 2, 2, BG_]],
  cave: [[1, 1, 10, 10, "#2f2735"], [3, 4, 6, 7, "#0a0507"], [4, 2, 2, 2, "#584a63"], [7, 6, 2, 2, "#584a63"]],
  home: [[1, 5, 10, 6, "#7a6248"], [2, 2, 8, 3, RED], [1, 4, 10, 1, G], [5, 7, 3, 4, DARK], [3, 6, 2, 2, "#2b4a5c"]],
};

export function PixelIcon({ name, size = 24, tint }: { name: IconName; size?: number; tint?: string }) {
  const rects = ICONS[name] ?? ICONS.star;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", display: "block", flexShrink: 0 }}
      aria-hidden
    >
      {rects.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={tint ?? fill} />
      ))}
    </svg>
  );
}

export const REWARD_ICON: Record<string, IconName> = {
  ability: "ability",
  region: "region",
  item: "seal",
  lore: "scroll",
};
