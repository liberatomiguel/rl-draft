/**
 * Full-run integration: draft → team build → tournament → results.
 * Uses the real dataset end to end.
 */

import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import {
  applyFreeReroll,
  applyPick,
  createDraft,
  drawNextOffer,
  openPlayerSlot,
} from "./draft";
import { compileResults } from "./results";
import { buildUserTeam } from "./teams";
import {
  fastForward,
  initTournament,
  userHasPendingSeries,
  userPlacement,
} from "./tournament";
import type { DraftState, RosterSlotId, RunState } from "./types";

function autoDraft(seed: number) {
  const rng = createRng(seed);
  let draft: DraftState = drawNextOffer(createDraft("normal"), rng);
  let guard = 0;
  while (!draft.complete && guard < 200) {
    const card = draft.offer!.cards.find((c) => c.availability === "available");
    if (card) {
      const slot: RosterSlotId | null =
        card.kind === "player"
          ? openPlayerSlot(draft.roster)
          : card.kind === "coach"
            ? "coach"
            : card.kind === "sub"
              ? "sub"
              : "org";
      draft = applyPick(draft, card, slot!, rng);
    } else {
      draft = applyFreeReroll(draft, rng);
    }
    guard += 1;
  }
  expect(draft.complete).toBe(true);
  return { draft, rng };
}

function makeRun(seed: number): { run: RunState; rng: ReturnType<typeof createRng> } {
  const { draft, rng } = autoDraft(seed);
  const run: RunState = {
    runId: `test-${seed}`,
    mode: "classic",
    seed,
    rngState: rng.state,
    difficulty: "normal",
    showOverall: true,
    phase: "tournament",
    startedAt: new Date().toISOString(),
    draft,
    tournament: null,
    challenge: null,
    results: null,
  };
  return { run, rng };
}

describe("tournament integration", () => {
  it("a full run completes with a champion and a valid user placement", () => {
    for (const seed of [42, 777, 31337]) {
      const { run, rng } = makeRun(seed);
      const userTeam = buildUserTeam(run.draft.roster, run.difficulty);
      expect(userTeam.rating.total).toBeGreaterThan(75);

      let tournament = initTournament(userTeam, run.difficulty, rng);
      expect(Object.keys(tournament.teams)).toHaveLength(16);
      expect(userHasPendingSeries(tournament)).toBe(true);

      tournament = fastForward(tournament, run.difficulty, rng);
      expect(tournament.stage).toBe("finished");
      expect(tournament.playoffs?.championTeamId).toBeTruthy();
      // Full double elimination: 9 rounds, 15 series (4+2+2+2+1+1+1+1+1).
      expect(tournament.playoffs?.rounds).toHaveLength(9);
      expect(
        tournament.playoffs?.rounds.reduce((sum, r) => sum + r.series.length, 0),
      ).toBe(15);

      const placement = userPlacement(tournament);
      expect([
        "champion",
        "runner_up",
        "third",
        "fourth",
        "top6",
        "top8",
        "swiss_exit",
      ]).toContain(placement);

      const results = compileResults(run, tournament, {
        unlockedSpecialIds: [],
        achievementIds: [],
      }, rng);

      expect(results.xp.total).toBeGreaterThan(0);
      expect(results.xp.lines.length).toBeGreaterThan(0);
      expect(results.newAchievementIds).toContain("ach-first-team");
      expect(results.swissRecord.wins + results.swissRecord.losses).toBeGreaterThanOrEqual(3);

      // Special unlocks must be a subset of drafted specials.
      const drafted = [
        run.draft.roster.player1,
        run.draft.roster.player2,
        run.draft.roster.player3,
        run.draft.roster.sub,
      ]
        .map((p) => p?.specialId)
        .filter(Boolean);
      for (const id of results.unlockedSpecialIds) {
        expect(drafted).toContain(id);
      }
    }
  });

  it("applies difficulty and hidden-overall XP modifiers (§30)", () => {
    const { run, rng } = makeRun(99);
    const userTeam = buildUserTeam(run.draft.roster, run.difficulty);
    const tournament = fastForward(initTournament(userTeam, run.difficulty, rng), run.difficulty, rng);

    const hardHidden: RunState = { ...run, difficulty: "hard", showOverall: false };
    const results = compileResults(hardHidden, tournament, {
      unlockedSpecialIds: [],
      achievementIds: [],
    }, rng);

    expect(results.xp.difficultyMultiplier).toBe(1.5);
    expect(results.xp.hiddenOverallBonus).toBe(0.25);
  });

  it("quick mode runs a straight 8-team single-elimination bracket", () => {
    const rng = createRng(555);
    // Build a quick roster: just three players.
    let draft = drawNextOffer(createDraft("normal", { mode: "quick" }), rng);
    let guard = 0;
    while (!draft.complete && guard < 60) {
      const card = draft.offer!.cards.find((c) => c.availability === "available");
      if (card) {
        draft = applyPick(draft, card, openPlayerSlot(draft.roster)!, rng);
      } else {
        draft = applyFreeReroll(draft, rng);
      }
      guard += 1;
    }
    expect(draft.complete).toBe(true);
    expect(draft.roster.coach).toBeUndefined();
    expect(draft.roster.org).toBeUndefined();

    const team = buildUserTeam(draft.roster, "normal", { mode: "quick" });
    let t = initTournament(team, "normal", rng, { mode: "quick" });
    expect(Object.keys(t.teams)).toHaveLength(8);
    expect(t.stage).toBe("playoffs");
    expect(t.playoffs?.format).toBe("single");

    t = fastForward(t, "normal", rng);
    expect(t.stage).toBe("finished");
    expect(t.playoffs?.rounds).toHaveLength(3); // QF, SF, Final
    expect(["champion", "runner_up", "top4", "top8"]).toContain(userPlacement(t));
  });

  it("higher difficulty produces stronger opponent fields on average", () => {
    const samples = 30;
    const avgFieldRating = (difficulty: "easy" | "legacy") => {
      let sum = 0;
      for (let i = 0; i < samples; i++) {
        const rng = createRng(1000 + i);
        const { run } = makeRun(2000 + i);
        const userTeam = buildUserTeam(run.draft.roster, difficulty);
        const t = initTournament(userTeam, difficulty, rng);
        const opponents = Object.values(t.teams).filter((team) => !team.isUser);
        sum += opponents.reduce((s, o) => s + o.rating.total, 0) / opponents.length;
      }
      return sum / samples;
    };

    expect(avgFieldRating("legacy")).toBeGreaterThan(avgFieldRating("easy") + 2);
  });
});
