/**
 * Road to Worlds v2.0 (R40) — weekend view-models (pure TS, no React).
 *
 * The weekend calendar puts several events, phases and days side by side:
 * a regional week is a Saturday QUALIFIER (Swiss only, nobody is crowned)
 * then a Sunday REGIONAL; a Major / Worlds plays its Swiss stage on Saturday,
 * pauses, and plays its playoffs on CHAMPIONSHIP SUNDAY. These helpers turn
 * the persisted state into what the screens show — day roles, who is playing,
 * the two-day plan, the seeds, the Sunday bracket preview, the qualifier
 * labels and the digest's rep preview — so no screen re-derives a rule.
 *
 * Spoiler rules: every helper reads what the engine has already decided AND
 * the screen has already shown (Swiss records, playoff seeds, a bracket with
 * zero playoff rounds played). Nothing here looks at an unrevealed result.
 */

import { CAREER_UNOFFICIAL, TOURNAMENT } from "@/config/balance";
import {
  isTwoDayEvent,
  playoffsDayFor,
  qualifierDefsForWeek,
  regionalForQualifier,
  splitOfWeek,
  weekOfDay,
} from "@/engine/career/calendar";
import { eventRepKindFor, repGainFor, t3RepKeyFor } from "@/engine/career/economy";
import { deepRunKeyFor, newcomerRepKindOf, type NewcomerRepKind } from "@/engine/career/reputation";
import type { CareerEventDef, CareerSave, EventTier } from "@/engine/career/types";
import { nextPlayoffPairings } from "@/engine/playoffs";
import type { PlayoffState } from "@/engine/types";
import { seedsFromSwiss } from "@/engine/swiss";
import { atPlayoffsStart } from "@/engine/tournament";
import type { Placement, TournamentState } from "@/engine/types";
import { isChampionshipSunday, sundayIntroFlagFor } from "@/store/careerFlow";

// ---------------------------------------------------------------------------
// Day roles & participation
// ---------------------------------------------------------------------------

/**
 * What a day of an event IS for the player:
 *  - "qualifier"          the Saturday Swiss-only qualifier (top 8 go through)
 *  - "regional"           the Sunday regional (Swiss → playoffs, one day)
 *  - "swissDay"           a Major / Worlds Saturday (lobby + Swiss stage)
 *  - "championshipSunday" a Major / Worlds Sunday (the playoffs)
 *  - "cup"                an unofficial one-day cup (t3 / t2)
 */
export type WeekendRole = "qualifier" | "regional" | "swissDay" | "championshipSunday" | "cup";

export function weekendRoleOf(def: CareerEventDef, day: number): WeekendRole {
  if (def.tier === "qualifier") return "qualifier";
  if (def.tier === "regional") return "regional";
  if (isTwoDayEvent(def)) return day === playoffsDayFor(def) && day !== def.day ? "championshipSunday" : "swissDay";
  return "cup";
}

/**
 * Is the user IN this event? "tbd" while a Major / Worlds field is not
 * announced yet (it may still include the user). The agenda shows a
 * Major / Worlds to spectators too (`userEventDefOnDay`), so screens style
 * "spectating" days as not-a-matchday — and the batched Advance never stops
 * there, so the next-stop preview skips them as well.
 */
export type Participation = "playing" | "spectating" | "tbd";

export function participationOf(save: CareerSave, def: CareerEventDef): Participation {
  if (save.activeEvent?.def.id === def.id || save.pendingEventDef?.id === def.id) return "playing";
  const result = save.eventResults.find((r) => r.eventId === def.id);
  if (result) return result.userPlacement ? "playing" : "spectating";
  if (def.tier === "major") {
    const refs = save.competition.majorFieldRefs;
    // The field is announced on the Major week's Monday (and reset at each split start).
    if (!refs || weekOfDay(save.clock.day) !== def.week) return "tbd";
    return refs.includes("user") ? "playing" : "spectating";
  }
  if (def.tier === "worlds") {
    const refs = save.competition.worldsFieldRefs;
    if (!refs) return "tbd";
    return refs.includes("user") ? "playing" : "spectating";
  }
  // Qualifiers / regionals / cups only reach the agenda when they are the user's.
  return "playing";
}

