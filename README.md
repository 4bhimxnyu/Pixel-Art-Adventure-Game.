# Shaolin Baddie — Palakshi's Birthday Adventure

A browser-based, Pokemon-inspired Chinese/Wuxia pixel RPG, built as a birthday gift
for **Palakshi**. Single player, keyboard + gamepad, no backend, saves to LocalStorage.

Explore 12 tile maps, talk and interact, advance the mission chain, fight turn-based
battles, gather the three Sacred Flames, beat the final boss, get the birthday ending.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | WASD / arrows | D-pad / left stick |
| Interact / advance | E, Z, Enter, Space | A |
| Cancel / back | Esc, X | B |
| Items | I | X |
| Journey (missions) | Q | Y |
| Menu | Esc | Start |
| Hint | H | on-panel button |
| Save | F5 | — |

## Stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + Vite 7, routed with TanStack Router |
| Game engine | Phaser 3 — one scene, `WorldScene` |
| State | Zustand, single store `src/store/useGameStore.ts` |
| UI | React overlays over the Phaser canvas; Tailwind v4; Cinzel + Inter |
| Art | 100% procedural pixel art generated at runtime. No image files. |
| Audio | 100% procedural WebAudio synthesis. No audio files. |
| Persistence | LocalStorage, key `palakshi_save_v1` |

Hard rules held throughout: no external asset downloads, no backend, no router other
than TanStack Router, all colours from the theme palette.

> The MVP spec calls for TanStack **Start**. Since the game is explicitly
> client-only with no backend, this is built as a Vite SPA using TanStack
> **Router** — same routing library, no SSR server to run or deploy. Everything
> else follows the spec; `src/routes/index.tsx` still mounts `GameApp` lazily
> behind a `mounted` guard.

## Soundtrack — Sadeness base, Wuxia colour

The score is procedural and generated live in `src/game/sound.ts`.

**Base layer, present in every track:** the Enigma *Sadeness* bed — deep sub bass on
the downbeat, a slow half-time breakbeat, a Gregorian-style chant pad pushed through
vowel formant filters, and a breathy shakuhachi lead, all sitting in a generated
plate reverb. `sad` scales the drums per track; `chant` moves the choir.

**Colour layer, per region:** guzheng, pipa, yangqin, erhu, dizi, xiao and sheng over
dagu / luo / bangzi / muyu percussion, written in Chinese pentatonic modes (gong,
shang, jue, zhi, yu) so each of the 12 areas still reads as its own place — the
bamboo forest keeps its walking pipa pulse under dizi calls, the temple its slow
martial dagu, Arshiya her full drums and gong across three intensity phases.

**Scheduling invariant:** every scheduled time is clamped through `at()` to
`Math.max(t, ctx.currentTime + 0.25)`. Grace and gliss ornaments schedule up to
0.18s early and would otherwise produce negative `setValueAtTime` times at startup.
Do not remove `at()`.

## Custom music

`public/audio/README.md` has the details. In short: drop a file into
`public/audio/`, list it in `manifest.json` against a cue name, and it plays instead
of the synthesised track — looped, crossfaded, and routed through the same music bus
so the volume slider still applies. Cues you don't list keep
using the procedural score, and a file that fails to load falls back to it with a
console warning rather than going silent.

Use music you have the right to distribute: deploying publishes whatever is in that
folder to anyone with the URL. A commercial release like Enigma's "Sadeness (Part I)"
is not in that category, so it is not shipped here — the procedural Sadeness-style
bed described above is the default instead.

## Deploying to Netlify

`netlify.toml` is set up: build `npm run build`, publish `dist`, plus an SPA redirect
so refreshing a deep link doesn't 404 and long-cache headers for hashed assets.
Connect the repo and it deploys as-is, or run `netlify deploy --prod --dir=dist`
after a local build.

## Layout

