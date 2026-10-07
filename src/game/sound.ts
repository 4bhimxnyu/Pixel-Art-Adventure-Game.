// ---------------------------------------------------------------------------
// Procedural score. No audio files.
//
// Musical direction (per the brief): SADENESS AS THE BASE, WUXIA COLOUR ON TOP.
//
//   Base layer (every track, always):   deep sub bass on the downbeat, a slow
//     half-time breakbeat, a Gregorian-style chant pad through vowel formant
//     filters, and a breathy shakuhachi answer — the Enigma "Sadeness" bed,
//     built at ~110bpm-relative half time in a minor/yu mode.
//
//   Colour layer (per map):             guzheng, pipa, yangqin, erhu, dizi,
//     xiao, sheng plus dagu / luo / bangzi / muyu percussion, written in Chinese
//     pentatonic modes so each region still reads as its own place.
//
// SCHEDULING INVARIANT: every scheduled time is clamped to
//   Math.max(at, ctx.currentTime + 0.25)
// Grace / gliss ornaments schedule up to 0.18s early and used to produce
// negative setValueAtTime times at startup. Do not remove `at()`.
// ---------------------------------------------------------------------------

type Mode = "gong" | "shang" | "jue" | "zhi" | "yu" | "aeolian";

const MODES: Record<Mode, number[]> = {
  gong:    [0, 2, 4, 7, 9],
  shang:   [0, 2, 5, 7, 10],
  jue:     [0, 3, 5, 8, 10],
  zhi:     [0, 2, 5, 7, 9],
  yu:      [0, 3, 5, 7, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

export type Ornament = "grace" | "gliss" | "trem" | "bend";
export type Note = { d: number | null; l: number; o?: Ornament };

type Inst = "guzheng" | "pipa" | "yangqin" | "erhu" | "dizi" | "xiao" | "sheng" | "shakuhachi" | "chant";

export type Track = {
  root: number;          // midi note of degree 1
  mode: Mode;
  bpm: number;
  beats: number;         // beats per bar
  lead: Inst;
  counter?: Inst;
  pad?: Inst;
  phrases: Note[][];     // one entry per bar, cycled
  perc?: { dagu?: string; luo?: string; bangzi?: string; muyu?: string };
  /** Sadeness bed intensity 0..1 — 0 keeps only sub + chant, 1 is full breakbeat. */
  sad?: number;
  /** Chant root movement per bar, as scale degrees. */
  chant?: number[];
  wind?: boolean;
  birds?: boolean;
  cave?: boolean;
  gain?: number;
};

// --------------------------------------------------------------------------- context

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, verbSend: GainNode;
let noiseBuf: AudioBuffer | null = null;
let musicVol = 0.7;
let sfxVol = 0.8;

/**
 * Optional user-supplied music. `public/audio/manifest.json` maps track keys
 * (bgm_title, bgm_town, ...) to files in `public/audio/`. Anything listed there
 * plays instead of the procedural track of the same name; anything absent falls
 * back to synthesis, so the game ships and runs with no audio files at all.
 */
let fileManifest: Record<string, string> = {};
let manifestLoaded = false;
type FileTrack = { key: string; el: HTMLAudioElement; gain: GainNode; src: MediaElementAudioSourceNode };
let currentFile: FileTrack | null = null;
const fileNodes = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

/** Clamp: never schedule in the past. See invariant note above. */
function at(t: number) {
  return Math.max(t, (ctx?.currentTime ?? 0) + 0.25);
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  musicBus = ctx.createGain();
  musicBus.gain.value = musicVol;
  musicBus.connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVol;
  sfxBus.connect(master);

  // Generated plate-ish reverb — the space is most of the Sadeness character.
  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse(ctx, 3.1, 2.4);
  verbSend = ctx.createGain();
  verbSend.gain.value = 0.42;
  verbSend.connect(verb);
  verb.connect(master);

  const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = n.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  noiseBuf = n;

  return ctx;
}

function makeImpulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function setVolumes(music: number, sfxV: number) {
  musicVol = music;
  sfxVol = sfxV;
  applyMusicGain();
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(sfxV, ctx.currentTime, 0.05);
}

function applyMusicGain() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.08);
}

/** Load the optional custom-audio manifest. Safe to call repeatedly. */
export async function loadAudioManifest() {
  if (manifestLoaded) return fileManifest;
  manifestLoaded = true;
  try {
    const res = await fetch("audio/manifest.json", { cache: "no-cache" });
    if (!res.ok) return fileManifest;
    const json = await res.json();
    if (json && typeof json === "object") {
      fileManifest = Object.fromEntries(
        Object.entries(json as Record<string, unknown>)
          .filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v)
          .map(([k, v]) => [k, String(v)])
      );
    }
  } catch {
    // No manifest, malformed JSON, or offline — procedural score covers it.
  }
  return fileManifest;
}

export function hasCustomTrack(key: string) {
  return !!fileManifest[key];
}

function stopFileTrack(sec: number) {
  const old = currentFile;
  if (!old || !ctx) return;
  currentFile = null;
  const now = ctx.currentTime;
  try {
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, sec));
  } catch {
    /* noop */
  }
  window.setTimeout(() => {
    try {
      old.el.pause();
      old.el.currentTime = 0;
      old.gain.disconnect();
    } catch {
      /* noop */
    }
  }, sec * 1000 + 250);
}

/**
 * Play a user-supplied file through the same music bus as the synth, so the
 * volume slider and crossfades behave identically.
 */
