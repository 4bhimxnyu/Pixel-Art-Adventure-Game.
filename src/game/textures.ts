// ---------------------------------------------------------------------------
// 100% procedural pixel art. No image files anywhere in the project.
//
// Everything is painted into an offscreen canvas at 16x16 (tiles) or as an
// 8-frame strip (characters: 4 directions x 2 walk frames) and registered as a
// Phaser texture. Character strips are added as sprite sheets so WorldScene can
// address frames 0..7.
// ---------------------------------------------------------------------------

import Phaser from "phaser";

export const TILE = 16;

export const PAL = {
  black: "#0a0507",
  charcoal: "#1a0f12",
  crimson: "#8f1a24",
  red: "#b3252f",
  burgundy: "#7c141f",
  gold: "#d9b45b",
  brightgold: "#f2dfa6",
  offwhite: "#f7e6c8",
  green: "#7ddca4",

  grass1: "#2c4a32",
  grass2: "#35583b",
  grass3: "#243d29",
  dirt1: "#5a4632",
  dirt2: "#6b5540",
  stone1: "#4a4550",
  stone2: "#5b5563",
  stone3: "#39353f",
  water1: "#1e3a52",
  water2: "#2b5171",
  wood1: "#4a3226",
  wood2: "#5e4231",
  bamboo1: "#4f7a3a",
  bamboo2: "#679a4c",
  petal1: "#c9748f",
  petal2: "#e39cb2",
  cave1: "#221c28",
  cave2: "#2f2735",
  skin: "#e8b48c",
  skinShade: "#c1875f",
  hair: "#150d12",
  hairHi: "#2a1a24",
  white: "#f2f2ee",
} as const;

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function dot(c: Ctx, x: number, y: number, color: string) {
  px(c, x, y, 1, 1, color);
}

