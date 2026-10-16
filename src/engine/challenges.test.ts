import { describe, expect, it } from "vitest";
import { challenges, coachById, playerCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  buildChallengeOpponent,
  buildGauntletOpponents,
  challengeStatus,
  createChallengeDraft,
  evaluateStars,
  playChallengeSeries,
  playGauntletStage,
  STAR_2,
  STAR_3,
  STAR_CLEAR,
} from "./challenges";
import { displayTeamOverall } from "./rating";
import { applyPick, applyReroll, drawNextOffer, neededKinds, playerEligibleUnderConstraint, slotsForKind } from "./draft";
import { buildUserTeam } from "./teams";
import type { Challenge, DraftOfferCard, Roster } from "./types";

/**
 * A COMPETENT, REALISTIC draft (v1.4) — what a thoughtful player actually does:
 * each offer, take the best available card for an open needed slot (players
 * first); reroll a clearly-weak offer while rerolls remain. This is the honest
 * winnability bar — NOT the old `bestLegalRoster`, which cherry-picked the single
 * best card at every slot across all lineups (an unreachable roster, so its win
 * rate said nothing about real play). Seeded by the challenge, so it mirrors the
 * exact offers a player faces.
 */
function cardScore(c: DraftOfferCard): number {
  if (c.kind === "player") return finalOverall(playerCardById.get(c.refId)!);
  if (c.kind === "coach") return coachById.get(c.refId)?.overall ?? 0;
  if (c.kind === "sub") return subById.get(c.refId)?.overall ?? 0;
  return 50;
}
function autoDraft(ch: Challenge, rng: Rng): Roster | null {
  let draft = createChallengeDraft(ch, rng);
  let guard = 0;
  while (!draft.complete && guard++ < 120) {
    const offer = draft.offer;
    if (!offer) break;
    const need = neededKinds(draft.roster, draft.mode);
    const pickable = offer.cards
      .filter((c) => c.availability === "available" && need.includes(c.kind))
      .filter((c) => slotsForKind(c.kind).some((s) => !draft.roster[s]))
      .sort((a, b) => (a.kind === "player" ? 1 : 0) - (b.kind === "player" ? 1 : 0) || cardScore(b) - cardScore(a));
    const best = pickable.find((c) => c.kind === "player") ?? pickable[pickable.length - 1] ?? null;
    if (!best) {
      if (draft.rerollsLeft > 0) {
        draft = applyReroll(draft, rng);
        continue;
      }
      const any = offer.cards.find(
        (c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !draft.roster[s]),
      );
      if (!any) return null;
      draft = applyPick(draft, any, slotsForKind(any.kind).find((s) => !draft.roster[s])!, rng);
      continue;
    }
    if (best.kind === "player" && cardScore(best) < 80 && draft.rerollsLeft > 3) {
      draft = applyReroll(draft, rng);
      continue;
    }
    draft = applyPick(draft, best, slotsForKind(best.kind).find((s) => !draft.roster[s])!, rng);
  }
  return draft.complete ? draft.roster : null;
}

/** One full attempt (gauntlet stages, then the boss) on a given RNG. */
function attempt(ch: Challenge, user: ReturnType<typeof buildUserTeam>, opponent: ReturnType<typeof buildChallengeOpponent>, stages: ReturnType<typeof buildGauntletOpponents>, rng: Rng) {
  const all = [];
  for (const o of stages) {
    const r = playGauntletStage(user, o, ch, rng);
    all.push(r);
    if (r.winnerTeamId !== "user") return { cleared: false, mask: 0 };
  }
  const boss = playChallengeSeries(user, opponent, ch, rng);
  all.push(boss);
  const mask = evaluateStars(ch, { user, boss, all, bossOverall: displayTeamOverall(opponent.rating), rerollsUsed: 0 });
  return { cleared: boss.winnerTeamId === "user", mask };
}

/** Win rate of the competent fixed-seed draft, sampling the whole attempt (the
 *  live series RNG continues from the post-draft state, which varies with the
 *  player's choice path). Also returns how often each extra star came with a win. */
function realisticRates(ch: Challenge, sims = 200): { win: number; star2: number; star3: number } {
  const roster = autoDraft(ch, createRng(ch.seed));
  if (!roster) return { win: 0, star2: 0, star3: 0 }; // couldn't even assemble a legal roster
  const user = buildUserTeam(roster, ch.sim.difficulty, { mode: "challenge" });
  const opponent = buildChallengeOpponent(ch);
  const stages = buildGauntletOpponents(ch);
  let wins = 0;
  let s2 = 0;
  let s3 = 0;
  for (let i = 0; i < sims; i++) {
    const r = attempt(ch, user, opponent, stages, createRng(ch.seed + 1 + i * 131));
    if (r.cleared) wins++;
    if (r.mask & STAR_2) s2++;
    if (r.mask & STAR_3) s3++;
  }
  return { win: wins / sims, star2: s2 / sims, star3: s3 / sims };
}

