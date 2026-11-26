/**
 * v2.2 Pro slice 5 (PRO-SPEC §4.2, §6, R150): signature mechanics and the one
 * decision per game. The bounds of the spec and the neutral value of "on
 * instinct" are proved by Monte-Carlo over seeds.
 */

import { describe, expect, it } from "vitest";
import { CAREER_PRO_MOMENTS as M } from "@/config/balance";
import type { GameBoxScore, KeyMoment, MomentType } from "../boxScore";
import { createProPlayer } from "./create";
import { earnedMechanics, MECHANIC_IDS, mechanicRequirement, nextMechanic, syncMechanics } from "./mechanics";
import {
  buildDecision,
  chanceOf,
  EMPTY_LEDGER,
  finalProRating,
  hintOf,
  resolveDecision,
  type DecisionLedger,
  type ProDecision,
} from "./moments";
import { applyBlock, type WeekCtx } from "./week";
import type { CreateProInput, ProPlayer } from "./types";

const INPUT: CreateProInput = { name: "Rookie", country: "br", region: "SAM", startAge: 13, archetype: "allround", difficulty: "normal" };
const ARCHETYPES = ["mechanical", "anchor", "playmaker", "icecold", "veteranmind", "allround"] as const;
const TYPES: MomentType[] = ["decider", "overtimeWinner", "lateGoal", "comeback", "cleanSheet", "saveMarathon", "hatTrick", "demoBlitz"];

const fresh = (over: Partial<ProPlayer> = {}, archetype: ProPlayer["archetype"] = "allround"): ProPlayer => ({
  ...createProPlayer({ ...INPUT, archetype }, 3),
  ...over,
});
const withAll = (v: number) => ({ offense: v, defense: v, mechanics: v, consistency: v, experience: v, clutch: v });

function game(type: MomentType, index = 0, playerIdx: number | null = 1): GameBoxScore {
  const moment: KeyMoment = { type, gameIndex: index, side: "a", playerIdx, period: "regulation", clock: 40, variant: 0, n: 1 };
  return { index, final: [3, 2], overtime: false, players: { a: [], b: [] }, mvp: null, moments: [moment] };
}

const decisionFor = (p: ProPlayer, type: MomentType = "decider", index = 0): ProDecision => buildDecision(game(type, index), { side: "a", proIdx: 1, player: p })!;

describe("Pro mechanics", () => {
  it("unlock in order, each needing blocks and Mechanics, and one never skips another", () => {
    expect(MECHANIC_IDS).toEqual(["wavedash", "speedflip", "airDribble", "ceilingShot", "doubleTap", "mustyFlick", "flipReset"]);
    const p = fresh({ attrs: withAll(99), mechanicsBlocks: 0 });
    expect(earnedMechanics(p)).toEqual([]);
    expect(earnedMechanics({ ...p, mechanicsBlocks: 12 })).toEqual(["wavedash", "speedflip"]);
    expect(earnedMechanics({ ...p, mechanicsBlocks: 999 })).toEqual([...MECHANIC_IDS]);
    // Blocks without the attribute: the first needs Mechanics 55.
    expect(earnedMechanics({ ...p, attrs: withAll(50), mechanicsBlocks: 999 })).toEqual([]);
    // The thresholds rise with the order.
    const reqs = MECHANIC_IDS.map((id) => mechanicRequirement(id)!);
    for (let i = 1; i < reqs.length; i++) {
      expect(reqs[i].blocks).toBeGreaterThan(reqs[i - 1].blocks);
      expect(reqs[i].mechanics).toBeGreaterThan(reqs[i - 1].mechanics);
    }
  });

  it("mechanics training unlocks them with a note, and never takes one away", () => {
    const ctx: WeekCtx = { seasonIndex: 0, day: 1, hasTeam: false, careerSeed: 3 };
    let p = fresh({ attrs: withAll(60), energy: 100 });
    const notes: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = applyBlock({ ...p, energy: 100 }, { kind: "train", focus: "mechanics" }, ctx);
      p = r.player;
      for (const n of r.notes) if (n.code === "mechanicUnlocked") notes.push(n.ref!);
    }
    expect(p.mechanicsBlocks).toBe(12);
    expect(p.mechanics).toEqual(["wavedash", "speedflip"]);
    expect(notes).toEqual(["wavedash", "speedflip"]);
    // Other training does not count as mechanics practice.
    const other = applyBlock({ ...p, energy: 100 }, { kind: "train", focus: "defense" }, ctx).player;
    expect(other.mechanicsBlocks).toBe(12);
    // A decline later does not erase a learned move.
    const worse = syncMechanics({ ...p, attrs: withAll(40) });
    expect(worse.player.mechanics).toEqual(["wavedash", "speedflip"]);
  });

  it("says what the next mechanic still needs", () => {
    const n = nextMechanic(fresh({ attrs: withAll(54), mechanicsBlocks: 1 }))!;
    expect(n.id).toBe("wavedash");
    expect(n.blocksLeft).toBe(3);
    expect(n.mechanicsLeft).toBe(1);
    expect(nextMechanic({ ...fresh(), mechanics: [...MECHANIC_IDS] })).toBeNull();
  });
});