/** Deterministic per-tile scatter so tiles never shimmer between reloads. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: Ctx) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const c = tex.getContext();
  c.clearRect(0, 0, w, h);
  paint(c);
  tex.refresh();
}

export function makeTile(scene: Phaser.Scene, key: string, paint: (c: Ctx) => void) {
  makeCanvas(scene, key, TILE, TILE, paint);
}

// --------------------------------------------------------------------------- ground

function grass(c: Ctx, seed: number, base: string = PAL.grass1, alt: string = PAL.grass2) {
  px(c, 0, 0, TILE, TILE, base);
  const r = rng(seed);
  for (let i = 0; i < 22; i++) dot(c, Math.floor(r() * TILE), Math.floor(r() * TILE), r() > 0.5 ? alt : PAL.grass3);
}

function path(c: Ctx, seed: number) {
  px(c, 0, 0, TILE, TILE, PAL.dirt1);
  const r = rng(seed);
  for (let i = 0; i < 26; i++) dot(c, Math.floor(r() * TILE), Math.floor(r() * TILE), r() > 0.6 ? PAL.dirt2 : "#4c3a2a");
}

// --------------------------------------------------------------------------- base tiles

export function buildBaseTiles(scene: Phaser.Scene) {
  makeTile(scene, "t_.", (c) => grass(c, 11));
  makeTile(scene, "t_,", (c) => path(c, 23));
  makeTile(scene, "t_g", (c) => {
    grass(c, 31, PAL.grass3, PAL.grass1);
    for (let x = 1; x < TILE; x += 4) {
      px(c, x, 6, 1, 8, PAL.grass2);
      px(c, x + 1, 9, 1, 5, "#417a49");
      dot(c, x, 5, "#4f8f57");
    }
  });
  makeTile(scene, "t_F", (c) => {
    grass(c, 41);
    const spots = [[3, 4], [10, 6], [6, 11], [12, 12]];
    for (const [x, y] of spots) {
      px(c, x, y, 2, 2, PAL.red);
      dot(c, x, y, PAL.brightgold);
    }
  });
  makeTile(scene, "t_w", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.water1);
    for (let y = 2; y < TILE; y += 5) {
      px(c, 1, y, 6, 1, PAL.water2);
      px(c, 9, y + 2, 5, 1, PAL.water2);
    }
  });
  makeTile(scene, "t_o", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.water2);
    px(c, 0, 0, TILE, 2, PAL.water1);
    for (let y = 4; y < TILE; y += 6) px(c, 2, y, 9, 1, "#3d6d92");
  });
  makeTile(scene, "t_t", (c) => {
    px(c, 7, 10, 2, 6, PAL.wood1);
    px(c, 3, 2, 10, 9, "#204a2b");
    px(c, 4, 1, 8, 2, "#2b5c35");
    px(c, 2, 5, 12, 4, "#265231");
    for (const [x, y] of [[5, 4], [10, 6], [7, 8]]) dot(c, x, y, "#1a3d23");
  });
  makeTile(scene, "t_#", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.stone1);
    px(c, 0, 0, TILE, 2, PAL.stone2);
    for (let y = 2; y < TILE; y += 5) px(c, 0, y, TILE, 1, PAL.stone3);
    for (let x = 3; x < TILE; x += 6) px(c, x, 2, 1, TILE - 2, PAL.stone3);
  });
  makeTile(scene, "t_f", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.wood2);
    for (let y = 0; y < TILE; y += 4) px(c, 0, y, TILE, 1, PAL.wood1);
    dot(c, 4, 2, "#6d4d38");
    dot(c, 11, 9, "#6d4d38");
  });
  makeTile(scene, "t_r", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.burgundy);
    px(c, 1, 1, TILE - 2, TILE - 2, PAL.crimson);
    px(c, 3, 3, TILE - 6, TILE - 6, PAL.red);
    px(c, 6, 6, 4, 4, PAL.gold);
  });
  makeTile(scene, "t_b", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.wood1);
    px(c, 1, 2, 14, 12, PAL.offwhite);
    px(c, 1, 2, 14, 4, PAL.crimson);
    px(c, 3, 3, 4, 2, PAL.brightgold);
    px(c, 1, 13, 14, 2, PAL.wood2);
  });
  makeTile(scene, "t_B", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.wood1);
    px(c, 1, 1, 14, 6, PAL.charcoal);
    px(c, 1, 8, 14, 6, PAL.charcoal);
    const cols = [PAL.red, PAL.gold, PAL.green, PAL.offwhite, PAL.crimson];
    for (let i = 0; i < 5; i++) {
      px(c, 2 + i * 3, 2, 2, 4, cols[i]);
      px(c, 2 + i * 3, 9, 2, 4, cols[(i + 2) % 5]);
    }
  });
  makeTile(scene, "t_D", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.wood2);
    px(c, 0, 3, TILE, 3, PAL.wood1);
    px(c, 2, 6, 3, 8, PAL.wood1);
    px(c, 11, 6, 3, 8, PAL.wood1);
    px(c, 5, 0, 5, 3, PAL.offwhite);
  });
  makeTile(scene, "t_T", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.charcoal);
    px(c, 1, 2, 14, 10, PAL.black);
    px(c, 2, 3, 12, 8, "#20404f");
    px(c, 4, 5, 4, 3, "#3f6f85");
    px(c, 6, 12, 4, 3, PAL.stone3);
  });
  makeTile(scene, "t_s", (c) => {
    px(c, 3, 3, 10, 7, PAL.wood2);
    px(c, 3, 3, 10, 1, PAL.gold);
    px(c, 7, 10, 2, 5, PAL.wood1);
    for (let i = 0; i < 3; i++) px(c, 5, 5 + i * 2, 6, 1, PAL.offwhite);
  });
  makeTile(scene, "t_d", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.stone3);
    px(c, 2, 1, 12, 15, PAL.wood1);
    px(c, 3, 2, 10, 13, PAL.crimson);
    px(c, 7, 2, 2, 13, PAL.wood1);
    dot(c, 11, 8, PAL.gold);
  });
  makeTile(scene, "t__", (c) => px(c, 0, 0, TILE, TILE, PAL.black));
  makeTile(scene, "t_e", (c) => {
    px(c, 0, 0, TILE, TILE, PAL.water1);
    px(c, 0, 3, TILE, 10, PAL.wood2);
    for (let x = 0; x < TILE; x += 4) px(c, x, 3, 1, 10, PAL.wood1);
    px(c, 0, 3, TILE, 1, PAL.gold);
    px(c, 0, 12, TILE, 1, PAL.wood1);
  });
  makeTile(scene, "t_^", (c) => {
    px(c, 2, 5, 12, 9, PAL.stone1);
    px(c, 3, 4, 10, 2, PAL.stone2);
    px(c, 4, 8, 3, 2, PAL.stone3);
    px(c, 9, 11, 3, 2, PAL.stone3);
  });
  makeTile(scene, "t_y", (c) => {
    px(c, 5, 6, 6, 6, PAL.red);
    px(c, 6, 5, 4, 8, PAL.red);
    px(c, 6, 7, 2, 2, "#e0616b");
    px(c, 5, 9, 6, 1, PAL.burgundy);
  });
  makeTile(scene, "t_p", (c) => {
    const paws = [[3, 4], [9, 8], [5, 12]];
    for (const [x, y] of paws) {
      px(c, x, y, 2, 2, PAL.charcoal);
      dot(c, x - 1, y - 1, PAL.charcoal);
      dot(c, x + 2, y - 1, PAL.charcoal);
    }
  });
  // hidden pickup: a small glint, readable on any ground (indoor or out)
  makeTile(scene, "t_h", (c) => {
    px(c, 7, 4, 2, 8, PAL.brightgold);
    px(c, 4, 7, 8, 2, PAL.brightgold);
    px(c, 6, 6, 4, 4, PAL.offwhite);
    dot(c, 7, 7, PAL.gold);
  });
}

// --------------------------------------------------------------------------- characters

type CharSpec = {
  hair: string;
  hairAlt?: string;
  outfit: string;
  outfitAlt: string;
  trim: string;
  skin: string;
  longHair?: boolean;
  guitar?: boolean;
  heavy?: boolean;
};

/**
 * Paints one 16x16 character frame.
 * dir: 0 down, 1 up, 2 left, 3 right. step: 0 or 1 (walk cycle).
 */
