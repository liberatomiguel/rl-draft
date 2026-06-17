/**
 * Daily Challenge generator.
 *
 * The UTC date string hashes into the run seed, so EVERYONE gets the same
 * draft, the same opponents and the same modifiers on the same day. Variety
 * comes from a template wheel (regional lockdowns, era restrictions,
 * blackout, no-reroll, gauntlet, specials surge…) plus an optional bonus
 * objective — both picked deterministically from the date.
 */

import { draftableLineups, lineups, seasonById } from "@/data";
import { createRng } from "@/lib/rng";
import type {
  DailyInfo,
  DailyObjective,
  Difficulty,
  DraftScriptStep,
  Region,
} from "@/engine/types";

export interface DailyConfig {
  info: DailyInfo;
  difficulty: Difficulty;
  /** Forced hidden overalls (Blackout). */
  hiddenOverall: boolean;
  /** undefined = use the difficulty's budget. */
  rerollsOverride?: number;
  /** Multiplier on the special appearance chance. */
  specialChanceMult?: number;
  /** Scripted draft: exact lineup per pick, each optionally forcing a special. */
  scriptedLineups?: DraftScriptStep[];
  /** Restricted lineup pool (sorted for determinism). */
  poolLineupIds?: string[];
}

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Launch day = challenge #1. */
const DAILY_EPOCH = "2026-06-15";
const DAY_MS = 86_400_000;

/** Sequential daily number since launch (#1, #2, …). */
export function dailyNumber(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  const e = Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(e)) return 1;
  return Math.max(1, Math.floor((t - e) / DAY_MS) + 1);
}

