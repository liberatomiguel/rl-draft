/**
 * rc.51 — the Classic run marks behind Technician, Clean Sweep and Trade
 * Minister. Dataset-agnostic: the cards come from the data, never from ids.
 */
import { describe, expect, it } from "vitest";
import { coaches, playerById, playerCards, subs } from "@/data";
import { runLockMark } from "@/data/cosmetics";
import { runMarksFor, RUN_MARK_CLEAN_SWEEP, RUN_MARK_ONE_FLAG } from "./runMarks";
import type { Roster, RunState, SeriesResult, TournamentState } from "./types";

const countryOfCard = (id: string): string => playerById.get(playerCards.find((c) => c.id === id)!.playerId)?.country ?? "";

/** A country with three different players, a coach and a substitute in the data. */
function oneFlagRoster(): { roster: Roster; country: string } {
  const byCountry = new Map<string, Map<string, string>>();
  for (const card of playerCards) {
    const country = playerById.get(card.playerId)?.country;
    if (!country) continue;
    if (!byCountry.has(country)) byCountry.set(country, new Map());
    const people = byCountry.get(country)!;
    if (!people.has(card.playerId)) people.set(card.playerId, card.id);
  }
  for (const [country, people] of byCountry) {
    const coach = coaches.find((c) => c.country === country);
    const sub = subs.find((s) => s.country === country);
    if (people.size < 3 || !coach || !sub) continue;
    const [a, b, c] = [...people.values()];
    const pick = (slot: string, kind: string, refId: string) => ({ slot, kind, refId, fromLineupId: "test" });
    return {
      country,
      roster: {
        player1: pick("player1", "player", a),
        player2: pick("player2", "player", b),
        player3: pick("player3", "player", c),
        coach: pick("coach", "coach", coach.id),
        sub: pick("sub", "sub", sub.id),
        org: pick("org", "org", "any-org"),
      } as Roster,
    };
  }
  throw new Error("no country with three players, a coach and a substitute in the dataset");
}

const series = (winner: string): SeriesResult => ({ teamAId: "user", teamBId: "ai", winnerTeamId: winner }) as unknown as SeriesResult;

function tournament(champion: boolean, swissLosses = 0): TournamentState {
  return {
    swiss: { rounds: [{ series: [series("user"), ...Array.from({ length: swissLosses }, () => series("ai"))] }] },
    playoffs: { championTeamId: champion ? "user" : "ai", rounds: [] },
    teams: {},
  } as unknown as TournamentState;
}

const run = (roster: Roster, over: Partial<RunState> = {}): RunState =>
  ({ mode: "classic", difficulty: "normal", draft: { roster }, ...over }) as unknown as RunState;

describe("runMarksFor (rc.51)", () => {
  const { roster, country } = oneFlagRoster();

  it("Technician: a worldwide Classic title with players, coach and substitute of one country", () => {
    expect(countryOfCard(roster.player1!.refId)).toBe(country);
    expect(runMarksFor(run(roster), tournament(true))).toContain(RUN_MARK_ONE_FLAG);
    // Not a title, not Classic, or on a region lock: nothing.
    expect(runMarksFor(run(roster), tournament(false))).toEqual([]);
    for (const mode of ["daily", "quick", "challenge"]) expect(runMarksFor(run(roster, { mode } as Partial<RunState>), tournament(true))).toEqual([]);
    expect(runMarksFor(run(roster, { regionLock: "EU" } as Partial<RunState>), tournament(true))).not.toContain(RUN_MARK_ONE_FLAG);
  });

  it("Technician needs every one of the five: a foreign substitute or an empty slot breaks it", () => {
    const foreign = subs.find((s) => s.country && s.country !== country)!;
    const mixed = { ...roster, sub: { ...roster.sub!, refId: foreign.id } } as Roster;
    expect(runMarksFor(run(mixed), tournament(true))).not.toContain(RUN_MARK_ONE_FLAG);
    expect(runMarksFor(run({ ...roster, coach: undefined }), tournament(true))).not.toContain(RUN_MARK_ONE_FLAG);
  });

  it("Clean Sweep: six slots filled and no series lost on the way to the title", () => {
    expect(runMarksFor(run(roster), tournament(true))).toContain(RUN_MARK_CLEAN_SWEEP);
    expect(runMarksFor(run(roster), tournament(true, 1))).not.toContain(RUN_MARK_CLEAN_SWEEP);
    expect(runMarksFor(run({ ...roster, org: undefined }), tournament(true))).not.toContain(RUN_MARK_CLEAN_SWEEP);
  });

  it("Trade Minister: one mark per playable region lock, none for the others", () => {
    for (const region of ["NA", "EU", "SAM", "MENA", "OCE"]) {
      expect(runMarksFor(run(roster, { regionLock: region } as Partial<RunState>), tournament(true))).toContain(runLockMark(region));
    }
    expect(runMarksFor(run(roster, { regionLock: "APAC" } as Partial<RunState>), tournament(true))).toEqual([RUN_MARK_CLEAN_SWEEP]);
    expect(runLockMark("MENA")).toBe("run-lock-mena");
  });
});
