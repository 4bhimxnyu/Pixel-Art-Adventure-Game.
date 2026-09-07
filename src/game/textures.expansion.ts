// ---------------------------------------------------------------------------
// Region tiles and props: village, bamboo, mountain, temple, cave, garden.
// Same procedural approach as textures.ts — no image files.
// ---------------------------------------------------------------------------

import Phaser from "phaser";
import { makeTile, TILE, PAL } from "./textures";

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function dot(c: Ctx, x: number, y: number, color: string) {
  px(c, x, y, 1, 1, color);
}

export function buildExpansionTiles(scene: Phaser.Scene) {
  // --- village / plaza ----------------------------------------------------
  makeTile(scene, "t_k", (c) => {
    px(c, 0, 0, TILE, TILE, "#6b6560");
    for (let y = 0; y < TILE; y += 8) {
      for (let x = 0; x < TILE; x += 8) {
        px(c, x + 1, y + 1, 6, 6, "#787168");
        px(c, x + 1, y + 1, 6, 1, "#8a827a");
      }
    }
  });
  makeTile(scene, "t_K", (c) => {
    px(c, 0, 0, TILE, TILE, "#565049");
    for (let y = 0; y < TILE; y += 5) px(c, 0, y, TILE, 1, "#403b36");
    for (let x = 2; x < TILE; x += 7) px(c, x, 0, 1, TILE, "#403b36");
    px(c, 0, 0, TILE, 2, "#6b645c");
  });
  makeTile(scene, "t_:", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    for (let i = 0; i < 24; i++) {
      const x = (i * 7) % TILE, y = (i * 11) % TILE;
      dot(c, x, y, i % 3 ? "#5d5750" : "#3f3a35");
    }
  });
  makeTile(scene, "t_H", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3028");
    px(c, 0, 4, TILE, 12, "#7a6248");
    px(c, 0, 0, TILE, 5, PAL.burgundy);
    px(c, 0, 4, TILE, 1, PAL.gold);
    px(c, 6, 9, 5, 7, PAL.charcoal);
    px(c, 2, 8, 3, 3, "#2b4a5c");
    px(c, 12, 8, 3, 3, "#2b4a5c");
  });
  makeTile(scene, "t_L", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3028");
    px(c, 7, 6, 2, 10, "#2b241e");
    px(c, 4, 2, 8, 6, PAL.crimson);
    px(c, 5, 1, 6, 1, PAL.gold);
    px(c, 5, 8, 6, 1, PAL.gold);
    px(c, 6, 3, 4, 4, PAL.red);
    dot(c, 7, 9, PAL.gold);
  });
  makeTile(scene, "t_m", (c) => {
    px(c, 0, 0, TILE, TILE, "#6b6560");
    px(c, 0, 1, TILE, 4, PAL.crimson);
    px(c, 0, 5, TILE, 1, PAL.gold);
    px(c, 1, 6, 2, 10, "#5e4231");
    px(c, 13, 6, 2, 10, "#5e4231");
    px(c, 3, 9, 10, 5, "#7a6248");
    px(c, 4, 10, 3, 2, PAL.green);
    px(c, 9, 10, 3, 2, PAL.gold);
  });
  makeTile(scene, "t_%", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3028");
    px(c, 3, 0, 10, 14, PAL.crimson);
    px(c, 3, 0, 10, 1, PAL.gold);
    px(c, 5, 3, 6, 2, PAL.brightgold);
    px(c, 5, 7, 6, 2, PAL.brightgold);
    px(c, 3, 14, 10, 2, PAL.burgundy);
  });
  makeTile(scene, "t_*", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3028");
    px(c, 2, 5, 12, 9, "#5e4231");
    px(c, 2, 4, 12, 3, "#7a6248");
    px(c, 2, 8, 12, 1, PAL.gold);
    px(c, 7, 8, 3, 4, PAL.gold);
    dot(c, 8, 10, PAL.charcoal);
  });

  // --- bamboo -------------------------------------------------------------
  makeTile(scene, "t_j", (c) => {
    px(c, 0, 0, TILE, TILE, "#22381f");
    for (const x of [2, 7, 12]) {
      px(c, x, 0, 3, TILE, PAL.bamboo1);
      px(c, x, 0, 1, TILE, PAL.bamboo2);
      for (let y = 3; y < TILE; y += 6) px(c, x, y, 3, 1, "#33552a");
    }
    px(c, 5, 4, 2, 2, PAL.bamboo2);
    px(c, 10, 10, 2, 2, PAL.bamboo2);
  });
  makeTile(scene, "t_=", (c) => {
    px(c, 0, 0, TILE, TILE, "#22381f");
    for (const x of [1, 5, 9, 13]) {
      px(c, x, 0, 2, TILE, "#5f8f45");
      px(c, x, 0, 1, TILE, "#7db05c");
    }
    c.fillStyle = PAL.brightgold;
    c.globalAlpha = 0.22;
    c.fillRect(0, 0, TILE, TILE);
    c.globalAlpha = 1;
    for (let y = 2; y < TILE; y += 7) px(c, 0, y, TILE, 1, PAL.gold);
  });
  makeTile(scene, "t_z", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    px(c, 2, 2, 12, 12, "#5f5952");
    px(c, 3, 3, 10, 10, "#6b645c");
    px(c, 5, 5, 6, 6, PAL.gold);
    px(c, 6, 6, 4, 4, "#4f4a44");
  });
  makeTile(scene, "t_u", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    px(c, 4, 12, 8, 4, "#5f5952");
    px(c, 5, 5, 6, 8, "#8a827a");
    px(c, 5, 2, 6, 4, "#9a9289");
    dot(c, 6, 4, PAL.black);
    dot(c, 9, 4, PAL.black);
    px(c, 6, 7, 4, 1, "#6b645c");
    px(c, 4, 6, 1, 5, "#7a7269");
    px(c, 11, 6, 1, 5, "#7a7269");
  });
  makeTile(scene, "t_$", (c) => {
    px(c, 0, 0, TILE, TILE, "#22381f");
    px(c, 2, 4, 12, 8, PAL.offwhite);
    px(c, 2, 4, 12, 1, "#d6c49c");
    px(c, 1, 3, 2, 10, PAL.burgundy);
    px(c, 13, 3, 2, 10, PAL.burgundy);
    for (let y = 6; y < 11; y += 2) px(c, 4, y, 8, 1, PAL.charcoal);
  });

  // --- mountain -----------------------------------------------------------
  makeTile(scene, "t_+", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    px(c, 0, 0, TILE, 6, "#3d5a70");
    px(c, 1, 2, 5, 3, "#5e7f96");
    px(c, 9, 1, 6, 3, "#5e7f96");
    px(c, 0, 6, TILE, 1, PAL.gold);
    px(c, 3, 8, 10, 6, "#5f5952");
    px(c, 5, 9, 6, 4, "#6b645c");
  });
  makeTile(scene, "t_!", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    px(c, 4, 9, 8, 6, "#3a3028");
    px(c, 3, 8, 10, 2, "#5f5952");
    px(c, 5, 3, 6, 6, PAL.red);
    px(c, 6, 1, 4, 5, PAL.gold);
    px(c, 7, 0, 2, 4, PAL.brightgold);
  });
  makeTile(scene, "t_i", (c) => {
    px(c, 0, 0, TILE, TILE, "#4f4a44");
    px(c, 2, 1, 12, 14, "#6b645c");
    px(c, 3, 2, 10, 12, "#5f5952");
    for (let y = 4; y < 13; y += 3) px(c, 5, y, 6, 1, PAL.gold);
    px(c, 7, 3, 2, 1, PAL.gold);
  });

  // --- temple -------------------------------------------------------------
  makeTile(scene, "t_I", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3440");
    px(c, 4, 10, 8, 5, "#5b5563");
    px(c, 6, 4, 1, 7, PAL.offwhite);
    px(c, 9, 3, 1, 8, PAL.offwhite);
    dot(c, 6, 3, PAL.red);
    dot(c, 9, 2, PAL.red);
  });
  makeTile(scene, "t_&", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a3440");
    px(c, 6, 13, 4, 3, "#5b5563");
    px(c, 3, 4, 10, 9, PAL.crimson);
    px(c, 4, 3, 8, 2, PAL.gold);
    px(c, 4, 12, 8, 2, PAL.gold);
    px(c, 5, 6, 6, 5, PAL.red);
    px(c, 7, 7, 2, 3, PAL.brightgold);
    px(c, 7, 0, 2, 3, PAL.gold);
  });

  // --- cave ---------------------------------------------------------------
  makeTile(scene, "t_c", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.cave1);
    for (let y = 0; y < TILE; y += 6) px(c, 0, y, TILE, 2, PAL.cave2);
    px(c, 3, 3, 3, 2, "#3d3345");
    px(c, 10, 9, 4, 2, "#3d3345");
    dot(c, 6, 12, "#584a63");
  });
  makeTile(scene, "t_n", (c) => {
    px(c, 0, 0, TILE, TILE, "#2b2530");
    for (let i = 0; i < 20; i++) {
      const x = (i * 5) % TILE, y = (i * 9) % TILE;
      dot(c, x, y, i % 3 ? "#332c3a" : "#241f2a");
    }
  });

  // --- garden -------------------------------------------------------------
  makeTile(scene, "t_q", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a4a34");
    px(c, 7, 10, 2, 6, "#4a3226");
    px(c, 2, 1, 12, 10, PAL.petal1);
    px(c, 3, 0, 10, 3, PAL.petal2);
    px(c, 1, 4, 14, 4, PAL.petal1);
    for (const [x, y] of [[4, 3], [10, 5], [7, 8]]) dot(c, x, y, "#f0bcd0");
  });
  makeTile(scene, "t_v", (c) => {
    px(c, 0, 0, TILE, TILE, "#3a4a34");
    for (let i = 0; i < 16; i++) {
      const x = (i * 7) % TILE, y = (i * 5) % TILE;
      dot(c, x, y, i % 2 ? PAL.petal2 : PAL.petal1);
    }
    dot(c, 4, 12, "#f0bcd0");
    dot(c, 12, 3, "#f0bcd0");
  });
  makeTile(scene, "t_~", (c) => {
    px(c, 0, 0, TILE, TILE, "#5a4632");
    px(c, 3, 4, 10, 8, "#4a3a28");
    for (const [x, y] of [[5, 6], [9, 8], [7, 10]]) px(c, x, y, 2, 1, "#3c2f20");
    px(c, 4, 3, 8, 1, "#6b5540");
  });
}
