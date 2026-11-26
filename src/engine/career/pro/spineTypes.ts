/**
 * v2.2 Pro spine (PROSPINE, slices 3-4): the save-level shapes of the Pro's
 * life in the world. The player (attributes, meters) is `ProPlayer`; these
 * are the team, the contract, the offers, the match reports, the history and
 * the news. Every field the spine adds to a `ProSave` is optional, so a
 * slice-1 save loads and plays.
 */

import type { CareerSave, CareerEventDef, WorldOrgState } from "../types";
import type { DecisionLedger, ProDecision } from "./moments";
import type { ProGrowthEntry, ProWeekNote, ProWeekPlan } from "./types";

/** The hidden host: the manager flow that runs the Pro's calendar (R-PROSPINE-1). The world, clock and competition live on the ProSave. */
export type ProHost = Omit<CareerSave, "world" | "clock" | "competition">;

export type ProRole = "starter" | "rotation";

export interface ProContract {
  orgRef: string;
  orgName: string;
  salaryPerSplit: number;
  /** Last season (inclusive) the deal covers. */
  endSeason: number;
  /** What the org promised at signing. */
  role: ProRole;
  signedSeason: number;
  signedDay: number;
  /** The Pro asked to leave (while benched). */
  transferRequested?: boolean;
  /** A renewal was signed for this deal (the endSeason already moved). */
  renewed?: boolean;
}

/** An amateur side the Pro plays for (not a world org: it takes the manager's "user" seat). */
export interface ProAmateurSide {
  /** The local-scene ref its name comes from (never fielded as a local side). */
  ref: string;
  name: string;
  /** The two teammates' level when they called (their own growth runs on the host squad). */
  level: number;
}

export type ProOfferKind = "amateur" | "org" | "renewal";
export type ProOfferStatus = "open" | "accepted" | "declined" | "expired" | "withdrawn";

export interface ProOfferReason {
  /** Which line of copy explains it (PRO_WORLD.offers.reason). */
  key: "form" | "results" | "youth" | "level" | "renewal";
  params: Record<string, string | number>;
}

export interface ProOffer {
  id: string;
  kind: ProOfferKind;
  /** World org ref (org, renewal) or the amateur side's local ref. */
  ref: string;
  name: string;
  /** Amateur: the teammates' level. Org: the org's rating when it called. */
  level: number;
  salaryPerSplit: number;
  lengthSeasons: 1 | 2;
  role: ProRole;
  reason: ProOfferReason;
  madeSeason: number;
  madeDay: number;
  /** Last day (inclusive) it can be answered. */
  expiresSeason: number;
  expiresDay: number;
  status: ProOfferStatus;
  /** QA round: the org's future is in doubt (the dataset or Mundo vivo may end it soon); the offer says so. */
  uncertain?: boolean;
  /** The one counter-offer: shown risk (0-1) and how it went. */
  counterRisk: number;
  counter?: "improved" | "walked";
}

/** One game of the Pro's team, from the box score. */
export interface ProGameLine {
  us: number;
  them: number;
  overtime: boolean;
  /** Null when he did not play (benched). */
  pro: { goals: number; assists: number; saves: number; shots: number; rating: number; mvp: boolean } | null;
}

/** One series of the Pro's team. */
export interface ProSeriesLine {
  roundKey: string;
  opponent: string;
  won: boolean;
  score: [number, number];
  games: ProGameLine[];
  /** His average rating (0-10, one decimal), null when benched. */
  rating: number | null;
}

/** What the Pro watches after a matchday: his team's series of one event, revealed game by game. */
export interface ProMatchReport {
  id: string;
  eventId: string;
  eventName: string;
  tier: CareerEventDef["tier"];
  seasonIndex: number;
  day: number;
  teamName: string;
  benched: boolean;
  series: ProSeriesLine[];
  /** Games revealed so far across the series (the screen's cursor). */
  revealed: number;
  /** Where the team finished, when the event is over. */
  placement?: "champion" | "final" | "playoffs" | "out";
}

/** A played series, kept short for offers and lineups (newest last). */
export interface ProMatchLogEntry {
  seasonIndex: number;
  day: number;
  tier: CareerEventDef["tier"];
  won: boolean;
  rating: number;
}

export interface ProSeasonLine {
  seasonIndex: number;
  age: number;
  teams: string[];
  overallStart: number;
  overallEnd: number;
  series: number;
  seriesWon: number;
  avgRating: number | null;
  /** Round 2 (optional on older lines): his main team, how he was used, games played, what the team won. */
  team?: string | null;
  role?: "starter" | "rotation" | "bench" | "amateur" | "none";
  games?: number;
  results?: string[];
}