```
src/
  routes/            route + html shell; mounts GameApp client-side
  components/        HUD, MissionTracker, JourneyPanel, DialogueBox, BattleUI, panels
    pixel/           SVG pixel portraits, mission icons, shared decor
  game/
    PhaserGame.ts    Phaser config (pixelArt, 15x11 tiles visible)
    WorldScene.ts    map rendering, movement, follower, interactions, story branches
    maps.ts          MAPS: 12 MapDef with rows/portals/interacts/bgm/cinematic
    textures*.ts     all procedural tile / character / enemy art
    sound.ts         instrument models, TRACKS, playBgm/sfx/gong, custom-file support
    bus.ts           React <-> Phaser event bus
  data/content.ts    MOVES, ENEMIES, fighters, items, quests, DIALOGUES
  lib/
    missionMeta.ts   REGIONS, MAIN_MISSIONS, buildMissions(), activeMission()
    guidance.ts      STEP_GUIDE: objective, place, 3-step hint ladder, route chain
  store/             all game state + actions + save/load
public/audio/        optional user-supplied music (empty by default)
```

## Interface

The **world** is pixel art. The **interface** is not: it's a designed layer over
the canvas — Cinzel for headings, Inter for body copy, translucent panels with
real depth, gradient HP bars, and soft light. Design tokens and the shared
`.surface` / `.btn` primitives live at the top of `src/styles.css`; the pixel
font is kept only where it reads as deliberate.

Only the Phaser canvas is `image-rendering: pixelated`. If you add UI, use the
existing primitives rather than hard 2px borders.

## Playability

The game is completable end to end; this was verified by scripted playthroughs
that walk the real maps and press the real keys, not by firing events. Things
that make it survivable:

- **Healing.** Sleeping in your bed at home, the village monk, and the temple
  incense each restore the whole party. Every boss victory heals you, and the
  village merchant hands over a real kit of potions.
- **Losing is not the end.** A defeat patches you up where you stand and lets
  you try again, instead of dumping you to the title screen.
- **The Sacred Lantern blesses you.** Restoring it permanently raises Palakshi
  and Mimo's stats. That power spike is what makes Arshiya's 420 HP a fight
  rather than a war of attrition, and it lands right before the finale.
- **Interactables are solid.** Anything you can use — braziers, the scroll, the
  lantern, Mimo's ball — blocks movement so you walk up and face it. A walkable
  interactable is a trap: you step onto the tile and `E` targets past it. All
  three Sacred Flames were unusable for exactly this reason.

> Deliberate deviation from the spec: it says Arshiya is "tuned so a solo
> fighter loses". In practice that produced a finale that dragged past twenty
> turns and could strand a playthrough with no way forward. She is now tuned so
> that soloing with no healing narrowly fails, while rotating Palakshi and Mimo
> — or simply using potions — wins. Swapping is rewarded rather than mandatory.

## Working on it

**Story branching** hangs off one place. `advanceDialogue` emits `dialogue:end` on
the bus with the last line's `onEnd` string, and `WorldScene.handleDialogueEnd`
switches on it. This decoupling fixes an old race between the React overlay closing
and Phaser reacting — keep it.

**Adding a quest step** means adding a `STEP_GUIDE` entry in `lib/guidance.ts`, or
the tracker has no objective and no hints to show.

**Duplicate-sprite protections** in `loadMap()`: the previous player, follower and
entities are destroyed and their tweens killed *first*; bus listeners are removed on
scene SHUTDOWN; an NPC marker is skipped when that character is already in the party.

**Battle tuning** lives in `roll()` in `BattleUI.tsx`. The `2.6` defence factor sets
how long every fight in the game runs — changing it re-tunes all of them at once.

### The Arshiya fight

Her 420 HP is tuned so one fighter cannot outlast her, per the spec. Two mechanics
carry it, both scoped to this fight only:

- **Read** — every hit she lands on the same fighter deepens her read of them and
  multiplies her damage against them. It fades while that fighter is benched. Dig in
  and it runs away with you; rotate and it stays flat. Capped lower when your partner
  is down, so losing Mimo makes the fight hard rather than unwinnable.
- **Tag cover** — for two turns after a swap the incoming fighter takes 30% less.
  It is the only reason Mimo can stand in front of Arshiya at all.

She attacks whoever is in front of her; a benched fighter is out of reach and
recovers 10% of their max HP per turn. Measured in play at ~55 damage per landed
hit against her: the fight runs 8-14 turns, and attacking with no heals at all
falls just short at roughly a quarter of her HP remaining.
