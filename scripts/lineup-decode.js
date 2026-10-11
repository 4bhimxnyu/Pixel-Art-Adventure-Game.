// Decodes a JSON file of { "<name>": "data:image/png;base64,..." } (as written by
// __lineup.capture() through Playwright's evaluate-to-file) into PNG files next to it.
//   node scripts/lineup-decode.js .playwright-mcp/lineup/shots.json
import fs from "node:fs";
import path from "node:path";
const src = process.argv[2];
if (!src) { console.error("usage: node scripts/lineup-decode.js <shots.json>"); process.exit(1); }
const dir = path.dirname(src);
const json = JSON.parse(fs.readFileSync(src, "utf8"));
let n = 0;
for (const [name, url] of Object.entries(json)) {
  if (typeof url !== "string" || !url.startsWith("data:image/png;base64,")) continue;
  fs.writeFileSync(path.join(dir, name + ".png"), Buffer.from(url.split(",")[1], "base64"));
  n++;
}
console.log("wrote " + n + " png(s) to " + dir);
