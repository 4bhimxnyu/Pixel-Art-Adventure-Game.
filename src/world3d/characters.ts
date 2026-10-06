// ---------------------------------------------------------------------------
// Character identity specs for the 3D rigs. Colours come straight from the
// pixel sprites and portraits, so every character keeps the look the player
// already knows. New cast (F-1205) follows the written descriptions.
//
// A GLB at public/models/<id>.glb overrides the procedural rig automatically
// (see CharacterRig.ts), so reference-based models can be dropped in later
// without touching code.
// ---------------------------------------------------------------------------

export type CharSpec = {
  id: string;
  skin: string;
  hair: string;
  hairHi?: string;
  /** "long" = long flowing hair, "bun" = tied up, "short", "curly", "crop" */
  hairStyle: "long" | "bun" | "short" | "curly" | "crop" | "bald" | "grey";
  top: string;
  topAlt: string;
  bottom: string;
  trim: string;
  /** A robe/dress that hangs over the legs. */
  robe?: boolean;
  female?: boolean;
  /** Body proportions. */
  build: "slim" | "average" | "heavy" | "muscular" | "elder";
  /** Overall scale, 1 = adult. */
  height?: number;
  eyes?: "almond" | "round";
  beard?: string;
  glasses?: boolean;
  props?: ("guitar" | "ipad" | "staff" | "fan" | "scroll")[];
  /** Idle behaviour. */
  idle?: "default" | "ipad" | "lift" | "crossed" | "lean" | "strum" | "sway";
  /** Hair ornament colour (Palakshi's gold pin). */
  ornament?: string;
  accent?: string;
};

export const CHARACTERS: Record<string, CharSpec> = {
  palakshi: {
    id: "palakshi", skin: "#e8b48c", hair: "#150d12", hairHi: "#2a1a24", hairStyle: "long",
    top: "#181220", topAlt: "#2a2034", bottom: "#141018", trim: "#d9b45b", robe: true, female: true,
    build: "slim", eyes: "almond", ornament: "#d9b45b", accent: "#f2dfa6",
  },
  abhimanyu: {
    id: "abhimanyu", skin: "#d9a074", hair: "#1d1414", hairStyle: "short",
    top: "#2b3a52", topAlt: "#3b4e6b", bottom: "#1f2a3c", trim: "#f7e6c8",
    build: "average", eyes: "almond", props: ["guitar"], idle: "strum",
  },
  bidisha: {
    id: "bidisha", skin: "#e8b48c", hair: "#2a1a1a", hairStyle: "bun",
    top: "#7c141f", topAlt: "#8f1a24", bottom: "#5a0f18", trim: "#d9b45b", robe: true, female: true,
    build: "average", eyes: "almond", ornament: "#d9b45b",
  },
  prakriti: {
    id: "prakriti", skin: "#e5b291", hair: "#191021", hairStyle: "long",
    top: "#1f6b6b", topAlt: "#5a3d78", bottom: "#5a3d78", trim: "#f2dfa6", robe: true, female: true,
    build: "slim", eyes: "almond", ornament: "#2fa3a3", accent: "#2fa3a3",
  },
  arshiya: {
    id: "arshiya", skin: "#dda57f", hair: "#241018", hairStyle: "bun",
    top: "#3d0f18", topAlt: "#7c141f", bottom: "#2a0a10", trim: "#f2dfa6", robe: true, female: true,
    build: "heavy", eyes: "almond", ornament: "#f2dfa6", props: ["fan"], height: 1.08,
  },
  kaajal: {
    id: "kaajal", skin: "#e8b48c", hair: "#1b1218", hairStyle: "long",
    top: "#25304a", topAlt: "#39476b", bottom: "#1a2236", trim: "#f7e6c8", robe: true, female: true,
    build: "slim", eyes: "almond", glasses: true,
  },
  elder: {
    id: "elder", skin: "#cfa079", hair: "#c9c4bb", hairStyle: "grey",
    top: "#4a3c52", topAlt: "#5d4d66", bottom: "#3a2e40", trim: "#d9b45b", robe: true,
    build: "elder", eyes: "almond", beard: "#c9c4bb", props: ["staff"], height: 0.96,
  },
  townie: {
    id: "townie", skin: "#dfa87e", hair: "#3a2a20", hairStyle: "short",
    top: "#3f5a45", topAlt: "#4d6d54", bottom: "#2e3a30", trim: "#f7e6c8",
    build: "average", eyes: "almond", height: 0.9,
  },
  villager: {
    id: "villager", skin: "#d9a074", hair: "#4a3020", hairStyle: "bun",
    top: "#5a4232", topAlt: "#6b5140", bottom: "#3a2a20", trim: "#d9b45b", robe: true, female: true,
    build: "average", eyes: "almond",
  },
  monk: {
    id: "monk", skin: "#d9a074", hair: "#d9a074", hairStyle: "bald",
    top: "#8f1a24", topAlt: "#a3202c", bottom: "#6a1018", trim: "#f2dfa6", robe: true,
    build: "average", eyes: "almond", props: ["staff"],
  },
  merchant: {
    id: "merchant", skin: "#e0a67e", hair: "#2a2018", hairStyle: "crop",
    top: "#2f4a5c", topAlt: "#3d5e73", bottom: "#243a48", trim: "#d9b45b",
    build: "heavy", eyes: "almond",
  },
  musician: {
    id: "musician", skin: "#d9a074", hair: "#22181c", hairStyle: "long",
    top: "#4a2f52", topAlt: "#5e3d68", bottom: "#352240", trim: "#f2dfa6", robe: true,
    build: "slim", eyes: "almond", props: ["guitar"], idle: "strum",
  },
  gatekeeper: {
    id: "gatekeeper", skin: "#c98f68", hair: "#1c1c1c", hairStyle: "crop",
    top: "#1a0f12", topAlt: "#2a2028", bottom: "#141014", trim: "#b3252f",
    build: "muscular", eyes: "almond", props: ["staff"],
  },

  // ---------------------------------------------------------------- F-1205
  faizal: {
    id: "faizal", skin: "#d9a074", hair: "#2a1a12", hairHi: "#4a3220", hairStyle: "curly",
    top: "#2f7a3f", topAlt: "#3f9a52", bottom: "#2a5a33", trim: "#2a5a33",
    build: "heavy", height: 0.86, eyes: "round", idle: "lean",
  },
  garv: {
    id: "garv", skin: "#cfa079", hair: "#3a3236", hairHi: "#8a8290", hairStyle: "grey",
    top: "#5a4a3c", topAlt: "#6e5c4c", bottom: "#3a3236", trim: "#c9b48a",
    build: "elder", height: 1.03, eyes: "almond", beard: "#4a3e40", idle: "crossed",
  },
  hakim: {
    id: "hakim", skin: "#d4a07a", hair: "#1c1416", hairStyle: "short",
    top: "#3a3f5a", topAlt: "#4d546f", bottom: "#2a2e40", trim: "#c9c4bb",
    build: "slim", eyes: "round", props: ["ipad"], idle: "ipad", glasses: true,
  },
  dev: {
    id: "dev", skin: "#d0946a", hair: "#121010", hairHi: "#2a2424", hairStyle: "crop",
    top: "#1f1f24", topAlt: "#2e2e36", bottom: "#2a2a32", trim: "#e0616b",
    build: "muscular", height: 1.08, eyes: "almond", idle: "lift",
  },
};

export function charSpec(id: string): CharSpec {
  return CHARACTERS[id] ?? CHARACTERS.townie;
}
