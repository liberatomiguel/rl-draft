/**
 * rc9 duel-ui (DESIGN-DECISIONS #294-#295): the team-against-team duel's draft
 * through the REAL run store. Both friends meet the duel engine's boards
 * whatever their profile or the date; a reroll is the next board; the draft
 * ends in a challenge link (challenger) or a reply link (friend) that parses
 * back to the same teams; and nothing is granted along the way.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coachById, playerCardById, subById } from "@/data";
import { finalOverall } from "@/engine/cards";
import { slotsForKind } from "@/engine/draft";
import { duelBoardLineup, duelTeamFromRoster } from "@/engine/duelDraft";
import { encodeDuelCode, parseDuelCode, readDuelHash } from "@/engine/duelLink";
import { isKnownDuelTeam, playDuel } from "@/engine/duelMatch";
import { makeDuelRules } from "@/engine/duelRules";
import type { DraftOfferCard } from "@/engine/types";
import { useProfileStore } from "./profileStore";
import { useRunStore } from "./runStore";

const score = (c: DraftOfferCard) =>
  c.kind === "player"
    ? finalOverall(playerCardById.get(c.refId)!) + 20
    : c.kind === "coach"
      ? (coachById.get(c.refId)?.overall ?? 0)
      : c.kind === "sub"
        ? (subById.get(c.refId)?.overall ?? 0)
        : 50;

/** Draft greedily through the store; `rerolls` paid rerolls on the first board. */
function draftAll(rerolls = 0): void {
  for (let i = 0; i < rerolls; i++) useRunStore.getState().reroll();
  for (let guard = 0; useRunStore.getState().run!.phase === "draft" && guard < 80; guard++) {
    const run = useRunStore.getState().run!;
    const card = run.draft.offer!.cards
      .filter((c) => c.availability === "available" && slotsForKind(c.kind).some((s) => !run.draft.roster[s]))
      .sort((a, b) => score(b) - score(a))[0];
    useRunStore.getState().pickCard(card, slotsForKind(card.kind).find((s) => !run.draft.roster[s])!);
  }
  expect(useRunStore.getState().run!.phase).toBe("review");
}

/** The code inside a `/duel#c=…` path. */
const codeOf = (path: string) => readDuelHash(path.slice(path.indexOf("#")))!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-27T12:00:00Z"));
  useProfileStore.getState().resetAll();
  useRunStore.setState({ run: null });
});
afterEach(() => vi.useRealTimers());

describe("duel draft in the run store", () => {
  const rules = makeDuelRules({ mode: "classic", rerolls: 7, showOverall: false, region: null }, 424242);

  it("draws the duel engine's boards, the same whatever the profile or the date", () => {
    expect(useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "Ana" })).toBe(true);
    const first = useRunStore.getState().run!;
    expect(first.duelMatch).toMatchObject({ role: "challenger", name: "Ana", boardIndex: 0 });
    expect(first.showOverall).toBe(false);
    expect(first.draft.rerollsLeft).toBe(7);
    expect(first.draft.offer!.lineupId).toBe(duelBoardLineup(rules, 0, 0));

    useProfileStore.setState({ xp: 80_000 });
    vi.setSystemTime(new Date("2027-03-02T08:00:00Z"));
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "" });
    expect(useRunStore.getState().run!.draft.offer).toEqual(first.draft.offer);
  });

  it("a reroll is the next board and costs one", () => {
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "" });
    useRunStore.getState().reroll();
    const run = useRunStore.getState().run!;
    expect(run.draft.rerollsLeft).toBe(6);
    expect(run.duelMatch!.boardIndex).toBeGreaterThanOrEqual(1);
    expect(run.draft.offer!.lineupId).toBe(duelBoardLineup(rules, 0, run.duelMatch!.boardIndex));
  });

  it("challenge, answer, reply: both links parse to the drafted teams and play the same series", () => {
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "Ana" });
    draftAll(2);
    const challengerTeam = duelTeamFromRoster(useRunStore.getState().run!.draft.roster, "classic");
    useRunStore.getState().startTournament(); // a duel never plays a tournament
    expect(useRunStore.getState().run!.tournament).toBeNull();
    const challengePath = useRunStore.getState().finishDuelDraft()!;
    expect(challengePath).toMatch(/^\/duel#c=2\.c\./);
    expect(useRunStore.getState().run!.duelMatch!.done).toBe(challengePath);
    const challenge = parseDuelCode(codeOf(challengePath));
    expect(challenge.ok && challenge.code.kind === "challenge").toBe(true);
    if (!challenge.ok || challenge.code.kind !== "challenge") return;
    expect(challenge.code.challenger).toEqual({ name: "Ana", team: challengerTeam });

    // The friend, in another browser.
    useRunStore.setState({ run: null });
    const challengeCode = encodeDuelCode(challenge.code);
    expect(useRunStore.getState().startDuelMatch({ rules: challenge.code.rules, role: "opponent", name: "Bia", challenge: challengeCode })).toBe(true);
    expect(useRunStore.getState().run!.draft.offer!.lineupId).toBe(duelBoardLineup(rules, 0, 0));
    draftAll();
    const replyPath = useRunStore.getState().finishDuelDraft()!;
    const reply = parseDuelCode(codeOf(replyPath));
    expect(reply.ok && reply.code.kind === "reply").toBe(true);
    if (!reply.ok || reply.code.kind !== "reply") return;
    expect(reply.code.challenger).toEqual(challenge.code.challenger);
    expect(reply.code.opponent.name).toBe("Bia");
    expect(isKnownDuelTeam(reply.code.opponent.team, "classic")).toBe(true);

    // The challenger opening the reply and the friend watching their own: one series.
    const a = playDuel(reply.code.rules, reply.code.challenger.team, reply.code.opponent.team);
    const again = parseDuelCode(codeOf(replyPath));
    if (!again.ok || again.code.kind !== "reply") throw new Error("reply did not parse twice");
    const b = playDuel(again.code.rules, again.code.challenger.team, again.code.opponent.team);
    expect(b).toEqual(a);
    expect(Math.max(...a.score)).toBe(4);
  });

  it("grants nothing: no XP, no achievements, no mission progress", () => {
    const before = useProfileStore.getState();
    const snapshot = { xp: before.xp, achievements: before.achievements, missions: before.missions, unlocked: before.unlockedSpecials };
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "" });
    draftAll();
    useRunStore.getState().finishDuelDraft();
    useRunStore.getState().finishRun();
    const after = useProfileStore.getState();
    expect({ xp: after.xp, achievements: after.achievements, missions: after.missions, unlocked: after.unlockedSpecials }).toEqual(snapshot);
  });

  it("refuses what it cannot draft, and leaves the run alone", () => {
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "" });
    const run = useRunStore.getState().run;
    expect(useRunStore.getState().startDuelMatch({ rules: { ...rules, region: "SSA" }, role: "challenger", name: "" })).toBe(false);
    expect(useRunStore.getState().startDuelMatch({ rules, role: "opponent", name: "", challenge: "2.c.broken" })).toBe(false);
    expect(useRunStore.getState().run).toBe(run);
  });

  it("restarting a duel draft starts the same rules again", () => {
    useRunStore.getState().startDuelMatch({ rules, role: "challenger", name: "Ana" });
    const first = useRunStore.getState().run!;
    useRunStore.getState().reroll();
    useRunStore.getState().restartRun();
    const again = useRunStore.getState().run!;
    expect(again.draft.offer).toEqual(first.draft.offer);
    expect(again.draft.rerollsLeft).toBe(7);
    expect(again.duelMatch!.name).toBe("Ana");
  });
});
