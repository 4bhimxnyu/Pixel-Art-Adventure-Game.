// ---------------------------------------------------------------------------
// The credits: real photographs, each with a title and a few lines written for
// it. The pictures live in src/assets/credits/ (copied from the untracked
// "ending credit pictures/" folder); `file` is the picture's file name without
// its extension, `title` is the line in gold, `text` the words next to it.
// The order below is the order of the roll. Pictures alternate sides: the
// first sits on the left with its words on the right, the next on the right
// with its words on the left, and so on. The words are kept exactly as
// written in ending credit pictures/descriptiom.txt.
// ---------------------------------------------------------------------------

const FILES = import.meta.glob("../assets/credits/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** file name (no extension) -> url */
const URL_BY_NAME: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  const base = decodeURIComponent(path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
  URL_BY_NAME[base] = url;
}

export type CreditEntry = { file: string; title: string; text: string };

export const CREDIT_ENTRIES: CreditEntry[] = [
  {
    file: "first visit at my place",
    title: "first visit at my place as somebody",
    text: "i loved how we ate all the mcflurry. maybe it was romantic we were just not able to see it.",
  },
  {
    file: "missed my home",
    title: "missed my home",
    text: "time i really started adoring your presence in my life, loverboy yearned for you.",
  },
  {
    file: "first day with you",
    title: "first day with you",
    text: "i came to see you at college and we went to aruneet's place, that was so random but loved how it made me belong to you. ofcourse the time you got injured, it felt like something happened to me. i miss taking care of my baby like that.",
  },
  {
    file: "when we went to dc for the first time",
    title: "when we went to dc for the first time together",
    text: "aah that day. received my first flower in my life, forever grateful to you, for how well you kept me.",
  },
  {
    file: "my first concert you attended",
    title: "my first concert",
    text: "i remember how you tore the line was late for hostel, still stayed, forever grateful to you for supporting me so much with everything.",
  },
  {
    file: "first time you stayed",
    title: "first time you stayed",
    text: "i am no one to decide if that was a downhill or a good thing, i loved staying next to you. like a puppy. i will miss it alot.",
  },
  {
    file: "my favourite picture of us",
    title: "my favourite picture of us",
    text: "happy valentine's my lady love.",
  },
  {
    file: "our date to see your mom",
    title: "our date to see your mom",
    text: "i remember us getting so nervous to meet khushima. i will always remember that as very special part of my life.",
  },
  {
    file: "your favourite chimu",
    title: "your favo chimu",
    text: "i miss my lucy, i miss petting her with you. i will miss you so much.",
  },
  {
    file: "the time we went to get plants",
    title: "tht time we went to get plants",
    text: "and got none, lol.",
  },
  {
    file: "we went to poptates for the first time",
    title: "we went to poptates first time",
    text: "love that day still. was with my family. everybody, i really miss how things were better back then.",
  },
  {
    file: "your horse shoot.",
    title: "your horse shoot",
    text: "oh i abso love this day, so much to remember.",
  },
  {
    file: "almost over",
    title: "almost over",
    text: "i am sorry for everything, i get carried away by my own desperation of your love.",
  },
  {
    file: "world cup final i was so sad about it",
    title: "world cup final.",
    text: "thanks for watching that with me.",
  },
  {
    file: "you hated me so much in this",
    title: "you hated me so much",
    text: "i guess.",
  },
  {
    file: "most recently",
    title: "most recently",
    text: "",
  },
  {
    file: "our last picture together",
    title: "our last picture",
    text: "voila, we are over with the show, happy birthday my baby for now and ever. please take of yourself, don't be somebody you won't be proud of.",
  },
];

export type CreditPhoto = CreditEntry & { src: string };

/** The entries whose picture exists, in roll order. A missing picture is reported once and skipped. */
export const CREDIT_PHOTOS: CreditPhoto[] = CREDIT_ENTRIES.flatMap((e) => {
  const src = URL_BY_NAME[e.file];
  if (!src) {
    console.warn(`credits: no picture named "${e.file}" in src/assets/credits/`);
    return [];
  }
  return [{ ...e, src }];
});

export const CREDIT_TAIL: { head: string; lines: string[] }[] = [
  { head: "THE THREE SACRED FLAMES", lines: ["Stone, Petals, Echoes", "Returned to Lantern Village"] },
  { head: "", lines: ["Fifty-one years running."] },
];
