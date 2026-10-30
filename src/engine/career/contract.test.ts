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
  negotiationRollFor,
  perSplitForWeekly,
  prizeShareAskFor,
  prizeShareOfPodium,
  sharePaysOn,
  sharePointWeeklyFor,
  talkPressFor,
  talkSetFor,
  wageStepWeeklyFor,
  type ContractOffer,
  type NegotiationAnswer,
  type TalkLever,
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
            // rc.35: the wage never goes under the league minimum (an offer under it reads as it).
            if (w < a.zone.minWeekly) continue;
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
        expect(a.terms).toEqual({ wagePerSplit: ask, weekly: weeklyWage(ask), sharePct: 9, bonus: 0 });
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
    // The exchange rate is in weekly money: wagePerPoint of his weekly ask, whole weekly quanta.
    const point = sharePointWeeklyFor(weeklyWage(100_000));
    expect(point).toBe(Math.round((weeklyWage(100_000) * S.wagePerPoint) / 10) * 10);
    const a = answer(100_000, 10, 1, { sharePct: 99 });
    expect(a.offer.sharePct).toBe(10 + S.maxAboveAsk);
    expect(a.zone.topWeekly).toBe(weeklyWage(100_000) - S.maxAboveAsk * point);
    expect(a.zone.topPerSplit).toBe(perSplitForWeekly(a.zone.topWeekly));
    const b = answer(100_000, 10, 1, { sharePct: 0 });
    expect(b.offer.sharePct).toBe(10 - S.maxBelowAsk);
    expect(b.zone.topWeekly).toBe(weeklyWage(100_000) + S.maxBelowAsk * point);
    expect(b.zone.topPerSplit).toBe(perSplitForWeekly(b.zone.topWeekly));
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

describe("ECO-10/11 — the share lever moves the wage shown (rc.33 review)", () => {
  // rc.33's first cut priced a share point per split ($50 quanta) and then
  // rounded to the $10 weekly label: at a $1,500/split ask, 5–8 % all paid
  // $140/wk, and 6.4 % of the share presses over $1k–$30k asks moved nothing.
  it("over a grid of asks, every ±1 share press moves his top weekly wage the right way, by whole weekly quanta", () => {
    const asks = [...ASKS];
    for (let a = 1_000; a <= 30_000; a += 50) asks.push(a);
    const stuck: string[] = [];
    let presses = 0;
    for (const ask of asks) {
      for (const askShare of [3, 8, 13]) {
        const { shareMin, shareMax } = answer(ask, askShare, 0.97).zone;
        let prev: number | null = null;
        for (let s = shareMin; s <= shareMax; s++) {
          const a = answer(ask, askShare, 0.97, { sharePct: s });
          // The contract written pays exactly the weekly wage shown, and his ask at this share is what the sheet shows.
          expect(weeklyWage(a.zone.topPerSplit)).toBe(a.zone.topWeekly);
          expect(a.terms.weekly).toBe(a.zone.topWeekly);
          if (prev !== null) {
            presses += 1;
            // One more point lowers his wage (one fewer raises it) by at least one weekly quantum.
            if (!(prev - a.zone.topWeekly >= 10)) stuck.push(`${ask}/split @${askShare}%: ${s - 1}% → ${s}%: ${prev} → ${a.zone.topWeekly}`);
          }
          prev = a.zone.topWeekly;
        }
      }
    }
    expect(presses).toBeGreaterThan(1_000);
    expect(stuck).toEqual([]);
  });

  it("a share point is worth the same weekly money each press, and the lever stops where the wage would pass the minimum", () => {
    // The reproduction's ask: $1,500/split at 8 % — every share from 5 % to 12 % now pays its own weekly wage.
    const tops = [5, 6, 7, 8, 9, 10, 11, 12].map((s) => answer(1_500, 8, 1, { sharePct: s }).zone.topWeekly);
    expect(new Set(tops).size).toBe(tops.length);
    for (const ask of ASKS) {
      const a = answer(ask, 8, 1);
      const point = sharePointWeeklyFor(weeklyWage(ask));
      expect(point % 10).toBe(0);
      expect(point).toBeGreaterThanOrEqual(10);
      expect(a.zone.pointWeekly).toBe(point);
      for (let s = a.zone.shareMin; s <= a.zone.shareMax; s++) {
        const z = answer(ask, 8, 1, { sharePct: s }).zone;
        expect(z.topWeekly).toBe(weeklyWage(ask) - (s - 8) * point);
        // Never under the least a contract may pay.
        expect(z.topPerSplit).toBeGreaterThanOrEqual(Math.min(ask, 250));
      }
    }
    // An ask at the minimum wage: no share point over his ask has a wage left to trade.
    expect(answer(250, 8, 1).zone.shareMax).toBe(8);
  });

  it("with the prize share switched off, the share is pinned to his ask: no wage trade, no lever", () => {
    expect(answer(12_000, 8, 0.97).zone.shareLever).toBe(CAREER_PRIZES.playerShare.enabled);
    const share = CAREER_PRIZES.playerShare as unknown as { enabled: boolean };
    const was = share.enabled;
    share.enabled = false;
    try {
      for (const ask of ASKS) {
        for (const offered of [1, 5, 8, 12, 20]) {
          const a = answer(ask, 8, 0.97, { sharePct: offered });
          expect(a.zone.shareLever).toBe(false);
          expect([a.zone.shareMin, a.zone.shareMax, a.offer.sharePct, a.terms.sharePct]).toEqual([8, 8, 8, 8]);
          // A share nobody is paid buys no wage: the top is his ask.
          expect(a.zone.topWeekly).toBe(weeklyWage(ask));
          expect(a.zone.topPerSplit).toBe(ask);
        }
      }
    } finally {
      share.enabled = was;
    }
  });
});

