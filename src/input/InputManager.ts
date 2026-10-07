// ---------------------------------------------------------------------------
// One input surface for keyboard + mouse, gamepad and touch.
//
// The world polls `input.state` each frame for movement / look / actions.
// Menus and dialogue keep listening for keyboard events as they always have;
// the gamepad and touch buttons are translated into synthetic key events for
// them, so every existing panel works on every device with no changes.
// ---------------------------------------------------------------------------

export type Action = "interact" | "cancel" | "menu" | "items" | "quests" | "hint" | "sniff" | "dodge" | "save" | "map" | "unstuck";

export type InputState = {
  /** Movement on the ground: x = right, y = forward, length ≤ 1. */
  move: { x: number; y: number };
  /** Look delta this frame in radians (already scaled). */
  look: { x: number; y: number };
  /** Zoom delta this frame. */
  zoom: number;
  /** Actions pressed this frame (edge). */
  pressed: Set<Action>;
  /** Actions currently held. */
  held: Set<Action>;
  lookActive: boolean;
};

export type DeviceKind = "keyboard" | "gamepad" | "touch";

type Listener = (d: DeviceKind) => void;

// Escape / I / Q / H stay with the React layer (GameApp, MissionTracker), which
// already handles them for both renderers. The world only takes world actions.
const KEY_ACTION: Record<string, Action> = {
  e: "interact", E: "interact", z: "interact", Z: "interact", Enter: "interact", " ": "interact",
  x: "cancel", X: "cancel",
  f: "sniff", F: "sniff", Shift: "dodge", F5: "save", m: "map", M: "map", r: "unstuck", R: "unstuck",
};

/** Standard gamepad mapping: button index → synthetic key when a menu is up. */
const PAD_MENU_KEY: Record<number, string> = {
  0: "e",       // A → confirm / interact
  1: "Escape",  // B → back
  2: "i",       // X → items
  3: "q",       // Y → missions
  9: "Escape",  // Start → menu
  12: "ArrowUp", 13: "ArrowDown", 14: "ArrowLeft", 15: "ArrowRight",
  4: "ArrowLeft", 5: "ArrowRight", // bumpers: tabs
};

const PAD_WORLD_ACTION: Record<number, Action> = {
  0: "interact", 1: "dodge", 2: "items", 3: "quests", 9: "menu", 8: "unstuck",
  4: "hint", 5: "sniff", 13: "sniff",
};

/** Radial dead zone with re-scaling, so small tilts walk slowly and the rim is full speed. */
function stick(x: number, y: number, dead = 0.16): [number, number] {
  const len = Math.hypot(x, y);
  if (len < dead) return [0, 0];
  const k = Math.min(1, (len - dead) / (1 - dead)) / len;
  return [x * k, y * k];
}