function playFileTrack(key: string, file: string, fadeSec: number) {
  if (!ctx) return false;
  try {
    const url = `audio/${file}`;
    const el = new Audio(url);
    el.loop = true;
    el.crossOrigin = "anonymous";
    el.preload = "auto";

    // An <audio> element can only be wired into WebAudio once.
    let src = fileNodes.get(el);
    if (!src) {
      src = ctx.createMediaElementSource(el);
      fileNodes.set(el, src);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + Math.max(0.05, fadeSec));
    src.connect(gain);
    gain.connect(musicBus);

    // A missing or undecodable file must not mean silence — drop back to the
    // procedural track for this cue rather than leaving the player with nothing.
    el.addEventListener("error", () => {
      if (currentFile?.el !== el) return;
      console.warn(`[sound] could not load audio/${file} — falling back to the procedural track`);
      currentFile = null;
      try {
        gain.disconnect();
      } catch {
        /* noop */
      }
      startProceduralTrack(key, 0.4);
    });

    el.play().catch(() => {
      // Autoplay blocked until the first gesture; the title screen arms audio.
    });
    currentFile = { key, el, gain, src };
    return true;
  } catch (err) {
    console.warn(`[sound] custom track "${file}" failed, using the procedural score`, err);
    return false;
  }
}

function noise(): AudioBufferSourceNode {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf!;
  s.loop = true;
  return s;
}

function mtof(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Scale degree -> midi. Degrees wrap into octaves so `d: 8` is degree 1 up an octave. */
function degToMidi(t: Track, d: number) {
  const sc = MODES[t.mode];
  const n = sc.length;
  const i = ((((d - 1) % n) + n) % n);
  const oct = Math.floor((d - 1) / n);
  return t.root + sc[i] + 12 * oct;
}

// --------------------------------------------------------------------------- instruments

type Voice = { out: GainNode };

function voice(dest: AudioNode, sendAmt = 0.35): Voice {
  const g = ctx!.createGain();
  g.gain.value = 0;
  g.connect(dest);
  const send = ctx!.createGain();
  send.gain.value = sendAmt;
  g.connect(send);
  send.connect(verbSend);
  return { out: g };
}

/** Plucked strings: guzheng (round, long), pipa (nasal, fast), yangqin (double-struck). */
function playPluck(inst: "guzheng" | "pipa" | "yangqin", f: number, t: number, dur: number, vol: number, dest: AudioNode, orn?: Ornament) {
  const c = ctx!;
  const start = at(t);
  const v = voice(dest, inst === "guzheng" ? 0.5 : 0.3);

  const strikes = inst === "yangqin" ? [0, 0.045] : [0];
  if (orn === "trem") for (let i = 1; i < 6; i++) strikes.push(i * (dur / 6));

  for (const off of strikes) {
    const o = c.createOscillator();
    o.type = inst === "pipa" ? "sawtooth" : "triangle";
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = inst === "pipa" ? 3400 : 2200;
    lp.Q.value = inst === "pipa" ? 6 : 1.2;

    const eg = c.createGain();
    const s = at(start + off);
    const decay = inst === "guzheng" ? Math.min(dur * 1.6, 2.2) : inst === "pipa" ? 0.42 : 0.5;

    o.frequency.setValueAtTime(f, s);
    if (orn === "gliss") {
      o.frequency.setValueAtTime(f * 0.72, s);
      o.frequency.exponentialRampToValueAtTime(f, s + Math.min(0.16, dur * 0.5));
    }

    eg.gain.setValueAtTime(0.0001, s);
    eg.gain.exponentialRampToValueAtTime(vol * (off ? 0.5 : 1), s + 0.006);
    eg.gain.exponentialRampToValueAtTime(0.0001, s + decay);

    o.connect(lp);
    lp.connect(eg);
    eg.connect(v.out);
    o.start(s);
    o.stop(s + decay + 0.05);
  }
  v.out.gain.setValueAtTime(1, start);
}

/** Bowed erhu: portamento into the note plus vibrato. */
function playErhu(f: number, t: number, dur: number, vol: number, dest: AudioNode, orn?: Ornament) {
  const c = ctx!;
  const s = at(t);
  const v = voice(dest, 0.5);
  const o = c.createOscillator();
  o.type = "sawtooth";
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  lp.Q.value = 3;

  const from = orn === "bend" ? f * 0.88 : f * 0.97;
  o.frequency.setValueAtTime(from, s);
  o.frequency.linearRampToValueAtTime(f, s + Math.min(0.14, dur * 0.4));

  const lfo = c.createOscillator();
  lfo.frequency.value = 5.2;
  const lg = c.createGain();
  lg.gain.value = f * 0.012;
  lfo.connect(lg);
  lg.connect(o.frequency);

  const eg = c.createGain();
  eg.gain.setValueAtTime(0.0001, s);
  eg.gain.exponentialRampToValueAtTime(vol, s + 0.09);
  eg.gain.setValueAtTime(vol, s + dur * 0.75);
  eg.gain.exponentialRampToValueAtTime(0.0001, s + dur);

  o.connect(lp); lp.connect(eg); eg.connect(v.out);
  v.out.gain.setValueAtTime(1, s);
  o.start(s); lfo.start(s);
  o.stop(s + dur + 0.1); lfo.stop(s + dur + 0.1);
}

/** Air-column flutes: dizi (bright, dimo buzz), xiao (breathy), shakuhachi (Sadeness lead). */
function playFlute(inst: "dizi" | "xiao" | "shakuhachi", f: number, t: number, dur: number, vol: number, dest: AudioNode, orn?: Ornament) {
  const c = ctx!;
  const s = at(t);
  const v = voice(dest, inst === "shakuhachi" ? 0.62 : 0.4);

  const o = c.createOscillator();
  o.type = inst === "dizi" ? "sawtooth" : "sine";
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = inst === "dizi" ? 3000 : 1700;

  o.frequency.setValueAtTime(orn === "gliss" || inst === "shakuhachi" ? f * 0.94 : f, s);
  o.frequency.linearRampToValueAtTime(f, s + (inst === "shakuhachi" ? 0.18 : 0.06));

  const lfo = c.createOscillator();
  lfo.frequency.value = 4.6;
  const lg = c.createGain();
  lg.gain.value = f * 0.008;
  lfo.connect(lg); lg.connect(o.frequency);

  const eg = c.createGain();
  const atk = inst === "shakuhachi" ? 0.13 : 0.05;
  eg.gain.setValueAtTime(0.0001, s);
  eg.gain.exponentialRampToValueAtTime(vol, s + atk);
  eg.gain.setValueAtTime(vol, s + Math.max(atk, dur * 0.7));
  eg.gain.exponentialRampToValueAtTime(0.0001, s + dur);

  // breath noise — most of the shakuhachi identity
  const br = noise();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f * 2.1;
  bp.Q.value = 1.1;
  const bg = c.createGain();
  const breath = inst === "shakuhachi" ? 0.5 : inst === "xiao" ? 0.34 : 0.18;
  bg.gain.setValueAtTime(0.0001, s);
  bg.gain.exponentialRampToValueAtTime(vol * breath, s + 0.05);
  bg.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  br.connect(bp); bp.connect(bg); bg.connect(v.out);

  o.connect(lp); lp.connect(eg); eg.connect(v.out);
  v.out.gain.setValueAtTime(1, s);
  o.start(s); lfo.start(s); br.start(s);
  o.stop(s + dur + 0.1); lfo.stop(s + dur + 0.1); br.stop(s + dur + 0.1);
}

/** Sheng: stacked fifths pad. */
function playSheng(f: number, t: number, dur: number, vol: number, dest: AudioNode) {
  const c = ctx!;
  const s = at(t);
  const v = voice(dest, 0.55);
  [1, 1.5, 2].forEach((mult, i) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime((vol * 0.55) / (i + 1), s + 0.5);
    g.gain.setValueAtTime((vol * 0.55) / (i + 1), s + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(v.out);
    o.start(s); o.stop(s + dur + 0.15);
  });
  v.out.gain.setValueAtTime(1, s);
}

/**
 * Gregorian chant pad — the Sadeness signature. Three detuned saws through
 * vowel formant band-passes, very slow attack, drenched in the plate.
 */
function playChant(f: number, t: number, dur: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  const v = voice(musicBus, 0.85);

  // "ah" / "eh" formants, an octave-doubled male choir
  const formants = [
    [640, 4.5, 1.0],
    [1180, 6.0, 0.6],
    [2500, 8.0, 0.22],
  ];
  const sum = c.createGain();
  sum.gain.value = 1;

  [-7, -0.5, 0, 0.5, 7].forEach((detune, i) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f * (i === 0 ? 0.5 : 1);
    o.detune.value = detune * 6;
    const g = c.createGain();
    g.gain.value = i === 0 ? 0.5 : 0.3;
    o.connect(g); g.connect(sum);
    o.start(s); o.stop(s + dur + 0.6);
  });

  const eg = c.createGain();
  eg.gain.setValueAtTime(0.0001, s);
  eg.gain.exponentialRampToValueAtTime(vol, s + dur * 0.35);
  eg.gain.setValueAtTime(vol, s + dur * 0.72);
  eg.gain.exponentialRampToValueAtTime(0.0001, s + dur);

  for (const [freq, q, amp] of formants) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = amp;
    sum.connect(bp); bp.connect(g); g.connect(eg);
  }
  eg.connect(v.out);
  v.out.gain.setValueAtTime(1, s);
}

