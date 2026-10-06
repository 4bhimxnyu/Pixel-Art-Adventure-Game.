// ---------------------------------------------------------------------------
// Player guidance. One entry per quest step id.
//
// RULE: any new quest step MUST get a STEP_GUIDE entry, or MissionTracker has
// no objective and no hint ladder to show.
//
// hints are a ladder: [vague, clearer, nearly explicit]. `chain` is the map
// route from where the player probably is to where they need to be.
// ---------------------------------------------------------------------------

import type { MapId } from "../game/maps";

export type Guide = {
  objective: string;
  place: string;
  region: string;
  hints: [string, string, string];
  chain?: string[];
};

export const MAP_PLACE: Record<MapId, string> = {
  bedroom: "Palakshi's Bedroom",
  house: "Palakshi's House",
  town: "Sparkle Town",
  route1: "Route 1",
  forest: "Whispering Woods",
  village: "Lantern Village",
  bamboo: "Bamboo Forest",
  mountain: "Mountain Trail",
  temple: "Temple of Echoes",
  garden: "Cherry Blossom Garden",
  cave: "Ancient Cave",
  academy: "Style Academy",
  road: "The West Road",
  f1205: "F-1205",
};

export const MAP_REGION: Record<MapId, string> = {
  bedroom: "home", house: "home", town: "home", route1: "home", forest: "home",
  village: "village", bamboo: "bamboo", mountain: "mountain", temple: "temple",
  garden: "garden", cave: "cave", academy: "academy", road: "f1205", f1205: "f1205",
};

