// ---------------------------------------------------------------------------
// Character identity specs for the 3D rigs. Colours come straight from the
// pixel sprites and portraits, so every character keeps the look the player
// already knows. New cast (F-1205) follows the written descriptions.
//
// Silhouettes matter more than colours at a distance, so every spec also
// sets proportions (shoulders, hips, belly, head, legs), an outfit TYPE with
// its own geometry (robe, dress, tee, jacket, tank, cardigan, vest, hoodie),
// a sleeve style, a hair style, and optional cape / headdress / necklace.
//
// A GLB at public/models/<id>.glb overrides the procedural rig automatically
// (see CharacterRig.ts), so reference-based models can be dropped in later
// without touching code.
// ---------------------------------------------------------------------------

/**
 * Every style is built from the same base (a scalp cap that clears the brows,
 * temples and cheeks, plus a curved hairline band) and adds volume on top:
 * - quiff: thick hair swept back and up off the forehead, falling to the ears and nape (Garv)
 * - sidepart: medium hair with a side parting and a soft sweep across the forehead (Hakim)
 * - wavy: messy, slightly wavy hair with volume on top, pushed back off the forehead (Dev)
 * - lowbun: pulled back tight with a centre parting into a low bun at the nape (Riddhi)
 */
export type HairStyle =
  | "long" | "ponytail" | "braid" | "bun" | "messybun" | "lowbun" | "headdress" | "short" | "spiky" | "messy" | "shoulder" | "curly" | "crop" | "bald" | "grey"
  | "quiff" | "sidepart" | "wavy";

/** "polo" = knitted collared polo / sweater with a three-button placket. "hoodie" is a zip-up worn open over the `top` tee. */
export type Outfit = "robe" | "dress" | "tee" | "jacket" | "tank" | "cardigan" | "vest" | "hoodie" | "polo";

export type CharSpec = {
  id: string;
  skin: string;
  hair: string;
  hairHi?: string;
  hairStyle: HairStyle;
  /** Shirt / upper layer colour. */
  top: string;
  /** Second upper colour: sleeves, jacket, cardigan, hood. */
  topAlt: string;
  /** Trousers / skirt colour. */
  bottom: string;
  /** Sash, belt, hems, collar. */
  trim: string;
  outfit: Outfit;
  sleeves: "wide" | "long" | "short" | "none";
  /** Extra width on wide sleeves (Arshiya's are enormous). */
  sleeveScale?: number;
  /** Skirt length as a fraction of leg length (robe / dress). */
  skirt?: number;
  cape?: boolean;
  headdress?: boolean;
  necklace?: boolean;
  female?: boolean;
  /** Body proportions. */
  build: "slim" | "average" | "heavy" | "muscular" | "elder";
  /** Multipliers on top of the build: 1 = the build's default. */
  shoulders?: number;
  hips?: number;
  belly?: number;
  headSize?: number;
  legs?: number;
  /** Overall scale, 1 = adult. */
  height?: number;
  eyes?: "almond" | "round";
  /** Half-lidded, relaxed eyes (Dev). */
  sleepy?: boolean;
  /** Dark lash line along the upper lid. Defaults to `female`. */
  lashes?: boolean;
  /** Brow weight: "strong" = thick, heavy brows; "thin" = fine brows. */
  brows?: "strong" | "thin";
  /** Full beard colour (boxes over the lower face). */
  beard?: string;
  /** A long beard hanging below the chin (elder). Needs `beard`. */
  beardLong?: boolean;
  /** Light stubble along the jaw and chin: the colour of the shadow. */
  stubble?: string;
  /** Moustache colour. */
  moustache?: string;
  /** true = thin round frames; "large" = big black rounded-rectangular frames; "rect" = slim black rectangular frames. */
  glasses?: boolean | "large" | "rect";
  /** Eye colour (iris). Defaults to dark brown. */
  iris?: string;
  /** A closed-mouth, slightly lopsided smile. */
  smirk?: boolean;
  /** A closed-mouth smile with both corners lifted. */
  smile?: boolean;
  /** Bracelet colour on the left wrist. */
  bracelet?: string;
  /** "beads" (default) = chunky bead bracelet; "thread" = a thin string bracelet. */
  braceletStyle?: "beads" | "thread";
  /** A wrist watch on the left wrist. */
  watch?: boolean;
  /** A small patch on the left upper sleeve (Hakim's "3"). The colour of the patch. */
  patch?: string;
  /** V-neck on a tee / tank. */
  vneck?: boolean;
  /** Wide horizontal stripes across the top and sleeves, in this colour (Garv's polo). */
  stripes?: string;
  /** A drawstring hanging from the waistband (Dev's trousers). */
  drawstring?: boolean;
  /** Trouser cloth. "checker" = green-and-white checks on loose, flared legs. */
  bottomPattern?: "checker";
  /** Trouser width multiplier (loose fits > 1). */
  legWidth?: number;
  /** Footwear. Defaults to dark shoes (or sneakers when `sneakers` is set). */
  footwear?: "sneakers" | "shoes" | "sandals" | "boots";
  /** Only Abhimanyu may carry an instrument. */
  props?: ("bass" | "ipad" | "staff" | "fan" | "phone")[];
  /**
   * Idle behaviour. "hips" = both hands on the hips, weight on one leg, chin
   * up (Riddhi). "stretch" = arms folded behind the head, a lazy stretch (Dev).
   */
  idle?: "default" | "ipad" | "lift" | "crossed" | "lean" | "strum" | "sway" | "phone" | "hips" | "stretch";
  /** Walk-cycle bob multiplier (1 = normal; Riddhi bounces). */
  bounce?: number;
  /** Hoop earring colour. */
  earrings?: string;
  /** A wide grin instead of the small mouth. */
  grin?: boolean;
  /** Chunky white sneakers instead of dark shoes (alias for footwear: "sneakers"). */
  sneakers?: boolean;
  /** Hair ornament colour (Palakshi's gold tie, Prakriti's teal ribbon). */
  ornament?: string;
  accent?: string;
};