describe("challenges — data integrity", () => {
  it("ships the full v2.0 set with gauntlets", () => {
    expect(challenges.length).toBeGreaterThanOrEqual(24);
    expect(challenges.filter((c) => c.kind === "gauntlet").length).toBeGreaterThanOrEqual(4);
  });

  it("every boss series is a Best-of-7 (v1.4)", () => {
    for (const ch of challenges) expect(ch.sim.bestOf).toBe(7);
  });

  it("v2.0: every challenge has two extra stars of different kinds", () => {
    for (const ch of challenges) {
      expect(ch.stars, ch.id).toBeTruthy();
      expect(ch.stars![0].kind, ch.id).not.toBe(ch.stars![1].kind);
    }
  });

  it("star masks: a loss earns nothing; a win always carries the clear bit", () => {
    const ch = challenges[0];
    const user = buildUserTeam(autoDraft(ch, createRng(ch.seed))!, ch.sim.difficulty, { mode: "challenge" });
    const opponent = buildChallengeOpponent(ch);
    const won = playChallengeSeries(user, opponent, ch, createRng(1));
    const ctx = { user, boss: won, all: [won], bossOverall: displayTeamOverall(opponent.rating), rerollsUsed: 0 };
    const mask = evaluateStars(ch, ctx);
    if (won.winnerTeamId === "user") expect(mask & STAR_CLEAR).toBe(STAR_CLEAR);
    else expect(mask).toBe(0);
    expect((STAR_CLEAR | STAR_2 | STAR_3).toString(2)).toBe("111");
  });
});

describe("challenges — unlock gating", () => {
  it("locks below the required rank and unlocks at/above it", () => {
    const ch = challenges.find((c) => c.rankRequired === "diamond");
    if (ch && !ch.prereq) {
      expect(challengeStatus(ch, 0, {})).toBe("locked"); // unranked
      expect(challengeStatus(ch, 50_000, {})).toBe("available"); // GC+
    }
  });

  it("a prereq must be cleared first, and a cleared challenge stays cleared", () => {
    const chained = challenges.find((c) => c.prereq);
    expect(chained).toBeTruthy();
    if (chained) {
      const xp = 60_000; // SSL — rank is never the blocker here
      expect(challengeStatus(chained, xp, {})).toBe("locked"); // prereq not done
      expect(challengeStatus(chained, xp, { [chained.prereq!]: "2026-01-01" })).toBe("available");
      expect(challengeStatus(chained, xp, { [chained.id]: "2026-01-01" })).toBe("cleared");
    }
  });
});

describe("challenges — constraints actually bind", () => {
  it("an OVR-cap challenge never offers a pickable player above the cap", () => {
    const capped = challenges.find((c) => c.constraint?.maxPlayerOverall);
    expect(capped).toBeTruthy();
    if (capped) {
      const cap = capped.constraint!.maxPlayerOverall!;
      const rng = createRng(capped.seed);
      let draft = createChallengeDraft(capped, rng);
      for (let i = 0; i < 60; i++) {
        for (const card of draft.offer!.cards) {
          if (card.kind === "player" && card.availability === "available") {
            expect(finalOverall(playerCardById.get(card.refId)!)).toBeLessThanOrEqual(cap);
          }
        }
        draft = drawNextOffer({ ...draft, shownLineupIds: [] }, rng);
      }
    }
  });

  it("a nationality challenge always offers a pickable national (draft completes)", () => {
    const fr = challenges.find((c) => c.constraint?.country);
    if (fr) {
      const roster = autoDraft(fr, createRng(fr.seed));
      expect(roster).not.toBeNull();
      // every drafted player matches the nationality twist
      for (const slot of ["player1", "player2", "player3"] as const) {
        const pick = roster![slot];
        if (pick) expect(playerEligibleUnderConstraint(pick.refId, fr.constraint)).toBe(true);
      }
    }
  });
});

describe("challenges — every one is realistically winnable, none trivial (v1.4)", () => {
  // A COMPETENT (not perfect) draft on the fixed seed must land in a real DIFFICULTY
  // BAND: hard enough to matter, never impossible, never a free win. The sim is
  // deterministic (fixed seeds), so these bands are stable — tuned via the boss
  // `opponentShift` knob. Floor: legend ≥0.15, others ≥0.30 (margin under the design
  // targets Common~65/Rare~55/Epic~45/Legend~30). Ceiling: ≤0.85 so nothing is a
  // walkover (the v1.4 "not too easy" rule for fixed seeds).
  for (const ch of challenges) {
    const isLegend = ch.tier === "legend";
    it(`${ch.id} is in-band (${ch.tier})`, () => {
      const r = realisticRates(ch);
      console.log(`  ${ch.id.padEnd(30)} ${ch.tier.padEnd(6)} win ${(r.win * 100).toFixed(0).padStart(3)}%  ★2 ${(r.star2 * 100).toFixed(0).padStart(3)}%  ★3 ${(r.star3 * 100).toFixed(0).padStart(3)}%`);
      expect(r.win).toBeGreaterThanOrEqual(isLegend ? 0.15 : 0.3);
      expect(r.win).toBeLessThanOrEqual(0.85);
      // Outcome-based stars (sweep / goals / concede) must be reachable on the fixed
      // seed with the competent draft: never 0 across 200 attempts. Draft-shaped stars
      // (chemistry / max overall / underdog / no specials / rerolls) depend on the
      // player's choices, so they are not sampled here.
      const outcomeKinds = new Set(["sweep", "goals", "concede"]);
      if (ch.stars && outcomeKinds.has(ch.stars[0].kind)) expect(r.star2, `${ch.id} star 2`).toBeGreaterThan(0.02);
      if (ch.stars && outcomeKinds.has(ch.stars[1].kind)) expect(r.star3, `${ch.id} star 3`).toBeGreaterThan(0.02);
    });
  }
});
