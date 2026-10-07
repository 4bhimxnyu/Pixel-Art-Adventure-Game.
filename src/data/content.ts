// ---------------------------------------------------------------------------
// Canon content: moves, enemies, fighters, items, quests, dialogue.
// Ids here are load-bearing — guidance.ts / missionMeta.ts / maps.ts key off them.
// ---------------------------------------------------------------------------

export type MoveId =
  | "tackle" | "roast" | "bark" | "critique" | "cheer" | "runway" | "bite"
  | "styleslam" | "friendship" | "fetch" | "guitarstrike" | "solo" | "guard"
  | "sparkle" | "sonicblast" | "bassdrop" | "focus" | "heroic" | "finalchord";

export type Move = {
  id: MoveId;
  name: string;
  power: number;
  kind: "attack" | "heal";
  desc: string;
};

export const MOVES: Record<MoveId, Move> = {
  tackle:       { id: "tackle",       name: "Tackle",        power: 10, kind: "attack", desc: "A plain shoulder charge." },
  roast:        { id: "roast",        name: "Roast",         power: 12, kind: "attack", desc: "A cutting remark." },
  bark:         { id: "bark",         name: "Bark",          power: 14, kind: "attack", desc: "Startles the foe." },
  critique:     { id: "critique",     name: "Critique",      power: 18, kind: "attack", desc: "Merciless fashion notes." },
  cheer:        { id: "cheer",        name: "Cheer",         power: 18, kind: "heal",   desc: "Restores a little heart." },
  runway:       { id: "runway",       name: "Runway Strut",  power: 22, kind: "attack", desc: "Struts straight through them." },
  bite:         { id: "bite",         name: "Bite",          power: 22, kind: "attack", desc: "Small jaws, real conviction." },
  styleslam:    { id: "styleslam",    name: "Style Slam",    power: 26, kind: "attack", desc: "Fashion as blunt force." },
  friendship:   { id: "friendship",   name: "Friendship",    power: 26, kind: "attack", desc: "Strikes with the bond you share." },
  fetch:        { id: "fetch",        name: "Fetch",         power: 28, kind: "attack", desc: "Returns with something heavy." },
  guitarstrike: { id: "guitarstrike", name: "Guitar Strike", power: 30, kind: "attack", desc: "The white guitar, swung true." },
  solo:         { id: "solo",         name: "Healing Solo",  power: 36, kind: "heal",   desc: "A solo that mends." },
  guard:        { id: "guard",        name: "Iron Guard",    power: 40, kind: "heal",   desc: "Shaolin stance. Recovers stamina." },
  sparkle:      { id: "sparkle",      name: "Sparkle Palm",  power: 40, kind: "attack", desc: "Golden palm strike." },
  sonicblast:   { id: "sonicblast",   name: "Sonic Blast",   power: 44, kind: "attack", desc: "Sound made solid." },
  bassdrop:     { id: "bassdrop",     name: "Bass Drop",     power: 52, kind: "attack", desc: "The ground disagrees." },
  focus:        { id: "focus",        name: "Focused Chi",   power: 55, kind: "attack", desc: "Breath, then thunder." },
  heroic:       { id: "heroic",       name: "Heroic Strike", power: 70, kind: "attack", desc: "Palakshi's signature blow." },
  finalchord:   { id: "finalchord",   name: "Final Chord",   power: 75, kind: "attack", desc: "One chord. Everything." },
};

export type Fighter = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  moves: MoveId[];
  portrait: string;
};

export const PALAKSHI: Fighter = {
  id: "palakshi", name: "Palakshi",
  hp: 150, maxHp: 150, atk: 55, def: 32, spd: 28,
  moves: ["heroic", "sparkle", "focus", "guard"],
  portrait: "palakshi",
};

export const DOG: Fighter = {
  id: "mimo", name: "Mimo",
  hp: 90, maxHp: 90, atk: 20, def: 14, spd: 18,
  moves: ["bite", "fetch", "bark"],
  portrait: "mimo",
};

export const ABHIMANYU: Fighter = {
  id: "abhimanyu", name: "Abhimanyu",
  hp: 110, maxHp: 110, atk: 38, def: 22, spd: 24,
  moves: ["guitarstrike", "solo", "bassdrop"],
  portrait: "abhimanyu",
};

export type Enemy = {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  moves: MoveId[];
  portrait: string;
  boss?: boolean;
  phases?: number;
  rageMoves?: MoveId[];
  bgm?: string;
};

