// ---------------------------------------------------------------------------
// UI-only state that is not part of the save: photo mode, the How-to-play
// sheet, the interactable the world says we face, the adaptive quality tier
// the world reports, and the session clock for playtime.
//
// It lives beside the components on purpose: the game store owns the game,
// this owns the chrome around it.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";

export type Near = { kind: string; name: string; x: number; y: number } | null;

type UiState = {
  photoMode: boolean;
  howTo: boolean;
  near: Near;
  /** 0 = full quality, 1 = pixel ratio stepped down, 2 = shadows off (reported by the world). */
  qualityTier: 0 | 1 | 2;
  /** When the current play session started (performance.now()). */
  sessionStart: number;
  /** When playtime was last flushed into settings. */
  playtimeFlushedAt: number;
  setPhotoMode: (v: boolean) => void;
  setHowTo: (v: boolean) => void;
  setNear: (n: Near) => void;
  setQualityTier: (t: 0 | 1 | 2) => void;
  startSession: () => void;
  /** Adds the unflushed session time to settings.playtimeMs. */
  flushPlaytime: () => void;
};

export const useUi = create<UiState>((set, get) => ({
  photoMode: false,
  howTo: false,
  near: null,
  qualityTier: 0,
  sessionStart: 0,
  playtimeFlushedAt: 0,
  setPhotoMode: (v) => set({ photoMode: v }),
  setHowTo: (v) => set({ howTo: v }),
  setNear: (n) => set({ near: n }),
  setQualityTier: (t) => set({ qualityTier: t }),
  startSession: () => {
    const now = performance.now();
    set({ sessionStart: now, playtimeFlushedAt: now });
  },
  flushPlaytime: () => {
    const { playtimeFlushedAt } = get();
    if (!playtimeFlushedAt) return;
    const now = performance.now();
    const add = now - playtimeFlushedAt;
    set({ playtimeFlushedAt: now });
    const gs = useGameStore.getState();
    gs.setSettings({ playtimeMs: Math.round((gs.settings.playtimeMs ?? 0) + add) });
  },
}));

/** Playtime for display: what the save carries plus the unflushed part of this session. */
export function playtimeNow(): number {
  const ui = useUi.getState();
  const base = useGameStore.getState().settings.playtimeMs ?? 0;
  return base + (ui.playtimeFlushedAt ? performance.now() - ui.playtimeFlushedAt : 0);
}

export function formatPlaytime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(total % 60).padStart(2, "0")}s`;
  return `${total}s`;
}

/** True while a media query matches (phones: "(max-width: 760px)"). */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, [query]);
  return on;
}

/** Reduced motion: the setting, or the OS preference when the setting is unset. */
export function useReducedMotion(): boolean {
  const pref = useGameStore((s) => s.settings.reducedMotion);
  if (pref !== undefined) return pref;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
