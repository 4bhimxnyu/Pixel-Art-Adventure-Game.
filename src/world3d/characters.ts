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

export type HairStyle =
  | "long" | "ponytail" | "braid" | "bun" | "headdress" | "short" | "spiky" | "curly" | "crop" | "bald" | "grey";

export type Outfit = "robe" | "dress" | "tee" | "jacket" | "tank" | "cardigan" | "vest" | "hoodie";

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
  beard?: string;
  glasses?: boolean;
  /** Only Abhimanyu may carry an instrument. */
  props?: ("bass" | "ipad" | "staff" | "fan")[];
  /** Idle behaviour. */
  idle?: "default" | "ipad" | "lift" | "crossed" | "lean" | "strum" | "sway";
  /** Hair ornament colour (Palakshi's gold tie, Prakriti's teal ribbon). */
  ornament?: string;
  accent?: string;
};

export const CHARACTERS: Record<string, CharSpec> = {
  // ------------------------------------------------------------ protagonist
  palakshi: {
    id: "palakshi", skin: "#e8b48c", hair: "#150d12", hairHi: "#2a1a24", hairStyle: "ponytail",
    top: "#181220", topAlt: "#241c2e", bottom: "#120d16", trim: "#d9b45b",
    outfit: "dress", sleeves: "wide", sleeveScale: 1.1, skirt: 1.0, necklace: true, female: true,
    build: "slim", shoulders: 0.95, legs: 1.05, eyes: "almond", ornament: "#d9b45b", accent: "#f2dfa6",
  },

  // ---------------------------------------------------------------- party
  abhimanyu: {
    id: "abhimanyu", skin: "#d9a074", hair: "#1d1414", hairStyle: "spiky",
    top: "#f2ebdc", topAlt: "#2b3a52", bottom: "#2a3f66", trim: "#3b4e6b",
    outfit: "jacket", sleeves: "long",
    build: "average", eyes: "almond", props: ["bass"], idle: "strum",
  },

  // ------------------------------------------------------------ rivals
  prakriti: {
    id: "prakriti", skin: "#e5b291", hair: "#191021", hairStyle: "long",
    top: "#1f6b6b", topAlt: "#2a8a8a", bottom: "#5a3d78", trim: "#f2dfa6",
    outfit: "dress", sleeves: "long", skirt: 0.92, necklace: true, female: true,
    build: "slim", shoulders: 0.9, hips: 1.05, legs: 1.05, eyes: "almond", ornament: "#2fa3a3", accent: "#2fa3a3",
  },
  arshiya: {
    id: "arshiya", skin: "#dda57f", hair: "#241018", hairStyle: "headdress",
    top: "#3d0f18", topAlt: "#5c1220", bottom: "#1a0608", trim: "#f2dfa6",
    outfit: "robe", sleeves: "wide", sleeveScale: 1.9, skirt: 1.0, cape: true, headdress: true, necklace: true, female: true,
    build: "heavy", shoulders: 1.35, hips: 1.35, belly: 1.35, headSize: 1.05, height: 1.18,
    eyes: "almond", ornament: "#f2dfa6", accent: "#d9b45b", props: ["fan"],
  },

  // ------------------------------------------------------------ family / story
  bidisha: {
    id: "bidisha", skin: "#e8b48c", hair: "#2a1a1a", hairStyle: "bun",
    top: "#7c141f", topAlt: "#8f1a24", bottom: "#5a0f18", trim: "#d9b45b",
    outfit: "robe", sleeves: "wide", skirt: 0.95, female: true,
    build: "average", eyes: "almond", ornament: "#d9b45b",
  },
  kaajal: {
    id: "kaajal", skin: "#e8b48c", hair: "#1b1218", hairStyle: "long",
    top: "#25304a", topAlt: "#39476b", bottom: "#1a2236", trim: "#f7e6c8",
    outfit: "robe", sleeves: "long", skirt: 0.95, female: true,
    build: "slim", eyes: "almond", glasses: true,
  },
  elder: {
    id: "elder", skin: "#cfa079", hair: "#c9c4bb", hairStyle: "grey",
    top: "#4a3c52", topAlt: "#5d4d66", bottom: "#3a2e40", trim: "#d9b45b",
    outfit: "robe", sleeves: "wide", skirt: 1.0,
    build: "elder", eyes: "almond", beard: "#c9c4bb", props: ["staff"], height: 0.96,
  },
  townie: {
    id: "townie", skin: "#dfa87e", hair: "#3a2a20", hairStyle: "short",
    top: "#3f5a45", topAlt: "#4d6d54", bottom: "#2e3a30", trim: "#f7e6c8",
    outfit: "tee", sleeves: "short",
    build: "average", eyes: "almond", height: 0.9,
  },
  villager: {
    id: "villager", skin: "#d9a074", hair: "#4a3020", hairStyle: "bun",
    top: "#5a4232", topAlt: "#6b5140", bottom: "#3a2a20", trim: "#d9b45b",
    outfit: "dress", sleeves: "long", skirt: 0.9, female: true,
    build: "average", eyes: "almond",
  },
  monk: {
    id: "monk", skin: "#d9a074", hair: "#d9a074", hairStyle: "bald",
    top: "#8f1a24", topAlt: "#a3202c", bottom: "#6a1018", trim: "#f2dfa6",
    outfit: "robe", sleeves: "wide", skirt: 1.0,
    build: "average", eyes: "almond", props: ["staff"],
  },
  merchant: {
    id: "merchant", skin: "#e0a67e", hair: "#2a2018", hairStyle: "crop",
    top: "#2f4a5c", topAlt: "#8fa3b5", bottom: "#243a48", trim: "#d9b45b",
    outfit: "vest", sleeves: "long",
    build: "heavy", belly: 1.1, eyes: "almond",
  },
  musician: {
    // sings; the only instrument in the game is Abhimanyu's bass
    id: "musician", skin: "#d9a074", hair: "#22181c", hairStyle: "ponytail",
    top: "#4a2f52", topAlt: "#5e3d68", bottom: "#352240", trim: "#f2dfa6",
    outfit: "robe", sleeves: "long", skirt: 0.9,
    build: "slim", eyes: "almond", idle: "sway", ornament: "#f2dfa6",
  },
  gatekeeper: {
    id: "gatekeeper", skin: "#c98f68", hair: "#1c1c1c", hairStyle: "crop",
    top: "#1a0f12", topAlt: "#2a2028", bottom: "#141014", trim: "#b3252f",
    outfit: "vest", sleeves: "long",
    build: "muscular", eyes: "almond", props: ["staff"],
  },

  // ---------------------------------------------------------------- F-1205
  faizal: {
    id: "faizal", skin: "#d9a074", hair: "#2a1a12", hairHi: "#4a3220", hairStyle: "curly",
    top: "#2f7a3f", topAlt: "#3f9a52", bottom: "#2a5a33", trim: "#1f4a28",
    outfit: "tee", sleeves: "short",
    build: "heavy", shoulders: 1.05, hips: 1.25, belly: 1.3, headSize: 1.12, legs: 0.9, height: 0.85,
    eyes: "round", idle: "lean",
  },
  garv: {
    id: "garv", skin: "#cfa079", hair: "#3a3236", hairHi: "#8a8290", hairStyle: "grey",
    top: "#c9b48a", topAlt: "#5a4a3c", bottom: "#3a3236", trim: "#4a3e40",
    outfit: "cardigan", sleeves: "long",
    build: "elder", shoulders: 1.05, height: 1.03, eyes: "almond", beard: "#4a3e40", idle: "crossed",
  },
  hakim: {
    id: "hakim", skin: "#d4a07a", hair: "#1c1416", hairStyle: "short",
    top: "#3a3f5a", topAlt: "#4d546f", bottom: "#2a2e40", trim: "#c9c4bb",
    outfit: "hoodie", sleeves: "long",
    build: "slim", eyes: "round", props: ["ipad"], idle: "ipad", glasses: true,
  },
  dev: {
    id: "dev", skin: "#d0946a", hair: "#121010", hairHi: "#2a2424", hairStyle: "crop",
    top: "#1f1f24", topAlt: "#2e2e36", bottom: "#2a2a32", trim: "#e0616b",
    outfit: "tank", sleeves: "none",
    build: "muscular", shoulders: 1.5, hips: 0.9, height: 1.08, eyes: "almond", idle: "lift",
  },
};

export function charSpec(id: string): CharSpec {
  return CHARACTERS[id] ?? CHARACTERS.townie;
}
