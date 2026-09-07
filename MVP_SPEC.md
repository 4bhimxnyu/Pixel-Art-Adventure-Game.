# Shaolin Baddie's Adventure — Full MVP Specification

A complete, self-contained build spec of the game as it exists today, written so a
fresh agent session (e.g. Claude Code) can continue development without reading
the whole codebase first. Every named id below is the real id used in code.

---

## 1. Product summary

A browser-based, Pokémon-inspired, Chinese/Wuxia-themed pixel RPG built as a
birthday gift for the protagonist **Palakshi**. Single player, keyboard +
gamepad, no backend, save data in LocalStorage.

Core loop: explore tile maps → talk / interact → advance the mission chain →
turn-based battles → collect items and flames → final boss → birthday ending.

Target play length: 2–3 hours across 12 maps.

---

## 2. Tech stack and constraints

| Concern | Choice |
| --- | --- |
| Framework | TanStack Start v1 (React 19, Vite 7). Route: `src/routes/index.tsx` renders `GameApp` lazily, client-only (`mounted` guard). |
| Game engine | Phaser 3 — one scene, `WorldScene`, created in `src/game/PhaserGame.ts`. |
| State | Zustand, single store `src/store/useGameStore.ts`. |
| UI | React overlays on top of the Phaser canvas; Tailwind v4 (`src/styles.css`); font `'Press Start 2P'`. |
| Art | 100% procedural pixel art generated at runtime into Phaser textures (`src/game/textures.ts`, `textures.expansion.ts`). No image files. |
| Audio | 100% procedural WebAudio synthesis (`src/game/sound.ts`). No audio files. |
| Persistence | LocalStorage key `palakshi_save_v1`. |
| React↔Phaser | Tiny event bus `src/game/bus.ts` (`on/off/emit`). |

Hard rules: no external asset downloads, no backend, no router other than
TanStack Router, all colors via the theme palette below.

Theme palette (used everywhere):
`#0a0507` black, `#1a0f12` charcoal, `#8f1a24` crimson, `#b3252f` red,
`#7c141f` burgundy, `#d9b45b` gold, `#f2dfa6` bright gold, `#f7e6c8` off-white,
`#7ddca4` success green.

---

## 3. File map

```
src/
  routes/index.tsx            route + SEO head; mounts GameApp client-side
  routes/__root.tsx           html shell, fonts link
  components/
    GameApp.tsx               screen switch (title/playing/credits), Phaser mount, overlay router
    TitleScreen.tsx           New Game / Continue / Settings
    HUD.tsx                   map name, party HP, MissionTracker, key hints
    MissionTracker.tsx        ONE active objective + location + [H] hint ladder + flames
    LocationCard.tsx          arrival card: place, objective, hint (auto-fades 3.6s)
    InteractPrompt.tsx        contextual "E — Talk" prompt driven by bus "prompt"
    JourneyPanel.tsx          full mission journal: tabs, detail, WHAT TO DO, route, map, legend
    MissionCinematic.tsx      NEW MISSION / MISSION COMPLETE cards (bus "cinematic")
    DialogueBox.tsx           typewriter dialogue with portrait + speaker plate
    BattleUI.tsx              turn-based battle screen, phases, shake, damage numbers
    InventoryPanel.tsx, MenuPanel.tsx, SettingsPanel.tsx, Toasts.tsx, CreditsRoll.tsx
    pixel/Portrait.tsx        CharacterPortrait / FramedPortrait (SVG pixel busts)
    pixel/MissionIcons.tsx    PixelIcon: lantern, scroll, bamboo, blossom, temple, flame, sword, boss, paw, guitar, star, seal, region, ability, mountain, cave, home
    pixel/decor.tsx           Lantern, Blossom, PetalRain, ScrollPanel, HpBar, ThemeKeyframes
  game/
    PhaserGame.ts             Phaser.Game config (pixelArt, 15x11 tiles visible)
    WorldScene.ts             map rendering, movement, follower, interactions, encounters, prompts
    maps.ts                   MAPS: 12 MapDef with rows/portals/interacts/bgm/cinematic
    textures.ts               base tiles, characters, dog, enemies, portraits
    textures.expansion.ts     village/bamboo/mountain/temple/cave/garden tiles and props
    sound.ts                  instrument models, TRACKS, playBgm/sfx/gong
    bus.ts                    event bus
  data/content.ts             MOVES, ENEMIES, ABHIMANYU, DOG, QUEST_*, DIALOGUES
  lib/
    missionMeta.ts            REGIONS, MAIN_MISSIONS, buildMissions(), activeMission(), currentObjective(), missionGuide()
    guidance.ts               STEP_GUIDE / SIDE_GUIDE: objective, place, region, 3 hints, route chain; MAP_PLACE, MAP_REGION
    questSfx.ts               UI sound cues
  store/useGameStore.ts       all game state + actions + save/load
```

