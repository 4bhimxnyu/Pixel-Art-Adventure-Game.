/** Minimal typed event bus bridging React <-> Phaser. */
export type BusEvent =
  | "toast"
  | "cinematic"
  | "prompt"
  | "input:lock"
  | "dialogue:end"
  | "world:reload"
  | "flame:collected"
  | "objective:done"
  | "puzzle"
  | "battle:end"
  | "battle:fx"
  | "fade"
  | "mimo:ping"
  | "hint:next"
  | "stuck"
  | "unstuck"
  | "help:direction"
  | "tutorial"
  // --- UI <-> world contract added for the experience pass
  /** world -> UI: the interactable the player is facing / standing near, or null. { kind, name, x, y } */
  | "near"
  /** UI <-> world: photo mode on/off (UI hides itself, world frees the camera). payload: boolean */
  | "photo:mode"
  /** UI -> world: snap the camera back behind the player */
  | "camera:recenter"
  /** UI -> world: save the current frame as a PNG download */
  | "world:snapshot"
  /** world -> UI: adaptive quality stepped down. payload: 0 | 1 | 2 */
  | "quality:tier";

type Handler = (payload?: any) => void;

const handlers: Record<string, Set<Handler>> = {};

export const bus = {
  on(event: BusEvent, fn: Handler) {
    (handlers[event] ||= new Set()).add(fn);
    return () => bus.off(event, fn);
  },
  off(event: BusEvent, fn: Handler) {
    handlers[event]?.delete(fn);
  },
  emit(event: BusEvent, payload?: any) {
    handlers[event]?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] handler for "${event}" failed`, err);
      }
    });
  },
  clear(event: BusEvent) {
    handlers[event]?.clear();
  },
};