/** FNV-1a — stable across platforms, good enough to seed mulberry32. */
export function seedFromDate(date: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function lineupYear(lineupId: string): number {
  const lineup = lineups.find((l) => l.id === lineupId);
  const season = lineup ? seasonById.get(lineup.seasonId) : undefined;
  return season ? parseInt(season.year, 10) : NaN;
}

// Daily pools draw from the Worlds-only set (regional samOnly teams belong to
// the dedicated region-locked mode, not the shared daily challenge).
function poolByRegion(region: Region): string[] {
  return draftableLineups.filter((l) => l.region === region).map((l) => l.id).sort();
}

function poolByEra(test: (year: number) => boolean): string[] {
  return draftableLineups
    .filter((l) => test(lineupYear(l.id)))
    .map((l) => l.id)
    .sort();
}

/** A pool is playable when it can realistically fill a 6-slot draft. */
function viable(pool: string[]): boolean {
  return pool.length >= 8;
}

/**
 * Hand-authored daily challenges for specific dates (v1.2.1). When a date has
 * an entry here it OVERRIDES the template wheel — used to feature a designed
 * challenge on a notable day. Deterministic by construction (a fixed config for
 * a fixed date), so the "same draft for everyone" guarantee holds.
 */
const AUTHORED_DAILIES: Record<string, (date: string) => DailyConfig> = {
  // Launch-week feature (2026-06-17): two special cards are guaranteed in the
  // player's draft, against a stronger Hard field — but overalls stay VISIBLE so
  // the special-card firepower is on show, with one reroll as a small safety net.
  "2026-06-17": (date) => ({
    info: {
      date,
      n: dailyNumber(date),
      label: "Loaded Draft",
      description:
        "Two special cards are guaranteed to show up in your draft — but the bracket bites back with a stronger, sharper field. Make the star power count.",
      objective: { type: "win_title", label: "Win the whole thing", bonusXp: 100 },
    },
    difficulty: "hard",
    hiddenOverall: false,
    rerollsOverride: 0, // the draft is hand-scripted; rerolls would just re-show it
    specialChanceMult: 0, // suppress natural specials — only the two scripted ones
    // A hand-curated 6-pick draft: balanced, distinct orgs, one Dignitas. al0t's
    // special lands on pick 2; violentpanda's "Brain" legend on pick 5, with a
    // deliberately weaker team (Gen.G, carrying the coach+sub) right before it to
    // nudge leaving a player slot open for the legend.
    scriptedLineups: [
      { lineupId: "g2-stride-2024" },
      { lineupId: "complexity-gaming-s5", special: { playerId: "al0t", specialId: "sp-al0t-ceiling-redirect" } },
      { lineupId: "team-bds-2223" },
      { lineupId: "gen-g-mobil1-racing-2025" },
      { lineupId: "dignitas-s5", special: { playerId: "violentpanda", specialId: "sp-violentpanda-dignitas-brain" } },
      { lineupId: "team-vitality-2223" },
    ],
  }),
};

export function generateDailyConfig(date: string): DailyConfig {
  const authored = AUTHORED_DAILIES[date];
  if (authored) return authored(date);

  const rng = createRng(seedFromDate(date) ^ 0x5eed);

  type TemplateResult = Omit<DailyConfig, "info"> & {
    label: string;
    description: string;
    /** A template may pin its own bonus objective (overrides the random one). */
    objective?: DailyObjective;
  };
  type Template = () => TemplateResult;

  const pureBracket = (): TemplateResult => ({
    label: "Pure Bracket",
    description: "No modifiers. A clean classic run — same seed for everyone.",
    difficulty: "normal",
    hiddenOverall: false,
  });

  const templates: Template[] = [
    pureBracket,
    () => {
      const regions: Region[] = ["NA", "EU", "SAM", "MENA", "OCE"];
      const region = rng.pick(regions);
      const pool = poolByRegion(region);
      if (!viable(pool)) {
        return {
          label: "Pure Bracket",
          description: "No modifiers. A clean classic run — same seed for everyone.",
          difficulty: "normal",
          hiddenOverall: false,
        };
      }
      return {
        label: `Regional Lockdown: ${region}`,
        description: `Only ${region} lineups in the draft and the bracket.`,
        difficulty: "normal",
        hiddenOverall: false,
        poolLineupIds: pool,
      };
    },
    () => {
      const pool = poolByEra((y) => y <= 2019);
      return viable(pool)
        ? {
            label: "Old School",
            description: "2016-2019 lineups only. The classics decide it.",
            difficulty: "normal",
            hiddenOverall: false,
            poolLineupIds: pool,
          }
        : {
            label: "Pure Bracket",
            description: "No modifiers. A clean classic run — same seed for everyone.",
            difficulty: "normal",
            hiddenOverall: false,
          };
    },
    () => {
      const pool = poolByEra((y) => y >= 2020);
      return viable(pool)
        ? {
            label: "Modern Era",
            description: "RLCS X and later only. Today's game, today's stars.",
            difficulty: "normal",
            hiddenOverall: false,
            poolLineupIds: pool,
          }
        : {
            label: "Pure Bracket",
            description: "No modifiers. A clean classic run — same seed for everyone.",
            difficulty: "normal",
            hiddenOverall: false,
          };
    },
    () => ({
      label: "Blackout",
      description: "Overalls hidden everywhere. Draft on knowledge alone.",
      difficulty: "normal",
      hiddenOverall: true,
    }),
    () => ({
      label: "No Safety Net",
      description: "Zero rerolls. The first read has to be the right one.",
      difficulty: "normal",
      hiddenOverall: false,
      rerollsOverride: 0,
    }),
    () => ({
      label: "Gauntlet",
      description: "Hard rules: hidden overalls and a stronger field.",
      difficulty: "hard",
      hiddenOverall: true,
    }),
    () => ({
      label: "Specials Surge",
      description: "Special cards appear far more often — collectors' day.",
      difficulty: "normal",
      hiddenOverall: false,
      // v0.5: base chance went 0.07 → 0.16, so the surge multiplier came down
      // (×4 would have meant a special on most cards).
      specialChanceMult: 2.5,
    }),
    // --- v1.0 models ---
    () => ({
      label: "Legacy Day",
      description:
        "The all-time gauntlet — championship rosters, hidden overalls, no rerolls. No unlock needed today.",
      difficulty: "legacy",
      hiddenOverall: true,
    }),
    () => ({
      label: "Underdog",
      description: "Take the long shot all the way. Win the title with a team under 88 OVR.",
      difficulty: "normal",
      hiddenOverall: false,
      objective: {
        type: "team_overall_under",
        value: 88,
        label: "Win the title with a team under 88 OVR",
        bonusXp: 120,
      },
    }),
    () => {
      const pool = draftableLineups
        .filter((l) => l.historicalStrength === "elite" || l.historicalStrength === "strong")
        .map((l) => l.id)
        .sort();
      return viable(pool)
        ? {
            label: "Champions Only",
            description: "Only the all-time great rosters are in the pool. Greatness vs greatness.",
            difficulty: "hard",
            hiddenOverall: false,
            poolLineupIds: pool,
          }
        : pureBracket();
    },
  ];

  const picked = rng.pick(templates)();

  // A template can pin its own objective; otherwise ~45% of days roll a bonus.
  let objective: DailyObjective | undefined = picked.objective;
  if (!objective && rng.chance(0.45)) {
    const pool: DailyObjective[] = [
      { type: "chemistry_good", label: "Finish with Good+ chemistry", bonusXp: 50 },
      { type: "chemistry_great", label: "Finish with Great+ chemistry", bonusXp: 80 },
      { type: "concede_under", value: 25, label: "Concede fewer than 25 goals", bonusXp: 50 },
      { type: "win_title", label: "Win the whole thing", bonusXp: 75 },
    ];
    objective = rng.pick(pool);
  }

  return {
    info: {
      date,
      n: dailyNumber(date),
      label: picked.label,
      description: picked.description,
      objective,
    },
    difficulty: picked.difficulty,
    hiddenOverall: picked.hiddenOverall,
    rerollsOverride: picked.rerollsOverride,
    specialChanceMult: picked.specialChanceMult,
    poolLineupIds: picked.poolLineupIds,
  };
}
