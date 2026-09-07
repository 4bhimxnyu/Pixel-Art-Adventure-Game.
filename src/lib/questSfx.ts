import { sfx, gong } from "../game/sound";

/** Named UI cues so components never guess which raw sfx to fire. */
export const questSfx = {
  /** An objective just completed. */
  objective() {
    sfx("pickup");
  },
  /** A new mission card appears. */
  missionStart() {
    gong();
  },
  /** A mission completed card appears. */
  missionComplete() {
    sfx("win");
  },
  /** Hint ladder advanced. */
  hint() {
    sfx("menu");
  },
  panelOpen() {
    sfx("open");
  },
  panelClose() {
    sfx("cancel");
  },
  select() {
    sfx("menu");
  },
  confirm() {
    sfx("confirm");
  },
  flame() {
    sfx("win");
    gong();
  },
  denied() {
    sfx("error");
  },
};
