/**
 * v2.2 board front — the save shapes of the board, the manager and job
 * offers (FEATURES.board). Every field is additive on CareerSave: an older
 * save has none of them and starts its board at its next rollover.
 */

import type { Region } from "../types";
import type { SeasonGoalSpec } from "./types";

/** What the data proves about an org (engine/career/orgProfile.ts). "owners" = a founded club. */
export type Stature = "elite" | "contender" | "mid" | "underdog";
export type BoardKind = "board" | "owners";
export type PackageId = "cautious" | "expected" | "ambitious";

/** One of the three pre-season offers, fixed once shown. */
export interface BoardPackage {
  id: PackageId;
  /** The sporting objective (a season goal, settled at the review like the season goal). */
  objective: SeasonGoalSpec;
  /** Paid when chosen: the season's budget plus the upfront part. */
  grant: number;
  /** Paid at the review when the objective is met. */
  bonus: number;
  /** Confidence when met / missed (the miss already × patience). */
  hit: number;
  miss: number;
}

export type SecondaryKind = "balance" | "wages" | "youth" | "homeCore";
export type LegacyKind = "defendWorlds" | "everyMajor" | "majorDouble";

export interface BoardSecondary {
  kind: SecondaryKind;
  /** wages: the weekly ceiling; youth: the age; homeCore: the starters needed. */
  value: number;
  met: boolean | null;
}

export interface BoardLegacy {
  kind: LegacyKind;
  objective: SeasonGoalSpec;
  met: boolean | null;
}

export interface BoardSeason {
  seasonIndex: number;
  offers: BoardPackage[];
  /** Null until the manager picks (the clock holds on it). */
  choice: PackageId | null;
  secondary: BoardSecondary | null;
  legacy: BoardLegacy | null;
  /** The objective's chance when chosen (the checkpoints compare against it). */
  startChance: number | null;
  /** Split checkpoints already run (1, 2). */
  checkpoints: number[];
  /** The objective's band at the last checkpoint (the Board page's "now"). */
  bandNow?: string;
  /** "out" already charged (once a season). */
  outCharged?: boolean;
  /** Settled at the review: met / missed (null before). */
  met: boolean | null;
  /** rc.6 (ORGMODE E4): an established org's reason for this season's ask. Optional: older saves have none. */
  brief?: SeasonBrief;
}

/** rc.6 (ORGMODE E4): why the board asks what it asks this season, read from last season. */
export type BriefReason = "takeover" | "met" | "missed" | "title" | "promoted" | "relegated" | "ultimatumSurvived";

export interface SeasonBrief {
  reason: BriefReason;
  /** The org's tier this season (Standing). */
  tier: Stature;
  /** Last season's chosen objective (absent in a takeover season). */
  lastObjective?: SeasonGoalSpec;
  /** Last season's region rank (the history record), when there was one. */
  lastRegionalRank?: number;
  /** Last season's best finish at an official event (Worlds, then Majors, then regionals). */
  bestFinish?: { tier: "regional" | "major" | "worlds"; place: number };
  /** Titles last season (the "title" reason). */
  majors?: number;
  worlds?: boolean;
}

/** rc.6 (ORGMODE E1): a Standing tier change at a season review. */
export interface TierChange {
  seasonIndex: number;
  from: Stature;
  to: Stature;
}

export interface ConfidenceLogEntry {
  seasonIndex: number;
  day: number;
  delta: number;
  /** copy key under career.board.reasons */
  reason: string;
  after: number;
}

export interface BoardUltimatum {
  issuedSeason: number;
  issuedDay: number;
  /** The mission counts results from this week on (the splits left). */
  fromWeek: number;
  objective: SeasonGoalSpec;
  status: "open" | "met" | "failed";
}

export interface BoardState {
  kind: BoardKind;
  stature: Stature | "owners";
  /** The season the board's tenure started (grace counts from it). */
  startSeason: number;
  confidence: number;
  log: ConfidenceLogEntry[];
  /** × the seasonal budget (high / low confidence move it). */
  budgetMult: number;
  /** The seasonal budget at ×1 (in the money of its season; indexed at payment). */
  grantBase: number;
  /** The weekly wage ceiling (the wages secondary objective, the pick screen). */
  wageRoom: number;
  /** The weekly wage bill the money is sized on (weeks are weeks of it). */
  weekWages: number;
  season: BoardSeason | null;
  /** The last warning (season index), null = none since the last recovery. */
  warnedSeason: number | null;
  ultimatum: BoardUltimatum | null;
  /** No ultimatum and losses halved through this season (a title). */
  protectedUntil: number | null;
  /** Signings refused while this window (season:windowIdx) runs. */
  freeze: { seasonIndex: number; windowIdx: number } | null;
  /** Dismissal served at this season's review (the move happens at the rollover). */
  dismissedSeason: number | null;
  /** The season a move changed the manager's region (the rollover drops the old region's local-scene origin). */
  regionChangedAt?: number;
  /** The one-time board-funded upgrade: offered at top confidence (a season), then what was picked. */
  upgrade?: { offeredSeason: number; taken?: string };
  /** rc.6 (ORGMODE E1): the last Standing tier change (an established org; optional, additive). */
  tierChange?: TierChange;
}

export interface JobOffer {
  id: string;
  /** "found" = start a new club; else a world org ref. */
  kind: "org" | "found";
  ref?: string;
  name: string;
  region: Region;
  stature: Stature | "owners";
  /** The squad's rating rank in its region (org offers). */
  rank?: number;
  rating?: number;
  /** Why it came: after a dismissal, or an unsolicited approach. */
  reason: "dismissal" | "approach";
}

export interface ManagerSpell {
  orgName: string;
  ref?: string;
  fromSeason: number;
  toSeason?: number;
  left?: "dismissed" | "moved";
}

export interface ManagerState {
  reputation: number;
  /** The contract's last season (extended at high confidence; flavour, never a lock). */
  contractUntil: number;
  spells: ManagerSpell[];
  /** Offers on the table (null = none). */
  offers: JobOffer[] | null;
  /** The offer accepted: the seat swap happens at the rollover. */
  accepted: JobOffer | null;
}