---

## 4. Characters (canon — do not change)

| Id | Name | Role |
| --- | --- | --- |
| `palakshi` | Palakshi | Only protagonist. Female, black + gold outfit, long black hair, almond eyes. 150 HP, atk 55, def 32, spd 28. Moves: `heroic`, `sparkle`, `focus`, `guard`. Takes 40% reduced damage (not invincible). |
| `mimo` | Mimo | Shih Tzu dog, permanent companion after Mission 1. 90 HP, atk 20, def 14, spd 18. Moves: `bite`, `fetch`, `bark`. Walks behind Palakshi, fights in battle, can dig/sniff. |
| `abhimanyu` | Abhimanyu | Temporary companion during Mission 1 only; carries a **white guitar**; learns Sound Barrier in Lantern Village (breaks the bamboo barrier). 110 HP. Moves: `guitarstrike`, `sonicblast`, `bassdrop`, `solo`, `finalchord`. |
| `bidisha` | Bidisha | Mother, at home; gives Super Potion. |
| `prakriti` | Prakriti | Rival, Mission 2 boss, elegant teal/violet crooked dress. `prakriti_boss`: 160 HP, 2 phases. Also gives the side quest "Prakriti's Ribbon". |
| `arshiya` | Arshiya | Final antagonist, heavy-set teacher at Style Academy. `fashion_teacher`: 420 HP, atk 34, def 40 — tuned so a solo fighter loses; the player must swap Palakshi and Mimo. |
| `kaajal` | Prof. Kaajal | Intro narrator only. |
| `elder` | Elder Shu | Lantern Village quest giver. |

---

## 5. State model (`useGameStore`)

```ts
screen: "title" | "playing" | "credits"
overlay: null | {kind:"dialogue",lines,idx} | {kind:"inventory"} | {kind:"quests"}
       | {kind:"settings"} | {kind:"menu"} | {kind:"battle",enemyId,boss?}
map: MapId; playerX; playerY; playerDir
party: Fighter[]        // [palakshi] then abhimanyu (temp) or mimo
inventory: {id: ItemId, count: number}[]
quests: Quest[]         // "main", "prakriti", "hidden"
flags: Flags
settings: {musicVol, sfxVol, textSpeed}
hasSave, lastAutosave
```

Actions: `setScreen setOverlay openDialogue advanceDialogue setPlayer addItem
removeItem useItem setFlag markHidden markSpoken advanceQuest addQuest
addFighter damage heal setSettings save load reset newGame`.

`advanceDialogue` on the last line emits **`dialogue:end`** on the bus with the
line's `onEnd` string. All story branching hangs off that event in
`WorldScene.handleDialogueEnd` — this decoupling fixes an old race condition and
must be preserved.

`MapId` = bedroom, house, town, route1, forest, village, bamboo, mountain,
temple, garden, cave, academy.

`ItemId` = potion, super_potion, berry, key_scarf, hair_pin, old_photo,
lost_ribbon, sparkle_shard, fashion_pass, lost_scroll, trial_talisman,
village_supplies, sacred_flame_mountain, sacred_flame_garden,
sacred_flame_cave, jade_charm, lantern_oil, mimo_treat, lore_book.

