/**
 * rc.33 — a contract's terms and the talk that sets them (ECO-10 + ECO-11).
 *
 * The first describe is the ECO-11 reproduction, written FIRST against
 * rc.32's code (SalaryNegotiator's per-split stepper, economy's hidden
 * reserve). There all three failed: a $1,550/split ask's "−" left the wage
 * shown at $140/wk (also $300, $600 and $2,000 asks); every ask's stepper
 * floor (0.85) sat under the reserve's (0.88), so the lowest offer had 0 %;
 * after one refusal at 95 % the sheet showed 37 % for the same offer, which
 * the hardened reserve refused for sure (11 of 40 players). The same three
 * properties now run on the rc.33 model.
 */

import { describe, expect, it } from "vitest";
import { CAREER_NEGOTIATION, CAREER_PRIZE_SHARE, CAREER_PRIZES } from "@/config/balance";
import {
  contractSharePctFor,
  negotiationAnswerFor,
  negotiationFlexFor,
  perSplitForWeekly,
  prizeShareAskFor,
  prizeShareOfPodium,
  sharePaysOn,
  wageStepWeeklyFor,
} from "@/engine/career/contract";
import { computeSalaryAsk, playerShareFor, prizeFor, quantize, weeklyWage } from "@/engine/career/economy";
import type { Placement } from "@/engine/types";
import type { EventTier } from "@/engine/career/types";

const ASKS = [250, 300, 600, 1_000, 1_550, 2_000, 3_900, 5_600, 12_000, 29_000, 72_000, 180_000];
const FLEXES = [CAREER_NEGOTIATION.flexFloor, 0.95, 0.97, 0.99, 1];

const answer = (wagePerSplit: number, sharePct: number, flex: number, offer?: { weekly?: number; sharePct?: number }) =>
  negotiationAnswerFor({ ask: { wagePerSplit, sharePct }, flex, offer, minWagePerSplit: 250 });

describe("ECO-11 — the wage talk makes sense (the rc.32 reproduction, on the rc.33 model)", () => {
  it("every press of the wage stepper moves the weekly offer the user sees", () => {
    const stuck: string[] = [];
    for (const ask of ASKS) {
      for (const flex of FLEXES) {
        const a = answer(ask, 8, flex);
        // Walk the zone from his ask down to his floor, one press at a time.
        let w = a.zone.topWeekly;
        let guard = 0;
        while (w > a.zone.floorWeekly && guard++ < 200) {
          const next = Math.max(a.zone.floorWeekly, w - a.zone.stepWeekly);
          const shown = answer(ask, 8, flex, { weekly: next });
          if (shown.terms.weekly >= w) stuck.push(`${ask}/split @${flex}: ${w} → ${shown.terms.weekly}`);
          // The contract written pays exactly the weekly wage shown.
          expect(weeklyWage(shown.terms.wagePerSplit)).toBe(shown.terms.weekly);
          w = next;
        }
      }
    }
    expect(stuck).toEqual([]);
  });

  it("the stepper never offers terms the player is sure to refuse", () => {
    for (const ask of ASKS) {
      for (const flex of FLEXES) {
        for (let share = 1; share <= 20; share++) {
          const a = answer(ask, 8, flex, { sharePct: share });
          // The lowest wage the stepper reaches at this share is his floor — and he signs it.
          const low = answer(ask, 8, flex, { sharePct: share, weekly: a.zone.floorWeekly });
          expect(low.accepted).toBe(true);
          expect(low.terms.weekly).toBe(a.zone.floorWeekly);
        }
      }
    }
  });

  it("after a refusal the sheet never shows a deal he would refuse: his counter is the nearest deal, and taking it signs", () => {
    for (const ask of ASKS) {
      for (const flex of FLEXES) {
        for (const share of [5, 8, 11]) {
          const a = answer(ask, 8, flex, { sharePct: share });
          // Every weekly quantum under a small floor; ~40 samples under a big one.
          const stride = Math.max(10, Math.ceil(a.zone.floorWeekly / 40 / 10) * 10);
          const under = new Set<number>([a.zone.floorWeekly - 10]);
          for (let w = 0; w < a.zone.floorWeekly; w += stride) under.add(w);
          for (const w of under) {
            if (w < 0) continue;
            const no = answer(ask, 8, flex, { sharePct: share, weekly: w });
            expect(no.accepted).toBe(false);
            const c = no.counter!;
            // Toward agreement: above the offer, at his floor, the same share, never above his ask.
            expect(c.weekly).toBeGreaterThan(w);
            expect(c.weekly).toBe(a.zone.floorWeekly);
            expect(c.sharePct).toBe(no.offer.sharePct);
            expect(c.weekly).toBeLessThanOrEqual(a.zone.topWeekly);
            // Taking the counter always signs, at exactly those terms.
            const yes = answer(ask, 8, flex, { sharePct: c.sharePct, weekly: c.weekly });
            expect(yes.accepted).toBe(true);
            expect(yes.terms).toEqual(c);
          }
        }
      }
    }
  });
});

