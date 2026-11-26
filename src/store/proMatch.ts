/**
 * v2.2 Pro spine round 2 (PROSPINE, PRO-SPEC §6): the Pro plays his side's
 * series, on the amateur seat and in his org (the org sits on the host seat,
 * proSeat.ts).
 *
 * The event runs on the host in the Matchday custom mode, stopping at every
 * series of his side. Each game of it carries ONE decision of his
 * (moments.buildDecision, from the key moment of the game as it would go):
 * he picks a call or goes "on instinct", `resolveDecision` gives its bounded
 * team effect (inside the series ledger, EMPTY_LEDGER at each series) and the
 * game is then played by the Matchday series engine with that edge on his
 * side, from the same cursor. His rating of the game is the box score's line
 * plus his level against his mates, the call and his form (finalProRating).
 * He can sim the rest of the series or of the event (every call on instinct).
 * A benched Pro does not decide: the event is simmed and he gets the short
 * report. Without the Matchday engine (FEATURES.matchdayDecisions off: tests,
 * production) every event is simmed the same way.
 */

import { CAREER_PRO_TEAM } from "@/config/balance";
import { clamp } from "@/lib/util";
import { buildGameBoxScore } from "@/engine/career/boxScore";
import { isSeriesOver, type SeriesState } from "@/engine/match";
import { playUserGame } from "@/engine/career/matchdaySeries";
import { proOverall } from "@/engine/career/pro/attrs";
import { buildDecision, EMPTY_LEDGER, finalProRating, resolveDecision } from "@/engine/career/pro/spineBridge";
import type { ProGameLine, ProLiveSeries, ProSeriesLine } from "@/engine/career/pro/spineTypes";
import type { ProSave } from "@/engine/career/pro/types";
import { PRO_SELF_ID } from "@/engine/career/pro/world";
import type { CareerSave } from "@/engine/career/types";
import type { SeriesResult, TournamentTeam } from "@/engine/types";
import {
  finishEvent,
  isEventPaused,
  pendingUserSeriesOf,
  simEventToEnd,
  startEvent,
  stepEventRound,
  userSeriesTeamsOf,
} from "./careerFlow";
import { bookLines, bookSeries, hostOf, noteTitle, placementOf, proStopOf, storeHost } from "./proFlow";

const withMode = (host: CareerSave, mode: "quick" | "custom"): CareerSave =>
  host.prefs.matchdayMode === mode && host.prefs.matchdayStopAt === "every" ? host : { ...host, prefs: { ...host.prefs, matchdayMode: mode, matchdayStopAt: "every" } };

/** He is on the court for this event (fielded at its start; a benched or ruled-out Pro is not). */
function fielded(host: CareerSave): boolean {
  return Boolean(host.activeEvent?.fieldedIds?.includes(PRO_SELF_ID));
}

function teamNameOf(save: ProSave, host: CareerSave): string {
  return save.amateur?.name ?? save.contract?.orgName ?? host.identity.orgName;
}

/** Does the event step series by series for him now. */
export function proStepsEvent(save: ProSave): boolean {
  const host = hostOf(save);
  return Boolean(host?.activeEvent?.matchday && fielded(host));
}

/** The series so far as a SeriesResult (the box score reads it; the score is the games'). */
function seriesSoFar(state: SeriesState): SeriesResult {
  const last = state.games[state.games.length - 1];
  return {
    teamAId: state.teamAId,
    teamBId: state.teamBId,
    games: state.games,
    score: [state.winsA, state.winsB],
    winnerTeamId: last?.winnerTeamId ?? state.teamAId,
    ratingDiff: 0,
    upset: false,
  };
}

/** The event is over: the placement on the report, the host settles it, a title is written down. */
function closeEvent(save: ProSave): ProSave {
  const host = hostOf(save)!;
  const ev = host.activeEvent;
  if (!ev || ev.tournament.stage !== "finished") return save;
  const placement = placementOf(ev.tournament, "user");
  let out = save.report && save.report.eventId === ev.def.id ? { ...save, report: { ...save.report, placement } } : save;
  out = storeHost({ ...out, live: null }, withMode(finishEvent(host), "quick"));
  if (placement === "champion") out = noteTitle(out, ev.def.name, teamNameOf(save, host));
  return out;
}