Flags (booleans unless noted): introDone, metMom, metAbhimanyu, abhimanyuJoined,
metPrakriti, ribbonFound, clueToyFound, clueWitnessHeard, cluePawsSeen,
mimoRecognized, prakritiDone, bossDefeated, credits, seenVillage, seenBamboo,
seenMountain, seenTemple, seenGarden, seenCave, villageTalks (number),
villageSupplies, musicianMet, guitarPerformed, elderBriefed, barrierBroken,
scrollFound, trialStarted, trialDone, miniboss1Done, miniboss2Done,
templeOpened, guardianDone, flameMountain, flameGarden, flameCave,
lanternRestored, plus record maps: plates, statues, digs, chests, lore, hidden,
npcSpoken.

Save payload: map, playerX/Y/Dir, party, inventory, quests, flags, settings, ts.
Autosave every 30 s and on every map transition; manual save on F5.

---

## 6. Missions and quest data

### Main quest `main` — "Palakshi's Birthday Adventure"
Steps in order (ids are load-bearing; `guidance.ts` and `missionMeta.ts` key off them):

`wake → mom → abhi → clue_toy → clue_npc → clue_paws → mimo → village → scroll
→ trial → prakriti → temple → flames → lantern → pass → boss`

### Journal grouping (`missionMeta.MAIN_MISSIONS`)
| Mission id | Title | Region | Steps |
| --- | --- | --- | --- |
| m_mimo | Find Mimo | home | wake, mom, abhi, clue_toy, clue_npc, clue_paws, mimo |
| m_village | Lantern Village | village | village |
| m_scroll | The Lost Scroll | bamboo | scroll |
| m_trial | Bamboo Forest Trial | bamboo | trial |
| m_prakriti | Rival: Prakriti | garden | prakriti (boss) |
| m_temple | Temple of Echoes | temple | temple |
| m_flames | Restore the Sacred Lantern | mountain | flames, lantern |
| m_final | Defeat Arshiya | academy | pass, boss (finale) |

Each mission carries `icon`, `region`, `cast`, `rewards[{kind: ability|region|item|lore, label}]`.
Category derives from state: completed / main (started, incomplete) / discovered (locked) / side.

### Side quests
- `prakriti` — Prakriti's Ribbon: accept → ribbon → return.
- `hidden` — Hidden Treasures: h1 home, h2 town, h3 forest, h4 academy.

### Guidance (`lib/guidance.ts`)
For every step id: `{objective, place, region, hints: [vague, clearer, nearly explicit], chain?}`.
The chain is the map route, e.g. scroll → `["Lantern Village","Bamboo Forest","Ancient Shrine","Lost Scroll"]`.
**Rule: any new quest step MUST get a `STEP_GUIDE` entry, or the tracker has no objective/hint.**

---

## 7. World maps

`MapDef = {id, name, indoor, theme, rows, portals, interacts, encounterEnemies?, encounterRate?, bgm?, cinematic?}`.
Tile size 16 px, camera shows 15×11 tiles, `pixelArt: true`.

Tile legend (single chars in `rows`):

```
. grass    , path      g tall grass (encounters)   F flower   w water    t tree
# wall     f floor     b bed  B bookshelf  D desk  T tv  s sign  d door  r rug  _ void
k stone plaza  K stone wall  : gravel  j bamboo  q cherry tree  v petal ground
c cave wall  n cave floor  H house  L lantern post  m stall  % banner  e bridge
o pond  ^ boulder  u statue  z pressure plate  = magic barrier  ! brazier
$ ancient scroll  & sacred lantern  ~ diggable  i inscription  * chest
+ viewpoint  I incense    h hidden pickup  y toy  p paw print
Entity markers (walkable): M N A C P G X R W E Y V O J Q U 1 2 3 4 5
```

