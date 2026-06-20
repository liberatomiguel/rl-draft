import { describe, expect, it } from "vitest";
import { challenges, coachById, playerCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  buildChallengeOpponent,
  challengeStatus,
  createChallengeDraft,
  playChallengeSeries,
} from "./challenges";
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

/** Win rate of the competent fixed-seed draft, sampling the series outcome (the
 *  live series RNG continues from the post-draft state, which varies with the
 *  player's choice path). */
function realisticWinRate(ch: Challenge, sims = 200): number {
  const roster = autoDraft(ch, createRng(ch.seed));
  if (!roster) return 0; // couldn't even assemble a legal roster on the fixed seed
  const user = buildUserTeam(roster, ch.sim.difficulty, { mode: "challenge" });
  const opponent = buildChallengeOpponent(ch);
  let wins = 0;
  for (let i = 0; i < sims; i++) {
    if (playChallengeSeries(user, opponent, ch, createRng(ch.seed + 1 + i * 131)).winnerTeamId === "user") wins++;
  }
  return wins / sims;
}

describe("challenges — data integrity", () => {
  it("ships a non-trivial starter set", () => {
    expect(challenges.length).toBeGreaterThanOrEqual(8);
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

describe("challenges — every one is realistically winnable (v1.4)", () => {
  // A COMPETENT (not perfect) draft on the fixed seed must have a real shot at
  // every challenge. Floors carry margin below the design targets (~50% / legend
  // ~30%) for sim noise; the boss `opponentShift` knob is tuned to hit them.
  for (const ch of challenges) {
    const isLegend = ch.tier === "legend";
    it(`${ch.id} is winnable (${ch.tier})`, () => {
      const wr = realisticWinRate(ch);
      console.log(`  ${ch.id.padEnd(28)} ${ch.tier.padEnd(6)} winrate ${(wr * 100).toFixed(0)}%`);
      expect(wr).toBeGreaterThanOrEqual(isLegend ? 0.15 : 0.3);
    });
  }
});
