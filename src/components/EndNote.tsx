// ---------------------------------------------------------------------------
// A handwritten note, shown right after the final hug fades out, before the credits.
// The text lives in data/endNote.ts. Lines appear one by one; any key, click,
// tap or gamepad button (which arrives as a synthetic key) moves on once the
// whole note is visible, or reveals it all at once if it is still appearing.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { END_NOTE } from "../data/endNote";

export default function EndNote() {
  const setScreen = useGameStore((s) => s.setScreen);
  const total = END_NOTE.lines.length + 2; // + greeting + sign-off
  const [shown, setShown] = useState(0);
  const [paper, setPaper] = useState(false);
  // A handwritten note dropped in as public/note.jpg (or .png) replaces the typed text.
  const [image, setImage] = useState<string | null>(null);
  const [probed, setProbed] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const f of ["note.jpg", "note.jpeg", "note.png", "note.webp"]) {
        try {
          const r = await fetch(f, { method: "HEAD" });
          if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) { if (alive) setImage(f); break; }
        } catch { /* keep looking */ }
      }
      if (alive) setProbed(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t0 = window.setTimeout(() => setPaper(true), 300);
    const timers: number[] = [];
    for (let i = 1; i <= total; i++) timers.push(window.setTimeout(() => setShown(i), 1400 + i * 2600));
    return () => {
      window.clearTimeout(t0);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [total]);

  const advance = () => {
    if (image) { setScreen("credits"); return; }
    if (shown < total) setShown(total);
    else setScreen("credits");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Enter", " ", "Escape", "e", "E"].includes(e.key)) advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const line = (text: string, idx: number, cls = "") => (
    <p
      key={idx}
      className={`transition-all duration-[1400ms] ${cls}`}
      style={{ opacity: shown > idx ? 1 : 0, transform: shown > idx ? "translateY(0)" : "translateY(6px)", minHeight: text ? undefined : "0.9em" }}
    >
      {text}
    </p>
  );

  if (!probed) return <div className="h-full w-full bg-[#000]" />;
  if (image) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-[#000]" onClick={() => setScreen("credits")}>
        <img
          src={image}
          alt="A handwritten note"
          className="max-h-[92vh] max-w-[94vw] rounded-[4px] object-contain transition-all duration-[1800ms]"
          style={{ opacity: paper ? 1 : 0, transform: paper ? "translateY(0) rotate(-0.4deg)" : "translateY(18px) rotate(-0.4deg)", boxShadow: "0 30px 80px rgba(0,0,0,.65)" }}
        />
        <div className="absolute bottom-1.5 text-[10px] uppercase tracking-[.3em] text-[#f2dfa6]" style={{ opacity: paper ? 0.5 : 0 }}>press any key</div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#000]" onClick={advance}>
      <div
        className="mx-4 w-full max-w-[640px] rounded-[6px] px-8 py-10 transition-all duration-[1800ms] sm:px-14 sm:py-14"
        style={{
          opacity: paper ? 1 : 0,
          transform: paper ? "translateY(0) rotate(-0.4deg)" : "translateY(18px) rotate(-0.4deg)",
          background: "linear-gradient(175deg,#f7efdf 0%,#efe3cb 100%)",
          boxShadow: "0 30px 80px rgba(0,0,0,.65), inset 0 0 60px rgba(120,90,40,.12)",
          color: "#3a2a1c",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: "17px",
          lineHeight: 1.7,
        }}
      >
        <div className="mb-5 h-px w-24" style={{ background: "linear-gradient(90deg,rgba(120,90,40,.5),transparent)" }} />
        {line(END_NOTE.to, 0, "mb-4 text-[20px] italic")}
        <div className="flex flex-col gap-3">
          {END_NOTE.lines.map((t, i) => line(t, i + 1))}
        </div>
        <div className="mt-6 whitespace-pre-line text-right italic">{line(END_NOTE.from, total - 1)}</div>
        <div
          className="mt-8 text-center text-[11px] uppercase tracking-[.3em] transition-opacity duration-1000"
          style={{ opacity: shown >= total ? 0.55 : 0 }}
        >
          press any key
        </div>
      </div>
    </div>
  );
}