// --------------------------------------------------------------------------- percussion

function playKick(t: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(130, s);
  o.frequency.exponentialRampToValueAtTime(42, s + 0.11);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.34);
  o.connect(g); g.connect(musicBus);
  o.start(s); o.stop(s + 0.4);
}

function playSnare(t: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  const n = noise();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
  const send = c.createGain();
  send.gain.value = 0.5;
  n.connect(bp); bp.connect(g); g.connect(musicBus); g.connect(send); send.connect(verbSend);
  n.start(s); n.stop(s + 0.25);
}

function playHat(t: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  const n = noise();
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 8200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.055);
  n.connect(hp); hp.connect(g); g.connect(musicBus);
  n.start(s); n.stop(s + 0.08);
}

function playSub(f: number, t: number, dur: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = f;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 180;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.03);
  g.gain.setValueAtTime(vol, s + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(lp); lp.connect(g); g.connect(musicBus);
  o.start(s); o.stop(s + dur + 0.05);
}

/** dagu big drum / luo gong / bangzi woodblock / muyu wooden fish. */
function playPerc(kind: "dagu" | "luo" | "bangzi" | "muyu", t: number, vol: number) {
  const c = ctx!;
  const s = at(t);
  if (kind === "dagu") {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, s);
    o.frequency.exponentialRampToValueAtTime(62, s + 0.16);
    const n = noise();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 700;
    const ng = c.createGain();
    ng.gain.setValueAtTime(vol * 0.5, s);
    ng.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.42);
    o.connect(g); g.connect(musicBus);
    n.connect(lp); lp.connect(ng); ng.connect(musicBus);
    o.start(s); o.stop(s + 0.5); n.start(s); n.stop(s + 0.2);
    return;
  }
  if (kind === "luo") {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 2.4);
    [1, 1.41, 1.93, 2.71, 3.37].forEach((m, i) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(210 * m, s);
      o.frequency.linearRampToValueAtTime(210 * m * 0.94, s + 1.6);
      const og = c.createGain();
      og.gain.value = 0.4 / (i + 1);
      o.connect(og); og.connect(g);
      o.start(s); o.stop(s + 2.5);
    });
    const send = c.createGain(); send.gain.value = 0.7;
    g.connect(musicBus); g.connect(send); send.connect(verbSend);
    return;
  }
  // bangzi / muyu — dry wood
  const n = noise();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = kind === "bangzi" ? 2400 : 1150;
  bp.Q.value = 14;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
  n.connect(bp); bp.connect(g); g.connect(musicBus);
  n.start(s); n.stop(s + 0.12);
}