export const ENEMIES: Record<string, Enemy> = {
  wild_bunny:    { id: "wild_bunny",    name: "Jade Bunny",     hp: 22, atk: 14, def: 8,  spd: 22, moves: ["tackle"],             portrait: "bunny" },
  wild_sparrow:  { id: "wild_sparrow",  name: "Temple Sparrow", hp: 28, atk: 16, def: 9,  spd: 30, moves: ["tackle", "bark"],     portrait: "sparrow" },
  forest_wolf:   { id: "forest_wolf",   name: "Pine Wolf",      hp: 40, atk: 22, def: 14, spd: 24, moves: ["bite", "tackle"],     portrait: "wolf" },
  wild_monkey:   { id: "wild_monkey",   name: "Staff Monkey",   hp: 46, atk: 24, def: 15, spd: 32, moves: ["tackle", "fetch"],    portrait: "monkey" },
  garden_moth:   { id: "garden_moth",   name: "Blossom Moth",   hp: 50, atk: 23, def: 17, spd: 26, moves: ["roast", "cheer"],     portrait: "moth" },
  bamboo_spirit: { id: "bamboo_spirit", name: "Bamboo Spirit",  hp: 52, atk: 26, def: 19, spd: 21, moves: ["tackle", "critique"], portrait: "spirit" },
  wild_mimo:     { id: "wild_mimo",     name: "Frightened Dog", hp: 55, atk: 18, def: 12, spd: 20, moves: ["bark", "bite"],       portrait: "mimo", bgm: "bgm_mimo" },
  wild_crane:    { id: "wild_crane",    name: "White Crane",    hp: 58, atk: 28, def: 18, spd: 34, moves: ["tackle", "critique"], portrait: "crane" },
  cave_bat:      { id: "cave_bat",      name: "Echo Bat",       hp: 62, atk: 27, def: 16, spd: 36, moves: ["bite", "bark"],       portrait: "bat" },
  wild_boar:     { id: "wild_boar",     name: "Stone Boar",     hp: 74, atk: 33, def: 26, spd: 14, moves: ["tackle", "styleslam"],portrait: "boar" },
  cave_serpent:  { id: "cave_serpent",  name: "Coil Serpent",   hp: 88, atk: 36, def: 24, spd: 25, moves: ["bite", "critique"],   portrait: "serpent" },

  prakriti_boss:   { id: "prakriti_boss",   name: "Prakriti",        hp: 160, atk: 30, def: 24, spd: 30, moves: ["critique", "runway"],             portrait: "prakriti", boss: true, phases: 2, rageMoves: ["styleslam", "runway", "critique"], bgm: "bgm_prakriti" },
  boss_sentinel:   { id: "boss_sentinel",   name: "Bamboo Sentinel", hp: 180, atk: 32, def: 28, spd: 22, moves: ["tackle", "styleslam"],            portrait: "spirit",   boss: true, phases: 2, rageMoves: ["styleslam", "focus"],             bgm: "bgm_sentinel" },
  boss_blossom:    { id: "boss_blossom",    name: "Blossom Warden",  hp: 200, atk: 31, def: 24, spd: 34, moves: ["roast", "critique"],              portrait: "moth",     boss: true, phases: 2, rageMoves: ["runway", "sonicblast", "critique"], bgm: "bgm_blossom" },
  boss_warden:     { id: "boss_warden",     name: "Mountain Warden", hp: 230, atk: 35, def: 32, spd: 18, moves: ["styleslam", "tackle"],            portrait: "boar",     boss: true, phases: 2, rageMoves: ["focus", "styleslam"],             bgm: "bgm_warden" },
  boss_guardian:   { id: "boss_guardian",   name: "Temple Guardian", hp: 280, atk: 36, def: 34, spd: 24, moves: ["focus", "styleslam"],             portrait: "guardian", boss: true, phases: 2, rageMoves: ["focus", "heroic"],                bgm: "bgm_miniboss" },
  fashion_teacher: { id: "fashion_teacher", name: "Arshiya",         hp: 420, atk: 34, def: 40, spd: 26, moves: ["critique", "styleslam", "roast"], portrait: "arshiya",  boss: true, phases: 3, rageMoves: ["styleslam", "runway", "focus"],   bgm: "bgm_boss" },
};

// --------------------------------------------------------------------------- items

export type ItemId =
  | "potion" | "super_potion" | "berry" | "key_scarf" | "hair_pin" | "old_photo"
  | "lost_ribbon" | "sparkle_shard" | "fashion_pass" | "lost_scroll"
  | "trial_talisman" | "village_supplies" | "sacred_flame_mountain"
  | "sacred_flame_garden" | "sacred_flame_cave" | "jade_charm" | "lantern_oil"
  | "mimo_treat" | "lore_book";

export type ItemDef = { id: ItemId; name: string; desc: string; heal?: number; key?: boolean; icon: string };

