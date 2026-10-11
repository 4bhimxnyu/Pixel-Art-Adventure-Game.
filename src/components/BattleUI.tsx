// ---------------------------------------------------------------------------
// Turn-based battle. Turn order by spd; phases player -> enemy -> done.
//
// The rules live here, unchanged from the 2D game. The FIELD is now the 3D
// world itself: this component is a transparent layer with the two status
// cards and the command bar, and it tells the world what to animate through
// `battle:fx` bus events (attack / heal / swap / enrage / ko / win / lose).
// In the classic renderer the same layout sits over the pixel canvas.
// Bosses gain phases at HP thresholds with a stronger move set, and Arshiya's
// HP pool is tuned so a solo fighter cannot outlast her — you must swap.
//
// Presentation: floating numbers, eased HP bars with a damage ghost, a turn
// banner, move details on focus, and a result panel the player dismisses.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { ENEMIES, MOVES, ITEMS, type MoveId, type ItemId } from "../data/content";
import { bus } from "../game/bus";
import { playBgm, sfx, setIntensity, gong } from "../game/sound";
import { CharacterPortrait } from "./pixel/Portrait";
import { useDevice, glyph } from "../input/useDevice";
import { useReducedMotion } from "./uiState";

const fx = (p: { kind: string; side?: "player" | "enemy"; crit?: boolean; fighterId?: string }) => bus.emit("battle:fx", p);

type Menu = "root" | "fight" | "item" | "swap";
type FloatKind = "dmg" | "crit" | "heal" | "miss";
type Float = { id: number; text: string; side: "enemy" | "player"; kind: FloatKind; jitter: number };

const ROOT_ACTIONS = ["FIGHT", "ITEM", "SWAP", "RUN"] as const;
const ROOT_HINT: Record<(typeof ROOT_ACTIONS)[number], string> = {
  FIGHT: "Pick a move.",
  ITEM: "Use a healing item on the fighter in front.",
  SWAP: "Tag in a benched fighter. Costs the turn.",
  RUN: "Try to slip away (not from a boss).",
};
/** roll() crits 11% of the time; shown so the move card tells the truth. */
const CRIT_PCT = 11;