class InputManager {
  readonly state: InputState = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    zoom: 0,
    pressed: new Set(),
    held: new Set(),
    lookActive: false,
  };
  private keys = new Set<string>();
  private pressedQueue = new Set<Action>();
  private mouseDown = false;
  private mouseDelta = { x: 0, y: 0 };
  private wheel = 0;
  private padButtons: boolean[] = [];
  private padConnected = false;
  private lastDevice: DeviceKind = "keyboard";
  private listeners = new Set<Listener>();
  /** Set by TouchControls. */
  touch = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, active: false, lookActive: false };
  /** True while a React overlay is open — the world ignores actions, menus get keys. */
  overlayOpen = false;
  lookSens = 1;
  invertY = false;
  private bound = false;
  private canvas: HTMLElement | null = null;
  private padMenuRepeat: Record<number, number> = {};

  bind(canvas: HTMLElement) {
    if (this.bound) return;
    this.bound = true;
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("gamepadconnected", this.onPad);
    window.addEventListener("gamepaddisconnected", this.onPadOff);
    window.addEventListener("touchstart", this.onTouch, { passive: true });
    const pads = navigator.getGamepads?.() ?? [];
    this.padConnected = Array.from(pads).some((p) => !!p);
  }

  unbind() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas?.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas?.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("gamepadconnected", this.onPad);
    window.removeEventListener("gamepaddisconnected", this.onPadOff);
    window.removeEventListener("touchstart", this.onTouch);
    this.keys.clear();
    this.canvas = null;
  }

  get device() {
    return this.lastDevice;
  }
  get gamepadConnected() {
    return this.padConnected;
  }

  onDevice(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private setDevice(d: DeviceKind) {
    if (this.lastDevice === d) return;
    this.lastDevice = d;
    this.listeners.forEach((l) => l(d));
  }

  /** Called by touch buttons and gamepad: either a world action or a menu key. */
  press(action: Action) {
    this.pressedQueue.add(action);
  }

  /** Synthetic key for the React overlays (dialogue, menus, battle). */
  sendKey(key: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }

  // ----------------------------------------------------------------- events

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.isTrusted) this.setDevice("keyboard");
    if (e.repeat) return;
    this.keys.add(e.key);
    if (e.key === "Shift") this.keys.add("Shift");
    const a = KEY_ACTION[e.key];
    if (a && !this.overlayOpen) {
      this.pressedQueue.add(a);
      if (["e", "E", "z", "Z", "Enter", " ", "f", "F", "m", "M"].includes(e.key)) e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.mouseDown = true;
      this.setDevice("keyboard");
    }
  };
  private onMouseUp = () => {
    this.mouseDown = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.mouseDown || this.overlayOpen) return;
    this.mouseDelta.x += e.movementX;
    this.mouseDelta.y += e.movementY;
  };
  private onWheel = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };
  private onTouch = () => this.setDevice("touch");
  private onPad = () => {
    this.padConnected = true;
    this.setDevice("gamepad");
  };
  private onPadOff = () => {
    const pads = navigator.getGamepads?.() ?? [];
    this.padConnected = Array.from(pads).some((p) => !!p);
    if (!this.padConnected) this.setDevice("keyboard");
  };

  // ------------------------------------------------------------------ poll

  /** Call once per frame before reading `state`. */
  poll(dt: number) {
    const s = this.state;
    s.pressed.clear();
    s.held.clear();
    s.look.x = 0;
    s.look.y = 0;
    s.zoom = 0;
    s.lookActive = false;

    // keyboard move
    let mx = 0;
    let my = 0;
    const k = this.keys;
    if (k.has("a") || k.has("A") || k.has("ArrowLeft")) mx -= 1;
    if (k.has("d") || k.has("D") || k.has("ArrowRight")) mx += 1;
    if (k.has("w") || k.has("W") || k.has("ArrowUp")) my += 1;
    if (k.has("s") || k.has("S") || k.has("ArrowDown")) my -= 1;
    if (k.has("Shift")) s.held.add("dodge");

    // mouse look (hold button and drag)
    if (this.mouseDelta.x || this.mouseDelta.y) {
      s.look.x += this.mouseDelta.x * 0.0042 * this.lookSens;
      s.look.y += this.mouseDelta.y * 0.0030 * this.lookSens * (this.invertY ? -1 : 1);
      s.lookActive = true;
      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;
    }
    if (this.wheel) {
      s.zoom += this.wheel * 0.6;
      this.wheel = 0;
    }

    // gamepad
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => !!p) ?? null;
    if (pad) {
      const [ax, ay] = stick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const [rx0, ry0] = stick(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 0.2);
      // a gentle response curve: precise near the centre, quick at the rim
      const rx = Math.sign(rx0) * rx0 * rx0;
      const ry = Math.sign(ry0) * ry0 * ry0;
      if (ax || ay || rx || ry) this.setDevice("gamepad");
      mx += ax;
      my -= ay;
      if (pad.buttons[14]?.pressed) mx -= 1;
      if (pad.buttons[15]?.pressed) mx += 1;
      if (pad.buttons[12]?.pressed) my += 1;
      if (pad.buttons[13]?.pressed) my -= 1;
      if (rx || ry) {
        s.look.x += rx * 3.0 * dt * this.lookSens;
        s.look.y += ry * 2.0 * dt * this.lookSens * (this.invertY ? -1 : 1);
        s.lookActive = true;
      }
      if (pad.buttons[6]?.pressed) s.zoom -= 2 * dt;
      if (pad.buttons[7]?.pressed) s.zoom += 2 * dt;
      pad.buttons.forEach((b, i) => {
        const was = this.padButtons[i] ?? false;
        const now = b.pressed;
        this.padButtons[i] = now;
        if (now) this.setDevice("gamepad");
        if (this.overlayOpen) {
          // menus: edge + slow repeat on the d-pad
          const key = PAD_MENU_KEY[i];
          if (!key) return;
          if (now && !was) {
            this.sendKey(key);
            this.padMenuRepeat[i] = 0.45;
          } else if (now && was && i >= 12) {
            this.padMenuRepeat[i] = (this.padMenuRepeat[i] ?? 0) - dt;
            if (this.padMenuRepeat[i] <= 0) {
              this.sendKey(key);
              this.padMenuRepeat[i] = 0.14;
            }
          }
          return;
        }
        if (now && !was) {
          const a = PAD_WORLD_ACTION[i];
          if (a) this.pressedQueue.add(a);
        }
        if (now && i === 1) s.held.add("dodge");
      });
      // menu stick → arrow keys (edge, with repeat)
      if (this.overlayOpen) {
        const dir = ay < -0.6 ? 12 : ay > 0.6 ? 13 : ax < -0.6 ? 14 : ax > 0.6 ? 15 : -1;
        const prev = this.padButtons[100] as unknown as number | undefined;
        if (dir !== -1 && dir !== prev) {
          this.sendKey(PAD_MENU_KEY[dir]);
          this.padMenuRepeat[100] = 0.4;
        } else if (dir !== -1) {
          this.padMenuRepeat[100] = (this.padMenuRepeat[100] ?? 0) - dt;
          if (this.padMenuRepeat[100] <= 0) {
            this.sendKey(PAD_MENU_KEY[dir]);
            this.padMenuRepeat[100] = 0.14;
          }
        }
        (this.padButtons as unknown as number[])[100] = dir;
      }
    }

    // touch
    if (this.touch.active) {
      mx += this.touch.move.x;
      my += this.touch.move.y;
      if (this.touch.lookActive) {
        s.look.x += this.touch.look.x * 0.0045 * this.lookSens;
        s.look.y += this.touch.look.y * 0.0032 * this.lookSens * (this.invertY ? -1 : 1);
        s.lookActive = true;
        this.touch.look.x = 0;
        this.touch.look.y = 0;
      }
      if (this.touch.move.x || this.touch.move.y) this.setDevice("touch");
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    s.move.x = mx;
    s.move.y = my;

    if (!this.overlayOpen) {
      for (const a of this.pressedQueue) s.pressed.add(a);
    }
    this.pressedQueue.clear();
  }
}

export const input = new InputManager();

/**
 * True when the PRIMARY pointer is a finger (phones, tablets). A touchscreen
 * laptop keeps its mouse/keyboard layout until the player actually touches
 * the screen, which switches the live device to "touch".
 */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
  return coarse && !fine;
}