| Map | Name | Theme | BGM | Encounters | Highlights |
| --- | --- | --- | --- | --- | --- |
| bedroom | Palakshi's Bedroom | indoor | bgm_home | — | bed, desk, bookshelf, tv, hidden `bedroom_scarf` |
| house | Palakshi's House | indoor | bgm_home | — | `npc_mom` (Bidisha) |
| town | Sparkle Town | outdoor | bgm_town | — | `npc_abhimanyu`, `npc_witness`, townies, hidden `town_pin` |
| route1 | Route 1 | outdoor | bgm_route | wild_bunny, wild_sparrow | `clue_toy`, dig `route1_dig` |
| forest | Whispering Woods | outdoor | bgm_forest | wild_sparrow, forest_wolf | paw trail, `mimo_here` bush, `npc_prakriti`, hidden `forest_berry` |
| village | Lantern Village | village | bgm_village | — | 5 villagers, `npc_elder`, `npc_musician`, `npc_merchant`, lanterns, chest, cinematic |
| bamboo | Bamboo Forest | bamboo | bgm_bamboo | bamboo_spirit, wild_monkey | 2 plates, 2 statues, `barrier`, `scroll`, `npc_miniboss1`, chest, cinematic |
| mountain | Mountain Trail | mountain | bgm_mountain | wild_crane, wild_boar | viewpoint, 2 statues, `flame_mountain`, `npc_miniboss2` |
| temple | Temple of Echoes | temple | bgm_temple | — | 4 plates, 4 statues, `sacred_lantern`, inscriptions, `npc_guardian`, cinematic |
| garden | Cherry Blossom Garden | garden | bgm_garden | garden_moth | Prakriti duel, `flame_garden` |
| cave | Ancient Cave | cave | bgm_cave | cave_bat, cave_serpent | `flame_cave`, chests |
| academy | Style Academy | outdoor | bgm_boss | — | gatekeeper, `npc_boss` Arshiya, hidden item |

Portals support `requiresFlag` + `lockedText` for gated progression.
Region-arrival cinematics: village, bamboo, temple (title + subtitle + flag) — camera pan, gong, then arrival dialogue.

Interaction kinds: sign, bed, desk, bookshelf, tv, npc_* (mom, townie1/2, witness,
abhimanyu, prakriti, gatekeeper, boss, villager1-5, elder, musician, merchant,
monk, guardian, miniboss1, miniboss2), clue_toy, clue_paws, mimo_here, hidden,
stall, lantern, statue, plate, barrier, scroll, flame, sacred_lantern,
inscription, chest, viewpoint, dig, incense.

---

## 8. WorldScene behaviour

- Grid movement (WASD/arrows), 1 tile per ~150 ms tween, 2-frame walk animation.
- **One follower only.** `abhimanyu` while in party, else `mimo`; follower walks the player's previous tile via a `trail` array — never teleports.
- Duplicate-sprite protections (regressions to avoid): `loadMap` destroys the old player/entities and kills tweens first; bus listeners are removed on scene SHUTDOWN; an NPC marker is skipped when that character is already in the party.
- Encounters: stepping on grass tiles with `encounterEnemies` and `encounterRate` starts a wild battle.
- `afterStep` also advances the paw-print clue (`p` tile) the first time.
- `tryInteract` (E / Z / Enter / gamepad A) reads the tile the player faces and dispatches `handleInteract`.
- `handleDialogueEnd(event)` handles: give_super_potion, clue_witness, clue_toy_found, clue_paws_found, abhi_join, mimo_join, start_mimo_battle, mimo_recognize, start_prakriti, prakriti_reward, start_boss, boss_end, barrier_broken, scroll_taken, guitar_learned, village_talk, give_supplies, elder_brief, musician_met.
- **Interaction prompts**: each frame the scene computes the faced interact and emits `bus.emit("prompt", label)`; labels: Talk, Examine clue, Ask Mimo to investigate, Search, Examine, Rest, Begin the fight, Interact. `InteractPrompt.tsx` renders `E`/`A` + label.
- Ambient life: swaying grass/trees, water ripples, butterflies, birds, drifting critters, animated bamboo and blossoms.
- Bus events emitted: `toast`, `cinematic`, `prompt`, `input:lock` (React → Phaser), `dialogue:end` (store → Phaser), `world:reload`.

---

## 9. Battle system (`BattleUI.tsx`)

- Turn order by `spd`; phases `player → enemy → done`.
- Player actions: Fight (move list), Item, Swap (party member), Run (disabled for bosses).
- Damage: `power * atk / def` with variance and crit chance; `heal` moves restore HP; floating damage numbers, screen shake on hit, HP bar tweening.
- Palakshi takes 40% reduced damage in `store.damage`.
- Boss phase 2: at ~50% enemy HP → flash + shake + "ENRAGED" badge, stronger move set. Prakriti: 2 phases. Arshiya: 3 phases (66% / 33% thresholds) and an HP pool that forces swapping.
- Boss UI uses the real `pixel/Portrait` bust for that character — never an animal/placeholder portrait.
- Victory: XP-free (no levelling in MVP), story dialogue via `dialogue:end`, then quest advance; defeat returns to title with the last save intact.