export const CHARACTERS: Record<string, CharSpec> = {
  // ------------------------------------------------------------ friends
  // Riddhi: Palakshi's chaotic best friend. From her photo: medium-warm brown
  // skin, dark hair pulled back tight into a low bun at the nape with a centre
  // parting, slim black rectangular glasses, small gold hoops, a white V-neck
  // sleeveless tank, light-wash wide-leg jeans with a visible waistband, a
  // white bead bracelet on the left wrist, hands on her hips, a closed-mouth
  // confident smirk. Jolly and bouncy when she walks. No phone.
  // (public/models/riddhi.glb still overrides.)
  riddhi: {
    id: "riddhi", skin: "#c48860", hair: "#1c120f", hairHi: "#30201a", hairStyle: "lowbun",
    top: "#f4f1e8", topAlt: "#e9e4d6", bottom: "#93b3d0", trim: "#f4f1e8",
    outfit: "tank", sleeves: "none", vneck: true, legWidth: 1.5, female: true,
    build: "slim", shoulders: 1.06, hips: 1.02, legs: 1.02, height: 0.99,
    eyes: "almond", iris: "#2a1810", glasses: "rect", smirk: true, lashes: true, earrings: "#d4af37",
    bracelet: "#f2ece0", braceletStyle: "beads", footwear: "sneakers", bounce: 1.4,
    props: [], idle: "hips", ornament: "#1c120f", accent: "#ff5c8a",
  },

  // ------------------------------------------------------------ protagonist
  // Reference: young woman, shoulder-length dark hair with a parted fringe
  // above the brows, large black rounded-rectangular glasses, black top under
  // a black cardigan, loose green-and-white checkered trousers, almond eyes.
  palakshi: {
    id: "palakshi", skin: "#e8b48c", hair: "#150d12", hairHi: "#2a1a24", hairStyle: "shoulder",
    top: "#141216", topAlt: "#1c1a1f", bottom: "#3f8a4f", trim: "#2a2a2e",
    outfit: "cardigan", sleeves: "long", bottomPattern: "checker", legWidth: 1.5, female: true,
    build: "slim", shoulders: 0.95, legs: 1.05, eyes: "almond", iris: "#2e1a12", glasses: "large", footwear: "shoes",
  },

  // ---------------------------------------------------------------- party
  // Reference: slim young man, dark medium-length messy hair with a fringe
  // that stays above the eyes, light blue denim jacket open over a black
  // T-shirt, loose black jeans, white sneakers, the white bass.
  abhimanyu: {
    id: "abhimanyu", skin: "#d9a074", hair: "#1d1414", hairHi: "#2c2020", hairStyle: "messy",
    top: "#17171a", topAlt: "#7fa3cf", bottom: "#1c1c20", trim: "#5f86b5",
    outfit: "jacket", sleeves: "long", legWidth: 1.15, footwear: "sneakers",
    build: "slim", shoulders: 1.0, eyes: "almond", props: ["bass"], idle: "strum", accent: "#5f86b5",
  },

  // ------------------------------------------------------------ rivals
  prakriti: {
    id: "prakriti", skin: "#e5b291", hair: "#191021", hairStyle: "long",
    top: "#1f6b6b", topAlt: "#2a8a8a", bottom: "#5a3d78", trim: "#f2dfa6",
    outfit: "dress", sleeves: "long", skirt: 0.92, necklace: true, female: true,
    build: "slim", shoulders: 0.9, hips: 1.05, legs: 1.05, eyes: "almond", iris: "#2a1a26",
    brows: "thin", smirk: true, footwear: "boots", ornament: "#2fa3a3", accent: "#2fa3a3",
  },
  // Arshiya: the heavy, towering villain in crimson and gold: enormous sleeves,
  // a cape, the gold headdress, strong brows, hoops, a fan.
  arshiya: {
    id: "arshiya", skin: "#dda57f", hair: "#241018", hairHi: "#3a1a26", hairStyle: "headdress",
    top: "#3d0f18", topAlt: "#5c1220", bottom: "#1a0608", trim: "#f2dfa6",
    outfit: "robe", sleeves: "wide", sleeveScale: 1.9, skirt: 1.0, cape: true, headdress: true, necklace: true, female: true,
    build: "heavy", shoulders: 1.35, hips: 1.35, belly: 1.35, headSize: 1.05, height: 1.18,
    eyes: "almond", iris: "#1a0c10", brows: "strong", earrings: "#d9b45b", footwear: "boots",
    ornament: "#f2dfa6", accent: "#d9b45b", props: ["fan"],
  },

  // ------------------------------------------------------------ family / story
  // Bidisha: Palakshi's mother. A neat bun with a gold stick, a warm smile, red robe.
  bidisha: {
    id: "bidisha", skin: "#e8b48c", hair: "#2a1a1a", hairHi: "#3d2a2a", hairStyle: "bun",
    top: "#7c141f", topAlt: "#8f1a24", bottom: "#5a0f18", trim: "#d9b45b",
    outfit: "robe", sleeves: "wide", skirt: 0.95, female: true,
    build: "average", eyes: "almond", smile: true, footwear: "boots", ornament: "#d9b45b",
  },
  // Kaajal: long straight hair, thin round glasses, fine brows, navy robe.
  kaajal: {
    id: "kaajal", skin: "#e8b48c", hair: "#1b1218", hairHi: "#2c2030", hairStyle: "long",
    top: "#25304a", topAlt: "#39476b", bottom: "#1a2236", trim: "#f7e6c8",
    outfit: "robe", sleeves: "long", skirt: 0.95, female: true,
    build: "slim", eyes: "almond", iris: "#2a1c16", brows: "thin", glasses: true, footwear: "boots",
  },
  // Elder: white hair at the temples, a long white beard, bushy white brows, a staff.
  elder: {
    id: "elder", skin: "#cfa079", hair: "#c9c4bb", hairHi: "#e2ded6", hairStyle: "grey",
    top: "#4a3c52", topAlt: "#5d4d66", bottom: "#3a2e40", trim: "#d9b45b",
    outfit: "robe", sleeves: "wide", skirt: 1.0,
    build: "elder", eyes: "almond", brows: "strong", beard: "#c9c4bb", beardLong: true, props: ["staff"], height: 0.96, footwear: "boots",
  },
  // Townie: a short local in a striped green tee and sandals.
  townie: {
    id: "townie", skin: "#dfa87e", hair: "#3a2a20", hairStyle: "short",
    top: "#3f5a45", topAlt: "#4d6d54", bottom: "#2e3a30", trim: "#f7e6c8", stripes: "#f7e6c8",
    outfit: "tee", sleeves: "short", footwear: "sandals",
    build: "average", eyes: "almond", height: 0.9, smile: true,
  },
  // Villager: a bun, an earth-toned dress, a kind smile, sandals.
  villager: {
    id: "villager", skin: "#d9a074", hair: "#4a3020", hairHi: "#5e4030", hairStyle: "bun",
    top: "#5a4232", topAlt: "#6b5140", bottom: "#3a2a20", trim: "#d9b45b",
    outfit: "dress", sleeves: "long", skirt: 0.9, female: true,
    build: "average", eyes: "almond", smile: true, footwear: "sandals",
  },
  // Monk: shaved head, serene smile, crimson robe, sandals.
  monk: {
    id: "monk", skin: "#d9a074", hair: "#d9a074", hairStyle: "bald",
    top: "#8f1a24", topAlt: "#a3202c", bottom: "#6a1018", trim: "#f2dfa6",
    outfit: "robe", sleeves: "wide", skirt: 1.0, footwear: "sandals",
    build: "average", eyes: "almond", smile: true, props: ["staff"],
  },
  // Merchant: heavy-set, cropped hair, a moustache, a vest over a pale shirt.
  merchant: {
    id: "merchant", skin: "#e0a67e", hair: "#2a2018", hairStyle: "crop",
    top: "#2f4a5c", topAlt: "#8fa3b5", bottom: "#243a48", trim: "#d9b45b",
    outfit: "vest", sleeves: "long",
    build: "heavy", belly: 1.1, eyes: "almond", moustache: "#2a2018", smile: true,
  },
  musician: {
    // sings; the only instrument in the game is Abhimanyu's bass
    id: "musician", skin: "#d9a074", hair: "#22181c", hairHi: "#36262c", hairStyle: "ponytail",
    top: "#4a2f52", topAlt: "#5e3d68", bottom: "#352240", trim: "#f2dfa6",
    outfit: "robe", sleeves: "long", skirt: 0.9, footwear: "boots",
    build: "slim", eyes: "almond", smile: true, idle: "sway", ornament: "#f2dfa6",
  },
  // Gatekeeper: the muscular guard: cropped hair, stubble, heavy brows, a dark vest with red trim.
  gatekeeper: {
    id: "gatekeeper", skin: "#c98f68", hair: "#1c1c1c", hairStyle: "crop",
    top: "#1a0f12", topAlt: "#2a2028", bottom: "#141014", trim: "#b3252f",
    outfit: "vest", sleeves: "long", footwear: "boots",
    build: "muscular", eyes: "almond", brows: "strong", stubble: "#5a4238", props: ["staff"],
  },

  // ---------------------------------------------------------------- F-1205
  // Faizal: short and heavy, a round face under a mop of curls, a green tee, sandals, a grin.
  faizal: {
    id: "faizal", skin: "#d9a074", hair: "#2a1a12", hairHi: "#4a3220", hairStyle: "curly",
    top: "#2f7a3f", topAlt: "#3f9a52", bottom: "#2a5a33", trim: "#1f4a28",
    outfit: "tee", sleeves: "short", footwear: "sandals",
    build: "heavy", shoulders: 1.05, hips: 1.25, belly: 1.3, headSize: 1.12, legs: 0.9, height: 0.85,
    eyes: "round", iris: "#2e1c14", grin: true, idle: "lean",
  },
  // Garv: the oldest flatmate, but a young man. From his photo: thick,
  // voluminous dark hair swept back and up from the forehead in a quiff that
  // falls to the ears and nape; olive-tan skin; light stubble along the jaw;
  // wide face, strong brows, calm serious expression; dark green knitted
  // collared polo with wide horizontal beige stripes (collar + three-button
  // placket); dark trousers; pink string bracelet. Arms crossed. Age shows in
  // the average build and slightly broader shoulders, not grey hair.
  garv: {
    id: "garv", skin: "#c9a076", hair: "#1a1412", hairHi: "#2e2622", hairStyle: "quiff",
    top: "#1f3a2a", topAlt: "#1f3a2a", bottom: "#2a2a2e", trim: "#c9b58f", stripes: "#c9b58f",
    outfit: "polo", sleeves: "long", footwear: "shoes",
    build: "average", shoulders: 1.1, height: 1.03, headSize: 1.04, eyes: "almond", iris: "#2c1a10",
    brows: "strong", stubble: "#8f6e52", bracelet: "#f0a0b8", braceletStyle: "thread", idle: "crossed",
  },
  // Hakim: from his photo: slim young man, dark medium hair with a side
  // parting and a soft sweep across the forehead, big bright smile with teeth,
  // no glasses, navy zip-up hoodie worn open over a navy V-neck tee, a "3"
  // patch on the left sleeve, khaki straight trousers, dark shoes, a watch on
  // the left wrist. Always on his iPad.
  hakim: {
    id: "hakim", skin: "#d4a07a", hair: "#1c1416", hairHi: "#2a2024", hairStyle: "sidepart",
    top: "#1f2742", topAlt: "#232b4a", bottom: "#c8ad7a", trim: "#c9c4bb", patch: "#d8c08a",
    outfit: "hoodie", sleeves: "long", vneck: true, watch: true, footwear: "shoes",
    build: "slim", eyes: "round", iris: "#2e1c12", grin: true, props: ["ipad"], idle: "ipad",
  },
  // Dev: from his photo: lean athletic young man (not a bodybuilder), warm
  // tan skin, dark slightly wavy messy hair with volume pushed back off the
  // forehead, light stubble, black sleeveless tank, charcoal drawstring
  // trousers, a thin black thread bracelet, relaxed sleepy-cool expression
  // (half-lidded eyes, slight smile). Idles with a lazy stretch, arms behind
  // his head.
  dev: {
    id: "dev", skin: "#c98a5e", hair: "#161210", hairHi: "#2a2220", hairStyle: "wavy",
    top: "#1a1a1e", topAlt: "#1a1a1e", bottom: "#2b2a30", trim: "#e0616b", drawstring: true, accent: "#0e0e10",
    outfit: "tank", sleeves: "none", footwear: "sandals",
    build: "slim", shoulders: 1.15, hips: 0.95, height: 1.06, eyes: "almond", iris: "#2a1810",
    sleepy: true, smile: true, stubble: "#8a5e42", bracelet: "#141414", braceletStyle: "thread", idle: "stretch",
  },
};

export function charSpec(id: string): CharSpec {
  return CHARACTERS[id] ?? CHARACTERS.townie;
}
