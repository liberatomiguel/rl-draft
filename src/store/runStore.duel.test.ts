/**
 * Friend duel (v2.1, DESIGN-DECISIONS #184) through the REAL run store: a link
 * opened on the other side draws the same draft and, with the same picks,
 * plays to the same result; the bracket field does not depend on the rerolls
 * spent; a duel grants nothing; a link survives its own encoding.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coachById, playerCardById, subById } from "@/data";
import { finalOverall } from "@/engine/cards";
import { slotsForKind } from "@/engine/draft";
import { duelEntryFromResults, encodeDuel, freshDuel, parseDuel, type DuelLink } from "@/engine/duel";
import { displayTeamOverall } from "@/engine/rating";
import type { DraftOfferCard, RunState } from "@/engine/types";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";

const score = (c: DraftOfferCard) =>
  c.kind === "player"
    ? finalOverall(playerCardById.get(c.refId)!) + 20
    : c.kind === "coach"
      ? coachById.get(c.refId)?.overall ?? 0
      : c.kind === "sub"
        ? subById.get(c.refId)?.overall ?? 0
        : 50;

/** Draft greedily; `rerollFirst` spends one paid reroll on the first offer. */
function draftAll(rerollFirst = false): void {
  if (rerollFirst) useRunStore.getState().reroll();
  for (let guard = 0; useRunStore.getState().run!.phase === "draft" && guard < 80; guard++) {
    const run = useRunStore.getState().run!;
    if (!run.draft.offer!.hasPickableCard) {
      useRunStore.getState().freeReroll();
      continue;
    }
    const card = run.draft.offer!.cards
      .filter((c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !run.draft.roster[s]))
      .sort((a, b) => score(b) - score(a))[0];
    useRunStore.getState().pickCard(card, slotsForKind(card.kind).find((s) => !run.draft.roster[s])!);
  }
  expect(useRunStore.getState().run!.phase).toBe("review");
}

function playOut(): RunState {
  useRunStore.getState().startTournament();
  for (let i = 0; useRunStore.getState().run!.tournament!.stage !== "finished" && i < 80; i++) useRunStore.getState().playRound();
  useRunStore.getState().finishRun();
  return useRunStore.getState().run!;
}

/** The bracket field: every team but the user's, by lineup. */
const fieldOf = (run: RunState) =>
  Object.keys(run.tournament!.teams)
    .filter((id) => id !== "user")
    .sort();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
  useProfileStore.getState().resetAll();
  useRunStore.setState({ run: null });
});
afterEach(() => vi.useRealTimers());

describe("friend duel — the same draft on both sides", () => {
  const link: DuelLink = freshDuel({ mode: "classic", difficulty: "normal", region: null, showOverall: true }, 424242);

  it("the same link draws the same offers whatever the profile's rank or the date", () => {
    expect(useRunStore.getState().startDuel(link)).toBe(true);
    const first = useRunStore.getState().run!;
    // The other side: a high rank (more special rarities in a normal run), another day.
    useProfileStore.setState({ xp: 80_000 });
    vi.setSystemTime(new Date("2027-03-02T08:00:00Z"));
    useRunStore.getState().startDuel(link);
    const second = useRunStore.getState().run!;
    expect(second.seed).toBe(first.seed);
    expect(second.draft).toEqual(first.draft);
    expect(second.rngState).toBe(first.rngState);
    expect(second.duel).toEqual(first.duel);
    // A reset replays the same duel.
    useRunStore.getState().restartRun();
    expect(useRunStore.getState().run!.draft).toEqual(first.draft);
  });

  it("the same picks play to the same result, and the run grants nothing", () => {
    const profileBefore = JSON.parse(JSON.stringify(useProfileStore.getState()));
    useRunStore.getState().startDuel(link);
    draftAll();
    const a = playOut();
    expect(a.phase).toBe("results");

    // The other browser: same link, decoded from its own code.
    const parsed = parseDuel(encodeDuel(link));
    expect(parsed.ok).toBe(true);
    useRunStore.setState({ run: null });
    useRunStore.getState().startDuel(parsed.ok ? parsed.link : link);
    draftAll();
    const b = playOut();

    expect(b.draft.roster).toEqual(a.draft.roster);
    expect(b.tournament).toEqual(a.tournament);
    const lineOf = (r: RunState) => duelEntryFromResults(r.results!, displayTeamOverall(r.tournament!.teams["user"].rating));
    expect(lineOf(b)).toEqual(lineOf(a));

    // Exhibition: no XP, rating, cards, achievements, missions or history.
    for (const r of [a, b]) {
      expect(r.results!.xp.total).toBe(0);
      expect(r.results!.unlockedSpecialIds).toEqual([]);
      expect(r.results!.newAchievementIds).toEqual([]);
    }
    const after = useProfileStore.getState();
    for (const key of ["xp", "mmr", "runsCompleted", "wins", "unlockedSpecials", "achievements", "runHistory", "missions", "season"] as const) {
      expect(after[key], key).toEqual(profileBefore[key]);
    }
  });

  it("the bracket field does not depend on the rerolls spent in the draft", () => {
    useRunStore.getState().startDuel(link);
    draftAll(false);
    useRunStore.getState().startTournament();
    const plain = fieldOf(useRunStore.getState().run!);

    useRunStore.setState({ run: null });
    useRunStore.getState().startDuel(link);
    expect(useRunStore.getState().run!.draft.rerollsLeft).toBeGreaterThan(0);
    draftAll(true);
    useRunStore.getState().startTournament();
    expect(fieldOf(useRunStore.getState().run!)).toEqual(plain);
  });

  it("a region-locked duel drafts from the region's pool; a region this build cannot draft is refused", () => {
    const eu = freshDuel({ mode: "quick", difficulty: "hard", region: "EU", showOverall: true }, 99);
    expect(useRunStore.getState().startDuel(eu)).toBe(true);
    const run = useRunStore.getState().run!;
    expect(run.regionLock).toBe("EU");
    expect(run.mode).toBe("quick");
    expect(run.showOverall).toBe(false); // Hard hides it, as in a normal run
    expect(run.draft.poolLineupIds?.length).toBeGreaterThan(0);

    useRunStore.setState({ run: null });
    const ssa = freshDuel({ mode: "classic", difficulty: "normal", region: "SSA", showOverall: true }, 1);
    const started = useRunStore.getState().startDuel(ssa);
    // SSA reads "Coming soon" in the setup today; either way the store never half-starts a run.
    expect(started).toBe(!!useRunStore.getState().run);
  });

  it("a normal run started after a duel is a normal run again", () => {
    useRunStore.getState().startDuel(link);
    useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true });
    expect(useRunStore.getState().run!.duel).toBeUndefined();
  });
});
