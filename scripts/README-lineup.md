# Character line-up harness

With `npm run dev` running and a game started (teleport to the clean stage first: `__game.store.getState().setMap("village", 1, 1, "down"); __game.bus.emit("world:reload")`), paste into the browser console: `await import("/scripts/lineup.js?x=" + Date.now()); __lineup.hideUI(true); await __lineup.frame("palakshi", "face")` and screenshot the canvas; `__lineup.frame(id, "face" | "full" | "side")` reframes on any id in `__lineup.ids`, `__lineup.clear()` puts everything back.

Batch: `const shots = await __lineup.capture(["face", "full"])` returns `{ "<id>-<mode>": dataURL }` for every character; save it as JSON (Playwright `browser_evaluate` with `filename`) and run `node scripts/lineup-decode.js .playwright-mcp/lineup/shots.json` to get one PNG per shot next to it.