export function gong() {
  initAudio();
  playPerc("luo", ctx!.currentTime, 0.55);
}

// --------------------------------------------------------------------------- tracks
//
// Every track shares the Sadeness bed (sub + half-time break + chant). `sad`
// scales the drums, `chant` moves the choir, and lead/counter/pad carry the
// Chinese instrumentation that makes each region its own place.

const P = (...n: Note[]) => n;
const r = (l: number): Note => ({ d: null, l });
const n = (d: number, l: number, o?: Ornament): Note => ({ d, l, o });

export const TRACKS: Record<string, Track> = {
  bgm_title: {
    root: 50, mode: "yu", bpm: 108, beats: 8, lead: "shakuhachi", counter: "guzheng", pad: "sheng",
    sad: 0.55, chant: [1, 1, 6, 5], gain: 0.85,
    phrases: [
      P(n(5, 2), n(4, 1), n(3, 2), r(1), n(1, 2)),
      P(n(3, 1.5), n(5, 1.5), n(6, 3), r(2)),
      P(n(8, 2, "gliss"), n(6, 2), n(5, 2), n(4, 2)),
      P(n(3, 3), r(1), n(1, 4, "bend")),
    ],
    perc: { luo: "1.......", muyu: "..1...1." },
  },

  bgm_home: {
    root: 55, mode: "gong", bpm: 92, beats: 8, lead: "guzheng", counter: "xiao", pad: "sheng",
    sad: 0.3, chant: [1, 3, 5, 3], gain: 0.62,
    phrases: [
      P(n(1, 2), n(3, 1), n(5, 1), n(6, 2), n(5, 2)),
      P(n(3, 2), n(2, 2), n(1, 4)),
      P(n(5, 1, "grace"), n(6, 1), n(8, 2), n(6, 2), n(5, 2)),
      P(n(3, 2), n(1, 2), r(4)),
    ],
    perc: { muyu: "1...1..." },
  },

  bgm_town: {
    root: 57, mode: "zhi", bpm: 104, beats: 8, lead: "yangqin", counter: "dizi", pad: "sheng",
    sad: 0.5, chant: [1, 1, 4, 5], gain: 0.66,
    phrases: [
      P(n(1, 1), n(2, 1), n(3, 1), n(5, 1), n(6, 2), n(5, 2)),
      P(n(3, 1), n(5, 1), n(6, 1), n(8, 1), n(6, 4)),
      P(n(5, 2), n(3, 2), n(2, 2), n(1, 2)),
      P(n(1, 1), n(3, 1), n(5, 2), n(3, 2), r(2)),
    ],
    perc: { bangzi: "..1...1.", muyu: "1.......", dagu: "1...1..." },
  },

  bgm_route: {
    root: 52, mode: "shang", bpm: 100, beats: 8, lead: "dizi", counter: "guzheng",
    sad: 0.5, chant: [1, 5, 4, 1], gain: 0.62, birds: true,
    phrases: [
      P(n(1, 2), n(3, 2), n(5, 2), n(6, 2)),
      P(n(8, 3, "gliss"), n(6, 1), n(5, 4)),
      P(n(5, 1), n(6, 1), n(5, 2), n(3, 2), n(2, 2)),
      P(n(1, 4), r(4)),
    ],
    perc: { bangzi: "1..1..1.", dagu: "1...1..." },
  },

  bgm_forest: {
    root: 50, mode: "yu", bpm: 88, beats: 8, lead: "xiao", counter: "erhu", pad: "sheng",
    sad: 0.42, chant: [1, 6, 5, 1], gain: 0.6, birds: true, wind: true,
    phrases: [
      P(n(1, 3), n(3, 1), n(5, 4, "bend")),
      P(n(6, 2), n(5, 2), n(3, 2), n(1, 2)),
      P(n(5, 2, "gliss"), n(6, 2), n(8, 4)),
      P(n(6, 2), n(3, 2), n(1, 4)),
    ],
    perc: { muyu: "1...1..." },
  },

  bgm_village: {
    root: 57, mode: "gong", bpm: 96, beats: 8, lead: "guzheng", counter: "dizi", pad: "sheng",
    sad: 0.45, chant: [1, 3, 5, 6], gain: 0.68,
    phrases: [
      P(n(5, 1, "grace"), n(6, 1), n(8, 2), n(6, 2), n(5, 2)),
      P(n(3, 2), n(5, 2), n(6, 2), n(5, 2)),
      P(n(1, 2), n(3, 2), n(5, 4, "gliss")),
      P(n(6, 2), n(5, 2), n(3, 2), n(1, 2)),
    ],
    perc: { dagu: "1...1...", muyu: "..1...1.", luo: "1.......", bangzi: "....1..." },
  },

  bgm_bamboo: {
    // Walking pipa pulse under dizi calls — spec identity, over the Sadeness bed.
    root: 52, mode: "jue", bpm: 76, beats: 8, lead: "dizi", counter: "pipa", pad: "sheng",
    sad: 0.6, chant: [1, 1, 5, 4], gain: 0.66, wind: true,
    phrases: [
      P(n(1, 2), n(3, 1), n(4, 1), n(5, 2), n(4, 2)),
      P(n(5, 1, "trem"), n(6, 1), n(8, 2), n(6, 2), n(5, 2)),
      P(n(4, 2, "gliss"), n(3, 2), n(1, 4)),
      P(n(3, 1), n(4, 1), n(5, 2), n(3, 2), n(1, 2)),
    ],
    perc: { bangzi: "1.1.1.1.", muyu: "..1...1.", dagu: "1...1..." },
  },

  bgm_mountain: {
    root: 48, mode: "yu", bpm: 84, beats: 8, lead: "erhu", counter: "xiao", pad: "sheng",
    sad: 0.5, chant: [1, 6, 4, 5], gain: 0.68, wind: true,
    phrases: [
      P(n(1, 4, "bend"), n(3, 2), n(5, 2)),
      P(n(6, 3), n(5, 1), n(3, 4)),
      P(n(8, 4, "gliss"), n(6, 2), n(5, 2)),
      P(n(3, 2), n(1, 6, "bend")),
    ],
    perc: { dagu: "1.....1.", luo: "1......." },
  },

  bgm_temple: {
    // Slow martial dagu + muyu under xiao/erhu — spec identity, bpm 62.
    root: 45, mode: "yu", bpm: 62, beats: 8, lead: "xiao", counter: "erhu", pad: "sheng",
    sad: 0.35, chant: [1, 1, 6, 6], gain: 0.72,
    phrases: [
      P(n(1, 4), n(3, 4)),
      P(n(5, 4, "bend"), n(4, 2), n(3, 2)),
      P(n(6, 4), n(8, 4, "gliss")),
      P(n(5, 4), n(1, 4)),
    ],
    perc: { dagu: "1...1...", muyu: "1.1.1.1.", luo: "1......." },
  },

  bgm_garden: {
    root: 55, mode: "gong", bpm: 90, beats: 8, lead: "guzheng", counter: "erhu", pad: "sheng",
    sad: 0.38, chant: [1, 3, 6, 5], gain: 0.62,
    phrases: [
      P(n(3, 2), n(5, 2), n(6, 2), n(8, 2)),
      P(n(6, 4, "gliss"), n(5, 2), n(3, 2)),
      P(n(1, 2), n(3, 2), n(5, 4)),
      P(n(6, 2), n(5, 2), n(3, 2), n(1, 2)),
    ],
    perc: { muyu: "1...1...", bangzi: "....1..." },
  },

  bgm_cave: {
    root: 43, mode: "jue", bpm: 74, beats: 8, lead: "xiao", counter: "guzheng", pad: "sheng",
    sad: 0.45, chant: [1, 1, 4, 4], gain: 0.66, cave: true,
    phrases: [
      P(n(1, 4), n(4, 4, "bend")),
      P(n(5, 2), n(4, 2), n(3, 4)),
      P(n(1, 3), r(1), n(5, 4, "gliss")),
      P(n(4, 4), n(1, 4)),
    ],
    perc: { dagu: "1.......", muyu: "....1..." },
  },

  bgm_battle: {
    // Fast pipa tremolo runs, dagu "1.111.1." and off-beat bangzi.
    root: 52, mode: "yu", bpm: 156, beats: 8, lead: "pipa", counter: "dizi",
    sad: 0.85, chant: [1, 1, 6, 5], gain: 0.7,
    phrases: [
      P(n(1, 1), n(3, 1), n(5, 1), n(6, 1), n(5, 2, "trem"), n(3, 2)),
      P(n(6, 1), n(8, 1), n(6, 1), n(5, 1), n(3, 2), n(1, 2)),
      P(n(5, 1, "trem"), n(4, 1), n(3, 1), n(1, 1), n(5, 4, "gliss")),
      P(n(1, 2), n(5, 2), n(6, 2), n(8, 2, "trem")),
    ],
    perc: { dagu: "1.111.1.", bangzi: ".1.1.1.1", muyu: "..1...1." },
  },

  bgm_mimo: {
    root: 50, mode: "shang", bpm: 132, beats: 8, lead: "erhu", counter: "pipa",
    sad: 0.6, chant: [1, 6, 6, 5], gain: 0.66,
    phrases: [
      P(n(1, 2, "bend"), n(3, 2), n(5, 2), n(3, 2)),
      P(n(6, 2), n(5, 2), n(3, 4, "bend")),
      P(n(5, 1), n(6, 1), n(5, 2), n(1, 4)),
      P(n(3, 2), n(1, 6)),
    ],
    perc: { dagu: "1..1..1.", bangzi: "..1...1." },
  },

  bgm_reunion: {
    root: 57, mode: "gong", bpm: 76, beats: 8, lead: "erhu", counter: "guzheng", pad: "sheng",
    sad: 0.22, chant: [1, 5, 6, 3], gain: 0.7,
    phrases: [
      P(n(1, 4, "bend"), n(3, 4)),
      P(n(5, 4), n(6, 2), n(5, 2)),
      P(n(8, 4, "gliss"), n(6, 4)),
      P(n(5, 4), n(1, 4)),
    ],
    perc: { muyu: "1......." },
  },

  bgm_prakriti: {
    root: 54, mode: "yu", bpm: 138, beats: 8, lead: "erhu", counter: "pipa", pad: "sheng",
    sad: 0.75, chant: [1, 1, 5, 6], gain: 0.72,
    phrases: [
      P(n(1, 2, "bend"), n(5, 2), n(4, 2), n(3, 2)),
      P(n(6, 1), n(5, 1), n(4, 2), n(5, 4, "trem")),
      P(n(8, 2, "gliss"), n(6, 2), n(5, 2), n(4, 2)),
      P(n(3, 2), n(1, 2), n(5, 4, "trem")),
    ],
    perc: { dagu: "1.1.1.1.", bangzi: ".1.1.1.1", luo: "1......." },
  },

  bgm_miniboss: {
    root: 50, mode: "jue", bpm: 148, beats: 8, lead: "pipa", counter: "dizi",
    sad: 0.8, chant: [1, 1, 4, 5], gain: 0.7,
    phrases: [
      P(n(1, 1), n(1, 1), n(4, 2), n(3, 2), n(1, 2)),
      P(n(5, 2, "trem"), n(4, 2), n(3, 2), n(1, 2)),
      P(n(8, 2), n(6, 2), n(5, 2), n(4, 2)),
      P(n(1, 4, "trem"), n(5, 4, "gliss")),
    ],
    perc: { dagu: "1.11..1.", bangzi: ".1.1.1.1", luo: "1......." },
  },

  bgm_sentinel: {
    // Bamboo Sentinel: deep dagu, bangzi clicks, a stalking pipa line.
    root: 50, mode: "yu", bpm: 138, beats: 8, lead: "pipa", counter: "dizi", pad: "sheng",
    sad: 0.85, chant: [1, 1, 4, 5], gain: 0.74,
    phrases: [
      P(n(1, 1), n(3, 1), n(1, 1), n(4, 1), n(3, 2), r(2)),
      P(n(5, 1, "trem"), n(4, 1), n(3, 1), n(1, 1), n(6, 4, "bend")),
      P(n(1, 0.5), n(1, 0.5), n(3, 1), n(5, 2), n(4, 2), n(3, 2)),
      P(n(8, 2, "gliss"), n(6, 2), n(5, 4, "trem")),
    ],
    perc: { dagu: "1..1.1..", bangzi: "..1.1.1.", muyu: "1.1.1.1.", luo: "1......." },
  },

  bgm_blossom: {
    // Blossom Warden: elegant and dangerous — erhu over guzheng, drums under petals.
    root: 55, mode: "shang", bpm: 126, beats: 8, lead: "erhu", counter: "guzheng", pad: "sheng",
    sad: 0.7, chant: [1, 6, 5, 4], gain: 0.74,
    phrases: [
      P(n(5, 2, "bend"), n(6, 1), n(8, 1), n(6, 2), n(5, 2)),
      P(n(3, 1, "grace"), n(5, 1), n(6, 2), n(8, 4, "trem")),
      P(n(10, 2, "gliss"), n(8, 2), n(6, 1), n(5, 1), n(3, 2)),
      P(n(1, 2), n(3, 2), n(5, 4, "bend")),
    ],
    perc: { dagu: "1...1.1.", bangzi: ".1.1.1.1", luo: "....1...", muyu: "1.1.1.1." },
  },

  bgm_warden: {
    // Mountain Warden: wind and stone — dizi cries over heavy dagu and gong.
    root: 48, mode: "zhi", bpm: 132, beats: 8, lead: "dizi", counter: "pipa", pad: "sheng",
    sad: 0.9, chant: [1, 1, 5, 1], gain: 0.76, wind: true,
    phrases: [
      P(n(1, 1), n(5, 1), n(1, 1), n(5, 1), n(8, 2, "bend"), n(6, 2)),
      P(n(5, 2), n(4, 1), n(3, 1), n(1, 4, "trem")),
      P(n(3, 1), n(5, 1), n(6, 1), n(8, 1), n(10, 2, "gliss"), n(8, 2)),
      P(n(6, 2), n(5, 2), n(1, 4)),
    ],
    perc: { dagu: "1.1.1.11", luo: "1...1...", bangzi: "...1...1" },
  },

  bgm_boss: {
    // Heaviest cue: gong, full drums, three intensity phases (see setIntensity).
    root: 48, mode: "yu", bpm: 162, beats: 8, lead: "pipa", counter: "erhu", pad: "sheng",
    sad: 1, chant: [1, 1, 6, 5], gain: 0.78,
    phrases: [
      P(n(1, 1), n(1, 1), n(3, 1), n(1, 1), n(5, 2, "trem"), n(4, 2)),
      P(n(6, 1), n(5, 1), n(4, 1), n(3, 1), n(1, 4, "trem")),
      P(n(8, 2, "gliss"), n(6, 1), n(5, 1), n(6, 2), n(8, 2)),
      P(n(5, 1), n(4, 1), n(3, 1), n(1, 1), n(1, 4, "trem")),
    ],
    perc: { dagu: "1.111.11", bangzi: ".1.1.1.1", luo: "1...1...", muyu: "..1...1." },
  },

  // ------------------------------------------------------- final chapter
  bgm_road: {
    // The walk out of the valley: unhurried dizi over guzheng, barely any drums.
    root: 55, mode: "zhi", bpm: 88, beats: 8, lead: "dizi", counter: "guzheng", pad: "sheng",
    sad: 0.2, chant: [1, 5, 6, 5], gain: 0.62, wind: true, birds: true,
    phrases: [
      P(n(5, 2), n(6, 1), n(8, 1), n(6, 2), n(5, 2)),
      P(n(3, 2, "grace"), n(5, 2), n(2, 4)),
      P(n(1, 1), n(2, 1), n(3, 2), n(5, 2), n(6, 2)),
      P(n(5, 3), n(3, 1), n(1, 4, "bend")),
    ],
    perc: { muyu: "1...1..." },
  },

  bgm_f1205: {
    // Warm and relaxed: yangqin and pipa trading lines, a soft muyu pulse.
    root: 57, mode: "gong", bpm: 80, beats: 8, lead: "yangqin", counter: "pipa", pad: "sheng",
    sad: 0.15, chant: [1, 3, 5, 3], gain: 0.6,
    phrases: [
      P(n(3, 2), n(5, 1), n(6, 1), n(5, 2), n(3, 2)),
      P(n(2, 2), n(3, 2), n(1, 4)),
      P(n(5, 1, "grace"), n(6, 1), n(5, 2), n(3, 2), n(2, 2)),
      P(n(1, 2), n(3, 2), r(4)),
    ],
    perc: { muyu: "1.......", bangzi: "....1..." },
  },

  bgm_goodbye: {
    // The hug. Erhu carries it; guzheng answers; the chant swells under it.
    root: 52, mode: "yu", bpm: 66, beats: 8, lead: "erhu", counter: "guzheng", pad: "sheng",
    sad: 0.1, chant: [1, 6, 5, 4], gain: 0.8,
    phrases: [
      P(n(5, 3, "bend"), n(4, 1), n(3, 2), n(1, 2)),
      P(n(3, 2, "grace"), n(5, 2), n(6, 4, "trem")),
      P(n(8, 2, "gliss"), n(6, 2), n(5, 3), r(1)),
      P(n(3, 2), n(2, 2), n(1, 4, "bend")),
    ],
    perc: { luo: "1......." },
  },

  bgm_hug: {
    // The embrace: the goodbye theme at full voice — erhu high, chant swelling.
    root: 52, mode: "yu", bpm: 62, beats: 8, lead: "erhu", counter: "guzheng", pad: "sheng",
    sad: 0.2, chant: [1, 6, 4, 5], gain: 0.95,
    phrases: [
      P(n(8, 3, "bend"), n(6, 1), n(5, 2), n(3, 2)),
      P(n(5, 2, "grace"), n(6, 2), n(8, 4, "trem")),
      P(n(10, 2, "gliss"), n(8, 2), n(6, 3), r(1)),
      P(n(5, 2), n(3, 2), n(1, 4, "bend")),
    ],
    perc: { luo: "1.......", muyu: "....1..." },
  },

  bgm_end: {
    // THE END: xiao alone over the quietest bed. Nothing follows this.
    root: 52, mode: "gong", bpm: 60, beats: 8, lead: "xiao", counter: "guzheng", pad: "sheng",
    sad: 0.05, chant: [1, 1, 5, 1], gain: 0.7,
    phrases: [
      P(n(5, 4), n(6, 2), n(5, 2)),
      P(n(3, 4, "bend"), n(1, 4)),
      P(r(2), n(5, 2, "grace"), n(3, 4)),
      P(n(1, 8)),
    ],
    perc: {},
  },

  bgm_credits: {
    root: 53, mode: "gong", bpm: 84, beats: 8, lead: "guzheng", counter: "shakuhachi", pad: "sheng",
    sad: 0.4, chant: [1, 5, 6, 4], gain: 0.75,
    phrases: [
      P(n(1, 2), n(3, 2), n(5, 2), n(6, 2)),
      P(n(8, 4, "gliss"), n(6, 2), n(5, 2)),
      P(n(3, 2), n(5, 2), n(6, 4)),
      P(n(5, 2), n(3, 2), n(1, 4)),
    ],
    perc: { muyu: "1...1...", luo: "1......." },
  },
};