describe("Pro decision: building", () => {
  it("offers two to four options with two always playable; mechanics add a call, locked ones are visible", () => {
    const d0 = decisionFor(fresh());
    expect(d0.options.length).toBeGreaterThanOrEqual(3);
    expect(d0.options.filter((o) => !o.locked).length).toBe(2);
    expect(d0.options.find((o) => o.locked)?.requires).toBe("wavedash");
    const d1 = decisionFor(fresh({ mechanics: ["wavedash", "speedflip"] }));
    expect(d1.options).toHaveLength(4);
    expect(d1.options.filter((o) => !o.locked)).toHaveLength(3);
    expect(d1.options.find((o) => o.kind === "mechanic" && !o.locked)?.id).toBe("speedflip");
    const dAll = decisionFor(fresh({ mechanics: [...MECHANIC_IDS] }));
    expect(dAll.options).toHaveLength(3);
    for (const t of TYPES) {
      const d = decisionFor(fresh(), t);
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      expect(d.options.length).toBeLessThanOrEqual(4);
    }
  });

  it("shows a hint word, never a number, and none for a locked call", () => {
    const d = decisionFor(fresh({ mechanics: ["wavedash"] }));
    for (const o of d.options) {
      if (o.locked) expect(o.hint).toBeNull();
      else expect(["risky", "uncertain", "likely", "mastered"]).toContain(o.hint);
      expect(JSON.stringify(o)).not.toMatch(/\d\.\d/);
    }
    expect(hintOf(0.1)).toBe("risky");
    expect(hintOf(0.5)).toBe("uncertain");
    expect(hintOf(0.7)).toBe("likely");
    expect(hintOf(0.85)).toBe("mastered");
  });

  it("the linked attribute, confidence and energy move the chance", () => {
    const bold = (p: ProPlayer) => decisionFor(p).options.find((o) => o.kind === "bold")!;
    const base = fresh({ attrs: withAll(70), confidence: 0, energy: 100 });
    const c = (p: ProPlayer) => chanceOf(p, bold(p));
    expect(c({ ...base, attrs: { ...base.attrs, clutch: 90 } })).toBeGreaterThan(c(base));
    expect(c({ ...base, confidence: 2 })).toBeGreaterThan(c(base));
    expect(c({ ...base, energy: 10 })).toBeLessThan(c(base));
    expect(c({ ...base, attrs: withAll(30) })).toBeGreaterThanOrEqual(M.chance.floor);
    expect(c({ ...base, attrs: withAll(99), confidence: 2 })).toBeLessThanOrEqual(M.chance.ceil);
  });

  it("returns null for a game with no key moment, and prefers the Pro's own moment", () => {
    const empty: GameBoxScore = { ...game("decider"), moments: [] };
    expect(buildDecision(empty, { side: "a", proIdx: 1, player: fresh() })).toBeNull();
    const two: GameBoxScore = { ...game("cleanSheet", 0, 0), moments: [{ ...game("cleanSheet", 0, 0).moments[0] }, { ...game("hatTrick", 0, 1).moments[0] }] };
    expect(buildDecision(two, { side: "a", proIdx: 1, player: fresh() })!.momentType).toBe("hatTrick");
    expect(buildDecision(two, { side: "a", proIdx: 2, player: fresh() })!.momentType).toBe("cleanSheet");
  });
});