function paintChar(c: Ctx, ox: number, spec: CharSpec, dir: number, step: number) {
  const X = (x: number) => ox + x;
  const bob = step === 1 ? 1 : 0;
  const skin = spec.skin;

  // legs
  const legY = 12 + bob;
  if (step === 0) {
    px(c, X(5), legY, 2, 4 - bob, PAL.charcoal);
    px(c, X(9), legY, 2, 4 - bob, PAL.charcoal);
  } else {
    px(c, X(4), legY, 3, 3, PAL.charcoal);
    px(c, X(9), legY, 3, 3, PAL.charcoal);
  }

  // robe / body
  px(c, X(4), 8 - bob, 8, 5, spec.outfit);
  px(c, X(4), 8 - bob, 8, 1, spec.outfitAlt);
  px(c, X(4), 11 - bob, 8, 1, spec.trim);
  if (spec.heavy) px(c, X(3), 9 - bob, 10, 3, spec.outfit);

  // sash
  px(c, X(5), 10 - bob, 6, 1, spec.trim);

  // arms
  const armY = 9 - bob;
  px(c, X(3), armY, 1, 3, spec.outfitAlt);
  px(c, X(12), armY, 1, 3, spec.outfitAlt);

  // head
  px(c, X(5), 3 - bob, 6, 5, skin);
  px(c, X(4), 2 - bob, 8, 3, spec.hair);
  px(c, X(4), 4 - bob, 1, 3, spec.hair);
  px(c, X(11), 4 - bob, 1, 3, spec.hair);
  if (spec.hairAlt) px(c, X(5), 2 - bob, 3, 1, spec.hairAlt);
  if (spec.longHair) {
    px(c, X(3), 4 - bob, 1, 7, spec.hair);
    px(c, X(12), 4 - bob, 1, 7, spec.hair);
  }

  // face — only when facing the camera or sideways
  if (dir === 0) {
    dot(c, X(6), 5 - bob, PAL.black);
    dot(c, X(9), 5 - bob, PAL.black);
    px(c, X(7), 7 - bob, 2, 1, PAL.skinShade);
  } else if (dir === 2) {
    dot(c, X(6), 5 - bob, PAL.black);
    px(c, X(4), 5 - bob, 1, 1, PAL.skinShade);
  } else if (dir === 3) {
    dot(c, X(9), 5 - bob, PAL.black);
    px(c, X(11), 5 - bob, 1, 1, PAL.skinShade);
  } else {
    // facing away: back of the head only
    px(c, X(5), 3 - bob, 6, 4, spec.hair);
  }

  // white guitar on the back
  if (spec.guitar) {
    if (dir === 1) {
      px(c, X(5), 7 - bob, 6, 6, PAL.white);
      px(c, X(7), 4 - bob, 2, 4, "#d8d4cc");
      px(c, X(7), 9 - bob, 2, 2, PAL.charcoal);
    } else {
      px(c, X(12), 6 - bob, 2, 6, PAL.white);
      px(c, X(12), 3 - bob, 1, 4, "#d8d4cc");
    }
  }
}