export type TrackKey = keyof typeof TRACKS;

// --------------------------------------------------------------------------- scheduler

type Playing = {
  key: string;
  track: Track;
  gain: GainNode;
  bar: number;
  nextTime: number;
  timer: number | null;
  intensity: number;
};

let current: Playing | null = null;
const LOOKAHEAD = 0.6;
const TICK_MS = 120;

const SAD_KICK = "1..1..1.";
const SAD_SNARE = "....1...";
const SAD_HAT = "..1...1.";

function scheduleBar(p: Playing, startTime: number) {
  const t = p.track;
  const spb = 60 / t.bpm;
  const barLen = spb * t.beats;
  const bars = p.bar;
  const vol = (t.gain ?? 0.7) * 0.55;
  const I = p.intensity;

  // --- Sadeness bed -------------------------------------------------------
  const sad = (t.sad ?? 0.5) * (0.55 + 0.45 * I);
  const slot = barLen / 8;

  for (let i = 0; i < 8; i++) {
    const st = startTime + i * slot;
    if (SAD_KICK[i] === "1") playKick(st, 0.5 * vol * (0.6 + sad));
    if (SAD_SNARE[i] === "1" && sad > 0.28) playSnare(st, 0.34 * vol * sad * 1.6);
    if (SAD_HAT[i] === "1" && sad > 0.2) playHat(st, 0.2 * vol * sad * 1.6);
    if (sad > 0.7 && i === 7) playHat(st + slot * 0.5, 0.14 * vol);
  }

  // sub bass follows the chant root, an octave and a half below
  const chantDegs = t.chant ?? [1, 1, 5, 6];
  const cd = chantDegs[bars % chantDegs.length];
  const subF = mtof(degToMidi(t, cd) - 24);
  playSub(subF, startTime, barLen * 0.92, 0.5 * vol);
  if (sad > 0.6) playSub(subF, startTime + barLen * 0.5, barLen * 0.2, 0.3 * vol);

  // Gregorian choir
  playChant(mtof(degToMidi(t, cd)), startTime, barLen * 1.02, 0.16 * vol * (0.7 + 0.5 * I));

  // --- Wuxia colour -------------------------------------------------------
  const phrase = t.phrases[bars % t.phrases.length];
  let beat = 0;
  for (const note of phrase) {
    if (note.d != null) {
      const f = mtof(degToMidi(t, note.d));
      const nt = startTime + beat * spb;
      const dur = note.l * spb * 0.92;
      // Grace / gliss ornaments lead the beat — `at()` keeps them legal.
      const lead = note.o === "grace" ? 0.18 : 0;
      playInst(t.lead, f, nt - lead, dur, 0.3 * vol, note.o);

      if (t.counter && bars % 2 === 1 && note.l >= 2) {
        playInst(t.counter, mtof(degToMidi(t, note.d) - 12), nt, dur * 0.8, 0.14 * vol);
      }
    }
    beat += note.l;
  }

  if (t.pad) {
    playSheng(mtof(degToMidi(t, cd) - 12), startTime, barLen, 0.12 * vol, musicBus);
  }

  // --- Chinese percussion -------------------------------------------------
  if (t.perc) {
    (Object.keys(t.perc) as (keyof NonNullable<Track["perc"]>)[]).forEach((kind) => {
      const pat = t.perc![kind]!;
      for (let i = 0; i < 8; i++) {
        if (pat[i] === "1") {
          const amp = kind === "dagu" ? 0.42 : kind === "luo" ? 0.28 : 0.2;
          playPerc(kind, startTime + i * slot, amp * vol * (0.7 + 0.5 * I));
        }
      }
    });
  }

  // --- ambience -----------------------------------------------------------
  if (t.wind && bars % 2 === 0) ambientWind(startTime, barLen);
  if (t.birds && bars % 3 === 0) ambientBird(startTime + barLen * 0.4);
  if (t.cave && bars % 2 === 1) ambientDrip(startTime + barLen * 0.6);
}

