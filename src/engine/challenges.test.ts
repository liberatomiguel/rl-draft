import { describe, expect, it } from "vitest";
import { challenges, coachById, playerCardById, subById } from "@/data";
import { createRng, type Rng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  buildChallengeOpponent,
  challengeStatus,
  createChallengeDraft,
  evaluateStars,
  playChallengeSeries,
  STAR_2,
  STAR_3,
  STAR_CLEAR,
} from "./challenges";
import { displayTeamOverall } from "./rating";
import { applyPick, applyReroll, drawNextOffer, neededKinds, playerEligibleUnderConstraint, slotsForKind } from "./draft";
import { buildUserTeam } from "./teams";
import type { Challenge, DraftOfferCard, Roster } from "./types";

/**
 * Greedy smoke helper for the constraint/gating tests below. Three-star
 * reachability is proved separately by exact legal replays, never by sampling
 * unrelated match RNG states after this draft.
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

// CH-02 reachability is proven by exact replay in challenges.solvable.test.ts.