export const STEP_GUIDE: Record<string, Guide> = {
  wake: {
    objective: "Get out of bed and leave your room",
    place: "Palakshi's Bedroom",
    region: "home",
    hints: [
      "It's your birthday. Something feels off downstairs.",
      "The door is at the bottom of the room.",
      "Walk onto the door tile at the south wall to go downstairs.",
    ],
    chain: ["Bedroom", "House"],
  },
  mom: {
    objective: "Talk to Mum",
    place: "Palakshi's House",
    region: "home",
    hints: [
      "Mum is up early, and she isn't smiling.",
      "She's standing in the main room downstairs.",
      "Face Bidisha and press E to talk. She'll give you a Super Potion.",
    ],
    chain: ["House", "Bidisha"],
  },
  abhi: {
    objective: "Find Abhimanyu in Sparkle Town",
    place: "Sparkle Town",
    region: "home",
    hints: [
      "You shouldn't search for Mimo alone.",
      "Abhimanyu is somewhere in Sparkle Town, guitar in hand.",
      "Leave the house south, then talk to the boy with the white guitar in town.",
    ],
    chain: ["House", "Sparkle Town", "Abhimanyu"],
  },
  clue_npc: {
    objective: "Ask the witness in Sparkle Town",
    place: "Sparkle Town",
    region: "home",
    hints: [
      "Someone in town saw a small white dog run past.",
      "A kid near the town square is bursting to tell you something.",
      "Talk to the kid standing by the eastern path out of Sparkle Town.",
    ],
    chain: ["Sparkle Town", "Kid witness"],
  },
  clue_toy: {
    objective: "Find Mimo's toy on Route 1",
    place: "Route 1",
    region: "home",
    hints: [
      "Mimo never goes anywhere without that red ball.",
      "Take the eastern road out of Sparkle Town and search the roadside.",
      "On Route 1, face the red ball beside the path and press E.",
    ],
    chain: ["Sparkle Town", "Route 1", "Red ball"],
  },
  clue_paws: {
    objective: "Follow the paw prints",
    place: "Route 1",
    region: "home",
    hints: [
      "Small prints lead away from where the ball fell.",
      "They head north, towards the treeline.",
      "Step on the paw-print tiles on Route 1, then take the north exit into the woods.",
    ],
    chain: ["Route 1", "Paw prints", "Whispering Woods"],
  },
  mimo: {
    objective: "Find Mimo in the Whispering Woods",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "Something is hiding in the woods, and it's frightened.",
      "A bush deep in the woods keeps shaking.",
      "In the Whispering Woods, face the rustling bush and press E. She won't know you at first.",
    ],
    chain: ["Route 1", "Whispering Woods", "Rustling bush"],
  },
  village: {
    objective: "Help Lantern Village and speak to Elder Shu",
    place: "Lantern Village",
    region: "village",
    hints: [
      "The festival was cancelled. Nobody in town knows why.",
      "The village north of the woods has the answer — and an Elder.",
      "Go north from the Whispering Woods to Lantern Village, talk to villagers, then to Elder Shu by the great lantern.",
    ],
    chain: ["Whispering Woods", "Lantern Village", "Elder Shu"],
  },
  scroll: {
    objective: "Recover the Lost Scroll from the bamboo shrine",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "The Elder needs a teaching that was taken to the bamboo.",
      "A wall of bamboo blocks the shrine. Sound can break it.",
      "Learn Sound Barrier from the musician in the village, then break the barrier in the Bamboo Forest and take the scroll.",
    ],
    chain: ["Lantern Village", "Bamboo Forest", "Ancient Shrine", "Lost Scroll"],
  },
  trial: {
    objective: "Pass the Bamboo Forest Trial",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "The shrine will not open for someone who hasn't earned it.",
      "Stone plates and statues. Wake the statues, then stand the plates.",
      "Touch both statues in the Bamboo Forest, step on both plates, then defeat the Bamboo Sentinel.",
    ],
    chain: ["Bamboo Forest", "Statues", "Plates", "Bamboo Sentinel"],
  },
  prakriti: {
    objective: "Settle things with Prakriti in the garden",
    place: "Cherry Blossom Garden",
    region: "garden",
    hints: [
      "Prakriti has something you need, and she won't hand it over.",
      "She's waiting in the Cherry Blossom Garden.",
      "Enter the Cherry Blossom Garden from the Bamboo Forest and duel Prakriti. She fights in two phases.",
    ],
    chain: ["Bamboo Forest", "Cherry Blossom Garden", "Prakriti"],
  },
  temple: {
    objective: "Wake the Temple of Echoes",
    place: "Temple of Echoes",
    region: "temple",
    hints: [
      "The temple above the mountain is asleep.",
      "Four statues, four plates, and a Guardian who wants to see the last one.",
      "Cross the Mountain Trail, enter the Temple of Echoes, activate all four statues and plates, then defeat the Temple Guardian.",
    ],
    chain: ["Cherry Blossom Garden", "Mountain Trail", "Temple of Echoes", "Temple Guardian"],
  },
  flames: {
    objective: "Gather the three Sacred Flames",
    place: "Mountain, Garden and Cave",
    region: "mountain",
    hints: [
      "Stone, petals, echoes — the light was split in three.",
      "One flame on the Mountain Trail, one in the Blossom Garden, one deep in the Ancient Cave.",
      "Interact with the brazier at each of the three shrines: Mountain Trail, Cherry Blossom Garden, Ancient Cave.",
    ],
    chain: ["Mountain Trail", "Cherry Blossom Garden", "Ancient Cave"],
  },
  lantern: {
    objective: "Restore the Sacred Lantern",
    place: "Temple of Echoes",
    region: "temple",
    hints: [
      "You carry all three flames. They belong together.",
      "The Sacred Lantern stands at the heart of the temple.",
      "Return to the Temple of Echoes and interact with the Sacred Lantern.",
    ],
    chain: ["Ancient Cave", "Temple of Echoes", "Sacred Lantern"],
  },
  pass: {
    objective: "Get into the Style Academy",
    place: "Style Academy",
    region: "academy",
    hints: [
      "The gate wants a pass, and only one person had one.",
      "Prakriti's Fashion Pass opens the Academy gate.",
      "With the Fashion Pass in hand, talk to the gatekeeper at the Style Academy.",
    ],
    chain: ["Temple of Echoes", "Style Academy", "Gatekeeper"],
  },
  boss: {
    objective: "Defeat Arshiya",
    place: "Style Academy",
    region: "academy",
    hints: [
      "She took the flame. She's waiting for you to say so.",
      "Arshiya has three phases and more HP than one fighter can chew through.",
      "Fight Arshiya at the Academy — swap between Palakshi and Mimo to survive all three phases.",
    ],
    chain: ["Style Academy", "Arshiya"],
  },
  finale: {
    objective: "Join the celebration",
    place: "Style Academy",
    region: "academy",
    hints: [
      "The flame is going home. So is everyone else.",
      "Listen to the people who came.",
      "The celebration plays out on its own — press E to continue.",
    ],
    chain: ["Style Academy"],
  },
  find_abhi: {
    objective: "Find Abhimanyu and Faizal",
    place: "The West Road",
    region: "f1205",
    hints: [
      "Abhimanyu went home. He said the boys would be waiting.",
      "West road out of Sparkle Town, past the river.",
      "Leave Sparkle Town by the west path, cross the bridge on the West Road, and enter the door of the flats.",
    ],
    chain: ["Sparkle Town", "The West Road", "F-1205"],
  },
  f1205: {
    objective: "Meet everyone at F-1205",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Five flatmates. One of them will not look up.",
      "Talk to Faizal, Garv, Hakim and Dev — they are all somewhere in the flat.",
      "Hakim is on the sofa, Garv by the table, Faizal in the kitchen, Dev by the weights. Talk to each of them.",
    ],
    chain: ["F-1205", "Faizal", "Garv", "Hakim", "Dev"],
  },
  evening: {
    objective: "Spend the evening with the flatmates",
    place: "F-1205",
    region: "f1205",
    hints: [
      "The day is done. Sit with them.",
      "Abhimanyu wants everyone together.",
      "Talk to Abhimanyu to start the evening.",
    ],
    chain: ["F-1205", "Abhimanyu"],
  },
  goodbye: {
    objective: "Say goodbye to Abhimanyu",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Everyone's said what they wanted to. Almost everyone.",
      "Abhimanyu is waiting near the door.",
      "Talk to Abhimanyu one last time.",
    ],
    chain: ["Abhimanyu"],
  },
};