export interface ProNewsItem {
  id: string;
  seasonIndex: number;
  day: number;
  /** PRO_WORLD.news key. */
  key: string;
  params: Record<string, string | number>;
  read?: boolean;
}

/** What the Advance stops at (proFlow.proStopOf). */
export type ProStop =
  | { kind: "weekPlan" }
  | { kind: "matchday"; eventName: string }
  | { kind: "event"; eventName: string }
  | { kind: "seasonEnd" }
  | { kind: "retired" };

/** The spine's fields on a ProSave (all optional: a slice-1 save has none). */
export interface ProSpineFields {
  host?: ProHost;
  amateur?: ProAmateurSide | null;
  contract?: ProContract | null;
  /** 0-100: what the org's coach thinks of him (lineup.ts). */
  coachTrust?: number;
  report?: ProMatchReport | null;
  matchLog?: ProMatchLogEntry[];
  /** The season's overall at its first day (the history line reads it). */
  seasonStartOverall?: number;
  seasonSeries?: { played: number; won: number; ratingSum: number; teams: string[]; games?: number; benched?: number; titles?: string[]; mvps?: number };
  /** Round 2: career totals the scene nicknames read (nickname.ts facts). */
  careerFacts?: Partial<Record<string, number>>;
  /** Round 2 (R-PROSPINE-6): the org on the host seat while he is under contract (proSeat.ts). */
  orgShell?: { org: WorldOrgState; liftedOverall: Record<string, number> } | null;
  /** Round 2: the rounds of the current event already booked (XP and counts never twice). */
  bookedRounds?: { eventId: string; keys: string[] } | null;
  /** Round 2: the series he is playing, game by game (proMatch.ts). */
  live?: ProLiveSeries | null;
  /** Round 2: the end offered after a year without a contract (he may keep going). */
  retireOffer?: boolean;
  /** Round 2: what the career holds for the card. */
  careerOrgs?: string[];
  careerTitles?: string[];
  /** Round 2: the next window's offers are guaranteed (his org left the scene at a rollover). */
  guaranteeOffers?: boolean;
  /** Days the batched advance already stopped on (a stop is shown once). */
  seenStopKey?: string;
  /** QA round: the week's plan as confirmed (one tap on Monday, or the auto-plan), and how it was chosen. */
  thisWeek?: { key: string; plan: ProWeekPlan; source: "coach" | "own" | "repeat" | "fallback" } | null;
  /** QA round: Continue plans each week by itself (the saved plan, the coach's when it would tire him) until something happens. */
  autoPlan?: boolean;
  /** QA round: why the last Continue stopped when it was none of the stops (an offer about to expire, the burnout warning, a contract ending, the plan falling back). */
  notice?: ProNotice | null;
  /** QA round: offers already warned about before they expire. */
  warnedOffers?: string[];
  /** QA round: events his org has played while he sat on the bench (every rotationEvery-th he starts). */
  rotationTurn?: number;
  /** QA round: the coach's review of a rotation role: series left before it, and how they went. */
  roleReview?: { left: number; ratingSum: number; n: number } | null;
  /** The starter a rotation start benched for this week (swapped back next Monday). */
  rotatedOut?: string | null;
  /** The week's three blocks, played on their days (null = the coach's plan each week). */
  weekPlan?: ProWeekPlan | null;
  /** The running week's blocks (reset when the week closes on Monday) and the last closed week, for the planner. */
  weekLog?: ProWeekLog;
  lastWeekLog?: ProWeekLog | null;
  seq?: number;
}

/** What a week of blocks did (slice 2's WeekResult without the player). */
export interface ProWeekLog {
  seasonIndex: number;
  /** The Monday it started. */
  day: number;
  growth: ProGrowthEntry[];
  notes: ProWeekNote[];
  /** Energy after each block played, then after the close. */
  energyTrace: number[];
}

/** QA round: a reason the batched Continue stopped that is not a stop of its own. */
export type ProNotice =
  | { kind: "offerExpiring"; name: string; days: number }
  | { kind: "burnoutWarning"; energy: number }
  | { kind: "burnedOut"; weeks: number }
  | { kind: "contractEnding"; org: string; renewal: boolean }
  | { kind: "planFellBack"; energy: number }
  | { kind: "rolePromoted"; org: string }
  | { kind: "roleKept"; org: string };

/** The series he is playing now (round 2): the next game's decision, the series ledger, the games so far. */
export interface ProLiveSeries {
  eventId: string;
  roundKey: string;
  opponent: string;
  /** The decision of the next game, or null (no key moment: the game just plays). */
  decision: ProDecision | null;
  ledger: DecisionLedger;
  games: ProGameLine[];
  /** The last game's call, for the screen ("it worked", "it did not"). */
  last?: { optionId: string; success: boolean; instinct: boolean } | null;
}
