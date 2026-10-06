// ---------------------------------------------------------------------------
// World data. 12 maps, 16px tiles, camera shows 15x11.
//
// Tile legend (single chars in `rows`):
//   . grass     , path      g tall grass (encounters)   F flower   w water   t tree
//   # wall      f floor     b bed   B bookshelf  D desk  T tv   s sign  d door
//   r rug       _ void      k stone plaza  K stone wall  : gravel  j bamboo
//   q cherry tree  v petal ground   c cave wall  n cave floor  H house
//   L lantern post  m stall  % banner  e bridge  o pond  ^ boulder  u statue
//   z pressure plate  = magic barrier  ! brazier  $ ancient scroll
//   & sacred lantern  ~ diggable  i inscription  * chest  + viewpoint
//   I incense   h hidden pickup  y toy  p paw print
// Entity markers (walkable, replaced by a sprite): M N A C P G X R W E Y V O J Q U 1 2 3 4 5
// ---------------------------------------------------------------------------

export type MapId =
  | "bedroom" | "house" | "town" | "route1" | "forest" | "village"
  | "bamboo" | "mountain" | "temple" | "garden" | "cave" | "academy"
  | "road" | "f1205";

export type Portal = {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
  dir?: "up" | "down" | "left" | "right";
  requiresFlag?: string;
  lockedText?: string;
};

export type InteractDef = {
  kind: string;
  /** character sprite key suffix, e.g. "elder" -> ch_elder */
  sprite?: string;
  name?: string;
  /** party member id — if they're already with you, don't spawn a duplicate NPC */
  partyId?: string;
};

export type Cinematic = { title: string; subtitle: string; flag: string };

export type MapDef = {
  id: MapId;
  name: string;
  indoor: boolean;
  theme: "indoor" | "outdoor" | "village" | "bamboo" | "mountain" | "temple" | "garden" | "cave" | "flat";
  rows: string[];
  portals: Portal[];
  interacts: Record<string, InteractDef>;
  encounterEnemies?: string[];
  encounterRate?: number;
  bgm: string;
  cinematic?: Cinematic;
};

// Anything the player INTERACTS with must be solid, so they walk up to it and
// face it. A walkable interactable is a trap: you step onto the tile, "E" then
// targets whatever is past it, and the object becomes impossible to use.
export const SOLID = new Set(["#","t","K","c","j","H","L","m","%","^","u","q","=","$","&","*","B","b","s","D","T","w","o","_","!","y",
  // F-1205 furniture: sofa, guitar stand, poster, window, counter, fridge, weights, table, plant
  "S","l","@","0","[","]","x","7","a"]);
/** Tiles you can stand on but that trigger something under-foot. */
export const WALKABLE_SPECIAL = new Set(["z", "p", "~", "h", "y", "+", "I", "i", "!"]);

