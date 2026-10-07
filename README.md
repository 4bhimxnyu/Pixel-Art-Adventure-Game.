# Shaolin Baddie — Palakshi's Birthday Adventure

A browser-based, Pokemon-inspired Chinese/Wuxia adventure RPG, built as a birthday gift
for **Palakshi**. Single player, keyboard + mouse, gamepad or touch, no backend, saves
to LocalStorage. The world is a stylised low-poly 3D third-person adventure rendered
with Three.js; the original pixel-art renderer is still in the box as "Classic 2D".

Explore 14 regions, talk and interact, advance nine chapters, fight turn-based
battles, gather the three Sacred Flames, beat the final boss, get the birthday ending,
then walk the West Road to F-1205 for the final chapter and one goodbye, for now.

## Chapters

| # | Chapter | Where | Beats |
|---|---------|-------|-------|
| 1 | Find Mimo | Bedroom, home, Sparkle Town, Route 1, Whispering Woods | Mum, Abhimanyu joins, the witness, the red ball, paw prints, the rustling bush, Mimo |
| 2 | Lantern Village | Lantern Village | Elder Shu, the musician, supplies |
| 3 | The Bamboo Forest | Bamboo Forest | the barrier, the scroll, the trial (two statues, two plates), **Bamboo Sentinel** |
| 4 | The Hidden Garden | Cherry Blossom Garden | **Blossom Warden**, Prakriti's duel, the garden flame |
| 5 | The Mountain Path | Mountain Trail, Temple of Echoes | **Mountain Warden**, the mountain flame, four statues and plates, the Temple Guardian |
| 6 | The Three Flames | Ancient Cave, Temple | the echo-stone puzzle, the cave flame, the Sacred Lantern |
| 7 | Arshiya | Academy | the gatekeeper, **Arshiya** (three phases) |
| 8 | The West Road | Sparkle Town, West Road | the finale, Faizal at the door |
| 9 | F-1205 | the flat, first person | Abhimanyu, Garv, Hakim, Faizal, Dev, the evening, the goodbye, THE END |

Mission states (LOCKED / AVAILABLE / ACTIVE / COMPLETED) are derived from the quest
step in `lib/missionMeta.ts` and shown in the Journey panel. Every region beyond the
first is behind a gate that opens with a short camera shot when its chapter unlocks.
Defeated villains walk off and never respawn. Riddhi, Palakshi's chaotic best friend,
is optional: she hangs around town, the village plaza and the garden with new banter
each time.

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

## The game's soundtrack

`public/audio/` ships four tracks: `game 1.mp3`, `game 2.mp3`, `game 3.mp3` and
`ending.mp4`. When they are present the music manager in `sound.ts` plays the three
game tracks in rotation through the whole adventure (one player, persistent across
regions and battles, crossfading from one track to the next, never two at once) and
reserves `ending` for THE END and the credits (`bgm_end` / `bgm_credits`). Autoplay
restrictions are handled by resuming on the first click, key or touch. If the files
are missing the procedural score below takes over, exactly as before.

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
    targets.ts       STEP_TARGET: where the beacon points for each step, route between regions
  store/             all game state + actions + save/load
public/audio/        the soundtrack (game 1-3 + ending) and optional per-cue overrides
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

Regions are 30-34 tiles across with winding paths and a landmark each (the town well
and square, the lantern road and pond on Route 1, the forest's lantern clearing, the
village plaza and stream, the garden pond and moon gate, the mountain's east ledge,
the temple courtyard, the cave's chain of chambers, the Academy's banner avenue).
Lantern posts line the way to each destination and the objective hints name them.

Characters are procedural rigs built from their `characters.ts` spec, from written
references: Palakshi (shoulder-length dark hair, large black glasses, black top and
cardigan, loose green-and-white checkered trousers), Abhimanyu (messy fringe, light
denim jacket, black tee and jeans, and the only instrument in the game, his white
bass), Mimo (a fluffy male Shih Tzu who leaves paw prints), Riddhi (messy bun, hoops,
mustard hoodie, phone), Prakriti, heavy-set Arshiya, and the flatmates Faizal, Garv,
Hakim and Dev, with procedural walk, idle, attack, hit, cheer and hug. Drop
`public/models/<id>.glb` (with optional `idle` / `walk` clips) to replace any rig.

One active instance per character is guaranteed structurally: `World3D` is a
singleton, rigs live in a Map keyed by id, every map load disposes before it builds,
and NPC markers are skipped for party members.

Performance: toon materials, instancing, one shadow-casting light (shadows off and
pixel ratio capped on phones), four pooled point lights, a few hundred particles, no
post-processing, full disposal on region change. A region costs roughly 170-350 draw
calls and 85-130k triangles. The engine also watches its own frame rate: if a region
averages under ~42 fps for five seconds it drops to pixel ratio 1 with a smaller
shadow map, and if that is still not enough it switches shadows off.

Getting around: the gold beacon marks the objective (or the gate toward it), the
tracker hints name landmarks, Mimo looks toward the goal when you stand still and
barks when you walk past something hidden (press F / RB / the paw button and he
sniffs it out), and after a long idle or pushing against a wall a "Need help?" panel
offers Show direction, Show objective and Reset position (never touches progress).

## Final chapter: F-1205

After Arshiya and the celebration, chapter 8 opens the West Road out of Sparkle Town.
Chapter 9 (`storyFinal.ts`) is played in first person: Faizal holds the door, you meet
Abhimanyu in his room and then Garv, Hakim, Faizal and Dev one by one with their own
exact exchanges, the flat rearranges itself once everyone has been met, the evening
plays as a slow camera orbit that ends with the conversation, and the goodbye leads to
the hug. The hug plays as a camera pull-back, fades to black, shows THE END, rolls the
credits with the ending track and returns to the title. Nothing loops back into the
world.

## Testing the whole game

With `npm run dev` running, open the game and in the browser console:

```js
await import("/scripts/e2e.js?x=" + Date.now()); await window.__e2e.run();
```

It plays from New Game to THE END through the real engine (movement, portals,
encounters, dialogues, every battle, the final chapter) and returns `{ log, fails }`.
It finds everything from map data (marker letters, tile characters, portals), so a map
redesign needs no script changes; it starts with a reachability audit of every portal
and NPC on every map. Two things it learned the hard way: never edit `src/` while it
runs (Vite reloads the page), and every synthetic key press must also be released, or
the input layer keeps "walking" the player after a battle.

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

**Adding a quest step** means adding a `STEP_GUIDE` entry in `lib/guidance.ts` and a
`STEP_TARGET` entry in `lib/targets.ts`, or the tracker has no hints and the beacon
has nowhere to point. Steps are only ever appended: saves store the step index.

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
