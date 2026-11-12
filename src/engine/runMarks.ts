/**
 * Run marks (rc.51) — permanent facts a finished run leaves on the profile, read
 * only by the cosmetics derivation (`{ type: "run-mark" }` / `"run-marks-all"`
 * sources in `src/data/cosmetics.ts`). They are stored with the career marks
 * (`profile.careerMarks`, union-merged with the cloud, untouched by a Season
 * reset) under a `run-` prefix, so no new persisted field is needed
 * (DESIGN-DECISIONS, rc.51).
 *
 * All three are Classic-only: Daily, Quick and Challenges never set them.
 *  · `run-one-flag` (Technician): a Classic title with NO region lock whose three
 *    players, coach and substitute share one non-empty country code. The org is
 *    not part of the condition; any difficulty.
 *  · `run-clean-sweep` (Clean Sweep): a Classic title with all six slots filled
 *    and no series lost in the Swiss stage or the playoffs.
 *  · `run-lock-<region>` (Trade Minister needs all five): a Classic title on a
 *    region lock; one mark per playable lock (NA, EU, SAM, MENA, OCE).
 *
 * Pure and deterministic: reads the run and its finished tournament only.
 */

import { coachById, playerById, playerCardById, subById } from "@/data";
import { runLockMark, TRADE_MINISTER_REGIONS } from "@/data/cosmetics";
import { userPlayoffSeries } from "./playoffs";
import type { Roster, RunState, TournamentState } from "./types";

export const RUN_MARK_ONE_FLAG = "run-one-flag";
export const RUN_MARK_CLEAN_SWEEP = "run-clean-sweep";

const SLOTS = ["player1", "player2", "player3", "coach", "sub", "org"] as const;

/** Country codes of the three players, the coach and the substitute (a missing
 *  slot or a card without a country gives an empty entry). */
function staffCountries(roster: Roster): string[] {
  const players = [roster.player1, roster.player2, roster.player3].map((pick) => {
    const card = pick ? playerCardById.get(pick.refId) : undefined;
    return (card ? playerById.get(card.playerId)?.country : undefined) ?? "";
  });
  const coach = roster.coach ? (coachById.get(roster.coach.refId)?.country ?? "") : "";
  const sub = roster.sub ? (subById.get(roster.sub.refId)?.country ?? "") : "";
  return [...players, coach, sub];
}

/** True when the user lost no series (Swiss or playoffs) and played at least one. */
function unbeaten(t: TournamentState): boolean {
  const swiss = t.swiss.rounds.flatMap((r) => r.series.filter((s) => s.teamAId === "user" || s.teamBId === "user"));
  const all = [...swiss, ...userPlayoffSeries(t.playoffs).map((e) => e.series)];
  return all.length > 0 && all.every((s) => s.winnerTeamId === "user");
}

/** The marks this finished run earns (may repeat ones the profile already has). */
export function runMarksFor(run: RunState, t: TournamentState): string[] {
  if (run.mode !== "classic" || t.playoffs?.championTeamId !== "user") return [];
  const marks: string[] = [];
  const roster = run.draft.roster;
  if (!run.regionLock) {
    const countries = staffCountries(roster);
    if (countries[0] && countries.every((c) => c === countries[0])) marks.push(RUN_MARK_ONE_FLAG);
  } else if ((TRADE_MINISTER_REGIONS as readonly string[]).includes(run.regionLock)) {
    marks.push(runLockMark(run.regionLock));
  }
  if (SLOTS.every((slot) => roster[slot]) && unbeaten(t)) marks.push(RUN_MARK_CLEAN_SWEEP);
  return marks;
}