const CHARS: Record<string, CharSpec> = {
  palakshi:  { hair: PAL.hair, hairAlt: PAL.gold, outfit: "#141018", outfitAlt: "#241c2a", trim: PAL.gold, skin: PAL.skin, longHair: true },
  abhimanyu: { hair: "#1d1414", outfit: "#2b3a52", outfitAlt: "#3b4e6b", trim: PAL.offwhite, skin: "#d9a074", guitar: true },
  bidisha:   { hair: "#2a1a1a", outfit: PAL.burgundy, outfitAlt: PAL.crimson, trim: PAL.gold, skin: PAL.skin, longHair: true },
  prakriti:  { hair: "#191021", outfit: "#1f6b6b", outfitAlt: "#5a3d78", trim: PAL.brightgold, skin: "#e5b291", longHair: true },
  arshiya:   { hair: "#241018", outfit: "#3d0f18", outfitAlt: PAL.burgundy, trim: PAL.brightgold, skin: "#dda57f", longHair: true, heavy: true },
  kaajal:    { hair: "#1b1218", outfit: "#25304a", outfitAlt: "#39476b", trim: PAL.offwhite, skin: PAL.skin, longHair: true },
  elder:     { hair: "#c9c4bb", outfit: "#4a3c52", outfitAlt: "#5d4d66", trim: PAL.gold, skin: "#cfa079" },
  townie:    { hair: "#3a2a20", outfit: "#3f5a45", outfitAlt: "#4d6d54", trim: PAL.offwhite, skin: "#dfa87e" },
  villager:  { hair: "#4a3020", outfit: "#5a4232", outfitAlt: "#6b5140", trim: PAL.gold, skin: "#d9a074" },
  monk:      { hair: "#c9a05a", outfit: PAL.crimson, outfitAlt: "#a3202c", trim: PAL.brightgold, skin: "#d9a074" },
  merchant:  { hair: "#2a2018", outfit: "#2f4a5c", outfitAlt: "#3d5e73", trim: PAL.gold, skin: "#e0a67e" },
  musician:  { hair: "#22181c", outfit: "#4a2f52", outfitAlt: "#5e3d68", trim: PAL.brightgold, skin: "#d9a074", guitar: true },
  gatekeeper:{ hair: "#1c1c1c", outfit: PAL.charcoal, outfitAlt: "#2a2028", trim: PAL.red, skin: "#c98f68" },
};

export function buildCharacters(scene: Phaser.Scene) {
  for (const [key, spec] of Object.entries(CHARS)) {
    const texKey = `ch_${key}`;
    if (scene.textures.exists(texKey)) continue;
    const tex = scene.textures.createCanvas(texKey, TILE * 8, TILE);
    if (!tex) continue;
    const c = tex.getContext();
    c.clearRect(0, 0, TILE * 8, TILE);
    let i = 0;
    for (let dir = 0; dir < 4; dir++) {
      for (let step = 0; step < 2; step++) {
        paintChar(c, i * TILE, spec, dir, step);
        i++;
      }
    }
    tex.refresh();
    for (let f = 0; f < 8; f++) tex.add(f, 0, f * TILE, 0, TILE, TILE);
  }
}