Moves: tackle 10, roast 12, bark 14, critique 18, cheer 18(heal), runway 22,
bite 22, styleslam 26, friendship 26, fetch 28, guitarstrike 30, solo 36(heal),
guard 40(heal), sparkle 40, sonicblast 44, bassdrop 52, focus 55, heroic 70,
finalchord 75.

Enemies: wild_bunny 22, wild_sparrow 28, forest_wolf 40, wild_monkey 46,
garden_moth 50, bamboo_spirit 52, wild_mimo 55, wild_crane 58, cave_bat 62,
wild_boar 74, cave_serpent 88, prakriti_boss 160, boss_sentinel 180,
boss_warden 230, boss_guardian 280, fashion_teacher 420.

---

## 10. Story beats in order

1. **Intro** — Prof. Kaajal explains: it's Palakshi's birthday; three missions.
2. **Bedroom → house** — talk to Bidisha; Mimo is missing; receive Super Potion.
3. **Sparkle Town** — meet Abhimanyu; he joins.
4. **Clue chain** — witness kid in town → red ball on Route 1 → paw prints into the forest.
5. **Whispering Woods** — rustling bush → **wild Mimo battle** (frightened dog) → recognition scene → Mimo joins, Abhimanyu goes home.
6. **Lantern Village** — festival cancelled; villagers, merchant supplies, travelling musician (Abhimanyu learns Sound Barrier), Elder Shu explains Arshiya stole the Sacred Lantern's flame and sends the player for the scroll.
7. **Bamboo Forest** — plates + statues puzzle, sound barrier, recover the **Lost Scroll**.
8. **Bamboo Forest Trial** — light shrine lanterns, plates and statues, defeat the Bamboo Sentinel / Forest Guardian.
9. **Cherry Blossom Garden** — Prakriti duel (2 phases); she yields the Fashion Pass route and the ribbon side quest.
10. **Mountain Trail → Temple of Echoes** — four plates, Temple Guardian, temple wakes.
11. **Three Sacred Flames** — Mountain Shrine, Cherry Blossom Garden, Ancient Cave → restore the Sacred Lantern.
12. **Style Academy** — gatekeeper needs the Fashion Pass → **Arshiya**, 3 phases → she relents → credits → "Happy Birthday, Palakshi ❤️" end screen with Play Again / Main Menu.

---

## 11. UX clarity rules (the current focus)

Terminology is fixed: **Mission**, **Objective**, **Hint**, **Interact** — never quest/goal/tip/use.

- **One active objective.** `MissionTracker` shows mission name, `→` objective, location, and the hint ladder. Locked/future objectives are not shown during exploration; the full ladder lives in the Journey panel.
- **Hint ladder**: `[H]` (or the on-panel button) reveals hint 1 → 2 → 3, never spoiling instantly; resets when the objective changes.
- **Objective completion**: gold flash on the tracker + `questSfx.objective()` (pickup sound), then the next objective slides in.
- **Location card** (`LocationCard`): on every map change show place name, current objective, hint 1 for 3.6 s, then fade.
- **Interaction prompt**: always contextual (`E — Talk`, `A — Ask Mimo to investigate`), never a bare "Interact".
- **Journey panel**: tabs MAIN STORY / SIDE / DISCOVERED / HISTORY; detail pane shows mission name, blurb, WHAT TO DO (objective / WHERE / HINT / ROUTE chain), full objective ladder, characters with portraits, rewards, Sacred Flames tracker, world map with gold marker on the target region and legend (● You, ◆ Mission, 🏯 Location, ⚔️ Boss, ◇ Optional).
- **Mission cinematics**: NEW MISSION and ✓ MISSION COMPLETE cards with petals, gold glow and a short flourish, then straight back to play.
- Dialogue: short lines, one idea per screen, typewriter at `settings.textSpeed`, speaker plate + portrait.
- Clarity beats decoration: no giant panels, no redundant labels, no glow on irrelevant objects.

