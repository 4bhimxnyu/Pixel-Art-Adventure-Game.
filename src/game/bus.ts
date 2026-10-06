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
  | "tutorial";

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
