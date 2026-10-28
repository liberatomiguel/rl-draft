/**
 * rc.29 spoiler guard (E2E DRAFT-01): the Draft tournament screen must read the
 * REVEALED Swiss, never the engine's — the engine settles the user's Swiss and
 * resolves the AI-only rounds as soon as the deciding series is simulated,
 * before its first game is shown.
 */
import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { createSwissState, playSwissRound } from "@/engine/swiss";
import type { TournamentState, TournamentTeam } from "@/engine/types";
import { playoffsOnScreen, userSwissOverOnScreen } from "./TournamentScreen";

function team(id: string, rating: number): TournamentTeam {
  return {
    id,
    name: id,
    isUser: id === "user",
    region: "EU",
    rating: { avgPlayerOverall: rating, coachMod: 0, subMod: 0, orgMod: 0, chemMod: 0, specialMod: 0, difficultyShift: 0, total: rating },
    chemistry: { raw: 0, max: 10, percent: 0, tier: "Poor", items: [] },
    stats: { offense: rating, defense: rating, mechanics: rating, consistency: rating, experience: rating, clutch: rating },
    specialIds: [],
    playerNames: [`${id}-a`, `${id}-b`, `${id}-c`],
    orgId: id,
  };
}

/** A Swiss where the user (far stronger) goes 3-0, simulated to the end like the run store does. */
function settledSwiss(): TournamentState {
  const teams: Record<string, TournamentTeam> = { user: team("user", 99) };
  for (let i = 1; i < 16; i++) teams[`t${i}`] = team(`t${i}`, 70);
  const rng = createRng(4242);
  let swiss = createSwissState(Object.keys(teams), rng);
  while (!swiss.finished) swiss = playSwissRound(swiss, teams, "normal", rng);
  return { teams, swiss, playoffs: null, stage: "playoffs", userEliminated: false };
}

const keysThrough = (t: TournamentState, rounds: number) => {
  const keys = new Set<string>();
  t.swiss.rounds.slice(0, rounds).forEach((round, ri) => round.series.forEach((_, si) => keys.add(`swiss:${ri}:${si}`)));
  return keys;
};

describe("Draft tournament screen reads the revealed Swiss (rc.29)", () => {
  it("the engine has settled a 3-0 run, but nothing past round 2 is shown: no playoffs kicker, path still open", () => {
    const t = settledSwiss();
    expect(t.swiss.finished).toBe(true);
    const userWins = t.swiss.records.find((r) => r.teamId === "user")!.wins;
    expect(userWins).toBe(3);

    const seen = keysThrough(t, 2); // the deciding round 3 is live, not revealed
    expect(playoffsOnScreen("classic", t, 2)).toBe(false);
    expect(userSwissOverOnScreen(t, seen)).toBe(false);
  });

  it("once the deciding series is revealed the path closes, and the kicker waits for every Swiss round", () => {
    const t = settledSwiss();
    expect(userSwissOverOnScreen(t, keysThrough(t, 3))).toBe(true);
    expect(playoffsOnScreen("classic", t, 3)).toBe(t.swiss.rounds.length <= 3);
    expect(playoffsOnScreen("classic", t, t.swiss.rounds.length)).toBe(true);
    expect(playoffsOnScreen("quick", t, 0)).toBe(true);
  });
});
