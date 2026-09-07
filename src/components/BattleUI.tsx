// ---------------------------------------------------------------------------
// Turn-based battle. Turn order by spd; phases player -> enemy -> done.
// Bosses gain phases at HP thresholds with a stronger move set, and Arshiya's
// HP pool is tuned so a solo fighter cannot outlast her — you must swap.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { ENEMIES, MOVES, ITEMS, type MoveId, type ItemId } from "../data/content";
import { bus } from "../game/bus";
import { playBgm, sfx, setIntensity, gong } from "../game/sound";
import { CharacterPortrait, FramedPortrait } from "./pixel/Portrait";
import { HpBar } from "./pixel/decor";

type Menu = "root" | "fight" | "item" | "swap";
type Float = { id: number; text: string; side: "enemy" | "player"; crit: boolean };

const ROOT_ACTIONS = ["FIGHT", "ITEM", "SWAP", "RUN"] as const;

export default function BattleUI() {
  const overlay = useGameStore((s) => s.overlay);
  const party = useGameStore((s) => s.party);
  const inventory = useGameStore((s) => s.inventory);

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
  const floatId = useRef(0);
  const settled = useRef(false);
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

  const addFloat = useCallback((text: string, side: Float["side"], crit = false) => {
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, text, side, crit }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
  }, []);

  /**
   * power * atk / def, scaled so a boss fight lasts ~10-14 turns rather than 4.
   * The 2.6 factor is what keeps the long fights long; changing it re-tunes
   * every encounter in the game at once.
   */
  const roll = (power: number, atk: number, def: number) => {
    const base = (power * atk) / Math.max(10, def * 2.6);
    const variance = 0.85 + Math.random() * 0.3;
    const crit = Math.random() < 0.11;
    return { dmg: Math.max(1, Math.round(base * variance * (crit ? 1.6 : 1))), crit };
  };

  // ------------------------------------------------------------- resolution

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return;
      settled.current = true;
      setOutcome(won ? "win" : "lose");
      setPhase("done");
      if (won) sfx("win");
      window.setTimeout(() => {
        useGameStore.getState().setOverlay(null);
        bus.emit("battle:end", { enemyId, won });
      }, won ? 1500 : 2000);
    },
    [enemyId]
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
    const readMult = reads ? Math.min(canSwap ? 5 : 2, 1 + 0.5 * tgtRead) : 1;
    const atk = enemy.atk * (1 + 0.3 * enrage) * readMult;
    const hit = roll(mv.power, atk, target.p.def);
    const crit = hit.crit;
    let dmg = hit.dmg;
    if (reads && cover > 0 && target.i === active) dmg = Math.round(dmg * 0.7);
    const dealt = s.damage(target.i, dmg);
    addFloat(`-${dealt}`, "player", crit);
    setShake("player");
    sfx("hit");
    pushLog(`${enemy.name} used ${mv.name}${crit ? " — critical!" : ""}.`);
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
        const next = s2.party.findIndex((p) => p.hp > 0);
        setActive(next);
        pushLog(`${s2.party[next].name} steps forward.`);
      }
      setPhase("player");
      setMenu("root");
      setCursor(0);
    }, 720);
  }, [active, addFloat, cover, enemy, enrage, finish, readStacks, pushLog, reads]);

  useEffect(() => {
    if (phase !== "enemy") return;
    const t = window.setTimeout(enemyTurn, 620);
    return () => window.clearTimeout(t);
  }, [phase, enemyTurn]);

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
        setIntensity(0.6 + want * 0.2);
        gong();
        setShake("enemy");
        pushLog(`${enemy.name} is ENRAGED!`);
        window.setTimeout(() => setShake(null), 420);
      }
    },
    [enemy, enrage, pushLog]
  );

  const useMove = useCallback(
    (id: MoveId) => {
      const mv = MOVES[id];
      const s = useGameStore.getState();
      const me = s.party[active];
      if (!me) return;

      if (mv.kind === "heal") {
        s.heal(active, mv.power);
        addFloat(`+${mv.power}`, "player");
        sfx("heal");
        pushLog(`${me.name} used ${mv.name} and recovered.`);
      } else {
        const { dmg, crit } = roll(mv.power, me.atk, enemy.def + enrage * 3);
        const next = Math.max(0, enemyHp - dmg);
        setEnemyHp(next);
        addFloat(`-${dmg}`, "enemy", crit);
        setShake("enemy");
        sfx("hit");
        pushLog(`${me.name} used ${mv.name}${crit ? " — critical!" : ""}.`);
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
        return;
      }
      addFloat(`+${ITEMS[id].heal}`, "player");
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
      sfx("confirm");
      pushLog(`${s.party[i].name} steps forward!${reads ? " Covered for two turns." : ""}`);
      setMenu("root");
      setCursor(0);
      window.setTimeout(() => setPhase("enemy"), 560);
    },
    [active, pushLog, reads]
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
      window.setTimeout(() => setPhase("enemy"), 520);
    }
  }, [enemyId, isBoss, pushLog]);

  // ------------------------------------------------------------------ input

  const options = useMemo(() => {
    if (menu === "root") return ROOT_ACTIONS.map((a) => ({ label: a, disabled: a === "RUN" && isBoss }));
    if (menu === "fight")
      return activeFighter.moves.map((m) => ({
        label: `${MOVES[m].name}  ${MOVES[m].kind === "heal" ? "+" : ""}${MOVES[m].power}`,
        disabled: false,
      }));
    if (menu === "item")
      return healers.length
        ? healers.map((i) => ({ label: `${ITEMS[i.id].name} x${i.count}`, disabled: false }))
        : [{ label: "No healing items", disabled: true }];
    return party.map((p) => ({ label: `${p.name}  ${p.hp}/${p.maxHp}`, disabled: p.hp <= 0 || party.indexOf(p) === active }));
  }, [menu, activeFighter, healers, party, active, isBoss]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      } else if (["Escape", "x", "X"].includes(e.key)) {
        if (menu !== "root") {
          sfx("cancel");
          setMenu("root");
          setCursor(0);
        }
      } else if (["Enter", " ", "e", "E", "z", "Z"].includes(e.key)) {
        const opt = options[cursor];
        if (opt?.disabled) {
          sfx("error");
          return;
        }
        if (menu === "root") {
          sfx("confirm");
          const a = ROOT_ACTIONS[cursor];
          if (a === "FIGHT") { setMenu("fight"); setCursor(0); }
          else if (a === "ITEM") { setMenu("item"); setCursor(0); }
          else if (a === "SWAP") { setMenu("swap"); setCursor(0); }
          else tryRun();
        } else if (menu === "fight") useMove(activeFighter.moves[cursor]);
        else if (menu === "item") { if (healers[cursor]) useItemAt(healers[cursor].id); }
        else swapTo(cursor);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, menu, cursor, options, activeFighter, healers, useMove, useItemAt, swapTo, tryRun]);

  // ------------------------------------------------------------------ view

  const enemyPct = enemyHp / enemy.hp;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0507]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isBoss
            ? "radial-gradient(ellipse at 50% 30%, #3d0f18 0%, #0a0507 70%)"
            : "radial-gradient(ellipse at 50% 35%, #1f2a20 0%, #0a0507 72%)",
        }}
      />

      {/* --- field ------------------------------------------------------- */}
      <div className="relative flex flex-1 items-center justify-between px-6 py-6 sm:px-16">
        {/* enemy */}
        <div className={`relative ml-auto flex flex-col items-center gap-2 ${shake === "enemy" ? "sb-shake" : ""}`}>
          <div className="w-[210px] border-2 border-[#7c141f] bg-[#0a0507]/85 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] tracking-[0.16em] text-[#f7e6c8]">{enemy.name.toUpperCase()}</span>
              <span className="flex items-center gap-1">
                {reads && activeRead >= 2 && (
                  <span className="border border-[#d9b45b] px-1 text-[6px] text-[#d9b45b] sb-blink">
                    READ x{activeRead}
                  </span>
                )}
                {enrage > 0 && (
                  <span className="border border-[#b3252f] px-1 text-[6px] text-[#b3252f] sb-blink">
                    ENRAGED{enrage > 1 ? ` ${enrage + 1}` : ""}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5">
              <HpBar hp={enemyHp} max={enemy.hp} width={186} showText={isBoss} />
            </div>
          </div>
          <div
            className="border-4 bg-[#0a0507] p-1"
            style={{
              borderColor: enrage > 0 ? "#b3252f" : "#d9b45b",
              boxShadow: `0 0 30px ${enrage > 0 ? "#b3252f55" : "#d9b45b33"}`,
              filter: enemyPct <= 0 ? "grayscale(1) brightness(.5)" : undefined,
            }}
          >
            {/* Bosses always use their real character bust. */}
            <CharacterPortrait id={enemy.portrait} size={112} />
          </div>
          {floats
            .filter((f) => f.side === "enemy")
            .map((f) => (
              <FloatNum key={f.id} text={f.text} crit={f.crit} />
            ))}
        </div>

        {/* party */}
        <div className={`relative order-first flex flex-col items-center gap-2 ${shake === "player" ? "sb-shake" : ""}`}>
          <div
            className="border-4 border-[#d9b45b] bg-[#0a0507] p-1"
            style={{ boxShadow: "0 0 30px rgba(217,180,91,.25)", filter: activeFighter?.hp <= 0 ? "grayscale(1)" : undefined }}
          >
            <CharacterPortrait id={activeFighter?.portrait ?? "palakshi"} size={112} />
          </div>
          <div className="w-[210px] border-2 border-[#d9b45b] bg-[#0a0507]/85 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] tracking-[0.16em] text-[#f7e6c8]">
                {(activeFighter?.name ?? "").toUpperCase()}
              </span>
              {reads && cover > 0 && (
                <span className="border border-[#7ddca4] px-1 text-[6px] text-[#7ddca4]">COVER {cover}</span>
              )}
            </div>
            <div className="mt-1.5">
              <HpBar hp={activeFighter?.hp ?? 0} max={activeFighter?.maxHp ?? 1} width={186} />
            </div>
          </div>
          {floats
            .filter((f) => f.side === "player")
            .map((f) => (
              <FloatNum key={f.id} text={f.text} crit={f.crit} />
            ))}
        </div>
      </div>

      {/* --- bench ------------------------------------------------------- */}
      {party.length > 1 && (
        <div className="relative flex justify-center gap-3 pb-2">
          {party.map((p, i) => (
            <button
              key={p.id}
              onClick={() => phase === "player" && swapTo(i)}
              className="flex items-center gap-2 border-2 px-2 py-1"
              style={{
                borderColor: i === active ? "#d9b45b" : "#3a2229",
                opacity: p.hp > 0 ? 1 : 0.4,
                background: "#0a0507cc",
              }}
            >
              <FramedPortrait id={p.portrait} size={24} tone={i === active ? "gold" : "crimson"} />
              <span className="text-[7px] text-[#f7e6c8]">
                {p.name} {p.hp}/{p.maxHp}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* --- command bar ------------------------------------------------- */}
      <div className="relative grid grid-cols-1 gap-2 border-t-2 border-[#7c141f] bg-[#0a0507]/95 p-3 sm:grid-cols-[1fr_320px]">
        <div className="min-h-[74px] border-2 border-[#3a2229] bg-[#120a0d] px-3 py-2">
          {log.map((l, i) => (
            <div key={i} className="text-[8px] leading-[2] text-[#f7e6c8]" style={{ opacity: i === log.length - 1 ? 1 : 0.45 }}>
              {l}
            </div>
          ))}
          {outcome === "win" && <div className="mt-1 text-[9px] tracking-[0.2em] text-[#7ddca4]">VICTORY!</div>}
          {outcome === "lose" && <div className="mt-1 text-[9px] tracking-[0.2em] text-[#b3252f]">DEFEATED…</div>}
        </div>

        <div className="border-2 border-[#d9b45b] bg-[#120a0d] p-2">
          {phase === "player" ? (
            <>
              {menu !== "root" && (
                <div className="mb-1 flex items-center justify-between text-[6px] tracking-[0.2em] text-[#8a7a6a]">
                  <span>{menu.toUpperCase()}</span>
                  <span>[X] BACK</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1">
                {options.map((o, i) => (
                  <button
                    key={o.label + i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      if (o.disabled) return sfx("error");
                      if (menu === "root") {
                        const a = ROOT_ACTIONS[i];
                        sfx("confirm");
                        if (a === "FIGHT") { setMenu("fight"); setCursor(0); }
                        else if (a === "ITEM") { setMenu("item"); setCursor(0); }
                        else if (a === "SWAP") { setMenu("swap"); setCursor(0); }
                        else tryRun();
                      } else if (menu === "fight") useMove(activeFighter.moves[i]);
                      else if (menu === "item") { if (healers[i]) useItemAt(healers[i].id); }
                      else swapTo(i);
                    }}
                    className="border px-2 py-1.5 text-left text-[7px] tracking-wider"
                    style={{
                      borderColor: i === cursor ? "#d9b45b" : "#2a1a20",
                      background: i === cursor ? "#7c141f" : "transparent",
                      color: o.disabled ? "#5a4a4a" : i === cursor ? "#f2dfa6" : "#f7e6c8",
                    }}
                  >
                    {i === cursor ? "▶ " : "  "}
                    {o.label}
                  </button>
                ))}
              </div>
              {menu === "fight" && (
                <div className="mt-1.5 border-t border-[#3a2229] pt-1.5 text-[6px] leading-[1.8] text-[#8a7a6a]">
                  {MOVES[activeFighter.moves[cursor]]?.desc}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[8px] tracking-[0.2em] text-[#8a7a6a]">
              {phase === "intro" ? "…" : phase === "enemy" ? "ENEMY TURN" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FloatNum({ text, crit }: { text: string; crit: boolean }) {
  const heal = text.startsWith("+");
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-[13px]"
      style={{
        color: heal ? "#7ddca4" : crit ? "#f2dfa6" : "#b3252f",
        textShadow: "2px 2px 0 #0a0507",
        animation: "sb-rise .9s ease-out forwards",
      }}
    >
      {text}
      {crit && <span className="ml-1 text-[7px]">CRIT</span>}
    </div>
  );
}
