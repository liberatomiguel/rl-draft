/**
 * Road to Worlds — rc.37 front F1 (ROADMAP-NEXT-2026-11-05 §3 F1), the pure
 * engine side: the resale lock's calendar (package 2) and band model 3, the
 * truth at a uniform place inside the potential band (package 4, decision 7).
 * The flows (signing, bids, the title window, the listing) are in
 * store/careerRc37Market.test.ts.
 */

import { describe, expect, it } from "vitest";
import {
  CAREER_ECONOMY,
  CAREER_RENEWAL_TENURE,
  CAREER_SALARY,
  CAREER_SCOUT,
  CAREER_TALENT,
  CAREER_TRANSFER,
  CAREER_VALUATION,
} from "@/config/balance";
import { firstDayOfWeek } from "./calendar";
import { CURRENT_BAND_MODEL, readsUniformBand, scoutedBand } from "./development";
import {
  computeSalaryAsk,
  marketValueFor,
  moneyIndex,
  quantize,
  reachGapFor,
  repPremiumFor,
  salaryAskFactors,
  starCurveFactor,
  talentFactorsFor,
  talentTierOf,
  upsideFactorFor,
  type SalaryAskInput,
} from "./economy";
import { renewalAskFor, resaleLocked } from "./market";
import { renewalLadderFor, renewalTermsFor } from "./renewal";
import type { ScoutLevel } from "./types";

// The calendar (calendar.windowIndexOf): window 0 = weeks 1–2, window 1 =
// weeks 11–12, window 2 = weeks 21–22, window 3 (the Worlds window) = week 31.
const W = { w0: firstDayOfWeek(1), w1: firstDayOfWeek(11), w2: firstDayOfWeek(21), w3: firstDayOfWeek(31) };
const lastDayOfWeek = (week: number) => firstDayOfWeek(week) + 6;