export const MAPS: Record<MapId, MapDef> = {
  // -------------------------------------------------------------------- home
  bedroom: {
    id: "bedroom", name: "Palakshi's Bedroom", indoor: true, theme: "indoor", bgm: "bgm_home",
    rows: [
      "############",
      "#BffffDffff#",
      "#ffffffffff#",
      "#bfffffffTf#",
      "#ffffffffff#",
      "#rfffffffff#",
      "#ffffffffhf#",
      "#ffsfffffff#",
      "#####dd#####",
    ],
    portals: [
      { x: 5, y: 8, to: "house", tx: 5, ty: 1, dir: "down" },
      { x: 6, y: 8, to: "house", tx: 5, ty: 1, dir: "down" },
    ],
    interacts: {},
  },

  house: {
    id: "house", name: "Palakshi's House", indoor: true, theme: "indoor", bgm: "bgm_home",
    rows: [
      "#####d########",
      "#ffffffffffff#",
      "#fBffffffffTf#",
      "#ffffffffffff#",
      "#ffffMfffffff#",
      "#ffffffffffff#",
      "#frrffffffrrf#",
      "#ffffffffffff#",
      "#ffffffffffff#",
      "#####d########",
      "##############",
    ],
    portals: [
      { x: 5, y: 0, to: "bedroom", tx: 5, ty: 7, dir: "up" },
      { x: 5, y: 9, to: "town", tx: 4, ty: 4, dir: "down" },
    ],
    interacts: {
      M: { kind: "npc_mom", sprite: "bidisha", name: "Bidisha" },
    },
  },

  town: {
    id: "town", name: "Sparkle Town", indoor: false, theme: "outdoor", bgm: "bgm_town",
    rows: [
      "tttttttttttttttttttt",
      "t..................t",
      "t.HHHH......HHHH...t",
      "t.HHdH......HHdH...t",
      "t.....1.......2....t",
      "t,,,,,,,,,,,,,,,,,,t",
      "t.........A........t",
      "t..s..............,,",
      "t..................,",
      "t........W.........t",
      ",..................t",
      "t....F......F......t",
      "t.................ht",
      "t..................t",
      "tttttttt,,tttttttttt",
    ],
    portals: [
      { x: 4, y: 3, to: "house", tx: 5, ty: 8, dir: "up" },
      { x: 18, y: 7, to: "route1", tx: 1, ty: 5, dir: "right" },
      { x: 19, y: 7, to: "route1", tx: 1, ty: 5, dir: "right" },
      { x: 19, y: 8, to: "route1", tx: 1, ty: 6, dir: "right" },
      {
        x: 8, y: 14, to: "academy", tx: 9, ty: 13, dir: "down",
        requiresFlag: "lanternRestored",
        lockedText: "The Style Academy gates are shut. Nothing to say to Arshiya yet.",
      },
      {
        x: 9, y: 14, to: "academy", tx: 9, ty: 13, dir: "down",
        requiresFlag: "lanternRestored",
        lockedText: "The Style Academy gates are shut. Nothing to say to Arshiya yet.",
      },
      {
        x: 0, y: 10, to: "road", tx: 1, ty: 5, dir: "left",
        requiresFlag: "finaleDone",
        lockedText: "The west road out of town. Nothing out there for you yet.",
      },
    ],
    interacts: {
      A: { kind: "npc_abhimanyu", sprite: "abhimanyu", name: "Abhimanyu", partyId: "abhimanyu" },
      W: { kind: "npc_witness", sprite: "townie", name: "Kid" },
      "1": { kind: "npc_townie1", sprite: "townie", name: "Townsfolk" },
      "2": { kind: "npc_townie2", sprite: "villager", name: "Townsfolk" },
    },
  },

  route1: {
    id: "route1", name: "Route 1", indoor: false, theme: "outdoor", bgm: "bgm_route",
    encounterEnemies: ["wild_bunny", "wild_sparrow"], encounterRate: 0.11,
    rows: [
      "tttttttt,,tttttttttt",
      "t.......,,.........t",
      "t.gggg..,,....ggg..t",
      "t.gggg..,,....ggg..t",
      "t.......,,.........t",
      ",,,,,,,,,,,,,,,,,,,t",
      ",,,,,,,,,,,,,,,,,,.t",
      "t......y...........t",
      "t.......p..........t",
      "t.......p..........t",
      "t..ggg......~......t",
      "t..ggg.............t",
      "t..................t",
      "t.......ggg........t",
      "tttttttttttttttttttt",
    ],
    portals: [
      { x: 0, y: 5, to: "town", tx: 18, ty: 7, dir: "left" },
      { x: 0, y: 6, to: "town", tx: 18, ty: 8, dir: "left" },
      { x: 8, y: 0, to: "forest", tx: 8, ty: 13, dir: "up" },
      { x: 9, y: 0, to: "forest", tx: 9, ty: 13, dir: "up" },
    ],
    interacts: {},
  },

  forest: {
    id: "forest", name: "Whispering Woods", indoor: false, theme: "outdoor", bgm: "bgm_forest",
    encounterEnemies: ["wild_sparrow", "forest_wolf"], encounterRate: 0.13,
    rows: [
      "tttttttt,,tttttttttt",
      "t..jj...,,......R..t",
      "t..jj...,,.........t",
      "t.......,,.........t",
      "t...P...,,.........t",
      "t.......,,.........t",
      "t..gg...,,....gg...t",
      "t..gg...C,....gg...t",
      "t.......,,.........t",
      "th......,,.........t",
      "t.......,,.........t",
      "t..ttt..,,...ttt...t",
      "t.......,,.........t",
      "t.......,,.........t",
      "tttttttt,,tttttttttt",
    ],
    portals: [
      { x: 8, y: 14, to: "route1", tx: 8, ty: 1, dir: "down" },
      { x: 9, y: 14, to: "route1", tx: 9, ty: 1, dir: "down" },
      {
        x: 8, y: 0, to: "village", tx: 8, ty: 13, dir: "up",
        requiresFlag: "mimoRecognized",
        lockedText: "The path north leads out of the valley. Find Mimo first.",
      },
      {
        x: 9, y: 0, to: "village", tx: 9, ty: 13, dir: "up",
        requiresFlag: "mimoRecognized",
        lockedText: "The path north leads out of the valley. Find Mimo first.",
      },
    ],
    interacts: {
      P: { kind: "npc_prakriti", sprite: "prakriti", name: "Prakriti" },
      C: { kind: "mimo_here", sprite: "", name: "Rustling bush" },
      R: { kind: "ribbon_spot", sprite: "", name: "Undergrowth" },
    },
  },

  // ----------------------------------------------------------------- village
  village: {
    id: "village", name: "Lantern Village", indoor: false, theme: "village", bgm: "bgm_village",
    cinematic: { title: "LANTERN VILLAGE", subtitle: "Fifty years of light, gone dark", flag: "seenVillage" },
    rows: [
      "KKKKKKKK,,KKKKKKKKKK",
      "K......kkkk........K",
      "K.HHHH.kkkk.HHHH...K",
      "K.HHdH.kkkk.HHdH...K",
      "K...1..kkkk...2....K",
      "K.L...kkkkkk...L...K",
      "Kkkkkkkkkkkkkkkkkk.K",
      "K...3..kEk....4....K",
      "Kkkkkkkkkkkkkkkkkk.K",
      "K.m...kkkkkk...m...K",
      "K..O..kkkkkk..N....K",
      "K.L..kkkkkkkk..L..*K",
      "K.....5............K",
      "K..................K",
      "KKKKKKKK,,KKKKKKKKKK",
    ],
    portals: [
      { x: 8, y: 14, to: "forest", tx: 8, ty: 1, dir: "down" },
      { x: 9, y: 14, to: "forest", tx: 9, ty: 1, dir: "down" },
      {
        x: 8, y: 0, to: "bamboo", tx: 8, ty: 13, dir: "up",
        requiresFlag: "elderBriefed",
        lockedText: "The bamboo road is long. Speak to Elder Shu before you take it.",
      },
      {
        x: 9, y: 0, to: "bamboo", tx: 9, ty: 13, dir: "up",
        requiresFlag: "elderBriefed",
        lockedText: "The bamboo road is long. Speak to Elder Shu before you take it.",
      },
    ],
    interacts: {
      E: { kind: "npc_elder", sprite: "elder", name: "Elder Shu" },
      N: { kind: "npc_musician", sprite: "musician", name: "Travelling Musician" },
      O: { kind: "npc_merchant", sprite: "merchant", name: "Merchant" },
      "1": { kind: "npc_villager1", sprite: "villager", name: "Villager" },
      "2": { kind: "npc_villager2", sprite: "townie", name: "Villager" },
      "3": { kind: "npc_villager3", sprite: "villager", name: "Villager" },
      "4": { kind: "npc_villager4", sprite: "townie", name: "Villager" },
      "5": { kind: "npc_villager5", sprite: "monk", name: "Village Monk" },
    },
  },

  // ------------------------------------------------------------------ bamboo
  bamboo: {
    id: "bamboo", name: "Bamboo Forest", indoor: false, theme: "bamboo", bgm: "bgm_bamboo",
    encounterEnemies: ["bamboo_spirit", "wild_monkey"], encounterRate: 0.1,
    cinematic: { title: "BAMBOO FOREST", subtitle: "Where sound goes to be tested", flag: "seenBamboo" },
    rows: [
      "jjjjjjjj,,jjjjjjjjjj",
      "j........$.........j",
      "j..u.....,,.....u..j",
      "j........,,........j",
      "j...z....,,....z...j",
      "j........,,........j",
      "j,,,,,,,,,,,,,,,,,,j",
      "j....X...,,........,",
      "j........,,........,",
      "j........,,........j",
      "j........,,.......*j",
      "jjjjjjjj==jjjjjjjjjj",
      "j........,,........j",
      "j........,,........j",
      "jjjjjjjj,,jjjjjjjjjj",
    ],
    portals: [
      { x: 8, y: 14, to: "village", tx: 8, ty: 1, dir: "down" },
      { x: 9, y: 14, to: "village", tx: 9, ty: 1, dir: "down" },
      {
        x: 19, y: 7, to: "garden", tx: 1, ty: 6, dir: "right",
        requiresFlag: "trialDone",
        lockedText: "The garden path is roped off by the shrine's cord. Pass the trial first.",
      },
      {
        x: 19, y: 8, to: "garden", tx: 1, ty: 7, dir: "right",
        requiresFlag: "trialDone",
        lockedText: "The garden path is roped off by the shrine's cord. Pass the trial first.",
      },
    ],
    interacts: {
      X: { kind: "npc_miniboss1", sprite: "monk", name: "Bamboo Sentinel" },
    },
  },

  // ---------------------------------------------------------------- mountain
  mountain: {
    id: "mountain", name: "Mountain Trail", indoor: false, theme: "mountain", bgm: "bgm_mountain",
    encounterEnemies: ["wild_crane", "wild_boar"], encounterRate: 0.1,
    cinematic: { title: "MOUNTAIN TRAIL", subtitle: "Stone, wind, and a long way down", flag: "seenMountain" },
    rows: [
      "^^^^^^^^,,^^^^^^^^^^",
      "^.......,,.........^",
      "^..u....,,....u....^",
      "^.......,,.........^",
      "^...+...,,.........^",
      "^.......,,.........^",
      "^:::::::::::::::::.^",
      "^.....X.,,.........,",
      "^.......,,.........,",
      "^.......,,....!....^",
      "^.......,,.........^",
      "^.......,,.........^",
      "^..i....,,.........^",
      "^.......,,.........^",
      "^^^^^^^^,,^^^^^^^^^^",
    ],
    portals: [
      { x: 8, y: 14, to: "garden", tx: 8, ty: 1, dir: "down" },
      { x: 9, y: 14, to: "garden", tx: 9, ty: 1, dir: "down" },
      { x: 8, y: 0, to: "temple", tx: 9, ty: 13, dir: "up" },
      { x: 9, y: 0, to: "temple", tx: 9, ty: 13, dir: "up" },
      {
        x: 19, y: 7, to: "cave", tx: 1, ty: 6, dir: "right",
        requiresFlag: "guardianDone",
        lockedText: "The cave mouth is sealed by temple wards. Wake the temple first.",
      },
      {
        x: 19, y: 8, to: "cave", tx: 1, ty: 7, dir: "right",
        requiresFlag: "guardianDone",
        lockedText: "The cave mouth is sealed by temple wards. Wake the temple first.",
      },
    ],
    interacts: {
      X: { kind: "npc_miniboss2", sprite: "gatekeeper", name: "Mountain Warden" },
    },
  },

  // ------------------------------------------------------------------ temple
  temple: {
    id: "temple", name: "Temple of Echoes", indoor: true, theme: "temple", bgm: "bgm_temple",
    cinematic: { title: "TEMPLE OF ECHOES", subtitle: "It has been listening a long time", flag: "seenTemple" },
    rows: [
      "KKKKKKKKKKKKKKKKKKKK",
      "KffffffffffffffffffK",
      "KffuffffffffffffuffK",
      "KffffffffffffffffffK",
      "Kffzffffff&fffffzffK",
      "KffffffffffffffffffK",
      "KffffffffIfffffffffK",
      "KffffffffffffffffffK",
      "KffuffffffffffffuffK",
      "KffffffffffffffffffK",
      "KffzffffffffffffzffK",
      "KffffffffffffffffffK",
      "KffiffffffGffffffifK",
      "KffffffffJfffffffffK",
      "KKKKKKKK,,KKKKKKKKKK",
    ],
    portals: [
      { x: 8, y: 14, to: "mountain", tx: 8, ty: 1, dir: "down" },
      { x: 9, y: 14, to: "mountain", tx: 9, ty: 1, dir: "down" },
    ],
    interacts: {
      G: { kind: "npc_guardian", sprite: "monk", name: "Temple Guardian" },
      J: { kind: "npc_monk", sprite: "elder", name: "Temple Monk" },
    },
  },

  // ------------------------------------------------------------------ garden
  garden: {
    id: "garden", name: "Cherry Blossom Garden", indoor: false, theme: "garden", bgm: "bgm_garden",
    encounterEnemies: ["garden_moth"], encounterRate: 0.08,
    cinematic: { title: "CHERRY BLOSSOM GARDEN", subtitle: "She has been waiting since morning", flag: "seenGarden" },
    rows: [
      "qqqqqqqq,,qqqqqqqqqq",
      "q..vvv..,,..vvv....q",
      "q.......,,.........q",
      "q..ooo..,,.........q",
      "q..ooo..,,....!....q",
      "q.......,,.........q",
      ",,,,,,,,,,,,,,,,,,.q",
      ",.......,,.........q",
      "q...P...,,.........q",
      "q.......,,.........q",
      "q..vvv..,,..vvv....q",
      "q.......,,.........q",
      "q..qqq..,,..qqq....q",
      "q.......,,.........q",
      "qqqqqqqqqqqqqqqqqqqq",
    ],
    portals: [
      { x: 0, y: 6, to: "bamboo", tx: 18, ty: 7, dir: "left" },
      { x: 0, y: 7, to: "bamboo", tx: 18, ty: 8, dir: "left" },
      {
        x: 8, y: 0, to: "mountain", tx: 8, ty: 13, dir: "up",
        requiresFlag: "prakritiDone",
        lockedText: "Prakriti is standing squarely in the way, and enjoying it.",
      },
      {
        x: 9, y: 0, to: "mountain", tx: 9, ty: 13, dir: "up",
        requiresFlag: "prakritiDone",
        lockedText: "Prakriti is standing squarely in the way, and enjoying it.",
      },
    ],
    interacts: {
      P: { kind: "npc_prakriti_duel", sprite: "prakriti", name: "Prakriti" },
    },
  },

  // -------------------------------------------------------------------- cave
  cave: {
    id: "cave", name: "Ancient Cave", indoor: true, theme: "cave", bgm: "bgm_cave",
    encounterEnemies: ["cave_bat", "cave_serpent"], encounterRate: 0.12,
    cinematic: { title: "ANCIENT CAVE", subtitle: "Every sound comes back changed", flag: "seenCave" },
    rows: [
      "cccccccccccccccccccc",
      "cnnnnnnnnnnnnnnnnnnc",
      "cnnccnnnnnnnnnnccnnc",
      "cnnccnnnnnnnnnnccnnc",
      "cnnnnnnnnnnnnnnnnnnc",
      "cnnnnnnnnnnnnnnnnn*c",
      "nnnnnnnnnnnnnnnnnnnc",
      "nnnnnnnnnnnnnnnnnnnc",
      "cnnnnnnnnnnnnnnnnnnc",
      "cnnccnnnnn!nnnnccnnc",
      "cnnccnnnnnnnnnnccnnc",
      "cnnnnnnnnnnnnnnnnnnc",
      "c*nnnnnnnnnnnnnnnnnc",
      "cnnnnnnnnnnnnnnnnnnc",
      "cccccccccccccccccccc",
    ],
    portals: [
      { x: 0, y: 6, to: "mountain", tx: 18, ty: 7, dir: "left" },
      { x: 0, y: 7, to: "mountain", tx: 18, ty: 8, dir: "left" },
    ],
    interacts: {},
  },

  // ----------------------------------------------------------------- academy
  academy: {
    id: "academy", name: "Style Academy", indoor: false, theme: "outdoor", bgm: "bgm_boss",
    rows: [
      "KKKKKKKKKKKKKKKKKKKK",
      "K::::::::::::::::::K",
      "K::::::::Y:::::::::K",
      "K::::::::::::::::::K",
      "K::::::::::::::::::K",
      "KKKKKKKK==KKKKKKKKKK",
      "K:::::::::::::::::hK",
      "K::::::::G:::::::::K",
      "K::::::::::::::::::K",
      "K::%::::::::::%::::K",
      "K::::::::::::::::::K",
      "K::::::::::::::::::K",
      "K::::::::::::::::::K",
      "K::::::::::::::::::K",
      "KKKKKKKK,,KKKKKKKKKK",
    ],
    portals: [
      { x: 8, y: 14, to: "town", tx: 8, ty: 13, dir: "down" },
      { x: 9, y: 14, to: "town", tx: 9, ty: 13, dir: "down" },
    ],
    interacts: {
      G: { kind: "npc_gatekeeper", sprite: "gatekeeper", name: "Gatekeeper" },
      Y: { kind: "npc_boss", sprite: "arshiya", name: "Arshiya" },
    },
  },

  // -------------------------------------------------------- final chapter
  road: {
    id: "road", name: "The West Road", indoor: false, theme: "outdoor", bgm: "bgm_road",
    cinematic: { title: "THE WEST ROAD", subtitle: "Past the river, where the valley lets go", flag: "seenRoad" },
    rows: [
      "tttttttttttttttttttt",
      "t........t.........t",
      "t.ttt......L...ttt.t",
      "t..........,.......t",
      "t.....s....,...F...t",
      ",,,,,,,,,,,,,,.....t",
      "t..........,.......t",
      "twwwwwwwwwwewwwwwwwt",
      "twwwwwwwwwwewwwwwwwt",
      "t..........,.......t",
      "t.L........,.....L.t",
      "t..........,.......t",
      "t....HHHHHHHHHH....t",
      "t....HHHHHHdHHH....t",
      "tttttttttttttttttttt",
    ],
    portals: [
      { x: 0, y: 5, to: "town", tx: 1, ty: 10, dir: "right" },
      { x: 11, y: 13, to: "f1205", tx: 6, ty: 9, dir: "up" },
    ],
    interacts: {},
  },

  f1205: {
    id: "f1205", name: "F-1205", indoor: true, theme: "flat", bgm: "bgm_f1205",
    cinematic: { title: "F-1205", subtitle: "Abhimanyu's place. Shoes optional.", flag: "seenF1205" },
    rows: [
      "##############",
      "#0...@...0...#",
      "#..SQS...l...#",
      "#..........7.#",
      "#.....N......#",
      "#]..[[...A...#",
      "#.Z.......x..#",
      "#.......V....#",
      "#..r....a....#",
      "#......B.....#",
      "######dd######",
    ],
    portals: [
      { x: 6, y: 10, to: "road", tx: 11, ty: 12, dir: "up" },
      { x: 7, y: 10, to: "road", tx: 11, ty: 12, dir: "up" },
    ],
    interacts: {
      A: { kind: "npc_abhimanyu_home", sprite: "abhimanyu", name: "Abhimanyu" },
      Z: { kind: "npc_faizal", sprite: "faizal", name: "Faizal" },
      N: { kind: "npc_garv", sprite: "garv", name: "Garv" },
      Q: { kind: "npc_hakim", sprite: "hakim", name: "Hakim" },
      V: { kind: "npc_dev", sprite: "dev", name: "Dev" },
    },
  },
};

export const MAP_ORDER: MapId[] = [
  "bedroom", "house", "town", "route1", "forest", "village",
  "bamboo", "mountain", "temple", "garden", "cave", "academy", "road", "f1205",
];

/** Which flag opens a '=' barrier on a given map. */
export const BARRIER_FLAG: Partial<Record<MapId, string>> = {
  bamboo: "barrierBroken",
  academy: "gateOpen",
};

export function mapWidth(m: MapDef) {
  return m.rows[0].length;
}
export function mapHeight(m: MapDef) {
  return m.rows.length;
}
export function tileAt(m: MapDef, x: number, y: number): string {
  if (y < 0 || y >= m.rows.length) return "#";
  const row = m.rows[y];
  if (x < 0 || x >= row.length) return "#";
  return row[x];
}
