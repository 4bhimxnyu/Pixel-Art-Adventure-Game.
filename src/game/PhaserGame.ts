import Phaser from "phaser";
import { WorldScene } from "./WorldScene";
import { TILE } from "./textures";

/** Camera shows 15x11 tiles. */
export const VIEW_W = TILE * 15;
export const VIEW_H = TILE * 11;

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#0a0507",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { gamepad: true },
    physics: { default: "arcade", arcade: { debug: false } },
    scene: [WorldScene],
  });
}