export default function BattleUI() {
  const overlay = useGameStore((s) => s.overlay);
  const party = useGameStore((s) => s.party);
  const inventory = useGameStore((s) => s.inventory);
  const classic = useGameStore((s) => s.settings.renderer === "classic");
  const device = useDevice();
  const reduced = useReducedMotion();

  const enemyId = overlay?.kind === "battle" ? overlay.enemyId : "wild_bunny";
  const enemy = ENEMIES[enemyId] ?? ENEMIES.wild_bunny;
  const isBoss = !!enemy.boss;

  const [enemyHp, setEnemyHp] = useState(enemy.hp);
  const [phase, setPhase] = useState<"intro" | "player" | "enemy" | "done">("intro");
  const [menu, setMenu] = useState<Menu>("root");
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [log, setLog] = useState<string[]>([`${enemy.name} blocks the way!`]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [shake, setShake] = useState<"enemy" | "player" | null>(null);
  const [enrage, setEnrage] = useState(0);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const [resultShown, setResultShown] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: "player" | "enemy" | "warn"; key: number } | null>(null);
  const floatId = useRef(0);
  const settled = useRef(false);
  const stats = useRef({ turns: 0, dealt: 0, taken: 0, crits: 0, items: 0, swaps: 0 });
  /**
   * Arshiya reads the fighter in front of her. Every hit she lands on the same
   * fighter deepens that read and multiplies her damage against them; the read
   * fades again while that fighter is benched. One fighter alone therefore
   * cannot outlast her — you have to rotate Palakshi and Mimo, and the tempo of
   * the rotation is the fight. Tracked per party member, not globally.
   */
  const [readStacks, setReadStacks] = useState<number[]>(() => party.map(() => 0));
  /**
   * Turns of "tag cover" left: for two turns after a swap the incoming fighter
   * is covered by their partner and takes 30% less. It is the only reason the
   * fragile Mimo can stand in front of Arshiya at all, and it is what makes
   * rotating strictly better than digging in.
   */
  const [cover, setCover] = useState(0);
  const reads = enemy.id === "fashion_teacher";
  const activeRead = readStacks[active] ?? 0;

  const healers = useMemo(() => inventory.filter((i) => ITEMS[i.id].heal), [inventory]);
  const activeFighter = party[active] ?? party[0];

  // ------------------------------------------------------------------ setup
  useEffect(() => {
    playBgm(enemy.bgm ?? "bgm_battle", 0.5);
    setIntensity(isBoss ? 0.7 : 0.5);
    if (isBoss) gong();
    const t = window.setTimeout(() => {
      // Turn order by speed.
      const first = enemy.spd > (party[0]?.spd ?? 0) ? "enemy" : "player";
      setPhase(first as "player" | "enemy");
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushLog = useCallback((line: string) => {
    setLog((l) => [...l.slice(-3), line]);
  }, []);

  const addFloat = useCallback((text: string, side: Float["side"], kind: FloatKind = "dmg") => {
    const id = ++floatId.current;
    const jitter = (Math.random() - 0.5) * 36;
    setFloats((f) => [...f, { id, text, side, kind, jitter }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
  }, []);

  const showBanner = useCallback((text: string, tone: "player" | "enemy" | "warn") => {
    setBanner({ text, tone, key: Date.now() });
  }, []);

  /**
   * power * atk / def. The 2.0 factor sets the pace of EVERY fight in the game
   * at once: bosses land around 6-10 attacking turns, wild encounters are over
   * in one or two. It was 2.6, which dragged the finale past twenty turns.
   */
  const roll = (power: number, atk: number, def: number) => {
    const base = (power * atk) / Math.max(10, def * 2.0);
    const variance = 0.85 + Math.random() * 0.3;
    const crit = Math.random() < 0.11;
    return { dmg: Math.max(1, Math.round(base * variance * (crit ? 1.6 : 1))), crit };
  };

  // ------------------------------------------------------------- resolution

  /** The result panel's Continue: closes the layer and hands the result to the story. */
  const leave = useCallback(
    (won: boolean) => {
      useGameStore.getState().setOverlay(null);
      bus.emit("battle:end", { enemyId, won });
    },
    [enemyId]
  );

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return;
      settled.current = true;
      setOutcome(won ? "win" : "lose");
      setPhase("done");
      fx({ kind: won ? "win" : "lose" });
      if (won) sfx("win");
      window.setTimeout(() => setResultShown(true), won ? 900 : 1200);
    },
    []
  );

  const enemyTurn = useCallback(() => {
    const s = useGameStore.getState();
    const living = s.party.map((p, i) => ({ p, i })).filter((x) => x.p.hp > 0);
    if (!living.length) return finish(false);

    const pool = enrage > 0 && enemy.rageMoves ? enemy.rageMoves : enemy.moves;
    const mv = MOVES[pool[Math.floor(Math.random() * pool.length)]];
    // She attacks whoever is standing in front of her. A benched fighter is out
    // of reach — that is the whole point of swapping.
    const target = living.find((x) => x.i === active) ?? living[0];

    // Phase scaling, plus Arshiya's read on the fighter she keeps hitting.
    const tgtRead = readStacks[target.i] ?? 0;
    // The read only runs away with you while you actually have someone to tag
    // in. If your partner is down, staying in is forced, so cap it — losing a
    // partner should make the fight hard, not unwinnable with no way out.
    const canSwap = s.party.some((p, i) => i !== target.i && p.hp > 0);
    const readMult = reads ? Math.min(canSwap ? 2.5 : 1.6, 1 + 0.3 * tgtRead) : 1;
    const atk = enemy.atk * (1 + 0.3 * enrage) * readMult;
    const hit = roll(mv.power, atk, target.p.def);
    const crit = hit.crit;
    let dmg = hit.dmg;
    const covered = reads && cover > 0 && target.i === active;
    if (covered) dmg = Math.round(dmg * 0.7);
    fx({ kind: "attack", side: "enemy", crit });
    const dealt = s.damage(target.i, dmg);
    stats.current.taken += dealt;
    addFloat(`-${dealt}`, "player", crit ? "crit" : "dmg");
    if (covered) window.setTimeout(() => addFloat("covered", "player", "miss"), 180);
    setShake("player");
    sfx("hit");
    pushLog(`${enemy.name} used ${mv.name}${crit ? " — a critical hit!" : "."}`);
    if (reads) {
      setCover((c) => Math.max(0, c - 1));
      const deepened = Math.min(8, (readStacks[target.i] ?? 0) + 1);
      // The fighter she just hit is read harder; benched fighters shake it off
      // and catch their breath.
      setReadStacks((cur) => cur.map((v, i) => (i === target.i ? Math.min(8, v + 1) : Math.max(0, v - 2))));
      s.party.forEach((f, i) => {
        if (i !== target.i && f.hp > 0 && f.hp < f.maxHp) s.heal(i, Math.ceil(f.maxHp * 0.1));
      });
      if (deepened === 2) pushLog("She has your measure. SWAP — a benched fighter recovers.");
      else if (deepened > 2) pushLog(`Her read on ${target.p.name} deepens (x${deepened}).`);
    }
    window.setTimeout(() => setShake(null), 280);

    window.setTimeout(() => {
      const s2 = useGameStore.getState();
      if (!s2.party.some((p) => p.hp > 0)) return finish(false);
      // If the current fighter went down, move to someone standing.
      if (s2.party[active]?.hp <= 0) {
        fx({ kind: "ko", side: "player" });
        const next = s2.party.findIndex((p) => p.hp > 0);
        setActive(next);
        fx({ kind: "swap", fighterId: s2.party[next].id });
        pushLog(`${s2.party[next].name} steps forward.`);
      }
      setPhase("player");
      setMenu("root");
      setCursor(0);
    }, 720);
  }, [active, addFloat, cover, enemy, enrage, finish, readStacks, pushLog, reads]);

  /**
   * One enemy action per enemy phase. The turn is scheduled on the PHASE only:
   * enemyTurn's own state updates (Arshiya's read stacks, tag cover) used to
   * re-create the callback mid-turn and schedule it a second time, which gave
   * her two attacks for every one of yours.
   */
  const enemyTurnRef = useRef(enemyTurn);
  enemyTurnRef.current = enemyTurn;
  useEffect(() => {
    if (phase !== "enemy") return;
    const t = window.setTimeout(() => enemyTurnRef.current(), 620);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Turn banner: presentation only, keyed on the phase.
  useEffect(() => {
    if (phase === "player") {
      stats.current.turns += 1;
      showBanner(`${(useGameStore.getState().party[active] ?? party[0])?.name ?? "Your"}'s turn`, "player");
    } else if (phase === "enemy") {
      showBanner(reads ? `${enemy.name} reads you` : `${enemy.name} moves`, "enemy");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const checkEnemyPhase = useCallback(
    (hp: number) => {
      const pct = hp / enemy.hp;
      const total = enemy.phases ?? 1;
      let want = 0;
      if (total === 2 && pct <= 0.5) want = 1;
      if (total === 3) {
        if (pct <= 0.33) want = 2;
        else if (pct <= 0.66) want = 1;
      }
      if (want > enrage) {
        setEnrage(want);
        fx({ kind: "enrage" });
        setIntensity(0.6 + want * 0.2);
        gong();
        setShake("enemy");
        pushLog(`${enemy.name} is ENRAGED!`);
        showBanner(`${enemy.name} is enraged`, "warn");
        window.setTimeout(() => setShake(null), 420);
      }
    },
    [enemy, enrage, pushLog, showBanner]
  );

  const useMove = useCallback(
    (id: MoveId) => {
      const mv = MOVES[id];
      const s = useGameStore.getState();
      const me = s.party[active];
      if (!me) return;

      if (mv.kind === "heal") {
        s.heal(active, mv.power);
        fx({ kind: "heal", side: "player" });
        addFloat(`+${mv.power}`, "player", "heal");
        sfx("heal");
        pushLog(`${me.name} used ${mv.name} and recovered.`);
      } else {
        const { dmg, crit } = roll(mv.power, me.atk, enemy.def + enrage * 3);
        const next = Math.max(0, enemyHp - dmg);
        fx({ kind: "attack", side: "player", crit });
        setEnemyHp(next);
        stats.current.dealt += dmg;
        if (crit) stats.current.crits += 1;
        addFloat(`-${dmg}`, "enemy", crit ? "crit" : "dmg");
        setShake("enemy");
        sfx("hit");
        pushLog(`${me.name} used ${mv.name}${crit ? " — a critical hit!" : "."}`);
        window.setTimeout(() => setShake(null), 260);
        if (next <= 0) {
          window.setTimeout(() => finish(true), 700);
          return;
        }
        checkEnemyPhase(next);
      }
      setMenu("root");
      setCursor(0);
      window.setTimeout(() => setPhase("enemy"), 640);
    },
    [active, addFloat, checkEnemyPhase, enemy.def, enemyHp, enrage, finish, pushLog]
  );

  const useItemAt = useCallback(
    (id: ItemId) => {
      const s = useGameStore.getState();
      const ok = s.useItem(id, active);
      if (!ok) {
        sfx("error");
        pushLog("Nothing happened.");
        addFloat("no effect", "player", "miss");
        return;
      }
      stats.current.items += 1;
      addFloat(`+${ITEMS[id].heal}`, "player", "heal");
      fx({ kind: "heal", side: "player" });
      sfx("heal");
      pushLog(`${s.party[active].name} used ${ITEMS[id].name}.`);
      setMenu("root");
      setCursor(0);
      window.setTimeout(() => setPhase("enemy"), 620);
    },
    [active, addFloat, pushLog]
  );

  const swapTo = useCallback(
    (i: number) => {
      const s = useGameStore.getState();
      if (i === active || s.party[i].hp <= 0) {
        sfx("error");
        return;
      }
      setActive(i);
      setCover(2);
      stats.current.swaps += 1;
      fx({ kind: "swap", fighterId: s.party[i].id });
      sfx("confirm");
      pushLog(`${s.party[i].name} steps forward!${reads ? " Covered for two turns." : ""}`);
      showBanner(`${s.party[i].name} steps in`, "player");
      setMenu("root");
      setCursor(0);
      window.setTimeout(() => setPhase("enemy"), 560);
    },
    [active, pushLog, reads, showBanner]
  );

  const tryRun = useCallback(() => {
    if (isBoss) {
      sfx("error");
      pushLog("There's no running from this one.");
      return;
    }
    if (Math.random() < 0.62) {
      sfx("cancel");
      pushLog("Got away safely.");
      settled.current = true;
      setPhase("done");
      window.setTimeout(() => {
        useGameStore.getState().setOverlay(null);
        bus.emit("battle:end", { enemyId, won: false, fled: true });
      }, 700);
    } else {
      sfx("error");
      pushLog("Couldn't get away!");
      addFloat("couldn't flee", "player", "miss");
      window.setTimeout(() => setPhase("enemy"), 520);
    }
  }, [addFloat, enemyId, isBoss, pushLog]);

  // ------------------------------------------------------------------ input

  const options = useMemo(() => {
    if (menu === "root") return ROOT_ACTIONS.map((a) => ({ label: a, disabled: a === "RUN" && isBoss, meta: "" }));
    if (menu === "fight")
      return activeFighter.moves.map((m) => ({
        label: MOVES[m].name,
        meta: `${MOVES[m].kind === "heal" ? "+" : ""}${MOVES[m].power}`,
        disabled: false,
      }));
    if (menu === "item")
      return healers.length
        ? healers.map((i) => ({ label: ITEMS[i.id].name, meta: `x${i.count}`, disabled: false }))
        : [{ label: "No healing items", meta: "", disabled: true }];
    return party.map((p) => ({ label: p.name, meta: `${p.hp}/${p.maxHp}`, disabled: p.hp <= 0 || party.indexOf(p) === active }));
  }, [menu, activeFighter, healers, party, active, isBoss]);

  const choose = useCallback(
    (i: number) => {
      const opt = options[i];
      if (opt?.disabled) {
        sfx("error");
        return;
      }
      if (menu === "root") {
        sfx("confirm");
        const a = ROOT_ACTIONS[i];
        if (a === "FIGHT") { setMenu("fight"); setCursor(0); }
        else if (a === "ITEM") { setMenu("item"); setCursor(0); }
        else if (a === "SWAP") { setMenu("swap"); setCursor(0); }
        else tryRun();
      } else if (menu === "fight") useMove(activeFighter.moves[i]);
      else if (menu === "item") { if (healers[i]) useItemAt(healers[i].id); }
      else swapTo(i);
    },
    [options, menu, tryRun, useMove, activeFighter, healers, useItemAt, swapTo]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "done" && resultShown && outcome) {
        if (["Enter", " ", "e", "E", "z", "Z"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          sfx("confirm");
          leave(outcome === "win");
        }
        return;
      }
      if (phase !== "player") return;
      e.preventDefault();
      e.stopPropagation();
      const n = options.length;
      if (["ArrowDown", "s", "S"].includes(e.key)) {
        setCursor((c) => (c + 1) % n);
        sfx("menu");
      } else if (["ArrowUp", "w", "W"].includes(e.key)) {
        setCursor((c) => (c - 1 + n) % n);
        sfx("menu");
      } else if (["ArrowRight", "d", "D"].includes(e.key)) {
        setCursor((c) => (c + 1) % n);
        sfx("menu");
      } else if (["ArrowLeft", "a", "A"].includes(e.key)) {
        setCursor((c) => (c - 1 + n) % n);
        sfx("menu");
      } else if (["Escape", "x", "X"].includes(e.key)) {
        if (menu !== "root") {
          sfx("cancel");
          setMenu("root");
          setCursor(0);
        }
      } else if (["Enter", " ", "e", "E", "z", "Z"].includes(e.key)) {
        choose(cursor);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, menu, cursor, options, choose, resultShown, outcome, leave]);

  // ------------------------------------------------------------------ view

  const focusedMove = menu === "fight" ? MOVES[activeFighter.moves[cursor]] : null;
  const detail =
    menu === "root"
      ? ROOT_HINT[ROOT_ACTIONS[cursor]]
      : focusedMove
      ? focusedMove.desc
      : menu === "item"
      ? healers[cursor]
        ? ITEMS[healers[cursor].id].desc
        : "Potions restore HP. Find them in chests and from friends."
      : party[cursor]
      ? party[cursor].hp <= 0
        ? `${party[cursor].name} can't fight right now.`
        : cursor === active
        ? `${party[cursor].name} is already in front.`
        : `Tag ${party[cursor].name} in${reads ? " — covered for two turns" : ""}.`
      : "";

  return (
    <div className={`battle-ui absolute inset-0 z-50 flex flex-col overflow-hidden ${classic ? "vignette bg-[#0a0507]" : ""}`}>
      {classic && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isBoss
              ? "radial-gradient(ellipse at 50% 28%, #4a121d 0%, #1a0810 45%, #0a0507 78%)"
              : "radial-gradient(ellipse at 50% 32%, #16281c 0%, #0d1410 48%, #0a0507 80%)",
          }}
        />
      )}
      {/* a soft letterbox so the cards and bar read against any scene */}
      {!classic && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: "linear-gradient(to bottom, rgba(5,2,4,.7), transparent)" }} />
      )}

      {/* --- turn banner */}
      {banner && (
        <div key={banner.key} className="pointer-events-none absolute inset-x-0 top-[18%] z-10 flex justify-center">
          <div
            className="battle-banner title-lg px-8 py-2 text-[18px] tracking-[.22em]"
            style={{
              color: banner.tone === "enemy" ? "#f2c7cc" : banner.tone === "warn" ? "#ffb3a7" : "#f2dfa6",
              background:
                banner.tone === "enemy"
                  ? "linear-gradient(90deg, transparent, rgba(124,20,31,.75), transparent)"
                  : banner.tone === "warn"
                  ? "linear-gradient(90deg, transparent, rgba(160,40,30,.8), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(60,40,10,.78), transparent)",
              textShadow: "0 2px 12px rgba(0,0,0,.9)",
              animation: reduced ? "ui-fade-in .2s ease both" : "ui-banner 1.4s cubic-bezier(.2,.8,.3,1) both",
            }}
          >
            {banner.text}
          </div>
        </div>
      )}

      {/* --- field: the 3D world shows through; cards sit at the top corners */}
      <div className="relative flex flex-1 items-start justify-between px-5 pt-5">
        <Combatant
          side="player"
          name={activeFighter?.name ?? ""}
          portrait={activeFighter?.portrait ?? "palakshi"}
          hp={activeFighter?.hp ?? 0}
          maxHp={activeFighter?.maxHp ?? 1}
          shaking={shake === "player"}
          floats={floats.filter((f) => f.side === "player")}
          badge={reads && cover > 0 ? { text: `COVER ${cover}`, color: "#7ddca4" } : null}
          accent="#d9b45b"
          showPortrait={classic}
          myTurn={phase === "player"}
        />

        {isBoss && (
          <div className="sb-pop title-lg mt-1 hidden text-[13px] tracking-[.3em] text-[#e0616b] sm:block">BOSS</div>
        )}

        <Combatant
          side="enemy"
          name={enemy.name}
          portrait={enemy.portrait}
          hp={enemyHp}
          maxHp={enemy.hp}
          showNumbers={isBoss}
          shaking={shake === "enemy"}
          floats={floats.filter((f) => f.side === "enemy")}
          badge={
            enrage > 0
              ? { text: enrage > 1 ? `ENRAGED ${enrage + 1}` : "ENRAGED", color: "#e0616b" }
              : reads && activeRead >= 2
              ? { text: `READ x${activeRead}`, color: "#d9b45b" }
              : null
          }
          accent={enrage > 0 ? "#e0616b" : "#8a8698"}
          defeated={enemyHp <= 0}
          showPortrait={classic}
          myTurn={phase === "enemy"}
        />
      </div>

      {/* --- bench ------------------------------------------------------- */}
      {party.length > 1 && (
        <div className="battle-bench relative flex justify-center gap-3 pb-3">
          {party.map((p, i) => (
            <button
              key={p.id}
              onClick={() => phase === "player" && swapTo(i)}
              className={`surface-raised flex items-center gap-2.5 px-3 py-2 transition-all ${
                i === active ? "" : "opacity-60 hover:opacity-90"
              }`}
              style={{
                borderColor: i === active ? "rgba(217,180,91,.65)" : "rgba(217,180,91,.15)",
                filter: p.hp > 0 ? undefined : "grayscale(1)",
              }}
            >
              <div className="overflow-hidden rounded-md" style={{ border: "1px solid rgba(217,180,91,.3)" }}>
                <CharacterPortrait id={p.portrait} size={24} />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-semibold text-[var(--ink-1)]">{p.name}</div>
                <div className="text-[10px] tabular-nums text-[var(--ink-3)]">
                  {p.hp}/{p.maxHp}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* --- command bar ------------------------------------------------- */}
      <div className="battle-bar relative grid grid-cols-1 gap-3 border-t border-[rgba(217,180,91,.18)] bg-black/55 p-4 backdrop-blur-md sm:grid-cols-[1fr_400px]">
        <div className="battle-log surface-raised min-h-[92px] px-4 py-3">
          {log.map((l, i) => (
            <div
              key={i}
              className="text-[13px] leading-relaxed"
              style={{
                opacity: i === log.length - 1 ? 1 : 0.4,
                color: i === log.length - 1 ? "var(--ink-1)" : "var(--ink-3)",
              }}
            >
              {l}
            </div>
          ))}
        </div>

        <div className="surface-raised p-3">
          {phase === "player" ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow">{menu === "root" ? "Command" : menu}</span>
                {menu !== "root" && <span className="text-[10px] text-[var(--ink-4)]">{glyph("cancel", device.kind)} · back</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {options.map((o, i) => (
                  <button
                    key={o.label + i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(i)}
                    disabled={o.disabled}
                    style={{ fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}
                    className={`btn flex items-center justify-between gap-2 px-3 py-2.5 text-[12px] font-semibold ${i === cursor && !o.disabled ? "btn-selected" : ""}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.meta && (
                      <span className="shrink-0 tabular-nums text-[10px] font-medium" style={{ color: i === cursor ? "#f2dfa6" : "var(--ink-3)" }}>
                        {o.meta}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="battle-detail mt-2.5 flex items-center justify-between gap-3 border-t border-[rgba(217,180,91,.14)] pt-2.5">
                <p className="min-w-0 flex-1 truncate text-[11px] leading-relaxed text-[var(--ink-3)]" title={detail}>{detail}</p>
                {focusedMove && (
                  <span className="flex shrink-0 items-center gap-2 text-[10px] font-semibold tracking-wider text-[var(--ink-2)]">
                    {focusedMove.kind === "heal" ? (
                      <Stat label="HEALS" value={`${focusedMove.power}`} color="#7ddca4" />
                    ) : (
                      <>
                        <Stat label="PWR" value={`${focusedMove.power}`} color="#f2dfa6" />
                        <Stat label="CRIT" value={`${CRIT_PCT}%`} color="#d9b45b" />
                      </>
                    )}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[76px] items-center justify-center text-[12px] tracking-[.2em] text-[var(--ink-3)]">
              {phase === "intro" ? "…" : phase === "enemy" ? `${enemy.name} is moving…` : outcome === "win" ? "Victory" : outcome === "lose" ? "Defeated" : ""}
            </div>
          )}
        </div>
      </div>

      {/* --- result ------------------------------------------------------ */}
      {resultShown && outcome && (
        <ResultPanel
          won={outcome === "win"}
          enemyName={enemy.name}
          boss={isBoss}
          stats={stats.current}
          party={party}
          onContinue={() => { sfx("confirm"); leave(outcome === "win"); }}
          hint={device.kind === "touch" ? "" : glyph("interact", device.kind)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[9px] text-[var(--ink-4)]">{label}</span>
      <span className="tabular-nums" style={{ color }}>{value}</span>
    </span>
  );
}

function ResultPanel({
  won, enemyName, boss, stats, party, onContinue, hint,
}: {
  won: boolean;
  enemyName: string;
  boss: boolean;
  stats: { turns: number; dealt: number; taken: number; crits: number; items: number; swaps: number };
  party: { id: string; name: string; hp: number; maxHp: number; portrait: string }[];
  onContinue: () => void;
  hint: string;
}) {
  const accent = won ? "#7ddca4" : "#e0616b";
  return (
    <div className="battle-result absolute inset-0 z-20 flex items-center justify-center p-4 ui-fade-in" style={{ background: "rgba(5,2,4,.55)" }}>
      <div className="result-card surface sb-pop relative max-h-full w-full max-w-[440px] overflow-y-auto">
        <div className="absolute inset-x-0 top-0 h-px ui-rule-grow" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="eyebrow mb-2" style={{ color: accent }}>{won ? (boss ? "Boss defeated" : "Victory") : "Defeated"}</div>
          <div className="title-lg text-[24px] text-[#f2dfa6] glow-gold">{won ? enemyName : "Carried back"}</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            {won
              ? boss
                ? "The way ahead is yours."
                : "The path is clear again."
              : "You'll be patched up where you stand and can try again."}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Tile label="Turns" value={stats.turns} />
            <Tile label="Dealt" value={stats.dealt} />
            <Tile label="Crits" value={stats.crits} gold={stats.crits > 0} />
          </div>
          {(stats.swaps > 0 || stats.items > 0) && (
            <p className="mt-2 text-[10.5px] text-[var(--ink-4)]">
              {[stats.swaps > 0 ? `${stats.swaps} swap${stats.swaps > 1 ? "s" : ""}` : "", stats.items > 0 ? `${stats.items} item${stats.items > 1 ? "s" : ""} used` : ""].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="result-party mt-4 flex flex-col gap-2">
            {party.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-[rgba(217,180,91,.14)] bg-black/30 px-3 py-2">
                <div className="overflow-hidden rounded-md" style={{ border: "1px solid rgba(217,180,91,.3)", filter: p.hp > 0 ? undefined : "grayscale(1)" }}>
                  <CharacterPortrait id={p.portrait} size={26} />
                </div>
                <span className="w-[86px] text-left text-[12px] font-semibold text-[var(--ink-1)]">{p.name}</span>
                <div className="flex-1"><BattleHp hp={p.hp} max={p.maxHp} width={0} showText={false} /></div>
                <span className="w-[58px] text-right text-[11px] tabular-nums text-[var(--ink-3)]">{p.hp}/{p.maxHp}</span>
              </div>
            ))}
          </div>

          <button onClick={onContinue} className="btn btn-primary btn-selected mt-5 flex w-full items-center justify-center gap-3 py-3 text-[14px]">
            Continue
            {hint && <kbd className="rounded border border-[rgba(242,223,166,.4)] bg-black/30 px-1.5 py-0.5 text-[10px] font-normal tracking-normal" style={{ fontFamily: "var(--font-body)" }}>{hint}</kbd>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className="rounded-lg border border-[rgba(217,180,91,.16)] bg-black/30 px-2 py-2">
      <div className="title-lg text-[18px] tabular-nums" style={{ color: gold ? "#f2dfa6" : "var(--ink-1)" }}>{value}</div>
      <div className="eyebrow mt-0.5 text-[9px]">{label}</div>
    </div>
  );
}

/**
 * HP bar for the fight: the fill eases, a pale "ghost" trails behind it so the
 * size of a hit is readable after the number has gone, and the frame flashes
 * red when it drops.
 */
function BattleHp({ hp, max, width, showText = true }: { hp: number; max: number; width: number; showText?: boolean }) {
  const pct = Math.max(0, Math.min(1, hp / max));
  const [ghost, setGhost] = useState(pct);
  const [flash, setFlash] = useState(0);
  const prev = useRef(pct);
  useEffect(() => {
    if (pct < prev.current) {
      setFlash((n) => n + 1);
      const t = window.setTimeout(() => setGhost(pct), 420);
      prev.current = pct;
      return () => window.clearTimeout(t);
    }
    prev.current = pct;
    setGhost(pct);
  }, [pct]);
  const grad =
    pct > 0.5 ? "linear-gradient(90deg,#4fae7a,#7ddca4)" : pct > 0.22 ? "linear-gradient(90deg,#c79a3f,#f2dfa6)" : "linear-gradient(90deg,#8f1a24,#e0616b)";
  const glow = pct > 0.5 ? "rgba(125,220,164,.45)" : pct > 0.22 ? "rgba(217,180,91,.45)" : "rgba(179,37,47,.55)";
  return (
    <div className="flex items-center gap-2">
      <div
        key={flash}
        className="relative overflow-hidden rounded-full"
        style={{
          width: width || "100%",
          height: 8,
          background: "rgba(255,255,255,.07)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.7)",
          animation: flash ? "ui-hp-flash .55s ease-out both" : undefined,
        }}
      >
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ghost * 100}%`, background: "rgba(224,97,107,.55)", transition: "width .6s cubic-bezier(.2,.8,.3,1)" }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct * 100}%`, background: grad, boxShadow: `0 0 10px ${glow}`, transition: "width .32s cubic-bezier(.2,.8,.3,1)" }} />
      </div>
      {showText && (
        <span className="tabular-nums text-[11px] font-medium text-[var(--ink-2)]">
          {Math.max(0, Math.round(hp))}<span className="text-[var(--ink-4)]">/{max}</span>
        </span>
      )}
    </div>
  );
}

function Combatant({
  name, portrait, hp, maxHp, shaking, floats, badge, accent, showNumbers = true, defeated, showPortrait, side, myTurn,
}: {
  side?: "player" | "enemy";
  name: string;
  portrait: string;
  hp: number;
  maxHp: number;
  shaking: boolean;
  floats: Float[];
  badge: { text: string; color: string } | null;
  accent: string;
  showNumbers?: boolean;
  defeated?: boolean;
  showPortrait?: boolean;
  myTurn?: boolean;
}) {
  return (
    <div className={`relative flex flex-col gap-3 ${side === "enemy" ? "items-end" : "items-start"} ${shaking ? "sb-shake" : ""}`}>
      <div
        className="combatant-card surface w-[260px] px-4 py-3 transition-shadow duration-300"
        style={{
          borderColor: myTurn ? `${accent}aa` : `${accent}55`,
          boxShadow: myTurn ? `var(--shadow-deep), 0 0 0 1px ${accent}33, 0 0 28px -6px ${accent}66` : undefined,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {myTurn && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
            <span className="title-lg truncate text-[14px] text-[var(--ink-1)]">{name}</span>
          </span>
          {badge && (
            <span
              className="sb-blink shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider"
              style={{ color: badge.color, border: `1px solid ${badge.color}66` }}
            >
              {badge.text}
            </span>
          )}
        </div>
        <div className="mt-2">
          <BattleHp hp={hp} max={maxHp} width={showNumbers ? 170 : 228} showText={showNumbers} />
        </div>
      </div>

      {showPortrait && (
        <div
          className="sb-float relative overflow-hidden rounded-2xl p-1"
          style={{
            background: `linear-gradient(160deg, ${accent}66, rgba(10,5,7,.6))`,
            boxShadow: `0 22px 50px -18px rgba(0,0,0,.95), 0 0 44px -10px ${accent}55`,
            filter: defeated ? "grayscale(1) brightness(.45)" : undefined,
          }}
        >
          <div className="overflow-hidden rounded-xl bg-[#0a0507]">
            <CharacterPortrait id={portrait} size={128} />
          </div>
        </div>
      )}

      {floats.map((f) => (
        <FloatNum key={f.id} text={f.text} kind={f.kind} jitter={f.jitter} />
      ))}
    </div>
  );
}

function FloatNum({ text, kind, jitter }: { text: string; kind: FloatKind; jitter: number }) {
  const color = kind === "heal" ? "#7ddca4" : kind === "crit" ? "#f2dfa6" : kind === "miss" ? "#9a918a" : "#ff8a94";
  const size = kind === "crit" ? 38 : kind === "miss" ? 13 : 27;
  return (
    <div
      className={`${kind === "miss" ? "font-semibold uppercase tracking-[.18em]" : "title-lg"} pointer-events-none absolute top-16 z-10 whitespace-nowrap`}
      style={{
        left: `calc(50% + ${jitter}px)`,
        fontSize: size,
        color,
        textShadow: kind === "crit" ? "0 0 18px rgba(242,223,166,.7), 0 3px 12px rgba(0,0,0,.95)" : "0 3px 12px rgba(0,0,0,.95)",
        animation: "ui-dmg 1.05s cubic-bezier(.2,.7,.3,1) forwards",
        fontFamily: kind === "miss" ? "var(--font-body)" : undefined,
      }}
    >
      {text}
      {kind === "crit" && <span className="ml-1.5 align-super text-[11px] tracking-[.2em] text-[#d9b45b]">CRIT</span>}
    </div>
  );
}