export const ITEMS: Record<ItemId, ItemDef> = {
  potion:       { id: "potion",       name: "Potion",        desc: "Restores 40 HP.", heal: 40, icon: "flame" },
  super_potion: { id: "super_potion", name: "Super Potion",  desc: "Restores 90 HP. From Mum.", heal: 90, icon: "flame" },
  berry:        { id: "berry",        name: "Jade Berry",    desc: "Restores 25 HP.", heal: 25, icon: "blossom" },
  key_scarf:    { id: "key_scarf",    name: "Silk Scarf",    desc: "Palakshi's lucky scarf.", key: true, icon: "star" },
  hair_pin:     { id: "hair_pin",     name: "Gold Hair Pin", desc: "Found in Sparkle Town.", key: true, icon: "star" },
  old_photo:    { id: "old_photo",    name: "Old Photo",     desc: "Palakshi and Mimo, year one.", key: true, icon: "paw" },
  lost_ribbon:  { id: "lost_ribbon",  name: "Lost Ribbon",   desc: "Prakriti's ribbon. Teal silk.", key: true, icon: "star" },
  sparkle_shard:{ id: "sparkle_shard",name: "Sparkle Shard", desc: "Hums faintly in the dark.", key: true, icon: "star" },
  fashion_pass: { id: "fashion_pass", name: "Fashion Pass",  desc: "Opens the Style Academy gate.", key: true, icon: "seal" },
  lost_scroll:  { id: "lost_scroll",  name: "Lost Scroll",   desc: "The Elder's stolen teaching.", key: true, icon: "scroll" },
  trial_talisman:{ id: "trial_talisman", name: "Trial Talisman", desc: "Proof of the Bamboo Trial.", key: true, icon: "seal" },
  village_supplies: { id: "village_supplies", name: "Village Supplies", desc: "Rice, oil and bandages.", key: true, icon: "lantern" },
  sacred_flame_mountain: { id: "sacred_flame_mountain", name: "Flame of Stone",  desc: "Sacred Flame — Mountain Shrine.", key: true, icon: "flame" },
  sacred_flame_garden:   { id: "sacred_flame_garden",   name: "Flame of Petals", desc: "Sacred Flame — Blossom Garden.", key: true, icon: "flame" },
  sacred_flame_cave:     { id: "sacred_flame_cave",     name: "Flame of Echoes", desc: "Sacred Flame — Ancient Cave.", key: true, icon: "flame" },
  jade_charm:   { id: "jade_charm",   name: "Jade Charm",    desc: "A quiet, cool weight.", key: true, icon: "star" },
  lantern_oil:  { id: "lantern_oil",  name: "Lantern Oil",   desc: "Burns steady all night.", key: true, icon: "lantern" },
  mimo_treat:   { id: "mimo_treat",   name: "Mimo's Treat",  desc: "Restores 30 HP. Mimo approves.", heal: 30, icon: "paw" },
  lore_book:    { id: "lore_book",    name: "Book of Echoes",desc: "Temple history, half-legible.", key: true, icon: "scroll" },
};

// --------------------------------------------------------------------------- quests

export type QuestStep = { id: string; label: string };
export type Quest = {
  id: "main" | "prakriti" | "hidden";
  name: string;
  steps: QuestStep[];
  step: number;
  done: boolean;
};

export const QUEST_MAIN: Quest = {
  id: "main",
  name: "Palakshi's Birthday Adventure",
  step: 0,
  done: false,
  steps: [
    { id: "wake",      label: "Get out of bed" },
    { id: "mom",       label: "Talk to Mum downstairs" },
    { id: "abhi",      label: "Find Abhimanyu in Sparkle Town" },
    { id: "clue_npc",  label: "Ask the witness in town" },
    { id: "clue_toy",  label: "Search Route 1 for Mimo's toy" },
    { id: "clue_paws", label: "Follow the paw prints" },
    { id: "mimo",      label: "Bring Mimo home" },
    { id: "village",   label: "Help Lantern Village" },
    { id: "scroll",    label: "Recover the Lost Scroll" },
    { id: "trial",     label: "Pass the Bamboo Forest Trial" },
    { id: "prakriti",  label: "Settle things with Prakriti" },
    { id: "temple",    label: "Wake the Temple of Echoes" },
    { id: "flames",    label: "Gather the three Sacred Flames" },
    { id: "lantern",   label: "Restore the Sacred Lantern" },
    { id: "pass",      label: "Enter the Style Academy" },
    { id: "boss",      label: "Defeat Arshiya" },
    // Final chapter — F-1205
    { id: "finale",    label: "Join the celebration" },
    { id: "find_abhi", label: "Find Abhimanyu and Faizal" },
    { id: "f1205",     label: "Meet everyone at F-1205" },
    { id: "evening",   label: "Spend the evening with the flatmates" },
    { id: "goodbye",   label: "Say goodbye to Abhimanyu" },
  ],
};

export const QUEST_PRAKRITI: Quest = {
  id: "prakriti",
  name: "Prakriti's Ribbon",
  step: 0,
  done: false,
  steps: [
    { id: "accept", label: "Accept Prakriti's request" },
    { id: "ribbon", label: "Find the teal ribbon" },
    { id: "return", label: "Return the ribbon to Prakriti" },
  ],
};

