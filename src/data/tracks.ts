// ---------------------------------------------------------------------------
// What the radio dial shows for each track in public/audio. Keyed by the file
// name without its extension. A track that is not listed shows "Track N".
// ---------------------------------------------------------------------------

export type TrackInfo = { title: string; artist?: string };

export const TRACK_INFO: Record<string, TrackInfo> = {
  "game 1": { title: "Game 1" },
  "game 2": { title: "Game 2" },
  "game 3": { title: "Game 3" },
  photograph: { title: "Photograph", artist: "Ed Sheeran" },
};
