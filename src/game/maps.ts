// ---------------------------------------------------------------------------
// World data. 14 maps. Regions are 30-36 tiles wide with winding paths,
// lantern trails to each destination, landmarks, and room to breathe.
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
  "S","l","@","0","[","]","x","7","a","6","8","9"]);
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
      { x: 5, y: 9, to: "town", tx: 8, ty: 6, dir: "down" },
    ],
    interacts: {
      M: { kind: "npc_mom", sprite: "bidisha", name: "Bidisha" },
    },
  },

  town: {
    id: "town", name: "Sparkle Town", indoor: false, theme: "outdoor", bgm: "bgm_town",
    rows: [
      "tttttttttttttttttttttttttttttt",
      "tttttt......tttttt......tttttt",
      "tttttt......tttttt.F....tttttt",
      "tttttt..................tttttt",
      "t.....HHHH..F......HHHH.tttttt",
      "t.....HHdHRF.......HHdH.....Ft",
      "t.......,,...........,,....F.t",
      "t.......,,..kkkkkk.F.,,.~....t",
      "t.L.F..L,,1.kkkkkk...,,2...L.t",
      ",,,,s,,,,,,,kkkkkk,,,,,,,,,,,,",
      "t,,,,,,,,,,,kkkkkk,,,,,,,,,,,,",
      "t...........L,,...........W..t",
      "t...F..HHHHH.,,As...HHHHH....t",
      "t......HHdHH.,,....FHHdHH....t",
      "t..*......F.L,,..............t",
      "t............,,..........ttttt",
      "ttttt........,,..........ttttt",
      "ttttt........,,..........ttttt",
      "tttttF....F.L,,..........tthtt",
      "ttttt........,,......F.....F.t",
      "ttttt........,,..............t",
      "ttttttttttttt,,ttttttttttttttt",
    ],
    portals: [
      { x: 8, y: 5, to: "house", tx: 5, ty: 8, dir: "up" },
      { x: 29, y: 9, to: "route1", tx: 1, ty: 10, dir: "right" },
      { x: 29, y: 10, to: "route1", tx: 1, ty: 11, dir: "right" },
      { x: 13, y: 21, to: "academy", tx: 14, ty: 24, dir: "down", requiresFlag: "lanternRestored", lockedText: "The Style Academy gates are shut. Nothing to say to Arshiya yet." },
      { x: 14, y: 21, to: "academy", tx: 15, ty: 24, dir: "down", requiresFlag: "lanternRestored", lockedText: "The Style Academy gates are shut. Nothing to say to Arshiya yet." },
      { x: 0, y: 9, to: "road", tx: 1, ty: 5, dir: "left", requiresFlag: "finaleDone", lockedText: "The west road out of town. Nothing out there for you yet." },
    ],
    interacts: {
      A: { kind: "npc_abhimanyu", sprite: "abhimanyu", name: "Abhimanyu", partyId: "abhimanyu" },
      W: { kind: "npc_witness", sprite: "townie", name: "Kid" },
      "1": { kind: "npc_townie1", sprite: "townie", name: "Townsfolk" },
      "2": { kind: "npc_townie2", sprite: "villager", name: "Townsfolk" },
      R: { kind: "npc_riddhi", sprite: "riddhi", name: "Riddhi" },
    },
  },

  route1: {
    id: "route1", name: "Route 1", indoor: false, theme: "outdoor", bgm: "bgm_route",
    encounterEnemies: ["wild_bunny", "wild_sparrow"], encounterRate: 0.11,
    rows: [
      "tttttttttttttt,,tttttttttttttt",
      "ttttttt.......,,....F.tttttttt",
      "ttttttt......L,,......tttttttt",
      "ttttttt......g,,p.....tttttttt",
      "t............g,,...........*.t",
      "t.........F...,,p............t",
      "t..ggggF.....L,,....gggg..F..t",
      "t..gggg.......,,p...gggg.....t",
      "t..gggg.......,,....gggg.....t",
      "t.L....L....LL,,p............t",
      ",,,,,,,,,,,,,,,,.............t",
      ",,,,,,,,,s,,,,,..............t",
      "t....ggg...y.................t",
      "t....ggg..........gggg.......t",
      "t....ggg.........wwwwweewwwwwt",
      "t.h.F.....ttttt.............Ft",
      "t.........ttttt........ttttttt",
      "tttttt....tttttF.......ttttttt",
      "tttttt.........F....~..ttttttt",
      "tttttt.................ttttttt",
      "tttttt.........FF......ttttttt",
      "tttttttttttttttttttttttttttttt",
    ],
    portals: [
      { x: 0, y: 10, to: "town", tx: 28, ty: 9, dir: "left" },
      { x: 0, y: 11, to: "town", tx: 28, ty: 10, dir: "left" },
      { x: 14, y: 0, to: "forest", tx: 14, ty: 22, dir: "up" },
      { x: 15, y: 0, to: "forest", tx: 15, ty: 22, dir: "up" },
    ],
    interacts: {},
  },

  forest: {
    id: "forest", name: "Whispering Woods", indoor: false, theme: "outdoor", bgm: "bgm_forest",
    encounterEnemies: ["wild_sparrow", "forest_wolf"], encounterRate: 0.13,
    rows: [
      "tttttttttttttt,,tttttttttttttt",
      "ttttttttt.....,,....tttttttttt",
      "ttttttttt.....,,....tttttttttt",
      "ttttttttt.....,,..jjtttttttttt",
      "ttttttttt.....,,..jj....R....t",
      "t........F....,,......F......t",
      "t....P........,,.ttt.F....F..t",
      "t.....ggg.....,,.ttt.........t",
      "t.....ggg.,,,,,,.ttt.F...ttttt",
      "ttttt.....,,,,,..........ttttt",
      "ttttt....L,,............Fttttt",
      "ttttt.....,,.............ttttt",
      "ttttt.....,,.......ggg...ttttt",
      "ttttt....L,,.....C.ggg...ttttt",
      "tF....ggg.,,.................t",
      "t..h..gggL,,..............*F.t",
      "t.........,,s,,,....ggg......t",
      "t.........,,,,,,....ggg......t",
      "tttttttt......,,......tttttttt",
      "tttttttt..tttt,,......tttttttt",
      "tttttttt..tttt,,......tttttttt",
      "tttttttt~.tttt,,......tttttttt",
      "tttttttt......,,......tttttttt",
      "tttttttttttttt,,tttttttttttttt",
    ],
    portals: [
      { x: 14, y: 23, to: "route1", tx: 14, ty: 1, dir: "down" },
      { x: 15, y: 23, to: "route1", tx: 15, ty: 1, dir: "down" },
      { x: 14, y: 0, to: "village", tx: 16, ty: 24, dir: "up", requiresFlag: "mimoRecognized", lockedText: "The path north leads out of the valley. Find Mimo first." },
      { x: 15, y: 0, to: "village", tx: 17, ty: 24, dir: "up", requiresFlag: "mimoRecognized", lockedText: "The path north leads out of the valley. Find Mimo first." },
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
      "KKKKKKKKKKKKKKKK,,KKKKKKKKKKKKKKKK",
      "K...............,,..............wK",
      "K.FFFFF.........,,.........FFFFFwK",
      "K.FFFFF.........,,.s.......FFF~FwK",
      "K.FFFFF.........,,.........FFFFFwK",
      "K...*....HHHH...,,....HHHH......wK",
      "K.....,,.HHdH...,,....HHdH.,,...wK",
      "K.HHHH,,........,,.........,,HHHwK",
      "K.HHdH,,......L.,,.L.......,,HHdwK",
      "K.....,,..LkkkkkkkkkkkkL...,,...wK",
      "K....1,,..mkkkkkkkkkkkkm...,2...wK",
      "K.....,,...Okkkkkkkkkkk....,,...wK",
      "K...,,,,,,,,,kkkEkkkkk,,,,,,,,,.wK",
      "K...,,,,,,,,kkkkkkkkkk,,,,,,,,..wK",
      "K.....,,...kkRkkkkkkkkk....,,...wK",
      "K.HHHH,,..mkkkkkkkkkkkkN...,,HHHwK",
      "K.HHdH,,...kkkkkkkkkkkk....,,HHdwK",
      "K.....,,3.L...L.,,.L...L...,,...wK",
      "K.....,,........,,......4..,,...wK",
      "K.....,,.HHHH...,,....HHHH.,,...wK",
      "K.FFFFFF.HHdH...,,....HHdHFFFFFFwK",
      "K.FFFFFF......s.,,........FFFFFFwK",
      "K.FFFFFF........,,5.......FFFFFFwK",
      "K.FFFFFF........,,........FFFFFFwK",
      "K..h............,,............*.wK",
      "KKKKKKKKKKKKKKKK,,KKKKKKKKKKKKKKKK",
    ],
    portals: [
      { x: 16, y: 25, to: "forest", tx: 14, ty: 1, dir: "down" },
      { x: 17, y: 25, to: "forest", tx: 15, ty: 1, dir: "down" },
      { x: 16, y: 0, to: "bamboo", tx: 16, ty: 24, dir: "up", requiresFlag: "elderBriefed", lockedText: "The bamboo road is long. Speak to Elder Shu before you take it." },
      { x: 17, y: 0, to: "bamboo", tx: 17, ty: 24, dir: "up", requiresFlag: "elderBriefed", lockedText: "The bamboo road is long. Speak to Elder Shu before you take it." },
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
      R: { kind: "npc_riddhi", sprite: "riddhi", name: "Riddhi" },
    },
  },

  // ------------------------------------------------------------------ bamboo
  bamboo: {
    id: "bamboo", name: "Bamboo Forest", indoor: false, theme: "bamboo", bgm: "bgm_bamboo",
    encounterEnemies: ["bamboo_spirit", "wild_monkey"], encounterRate: 0.1,
    cinematic: { title: "BAMBOO FOREST", subtitle: "Where sound goes to be tested", flag: "seenBamboo" },
    rows: [
      "jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj",
      "j................................j",
      "j.jjjjj......jjj$.........jjjjjj.j",
      "j.jjjjj......jjj,,........jjjjjj.j",
      "j.jjjjj....u....,,....u...jjjjjj.j",
      "j.jjjjj.........,,...............j",
      "j.....gg........,,...............j",
      "jjjjjjjjjjjjjjjj,=jjjjjjjjjjjjjjjj",
      "j.jjj...........,,......ggg..jjj.j",
      "j.jjj..........L,,..s........jjj.j",
      "j.jjj...........,,...........jjj.j",
      "j.jjj......z....,,....z.....~jjj.j",
      "j.jjj.......X..L,,...........jjj.j",
      "j...............,,L...L...L..jjj.j",
      "j...............,,,,,,,,,,,,,,,,,,",
      "j..h..........sL,,,,,,,,,,,,,,,,,,",
      "j.......jjjj....,,....jjjjj......j",
      "j....*..jjjj....,,....jjjjj......j",
      "j.......jjjj...L,,....jjjjj......j",
      "j.jjjjjj..ggg...,,...............j",
      "j.jjjjjj..ggg...,,........jjjjjj.j",
      "jwwwwwwwwwwwwwww,,wwwwwwwwwwwwwwwj",
      "j.jjjjjj........,,..ggg...jjjjjj.j",
      "j.jjjjjj.......L,,........jjjj*j.j",
      "j...............,,...............j",
      "jjjjjjjjjjjjjjjj,,jjjjjjjjjjjjjjjj",
    ],
    portals: [
      { x: 16, y: 25, to: "village", tx: 16, ty: 1, dir: "down" },
      { x: 17, y: 25, to: "village", tx: 17, ty: 1, dir: "down" },
      { x: 33, y: 14, to: "garden", tx: 1, ty: 13, dir: "right", requiresFlag: "trialDone", lockedText: "The garden path is roped off by the shrine's cord. Pass the trial first." },
      { x: 33, y: 15, to: "garden", tx: 1, ty: 14, dir: "right", requiresFlag: "trialDone", lockedText: "The garden path is roped off by the shrine's cord. Pass the trial first." },
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
      "^^^^^^^^^^^^^^^^,,^^^^^^^^^^^^^^^^",
      "^^^^^^^^^^^.....::.....^^^^^^^^^^^",
      "^^^^^^^^^^^.....::.....^^^^^^^^^^^",
      "^^^^^^^^^^^.....:L.....^^^^^^^^^^^",
      "^^^^^^^^^^^.....::.....^^^^^^^^^^^",
      "^^^^^^^^^^^.....:L...........~...^",
      "^...........:s::::......u........^",
      "^.h.....ggg.:::::................^",
      "^.......ggg.::..............^^^^^^",
      "^^^^^^^.....::::::::::......^^^^^^",
      "^^^^^^^.....:::::::::L......^^^^^^",
      "^^^^^^^...^^^^^^^^..::......^^^^^^",
      "^^^^^^^...^^^^^^^^..::.....!^^^^^^",
      "^^^^^^^.............:Lggg...^^^^^^",
      "^^^^^^^.............::ggg........^",
      "^........L...L...L..:L:::::::::::,",
      "^..+....:::::::::::::::::::::::::,",
      "^.......:::::::::::::s....^^^^^^^^",
      "^^^^^^^^::................^^^^^^^^",
      "^^^^^^^^::gg..............^^^^^^^^",
      "^^^^^^^^::gg............gg^^^^^^^^",
      "^^^^^^^^::s:::X:::......gg^^^^^^^^",
      "^.......::::::::::...............^",
      "^.....u.....^^^^:L...............^",
      "^...........^^^^::...^^^^^^...*..^",
      "^..*.......i....:L...^^^^^^......^",
      "^...............::...^^^^^^......^",
      "^^^^^^^^^^^^^^^^,,^^^^^^^^^^^^^^^^",
    ],
    portals: [
      { x: 16, y: 27, to: "garden", tx: 16, ty: 1, dir: "down" },
      { x: 17, y: 27, to: "garden", tx: 17, ty: 1, dir: "down" },
      { x: 16, y: 0, to: "temple", tx: 15, ty: 24, dir: "up" },
      { x: 17, y: 0, to: "temple", tx: 15, ty: 24, dir: "up" },
      { x: 33, y: 15, to: "cave", tx: 1, ty: 13, dir: "right", requiresFlag: "guardianDone", lockedText: "The cave mouth is sealed by temple wards. Wake the temple first." },
      { x: 33, y: 16, to: "cave", tx: 1, ty: 14, dir: "right", requiresFlag: "guardianDone", lockedText: "The cave mouth is sealed by temple wards. Wake the temple first." },
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
      "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
      "KfffffffKffffffffffffKfffffffK",
      "KfffffffKffffffffffffKfffffffK",
      "Kff*ffffKffffffffffffKfffffffK",
      "KfffffffKfffff&ffffffKfffffffK",
      "KffffffffffffffffffffffffffffK",
      "KfffffffKffffffffffffKfffffffK",
      "KfffffffKffffffffffffKffffhffK",
      "KfffffffKffffffffffffKfffffffK",
      "KfffffffKffffffffffffKfffffffK",
      "KKKKKKKKKKKKKffffKKKKKKKKKKKKK",
      "KfffffffffffffGffffffffffffffK",
      "KfffuffffffzffffffzffffffufffK",
      "KffffffJfffffffffffffffffffffK",
      "KffffffffffffffffffffffffffffK",
      "KfffzffffffuffffffuffffffzfffK",
      "KffffffffffffffffffffffffffffK",
      "KKKKKKKKKKKKKffffKKKKKKKKKKKKK",
      "KkkkkkkkkkkkkkkkkkkkkkkkkkkkkK",
      "KkkkkkLkkkkkkkkkkkkkkkkLkkkkkK",
      "KkkkikkkkkkkkkIkkkkkkkkkkikkkK",
      "KkkkkkkkkkkkkkkkkkkkkkkkkkkkkK",
      "KkkkkkkkkkkkkkkkkkkkkkkkkkkkkK",
      "KkkkkkLkkkkkkkkkkkkkkkkLkkkkkK",
      "KkkkkkkkkkkkkkkkkkkkkkkkkkkkkK",
      "KKKKKKKKKKKKKK,,KKKKKKKKKKKKKK",
    ],
    portals: [
      { x: 14, y: 25, to: "mountain", tx: 16, ty: 1, dir: "down" },
      { x: 15, y: 25, to: "mountain", tx: 17, ty: 1, dir: "down" },
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
      "qqqqqqqqqqqqqqqq,,qqqqqqqqqqqqqqqq",
      "q...............,,...............q",
      "q.qqqq......qqq.,,.........qqqqq.q",
      "q.qqqq......qqq.,,,,,,,,,..qqqqq.q",
      "q.qqqq..........,,,,,,,,,..qqqqq.q",
      "q..*..................g,,..!.....q",
      "q.....................g,,..X.....q",
      "q............s.........,,........q",
      "q...vvv...........R....,,.vvv....q",
      "q...vvv.....oooooooo...,,.vvv....q",
      "q...vvv.....ooooooooww.,,.vvv....q",
      "q.....+....Pooooooooee.,,........q",
      "q.L..L..L...ooooooooww.,,........q",
      ",,,,,,,,,,,,oooooooo...,,....~...q",
      ",,,,,,,,,,,,..oooo.....,,........q",
      "q....vvv..,,..oooo.....,,........q",
      "q....vvv..,,,,,,,,,,,,,,,vvv.....q",
      "q........g,,,,,,,,,,,,,,svvv.....q",
      "q........ggg................qqqq.q",
      "q.qqqqq.....................qqqq.q",
      "q.qqqqq.......vvvv..qqq.....qqqq.q",
      "q.qqqqq.......vvvv..qqq.....qqqq.q",
      "q.qq*qq.....................qqhq.q",
      "q................................q",
      "q................................q",
      "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    ],
    portals: [
      { x: 0, y: 13, to: "bamboo", tx: 32, ty: 14, dir: "left" },
      { x: 0, y: 14, to: "bamboo", tx: 32, ty: 15, dir: "left" },
      { x: 16, y: 0, to: "mountain", tx: 16, ty: 26, dir: "up", requiresFlag: "prakritiDone", lockedText: "Prakriti is standing squarely in the way, and enjoying it." },
      { x: 17, y: 0, to: "mountain", tx: 17, ty: 26, dir: "up", requiresFlag: "prakritiDone", lockedText: "Prakriti is standing squarely in the way, and enjoying it." },
    ],
    interacts: {
      P: { kind: "npc_prakriti_duel", sprite: "prakriti", name: "Prakriti" },
      X: { kind: "npc_miniboss3", sprite: "enemy:moth", name: "Blossom Warden" },
      R: { kind: "npc_riddhi", sprite: "riddhi", name: "Riddhi" },
    },
  },

  // -------------------------------------------------------------------- cave
  cave: {
    id: "cave", name: "Ancient Cave", indoor: true, theme: "cave", bgm: "bgm_cave",
    encounterEnemies: ["cave_bat", "cave_serpent"], encounterRate: 0.12,
    cinematic: { title: "ANCIENT CAVE", subtitle: "Every sound comes back changed", flag: "seenCave" },
    rows: [
      "cccccccccccccccccccccccccccccccccc",
      "cccccccccccccccccccccccccccccccccc",
      "cccccccccccccccccccccccccccccccccc",
      "cccccccccccccccccccccccccccccccccc",
      "cccccccccccccnnnnnnnnnnccccccccccc",
      "cccccccccccccnnwwnnnnunccccccccccc",
      "cccccccccccccnnwwnnnnnnccccccccccc",
      "cccccccccccccnnnnnnnnnnnnccccccccc",
      "cccccccccccccnunnnnnnnncnnnnnnnnnc",
      "cccccccccccccnnnnnn*nnncnnnnnnn*nc",
      "cnnnnnnnnncccnnnnnnnnnnccnnnnnnnnc",
      "cnnnninnnnccnccccncccccccnnnnnnnnc",
      "cnnnnnnnnnccnccccncccccccnnnnnnnnc",
      "nnnnnnnnnnnnnccccncccccccnnn!nnnnc",
      "nnnnnnnnnnccnccccncccccccnnnnnnnnc",
      "cnnnnnnnnnccnccccncccccccnnnnnnnnc",
      "cnnhnnnnnnccnnnnnnnnnncccnnnnnnnnc",
      "cnnnnnnnnnccnznnnnnnnnccnnnnnnnnnc",
      "ccccccccccccnnnnnnnnnnccnnnnn~nnnc",
      "ccccccccccccnnwwwnnnnnccnnnnnnnnnc",
      "ccccccccccccnnwwwnnnnnnnnccccccccc",
      "ccccccccccccnnwwwnnnnncccccccccccc",
      "ccccccccccccnnnnnnnnzncccccccccccc",
      "ccccccccccccnnnnnnnnnncccccccccccc",
      "cccccccccccccccccccccccccccccccccc",
      "cccccccccccccccccccccccccccccccccc",
    ],
    portals: [
      { x: 0, y: 13, to: "mountain", tx: 32, ty: 15, dir: "left" },
      { x: 0, y: 14, to: "mountain", tx: 32, ty: 16, dir: "left" },
    ],
    interacts: {},
  },

  // ----------------------------------------------------------------- academy
  academy: {
    id: "academy", name: "Style Academy", indoor: false, theme: "outdoor", bgm: "bgm_boss",
    rows: [
      "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
      "K::::::::::::::::::::::::::::K",
      "K::::::::::KKKKKKKK::::::::*:K",
      "K::::::::::K::::::K::::::::::K",
      "K::::::::::K::Y:::K::::::::::K",
      "K::::::::::K::::::K::::::::::K",
      "K::::::::::::::::::::::::::::K",
      "K::::::::::::::::::::::::::::K",
      "K::::::::::::::::::::::::::::K",
      "KKKKKKKKKKKKKK==KKKKKKKKKKKKKK",
      "K:::::::::::::G::::::::::::::K",
      "K:::::::::%::::::::%:::::::::K",
      "K:ttt:::::::L::::L:::::::ttt:K",
      "K:ttt::::::::::::::::::::ttt:K",
      "K:ttt:::::%::::::::%:::::ttt:K",
      "K:ttt::::::::::::::::::::ttt:K",
      "K:ttt:::::::L::::L:::::::ttt:K",
      "K:ttt::::::::::::::::::::ttt:K",
      "K:::::::::%::::::::%:::::::::K",
      "K::::::::::::::::::::::::::::K",
      "K:::::::::::L::::L:::::::::::K",
      "K::::::s:::::::::::::::::::::K",
      "K:::::::::%::::::::%:::::::::K",
      "K:h::::::::::::::::::::::::i:K",
      "K::::::::::::::::::::::::::::K",
      "KKKKKKKKKKKKKK,,KKKKKKKKKKKKKK",
    ],
    portals: [
      { x: 14, y: 25, to: "town", tx: 13, ty: 20, dir: "down" },
      { x: 15, y: 25, to: "town", tx: 14, ty: 20, dir: "down" },
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
      "t....HHHHHHdHHH....t",
      "t....HHHHHHHHHH....t",
      "tttttttttttttttttttt",
    ],
    portals: [
      { x: 0, y: 5, to: "town", tx: 1, ty: 9, dir: "right" },
      { x: 11, y: 12, to: "f1205", tx: 1, ty: 8, dir: "right" },
    ],
    interacts: {},
  },

  f1205: {
    id: "f1205", name: "F-1205", indoor: true, theme: "flat", bgm: "bgm_f1205",
    cinematic: { title: "F-1205", subtitle: "Abhimanyu's place. Shoes optional.", flag: "seenF1205" },
    // Living room (top-left) | kitchen (top-right); hallway across the middle with
    // the front door on the left wall; Abhimanyu's room (bottom-left) and Garv &
    // Dev's room (bottom-right). Explored in first person.
    rows: [
      "####################",
      "#0..@...0#..]..[[.0#",
      "#..SQS...#.........#",
      "#.9......d....7.8..#",
      "#.l......#...Z.....#",
      "#..T..a..#..6......#",
      "####d#########d#####",
      "#.......6..........#",
      "d..r...............#",
      "####d######d########",
      "#......8.#.........#",
      "#.b...D..#..b...x..#",
      "#...A..6.#...N..V..#",
      "#....a...#....B.6..#",
      "####################",
    ],
    portals: [
      { x: 0, y: 8, to: "road", tx: 11, ty: 12, dir: "up" },
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
