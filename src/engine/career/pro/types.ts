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
  source: "training" | "match" | "age";
  stat: StatKey;
  delta: number;
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