// ---------------------------------------------------------------------------
// The two-day plan (lobby strip, Swiss-complete panel, calendar)
// ---------------------------------------------------------------------------

export interface WeekendPlanDay {
  day: number;
  role: WeekendRole;
  def: CareerEventDef;
  state: "done" | "today" | "next";
}

/**
 * The weekend an event belongs to, Saturday first: qualifier → regional, or
 * Swiss stage → Championship Sunday. [] for the one-day cups (no weekend
 * story to tell). `today` decides done / today / next.
 */
export function weekendPlanOf(def: CareerEventDef, today: number): WeekendPlanDay[] {
  const stateOf = (day: number): WeekendPlanDay["state"] =>
    day < today ? "done" : day === today ? "today" : "next";
  if (isTwoDayEvent(def)) {
    const sunday = playoffsDayFor(def);
    return [
      { day: def.day, role: "swissDay", def, state: stateOf(def.day) },
      { day: sunday, role: "championshipSunday", def, state: stateOf(sunday) },
    ];
  }
  if (def.tier === "qualifier") {
    const regional = regionalForQualifier(def);
    if (!regional) return [];
    return [
      { day: def.day, role: "qualifier", def, state: stateOf(def.day) },
      { day: regional.day, role: "regional", def: regional, state: stateOf(regional.day) },
    ];
  }
  if (def.tier === "regional") {
    const qualifier = qualifierDefsForWeek(def.seasonIndex, def.week).find((q) => q.region === def.region);
    if (!qualifier) return [];
    return [
      { day: qualifier.day, role: "qualifier", def: qualifier, state: stateOf(qualifier.day) },
      { day: def.day, role: "regional", def, state: stateOf(def.day) },
    ];
  }
  return [];
}

/**
 * The regional a qualifier feeds when it opens TOMORROW (the qualifier
 * digest's "On to Sunday"); null otherwise — e.g. a pre-R40 midweek
 * qualifier still in progress when the save migrated has days to go.
 */
export function regionalTomorrowOf(def: CareerEventDef, today: number): CareerEventDef | null {
  const regional = regionalForQualifier(def);
  return regional && regional.day === today + 1 ? regional : null;
}

/**
 * How the user reached a regional: through Saturday's qualifier, or seeded
 * direct. Read from the persisted qualifier result for that regional.
 */
export function regionalEntryOf(save: CareerSave, def: CareerEventDef): "qualified" | "direct" | null {
  if (def.tier !== "regional" || !def.region) return null;
  const q = save.competition.qualifiedRefs?.[def.region];
  if (q && q.eventId === def.id && q.refs.includes("user")) return "qualified";
  return "direct";
}

/** The teams that came through the qualifier into this regional (for the lobby's "Q" tags). */
export function qualifiedIntoRegional(save: CareerSave, def: CareerEventDef): Set<string> {
  if (def.tier !== "regional" || !def.region) return new Set();
  const q = save.competition.qualifiedRefs?.[def.region];
  return q && q.eventId === def.id ? new Set(q.refs) : new Set();
}

// ---------------------------------------------------------------------------
// Swiss verdicts & seeds
// ---------------------------------------------------------------------------

export interface SwissVerdict {
  outcome: "advanced" | "eliminated";
  wins: number;
  losses: number;
}

/**
 * The user's Swiss verdict from a REVEALED record (the playback's spoiler-safe
 * record): null until it reaches the wins to advance / losses to go out.
 */
export function swissVerdictOf(record: { wins: number; losses: number } | undefined): SwissVerdict | null {
  if (!record) return null;
  if (record.wins >= TOURNAMENT.swiss.winsToAdvance) return { outcome: "advanced", ...pick(record) };
  if (record.losses >= TOURNAMENT.swiss.lossesToEliminate) return { outcome: "eliminated", ...pick(record) };
  return null;
}

function pick(r: { wins: number; losses: number }): { wins: number; losses: number } {
  return { wins: r.wins, losses: r.losses };
}

export interface SeedRow {
  id: string;
  /** 1-based seed. */
  seed: number;
  wins: number;
  losses: number;
  gameDiff: number;
}

function recordOf(t: TournamentState, id: string): { wins: number; losses: number; gameDiff: number } {
  const r = t.swiss.records.find((x) => x.teamId === id);
  return { wins: r?.wins ?? 0, losses: r?.losses ?? 0, gameDiff: r?.gameDiff ?? 0 };
}