/** The whole event without his calls (benched, or no Matchday engine): simmed, then the short report. */
function simWithoutHim(save: ProSave): ProSave {
  let host = hostOf(save)!;
  host = simEventToEnd(withMode(host, "quick"));
  const ev = host.activeEvent;
  if (!ev) return storeHost(save, host);
  const out = bookSeries(storeHost(save, host), ev.def, ev.tournament, "user", teamNameOf(save, host));
  return closeEvent(out);
}

/** The next game's decision of the open series (null without a key moment, or when he is not on the court). */
function prepareDecision(save: ProSave, host: CareerSave): ProSave {
  const us = pendingUserSeriesOf(host);
  const teams = userSeriesTeamsOf(host);
  if (!us || !teams || isSeriesOver(us.state)) return save;
  const side = us.userSide;
  const mine = side === "a" ? teams.teamA : teams.teamB;
  const theirs = side === "a" ? teams.teamB : teams.teamA;
  const proIdx = mine.playerNames.indexOf(save.player.name);
  const live: ProLiveSeries =
    save.live && save.live.roundKey === us.roundKey && save.live.eventId === host.activeEvent!.def.id
      ? save.live
      : { eventId: host.activeEvent!.def.id, roundKey: us.roundKey, opponent: theirs.name, decision: null, ledger: EMPTY_LEDGER, games: [], last: null };
  let decision = null;
  if (proIdx >= 0) {
    const tentative = playUserGame(us.state, us.rngState, teams.teamA, teams.teamB, side);
    const game = tentative.state.games[tentative.state.games.length - 1];
    const box = buildGameBoxScore(seriesSoFar(tentative.state), game, us.roundKey, { a: teams.teamA, b: teams.teamB });
    decision = buildDecision(box, { side, proIdx, player: save.player });
  }
  return { ...save, live: { ...live, decision } };
}

/** Moves the event on to his next series (or its pause, or its end). */
function runToNextSeries(input: ProSave): ProSave {
  let save = input;
  for (let guard = 0; guard < 40; guard++) {
    const host = hostOf(save)!;
    const ev = host.activeEvent;
    if (!ev) return { ...save, live: null };
    if (ev.tournament.stage === "finished") return closeEvent(save);
    if (isEventPaused(host)) return { ...save, live: null };
    const us = pendingUserSeriesOf(host);
    if (us && !isSeriesOver(us.state)) return prepareDecision(save, host);
    const next = stepEventRound(host);
    if (next === host) return save;
    save = storeHost(save, next);
  }
  return save;
}

/** The matchday button: starts today's event (or continues the one in progress) up to his first decision. */
export function playProMatchdayFlow(input: ProSave): ProSave {
  const stop = proStopOf(input);
  if (!stop || (stop.kind !== "matchday" && stop.kind !== "event")) return input;
  let save = input;
  let host = hostOf(save)!;
  if (!host.activeEvent) {
    host = startEvent(withMode(host, "custom"), true);
    if (!host.activeEvent) return input;
    save = storeHost({ ...save, report: null, live: null }, host);
  }
  if (!proStepsEvent(save)) return simWithoutHim(save);
  if (save.live?.eventId === host.activeEvent!.def.id && pendingUserSeriesOf(host)) return save; // a decision is already waiting
  return runToNextSeries(storeHost(save, withMode(host, "custom")));
}

