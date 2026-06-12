/**
 * Run results compilation: placement, highlights, special unlocks,
 * achievements and the XP breakdown (base doc §27, §30).
 */

import { DIFFICULTY, XP } from "@/config/balance";
import { achievementById, playerCardById, specialCardById } from "@/data";
import type { Rng } from "@/lib/rng";
import { evaluateAchievements } from "./achievements";
import { finalOverall } from "./cards";
import { userPlayoffSeries } from "./playoffs";
import { userSwissRecord } from "./swiss";
import { userPlacement } from "./tournament";
import type {
  RunResults,
  RunState,
  SeriesHighlight,
  SeriesResult,
  TournamentState,
  XpLine,
} from "./types";

interface ProfileSnapshot {
  unlockedSpecialIds: string[];
  achievementIds: string[];
}

interface LabeledSeries {
  label: string;
  series: SeriesResult;
}

function labeledUserSeries(t: TournamentState): LabeledSeries[] {
  const out: LabeledSeries[] = [];
  for (const round of t.swiss.rounds) {
    for (const series of round.series) {
      if (series.teamAId === "user" || series.teamBId === "user") {
        out.push({ label: `Swiss Round ${round.round}`, series });
      }
    }
  }
  const playoffLabels: Record<string, string> = {
    ub_quarterfinal: "UB Quarterfinal",
    lb_round1: "LB Round 1",
    ub_semifinal: "UB Semifinal",
    lb_round2: "LB Round 2",
    ub_final: "UB Final",
    lb_semifinal: "LB Semifinal",
    lb_final: "LB Final",
    third_place: "Third Place Match",
    grand_final: "Grand Final",
  };
  for (const entry of userPlayoffSeries(t.playoffs)) {
    out.push({ label: playoffLabels[entry.round] ?? entry.round, series: entry.series });
  }
  return out;
}

/** Goals conceded by the user across every game of the run. */
function goalsConcededBy(userId: string, all: LabeledSeries[]): number {
  let conceded = 0;
  for (const { series } of all) {
    for (const game of series.games) {
      // game.score is [winner goals, loser goals].
      conceded += game.winnerTeamId === userId ? game.score[1] : game.score[0];
    }
  }
  return conceded;
}

function highlight(t: TournamentState, entry: LabeledSeries): SeriesHighlight {
  const { series, label } = entry;
  const oppId = series.teamAId === "user" ? series.teamBId : series.teamAId;
  const userFirstScore: [number, number] =
    series.teamAId === "user" ? series.score : [series.score[1], series.score[0]];
  return {
    opponentName: t.teams[oppId]?.name ?? "Unknown",
    score: userFirstScore,
    stage: label,
  };
}

