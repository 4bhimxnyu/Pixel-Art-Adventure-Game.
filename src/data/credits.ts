// ---------------------------------------------------------------------------
// The credits: everyone in the story, one picture each with a line underneath.
// A real photo dropped in as public/credits/<id>.jpg (or .jpeg / .png / .webp)
// replaces that person's drawn portrait; nothing else needs to change.
// ---------------------------------------------------------------------------

export type CreditEntry = {
  /** Photo file stem under public/credits/ and the drawn portrait id. */
  id: string;
  /** Portrait id when it differs from the photo stem. */
  portrait?: string;
  name: string;
  /** The line under the picture. */
  caption: string;
};

export const CREDIT_CAST: CreditEntry[] = [
  { id: "palakshi", name: "Palakshi", caption: "The Shaolin Baddie" },
  { id: "mimo", name: "Mimochi", caption: "Shih Tzu, unshakeable" },
  { id: "abhimanyu", name: "Abhimanyu", caption: "Denim jacket, white bass, waiting at F-1205" },
  { id: "bidisha", name: "Bidisha", caption: "Who waited up" },
  { id: "riddhi", name: "Riddhi", caption: "BHOSDE AZAAAAAD" },
  { id: "prakriti", name: "Prakriti", caption: "Rival and almost-friend" },
  { id: "shu", portrait: "elder", name: "Elder Shu", caption: "Keeper of Lantern Village" },
  { id: "kaajal", name: "Prof. Kaajal", caption: "Narrator" },
  { id: "arshiya", name: "Arshiya", caption: "Style Academy" },
  { id: "faizal", name: "Faizal", caption: "Who holds the door" },
  { id: "garv", name: "Garv", caption: "Who buys the rice" },
  { id: "hakim", name: "Hakim", caption: "Who is nearly finished" },
  { id: "dev", name: "Dev", caption: "Who visits the weights" },
];

export const CREDIT_TAIL: { head: string; lines: string[] }[] = [
  { head: "THE THREE SACRED FLAMES", lines: ["Stone, Petals, Echoes", "Returned to Lantern Village"] },
  { head: "", lines: ["Fifty-one years running."] },
];
