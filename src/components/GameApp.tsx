import { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { bus } from "../game/bus";
import { initAudio, playBgm, setVolumes, stopBgm, loadAudioManifest, currentBgm } from "../game/sound";
import { questSfx } from "../lib/questSfx";
import { useDevice } from "../input/useDevice";

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
import FadeOverlay from "./FadeOverlay";
import TouchControls from "./TouchControls";
import { ThemeKeyframes } from "./pixel/decor";

// Dev-only handle so the game can be driven and inspected from the console.
if (import.meta.env.DEV) {
  (window as any).__game = { store: useGameStore, bus, currentBgm };
}

/** Either renderer, behind one tiny interface. */
type Engine = { destroy(): void };

export default function GameApp() {
  const screen = useGameStore((s) => s.screen);
  const overlay = useGameStore((s) => s.overlay);
  const settings = useGameStore((s) => s.settings);
  const renderer = settings.renderer ?? "3d";
  const device = useDevice();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  // --- engine lifecycle: created once we're actually playing, destroyed on exit.
  // The 3D world is a singleton (World3D.instance); a StrictMode double-mount or a
  // re-render can never leave two worlds, and so never two Palakshis.
  useEffect(() => {
    if (screen !== "playing") {
      engineRef.current?.destroy();
      engineRef.current = null;
      return;
    }
    if (engineRef.current || !mountRef.current) return;
    initAudio();
    let cancelled = false;
    const mount = mountRef.current;
    if (renderer === "classic") {
      import("../game/PhaserGame").then(({ createGame }) => {
        if (cancelled) return;
        const game = createGame(mount);
        engineRef.current = { destroy: () => game.destroy(true) };
      });
    } else {
      import("../world3d/World3D").then(({ World3D }) => {
        if (cancelled) return;
        engineRef.current = new World3D(mount);
      });
    }
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [screen, renderer]);

  // --- volumes
  useEffect(() => {
    setVolumes(settings.musicVol, settings.sfxVol);
  }, [settings.musicVol, settings.sfxVol]);

  // --- the game's own soundtrack (public/audio) or the procedural score
  useEffect(() => {
    void loadAudioManifest().then(() => {
      const s = useGameStore.getState();
      if (s.screen === "title") playBgm("bgm_title", 1.2);
    });
  }, []);

  // --- title / end / credits music
  useEffect(() => {
    if (screen === "title") playBgm("bgm_title", 1.2);
    if (screen === "end") playBgm("bgm_end", 3.0);
    if (screen === "credits") playBgm("bgm_credits", 1.6);
    return () => {
      if (screen === "credits") stopBgm();
    };
  }, [screen]);

  // --- tell the engine to stop reading movement while an overlay is up
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

  // --- device class for responsive CSS
  useEffect(() => {
    document.documentElement.classList.toggle("touch", device.touch);
    document.documentElement.classList.toggle("gamepad", device.kind === "gamepad");
  }, [device.touch, device.kind]);

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

  const classic = renderer === "classic";

  return (
    <div className={`${classic ? "vignette" : ""} relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0a0507]`}>
      <ThemeKeyframes />

      {classic && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 40%, #1a0f14 0%, #0a0507 70%)" }}
        />
      )}

      {/* the world: a Three.js canvas (or the classic Phaser canvas) */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Always-on world UI (the battle layer brings its own cards) */}
      {overlay?.kind !== "battle" && <HUD />}
      <InteractPrompt />
      <LocationCard />
      <MissionCinematic />
      <Toasts />
      {device.touch && <TouchControls />}

      {/* Overlay router */}
      {overlay?.kind === "dialogue" && <DialogueBox />}
      {overlay?.kind === "battle" && <BattleUI />}
      {overlay?.kind === "inventory" && <InventoryPanel />}
      {overlay?.kind === "quests" && <JourneyPanel />}
      {overlay?.kind === "menu" && <MenuPanel />}
      {overlay?.kind === "settings" && <SettingsPanel />}

      <FadeOverlay />
    </div>
  );
}
