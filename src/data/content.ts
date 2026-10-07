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
  boss_sentinel:   { id: "boss_sentinel",   name: "Bamboo Sentinel", hp: 180, atk: 32, def: 28, spd: 22, moves: ["tackle", "styleslam"],            portrait: "spirit",   boss: true, phases: 2, rageMoves: ["styleslam", "focus"],             bgm: "bgm_miniboss" },
  boss_warden:     { id: "boss_warden",     name: "Mountain Warden", hp: 230, atk: 35, def: 32, spd: 18, moves: ["styleslam", "tackle"],            portrait: "boar",     boss: true, phases: 2, rageMoves: ["focus", "styleslam"],             bgm: "bgm_miniboss" },
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
  mom_after: [{ who: "Bidisha", portrait: "bidisha", text: "Bring him home before the lanterns light. That's my only wish." }],

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
    { who: "Palakshi", portrait: "palakshi", text: "Mimo's red ball. Chewed exactly where he always chews it." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "He came this way. Keep going.", onEnd: "clue_toy_found" },
  ],
  clue_paws: [
    { who: "Palakshi", portrait: "palakshi", text: "Paw prints. Small, hurried, heading into the woods." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "He was running from something.", onEnd: "clue_paws_found" },
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
  finale: [
    { who: "Bidisha", portrait: "bidisha", text: "You're late, you're filthy, and the whole village came." },
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
    { who: "Faizal", portrait: "faizal", text: "You must be Palakshi. He has talked about nothing else since he walked in." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "You found it." },
    { who: "Palakshi", portrait: "palakshi", text: "You said past the river. You didn't say how far past." },
    { who: "Faizal", portrait: "faizal", text: "Come in, come in. Shoes are optional, snacks are not. The dog gets the good cushion.", onEnd: "f1205_arrived" },
  ],
  abhi_home_wait: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Go say hello. Garv will pretend he isn't curious. Hakim won't look up. Dev will." },
  ],
  abhi_home_evening: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Everyone's met you now. Sit with us a while — it's the end of a long day.", onEnd: "evening_start" },
  ],
  faizal_meet: [
    { who: "Faizal", portrait: "faizal", text: "Faizal. Resident door-holder, and the only one here who cooks." },
    { who: "Faizal", portrait: "faizal", text: "Sit anywhere that isn't Hakim. He looks soft but he does not move.", onEnd: "met_faizal" },
  ],
  faizal_again: [{ who: "Faizal", portrait: "faizal", text: "Water's on the counter. Rice is on the stove. Help yourself to both." }],
  faizal_late: [{ who: "Faizal", portrait: "faizal", text: "Come back any time. I'll pretend it's a surprise." }],
  garv_meet: [
    { who: "Garv", portrait: "garv", text: "So you're the one who walked a dog across a mountain." },
    { who: "Garv", portrait: "garv", text: "Garv. Oldest in the flat, which mostly means I buy the rice and settle the arguments." },
    { who: "Garv", portrait: "garv", text: "He came home lighter than he left. I'd say that's your doing.", onEnd: "met_garv" },
  ],
  garv_again: [{ who: "Garv", portrait: "garv", text: "Sit. You've earned the sitting." }],
  garv_late: [{ who: "Garv", portrait: "garv", text: "Get home before the lamps go out. The valley's a long walk in the dark." }],
  hakim_meet: [
    { who: "Hakim", portrait: "hakim", text: "Hm? Oh. Hi. One second—" },
    { who: "Hakim", portrait: "hakim", text: "…Okay. Hakim. Sorry — I'm halfway through something and it keeps nearly working." },
    { who: "Hakim", portrait: "hakim", text: "He's been playing the same four chords since he got back. You'd know why.", onEnd: "met_hakim" },
  ],
  hakim_again: [{ who: "Hakim", portrait: "hakim", text: "Mm." }],
  hakim_late: [{ who: "Hakim", portrait: "hakim", text: "It's close. The thing. It's really close this time." }],
  dev_meet: [
    { who: "Dev", portrait: "dev", text: "Dev. Don't mind the weights — they live here, I just visit." },
    { who: "Dev", portrait: "dev", text: "Three bosses and a mountain in one day? Respect. That's a leg day." },
    { who: "Dev", portrait: "dev", text: "Mimo can stay. Mimo can have my bed.", onEnd: "met_dev" },
  ],
  dev_again: [{ who: "Dev", portrait: "dev", text: "Stretch before you sit down. Trust me on this one." }],
  dev_late: [{ who: "Dev", portrait: "dev", text: "Next time, bring the dog for a run. He'd keep up." }],
  f1205_evening: [
    { who: "Garv", portrait: "garv", text: "Right. Everyone sit. Hakim — down." },
    { who: "Hakim", portrait: "hakim", text: "I'm down. I'm sitting. I'm listening." },
    { who: "Faizal", portrait: "faizal", text: "So. A teacher stole a flame." },
    { who: "Palakshi", portrait: "palakshi", text: "Borrowed it, she said. For a stage." },
    { who: "Dev", portrait: "dev", text: "And you fought her? Properly?" },
    { who: "Palakshi", portrait: "palakshi", text: "Mimo and I did. One of us at a time. That was the whole trick." },
    { who: "Mimo", portrait: "mimo", text: "!" },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "She let the dog take the last hit. I'm still not over it." },
    { who: "Faizal", portrait: "faizal", text: "This calls for the za." },
    { who: "Garv", portrait: "garv", text: "Window." },
    { who: "Faizal", portrait: "faizal", text: "Window's open. It's always open. That's why it's cold." },
    { who: "Hakim", portrait: "hakim", text: "Pass it this way and I'll put the iPad down." },
    { who: "Dev", portrait: "dev", text: "Lies." },
    { who: "Garv", portrait: "garv", text: "So what now, birthday girl?" },
    { who: "Palakshi", portrait: "palakshi", text: "Home. The lantern's lit. Fifty-one years." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "And then?" },
    { who: "Palakshi", portrait: "palakshi", text: "And then I come back and see if Hakim ever finishes that thing." },
    { who: "Hakim", portrait: "hakim", text: "…It's close.", onEnd: "evening_done" },
  ],
  f1205_goodbye: [
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Walk you out?" },
    { who: "Palakshi", portrait: "palakshi", text: "Just to the door." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "Thank you. For today. For letting me carry the guitar instead of the dog." },
    { who: "Palakshi", portrait: "palakshi", text: "You wrote the song." },
    { who: "Abhimanyu", portrait: "abhimanyu", text: "I'll play it properly next time." },
    { who: "Palakshi", portrait: "palakshi", text: "…Come here.", onEnd: "final_hug" },
  ],
  monk_heal: [
    { who: "Village Monk", portrait: "monk", text: "Sit. Breathe." },
    { who: "Village Monk", portrait: "monk", text: "There. Come back whenever the road is unkind — I am always here." },
  ],
  monk: [{ who: "Temple Monk", portrait: "elder", text: "Stand on the plates in the order the statues face. The temple is patient. I am not." }],
  inscription: [{ who: "Inscription", text: "…and the light was carried in three parts, so that no one thief could take it whole." }],
  viewpoint: [{ who: "Palakshi", portrait: "palakshi", text: "The whole valley. Home is that small smudge of smoke." }],
};