// --------------------------------------------------------------------------- Mimo

function paintDog(c: Ctx, ox: number, dir: number, step: number) {
  const X = (x: number) => ox + x;
  const bob = step === 1 ? 1 : 0;
  const body = PAL.white;
  const patch = "#c9a06a";

  px(c, X(3), 9 - bob, 9, 5, body);
  px(c, X(4), 8 - bob, 6, 2, body);
  px(c, X(7), 9 - bob, 4, 3, patch);

  // legs
  if (step === 0) {
    px(c, X(4), 13 - bob, 2, 2, body);
    px(c, X(9), 13 - bob, 2, 2, body);
  } else {
    px(c, X(3), 13 - bob, 2, 2, body);
    px(c, X(10), 13 - bob, 2, 2, body);
  }

  // tail
  px(c, X(12), 7 - bob, 2, 3, body);
  dot(c, X(13), 6 - bob, patch);

  // head
  const hx = dir === 2 ? 1 : dir === 3 ? 5 : 3;
  px(c, X(hx), 4 - bob, 6, 6, body);
  px(c, X(hx), 3 - bob, 2, 3, patch);
  px(c, X(hx + 4), 3 - bob, 2, 3, patch);
  if (dir !== 1) {
    dot(c, X(hx + 1), 6 - bob, PAL.black);
    dot(c, X(hx + 4), 6 - bob, PAL.black);
    px(c, X(hx + 2), 8 - bob, 2, 1, "#2a1a1a");
  }
}

export function buildDog(scene: Phaser.Scene) {
  const key = "ch_mimo";
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, TILE * 8, TILE);
  if (!tex) return;
  const c = tex.getContext();
  c.clearRect(0, 0, TILE * 8, TILE);
  let i = 0;
  for (let dir = 0; dir < 4; dir++) {
    for (let step = 0; step < 2; step++) {
      paintDog(c, i * TILE, dir, step);
      i++;
    }
  }
  tex.refresh();
  for (let f = 0; f < 8; f++) tex.add(f, 0, f * TILE, 0, TILE, TILE);
}

// --------------------------------------------------------------------------- enemy field sprites

type EnemySpec = { body: string; accent: string; shape: "small" | "bird" | "beast" | "spirit" | "tall" };

const ENEMY_ART: Record<string, EnemySpec> = {
  bunny:   { body: "#cfe0d2", accent: "#7ddca4", shape: "small" },
  sparrow: { body: "#8a6f4f", accent: PAL.offwhite, shape: "bird" },
  wolf:    { body: "#4d4a55", accent: "#8a8698", shape: "beast" },
  monkey:  { body: "#8a5a34", accent: "#c99a68", shape: "beast" },
  moth:    { body: "#c9a0c0", accent: PAL.petal2, shape: "bird" },
  spirit:  { body: "#5d9a5a", accent: "#a8e08a", shape: "spirit" },
  crane:   { body: PAL.white, accent: PAL.red, shape: "bird" },
  bat:     { body: "#4a3a52", accent: "#7a5f88", shape: "bird" },
  boar:    { body: "#5a4a3a", accent: "#8a7458", shape: "beast" },
  serpent: { body: "#3a6a58", accent: "#7ddca4", shape: "tall" },
  guardian:{ body: "#6a5a48", accent: PAL.gold, shape: "tall" },
};

