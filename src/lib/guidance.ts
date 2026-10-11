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
      "Walk to the door at the bottom of your room and step onto it. The gold trail on the floor leads there.",
      "The door is the gap in the south wall. Move with W A S D (or the left stick).",
      "Stand on the door tile and you go downstairs by yourself. Nothing to press.",
    ],
    chain: ["Bedroom", "Door", "Downstairs"],
  },
  mom: {
    objective: "Talk to Mum",
    place: "Palakshi's House",
    region: "home",
    hints: [
      "Mum (Bidisha) is in the main room downstairs. Follow the trail to her.",
      "Walk up to her so she is right in front of you; a gold ring appears under her feet.",
      "Face Bidisha and press E. She gives you a Super Potion.",
    ],
    chain: ["House", "Bidisha"],
  },
  abhi: {
    objective: "Find Abhimanyu in Sparkle Town",
    place: "Sparkle Town",
    region: "home",
    hints: [
      "Leave the house through the door at the bottom and find Abhimanyu, the boy with the white guitar.",
      "Outside, the gold beacon stands over him and the trail leads you there.",
      "Walk up to Abhimanyu and press E. He joins you.",
    ],
    chain: ["House", "Sparkle Town", "Abhimanyu"],
  },
  clue_npc: {
    objective: "Ask the witness in Sparkle Town",
    place: "Sparkle Town",
    region: "home",
    hints: [
      "A kid in town saw Mimo run past. Follow the trail east along the main road to him.",
      "He stands where the road leaves Sparkle Town on the east side, past the well.",
      "Face the kid and press E. He tells you which way Mimo went.",
    ],
    chain: ["Sparkle Town", "East road", "Kid witness"],
  },
  clue_toy: {
    objective: "Find Mimo's toy on Route 1",
    place: "Route 1",
    region: "home",
    hints: [
      "Leave Sparkle Town by the east road onto Route 1 and find Mimo's red ball.",
      "On Route 1 follow the lantern road; the ball lies in the grass to the south-east, past the pond.",
      "Walk onto the sparkling red ball. Tall grass can start a fight: choose FIGHT, then the top move.",
    ],
    chain: ["Sparkle Town", "East road", "Route 1", "Red ball"],
  },
  clue_paws: {
    objective: "Follow the paw prints",
    place: "Route 1",
    region: "home",
    hints: [
      "Small paw prints lead away from where the ball was. Walk onto them and follow them north.",
      "They run north along the lantern road toward the trees.",
      "Step on the paw-print tiles, then walk through the gate between the two lanterns into the woods.",
    ],
    chain: ["Route 1", "Paw prints", "North gate", "Whispering Woods"],
  },
  mimo: {
    objective: "Find Mimo in the Whispering Woods",
    place: "Whispering Woods",
    region: "home",
    hints: [
      "Follow the woodland path north to the clearing with lanterns. Mimo is hiding in a bush there.",
      "The bush in the middle of the clearing keeps shaking. Walk up to it.",
      "Face the shaking bush and press E. He will not know you at first; win the little fight and he comes with you.",
    ],
    chain: ["Whispering Woods", "Lantern clearing", "Shaking bush"],
  },
  village: {
    objective: "Help Lantern Village and speak to Elder Shu",
    place: "Lantern Village",
    region: "village",
    hints: [
      "Go north out of the woods to Lantern Village and talk to Elder Shu by the great lantern in the plaza.",
      "The villagers around the plaza each have something to say; the Elder is in the middle.",
      "Face Elder Shu and press E. He tells you about the Lost Scroll.",
    ],
    chain: ["Whispering Woods", "Lantern Village", "Plaza", "Elder Shu"],
  },
  scroll: {
    objective: "Recover the Lost Scroll from the bamboo shrine",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "Talk to the musician on the west side of the plaza to learn Sound Barrier, then take the bamboo gate north of the village.",
      "In the Bamboo Forest cross the stream and follow the stone lanterns up to the bamboo wall.",
      "Face the bamboo wall and press E to break it with Sound Barrier. The scroll is on the pedestal just behind it; walk onto it.",
    ],
    chain: ["Musician", "Bamboo gate", "Lantern path", "Bamboo wall", "Lost Scroll"],
  },
  trial: {
    objective: "Pass the Bamboo Forest Trial",
    place: "Bamboo Forest",
    region: "bamboo",
    hints: [
      "Touch the two statues in the Bamboo Forest (press E at each), then stand on the two stone plates.",
      "One statue and one plate on each side of the lantern path. The trail takes you to the next one.",
      "When both plates are lit, the Bamboo Sentinel appears west of the lantern path. Talk to it and win the fight.",
    ],
    chain: ["Bamboo Forest", "Statues", "Plates", "Bamboo Sentinel"],
  },
  prakriti: {
    objective: "Clear the blossom shrine, then settle things with Prakriti",
    place: "Cherry Blossom Garden",
    region: "garden",
    hints: [
      "Take the moon gate on the east edge of the bamboo into the Cherry Blossom Garden. Clear the shrine in the north-east corner first.",
      "The Blossom Warden waits at the brazier in the north-east; press E on it to fight.",
      "After the Warden, Prakriti stands on the west bank of the pond. Press E to duel her. Use ITEM for a potion when low; she has two phases.",
    ],
    chain: ["Moon gate", "Pond", "Blossom shrine", "Blossom Warden", "Prakriti"],
  },
  temple: {
    objective: "Climb the mountain and wake the Temple of Echoes",
    place: "Mountain Trail",
    region: "mountain",
    hints: [
      "Take the stone pass north of the garden up the Mountain Trail to the Temple of Echoes.",
      "The Warden at the foot of the trail must be beaten first. Inside the temple: four statues, four plates.",
      "Press E at each statue, stand on each plate, then talk to the Temple Guardian and win.",
    ],
    chain: ["Stone pass", "Mountain Trail", "Temple doors", "Courtyard", "Temple Guardian"],
  },
  flames: {
    objective: "Gather the three Sacred Flames",
    place: "Mountain, Garden and Cave",
    region: "mountain",
    hints: [
      "Collect the three Sacred Flames: a brazier on the mountain ledge, one at the garden shrine, one deep in the Ancient Cave.",
      "The beacon and trail always lead to the nearest flame you still need. The cave is past the mountain's east gate.",
      "In the cave: press E at its two echo statues, stand on its two plates, then press E at the brazier. Press F to let Mimo sniff out hidden things.",
    ],
    chain: ["Mountain ledge", "Blossom shrine", "East gate", "Ancient Cave"],
  },
  lantern: {
    objective: "Restore the Sacred Lantern",
    place: "Temple of Echoes",
    region: "temple",
    hints: [
      "Carry the three flames back to the Temple of Echoes. The trail leads the way.",
      "The Sacred Lantern stands in the courtyard just inside the temple doors.",
      "Face the Sacred Lantern and press E.",
    ],
    chain: ["Ancient Cave", "Temple of Echoes", "Sacred Lantern"],
  },
  pass: {
    objective: "Get into the Style Academy",
    place: "Style Academy",
    region: "academy",
    hints: [
      "Go back to Sparkle Town and take the south road to the Style Academy.",
      "Walk the banner avenue to the Academy wall. The gatekeeper stands at the gate.",
      "Face the gatekeeper and press E. Prakriti's Fashion Pass lets you in.",
    ],
    chain: ["Sparkle Town", "South road", "Banner avenue", "Gatekeeper"],
  },
  boss: {
    objective: "Defeat Arshiya",
    place: "Style Academy",
    region: "academy",
    hints: [
      "Find Arshiya inside the Academy and talk to her. This is the big fight.",
      "She has three phases. When she starts reading your fighter, choose SWAP to bring the other one in front.",
      "Attack with your strongest move, heal with ITEM under half health, and swap between Palakshi and Mimo when her hits grow.",
    ],
    chain: ["Style Academy", "Arshiya"],
  },
  finale: {
    objective: "Join the celebration",
    place: "Style Academy",
    region: "academy",
    hints: [
      "Watch the celebration. Press E to continue each line.",
      "Everyone you met has come.",
      "When the party ends, the trail shows you the way to the West Road.",
    ],
    chain: ["Style Academy"],
  },
  find_abhi: {
    objective: "Find Abhimanyu and Faizal",
    place: "The West Road",
    region: "f1205",
    hints: [
      "Leave Sparkle Town by the west path and follow the West Road to the flats.",
      "Cross the bridge; the road ends at a door with a light on. That is F-1205.",
      "Walk through the door at the end of the West Road. Faizal lets you in.",
    ],
    chain: ["Sparkle Town", "West path", "Bridge", "F-1205"],
  },
  f1205: {
    objective: "Meet everyone at F-1205",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Walk down the hall. Talk to Faizal and Hakim in the first room, then Garv and Dev in the last room.",
      "Abhimanyu's door, the middle one, stays locked until all four are met. The trail goes to whoever is next.",
      "Face each flatmate and press E. When all four are met the middle door opens: go in and talk to Abhimanyu.",
    ],
    chain: ["Hall", "First room", "Last room", "Abhimanyu's room"],
  },
  evening: {
    objective: "Spend the evening with the flatmates",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Find Abhimanyu and talk to him. He wants everyone together.",
      "He is wherever the beacon stands; the trail leads there.",
      "Face Abhimanyu and press E to start the evening.",
    ],
    chain: ["F-1205", "Abhimanyu"],
  },
  smoke: {
    objective: "Join everyone on the balcony",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Go through Abhimanyu's room to the balcony. Riddhi is out there, and she is loud.",
      "The balcony door is at the back of the middle room. Everyone is lined up along the railing.",
      "Face Riddhi on the balcony and press E.",
    ],
    chain: ["Abhimanyu's room", "Balcony door", "Riddhi"],
  },
  goodbye: {
    objective: "Say goodbye to Abhimanyu",
    place: "F-1205",
    region: "f1205",
    hints: [
      "Go back inside and talk to Abhimanyu near the front door.",
      "He is standing in the hall by the door.",
      "Face Abhimanyu and press E. This is the end.",
    ],
    chain: ["Hall", "Front door", "Abhimanyu"],
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