/**
 * The teams through the Swiss, in seed order: the bracket's own seeds once
 * the playoffs are seeded (a Major / Worlds), the engine's Swiss seeding rule
 * for a Swiss-only qualifier (its "qualified eight"). [] while the Swiss runs.
 */
export function advancedSeedsOf(t: TournamentState): SeedRow[] {
  if (!t.swiss.finished) return [];
  const ids = t.playoffs ? t.playoffs.seeds : seedsFromSwiss(t.swiss, t.teams);
  return ids.map((id, i) => ({ id, seed: i + 1, ...recordOf(t, id) }));
}

/** The user's seed (1-based) once the Swiss is over and they advanced; null otherwise. */
export function userSeedOf(t: TournamentState): number | null {
  const row = advancedSeedsOf(t).find((r) => r.id === "user");
  return row ? row.seed : null;
}

/**
 * The whole field in final Swiss order (wins ↓, losses ↑, game diff ↓,
 * rating ↓, id) — the live standings' rule, for a finished Swiss table.
 */
export function swissTableOrder(t: TournamentState): string[] {
  return Object.keys(t.teams).sort((a, b) => {
    const ra = recordOf(t, a);
    const rb = recordOf(t, b);
    return (
      rb.wins - ra.wins ||
      ra.losses - rb.losses ||
      rb.gameDiff - ra.gameDiff ||
      (t.teams[b]?.rating.total ?? 0) - (t.teams[a]?.rating.total ?? 0) ||
      a.localeCompare(b)
    );
  });
}

// ---------------------------------------------------------------------------
// Championship Sunday
// ---------------------------------------------------------------------------

export interface SundayPairing {
  a: { id: string; seed: number };
  b: { id: string; seed: number };
  userIn: boolean;
}

export interface SundayPreview {
  /** The opening round in bracket order (top half 1v8, 4v5 · bottom half 2v7, 3v6). */
  pairs: SundayPairing[];
  userSeed: number | null;
  /** The user's first opponent; null when the user went out in the Swiss. */
  opener: { id: string; seed: number } | null;
}

/**
 * The opening round's pairings — fixed by the seeds alone (1v8, 4v5, 2v7,
 * 3v6), so they never depend on (or reveal) a playoff result, whatever the
 * engine has already played.
 */
export function openingPairingsOf(playoffs: PlayoffState): [string, string][] {
  return nextPlayoffPairings({ ...playoffs, rounds: [], championTeamId: null, finished: false });
}

/** The user's opening-round opponent from the seeds; null when the user is not in the bracket. */
export function openingOpponentOf(playoffs: PlayoffState | null): string | null {
  if (!playoffs) return null;
  const pair = openingPairingsOf(playoffs).find(([a, b]) => a === "user" || b === "user");
  return pair ? (pair[0] === "user" ? pair[1] : pair[0]) : null;
}

/**
 * The Sunday bracket BEFORE a ball is kicked: only while the playoffs are
 * seeded and not one playoff round exists (`atPlayoffsStart`) — so it can
 * never carry a result. Null at any other moment.
 */
export function sundayPreviewOf(t: TournamentState): SundayPreview | null {
  if (!t.playoffs || !atPlayoffsStart(t)) return null;
  const seeds = t.playoffs.seeds;
  const seedOf = (id: string) => seeds.indexOf(id) + 1;
  const pairs = openingPairingsOf(t.playoffs).map(([a, b]) => ({
    a: { id: a, seed: seedOf(a) },
    b: { id: b, seed: seedOf(b) },
    userIn: a === "user" || b === "user",
  }));
  const mine = pairs.find((p) => p.userIn) ?? null;
  return {
    pairs,
    userSeed: seeds.includes("user") ? seedOf("user") : null,
    opener: mine ? (mine.a.id === "user" ? mine.b : mine.a) : null,
  };
}

/**
 * True while "sim" stops at the end of the Swiss: a Major / Worlds on its
 * Saturday (simEventToEnd holds at the pause). Keyed on the DAY, never on the
 * engine's stage — the engine runs ahead of the playback (it pauses as soon
 * as the deciding series is simulated), so a stage-keyed label would flip
 * mid-reveal and spoil the verdict.
 */
