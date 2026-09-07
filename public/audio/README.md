# Custom music

The game ships with a complete procedural score and needs no audio files. This
folder is optional: anything you list here plays **instead of** the synthesised
track of the same name.

## How

1. Drop an audio file in this folder, e.g. `public/audio/my-theme.mp3`
   (`.mp3`, `.ogg`, `.m4a` and `.wav` all work).
2. Add it to `manifest.json`, mapping a cue name to the filename:

```json
{
  "bgm_title": "my-theme.mp3",
  "bgm_town": "my-theme.mp3"
}
```

3. Reload. Anything not listed keeps using the procedural score, so you can
   replace one cue or all of them.

Files are looped and routed through the same music bus as the synth, so the
music volume slider and the crossfades between areas keep working.

## Cue names

```
bgm_title    bgm_home     bgm_town      bgm_route     bgm_forest
bgm_village  bgm_bamboo   bgm_mountain  bgm_temple    bgm_garden
bgm_cave     bgm_battle   bgm_mimo      bgm_reunion   bgm_prakriti
bgm_miniboss bgm_boss     bgm_credits
```

## Before you add a commercial track

Deploying this site publishes whatever is in this folder to anyone with the URL,
including on a free Netlify subdomain. Use music you have the right to
distribute — something you made, a track licensed for the purpose, or one
released under a licence that permits it. A commercial release like Enigma's
"Sadeness (Part I)" is not one of those, however small the site is.

If you only want it for yourself, keep the file here locally and run the game
with `npm run dev` without committing or deploying it — add the filename to
`.gitignore` and it will never leave your machine.
