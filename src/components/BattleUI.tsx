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
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { ENEMIES, MOVES, ITEMS, type MoveId, type ItemId } from "../data/content";
import { bus } from "../game/bus";
import { playBgm, sfx, setIntensity, gong } from "../game/sound";
import { CharacterPortrait } from "./pixel/Portrait";
import { HpBar } from "./pixel/decor";
import { useDevice, glyph } from "../input/useDevice";

const fx = (p: { kind: string; side?: "player" | "enemy"; crit?: boolean; fighterId?: string }) => bus.emit("battle:fx", p);

type Menu = "root" | "fight" | "item" | "swap";
type Float = { id: number; text: string; side: "enemy" | "player"; crit: boolean };

const ROOT_ACTIONS = ["FIGHT", "ITEM", "SWAP", "RUN"] as const;

export default function BattleUI() {
  const overlay = useGameStore((s) => s.overlay);
  const party = useGameStore((s) => s.party);
  const inventory = useGameStore((s) => s.inventory);
  const classic = useGameStore((s) => s.settings.renderer === "classic");
  const device = useDevice();

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

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return;
      settled.current = true;
      setOutcome(won ? "win" : "lose");
      setPhase("done");
      fx({ kind: won ? "win" : "lose" });
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
    const readMult = reads ? Math.min(canSwap ? 2.5 : 1.6, 1 + 0.3 * tgtRead) : 1;
    const atk = enemy.atk * (1 + 0.3 * enrage) * readMult;
    const hit = roll(mv.power, atk, target.p.def);
    const crit = hit.crit;
    let dmg = hit.dmg;
    if (reads && cover > 0 && target.i === active) dmg = Math.round(dmg * 0.7);
    fx({ kind: "attack", side: "enemy", crit });
    const dealt = s.damage(target.i, dmg);
    addFloat(`-${dealt}`, "player", crit);
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
        fx({ kind: "heal", side: "player" });
        addFloat(`+${mv.power}`, "player");
        sfx("heal");
        pushLog(`${me.name} used ${mv.name} and recovered.`);
      } else {
        const { dmg, crit } = roll(mv.power, me.atk, enemy.def + enrage * 3);
        const next = Math.max(0, enemyHp - dmg);
        fx({ kind: "attack", side: "player", crit });
        setEnemyHp(next);
        addFloat(`-${dmg}`, "enemy", crit);
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
        return;
      }
      addFloat(`+${ITEMS[id].heal}`, "player");
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
      fx({ kind: "swap", fighterId: s.party[i].id });
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
        />
      </div>

      {/* --- bench ------------------------------------------------------- */}
      {party.length > 1 && (
        <div className="relative flex justify-center gap-3 pb-3">
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
                <div className="text-[10px] text-[var(--ink-3)]">
                  {p.hp}/{p.maxHp}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* --- command bar ------------------------------------------------- */}
      <div className="battle-bar relative grid grid-cols-1 gap-3 border-t border-[rgba(217,180,91,.18)] bg-black/55 p-4 backdrop-blur-md sm:grid-cols-[1fr_380px]">
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
          {outcome === "win" && <div className="title-lg mt-1 text-[15px] text-[#7ddca4]">Victory</div>}
          {outcome === "lose" && <div className="title-lg mt-1 text-[15px] text-[#e0616b]">Defeated…</div>}
        </div>

        <div className="surface-raised p-3">
          {phase === "player" ? (
            <>
              {menu !== "root" && (
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">{menu}</span>
                  <span className="text-[10px] text-[var(--ink-4)]">{glyph("cancel", device.kind)} · back</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
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
                    disabled={o.disabled}
                    style={{ fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}
                    className={`btn px-3 py-2.5 text-[12px] font-semibold ${i === cursor && !o.disabled ? "btn-selected" : ""}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {menu === "fight" && (
                <p className="mt-2.5 border-t border-[rgba(217,180,91,.14)] pt-2.5 text-[11px] leading-relaxed text-[var(--ink-3)]">
                  {MOVES[activeFighter.moves[cursor]]?.desc}
                </p>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[76px] items-center justify-center text-[12px] tracking-[.2em] text-[var(--ink-3)]">
              {phase === "intro" ? "…" : phase === "enemy" ? `${enemy.name} is moving…` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Combatant({
  name, portrait, hp, maxHp, shaking, floats, badge, accent, showNumbers = true, defeated, showPortrait, side,
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
}) {
  return (
    <div className={`relative flex flex-col gap-3 ${side === "enemy" ? "items-end" : "items-start"} ${shaking ? "sb-shake" : ""}`}>
      <div className="combatant-card surface w-[250px] px-4 py-3" style={{ borderColor: `${accent}55` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="title-lg truncate text-[14px] text-[var(--ink-1)]">{name}</span>
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
          <HpBar hp={hp} max={maxHp} width={218} showText={showNumbers} />
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
        <FloatNum key={f.id} text={f.text} crit={f.crit} />
      ))}
    </div>
  );
}

function FloatNum({ text, crit }: { text: string; crit: boolean }) {
  const heal = text.startsWith("+");
  return (
    <div
      className="title-lg pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 text-[26px]"
      style={{
        color: heal ? "#7ddca4" : crit ? "#f2dfa6" : "#e0616b",
        textShadow: "0 3px 12px rgba(0,0,0,.95)",
        animation: "sb-rise .9s ease-out forwards",
      }}
    >
      {text}
      {crit && <span className="ml-1.5 align-super text-[11px] tracking-wider">CRIT</span>}
    </div>
  );
}