export function simStopsAtSwissEnd(def: CareerEventDef, today: number): boolean {
  return isTwoDayEvent(def) && today === def.day;
}

/**
 * True on Championship Sunday for a user knocked out in Saturday's Swiss —
 * they watch the playoffs (no "Next up" series will come for them). Keyed on
 * the day, not the engine's stage: the engine resolves a spectator's whole
 * Sunday in one step, while the playback is still revealing it.
 */
export function isSundaySpectator(save: CareerSave): boolean {
  const ev = save.activeEvent;
  if (!ev || !isTwoDayEvent(ev.def) || save.clock.day === ev.def.day) return false;
  return !(ev.tournament.playoffs?.seeds.includes("user") ?? false);
}

/**
 * True when /career/event should open with the Championship Sunday title
 * card: the two-day event is on its playoffs day, no playoff round has been
 * played, and the intro has not been seen for this event (at most once —
 * the store's `startChampionshipSunday` sets the flag).
 */
export function sundayIntroDue(save: CareerSave): boolean {
  const ev = save.activeEvent;
  if (!ev || !isChampionshipSunday(save) || !atPlayoffsStart(ev.tournament)) return false;
  return !save.flags[sundayIntroFlagFor(ev.def.id)];
}

// ---------------------------------------------------------------------------
// Labels (pure — the copy comes in)
// ---------------------------------------------------------------------------

export interface PlacementLabels {
  placement: Record<Placement, string>;
  qualifierOutcome: { qualified: string; eliminated: string };
}

/**
 * A result row's label. R40: a qualifier never has a bracket placement —
 * its "top8" reads Qualified and its "swiss_exit" Eliminated.
 */
export function placementLabelOf(labels: PlacementLabels, tier: EventTier, placement: Placement): string {
  if (tier === "qualifier") {
    return placement === "swiss_exit" ? labels.qualifierOutcome.eliminated : labels.qualifierOutcome.qualified;
  }
  return labels.placement[placement];
}

// ---------------------------------------------------------------------------
// Digest rep preview (display only — finishEvent's rule, from the engine)
// ---------------------------------------------------------------------------

/**
 * The reputation finishEvent will award for `placement` (the digest shows it
 * before the player confirms): the engine's `eventRepKindFor` — the same rule
 * applyEventRep awards — with gainRep's cap at 100, the t3 per-split cap read
 * from the save flags, and the Worlds title (finishEvent sets reputation to 100).
 */
export function eventRepPreview(input: EventRepPreviewInput): number {
  const { tier, placement, reputation } = input;
  if (tier === "worlds" && placement === "champion") return Math.max(0, 100 - reputation);
  const kind = eventRepPreviewKind(input);
  return kind ? Math.max(0, Math.min(100 - reputation, repGainFor(kind, reputation))) : 0;
}

export interface EventRepPreviewInput {
  tier: EventTier;
  placement: Placement;
  reputation: number;
  flags: Record<string, unknown>;
  seasonIndex: number;
  day: number;
  /** rc.33 (RTW-02): the finished event — the newcomer's path reads the user's seed and Swiss wins. */
  tournament?: TournamentState;
}

/**
 * The kind of reputation finishEvent awards (applyEventRep's order: the
 * placement first, then rc.33's newcomer path against the seed), or null.
 */
export function eventRepPreviewKind(input: EventRepPreviewInput): ReturnType<typeof eventRepKindFor> | NewcomerRepKind | null {
  const split = splitOfWeek(weekOfDay(input.day));
  const used = Number(input.flags[t3RepKeyFor(input.seasonIndex, split)] ?? 0) || 0;
  const t3CapReached = used >= CAREER_UNOFFICIAL.t3RepCapPerSplit;
  const deepRunsThisSplit = Number(input.flags[deepRunKeyFor(input.seasonIndex, split)] ?? 0) || 0;
  return (
    eventRepKindFor(input.tier, input.placement, { t3CapReached }) ??
    (input.tournament
      ? newcomerRepKindOf(input.tier, input.placement, input.tournament, {
          rep: input.reputation,
          t3CapReached,
          deepRunsThisSplit,
        })
      : null)
  );
}
