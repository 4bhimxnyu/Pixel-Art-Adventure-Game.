import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { useGameStore } from "../store/useGameStore";
import { bus } from "../game/bus";
import { createGame } from "../game/PhaserGame";
import { initAudio, playBgm, setVolumes, stopBgm, loadAudioManifest } from "../game/sound";
import { questSfx } from "../lib/questSfx";

import TitleScreen from "./TitleScreen";
import HUD from "./HUD";
import DialogueBox from "./DialogueBox";
import BattleUI from "./BattleUI";
import InventoryPanel from "./InventoryPanel";
import JourneyPanel from "./JourneyPanel";
import MenuPanel from "./MenuPanel";
import SettingsPanel from "./SettingsPanel";
import Toasts from "./Toasts";
import CreditsRoll from "./CreditsRoll";
import TheEnd from "./TheEnd";
import MissionCinematic from "./MissionCinematic";
import LocationCard from "./LocationCard";
import InteractPrompt from "./InteractPrompt";
import { ThemeKeyframes } from "./pixel/decor";

// Dev-only handle so the game can be driven and inspected from the console.
if (import.meta.env.DEV) {
  (window as any).__game = { store: useGameStore, bus };
}

export default function GameApp() {
  const screen = useGameStore((s) => s.screen);
  const overlay = useGameStore((s) => s.overlay);
  const settings = useGameStore((s) => s.settings);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // --- Phaser lifecycle: created once we're actually playing, destroyed on exit
  useEffect(() => {
    if (screen !== "playing") {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      return;
    }
    if (gameRef.current || !mountRef.current) return;
    initAudio();
    gameRef.current = createGame(mountRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [screen]);

  // --- volumes
  useEffect(() => {
    setVolumes(settings.musicVol, settings.sfxVol);
  }, [settings.musicVol, settings.sfxVol]);

  // --- optional user-supplied music (public/audio/manifest.json)
  useEffect(() => {
    void loadAudioManifest();
  }, []);

  // --- title / credits music
  useEffect(() => {
    if (screen === "title") playBgm("bgm_title", 1.2);
    if (screen === "end") playBgm("bgm_end", 3.0);
    if (screen === "credits") playBgm("bgm_credits", 1.6);
    return () => {
      if (screen === "credits") stopBgm();
    };
  }, [screen]);

  // --- tell Phaser to stop reading movement while an overlay is up
  useEffect(() => {
    bus.emit("input:lock", !!overlay);
  }, [overlay]);

  // --- global hotkeys that belong to the React layer
  useEffect(() => {
    if (screen !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const s = useGameStore.getState();
      const ov = s.overlay;
      if (ov?.kind === "battle") return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (ov) {
          if (ov.kind === "dialogue") return;
          questSfx.panelClose();
          s.setOverlay(null);
        } else {
          questSfx.panelOpen();
          s.setOverlay({ kind: "menu" });
        }
        return;
      }
      if (ov) return;
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        questSfx.panelOpen();
        s.setOverlay({ kind: "inventory" });
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        questSfx.panelOpen();
        s.setOverlay({ kind: "quests" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  // --- autosave every 30s
  useEffect(() => {
    if (screen !== "playing") return;
    const t = window.setInterval(() => useGameStore.getState().save(), 30000);
    return () => window.clearInterval(t);
  }, [screen]);

  if (screen === "title") {
    return (
      <>
        <ThemeKeyframes />
        <TitleScreen />
      </>
    );
  }

  if (screen === "end") {
    return (
      <>
        <ThemeKeyframes />
        <TheEnd />
      </>
    );
  }

  if (screen === "credits") {
    return (
      <>
        <ThemeKeyframes />
        <CreditsRoll />
      </>
    );
  }

  return (
    <div className="vignette relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0a0507]">
      <ThemeKeyframes />

      {/* The canvas letterboxes on wide screens; this makes the surround feel
          deliberate rather than like empty black bars. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0f14 0%, #0a0507 70%)" }}
      />

      {/* Phaser canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Always-on world UI */}
      <HUD />
      <InteractPrompt />
      <LocationCard />
      <MissionCinematic />
      <Toasts />

      {/* Overlay router */}
      {overlay?.kind === "dialogue" && <DialogueBox />}
      {overlay?.kind === "battle" && <BattleUI />}
      {overlay?.kind === "inventory" && <InventoryPanel />}
      {overlay?.kind === "quests" && <JourneyPanel />}
      {overlay?.kind === "menu" && <MenuPanel />}
      {overlay?.kind === "settings" && <SettingsPanel />}
    </div>
  );
}
