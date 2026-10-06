# Shaolin Baddie — Palakshi's Birthday Adventure

A browser-based, Pokemon-inspired Chinese/Wuxia adventure RPG, built as a birthday gift
for **Palakshi**. Single player, keyboard + mouse, gamepad or touch, no backend, saves
to LocalStorage. The world is a stylised low-poly 3D third-person adventure rendered
with Three.js; the original pixel-art renderer is still in the box as "Classic 2D".

Explore 14 regions, talk and interact, advance the mission chain, fight turn-based
battles, gather the three Sacred Flames, beat the final boss, get the birthday ending,
then walk the West Road to F-1205 for the final chapter and one goodbye, for now.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick / D-pad | Left-side joystick |
| Look | Drag with a mouse button, wheel to zoom | Right stick, triggers to zoom | Drag on the right half |
| Interact / advance | E, Z, Enter, Space | A | Big red button |
| Dash | Shift | B | Dash button |
| Mimo sniffs | F | RB | Paw button |
| Items | I | X | Bag button |
| Journey (missions) | Q, M | Y | Diamond button |
| Menu | Esc | Start | Menu button |
| Hint | H | LB | ? button |
| Save | F5 | — | Menu > Save |

Input is detected automatically: a connected controller switches the prompts to
button glyphs, a touch on the screen brings up the on-screen controls, and the
keyboard always keeps working. Menus and battles accept all three.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + Vite 7, routed with TanStack Router |
| World | Three.js, `src/world3d/World3D.ts`: one imperative engine instance (no React Three Fiber) |
| Classic renderer | Phaser 3, one scene `WorldScene`; Settings > World renderer |
| Story | `src/game/story.ts`: one StoryController shared by both renderers |
| State | Zustand, single store `src/store/useGameStore.ts` |
| UI | React overlays over the canvas; Tailwind v4; Cinzel + Inter; responsive down to phones |
| Art | 100% procedural: low-poly props and character rigs built from Three primitives; pixel art for Classic. No image files. |
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
  components/        HUD, MissionTracker, JourneyPanel, DialogueBox, BattleUI, panels,
                     TouchControls, FadeOverlay, TheEnd
    pixel/           SVG pixel portraits, mission icons, shared decor
  world3d/
    World3D.ts       the 3D engine: regions, player, companion, NPCs, camera, battle stage, cinematics
    MapBuilder.ts    MapDef rows -> instanced low-poly region + theme (sky, fog, light, particles)
    props.ts         the prop catalogue (one entry per tile character)
    CharacterRig.ts  procedural human rig (walk / idle variants / attack / hug ...)
    DogRig.ts        Mimo
    EnemyRig.ts      every battle species
    CameraRig.ts     third-person camera, wall awareness, cinematics
    characters.ts    per-character identity specs (colours, build, hair, props)
  input/
    InputManager.ts  keyboard + mouse, gamepad, touch -> one input state; synthetic keys for menus
    useDevice.ts     which device is live, prompt glyphs
  game/
    story.ts         StoryController: interactions, dialogue:end branches, battle:end (shared)
    storyFinal.ts    the F-1205 chapter
    PhaserGame.ts    Classic 2D renderer config
    WorldScene.ts    Classic 2D scene (delegates to StoryController)
    maps.ts          MAPS: 14 MapDef with rows/portals/interacts/bgm/cinematic
    textures*.ts     procedural pixel art for Classic
    sound.ts         instrument models, TRACKS, playBgm/sfx/gong, custom-file support
    bus.ts           React <-> engine event bus
  data/content.ts    MOVES, ENEMIES, fighters, items, quests, DIALOGUES
  lib/
    missionMeta.ts   REGIONS, MAIN_MISSIONS, buildMissions(), activeMission()
    guidance.ts      STEP_GUIDE: objective, place, 3-step hint ladder, route chain
  store/             all game state + actions + save/load
public/audio/        optional user-supplied music (empty by default)
public/models/       optional GLB overrides: <characterId>.glb replaces a procedural rig
scripts/e2e.js       scripted start-to-THE-END playthrough against the real engine (dev server)
```

## The 3D world

The grid is still the truth. `maps.ts` rows drive collision, portals, encounters and
interactables exactly as before; one tile is one world unit, columns run along +x and
rows along -z. `MapBuilder` turns each row into instanced low-poly props per theme
(bamboo, cherry, temple, cave, village at dusk, the flat) so a whole region is a few
dozen draw calls. Movement is free and camera-relative; the third-person camera rises
over walls (rooms read like dollhouses) rather than pulling in, holds a side-on view in
battles, and plays keyframed cinematics for arrivals, discoveries, boss intros, the
F-1205 evening and the final hug.

Characters are procedural rigs built from their `characters.ts` spec: Palakshi's long
black hair and gold pin, Abhimanyu's white guitar, Hakim's iPad, Dev's build, Garv's
grey temples, with procedural walk, idle, attack, hit, cheer and hug. Drop
`public/models/<id>.glb` (with optional `idle` / `walk` clips) to replace any rig.

One active instance per character is guaranteed structurally: `World3D` is a
singleton, rigs live in a Map keyed by id, every map load disposes before it builds,
and NPC markers are skipped for party members.

Performance: toon materials, instancing, one shadow-casting light (shadows off and
pixel ratio capped on phones), four pooled point lights, a few hundred particles, no
post-processing, full disposal on region change.

## Final chapter: F-1205

After Arshiya and the celebration, Mission 26 opens the West Road out of Sparkle Town.
Missions 26-28 (`storyFinal.ts`): find Abhimanyu and Faizal, meet Garv, Hakim and Dev
at the flat, the last evening together, and the goodbye. The hug plays as a camera
pull-back, fades to black, shows THE END, rolls the credits and returns to the title.
Nothing loops back into the world.

## Testing the whole game

With `npm run dev` running, open the game and in the browser console:

```js
await import("/scripts/e2e.js?x=" + Date.now()); await window.__e2e.run();
```

It plays from New Game to THE END through the real engine (movement, portals,
encounters, dialogues, every battle, the final chapter) and returns `{ log, fails }`.

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
