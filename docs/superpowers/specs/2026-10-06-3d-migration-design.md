# Shaolin Baddie — 2D → 3D migration design (2026-10-06)

## 1. Current architecture (audit)

| Concern | Today |
| --- | --- |
| Framework | React 19 + Vite 7 + TanStack Router SPA, Tailwind v4, Zustand store |
| Renderer / loop | Phaser 3, one scene `WorldScene` (grid movement, 16px tiles, follower, interactions, story branch table) |
| World data | `game/maps.ts` — 12 `MapDef`s: ASCII `rows`, `portals`, `interacts` markers, `bgm`, arrival `cinematic` |
| Story logic | `WorldScene.handleInteract / handleDialogueEnd / handleBattleEnd` switch tables keyed by tile chars, marker kinds and dialogue `onEnd` strings |
| State | `store/useGameStore.ts` — map, player cell, party, inventory, quests, 40+ flags, settings, LocalStorage save `palakshi_save_v1` |
| React ↔ engine | `game/bus.ts` events: `prompt`, `cinematic`, `dialogue:end`, `battle:end`, `input:lock`, `toast`, `world:reload` … |
| Combat | `BattleUI.tsx` — self-contained turn-based React component (moves, items, swap, run, boss phases, Arshiya read/cover). Engine only receives `battle:end` |
| Dialogue | `DialogueBox.tsx` + `DIALOGUES` in `data/content.ts`; branching via `onEnd` → bus → engine |
| Missions | `QUEST_MAIN` steps + `lib/missionMeta.ts` (MAIN_MISSIONS, regions) + `lib/guidance.ts` (STEP_GUIDE hints/routes) |
| UI | HUD, MissionTracker, JourneyPanel (map), Inventory, Menu, Settings, Toasts, MissionCinematic, LocationCard, InteractPrompt, TitleScreen, CreditsRoll |
| Art | 100% procedural pixel textures (`textures*.ts`), SVG portraits (`pixel/Portrait.tsx`) |
| Audio | 100% procedural WebAudio score (`sound.ts`), optional file override via `public/audio/manifest.json` |
| Input | keyboard in Phaser + React; partial gamepad (movement only) |

## 2. Reuse / adapt / replace

**Reused unchanged:** store, save format, content (moves, enemies, items, quests, dialogues), missionMeta, guidance, bus, sound engine, all overlay panels, BattleUI rules, portraits (used in UI), maps data as the world's source of truth.

**Adapted:**
- Story branch tables move out of `WorldScene` into `game/story.ts` (`StoryController`) with a tiny `WorldFx` interface, so the Phaser scene and the 3D world share one implementation.
- `MapDef` gains optional 3D hints (theme already exists); tile chars map to 3D prop builders.
- BattleUI keeps its logic; its field becomes transparent so a 3D battle stage shows through, and it emits `battle:fx` events the world animates.
- HUD / prompts / panels become responsive and device-aware (keyboard / gamepad / touch glyphs).
- `GameApp` mounts the 3D world instead of Phaser; Phaser stays available behind a "Classic 2D" setting (lazy-loaded).

**Replaced (genuinely cannot be reused):** Phaser rendering, tweens, camera and tile painting — a 3D renderer cannot consume Phaser textures or sprites. Everything else survives.

## 3. 3D approach

- **Three.js, imperative engine class `World3D`** (`src/world3d/`), created once in a `useEffect` exactly like Phaser today. Not React Three Fiber: R3F re-renders and StrictMode double-mounts are precisely the mechanism that produced duplicate Palakshi/Abhimanyu instances before, and the game already has a clean engine/UI boundary via the bus. A singleton guard (`World3D.instance`) makes a second active world impossible.
- **Grid stays the truth.** One tile = 1 world unit. Collision, portals, encounters, interactables all come from `MapDef.rows` exactly as before. Movement is continuous (camera-relative) inside that grid.
- **Procedural low-poly art** from Three primitives: instanced tiles and props per theme, stylised characters (`CharacterFactory`) with per-character specs (hair, outfit, build, props: white guitar, iPad), procedural walk/idle/hug animation. `public/models/<id>.glb` overrides a procedural character automatically when present (GLTFLoader), so reference-based models can be dropped in later.
- **Lighting:** hemisphere + one directional light, 1024 shadow map on desktop, shadows off on mobile, fog per theme, Points particles (petals/leaves/sparks).
- **Camera:** third-person follow with smoothed yaw/pitch, distance, collision against solid cells, `CameraDirector` for cinematics (arrival, boss intro, discoveries, final hug).
- **Characters:** one `CharacterRig` per party member, keyed by id in a `Map`; `loadMap` disposes everything first; NPC markers skipped when the character is in the party (existing rule kept).
- **Streaming:** one map at a time (existing portal structure); full disposal on change.

## 4. Input and devices

`src/input/InputManager.ts` polls keyboard, Gamepad API and touch controls into one `InputState` per frame. Gamepad in menus dispatches synthetic key events so existing panels keep working. `useDevice()` exposes `{ touch, gamepad }` so prompts show the right glyph. Mobile: `TouchControls` (joystick, look area, A/B/Y/X buttons), responsive panels.

## 5. Final chapter (F-1205)

New maps `road` (Mission 26) and `f1205` (Missions 27/28). New characters Faizal, Garv, Hakim (iPad), Dev. Quest steps `find_abhi`, `f1205`, `evening`, `goodbye` appended to `QUEST_MAIN`; `boss_end → finale → after_finale` now opens Mission 26 instead of credits. Final hug cinematic → fade → THE END → credits → main menu only (no loop).

## 6. Migration order

1. Extract story logic (`story.ts`), keep Phaser working.
2. Install three; `World3D` foundation + test ground; Palakshi rig; camera; movement.
3. Mimo rig + following + abilities (sniff / warn).
4. Convert all regions via theme builders (data-driven from `rows`).
5. Wire story controller, prompts, portals, encounters, cinematics.
6. Battle stage in 3D + BattleUI transparent layout + fx events.
7. Input manager (gamepad), touch controls, responsive UI.
8. Performance pass (instancing, pixel ratio, disposal).
9. F-1205 cast, maps, missions, final scene, music.
10. End-to-end scripted playthrough.