Gamepad: D-pad/stick navigation, A confirm, B back, LB/RB tab switching — supported in Journey panel, battle and world.

---

## 12. Audio spec (`sound.ts`)

Procedural instrument models: **guzheng** (bright pluck, long decay, grace notes,
glissandi), **pipa** (nasal, tremolo/lunzhi bursts, fast runs), **yangqin**
(double-struck), **erhu** (portamento + vibrato), **dizi** (bright, dimo buzz),
**xiao** (breathy), **sheng** (stacked-fifth pad). Percussion: **dagu** big drum,
**luo** gong, **bangzi** woodblock, **bell**, **muyu**.

Melody uses Chinese pentatonic modes: gong, shang, jue, zhi, yu. No Western
functional harmony, no Japanese/Korean/generic-Asian clichés.

`Track = {root, mode, bpm, beats, lead, counter?, pad?, phrases: Note[][], perc?, wind?, birds?, cave?, gain?}`
where `Note = {d: degree|null, l: beats, o?: "grace"|"gliss"|"trem"|"bend"}` and
`perc` patterns are 8-slot strings per bar (`"1.111.1."`).

Tracks: bgm_title, bgm_home, bgm_town, bgm_route, bgm_forest, bgm_village,
bgm_garden, bgm_bamboo, bgm_mountain, bgm_temple, bgm_cave, bgm_battle,
bgm_mimo, bgm_reunion, bgm_prakriti, bgm_miniboss, bgm_boss, bgm_credits.

Shaolin/Wuxia identity: bamboo is a walking pipa pulse under dizi calls (bpm 76),
temple adds a slow martial dagu + muyu under xiao/erhu (bpm 62), wild battle is
fast pipa tremolo runs with `dagu "1.111.1."` and off-beat bangzi (bpm 156),
Prakriti starts elegant erhu and builds percussion, Arshiya is the heaviest
(bpm 162, gong, full drums, three intensity phases).

API: `playBgm(key, fadeSec=1.2)` crossfades, `fadeOut(sec)`, `stopBgm()`,
`sfx("step"|"menu"|"confirm"|"cancel"|"hit"|"heal"|"win"|"pickup")`, `gong()`,
`setVolumes(music, sfx)`.

**Scheduling invariant:** every scheduled time must be clamped to
`Math.max(at, ctx.currentTime + 0.25)`. Grace/gliss notes schedule up to 0.18 s
early and previously produced negative `setValueAtTime` times at startup.

---

## 13. Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | WASD / arrows | D-pad / left stick |
| Interact / advance | E, Z, Enter, Space | A |
| Cancel / back | Esc, X | B |
| Inventory | I | X |
| Journey (missions) | Q | Y |
| Menu | Esc | Start |
| Hint | H | — (on-panel button) |
| Save | F5 | — |

---

## 14. Remaining MVP work (open backlog)

1. Bamboo Forest Trial objective chain split into explicit sub-objectives (find shrine → activate four lanterns → discover order → light in order → defeat Forest Guardian), each with its own `STEP_GUIDE` entry.
2. Progressive, position-aware hints inside bamboo (before entering / inside / near shrine / near scroll).
3. Lantern puzzle UI panel (order feedback, Chinese-symbol clues).
4. Sacred Flame collection flourish: icon lights, gold glow, particles, bell sound.
5. Mission start / complete cinematic polish and chaining into the next mission.
6. Interactive object highlighting (scroll, sacred lantern, flames only) — small glow + particles.
7. First-time UI tutorial cards: tracker → map → hint, shown once each (needs a `tutorialSeen` flag record).
8. Mission history detail for completed missions (description, objectives, location, characters, rewards) — mostly present, needs the completed-state pass.
9. Final Arshiya approach sequence: darken, lanterns light, petals, FINAL MISSION card.
10. Gamepad coverage audit across every new panel.

## 15. Definition of done

- At any moment the player can answer: where am I, what am I doing, where do I go, how do I get there, what can I interact with, what happens next.
- No placeholder art, no black-box sprites, exactly one Palakshi and one follower on screen.
- Full run playable from title to birthday ending with save/load at any point.
- Music is unmistakably Chinese martial-arts throughout, with smooth crossfades.
- Build and typecheck clean; no console errors during a full playthrough.