describe("rc.34 front I — both levers always move (Miguel 31/10: \"sometimes you just can't move anything\")", () => {
  // Reproduced FIRST on rc.33's model and sheet, over real careers (the
  // founders' renewals at 1–3 seasons, founders grown 6 points, every market
  // player and rookie). There: (a) the zone was
  // (1 − flex) × his ask with its floor rounded UP to the $10 weekly grid, so
  // a $100/wk ask (a founder renewing, flex 0.951) had floor = top and both
  // wage buttons disabled — 85 % of the founders' renewals and 63 % of the
  // market's rookies over 7 regions × 3 rosters × 3 difficulties; (b) a share
  // press kept the offered wage, so "share −" at his ask left the wage shown
  // as it was and made him counter (every talk had such a press); (c) no
  // closed way said why. The presses below are the engine's own
  // (`talkPressFor`), the ones the sheet renders.
  const LOW_ASKS = [250, 300, 400, 500, 650, 800, 1_100, 1_550, 2_150, 3_200, 4_300];
  const GRID_ASKS = [...LOW_ASKS, 5_600, 9_700, 12_000, 21_350, 29_000, 72_000, 180_000];
  const GRID_SHARES = [0, 1, 2, 4, 7, 13, 18];
  const GRID_FLEXES = [CAREER_NEGOTIATION.flexFloor, 0.951, 0.97, 0.99, 0.999, 1];
  const q = 10;
  const PRESSES: [TalkLever, 1 | -1][] = [
    ["wage", -1],
    ["wage", 1],
    ["share", -1],
    ["share", 1],
  ];
  const limitOf = (a: NegotiationAnswer, lever: TalkLever, dir: 1 | -1) =>
    lever === "wage" ? (dir < 0 ? a.limits.wageDown : a.limits.wageUp) : dir < 0 ? a.limits.shareDown : a.limits.shareUp;

  /** Every state the sheet's presses reach from his ask (breadth-first), with its answer. */
  function reachable(talk: (o?: ContractOffer) => NegotiationAnswer, cap = 300): NegotiationAnswer[] {
    const seen = new Map<string, NegotiationAnswer>();
    const queue: (ContractOffer | undefined)[] = [undefined];
    while (queue.length && seen.size < cap) {
      const a = talk(queue.shift());
      const key = `${a.offer.weekly}|${a.offer.sharePct}`;
      // rc.35: a press may leave the zone (his odds fall); the walk stays on deals he signs.
      if (seen.has(key) || !a.accepted) continue;
      seen.set(key, a);
      for (const [lever, dir] of PRESSES) {
        const next = talkPressFor(a, lever, dir);
        if (next) queue.push(next);
      }
    }
    return [...seen.values()];
  }

  it("the rc.33 reproductions: a $100/wk ask can be lowered, and lowering his share raises the wage instead of making him counter", () => {
    // (a) The founder's renewal: $1,100/split ($100 a week), flex 0.951.
    const a = answer(1_100, 0, 0.951);
    expect(a.zone.topWeekly).toBe(100);
    expect(a.zone.floorWeekly).toBeLessThan(100);
    const down = talkPressFor(a, "wage", -1)!;
    expect(down.weekly).toBe(100 - wageStepWeeklyFor(100));
    expect(answer(1_100, 0, 0.951, down).accepted).toBe(true);
    // (b) A $2,000/wk ask at 7 %, flex 0.99: "share −" at his ask.
    const b = answer(21_350, 7, 0.99);
    expect(b.zone.topWeekly).toBe(2_000);
    const less = talkPressFor(b, "share", -1)!;
    const after = answer(21_350, 7, 0.99, less);
    expect(after.offer.sharePct).toBe(6);
    expect(after.offer.weekly).toBe(2_000 + b.zone.pointWeekly);
    expect(after.accepted).toBe(true);
    // rc.33's press (the wage kept) is still answered — a counter when it falls under his floor — but the sheet never makes it.
    expect(answer(21_350, 7, 0.99, { weekly: 2_000, sharePct: 6 }).accepted).toBe(after.zone.floorWeekly <= 2_000);
  });

  it("over a grid of asks ($20–$17k a week), shares and flexibilities: the wage moves at least minZoneSteps presses below his ask, unless he asks the league minimum", () => {
    for (const ask of GRID_ASKS) {
      for (const share of GRID_SHARES) {
        for (const flex of GRID_FLEXES) {
          const a = answer(ask, share, flex);
          const atMinimum = a.ask.weekly <= a.zone.minWeekly;
          if (atMinimum) {
            expect(talkPressFor(a, "wage", -1)).toBeNull();
            expect(a.limits.wageDown).toBe("minimum");
            continue;
          }
          let cur = a;
          let presses = 0;
          // rc.35: the wage may go under his floor (his odds fall); count the presses inside the zone.
          for (
            let next = talkPressFor(cur, "wage", -1);
            next && (next.weekly ?? 0) >= a.zone.floorWeekly;
            next = talkPressFor(cur, "wage", -1)
          ) {
            cur = answer(ask, share, flex, next);
            presses += 1;
            expect(cur.accepted).toBe(true);
          }
          expect(presses, `${ask}/split ${share}% @${flex}`).toBeGreaterThanOrEqual(CAREER_NEGOTIATION.minZoneSteps);
          expect(cur.offer.weekly - a.zone.floorWeekly).toBeLessThan(a.zone.stepWeekly);
          // The zone keeps his flexibility (rounded down to the grid) when it is wider than the minimum.
          expect(a.zone.topWeekly - a.zone.floorWeekly).toBeGreaterThanOrEqual(
            Math.min(a.ask.weekly - a.zone.minWeekly, Math.floor(((1 - flex) * a.ask.weekly) / q + 1e-9) * q),
          );
        }
      }
    }
  });

  it("every press the sheet can make moves the number it names; a share press moves the wage one point the other way and never turns a yes into a counter", () => {
    let states = 0;
    for (const ask of GRID_ASKS) {
      for (const share of GRID_SHARES) {
        for (const flex of [CAREER_NEGOTIATION.flexFloor, 0.97, 1]) {
          const talk = (o?: ContractOffer) => answer(ask, share, flex, o);
          for (const a of reachable(talk)) {
            states += 1;
            // Every state the presses reach is one he signs, paying exactly the weekly wage shown.
            expect(a.accepted).toBe(true);
            expect(weeklyWage(a.terms.wagePerSplit)).toBe(a.terms.weekly);
            expect(a.terms.weekly).toBe(a.offer.weekly);
            for (const [lever, dir] of PRESSES) {
              const next = talkPressFor(a, lever, dir);
              // A closed way always names its reason, and a reason always closes its way.
              const closed = limitOf(a, lever, dir) !== null || (lever === "share" && !a.zone.shareLever);
              expect(next === null, `${lever}${dir} ${ask}/${share}/${flex}`).toBe(closed);
              if (!next) continue;
              const b = talk(next);
              if (lever === "wage") {
                expect(b.offer.sharePct).toBe(a.offer.sharePct);
                expect(Math.sign(b.offer.weekly - a.offer.weekly)).toBe(dir);
                expect(Math.abs(b.offer.weekly - a.offer.weekly)).toBeGreaterThanOrEqual(q);
              } else {
                expect(b.offer.sharePct - a.offer.sharePct).toBe(dir);
                expect(a.offer.weekly - b.offer.weekly).toBe(dir * a.zone.pointWeekly);
                expect(b.accepted).toBe(a.accepted);
              }
            }
          }
        }
      }
    }
    expect(states).toBeGreaterThan(2_000);
  }, 60_000);

  it("rc.35: every player has the share lever (one who asks none can be offered one, which buys wage); its bounds are named", () => {
    const S = CAREER_PRIZE_SHARE;
    for (const ask of GRID_ASKS) {
      const none = answer(ask, 0, 0.97, { sharePct: 2 });
      expect(none.zone.shareLever).toBe(CAREER_PRIZES.playerShare.enabled);
      expect(none.zone.shareMin).toBe(0);
      expect(none.zone.shareMax).toBeLessThanOrEqual(S.maxAboveAsk);
      expect(talkPressFor(answer(ask, 0, 0.97), "share", -1)).toBeNull();
      if (none.offer.sharePct > 0) expect(none.zone.topWeekly).toBeLessThan(none.ask.weekly);
      for (const share of GRID_SHARES.filter((x) => x > 0)) {
        const a = answer(ask, share, 0.97);
        expect(a.zone.shareLever).toBe(CAREER_PRIZES.playerShare.enabled);
        const low = answer(ask, share, 0.97, { sharePct: 0 });
        expect(low.offer.sharePct).toBe(Math.max(S.minPct, share - S.maxBelowAsk));
        expect(low.limits.shareDown).toBe(low.offer.sharePct === 0 ? "none" : "least");
        const high = answer(ask, share, 0.97, { sharePct: 99 });
        const most = Math.min(S.maxPct, share + S.maxAboveAsk);
        expect(high.offer.sharePct).toBeLessThanOrEqual(most);
        expect(high.limits.shareUp).toBe(high.offer.sharePct < most ? "minimum" : "most");
        // The floor never goes under the least a contract pays, at any share.
        expect(high.zone.floorWeekly).toBeGreaterThanOrEqual(high.zone.minWeekly);
      }
    }
    // At the league minimum: the wage cannot go lower, and the share cannot buy any of it.
    const min = answer(250, 7, 0.95);
    expect(min.limits).toEqual({
      wageDown: "minimum",
      wageUp: "ask",
      shareDown: null,
      shareUp: "minimum",
      bonusDown: "none",
      bonusUp: "minimum",
    });
  });
});