function playInst(inst: Inst, f: number, t: number, dur: number, vol: number, orn?: Ornament) {
  switch (inst) {
    case "guzheng":
    case "pipa":
    case "yangqin":
      return playPluck(inst, f, t, dur, vol, musicBus, orn);
    case "erhu":
      return playErhu(f, t, dur, vol, musicBus, orn);
    case "dizi":
    case "xiao":
    case "shakuhachi":
      return playFlute(inst, f, t, dur, vol, musicBus, orn);
    case "sheng":
      return playSheng(f, t, dur, vol, musicBus);
    case "chant":
      return playChant(f, t, dur, vol);
  }
}

function ambientWind(t: number, dur: number) {
  const c = ctx!;
  const s = at(t);
  const nz = noise();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 480; bp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(0.05, s + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  nz.connect(bp); bp.connect(g); g.connect(musicBus);
  nz.start(s); nz.stop(s + dur + 0.1);
}

function ambientBird(t: number) {
  const c = ctx!;
  const s = at(t);
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(2100, s);
  o.frequency.exponentialRampToValueAtTime(3200, s + 0.06);
  o.frequency.exponentialRampToValueAtTime(2400, s + 0.13);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(0.03, s + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.17);
  const send = c.createGain(); send.gain.value = 0.6;
  o.connect(g); g.connect(musicBus); g.connect(send); send.connect(verbSend);
  o.start(s); o.stop(s + 0.2);
}

function ambientDrip(t: number) {
  const c = ctx!;
  const s = at(t);
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(1400, s);
  o.frequency.exponentialRampToValueAtTime(620, s + 0.09);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(0.05, s + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
  const send = c.createGain(); send.gain.value = 0.9;
  o.connect(g); g.connect(musicBus); g.connect(send); send.connect(verbSend);
  o.start(s); o.stop(s + 0.3);
}

function tick() {
  if (!current || !ctx) return;
  // Before the first user gesture the context is suspended. Idle the playhead
  // forward instead of queueing bars that would all fire at once on resume.
  if (ctx.state !== "running") {
    current.nextTime = ctx.currentTime + 0.3;
    return;
  }
  const t = current.track;
  const barLen = (60 / t.bpm) * t.beats;
  while (current.nextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleBar(current, current.nextTime);
    current.nextTime += barLen;
    current.bar++;
  }
}

export function playBgm(key: string, fadeSec = 1.2) {
  initAudio();
  if (!ctx) return;
  if (current?.key === key || currentFile?.key === key) return;

  // A user-supplied file for this cue wins over the procedural track.
  const file = fileManifest[key];
  if (file) {
    fadeOut(fadeSec);
    if (playFileTrack(key, file, fadeSec)) return;
  }

  startProceduralTrack(key, fadeSec);
}

function startProceduralTrack(key: string, fadeSec: number) {
  if (!ctx) return;
  const track = TRACKS[key];
  if (!track) {
    console.warn(`[sound] unknown track "${key}"`);
    return;
  }

  fadeOut(fadeSec);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + Math.max(0.05, fadeSec));
  g.connect(musicBus);

  const p: Playing = {
    key, track, gain: g, bar: 0,
    nextTime: ctx.currentTime + 0.3,
    timer: null,
    intensity: 0.5,
  };
  p.timer = window.setInterval(tick, TICK_MS);
  current = p;
  tick();
}

/** Boss phases: 0 = opening, 1 = enraged, 2 = final. */
export function setIntensity(v: number) {
  if (current) current.intensity = Math.max(0, Math.min(1, v));
}

export function fadeOut(sec = 1.2) {
  stopFileTrack(sec);
  if (!current || !ctx) return;
  const old = current;
  current = null;
  if (old.timer != null) window.clearInterval(old.timer);
  const now = ctx.currentTime;
  try {
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, sec));
  } catch {
    /* node already disconnected */
  }
  window.setTimeout(() => {
    try { old.gain.disconnect(); } catch { /* noop */ }
  }, sec * 1000 + 400);
}

