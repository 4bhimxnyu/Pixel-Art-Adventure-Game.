import { useEffect, useState } from "react";
import { input, isTouchDevice, type DeviceKind } from "./InputManager";

export type Device = { kind: DeviceKind; touch: boolean; gamepad: boolean };

/** Which input the player is using right now — drives prompt glyphs and layout. */
export function useDevice(): Device {
  const [kind, setKind] = useState<DeviceKind>(() => (isTouchDevice() ? "touch" : input.device));
  const [gamepad, setGamepad] = useState(input.gamepadConnected);
  useEffect(() => {
    const off = input.onDevice((d) => {
      setKind(d);
      setGamepad(input.gamepadConnected);
    });
    const on = () => setGamepad(true);
    const offPad = () => setGamepad(input.gamepadConnected);
    window.addEventListener("gamepadconnected", on);
    window.addEventListener("gamepaddisconnected", offPad);
    return () => {
      off();
      window.removeEventListener("gamepadconnected", on);
      window.removeEventListener("gamepaddisconnected", offPad);
    };
  }, []);
  return { kind, touch: isTouchDevice() || kind === "touch", gamepad };
}

/** The glyph for an action on the current device. */
export function glyph(action: "interact" | "cancel" | "menu" | "items" | "quests" | "hint" | "sniff" | "dodge" | "save" | "look" | "move", kind: DeviceKind) {
  if (kind === "gamepad") {
    return { interact: "A", cancel: "B", menu: "☰", items: "X", quests: "Y", hint: "LB", sniff: "RB", dodge: "B", save: "", look: "R-stick", move: "L-stick" }[action];
  }
  if (kind === "touch") {
    return { interact: "●", cancel: "✕", menu: "☰", items: "▣", quests: "◆", hint: "?", sniff: "🐾", dodge: "↯", save: "", look: "drag", move: "joystick" }[action];
  }
  return { interact: "E", cancel: "X", menu: "Esc", items: "I", quests: "Q", hint: "H", sniff: "F", dodge: "Shift", save: "F5", look: "Drag", move: "WASD" }[action];
}