export const QUEST_HIDDEN: Quest = {
  id: "hidden",
  name: "Hidden Treasures",
  step: 0,
  done: false,
  steps: [
    { id: "h1", label: "Find the treasure at home" },
    { id: "h2", label: "Find the treasure in Sparkle Town" },
    { id: "h3", label: "Find the treasure in the woods" },
    { id: "h4", label: "Find the treasure at the Academy" },
  ],
};

// --------------------------------------------------------------------------- dialogue

export type DialogueLine = {
  who: string;
  portrait?: string;
  text: string;
  onEnd?: string;
};

export const DIALOGUES: Record<string, DialogueLine[]> = {
  intro: [
    { who: "Prof. Kaajal", portrait: "kaajal", text: "Ah — you're awake. Good." },
    { who: "Prof. Kaajal", portrait: "kaajal", text: "Today is Palakshi's birthday. The eighteenth year of the Crimson Lantern." },
    { who: "Prof. Kaajal", portrait: "kaajal", text: "Three things stand between her and the evening feast." },
    { who: "Prof. Kaajal", portrait: "kaajal", text: "A missing dog. A stolen flame. And a teacher who should know better." },
    { who: "Prof. Kaajal", portrait: "kaajal", text: "Go on, Palakshi. The day won't walk itself.", onEnd: "intro_done" },
  ],
  bed:       [{ who: "Palakshi", portrait: "palakshi", text: "I've only just got up. Standing is enough of an achievement." }],
  desk:      [{ who: "Palakshi", portrait: "palakshi", text: "Half-finished homework and a very finished cup of tea." }],
  bookshelf: [{ who: "Palakshi", portrait: "palakshi", text: "Sword manuals, mostly. One cookbook, hidden at the back." }],
  tv:        [{ who: "Palakshi", portrait: "palakshi", text: "The morning report: 'Lantern Festival cancelled — no reason given.'" }],
  sign_bedroom: [{ who: "Note", text: "Mimo's bowl. Full. Untouched since last night." }],

  mom: [
    { who: "Bidisha", portrait: "bidisha", text: "Happy birthday, my heart." },
    { who: "Bidisha", portrait: "bidisha", text: "I wanted the morning to be perfect. It isn't." },
    { who: "Bidisha", portrait: "bidisha", text: "Mimo slipped the gate before sunrise. I've looked everywhere in the house." },
    { who: "Bidisha", portrait: "bidisha", text: "Take this. And take a friend — don't go past Route 1 alone.", onEnd: "give_super_potion" },
  ],
  mom_after: [{ who: "Bidisha", portrait: "bidisha", text: "Bring her home before the lanterns light. That's my only wish." }],

  abhimanyu_meet: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Palakshi! Happy birthday — I was going to sing it, but you look busy." },
    { who: "Palakshi", portrait: "palakshi", text: "Mimo's gone." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Then the song waits." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "I've got the guitar and no plans. I'm coming.", onEnd: "abhi_join" },
  ],
  witness: [
    { who: "Kid", portrait: "townie", text: "A little white dog? Yeah! Went past me like the ground was on fire." },
    { who: "Kid", portrait: "townie", text: "Dropped something red on the road out east. Route 1, I think.", onEnd: "clue_witness" },
  ],
  townie1: [{ who: "Townsfolk", portrait: "townie", text: "The festival's off. Fifty years running, and off." }],
  townie2: [{ who: "Townsfolk", portrait: "townie", text: "They say the flame in the village lantern just… stopped." }],
  clue_toy: [
    { who: "Palakshi", portrait: "palakshi", text: "Mimo's red ball. Chewed exactly where she always chews it." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "She came this way. Keep going.", onEnd: "clue_toy_found" },
  ],
  clue_paws: [
    { who: "Palakshi", portrait: "palakshi", text: "Paw prints. Small, hurried, heading into the woods." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "She was running from something.", onEnd: "clue_paws_found" },
  ],
  mimo_bush: [
    { who: "Palakshi", portrait: "palakshi", text: "Something's shaking in there. Mimo…?" },
    { who: "???", text: "GRRRRR—", onEnd: "start_mimo_battle" },
  ],
  mimo_recognize: [
    { who: "Palakshi", portrait: "palakshi", text: "Mimo. Mimo, it's me. It's me." },
    { who: "Mimo", portrait: "mimo", text: "…!" },
    { who: "Palakshi", portrait: "palakshi", text: "You're alright. You're alright. Come here." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "I'll take word to your mum. Go on — the two of you have a day to finish.", onEnd: "mimo_join" },
  ],

  prakriti_meet: [
    { who: "Prakriti", portrait: "prakriti", text: "Palakshi. Of course it's you, and of course it's today." },
    { who: "Prakriti", portrait: "prakriti", text: "I lost a ribbon in these woods. Teal. Find it, and I'll consider being pleasant.", onEnd: "prakriti_quest" },
  ],
  prakriti_wait: [{ who: "Prakriti", portrait: "prakriti", text: "Teal. Silk. Not difficult." }],
  prakriti_ribbon_return: [
    { who: "Prakriti", portrait: "prakriti", text: "…You actually looked." },
    { who: "Prakriti", portrait: "prakriti", text: "Take the charm. Don't make it mean anything.", onEnd: "prakriti_reward" },
  ],
  prakriti_wait_guardian: [
    { who: "Prakriti", portrait: "prakriti", text: "Not yet. Something has been nesting at the blossom shrine, and it hates company." },
    { who: "Prakriti", portrait: "prakriti", text: "Clear it out and I'll give you a real fight. I'm not duelling with that thing screaming over us." },
  ],
  miniboss3: [
    { who: "Blossom Warden", portrait: "moth", text: "Petals fall. Petals fall. Nothing leaves this garden with its flame." },
    { who: "Palakshi", portrait: "palakshi", text: "Then I'll leave with yours.", onEnd: "start_miniboss3" },
  ],
  miniboss3_done: [{ who: "Blossom Warden", portrait: "moth", text: "...the petals fall anyway. Take the shrine. Take the rival. Take it all.", onEnd: "miniboss3_end" }],
  prakriti_duel: [
    { who: "Prakriti", portrait: "prakriti", text: "The Academy gate needs a pass. I have one." },
    { who: "Prakriti", portrait: "prakriti", text: "You'll have to be better than me to hold it. You never have been." },
    { who: "Palakshi", portrait: "palakshi", text: "Then today's a good day to start.", onEnd: "start_prakriti" },
  ],
  prakriti_defeat: [
    { who: "Prakriti", portrait: "prakriti", text: "…Hm." },
    { who: "Prakriti", portrait: "prakriti", text: "Take it. The pass, and the way to the garden's flame." },
    { who: "Prakriti", portrait: "prakriti", text: "Arshiya taught us both. Only one of us kept listening. Happy birthday, Palakshi.", onEnd: "prakriti_done" },
  ],

  village_arrive: [
    { who: "Palakshi", portrait: "palakshi", text: "Lantern Village. Every post is dark." },
    { who: "Mimo", portrait: "mimo", text: "…" },
  ],
  villager: [{ who: "Villager", portrait: "townie", text: "The great lantern went cold three nights ago. The festival with it.", onEnd: "village_talk" }],
  merchant: [
    { who: "Merchant", portrait: "townie", text: "Supplies, no charge. Today of all days." },
    { who: "Merchant", portrait: "townie", text: "Take the whole crate. Just bring the light back.", onEnd: "give_supplies" },
  ],
  musician: [
    { who: "Travelling Musician", portrait: "townie", text: "That's a fine white guitar. Do you know what sound can break?" },
    { who: "Palakshi", portrait: "palakshi", text: "Show me." },
    { who: "Travelling Musician", portrait: "townie", text: "Strike the note the bamboo cannot hold. That is the Sound Barrier.", onEnd: "guitar_learned" },
  ],
  elder: [
    { who: "Elder Shu", portrait: "elder", text: "Palakshi. I knew your grandmother. You have her stance." },
    { who: "Elder Shu", portrait: "elder", text: "The Sacred Lantern's flame was not lost. It was taken." },
    { who: "Elder Shu", portrait: "elder", text: "Arshiya of the Style Academy. She wanted the light for her stage." },
    { who: "Elder Shu", portrait: "elder", text: "Bring me the Lost Scroll from the bamboo shrine. It tells us how to rekindle it.", onEnd: "elder_brief" },
  ],
  elder_scroll: [
    { who: "Elder Shu", portrait: "elder", text: "You have it. Good." },
    { who: "Elder Shu", portrait: "elder", text: "Three flames — stone, petals, echoes. Then the lantern takes fire again.", onEnd: "scroll_given" },
  ],
  elder_wait: [{ who: "Elder Shu", portrait: "elder", text: "Stone, petals, echoes. Bring me all three." }],

  barrier_locked: [{ who: "Palakshi", portrait: "palakshi", text: "A wall of standing bamboo. Solid as stone." }],
  barrier_break: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Stand back. This one's loud." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "SOUND BARRIER!", onEnd: "barrier_broken" },
  ],
  barrier_break_mimo: [
    { who: "Palakshi", portrait: "palakshi", text: "The note the bamboo cannot hold. The musician showed me." },
    { who: "Palakshi", portrait: "palakshi", text: "Hah!", onEnd: "barrier_broken" },
  ],
  scroll_take: [
    { who: "Palakshi", portrait: "palakshi", text: "The Lost Scroll. Still dry after all this time." },
    { who: "Palakshi", portrait: "palakshi", text: "Elder Shu will want this in his hands, not mine.", onEnd: "scroll_taken" },
  ],
  miniboss1: [
    { who: "Bamboo Sentinel", portrait: "spirit", text: "THE SHRINE SLEEPS. YOU DO NOT PASS." },
    { who: "Palakshi", portrait: "palakshi", text: "Then wake it up with me.", onEnd: "start_miniboss1" },
  ],
  miniboss1_done: [{ who: "Bamboo Sentinel", portrait: "spirit", text: "…THE TRIAL IS YOURS. TAKE THE TALISMAN.", onEnd: "miniboss1_end" }],
  miniboss2: [
    { who: "Mountain Warden", portrait: "boar", text: "The path above is stone and wind. Prove your footing." },
    { who: "Palakshi", portrait: "palakshi", text: "Watch me.", onEnd: "start_miniboss2" },
  ],
  miniboss2_done: [{ who: "Mountain Warden", portrait: "boar", text: "Go. The shrine is yours.", onEnd: "miniboss2_end" }],
  guardian: [
    { who: "Temple Guardian", portrait: "guardian", text: "FOUR PLATES. FOUR STATUES. ONE HEART." },
    { who: "Temple Guardian", portrait: "guardian", text: "SHOW ME THE LAST.", onEnd: "start_guardian" },
  ],
  guardian_done: [{ who: "Temple Guardian", portrait: "guardian", text: "THE TEMPLE WAKES. THE LANTERN WAITS.", onEnd: "guardian_end" }],

  gatekeeper_locked: [{ who: "Gatekeeper", portrait: "townie", text: "No pass, no Academy. Teacher's orders." }],
  gatekeeper_open: [
    { who: "Gatekeeper", portrait: "townie", text: "…A genuine pass. Hm. Go in, then." },
    { who: "Gatekeeper", portrait: "townie", text: "For what it's worth — she's been waiting for you.", onEnd: "gate_open" },
  ],
  boss_meet: [
    { who: "Arshiya", portrait: "arshiya", text: "The birthday girl. In travelling clothes. How rustic." },
    { who: "Palakshi", portrait: "palakshi", text: "You took the village's flame." },
    { who: "Arshiya", portrait: "arshiya", text: "I borrowed a light nobody was using properly." },
    { who: "Arshiya", portrait: "arshiya", text: "You came with a dog. I taught you better than that." },
    { who: "Palakshi", portrait: "palakshi", text: "You taught me that one fighter isn't a school." },
    { who: "Palakshi", portrait: "palakshi", text: "Mimo. With me.", onEnd: "start_boss" },
  ],
  boss_defeat: [
    { who: "Arshiya", portrait: "arshiya", text: "…Enough. Enough." },
    { who: "Arshiya", portrait: "arshiya", text: "You fought as two. I never learned how." },
    { who: "Arshiya", portrait: "arshiya", text: "Take the flame back to Shu. Tell him the Academy is sorry — those words, exactly." },
    { who: "Palakshi", portrait: "palakshi", text: "Come to the festival. Sit near the front.", onEnd: "boss_end" },
  ],
  lantern_restored: [
    { who: "Elder Shu", portrait: "elder", text: "Three flames, one lantern. Light it." },
    { who: "Palakshi", portrait: "palakshi", text: "…" },
    { who: "Elder Shu", portrait: "elder", text: "There. Fifty-one years running.", onEnd: "lantern_restored" },
  ],
  // ------------------------------------------------------------ Riddhi
  riddhi_town_1: [
    { who: "Riddhi", portrait: "riddhi", text: "Oye. Birthday girl. Tu itni subah uth gayi? Kaun mar gaya?" },
    { who: "Palakshi", portrait: "palakshi", text: "Mimo gaayab hai." },
    { who: "Riddhi", portrait: "riddhi", text: "Toh dhoondh na. Aur jacket pehen, mausam mat dekh." },
    { who: "Riddhi", portrait: "riddhi", text: "Mazaak. Main bhi aa rahi hoon... nahi aa rahi. Tu jaa, main yahan se cheer karungi.", onEnd: "riddhi_chat" },
  ],
  riddhi_town_2: [
    { who: "Riddhi", portrait: "riddhi", text: "Abhi tak yahin hai? Kutta khud aa jayega kya tere liye." },
    { who: "Palakshi", portrait: "palakshi", text: "Jaa rahi hoon." },
    { who: "Riddhi", portrait: "riddhi", text: "Road pe east. Woh bachcha jo chillata rehta hai, usne kuch dekha hai.", onEnd: "riddhi_chat" },
  ],
  riddhi_town_3: [
    { who: "Riddhi", portrait: "riddhi", text: "Photo bhej jab mil jaye. Kutte ki. Teri nahi.", onEnd: "riddhi_chat" },
  ],
  riddhi_village_1: [
    { who: "Riddhi", portrait: "riddhi", text: "Tu yahan bhi? Festival cancel ho gaya aur tu nahi. Nice." },
    { who: "Palakshi", portrait: "palakshi", text: "Tu kaise pahunchi?" },
    { who: "Riddhi", portrait: "riddhi", text: "Bus hai yaar. Tum log pahaad chadh rahe ho, main chai pi rahi hoon." },
    { who: "Riddhi", portrait: "riddhi", text: "Woh musician uncle kuch bol raha tha, sound-vound. Sun le, kaam ka lagta hai.", onEnd: "riddhi_chat" },
  ],
  riddhi_village_2: [
    { who: "Riddhi", portrait: "riddhi", text: "Mimo ko dekh. Mimo ko dekh kaise chal raha hai. Royalty." },
    { who: "Mimo", portrait: "mimo", text: "!", onEnd: "riddhi_chat" },
  ],
  riddhi_village_3: [
    { who: "Riddhi", portrait: "riddhi", text: "Bamboo wala gate upar hai. Lanterns follow kar, nahi toh tu ghoomti rahegi.", onEnd: "riddhi_chat" },
  ],
  riddhi_garden_1: [
    { who: "Riddhi", portrait: "riddhi", text: "Yeh garden dekh. Photo le. Nahi, mera photo le." },
    { who: "Palakshi", portrait: "palakshi", text: "Prakriti kahan hai?" },
    { who: "Riddhi", portrait: "riddhi", text: "Pond ke paas attitude leke khadi hai. Pehle woh udne wali cheez nipta, phir jaa dikha de.", onEnd: "riddhi_chat" },
  ],
  riddhi_garden_2: [
    { who: "Riddhi", portrait: "riddhi", text: "Haar gayi toh bolna mat ki main yahan thi." },
    { who: "Palakshi", portrait: "palakshi", text: "Jeet gayi toh?" },
    { who: "Riddhi", portrait: "riddhi", text: "Toh main thi. Obviously.", onEnd: "riddhi_chat" },
  ],
  riddhi_garden_3: [
    { who: "Riddhi", portrait: "riddhi", text: "Pahaad pe jaa rahi hai? Jacket. Main bol chuki hoon.", onEnd: "riddhi_chat" },
  ],

  finale: [
    { who: "Bidisha", portrait: "bidisha", text: "You're late, you're filthy, and the whole village came." },
    { who: "Riddhi", portrait: "riddhi", text: "Bhai tu sach mein ek teacher se lad ke aayi? Bata na kaise." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "I wrote the song after all." },
    { who: "Prakriti", portrait: "prakriti", text: "It's a passable song." },
    { who: "Mimo", portrait: "mimo", text: "!!!" },
    { who: "Palakshi", portrait: "palakshi", text: "Best birthday I've had." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "I have to head back tonight. The flat — F-1205. Faizal's holding the door, and the others never lock it." },
    { who: "Palakshi", portrait: "palakshi", text: "You're leaving? Now?" },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Come find us when the lanterns are done. West road out of town, past the river. Faizal will let you in.", onEnd: "after_finale" },
  ],

  // ------------------------------------------------------- final chapter
  road_sign: [{ who: "Sign", text: "WEST ROAD — the F-block flats are past the river. Mind the bridge; it is older than the village." }],
  f1205_arrive: [
    { who: "Faizal", portrait: "faizal", text: "Aa gayi. Shoes optional, snacks mandatory." },
    { who: "Faizal", portrait: "faizal", text: "Woh andar hai. Hall ke end pe, left. Kutta sofa pe chadh sakta hai, Hakim nahi hatega.", onEnd: "f1205_arrived" },
  ],
  abhi_home_first: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Whadup loser." },
    { who: "Palakshi", portrait: "palakshi", text: "Hi Bhandup.", onEnd: "met_abhi_home" },
  ],
  abhi_home_wait: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Baaki sab ghar pe hi hain. Ghoom le." },
  ],

  faizal_meet: [
    { who: "Faizal", portrait: "faizal", text: "Jab dekh ma baap pe chali jaati, kuch aur nahi aata na khal gyi." },
    { who: "Palakshi", portrait: "palakshi", text: "Chal chut ke bhagone.", onEnd: "met_faizal" },
  ],
  faizal_again: [{ who: "Faizal", portrait: "faizal", text: "Paani counter pe hai. Rice ban raha hai. Dono le le." }],
  faizal_late: [{ who: "Faizal", portrait: "faizal", text: "Kabhi bhi aa jaana. Surprise hone ka natak kar lunga." }],
  garv_meet: [
    { who: "Garv", portrait: "garv", text: "Kya re laadli, sutta piyegi?" },
    { who: "Palakshi", portrait: "palakshi", text: "Konsa hai?" },
    { who: "Garv", portrait: "garv", text: "Red.", onEnd: "met_garv" },
  ],
  garv_again: [{ who: "Garv", portrait: "garv", text: "Baith. Itna chal ke aayi hai, baithne ka haq hai." }],
  garv_late: [{ who: "Garv", portrait: "garv", text: "Andhera hone se pehle nikal jaana. Valley door hai." }],
  hakim_meet: [
    { who: "Hakim", portrait: "hakim", text: "Cunt bro." },
    { who: "Palakshi", portrait: "palakshi", text: "Chal junior." },
    { who: "Hakim", portrait: "hakim", text: "Haan senior.", onEnd: "met_hakim" },
  ],
  hakim_again: [{ who: "Hakim", portrait: "hakim", text: "Mm." }],
  hakim_late: [{ who: "Hakim", portrait: "hakim", text: "Close hai. Yeh cheez. Is baar sach mein close hai." }],
  dev_meet: [
    { who: "Dev", portrait: "dev", text: "Aur bhaiii." },
    { who: "Palakshi", portrait: "palakshi", text: "Dev body wody bana li." },
    { who: "Dev", portrait: "dev", text: "Itne compliment nahi le pata baap re.", onEnd: "met_dev" },
  ],
  dev_again: [{ who: "Dev", portrait: "dev", text: "Baithne se pehle stretch kar le. Bata raha hoon." }],
  dev_late: [{ who: "Dev", portrait: "dev", text: "Next time kutte ko run pe le aana. Keep up karega." }],
  abhi_home_evening: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Sab mil liye? Chal, sofa pe. Ek raat toh de.", onEnd: "evening_start" },
  ],
  f1205_evening: [
    { who: "Garv", portrait: "garv", text: "Chalo, sab baitho. Hakim, iPad neeche." },
    { who: "Hakim", portrait: "hakim", text: "Neeche hai. Dekh. Neeche." },
    { who: "Faizal", portrait: "faizal", text: "Toh ek teacher ne flame chura li. Seriously." },
    { who: "Palakshi", portrait: "palakshi", text: "Borrow, she said. Stage ke liye." },
    { who: "Dev", portrait: "dev", text: "Aur tune usko haraya? Properly?" },
    { who: "Palakshi", portrait: "palakshi", text: "Mimo aur maine. Ek ek karke. Wahi trick tha." },
    { who: "Mimo", portrait: "mimo", text: "!" },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Last hit kutte ko lene diya. Main abhi tak recover nahi hua." },
    { who: "Garv", portrait: "garv", text: "Bamboo wala toh main hi tha wahan. Mentally." },
    { who: "Faizal", portrait: "faizal", text: "Tu bistar pe tha. Mentally bhi." },
    { who: "Faizal", portrait: "faizal", text: "Chalo. Za nikaalo." },
    { who: "Garv", portrait: "garv", text: "Window." },
    { who: "Faizal", portrait: "faizal", text: "Window khuli hai. Hamesha khuli hai. Isliye thand hai." },
    { who: "Hakim", portrait: "hakim", text: "Idhar pass kar. iPad rakh deta hoon." },
    { who: "Dev", portrait: "dev", text: "Jhooth." },
    { who: "Garv", portrait: "garv", text: "...Toh ab kya, birthday girl?" },
    { who: "Palakshi", portrait: "palakshi", text: "Ghar. Lantern jal gaya. Fifty-one years." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Aur phir?" },
    { who: "Palakshi", portrait: "palakshi", text: "Phir wapas aaungi. Dekhne Hakim ki cheez kabhi khatam hoti hai ya nahi." },
    { who: "Hakim", portrait: "hakim", text: "...Close hai.", onEnd: "evening_done" },
  ],
  f1205_goodbye: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Walk you out?" },
    { who: "Palakshi", portrait: "palakshi", text: "Darwaze tak." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Weird hai na. Subah tu bed se uthi thi aur Mimo gaayab tha." },
    { who: "Palakshi", portrait: "palakshi", text: "Aur tu guitar leke khada tha, jaise kuch bhi ho sakta hai." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Bass. Kitni baar bolun." },
    { who: "Palakshi", portrait: "palakshi", text: "Bass." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Thank you. Aaj ke liye. Kutte ki jagah bass uthane dene ke liye." },
    { who: "Palakshi", portrait: "palakshi", text: "Tune gaana likha." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Next time properly bajaunga." },
    { who: "Palakshi", portrait: "palakshi", text: "Yeh chapter khatam ho raha hai, na." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Haan. Par tu wapas aa rahi hai. Tune khud bola." },
    { who: "Palakshi", portrait: "palakshi", text: "...Aa idhar.", onEnd: "final_hug" },
  ],
  monk_heal: [
    { who: "Village Monk", portrait: "monk", text: "Sit. Breathe." },
    { who: "Village Monk", portrait: "monk", text: "There. Come back whenever the road is unkind — I am always here." },
  ],
  monk: [{ who: "Temple Monk", portrait: "elder", text: "Stand on the plates in the order the statues face. The temple is patient. I am not." }],
  inscription: [{ who: "Inscription", text: "…and the light was carried in three parts, so that no one thief could take it whole." }],
  viewpoint: [{ who: "Palakshi", portrait: "palakshi", text: "The whole valley. Home is that small smudge of smoke." }],
};