export function buildEnemies(scene: Phaser.Scene) {
  for (const [key, s] of Object.entries(ENEMY_ART)) {
    makeCanvas(scene, `en_${key}`, 32, 32, (c) => {
      const B = s.body, A = s.accent;
      switch (s.shape) {
        case "small":
          px(c, 8, 16, 16, 12, B);
          px(c, 11, 8, 4, 9, B);
          px(c, 17, 8, 4, 9, B);
          px(c, 10, 12, 12, 10, B);
          px(c, 13, 16, 2, 2, PAL.black);
          px(c, 18, 16, 2, 2, PAL.black);
          px(c, 15, 20, 3, 2, A);
          break;
        case "bird":
          px(c, 12, 12, 10, 12, B);
          px(c, 4, 14, 9, 6, A);
          px(c, 21, 14, 8, 6, A);
          px(c, 14, 8, 7, 6, B);
          px(c, 16, 10, 2, 2, PAL.black);
          px(c, 21, 11, 4, 2, PAL.gold);
          break;
        case "beast":
          px(c, 5, 14, 22, 11, B);
          px(c, 20, 8, 9, 9, B);
          px(c, 26, 11, 2, 2, PAL.red);
          px(c, 22, 5, 3, 4, A);
          px(c, 27, 5, 3, 4, A);
          px(c, 7, 25, 4, 5, B);
          px(c, 20, 25, 4, 5, B);
          px(c, 2, 13, 5, 4, A);
          break;
        case "spirit":
          px(c, 10, 4, 12, 24, B);
          px(c, 8, 8, 16, 14, B);
          px(c, 12, 11, 3, 3, PAL.black);
          px(c, 18, 11, 3, 3, PAL.black);
          px(c, 13, 18, 7, 2, A);
          for (let y = 26; y < 31; y += 2) px(c, 9 + (y % 4), y, 14, 1, A);
          break;
        case "tall":
          px(c, 11, 2, 11, 28, B);
          px(c, 8, 6, 17, 10, B);
          px(c, 12, 9, 3, 3, PAL.red);
          px(c, 19, 9, 3, 3, PAL.red);
          px(c, 13, 14, 8, 2, A);
          px(c, 9, 20, 15, 3, A);
          break;
      }
    });
  }
}

// --------------------------------------------------------------------------- props

export function buildProps(scene: Phaser.Scene) {
  // interaction sparkle for highlighted objects
  makeCanvas(scene, "fx_spark", 8, 8, (c) => {
    px(c, 3, 0, 2, 8, PAL.brightgold);
    px(c, 0, 3, 8, 2, PAL.brightgold);
    px(c, 2, 2, 4, 4, PAL.offwhite);
  });
  makeCanvas(scene, "fx_petal", 6, 6, (c) => {
    px(c, 1, 1, 4, 4, PAL.petal2);
    px(c, 2, 0, 2, 6, PAL.petal1);
  });
  makeCanvas(scene, "fx_leaf", 6, 6, (c) => {
    px(c, 1, 1, 4, 3, "#5d9a5a");
    px(c, 0, 2, 6, 1, "#7dba6a");
  });
  makeCanvas(scene, "fx_butterfly", 8, 6, (c) => {
    px(c, 0, 0, 3, 4, PAL.gold);
    px(c, 5, 0, 3, 4, PAL.gold);
    px(c, 3, 1, 2, 4, PAL.charcoal);
  });
  makeCanvas(scene, "fx_bird", 9, 4, (c) => {
    px(c, 0, 1, 4, 1, PAL.charcoal);
    px(c, 5, 1, 4, 1, PAL.charcoal);
    px(c, 3, 2, 3, 1, PAL.charcoal);
  });
  makeCanvas(scene, "fx_glow", 24, 24, (c) => {
    c.fillStyle = PAL.gold;
    c.globalAlpha = 0.16;
    c.beginPath();
    c.arc(12, 12, 11, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.3;
    c.beginPath();
    c.arc(12, 12, 6, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  });
  makeCanvas(scene, "fx_shadow", 12, 5, (c) => {
    c.fillStyle = "#000000";
    c.globalAlpha = 0.3;
    c.beginPath();
    c.ellipse(6, 2.5, 5.5, 2.2, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  });
}

export function buildAll(scene: Phaser.Scene) {
  buildBaseTiles(scene);
  buildCharacters(scene);
  buildDog(scene);
  buildEnemies(scene);
  buildProps(scene);
}