/** He answers the game's decision (an option id, or "instinct"); the game is played with its edge. */
export function decideProGameFlow(input: ProSave, choice: string | "instinct"): ProSave {
  const live = input.live;
  const host = hostOf(input);
  const us = host ? pendingUserSeriesOf(host) : null;
  const teams = host ? userSeriesTeamsOf(host) : null;
  if (!live || !host || !us || !teams || us.roundKey !== live.roundKey || isSeriesOver(us.state)) return input;
  const side = us.userSide;
  const result = live.decision
    ? resolveDecision(live.decision, choice, input.player, { careerSeed: input.careerSeed, streamKey: `${live.eventId}:${live.roundKey}`, ledger: live.ledger })
    : null;
  const edge = (t: TournamentTeam): TournamentTeam => (result && result.teamDelta !== 0 ? { ...t, rating: { ...t.rating, total: t.rating.total + result.teamDelta } } : t);
  const teamA = side === "a" ? edge(teams.teamA) : teams.teamA;
  const teamB = side === "b" ? edge(teams.teamB) : teams.teamB;
  const played = playUserGame(us.state, us.rngState, teamA, teamB, side);
  const ev = host.activeEvent!;
  const nextHost: CareerSave = { ...host, activeEvent: { ...ev, userSeries: { ...us, state: played.state, rngState: played.rngState } } };

  // His line of the game, from the box score of the game as played.
  const game = played.state.games[played.state.games.length - 1];
  const box = buildGameBoxScore(seriesSoFar(played.state), game, us.roundKey, { a: teams.teamA, b: teams.teamB });
  const mine = side === "a" ? teams.teamA : teams.teamB;
  const idx = mine.playerNames.indexOf(input.player.name);
  const line = idx >= 0 ? box.players[side][idx] : undefined;
  const T = CAREER_PRO_TEAM;
  const lvl = clamp((proOverall(input.player.attrs) - mine.rating.avgPlayerOverall) * T.ratingEdgePerPoint, -T.ratingEdgeCap, T.ratingEdgeCap);
  const final = side === "a" ? box.final : ([box.final[1], box.final[0]] as [number, number]);
  const gameLine: ProGameLine = {
    us: final[0],
    them: final[1],
    overtime: box.overtime,
    pro: line
      ? {
          goals: line.goals,
          assists: line.assists,
          saves: line.saves,
          shots: line.shots,
          rating: finalProRating(clamp(line.rating + lvl, 0, 10), result?.ratingDelta ?? 0, input.player.confidence),
          mvp: box.mvp?.side === side && box.mvp.playerIdx === idx,
        }
      : null,
  };
  const games = [...live.games, gameLine];
  let save: ProSave = storeHost(
    {
      ...input,
      live: { ...live, games, ledger: result?.ledger ?? live.ledger, decision: null, last: result ? { optionId: result.optionId, success: result.success, instinct: result.instinct } : null },
    },
    nextHost,
  );
  if (!isSeriesOver(played.state)) return prepareDecision(save, hostOf(save)!);

  // The series is over: it goes into the report with its XP, then on to his next one.
  const rated = games.filter((g) => g.pro);
  const seriesLine: ProSeriesLine = {
    roundKey: live.roundKey,
    opponent: live.opponent,
    won: side === "a" ? played.state.winsA > played.state.winsB : played.state.winsB > played.state.winsA,
    score: side === "a" ? [played.state.winsA, played.state.winsB] : [played.state.winsB, played.state.winsA],
    games,
    rating: rated.length ? Math.round((rated.reduce((a, g) => a + g.pro!.rating, 0) / rated.length) * 10) / 10 : null,
  };
  const opp = side === "a" ? teams.teamB : teams.teamA;
  save = bookLines(save, ev.def, [seriesLine], teamNameOf(save, host), () => opp.rating.total, undefined);
  save = { ...save, report: save.report ? { ...save.report, revealed: save.report.series.reduce((n, x) => n + x.games.length, 0) } : null };
  return runToNextSeries({ ...save, live: null });
}

/** The rest of this series on instinct. */
export function simProSeriesFlow(input: ProSave): ProSave {
  const key = input.live?.roundKey;
  let save = input;
  for (let guard = 0; guard < 9 && save.live && save.live.roundKey === key; guard++) {
    const next = decideProGameFlow(save, "instinct");
    if (next === save) break;
    save = next;
  }
  return save;
}

/** The rest of today's event on instinct (a two-day event stops at its Saturday pause). */
export function simProEventFlow(input: ProSave): ProSave {
  let save = input;
  for (let guard = 0; guard < 200; guard++) {
    const host = hostOf(save);
    if (!host?.activeEvent || isEventPaused(host)) break;
    const next = save.live ? decideProGameFlow(save, "instinct") : playProMatchdayFlow(save);
    if (next === save) break;
    save = next;
  }
  return save;
}
