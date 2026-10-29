/**
 * Draft-run labels in the active language (rc.29, E2E DRAFT-10). The engine
 * names the player's team "Your Team" and writes English stage labels into the
 * results; the screens name both from the copy dictionary instead, at render
 * time, so a PT run reads PT everywhere and switching the language mid-run
 * relabels everything at once.
 */

import type { Copy } from "@/content/copy.en";
import type { DailyInfo, DailyObjective, StageRef, TournamentState, XpLine } from "@/engine/types";

type TournamentCopy = Copy["TOURNAMENT_UI"];
type DailyCopy = Copy["DAILY_TEXT"];

/** The engine's id for the player's team in a Draft run. */
export const USER_TEAM_ID = "user";

/** A tournament team's display name — the player's team in the active language. */
export function teamDisplayName(team: { id: string; name: string }, T: Pick<TournamentCopy, "yourTeam">): string {
  return team.id === USER_TEAM_ID ? T.yourTeam : team.name;
}

/** A stage as a results label: "Swiss Round 2" / "Swiss · Rodada 2", "Grand Final" / "Grande Final". */
export function stageRefLabel(ref: StageRef, T: Pick<TournamentCopy, "swissRound" | "roundNames">): string {
  return ref.kind === "swiss" ? T.swissRound(ref.round) : (T.roundNames[ref.round] ?? ref.round);
}

/** A results highlight / eliminator stage in the active language. Results
 *  saved before rc.29 carry no `stageRef` and keep their English label. */
export function resultStageLabel(
  h: { stage: string; stageRef?: StageRef },
  T: Pick<TournamentCopy, "swissRound" | "roundNames">,
): string {
  return h.stageRef ? stageRefLabel(h.stageRef, T) : h.stage;
}

/** The Match Center kicker of a series: "Swiss Stage · Round 2" or the playoff round's name. */
export function seriesStageLabel(
  t: TournamentState,
  entry: { stage: "swiss" | "playoffs"; roundIndex: number },
  T: Pick<TournamentCopy, "swiss" | "round" | "roundNames">,
): string {
  if (entry.stage === "swiss") {
    const round = t.swiss.rounds[entry.roundIndex]?.round ?? entry.roundIndex + 1;
    return `${T.swiss} · ${T.round(round)}`;
  }
  const name = t.playoffs?.rounds[entry.roundIndex]?.name ?? "";
  return T.roundNames[name] ?? name;
}

/** A Season Rating change: "+12", "-8", and "±0" when nothing moved (DRAFT-16). */
export function signedDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return "±0";
}

/**
 * The results XP breakdown's multiplier rows (rc.29, DRAFT-09): the difficulty
 * and the game-mode factors apart ("Difficulty multiplier ×1.5", "Quick Draft
 * multiplier ×0.5"), factors of 1 left out. A result saved before the split
 * only has the product: one neutral "XP multiplier" row.
 */
export function xpMultiplierRows(
  xp: { difficultyMultiplier: number; factors?: { difficulty: number; mode: number } },
  mode: string,
  R: Pick<Copy["RESULTS_UI"], "difficultyMultiplier" | "modeMultiplier" | "xpMultiplier">,
): { label: string; value: number }[] {
  const f = xp.factors;
  if (!f) return xp.difficultyMultiplier !== 1 ? [{ label: R.xpMultiplier, value: xp.difficultyMultiplier }] : [];
  const rows: { label: string; value: number }[] = [];
  if (f.difficulty !== 1) rows.push({ label: R.difficultyMultiplier, value: f.difficulty });
  if (f.mode !== 1) rows.push({ label: R.modeMultiplier[mode] ?? R.xpMultiplier, value: f.mode });
  return rows;
}

/**
 * rc.30: the Daily's name, description and objective in the active language
 * (DAILY_TEXT, keyed by the template the day rolled). A run saved before rc.30
 * carries no `templateId` and keeps its stored English text.
 */
export function dailyLabel(info: DailyInfo, D: DailyCopy): string {
  return info.templateId ? D.templates[info.templateId].label(info.region ?? "") : info.label;
}

export function dailyDescription(info: DailyInfo, D: DailyCopy): string {
  return info.templateId ? D.templates[info.templateId].description(info.region ?? "") : info.description;
}

/** A Daily bonus objective — localized from its type and threshold (every objective carries both). */
export function dailyObjectiveLabel(obj: DailyObjective, D: DailyCopy): string {
  return D.objectives[obj.type](obj.value ?? 0);
}

/** "Daily · Legacy Day" / "Diário · Dia Legacy" — the run-title tag. */
export function dailyRunTag(info: DailyInfo, D: DailyCopy): string {
  return `${D.tag} · ${dailyLabel(info, D)}`;
}

/**
 * rc.30: an XP breakdown line in the active language (RESULTS_UI.xpLines,
 * keyed by `XpLine.key`); a result saved before rc.30 keeps its stored label.
 */
export function xpLineLabel(line: XpLine, R: Pick<Copy["RESULTS_UI"], "xpLines">, D: DailyCopy): string {
  const L = R.xpLines;
  switch (line.key) {
    case "completeRun":
      return L.completeRun;
    case "swissWins":
      return L.swissWins(line.n ?? 0);
    case "qualified":
      return L.qualified;
    case "playoffWins":
      return L.playoffWins(line.n ?? 0);
    case "placement":
      return (line.placement && L.placement[line.placement]) || L.placementBonus;
    case "objective":
      return line.objective ? L.objective(dailyObjectiveLabel(line.objective, D)) : line.label;
    case "achievements":
      return L.achievements;
    case "specials":
      return L.specials;
    default:
      return line.label;
  }
}
