import { describe, expect, it } from "vitest";
import {
  challenges,
  coaches,
  lineupById,
  lineups,
  orgs,
  playerCardById,
  subs,
} from "@/data";
import { createRng } from "@/lib/rng";
import { finalOverall } from "./cards";
import {
  buildChallengeOpponent,
  challengePool,
  challengeStatus,
  createChallengeDraft,
  playChallengeSeries,
} from "./challenges";
import { drawNextOffer, playerEligibleUnderConstraint } from "./draft";
import { buildUserTeam } from "./teams";
import type { Challenge, Roster } from "./types";

/**
 * Build a strong LEGAL roster for a challenge — best eligible players (one per
 * person), best staff, the top player's org. Represents what a skilled drafter
 * could assemble, so its win rate is a LOWER bound on what's achievable (an
 * optimal chemistry build does at least as well). Used to prove every authored
 * challenge is winnable.
 */
function bestLegalRoster(ch: Challenge): Roster {
  const poolIds = challengePool(ch.constraint);
  const poolLineups = poolIds
    ? lineups.filter((l) => poolIds.includes(l.id))
    : lineups.filter((l) => !l.samOnly);

  // Best eligible card per player.
  const byPlayer = new Map<string, string>();
  for (const l of poolLineups) {
    for (const cid of l.playerCardIds) {
      if (!playerEligibleUnderConstraint(cid, ch.constraint)) continue;
      const card = playerCardById.get(cid)!;
      const cur = byPlayer.get(card.playerId);
      if (!cur || finalOverall(card) > finalOverall(playerCardById.get(cur)!)) {
        byPlayer.set(card.playerId, cid);
      }
    }
  }
  const ranked = [...byPlayer.values()].sort(
    (a, b) => finalOverall(playerCardById.get(b)!) - finalOverall(playerCardById.get(a)!),
  );

  const roster: Roster = {};
  const taken = new Set<string>();
  if (ch.fixedPlayerCardId) {
    const card = playerCardById.get(ch.fixedPlayerCardId)!;
    roster.player1 = { slot: "player1", kind: "player", refId: card.id, fromLineupId: card.lineupId };
    taken.add(card.playerId);
  }
  for (const slot of ["player1", "player2", "player3"] as const) {
    if (roster[slot]) continue;
    const cid = ranked.find((c) => !taken.has(playerCardById.get(c)!.playerId));
    if (!cid) break;
    const card = playerCardById.get(cid)!;
    roster[slot] = { slot, kind: "player", refId: cid, fromLineupId: card.lineupId };
    taken.add(card.playerId);
  }

  const coachIds = new Set(poolLineups.map((l) => l.coachId).filter(Boolean));
  const coach =
    coaches.filter((c) => coachIds.has(c.id)).sort((a, b) => b.overall - a.overall)[0] ??
    [...coaches].sort((a, b) => b.overall - a.overall)[0];
  const subIds = new Set(poolLineups.map((l) => l.subId).filter(Boolean));
  const sub =
    subs.filter((s) => subIds.has(s.id)).sort((a, b) => b.overall - a.overall)[0] ??
    [...subs].sort((a, b) => b.overall - a.overall)[0];
  const topLineup = roster.player1 ? lineupById.get(roster.player1.fromLineupId) : poolLineups[0];

  roster.coach = { slot: "coach", kind: "coach", refId: coach.id, fromLineupId: coach.lineupId };
  roster.sub = { slot: "sub", kind: "sub", refId: sub.id, fromLineupId: sub.lineupId };
  roster.org = {
    slot: "org",
    kind: "org",
    refId: topLineup?.orgId ?? orgs[0].id,
    fromLineupId: topLineup?.id ?? "",
  };
  return roster;
}

function winRate(ch: Challenge, trials = 500): number {
  const roster = bestLegalRoster(ch);
  const user = buildUserTeam(roster, ch.sim.difficulty, { mode: "classic" });
  const opponent = buildChallengeOpponent(ch);
  let wins = 0;
  for (let i = 0; i < trials; i++) {
    const rng = createRng(7000 + i * 31);
    if (playChallengeSeries(user, opponent, ch, rng).winnerTeamId === "user") wins++;
  }
  return wins / trials;
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
        // advance the offer to keep sampling the constrained pool
        draft = drawNextOffer({ ...draft, shownLineupIds: [] }, rng);
      }
    }
  });
});

describe("challenges — every one is winnable", () => {
  // A skilled, legal draft must have a real shot at every challenge (Miguel's
  // hard rule: challenges are completable). Floor is deliberately low — the
  // legend-tier walls are meant to be brutal, like Legacy mode itself.
  for (const ch of challenges) {
    it(`${ch.id} is winnable with a strong legal team`, () => {
      const wr = winRate(ch);
      // eslint-disable-next-line no-console
      console.log(`  challenge ${ch.id.padEnd(28)} winrate ${(wr * 100).toFixed(0)}%`);
      expect(wr).toBeGreaterThan(0.12);
    });
  }
});