export function stopBgm() {
  fadeOut(0.25);
}

export function currentBgm() {
  return current?.key ?? currentFile?.key ?? null;
}

// --------------------------------------------------------------------------- sfx

export type SfxName = "step" | "menu" | "confirm" | "cancel" | "hit" | "heal" | "win" | "pickup" | "open" | "error";

export function sfx(name: SfxName) {
  initAudio();
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime;

  const beep = (freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  };

  switch (name) {
    case "step":    beep(180, 0.05, "square", 0.05); break;
    case "menu":    beep(620, 0.05, "square", 0.09); break;
    case "confirm": beep(720, 0.09, "square", 0.12, 1080); break;
    case "cancel":  beep(420, 0.09, "square", 0.1, 240); break;
    case "open":    beep(320, 0.12, "triangle", 0.11, 640); break;
    case "error":   beep(160, 0.16, "sawtooth", 0.1, 110); break;
    case "hit": {
      const nz = noise();
      const bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 1.4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      nz.connect(bp); bp.connect(g); g.connect(sfxBus);
      nz.start(t); nz.stop(t + 0.2);
      beep(140, 0.12, "square", 0.1, 70);
      break;
    }
    case "heal":
      [660, 880, 1100].forEach((f, i) => window.setTimeout(() => beepLater(f, 0.12, 0.09), i * 70));
      break;
    case "pickup":
      [880, 1320].forEach((f, i) => window.setTimeout(() => beepLater(f, 0.1, 0.11), i * 80));
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => beepLater(f, 0.16, 0.11), i * 120));
      break;
  }
}

function beepLater(freq: number, dur: number, vol: number) {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
}