export function compileResults(
  run: RunState,
  tournament: TournamentState,
  profile: ProfileSnapshot,
  rng: Rng,
): RunResults {
  const placement = userPlacement(tournament);
  const swissRecord = userSwissRecord(tournament.swiss);
  const playoffSeries = userPlayoffSeries(tournament.playoffs);
  const playoffWins = playoffSeries.filter((e) => e.series.winnerTeamId === "user").length;

  const championId = tournament.playoffs?.championTeamId;
  const championName =
    championId && championId !== "user"
      ? tournament.teams[championId]?.name ?? null
      : null;

  // --- Highlights ---
  const all = labeledUserSeries(tournament);
  const wins = all.filter((e) => e.series.winnerTeamId === "user");
  const losses = all.filter((e) => e.series.winnerTeamId !== "user");

  const margin = (s: SeriesResult) => Math.abs(s.score[0] - s.score[1]);

  const biggestWin =
    wins.length > 0
      ? highlight(
          tournament,
          wins.reduce((best, e) => (margin(e.series) > margin(best.series) ? e : best)),
        )
      : null;

  const worstLoss =
    losses.length > 0
      ? highlight(
          tournament,
          losses.reduce((worst, e) => (margin(e.series) > margin(worst.series) ? e : worst)),
        )
      : null;

  const decidingGames = all.filter((e) => {
    const [a, b] = e.series.score;
    return Math.abs(a - b) === 1;
  });
  const closestSeries =
    decidingGames.length > 0
      ? highlight(tournament, decidingGames[decidingGames.length - 1])
      : null;

  // --- Best player: card overall plus a touch of run-to-run variance ---
  const playerPicks = [run.draft.roster.player1, run.draft.roster.player2, run.draft.roster.player3];
  const userTeam = tournament.teams["user"];
  let bestPlayerCardId: string | null = null;
  if (userTeam && playerPicks.every(Boolean)) {
    let bestScore = -Infinity;
    for (const pick of playerPicks) {
      const special = pick!.specialId ? specialCardById.get(pick!.specialId) : undefined;
      const card = playerCardById.get(pick!.refId);
      const overall = special?.overall ?? (card ? finalOverall(card) : 0);
      const score = overall + rng.range(0, 4);
      if (score > bestScore) {
        bestScore = score;
        bestPlayerCardId = pick!.refId;
      }
    }
  }

  // --- Special unlocks: drafted special cards unlock on run completion ---
  const draftedSpecials = [
    run.draft.roster.player1,
    run.draft.roster.player2,
    run.draft.roster.player3,
    run.draft.roster.sub,
  ]
    .map((p) => p?.specialId)
    .filter((id): id is string => Boolean(id));
  const unlockedSpecialIds = draftedSpecials.filter(
    (id) => !profile.unlockedSpecialIds.includes(id),
  );

  const goalsConceded = goalsConcededBy("user", all);

  // --- Achievements ---
  const newAchievementIds = evaluateAchievements({
    run,
    tournament,
    placement,
    chemistry: userTeam?.chemistry ?? {
      raw: 0,
      max: 1,
      percent: 0,
      tier: "Poor",
      items: [],
    },
    goalsConceded,
    specialsOwnedAfter: profile.unlockedSpecialIds.length + unlockedSpecialIds.length,
    alreadyEarned: new Set(profile.achievementIds),
  });

  // --- XP ---
  const lines: XpLine[] = [{ label: "Run completed", amount: XP.completeRun }];
  if (swissRecord.wins > 0) {
    lines.push({ label: `Swiss wins ×${swissRecord.wins}`, amount: swissRecord.wins * XP.swissWin });
  }
  if (placement !== "swiss_exit") {
    lines.push({ label: "Qualified for playoffs", amount: XP.qualifyPlayoffs });
  }
  if (playoffWins > 0) {
    lines.push({
      label: `Playoff series wins ×${playoffWins}`,
      amount: playoffWins * XP.playoffSeriesWin,
    });
  }
  const placementBonus = XP.placementBonus[placement] ?? 0;
  if (placementBonus > 0) {
    const placementLabel: Record<string, string> = {
      champion: "Tournament champion",
      runner_up: "Grand finalist",
      third: "Third place",
      fourth: "Fourth place",
    };
    lines.push({ label: placementLabel[placement] ?? "Placement bonus", amount: placementBonus });
  }

  const difficultyMultiplier = DIFFICULTY[run.difficulty].xpMultiplier;
  const hiddenOverallBonus = run.showOverall ? 0 : XP.hiddenOverallBonus;
  const base = lines.reduce((sum, l) => sum + l.amount, 0);

  const achievementXp = newAchievementIds.reduce(
    (sum, id) => sum + (achievementById.get(id)?.xp ?? 0),
    0,
  );
  if (achievementXp > 0) {
    lines.push({ label: "Achievements", amount: achievementXp });
  }

  const total = Math.round(base * difficultyMultiplier * (1 + hiddenOverallBonus)) + achievementXp;

  return {
    placement,
    swissRecord,
    playoffWins,
    championName,
    bestPlayerCardId,
    biggestWin,
    closestSeries,
    worstLoss,
    goalsConceded,
    unlockedSpecialIds,
    newAchievementIds,
    xp: { lines, difficultyMultiplier, hiddenOverallBonus, total },
  };
}
