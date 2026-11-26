/**
 * v2.2 Pro, the player career (docs/PRO-SPEC.md, R150): the save's types.
 *
 * A ProSave shares `clock`, `world` and `competition` with a CareerSave (the
 * same types), so the bridge to a manager career in the same world needs no
 * migration. Slice 1 fills the player and the world; the other fields are
 * there from day one, empty, so later slices add behaviour, not shape.
 */

import type { Region, StatKey, Stats } from "../../types";
import type {
  ArchetypeId,
  CareerClock,
  CareerDifficulty,
  CompetitionState,
  DeclineRate,
  NewsItem,
  WorldState,
} from "../types";

export type ProStartAge = 13 | 14;

/** Where the career stands: the ranked prologue, an amateur side, an org, without a team, retired. */
export type ProStage = "ranked" | "amateur" | "org" | "freeAgent" | "retired";

/** What a training block works on. */
export type ProTrainingFocus = StatKey | "balanced";

/** One block of the week (PRO-SPEC §5). "mechanics" is a training focus too (it is a StatKey). */
export type ProActivity =
  | { kind: "train"; focus: ProTrainingFocus }
  | { kind: "ranked" }
  | { kind: "scrim" }
  | { kind: "content" }
  | { kind: "rest" };

/** Monday-Tuesday, Wednesday-Thursday, Friday. */
export type ProWeekPlan = [ProActivity, ProActivity, ProActivity];

/** A line the week shows the player: a code the copy maps, with one optional number. */
export type ProNoteCode =
  | "tiredTraining"
  | "lowEnergy"
  | "burnoutWarning"
  | "burnedOut"
  | "stillBurnedOut"
  | "backFromBurnout"
  | "scrimNeedsTeam"
  | "rankedResult"
  | "rankUp"
  | "rankDown"
  | "mechanicUnlocked"
  | "contentPaid";

export interface ProWeekNote {
  code: ProNoteCode;
  /** The number the line quotes (MMR change, energy, money), when it has one. */
  n?: number;
  /** A key the line quotes (a mechanic id, a rank id). */
  ref?: string;
}

/** One ranked session, kept for the panel (CAREER_PRO_RANKED.logCap). */
export interface ProRankedEntry {
  seasonIndex: number;
  day: number;
  mmrDelta: number;
  wins: number;
  games: number;
  mmr: number;
}

export interface ProPlayer {
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  region: Region;
  /** Age = development.ageOf(birthYear, seasonIndex), the world's own rule. */
  birthYear: number;
  /** The style chosen at creation (PRO-SPEC §4.1, P4). */
  archetype: ArchetypeId;
  /** The six attributes, two decimals, CAREER_PRO.attrMin..attrMax. Overall = their mean. */
  attrs: Stats;
  /** HIDDEN: the seed's talent (×XP). Never shown; the screens show gains, not a ceiling. */
  talent: number;
  /** HIDDEN development shape (slice 6 reads them). */
  peakAge: number;
  declineRate: DeclineRate;
  /** Signature mechanics unlocked (slice 5), in unlock order. */
  mechanics: string[];
  /** 0-100 (slice 2). */
  energy: number;
  /** −2..+2 from recent ratings (slice 2). */
  confidence: number;
  /** Followers (slice 2). */
  fame: number;
  money: number;
  /** Ranked MMR (slice 2). */
  mmr: number;
  /**
   * Slice 2+ state, all optional so a slice-1 save loads and plays (a missing
   * field reads as its starting value).
   */
  /** The last three-block plan played ("repeat last week"). */
  lastPlan?: ProWeekPlan;
  /** The last ranked sessions, newest last. */
  rankedLog?: ProRankedEntry[];
  /** Total ranked sessions played (the RNG stream key of the next one). */
  rankedSessions?: number;
  /** The last official match ratings (0-10), newest last; confidence is their mean. */
  recentRatings?: number[];
  /** Burnout: warned = the week-end warning was shown; outWeeks = weeks still out. */
  burnout?: { warned: boolean; outWeeks: number };
  /** Mechanics training blocks done (slice 5 unlocks signature mechanics from it). */
  mechanicsBlocks?: number;
  /** 0-100, from scrims with a team (slices 3-4 read it). */
  chemistry?: number;
  /** Slice 6: the seasons this Pro has been without a contract, in a row. */
  seasonsWithoutContract?: number;
}

/** The team the Pro plays for (slices 3–4 add the contract). */
export interface ProTeam {
  kind: "amateur" | "org";
  /** A world org ref, or the amateur side's own ref. */
  ref: string;
}

/** One explained change of an attribute (the spec's "every change explained"). */
export interface ProGrowthEntry {
  seasonIndex: number;
  day: number;
  /** Why it moved: a training block, a match, age (slices 2–6 add theirs). */
  source: "training" | "match" | "age" | "ranked" | "scrim";
  stat: StatKey;
  delta: number;
  /** Slice 6: a copy key that says why ("reflexes", "reads"...) for an age entry. */
  reason?: string;
}

export type ProBridge = { to: "manager" | "coach" | "legend"; atSeason: number };

export interface ProSave {
  kind: "pro";
  /** The Pro save's own shape version (1 = v2.2 slice 1). */
  proSaveVersion: 1;
  createdAtAppVersion: string;
  careerSeed: number;
  /** The anonymous analytics id, stamped by the store. */
  careerId?: string;
  difficulty: CareerDifficulty;
  clock: CareerClock;
  world: WorldState;
  competition: CompetitionState;
  player: ProPlayer;
  stage: ProStage;
  team: ProTeam | null;
  /** Explained attribute changes, newest last (CAREER_PRO.growthLogCap). */
  growthLog: ProGrowthEntry[];
  /** Filled by slices 3–7. */
  offers: unknown[];
  history: unknown[];
  honors: unknown[];
  news: NewsItem[];
  flags: Record<string, boolean>;
  /** Set on retirement (slice 6): where the career went next. */
  bridge: ProBridge | null;
  /** The store's local stamp, strictly increasing (as CareerSave.lastPlayedAt). */
  lastPlayedAt?: number;
}

export interface CreateProInput {
  name: string;
  country: string;
  region: Region;
  startAge: ProStartAge;
  archetype: ArchetypeId;
  difficulty: CareerDifficulty;
}
