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
      "Follow the main road east past the well; the kid is standing where the road leaves Sparkle Town.",
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
      "On Route 1 follow the lantern road; the red ball lies in the grass south-east, past the pond.",
    ],
    chain: ["Sparkle Town", "East road", "Route 1", "Red ball"],
  },
  clue_paws: {
    objective: "Follow the paw prints",
    place: "Route 1",
    region: "home",
    hints: [
      "Small prints lead away from where the ball fell.",
      "They head north along the lantern road, towards the treeline.",
      "Step on the paw-print tiles on Route 1, then take the north gate between the lanterns into the woods.",
    ],
    chain: ["Route 1", "Paw prints", "Whispering Woods"],
  },
  mimo: {
    objective: "Find Mimo in the Whispering Woods",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "Something is hiding in the woods, and it's frightened.",
      "A bush in the clearing at the heart of the woods keeps shaking.",
      "Follow the woodland path north to the lantern clearing, face the rustling bush and press E. He won't know you at first.",
    ],
    chain: ["Route 1", "Whispering Woods", "Lantern clearing", "Rustling bush"],
  },
  village: {
    objective: "Help Lantern Village and speak to Elder Shu",
    place: "Lantern Village",
    region: "village",
    hints: [
      "The festival was cancelled. Nobody in town knows why.",
      "The village north of the woods has the answer — and an Elder.",
      "Go north from the Whispering Woods to Lantern Village. Talk to the villagers around the plaza, then to Elder Shu in the middle of the plaza by the great lantern.",
    ],
    chain: ["Whispering Woods", "Lantern Village", "Plaza", "Elder Shu"],
  },
  scroll: {
    objective: "Recover the Lost Scroll from the bamboo shrine",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "The travelling musician on the west side of the village plaza knows what sound can break.",
      "Take the bamboo gate north of the village, cross the stream and follow the stone lanterns up the path to the standing wall.",
      "Learn Sound Barrier from the musician, then use it on the bamboo wall at the top of the lantern path; the scroll waits on the pedestal beyond.",
    ],
    chain: ["Musician", "Bamboo gate", "Lantern path", "Bamboo wall", "Lost Scroll"],
  },
  trial: {
    objective: "Pass the Bamboo Forest Trial",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "The shrine will not open for someone who hasn't earned it.",
      "Two statues and two plates, one pair on each side of the lantern path. Wake the statues, then stand the plates.",
      "Touch both statues in the Bamboo Forest, step on both plates, then defeat the Bamboo Sentinel waiting west of the lantern path.",
    ],
    chain: ["Bamboo Forest", "Statues", "Plates", "Bamboo Sentinel"],
  },
  prakriti: {
    objective: "Clear the blossom shrine, then settle things with Prakriti",
    place: "Cherry Blossom Garden",
    region: "garden",
    hints: [
      "Something with wings has nested at the garden's shrine. Prakriti won't duel with it screaming overhead.",
      "The moon gate on the east edge of the bamboo leads into the garden; the shrine is in the north-east corner by the brazier.",
      "Defeat the Blossom Warden at the north-east brazier, then duel Prakriti on the west bank of the pond. She fights in two phases.",
    ],
    chain: ["Moon gate", "Pond", "Blossom shrine", "Blossom Warden", "Prakriti"],
  },
  temple: {
    objective: "Climb the mountain and wake the Temple of Echoes",
    place: "Mountain Trail",
    region: "mountain",
    hints: [
      "The stone pass north of the garden climbs into the mountains. Follow the gravel trail and mind the Warden at its foot.",
      "Past the trail, the temple doors stand open. Four statues, four plates, and a Guardian who wants to see the last one.",
      "Touch the four statues, step on the four plates, then speak to the Temple Guardian and win.",
    ],
    chain: ["Stone pass", "Gravel trail", "Temple doors", "Courtyard", "Temple Guardian"],
  },
  flames: {
    objective: "Gather the three Sacred Flames",
    place: "Mountain, Garden and Cave",
    region: "mountain",
    hints: [
      "Stone, petals, echoes: the light was split in three.",
      "One brazier on the east ledge of the Mountain Trail, one at the garden's north-east shrine, one deep in the Ancient Cave past the mountain's east gate.",
      "The cave's brazier in the far east chamber is sealed: touch its two echo statues, hold its two plates, then take the flame. Mimo can sniff out what's hidden down there.",
    ],
    chain: ["Mountain ledge", "Blossom shrine", "East gate", "Cave chambers"],
  },
  lantern: {
    objective: "Restore the Sacred Lantern",
    place: "Temple of Echoes",
    region: "temple",
    hints: [
      "You carry all three flames. They belong together.",
      "The Sacred Lantern stands in the temple courtyard, just inside the doors.",
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
      "Take the south road out of Sparkle Town, walk the banner avenue, and show the Fashion Pass to the gatekeeper at the Academy wall.",
    ],
    chain: ["Sparkle Town", "South road", "Banner avenue", "Gatekeeper"],
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
      "Leave Sparkle Town by the west path, cross the bridge on the West Road, and enter the door of the flats at the end of the road.",
    ],
    chain: ["Sparkle Town", "The West Road", "F-1205"],
  },
  f1205: {
    objective: "Meet everyone at F-1205",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Five flatmates. One of them will not look up.",
      "Abhimanyu's room is at the end of the hall on the left. The others are around the flat.",
      "Abhimanyu in his room, Faizal in the kitchen, Hakim on the sofa, Garv and Dev in the room across the hall. Talk to each of them.",
    ],
    chain: ["Abhimanyu's room", "Kitchen", "Sofa", "Back room"],
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
      "She's sulking in the north-west corner of the woods. She'll ask before she'll thank you.",
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
      "It blew into the undergrowth in the far north-east of the woods.",
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
        hints: ["Gold, small, easily dropped.", "Near the town's edge.", "Search the south-west corner past the last house in Sparkle Town."], chain: ["Sparkle Town"] },
  h3: { objective: "Find the treasure in the woods", place: "Whispering Woods", region: "home",
        hints: ["The woods feed those who look.", "Berries grow where the light gets in.", "Search the clearing on the east side of the Whispering Woods."], chain: ["Whispering Woods"] },
  h4: { objective: "Find the treasure at the Academy", place: "Style Academy", region: "academy",
        hints: ["Even Arshiya drops things.", "Behind the Academy hall.", "Search the north-east corner of the Style Academy grounds, behind the hall."], chain: ["Style Academy"] },
};

export function guideFor(stepId: string): Guide | null {
  return STEP_GUIDE[stepId] ?? SIDE_GUIDE[stepId] ?? null;
}