describe("Pro decision: bounds (Monte-Carlo)", () => {
  it("one decision stays inside ±0.5 team and ±1.5 own rating, for every call, style and level", () => {
    let worstTeam = 0;
    let worstRating = 0;
    for (let seed = 0; seed < 2500; seed++) {
      const level = 40 + (seed % 60);
      const arch = ARCHETYPES[seed % 6];
      const p = fresh({ attrs: withAll(level), confidence: ((seed % 5) - 2) as number, energy: (seed * 7) % 101, mechanics: MECHANIC_IDS.slice(0, seed % 8) }, arch);
      const d = decisionFor(p, TYPES[seed % TYPES.length], seed % 7);
      const choices = [...d.options.filter((o) => !o.locked).map((o) => o.id), "instinct", "not-an-option"];
      for (const choice of choices) {
        const r = resolveDecision(d, choice, p, { careerSeed: seed, streamKey: "t" });
        worstTeam = Math.max(worstTeam, Math.abs(r.teamDelta));
        worstRating = Math.max(worstRating, Math.abs(r.ratingDelta));
      }
    }
    expect(worstTeam).toBeLessThanOrEqual(M.bounds.teamPerGame);
    expect(worstRating).toBeLessThanOrEqual(M.bounds.ratingPerGame);
    expect(worstTeam).toBeGreaterThan(0.1);
    expect(worstRating).toBeGreaterThan(0.5);
  });

  it("a series of decisions stays inside ±1.0 on the team, whatever he chooses", () => {
    for (let seed = 0; seed < 600; seed++) {
      const p = fresh({ attrs: withAll(seed % 2 ? 95 : 45), mechanics: MECHANIC_IDS.slice(0, 5), confidence: seed % 2 ? 2 : -2 });
      let ledger: DecisionLedger = EMPTY_LEDGER;
      let sum = 0;
      for (let g = 0; g < 7; g++) {
        const d = decisionFor(p, TYPES[(seed + g) % TYPES.length], g);
        const bold = d.options.filter((o) => !o.locked && o.kind !== "safe").pop()!;
        const r = resolveDecision(d, bold.id, p, { careerSeed: seed, streamKey: "series", ledger });
        expect(Math.abs(r.teamDelta)).toBeLessThanOrEqual(M.bounds.teamPerGame);
        ledger = r.ledger;
        sum += r.teamDelta;
        expect(Math.abs(sum)).toBeLessThanOrEqual(M.bounds.teamPerSeries + 1e-9);
      }
      expect(Math.abs(ledger.team)).toBeLessThanOrEqual(M.bounds.teamPerSeries);
    }
  });

  it("the Pro's final rating never moves more than 1.5 from the box score, and stays 0-10", () => {
    for (const box of [0, 3, 6.4, 9.5, 10]) {
      for (const delta of [-1.5, -0.4, 0, 0.9, 1.5]) {
        for (const conf of [-2, 0, 2]) {
          const r = finalProRating(box, delta, conf);
          expect(Math.abs(r - box)).toBeLessThanOrEqual(M.bounds.ratingPerGame + 0.05);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe("Pro decision: 'on instinct' has neutral expected value (Monte-Carlo)", () => {
  const N = 6000;

  it("averages zero on the team and on his own rating for every style, level, form and tiredness", () => {
    const cases: [ProPlayer["archetype"], number, number, number][] = [
      ["mechanical", 85, 2, 100],
      ["anchor", 60, -1, 80],
      ["playmaker", 75, 0, 40],
      ["icecold", 95, 1, 100],
      ["veteranmind", 50, -2, 20],
      ["allround", 70, 0, 100],
    ];
    for (const [arch, level, conf, energy] of cases) {
      const p = fresh({ attrs: withAll(level), confidence: conf, energy, mechanics: MECHANIC_IDS.slice(0, 3) }, arch);
      let team = 0;
      let rating = 0;
      for (let s = 0; s < N; s++) {
        const d = decisionFor(p, TYPES[s % TYPES.length], s % 5);
        const r = resolveDecision(d, "instinct", p, { careerSeed: s + 1, streamKey: "ev" });
        expect(r.instinct).toBe(true);
        team += r.teamDelta;
        rating += r.ratingDelta;
      }
      expect(Math.abs(team / N)).toBeLessThan(0.012);
      expect(Math.abs(rating / N)).toBeLessThan(0.04);
    }
  });

  it("picking a locked or unknown call is instinct, not an error", () => {
    const p = fresh();
    const d = decisionFor(p);
    const locked = d.options.find((o) => o.locked)!.id;
    expect(resolveDecision(d, locked, p, { careerSeed: 1, streamKey: "x" }).instinct).toBe(true);
    expect(resolveDecision(d, "nope", p, { careerSeed: 1, streamKey: "x" }).instinct).toBe(true);
  });

  it("the style steers instinct: a mechanical player uses his mechanic, an anchor stays safe", () => {
    const mech = fresh({ mechanics: ["wavedash"] }, "mechanical");
    const d1 = decisionFor(mech);
    expect(resolveDecision(d1, "instinct", mech, { careerSeed: 5, streamKey: "s" }).optionId).toBe("wavedash");
    const anchor = fresh({ mechanics: ["wavedash"] }, "anchor");
    const d2 = decisionFor(anchor);
    expect(d2.options.find((o) => o.id === resolveDecision(d2, "instinct", anchor, { careerSeed: 5, streamKey: "s" }).optionId)!.kind).toBe("safe");
  });
});

describe("Pro decision: deciding well pays", () => {
  it("a bold call pays for a high attribute and costs for a low one; instinct is the zero line between", () => {
    const N = 4000;
    const ev = (level: number) => {
      const p = fresh({ attrs: withAll(level), confidence: 0, energy: 100 });
      let t = 0;
      for (let s = 0; s < N; s++) {
        const d = decisionFor(p, "decider", s % 5);
        t += resolveDecision(d, "takeTheShot", p, { careerSeed: s + 1, streamKey: "bold" }).teamDelta;
      }
      return t / N;
    };
    expect(ev(95)).toBeGreaterThan(0.05);
    expect(ev(40)).toBeLessThan(0);
    expect(ev(95)).toBeGreaterThan(ev(70));
  });

  it("is deterministic for the same seed, stream and game", () => {
    const p = fresh();
    const d = decisionFor(p);
    expect(resolveDecision(d, "takeTheShot", p, { careerSeed: 9, streamKey: "a" })).toEqual(resolveDecision(d, "takeTheShot", p, { careerSeed: 9, streamKey: "a" }));
  });
});
