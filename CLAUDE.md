# CLAUDE.md

Shaolin Baddie: a wuxia 3D third-person adventure RPG (React 19 + Vite 7, Zustand, Three.js), built in place over the original Phaser pixel game, which still ships as "Classic 2D". Read `README.md` for the full layout.

## Commands

- `npm run dev` — Vite on http://localhost:5173 (`--strictPort` style: if the port is busy an old server is still running and serving the game).
- `npm run build` — `tsc --noEmit` + production build. `noUnusedLocals` is on: unused imports/vars fail the build.
- `vercel --prod --yes` — redeploy production (https://shaolin-baddie.vercel.app). `.vercel/` is gitignored; `vercel.json` has the SPA rewrite.
- Full playthrough test (with the dev server open in a browser console): `await import("/scripts/e2e.js?x="+Date.now()); await window.__e2e.run()` — plays New Game to THE END through the real engine, ~6 min, returns `{ log, fails }`. Never edit `src/` while it runs: Vite HMR reloads the page and kills it.

## Architecture rules

- Story logic lives ONLY in `src/game/story.ts` + `storyFinal.ts` (`StoryController`), shared by the 3D world (`src/world3d/World3D.ts`) and the Phaser scene. Branching hangs off the store's `dialogue:end` bus event; never inline branching in UI components.
- Grid is the truth: `src/game/maps.ts` rows drive collision, portals, encounters and interactables. 1 tile = 1 unit; columns run +x, rows run -z (`Z(row) = -(row + 0.5)`, `ROW(z) = floor(-z)`). A rig at rotation 0 faces +z; heading π is "down" the map.
- `World3D` is a singleton; rigs are keyed by character id; every `loadMap` disposes before building; NPC markers are skipped for party members. This is what prevents duplicate characters — keep it.
- Props are part lists in `src/world3d/props.ts`, drawn as one InstancedMesh per part by `MapBuilder`; use only cached `G.*` geometries and `mat()`/`glow()` materials (never dispose them). Furniture/props that face the player must face -z.
- Characters are procedural rigs from `src/world3d/characters.ts` specs; `public/models/<id>.glb` overrides a rig. Only Abhimanyu may carry an instrument (his white bass). Rigs call `bake()` last; anything animated by scale must sit on its own joint.
- Combat rules stay in `BattleUI.tsx`; it drives the 3D stage via `battle:fx` bus events. Enemy turns are scheduled on the phase only (re-scheduling on callback identity gave Arshiya two attacks per turn).
- Input: `src/input/InputManager.ts` is the single source for keyboard/gamepad/touch; gamepad and touch feed menus through synthetic key events. Escape/I/Q/H belong to the React layer, not the world.
- New quest steps need a `STEP_GUIDE` entry (`lib/guidance.ts`) AND a `STEP_TARGET` entry (`lib/targets.ts`) or the tracker has no hint and the beacon has nowhere to point. Quest steps are only ever appended (saves store the step index).

## Workflow

- Commit each feature/fix separately and `git push origin main` right away (user wants granular history and GitHub contributions), then redeploy if the game changed.
- Verify visually with the Playwright MCP: dev handles are `window.__game` (store, bus) and `window.__world`; teleport with `store.setMap(id,x,y,dir)` + `bus.emit("world:reload")`. Screenshots must be saved under `.playwright-mcp/`.
- Bash heredocs containing the "…" character fail to parse in this environment; write patch scripts with the Write tool instead.
- HMR of `InputManager`/`World3D` can leave the engine on a stale module instance (touch buttons stop working); reload the page before trusting input tests.