describe("ECO-10 — the prize share each contract carries", () => {
  it("a star asks a bigger share, a young player a smaller one; at or under the threshold nobody asks one (rc.34, Miguel 31/10)", () => {
    const S = CAREER_PRIZE_SHARE;
    const T = S.shareThresholdOverall;
    expect(prizeShareAskFor({ overall: 90, age: 21 })).toBeGreaterThan(prizeShareAskFor({ overall: 85, age: 21 }));
    expect(prizeShareAskFor({ overall: 85, age: 21 })).toBeGreaterThan(prizeShareAskFor({ overall: T + 1, age: 21 }));
    expect(prizeShareAskFor({ overall: 85, age: 17 })).toBe(prizeShareAskFor({ overall: 85, age: 21 }) - S.youngDiscount);
    // No share at or under the threshold, whatever the age; the curve starts at 0 there.
    for (let o = 40; o <= T; o++) {
      for (const age of [15, 17, 20, 26]) expect(prizeShareAskFor({ overall: o, age }), `${o}`).toBe(0);
    }
    for (let o = T + 1; o <= 99; o++) {
      const s = prizeShareAskFor({ overall: o, age: 22 });
      expect(s).toBe(Math.min(S.maxPct, Math.round((o - T) * S.askPerPoint)));
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeGreaterThanOrEqual(prizeShareAskFor({ overall: o - 1, age: 22 }));
    }
    // A fractional overall reads its rounded value (real players' derived overalls).
    expect(prizeShareAskFor({ overall: T + 0.49, age: 22 })).toBe(0);
    expect(prizeShareAskFor({ overall: T + 0.5, age: 22 })).toBe(prizeShareAskFor({ overall: T + 1, age: 22 }));
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
    // The lowest share the talk lets an 85 sign for (rc.34: his ask from the threshold curve − maxBelowAsk).
    const ask85Share = prizeShareAskFor({ overall: 85, age: 20 });
    const lowest = answer(ask85(0), ask85Share, 1, { sharePct: 0 }).zone.shareMin;
    expect(lowest).toBe(Math.max(S.minPct, ask85Share - S.maxBelowAsk));
    expect(lowest).toBeGreaterThan(0);
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

describe("rc.35 front N — under the zone, the signing bonus and the contract length (Miguel on rc.34)", () => {
  const talk = (o: {
    ask?: number;
    share?: number;
    bonus?: number;
    len?: number;
    roll?: number;
    offer?: ContractOffer;
  }) =>
    negotiationAnswerFor({
      ask: { wagePerSplit: o.ask ?? 12_000, sharePct: o.share ?? 0, bonus: o.bonus ?? 0 },
      flex: 0.97,
      offer: o.offer,
      minWagePerSplit: 250,
      lengthSeasons: o.len,
      roll: o.roll,
    });

  it("under his floor his odds fall smoothly from 100 % to 0 %, and he signs when they beat the roll", () => {
    const top = talk({});
    let prev = 1;
    for (let w = top.zone.floorWeekly; w >= top.zone.zeroWeekly; w -= 10) {
      const a = talk({ offer: { weekly: w }, roll: 0.5 });
      expect(a.odds).toBeLessThanOrEqual(prev);
      expect(prev - a.odds).toBeLessThan(0.06); // smooth: no cliff on one $10 step
      expect(a.accepted).toBe(a.odds >= 1 || a.odds > 0.5);
      prev = a.odds;
    }
    expect(prev).toBe(0);
    // Omitting the roll keeps rc.34's rule: never under the floor.
    expect(talk({ offer: { weekly: top.zone.floorWeekly - 10 } }).accepted).toBe(false);
  });

  it("the roll is seeded per player and window: a reload changes nothing", () => {
    expect(negotiationRollFor(7, "p1", 1, "w0")).toBe(negotiationRollFor(7, "p1", 1, "w0"));
    expect(negotiationRollFor(7, "p1", 1, "w0")).not.toBe(negotiationRollFor(7, "p1", 1, "w1"));
  });

  it("a longer contract lowers his floor — wage, bonus and share all ask less", () => {
    const one = talk({ len: 1 });
    const three = talk({ len: 3 });
    expect(three.zone.floorWeekly).toBeLessThan(one.zone.floorWeekly);
    expect(three.zone.lengthReliefWeekly).toBeGreaterThan(0);
    expect(one.zone.lengthReliefWeekly).toBe(0);
    // The same low offer has better odds on the longer deal.
    const w = one.zone.floorWeekly - 40;
    expect(talk({ len: 3, offer: { weekly: w } }).odds).toBeGreaterThan(talk({ len: 1, offer: { weekly: w } }).odds);
  });

  it("the signing bonus is a lever: more bonus moves the whole zone down, less moves it up; the deal carries it", () => {
    const base = talk({ bonus: 4_000 });
    expect(base.zone.bonusMax).toBeGreaterThanOrEqual(4_000);
    const more = talk({ bonus: 4_000, offer: { bonus: 8_000 } });
    const less = talk({ bonus: 4_000, offer: { bonus: 0 } });
    expect(more.zone.floorWeekly).toBeLessThan(base.zone.floorWeekly);
    expect(less.zone.floorWeekly).toBeGreaterThan(base.zone.floorWeekly);
    expect(more.terms.bonus).toBe(8_000);
    const press = talkPressFor(base, "bonus", 1)!;
    expect(press.bonus).toBe(4_000 + base.zone.bonusStep);
    expect(talk({ bonus: 4_000, offer: press }).accepted).toBe(true);
    // The slider sets several steps at once with the wage moved the same way.
    const set = talkSetFor(base, "bonus", 8_000);
    expect(talk({ bonus: 4_000, offer: set }).accepted).toBe(true);
    expect(set.weekly).toBeLessThan(base.offer.weekly);
  });

  it("the zone moves with the share too: a player who asks none takes a share for wage", () => {
    const none = talk({});
    const withShare = talk({ offer: { sharePct: 2 } });
    expect(withShare.zone.topWeekly).toBe(none.zone.topWeekly - 2 * none.zone.pointWeekly);
    const set = talkSetFor(none, "share", 2);
    expect(talk({ offer: set }).accepted).toBe(true);
  });
});