describe("ECO-11 — the model's properties", () => {
  it("the full ask always signs, at exactly his ask", () => {
    for (const ask of ASKS) {
      for (const flex of FLEXES) {
        const a = answer(ask, 9, flex);
        expect(a.accepted).toBe(true);
        expect(a.terms).toEqual({ wagePerSplit: ask, weekly: weeklyWage(ask), sharePct: 9 });
        expect(a.savingWeekly).toBe(0);
      }
    }
  });

  it("is monotone: more wage or more share never turns a yes into a counter; the zone falls as the share rises", () => {
    for (const ask of [1_550, 12_000, 72_000]) {
      for (const flex of FLEXES) {
        let prevTop = Infinity;
        let prevFloor = Infinity;
        for (let share = 5; share <= 15; share++) {
          const z = answer(ask, 10, flex, { sharePct: share }).zone;
          expect(z.topWeekly).toBeLessThanOrEqual(prevTop);
          expect(z.floorWeekly).toBeLessThanOrEqual(prevFloor);
          expect(z.floorWeekly).toBeLessThanOrEqual(z.topWeekly);
          prevTop = z.topWeekly;
          prevFloor = z.floorWeekly;
          let seenYes = false;
          for (let w = 0; w <= z.topWeekly + 50; w += 10) {
            const yes = answer(ask, 10, flex, { sharePct: share, weekly: w }).accepted;
            if (seenYes) expect(yes).toBe(true);
            seenYes ||= yes;
            if (yes && share < 15) expect(answer(ask, 10, flex, { sharePct: share + 1, weekly: w }).accepted).toBe(true);
          }
        }
      }
    }
  });

  it("the share moves only inside its bounds, at the bounded exchange rate", () => {
    const S = CAREER_PRIZE_SHARE;
    const a = answer(100_000, 10, 1, { sharePct: 99 });
    expect(a.offer.sharePct).toBe(10 + S.maxAboveAsk);
    expect(a.zone.topPerSplit).toBe(quantize(100_000 * (1 - S.wagePerPoint * S.maxAboveAsk)));
    const b = answer(100_000, 10, 1, { sharePct: 0 });
    expect(b.offer.sharePct).toBe(10 - S.maxBelowAsk);
    expect(b.zone.topPerSplit).toBe(quantize(100_000 * (1 + S.wagePerPoint * S.maxBelowAsk)));
    // Never under minPct / over maxPct, whatever the ask.
    expect(answer(5_000, S.minPct, 1, { sharePct: 0 }).offer.sharePct).toBe(S.minPct);
    expect(answer(5_000, S.maxPct, 1, { sharePct: 99 }).offer.sharePct).toBe(S.maxPct);
  });

  it("is deterministic: the flexibility is a seeded draw per player and window, inside [flexFloor, 1]", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const f = negotiationFlexFor(77, `p${i}`, 2, "w1");
      expect(f).toBe(negotiationFlexFor(77, `p${i}`, 2, "w1"));
      expect(f).toBeGreaterThanOrEqual(CAREER_NEGOTIATION.flexFloor);
      expect(f).toBeLessThanOrEqual(1);
      seen.add(Math.round(f * 100));
    }
    expect(seen.size).toBeGreaterThan(3); // deals vary
    expect(negotiationFlexFor(77, "p1", 2, "w1")).not.toBe(negotiationFlexFor(77, "p1", 2, "w2"));
  });

  it("the weekly money round-trips and the step is whole weekly quanta", () => {
    for (let w = 10; w <= 20_000; w += 10) expect(weeklyWage(perSplitForWeekly(w))).toBe(w);
    for (const ask of ASKS) {
      const step = wageStepWeeklyFor(weeklyWage(ask));
      expect(step % 10).toBe(0);
      expect(step).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("ECO-10 — the prize share each contract carries", () => {
  it("a star asks a bigger share, a young or low player a smaller one", () => {
    const S = CAREER_PRIZE_SHARE;
    expect(prizeShareAskFor({ overall: 90, age: 21 })).toBeGreaterThan(prizeShareAskFor({ overall: 80, age: 21 }));
    expect(prizeShareAskFor({ overall: 80, age: 21 })).toBeGreaterThan(prizeShareAskFor({ overall: 70, age: 21 }));
    expect(prizeShareAskFor({ overall: 80, age: 17 })).toBe(prizeShareAskFor({ overall: 80, age: 21 }) - S.youngDiscount);
    expect(prizeShareAskFor({ overall: 80, age: 21 })).toBe(S.askAtPivot);
    for (let o = 60; o <= 99; o++) {
      const s = prizeShareAskFor({ overall: o, age: 22 });
      expect(s).toBeGreaterThanOrEqual(S.minPct);
      expect(s).toBeLessThanOrEqual(S.maxPct);
    }
  });

  it("three pre-rc.33 deals pay the rc.32 team share, on every podium of every tier", () => {
    const legacy = [{}, {}, {}];
    const tiers: EventTier[] = ["t3", "t2", "qualifier", "regional", "major", "worlds"];
    const places: Placement[] = ["champion", "runner_up", "third", "fourth", "top4", "top6", "top8", "swiss_exit"];
    let floatSlips = 0;
    for (const tier of tiers) {
      for (const pl of places) {
        for (const s of [0, 1, 3, 7]) {
          for (const fmt of ["swiss", "single"] as const) {
            const prize = prizeFor(tier, pl, fmt, "normal", s);
            const old = playerShareFor(tier, pl, prize);
            const now = prizeShareOfPodium(legacy, tier, pl, prize);
            // rc.32's quantize(prize × 0.35) truncated a float a hair under the
            // quantum ($42k × 0.35 → $14,650); the rc.33 sum books the exact one.
            const share = CAREER_PRIZES.playerShare as unknown as Record<string, number>;
            const rate = old > 0 ? share[tier] : 0;
            expect(now).toBe(Math.min(prize, quantize(Math.round(prize * rate * 1e6) / 1e6)));
            if (now !== old) {
              floatSlips += 1;
              expect(now - old).toBe(50);
            }
          }
        }
      }
    }
    expect(floatSlips).toBeLessThan(10);
  });

  it("each played contract keeps its own share; none off the podium or outside a regional, Major or Worlds", () => {
    const squad = [{ prizeSharePct: 10 }, { prizeSharePct: 6 }, { prizeSharePct: 4 }];
    expect(prizeShareOfPodium(squad, "major", "champion", 45_000)).toBe(quantize(45_000 * 0.2));
    expect(prizeShareOfPodium(squad, "regional", "fourth", 4_000)).toBe(quantize(4_000 * 0.2));
    expect(prizeShareOfPodium(squad, "regional", "top8", 1_600)).toBe(0);
    expect(prizeShareOfPodium(squad, "qualifier", "champion", 600)).toBe(0);
    expect(prizeShareOfPodium(squad, "t2", "champion", 4_000)).toBe(0);
    // A mixed squad: an old deal reads the rc.32 rule beside two new ones.
    expect(contractSharePctFor({}, "worlds")).toBeCloseTo((CAREER_PRIZES.playerShare.worlds * 100) / 3, 9);
    expect(prizeShareOfPodium([{}, { prizeSharePct: 10 }], "worlds", "champion", 180_000)).toBe(
      quantize(180_000 * ((CAREER_PRIZES.playerShare.worlds * 100) / 3 + 10) / 100 + 1e-6),
    );
    expect(sharePaysOn("worlds", "champion")).toBe(CAREER_PRIZES.playerShare.enabled);
  });

  // With the share switched off (CAREER_PRIZES.playerShare.enabled false = rc.31) there is no brake to check.
  it.skipIf(!CAREER_PRIZES.playerShare.enabled)("stays a snowball brake (contract e2): a dominant season keeps ≤ 1.5 × three 85s' wages, even at the lowest share", () => {
    const S = CAREER_PRIZE_SHARE;
    // The probe's P2 ask: age 20, potential = overall, rep 100, normal, 2 seasons, the median jitter.
    const ask85 = (s: number) =>
      [...Array.from({ length: 101 }, (_, k) =>
        computeSalaryAsk({
          overall: 85,
          age: 20,
          potential: 85,
          rep: 100,
          seasonIndex: s,
          lengthSeasons: 2,
          difficulty: "normal",
          careerSeed: 9100 + k,
          playerId: `e2:${k}`,
        }),
      )].sort((a, b) => a - b)[50];
    const lowest = prizeShareAskFor({ overall: 85, age: 20 }) - S.maxBelowAsk;
    for (const s of [0, 3, 7]) {
      const kept = (tier: EventTier, n: number) => {
        const prize = prizeFor(tier, "champion", "swiss", "normal", s);
        return n * (prize - prizeShareOfPodium([lowest, lowest, lowest].map((p) => ({ prizeSharePct: p })), tier, "champion", prize));
      };
      const dominantKept = kept("regional", 9) + kept("major", 3) + kept("worlds", 1);
      expect(dominantKept / (3 * 3 * ask85(s))).toBeLessThanOrEqual(1.5);
    }
  });
});