describe("rc.37 F1 — the resale lock (resaleLocked)", () => {
  it("is CAREER_VALUATION.resaleLockWindows = 1: the signing window and the next one", () => {
    expect(CAREER_VALUATION.resaleLockWindows).toBe(1);
  });

  it("signed in window 1: locked through window 2, free once it has closed", () => {
    const p = { joinedSeason: 0, signedDay: W.w1 + 2 };
    expect(resaleLocked(p, 0, W.w1 + 2)).toBe(true); // the day he signed
    expect(resaleLocked(p, 0, lastDayOfWeek(12))).toBe(true); // window 1's last day
    expect(resaleLocked(p, 0, firstDayOfWeek(15))).toBe(true); // between windows
    expect(resaleLocked(p, 0, W.w2)).toBe(true); // the next window
    expect(resaleLocked(p, 0, lastDayOfWeek(22))).toBe(true); // ... to its last day
    expect(resaleLocked(p, 0, firstDayOfWeek(23))).toBe(false); // closed: free
    expect(resaleLocked(p, 0, W.w3)).toBe(false);
    expect(resaleLocked(p, 1, W.w0)).toBe(false);
  });

  it("signed in the Worlds window: the next window is the next season's preseason", () => {
    const p = { joinedSeason: 0, signedDay: W.w3 + 1 };
    expect(resaleLocked(p, 0, lastDayOfWeek(32))).toBe(true);
    expect(resaleLocked(p, 1, W.w0)).toBe(true);
    expect(resaleLocked(p, 1, lastDayOfWeek(2))).toBe(true);
    expect(resaleLocked(p, 1, firstDayOfWeek(3))).toBe(false);
    expect(resaleLocked(p, 1, W.w1)).toBe(false);
  });

  it("signed between windows: locked until the next window has closed", () => {
    const p = { joinedSeason: 2, signedDay: firstDayOfWeek(5) };
    expect(resaleLocked(p, 2, firstDayOfWeek(5))).toBe(true);
    expect(resaleLocked(p, 2, W.w1)).toBe(true);
    expect(resaleLocked(p, 2, lastDayOfWeek(12))).toBe(true);
    expect(resaleLocked(p, 2, firstDayOfWeek(13))).toBe(false);
    expect(resaleLocked(p, 2, W.w2)).toBe(false);
  });

  it("a founder, or a player signed before rc.35 (no signedDay), is never locked", () => {
    expect(resaleLocked({ joinedSeason: 0 }, 0, W.w1)).toBe(false);
    expect(resaleLocked({ joinedSeason: 0 }, 0, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Band model 3 — the truth at a uniform place inside the band
// ---------------------------------------------------------------------------

const width = (l: number) => CAREER_SCOUT.honestWidthByLevel[l] ?? 0;
const bandOf = (potential: number, level: ScoutLevel, seed: number, id: string) =>
  // overall 60 and no age arc: the floor and the age cap never touch the band.
  scoutedBand(potential, 60, level, seed, id, 2, { uniform: true });

describe("rc.37 F1 — band model 3 (decision 7: the truth at a uniform place, rc.33's widths)", () => {
  it("a new career stamps it; rc.33–rc.36 careers (2) and older ones keep their band", () => {
    expect(CURRENT_BAND_MODEL).toBe(3);
    expect(readsUniformBand(3)).toBe(true);
    expect(readsUniformBand(2)).toBe(false);
    expect(readsUniformBand(undefined)).toBe(false);
  });

  it("every level keeps rc.33's width, holds the truth, stays in 60–99 and nests in the band before it", () => {
    for (let n = 0; n < 1_500; n++) {
      const potential = 60 + (n % 40);
      const id = `fic:test:${n}`;
      const seed = 1_000 + (n % 7);
      let outer: { min: number; max: number } | null = null;
      for (const level of [0, 1, 2, 3] as ScoutLevel[]) {
        const b = bandOf(potential, level, seed, id);
        expect(b.max - b.min).toBe(width(level));
        expect(b.min).toBeLessThanOrEqual(potential);
        expect(b.max).toBeGreaterThanOrEqual(potential);
        expect(b.min).toBeGreaterThanOrEqual(60);
        expect(b.max).toBeLessThanOrEqual(99);
        if (outer) {
          expect(b.min).toBeGreaterThanOrEqual(outer.min);
          expect(b.max).toBeLessThanOrEqual(outer.max);
        }
        outer = b;
      }
    }
  });

  it("the unscouted band: the truth is equally likely at each of its points (no more 'top 3')", () => {
    const counts = new Array(width(0) + 1).fill(0);
    const N = 6_000;
    for (let n = 0; n < N; n++) {
      const potential = 70 + (n % 20); // 70–89: never clamped by 60 or 99
      const b = bandOf(potential, 0, 7, `fic:u:${n}`);
      counts[b.max - potential] += 1;
    }
    const expected = N / counts.length;
    for (const c of counts) expect(Math.abs(c - expected)).toBeLessThan(expected * 0.12);
    // rc.33's band never put the truth more than bandMaxAbove under its top.
    const deep = counts.slice(CAREER_SCOUT.bandMaxAbove + 1).reduce((s, c) => s + c, 0);
    expect(deep / N).toBeGreaterThan(0.4);
  });

  it("the deepest paid report keeps its whole uncertainty, read against the bands seen before it", () => {
    // Where the truth sits in the level-2 band (its top or its floor) must not
    // follow from how the three bands stack — a stack sharing one top, rc.33's
    // collapse onto the top, would point at the truth.
    const byStack = new Map<string, { top: number; n: number }>();
    for (let n = 0; n < 8_000; n++) {
      const potential = 70 + (n % 20);
      const [b0, b1, b2] = ([0, 1, 2] as ScoutLevel[]).map((l) => bandOf(potential, l, 11, `fic:s:${n}`));
      const key = `${b0.max - b1.max}:${b1.max - b2.max}`;
      const row = byStack.get(key) ?? { top: 0, n: 0 };
      row.n += 1;
      if (b2.max === potential) row.top += 1;
      byStack.set(key, row);
    }
    for (const [key, row] of byStack) {
      if (row.n < 300) continue;
      expect(Math.abs(row.top / row.n - 0.5), `stack ${key}`).toBeLessThan(0.08);
    }
  });

  it("level 1 (founders, the first auto-reveal, the first report): uniform, and all four points stay possible read against level 0", () => {
    const counts = [0, 0, 0, 0];
    const byStack = new Map<number, number[]>();
    const N = 8_000;
    for (let n = 0; n < N; n++) {
      const potential = 70 + (n % 20);
      const [b0, b1] = ([0, 1] as ScoutLevel[]).map((l) => bandOf(potential, l, 13, `fic:l1:${n}`));
      counts[b1.max - potential] += 1;
      const d = b0.max - b1.max;
      const row = byStack.get(d) ?? [0, 0, 0, 0];
      row[b1.max - potential] += 1;
      byStack.set(d, row);
    }
    for (const c of counts) expect(Math.abs(c - N / 4)).toBeLessThan((N / 4) * 0.1);
    // No stack of the two bands pins the truth to fewer points (rc.37 review: a band 1
    // centred in band 0 left only its two middle points).
    for (const [d, row] of byStack) {
      const n = row.reduce((s, c) => s + c, 0);
      if (n < 300) continue;
      for (const c of row) expect(c / n, `stack ${d}: ${row.join("/")}`).toBeGreaterThan(0.1);
    }
  });

  it("is stable: the same player, seed and level always read the same band", () => {
    const a = bandOf(84, 1, 99, "real:someone");
    const b = bandOf(84, 1, 99, "real:someone");
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Package 2 — valuation by talent (one helper: economy.talentFactorsFor)
// ---------------------------------------------------------------------------

const S = CAREER_SALARY;
/** rc.36's age and potential factors, inline (the reference the bulk must match bit for bit). */
const rc36AgeF = (age: number) =>
  age <= 18 ? S.ageFactor.u18 : age <= 22 ? S.ageFactor.a19_22 : age <= 24 ? S.ageFactor.a23_24 : S.ageFactor.a25plus;
const rc36PotF = (ovr: number, pot: number) => Math.min(S.potentialCap, 1 + S.potentialPerPoint * Math.max(0, pot - ovr));
const rc36Value = (ovr: number, pot: number, age: number, s = 0) =>
  quantize(
    Math.max(
      CAREER_TRANSFER.minFee * moneyIndex(s, "wages"),
      S.basePerSplit *
        Math.pow(S.growthPerPoint, ovr - S.anchorOverall) *
        starCurveFactor(ovr) *
        moneyIndex(s, "wages") *
        rc36AgeF(age) *
        rc36PotF(ovr, pot) *
        CAREER_TRANSFER.valueMultiple,
    ),
  );
const arc = (peakAge: number, plateauYears: number) => ({ peakAge, plateauYears });
const value = (ovr: number, pot: number, age: number, a?: { peakAge: number; plateauYears: number }) =>
  marketValueFor({ overall: ovr, potential: pot, age, seasonIndex: 0, ...a });
const ask = (ovr: number, pot: number, age: number, a?: { peakAge: number; plateauYears: number }) =>
  computeSalaryAsk({
    overall: ovr,
    potential: pot,
    age,
    rep: 40,
    seasonIndex: 0,
    lengthSeasons: 1,
    difficulty: "normal",
    careerSeed: 42,
    playerId: "test:f1",
    ...a,
  });

describe("rc.37 F1 — the upside tiers (no saturation at gap 15)", () => {
  it("rc.36's 0.02 a point up to gap 10 (bit-identical), then steeper tiers that never saturate", () => {
    expect(CAREER_TALENT.upsideTiers[0].perPoint).toBe(S.potentialPerPoint);
    for (let g = 0; g <= 10; g++) expect(upsideFactorFor(g)).toBe(1 + S.potentialPerPoint * g);
    const pins: [number, number][] = [[11, 1.24], [15, 1.4], [16, 1.46], [20, 1.7], [21, 1.78], [28, 2.34], [39, 3.22]];
    for (const [g, f] of pins) expect(upsideFactorFor(g)).toBeCloseTo(f, 9);
    for (let g = 1; g <= 39; g++) expect(upsideFactorFor(g)).toBeGreaterThan(upsideFactorFor(g - 1));
  });

  it("promising / high / exceptional / generational by reach gap (none under prospectUpside)", () => {
    expect(talentTierOf(CAREER_TRANSFER.prospectUpside - 1)).toBeNull();
    expect(talentTierOf(6)).toBe("promising");
    expect(talentTierOf(15)).toBe("high");
    expect(talentTierOf(20)).toBe("exceptional");
    expect(talentTierOf(28)).toBe("generational");
  });

  it("the reach gap is the potential the age clock still lets him close (never past his plateau)", () => {
    expect(reachGapFor({ overall: 70, potential: 98, age: 17, ...arc(22, 3) })).toBe(28);
    expect(reachGapFor({ overall: 70, potential: 98, age: 21, ...arc(20, 2) })).toBe(7);
    expect(reachGapFor({ overall: 70, potential: 98, age: 21, ...arc(20, 1) })).toBe(0);
    expect(reachGapFor({ overall: 85, potential: 88, age: 25, ...arc(22, 2) })).toBe(0);
    expect(reachGapFor({ overall: 84, potential: 98, age: 19, ...arc(22, 3) })).toBe(14);
    // Without an arc: the raw gap; a peak age alone is no arc.
    expect(reachGapFor({ overall: 70, potential: 98, age: 17 })).toBe(28);
    expect(talentFactorsFor({ overall: 70, potential: 98, age: 21, peakAge: 20 }).hasArc).toBe(false);
  });

  it("an u18 talent climbs to the 19–22 age factor (gap 3 → 6); an u18 without upside keeps 0.9", () => {
    const ageF = (g: number) => talentFactorsFor({ overall: 70, potential: 70 + g, age: 17, ...arc(22, 3) }).age;
    expect(ageF(3)).toBe(S.ageFactor.u18);
    expect(ageF(4)).toBeCloseTo(0.9 + 0.2 / 3, 9);
    expect(ageF(5)).toBeCloseTo(0.9 + 0.4 / 3, 9);
    expect(ageF(6)).toBe(S.ageFactor.a19_22);
    expect(ageF(10)).toBe(S.ageFactor.a19_22);
    for (let age = 19; age <= 30; age++) {
      for (let g = 0; g <= 29; g++) {
        expect(talentFactorsFor({ overall: 70, potential: 70 + g, age, ...arc(40, 4) }).age).toBe(rc36AgeF(age));
      }
    }
  });
});

describe("rc.37 F1 — value by profile (Miguel's checks)", () => {
  it("70/85 vs 70/98: the exceptional talent is worth clearly more (rc.36: the same price)", () => {
    const B = value(70, 80, 17, arc(21, 2));
    const C = value(70, 85, 17, arc(21, 2));
    const D = value(70, 98, 17, arc(22, 3));
    expect(C).toBe(quantize(1_500 * 1.1 * 1.4 * CAREER_TRANSFER.valueMultiple));
    expect(D).toBe(quantize(1_500 * 1.1 * 2.34 * CAREER_TRANSFER.valueMultiple));
    expect(D / C).toBeGreaterThan(1.6);
    expect(rc36Value(70, 98, 17) / rc36Value(70, 85, 17)).toBe(1);
    expect(C).toBeGreaterThan(B);
    expect(B).toBeGreaterThan(value(70, 70, 21, arc(21, 2)));
  });

  it("17 vs 21: young age never makes a talent cheaper (rc.36: the 17-year-old cost 18 % less)", () => {
    expect(value(70, 85, 17, arc(21, 2))).toBe(value(70, 85, 21, arc(23, 2)));
    expect(value(70, 98, 17, arc(22, 3))).toBe(value(70, 98, 21, arc(24, 2)));
    expect(ask(70, 85, 17, arc(21, 2))).toBe(ask(70, 85, 21, arc(23, 2)));
    expect(ask(70, 98, 17, arc(22, 3))).toBe(ask(70, 98, 21, arc(24, 2)));
    expect(rc36Value(70, 85, 17) / rc36Value(70, 85, 21)).toBeCloseTo(0.818, 2);
  });

  it("the DevelopmentProfile prices him: the later his arc closes, the more his upside is worth", () => {
    const late = value(70, 98, 21, arc(24, 2));
    const standard = value(70, 98, 21, arc(22, 2));
    const early = value(70, 98, 21, arc(20, 2));
    const done = value(70, 98, 21, arc(20, 1));
    expect(late).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(early);
    expect(early).toBeGreaterThan(done);
    expect(done).toBe(value(70, 70, 21, arc(20, 1)));
  });

  it("past his plateau an unreachable potential is not paid (rc.36 paid +2 % a point); no arc = rc.36", () => {
    expect(value(85, 88, 25, arc(22, 2))).toBe(value(85, 85, 25, arc(22, 2)));
    expect(value(85, 88, 25)).toBe(rc36Value(85, 88, 25));
  });

  it("the bulk is rc.36 bit for bit: no arc at 19+ (any gap) and u18 gaps ≤ 3; an arc whose reach is its raw gap ≤ 10", () => {
    let checked = 0;
    for (let ovr = 60; ovr <= 95; ovr += 1) {
      for (let g = 0; g <= 30; g += 1) {
        const pot = Math.min(99, ovr + g);
        for (let age = 16; age <= 30; age++) {
          if (age <= 18 && pot - ovr > 3) continue;
          expect(value(ovr, pot, age)).toBe(rc36Value(ovr, pot, age));
          if (age >= 19 && pot - ovr <= 10) expect(value(ovr, pot, age, arc(40, 4))).toBe(rc36Value(ovr, pot, age));
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });

  it("the ask and its readout read the same factors (the readout reconciles)", () => {
    const cases: [number, number, number, { peakAge: number; plateauYears: number }][] = [
      [70, 85, 17, arc(21, 2)],
      [70, 98, 17, arc(22, 3)],
      [85, 88, 25, arc(22, 2)],
      [80, 90, 19, arc(22, 2)],
    ];
    for (const [ovr, pot, age, a] of cases) {
      for (const lengthSeasons of [1, 3] as const) {
        const input: SalaryAskInput = {
          overall: ovr,
          potential: pot,
          age,
          rep: 40,
          seasonIndex: 0,
          lengthSeasons,
          difficulty: "normal",
          careerSeed: 42,
          playerId: "test:f1",
          ...a,
        };
        const factors = salaryAskFactors(input);
        const sum = factors.reduce((s, f) => s + f.delta, 0);
        expect(Math.abs(sum - computeSalaryAsk(input))).toBeLessThanOrEqual(CAREER_ECONOMY.roundQuantum + factors.length);
      }
    }
  });

  it("time alone never adds value: a season older at the same level never prices higher (beyond rc.36's u18 step)", () => {
    // value ∝ curve(ovr) × index(s) × age factor × upside factor: compare the talent factors only.
    const f = (x: Parameters<typeof talentFactorsFor>[0]) => {
      const t = talentFactorsFor(x);
      return t.age * t.potential;
    };
    let rises = 0;
    for (let ovr = 60; ovr <= 95; ovr += 5) {
      for (let pot = ovr; pot <= 99; pot += 3) {
        for (let age = 16; age <= 29; age++) {
          for (let peakAge = 17; peakAge <= 26; peakAge++) {
            for (let pl = 1; pl <= 4; pl++) {
              const now = f({ overall: ovr, potential: pot, age, peakAge, plateauYears: pl });
              const later = f({ overall: ovr, potential: pot, age: age + 1, peakAge, plateauYears: pl });
              if (later <= now + 1e-12) continue;
              rises += 1;
              // The only rise left: an u18 without real upside turning 19 (rc.36's own ×1.22 step).
              expect(age).toBe(18);
              expect(reachGapFor({ overall: ovr, potential: pot, age, peakAge, plateauYears: pl })).toBeLessThan(CAREER_TALENT.u18TalentRampTo);
              expect(later / now).toBeLessThanOrEqual(S.ageFactor.a19_22 / S.ageFactor.u18 + 1e-12);
            }
          }
        }
      }
    }
    expect(rises).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Package 3 — renewals: protection, the tenure ladder, the top's extremes
// ---------------------------------------------------------------------------

const renewCtx = (seasonIndex: number, rep = 50) => ({
  rep,
  seasonIndex,
  difficulty: "normal" as const,
  careerSeed: 42,
  lengthSeasons: 1 as const,
});
type Renewer = Parameters<typeof renewalTermsFor>[0];
/** A player whose potential equals his overall: his profile cannot move his core ask. */
const renewer = (over: Partial<Renewer> = {}): Renewer => ({
  id: "test:renew",
  overall: 84,
  potential: 84,
  birthYear: 2000,
  salaryPerSplit: 5_000,
  ...over,
});

describe("rc.37 F1 — renewals approach the market with his seasons at the club", () => {
  it("the ladder: rc.36 for a first renewal at any tenure and while tenure ≤ 2; then the jump ×2.75 / ×3.0 (the floor stays 0.6)", () => {
    const R = CAREER_RENEWAL_TENURE;
    for (let t = 0; t <= 8; t++) {
      expect(renewalLadderFor({ joinedSeason: 10 - t, renewalCount: 0 }, 10)).toMatchObject({ tenureSteps: 0, floorShare: 0.6, maxJump: 2.5 });
      expect(renewalLadderFor({ joinedSeason: 10 - t }, 10)).toMatchObject({ tenureSteps: 0, floorShare: 0.6, maxJump: 2.5 });
    }
    const rows: [number, number, number][] = [
      [2, 0, 2.5],
      [3, 1, 2.75],
      [4, 2, 3.0],
      [5, 3, 3.0],
      [8, 6, 3.0],
    ];
    for (const [tenure, steps, jump] of rows) {
      const l = renewalLadderFor({ joinedSeason: 10 - tenure, renewalCount: 1 }, 10);
      expect(l.tenure).toBe(tenure);
      expect(l.tenureSteps).toBe(steps);
      expect(l.maxJump).toBeCloseTo(jump, 9);
      // rc.37 default: no floor ladder (measured: it repriced ordinary players); the tunables bring one back.
      expect(l.floorShare).toBeCloseTo(Math.min(R.floorMax, S.renewalMarketFloor + R.floorPerSeason * steps), 9);
      expect(l.floorShare).toBe(S.renewalMarketFloor);
    }
  });

  it("protection: a first renewal prices exactly as rc.36 (floor 60 %, ×2.5), whatever his tenure", () => {
    for (const salary of [500, 3_000, 9_000, 20_000]) {
      for (const tenure of [0, 3, 6]) {
        const terms = renewalTermsFor(renewer({ salaryPerSplit: salary, joinedSeason: 6 - tenure }), renewCtx(6));
        const core = terms.freshAsk; // not ambitious, no refusal: the core is his fresh ask
        const raiseCap = quantize(salary * S.renewalRaiseCap);
        const marketFloor = Math.min(quantize(core * S.renewalMarketFloor), Math.max(quantize(salary * S.renewalMaxJump), raiseCap));
        expect(terms.marketFloor).toBe(marketFloor);
        expect(terms.ask).toBe(Math.min(core, Math.max(raiseCap, marketFloor)));
      }
    }
  });

  it("past the protection the jump climbs: a long-tenured developed player renews far closer to his market", () => {
    const core = renewalTermsFor(renewer(), renewCtx(6)).freshAsk;
    const at = (tenure: number, salary: number) =>
      renewalTermsFor(renewer({ salaryPerSplit: salary, joinedSeason: 6 - tenure, renewalCount: 1 }), renewCtx(6));
    // 1 % of his market (a formed prospect): the jump bounds it (×3.0 from 2 steps; rc.36 ×2.5).
    const tiny = Math.max(250, quantize(core * 0.01));
    expect(at(4, tiny).bound).toBe("jump");
    expect(at(4, tiny).ask).toBe(quantize(tiny * 3));
    expect(at(3, tiny).ask).toBe(quantize(tiny * 2.75));
    expect(at(0, tiny).ask).toBe(quantize(tiny * 2.5));
    // An ordinary player on half his market: rc.36's rule at any tenure (the raise cap, ×1.75).
    const half = quantize(core * 0.5);
    for (const t of [0, 3, 5, 8]) expect(at(t, half).ask).toBe(Math.min(core, quantize(half * S.renewalRaiseCap)));
    // The ask never falls as his tenure grows.
    for (const salary of [tiny, half, quantize(core * 0.3)]) {
      let prev = 0;
      for (let t = 0; t <= 10; t++) {
        const a = at(t, salary).ask;
        expect(a).toBeGreaterThanOrEqual(prev);
        prev = a;
      }
    }
  });

  it("the top's extremes: no renewal multiplies a wage by more than jumpMax × premiumMax (×4.35; rc.36 ×4.47)", () => {
    const R = CAREER_RENEWAL_TENURE;
    for (const rep of [10, 30, 50, 80]) {
      for (const share of [0.01, 0.1, 0.4, 1]) {
        for (const refused of [false, true]) {
          for (const titles of [0, 1, 3]) {
            for (const renewalCount of [0, 1]) {
              const base = renewer({ overall: 92, potential: 92, joinedSeason: 0, renewalCount });
              const core = renewalTermsFor(base, renewCtx(8, rep)).freshAsk;
              const p: Renewer = {
                ...base,
                salaryPerSplit: Math.max(250, quantize(core * share)),
                ...(refused ? { contractEndSeason: 8, blockbusterRefusedUntil: 8 } : {}),
              };
              const terms = renewalTermsFor(p, { ...renewCtx(8, rep), titles: { majorOrWorlds: titles, regional: 0 } });
              if (terms.bound !== "fresh") expect(terms.ask).toBeLessThanOrEqual(p.salaryPerSplit * R.jumpMax * R.premiumMax + 1);
              expect(terms.premiumMult).toBeLessThanOrEqual(R.premiumMax + 1e-9);
            }
          }
        }
      }
    }
  });

  it("a 95 at a rep-30 org, ambitious, a refused Blockbuster and 3 titles: the stack is capped at ×2.2 his rep-neutral price", () => {
    const titles = { majorOrWorlds: 3, regional: 0 };
    const p = renewer({ overall: 95, potential: 95, joinedSeason: 0, contractEndSeason: 3, blockbusterRefusedUntil: 3 });
    const probe = renewalTermsFor(p, { ...renewCtx(3, 30), titles });
    const capped = renewalTermsFor({ ...p, salaryPerSplit: probe.freshAsk }, { ...renewCtx(3, 30), titles });
    expect(capped.ambitious).toBe(true);
    expect(capped.premiumCapped).toBe(true);
    expect(capped.premiumMult).toBeCloseTo(CAREER_RENEWAL_TENURE.premiumStackCap / repPremiumFor(95, 30), 9);
    // Paid his fresh ask: bound "fresh", the cap applied to his core ask (no premium in it).
    const core = renewalAskFor(p, { ...renewCtx(3, 30), surcharges: false });
    expect(capped.bound).toBe("fresh");
    expect(capped.ask).toBe(quantize(core * capped.premiumMult));
    // rc.36 asked his fresh ask (ambition and the surcharge in it) × 1.30 for the titles.
    expect(capped.ask).toBeLessThan(quantize(capped.freshAsk * 1.3));
    // rc.31's "fresh" rule (the switch-back) caps the stack the same way.
    const rule = S as { renewalRule: "capFloor" | "fresh" };
    const was = rule.renewalRule;
    try {
      rule.renewalRule = "fresh";
      const fresh = renewalTermsFor({ ...p, salaryPerSplit: probe.freshAsk }, { ...renewCtx(3, 30), titles });
      expect(fresh.rule).toBe("fresh");
      expect(fresh.premiumCapped).toBe(true);
      expect(fresh.ask).toBe(quantize(core * fresh.premiumMult));
    } finally {
      rule.renewalRule = was;
    }
    // A stack under the caps keeps rc.36's path: refused + 3 titles at rep 80 (not ambitious, ×1.43).
    const high = renewalTermsFor(
      renewer({ overall: 95, potential: 95, joinedSeason: 0, contractEndSeason: 3, blockbusterRefusedUntil: 3, salaryPerSplit: 1_000_000 }),
      { ...renewCtx(3, 80), titles },
    );
    expect(high.ambitious).toBe(false);
    expect(high.premiumCapped).toBe(false);
    expect(high.premiumMult).toBeCloseTo(S.blockbusterRefusalRenewalMult * 1.3, 9);
  });
});
