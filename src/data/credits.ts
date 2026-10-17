// ---------------------------------------------------------------------------
// The credits: a roll of real photographs, each with one line underneath.
// The pictures live in src/assets/credits/ and the FILE NAME IS THE CAPTION:
//     "first day with you.jpeg"      ->  "first day with you"
//     "03 missed my home.jpeg"       ->  "missed my home", third in the roll
// An optional leading number sets the order; without one, files roll in name
// order. Drop a picture in, build, done. Nothing else needs to change.
// ---------------------------------------------------------------------------

const FILES = import.meta.glob("../assets/credits/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export type CreditPhoto = {
  /** The file name without its extension (stable key). */
  key: string;
  /** Resolved URL of the picture. */
  src: string;
  /** The line under the picture. */
  caption: string;
  order: number;
};

export const CREDIT_PHOTOS: CreditPhoto[] = Object.entries(FILES)
  .map(([path, src]) => {
    const base = decodeURIComponent(path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const m = base.match(/^(\d+)[\s._-]*(.*)$/);
    const raw = (m ? m[2] : base).trim();
    const caption = /^whatsapp image/i.test(raw) ? "" : raw; // an unrenamed file is a picture without a line
    return { key: base, src, caption, order: m ? Number(m[1]) : Number.MAX_SAFE_INTEGER };
  })
  .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

export const CREDIT_TAIL: { head: string; lines: string[] }[] = [
  { head: "THE THREE SACRED FLAMES", lines: ["Stone, Petals, Echoes", "Returned to Lantern Village"] },
  { head: "", lines: ["Fifty-one years running."] },
];