export const SIDE_GUIDE: Record<string, Guide> = {
  accept: {
    objective: "Hear out Prakriti in the woods",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "Prakriti is in the woods, and she's lost something.",
      "She'll ask before she'll thank you.",
      "Talk to Prakriti in the Whispering Woods to take the ribbon request.",
    ],
    chain: ["Whispering Woods", "Prakriti"],
  },
  ribbon: {
    objective: "Find the teal ribbon",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "Teal silk against green leaves.",
      "It blew into the undergrowth on the far side of the woods.",
      "Search the marked spot in the north-east of the Whispering Woods.",
    ],
    chain: ["Whispering Woods", "Ribbon"],
  },
  return: {
    objective: "Return the ribbon to Prakriti",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "She'll pretend she isn't pleased.",
      "Prakriti hasn't moved.",
      "Talk to Prakriti again with the Lost Ribbon in your bag.",
    ],
    chain: ["Prakriti"],
  },
  h1: { objective: "Find the treasure at home", place: "Palakshi's Bedroom", region: "home",
        hints: ["Something of yours is behind something of yours.", "Your own room hides one.", "Search behind the bookshelf in your bedroom."], chain: ["Bedroom"] },
  h2: { objective: "Find the treasure in Sparkle Town", place: "Sparkle Town", region: "home",
        hints: ["Gold, small, easily dropped.", "Near the town's edge.", "Search the corner past the last house in Sparkle Town."], chain: ["Sparkle Town"] },
  h3: { objective: "Find the treasure in the woods", place: "Whispering Woods", region: "home",
        hints: ["The woods feed those who look.", "Berries grow where the light gets in.", "Search the clearing on the west side of the Whispering Woods."], chain: ["Whispering Woods"] },
  h4: { objective: "Find the treasure at the Academy", place: "Style Academy", region: "academy",
        hints: ["Even Arshiya drops things.", "Behind the Academy hedge.", "Search the far corner of the Style Academy grounds."], chain: ["Style Academy"] },
};

export function guideFor(stepId: string): Guide | null {
  return STEP_GUIDE[stepId] ?? SIDE_GUIDE[stepId] ?? null;
}
