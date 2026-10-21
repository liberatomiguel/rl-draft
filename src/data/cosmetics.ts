/**
 * Cosmetics catalog (v2.0 · rc.20: the FINAL Season 1 set) — titles, badges
 * and profile banners.
 *
 * HAND-MAINTAINED, like achievements.json. Names and descriptions live in the
 * copy dictionaries (`COSMETICS.items[id]`, EN + PT) so this file stays
 * language-free. Reference for Miguel: `docs/COSMETICS-CATALOG.md` (generated)
 * and the source document `data-sources/badges/cosmeticos-atualizado.md`.
 *
 * `source` is both the "how to get it" line AND the derivation rule used by
 * `src/engine/cosmetics.ts` — ownership is computed from the profile, never
 * hand-written into a save. Ids are a compatibility surface (saved `equipped`
 * choices reference them): never rename once v2.0 ships, only add. (rc.20
 * replaced every provisional title / banner id — nothing outside staging ever
 * saved them.)
 *
 * BADGES are Miguel's "Gema & Moldura" art: one static SVG per badge in
 * `public/badges/<art>.svg`, exported from the design file in
 * `data-sources/badges/` by `npm run build:badges`. The approved catalog's id
 * IS its art key (and the SVG's file name). Rarity follows the design file's
 * five-step ladder (common → legend). rc.20 follows the revised design file:
 * Season Elite covers #4–10 (4th / 5th place badges are gone), Crowned World
 * Champion is the FIRST Worlds title (the original World Champion art is
 * retired), Early Supporter joins the manual grants, On Target is 25 missions.
 *
 * BANNERS (rc.21) are Miguel's art too: `public/banners/<art>.svg` from the
 * design file in `data-sources/banners/` (`npm run build:banners`), served in
 * production as WebP (build-images) — the SVGs carry filters that must never
 * run in the browser. The card adds the tier effects in CSS (holo sweep on
 * epic / legendary, a glow on the profile hero), transform only.
 *
 * TITLES (rc.20, the official list): CSS only, no assets. The tier
 * decides the treatment (DESIGN-DECISIONS #131): common = plain grey text /
 * a quiet dark banner; uncommon = a weak colour; rare = a strong colour with a
 * light glow; epic = gradients, glow and a holo sweep; legendary = white gold
 * with glow, holo and pointer tilt (titles) / layered colour with a sheen
 * (banners). Every loop is transform / opacity only.
 *
 * Counting rules (the source document, §"Regras gerais"):
 *  · Season 1 rewards count from the Season 1 reset on: the "since Season 1"
 *    sources subtract the pre-season snapshot. Badges keep their lifetime
 *    counters (their rules were approved before and do not change).
 *  · The rank track (`season-rank`) hands an item out the first time the rank
 *    is reached in the season, lower ranks included; kept forever once owned.
 *  · Pre-season board rewards are ONE band per player (non-cumulative); the
 *    pre-season PEAK-RANK rewards are cumulative (Gold peak = Bronze + Silver
 *    + Gold), as the design file's "pico ≥" rule says.
 *  · Manual grants carry a RESERVED colour each (cobalt, raspberry, emerald,
 *    baby blue) — no other title uses them.
 *
 * `exclusive` items (pre-season legacy, manual grants) can no longer be
 * earned: the locker hides them from players who do not own them.
 */

export type CosmeticKind = "title" | "badge" | "banner";
export type CosmeticTier = "common" | "uncommon" | "rare" | "epic" | "legend";

/** Manual grant ids (the cloud `profile_grants.grant_id` column). */
export type GrantId = "early-supporter" | "supporter" | "contributor" | "pro";

export type CosmeticSource =
  | { type: "legacy-participation" }
  /** Peak pre-season rank ≥ `rankId` (cumulative). `exact`: only that rank. */
  | { type: "legacy-rank"; rankId: string; exact?: true }
  /** Final pre-season board place within [minPosition, maxPosition]. */
  | { type: "legacy-position"; minPosition: number; maxPosition: number }
  | { type: "grant"; grantId: GrantId }
  /** Peak rank ≥ `rankId` during season `seasonId` (lower ranks included). */
  | { type: "season-rank"; seasonId: number; rankId: string }
  | { type: "login-streak"; days: number }
  | { type: "challenge-stars"; stars: number }
  | { type: "quiz-solved"; count: number }
  | { type: "missions-completed"; count: number }
  /** rc.4: tournament runs WON (badges: every difficulty and mode, lifetime). */
  | { type: "runs-won"; count: number }
  /** rc.20: runs WON since the Season 1 reset (titles / banners). */
  | { type: "runs-won-since-s1"; count: number }
  /** rc.20: runs FINISHED (any result) since the Season 1 reset. */
  | { type: "runs-finished-since-s1"; count: number }
  /** rc.20: consecutive Legacy-difficulty runs won (best streak). */
  | { type: "legacy-streak"; count: number }
  /** rc.20: different special cards collected since the Season 1 reset. */
  | { type: "specials-owned"; count: number }
  /** rc.20: all three stars on one specific challenge. */
  | { type: "challenge-perfect"; challengeId: string }
  /** v2.0 (career R32): a permanent career achievement id. */
  | { type: "career-mark"; markId: string }
  /** rc.4: World Championships won on the Road to Worlds, across every save. */
  | { type: "career-worlds"; count: number }
  /**
   * rc.4 (Dynasty): within ONE season — peak rank ≥ `rankId`, `careerWorlds`
   * Worlds won on the Road to Worlds and `legacyTitles` Legacy runs won. Any
   * order; kept forever once earned.
   */
  | { type: "season-feat"; rankId: string; careerWorlds: number; legacyTitles: number };

export interface BadgeStyle {
  /** File name (no extension) in `public/badges/`. */
  art: string;
}

/** One to three stops: the text colour (one colour = flat; more = gradient). */
export type Stops = [string] | [string, string] | [string, string, string];

export interface TitleStyle {
  colors: Stops;
  /** Glow colour (rare+); defaults to the first stop. */
  glow?: string;
}

export interface BannerStyle {
  /** File name (no extension) in `public/banners/` — Miguel's art, exported by
   *  `npm run build:banners`; production serves the WebP from build-images. */
  art: string;
  /** Glow colour (the profile hero, epic+): the design file's frame colour. */
  glow: string;
}

interface Base {
  id: string;
  tier: CosmeticTier;
  /** Locker order within a kind (higher first). */
  priority: number;
  source: CosmeticSource;
  /** Cannot be earned any more — hidden from players who do not own it. */
  exclusive?: true;
}

export type CosmeticDef =
  | (Base & { kind: "title"; style: TitleStyle })
  | (Base & { kind: "badge"; style: BadgeStyle })
  | (Base & { kind: "banner"; style: BannerStyle });

/** Rank palettes shared by rank-themed UI (match RankBadge's tints). */
export const RANK_COLORS: Record<string, [string, string]> = {
  bronze: ["#d97706", "#92400e"],
  silver: ["#e2e8f0", "#94a3b8"],
  gold: ["#fde68a", "#d97706"],
  platinum: ["#a5f3fc", "#0ea5e9"],
  diamond: ["#7dd3fc", "#3b82f6"],
  champion: ["#c4b5fd", "#8b5cf6"],
  "grand-champion": ["#fda4af", "#ef4444"],
  "supersonic-legend": ["#f0abfc", "#f97316"],
};

/** Legendary titles: white pulled text with white-gold and light-pink details. */
export const WHITE_GOLD: Stops = ["#ffffff", "#f3dc92", "#ffd3ea"];

/** Gold titles (the pre-season podium, the Road to Worlds World Champion). */
const GOLD: Stops = ["#ffeb5c", "#fff3a0"];
const GOLD_GLOW = "#ffa300";

/** Reserved manual-grant colours (unique; no other title may use them). */
export const GRANT_COLORS: Record<GrantId, { colors: Stops; glow: string }> = {
  "early-supporter": { colors: ["#ff9ec0", "#ffd1e1"], glow: "#ff4d8d" }, // rose, a tone off the supporter's
  supporter: { colors: ["#e8356d", "#ff7aa2"], glow: "#e8356d" }, // raspberry
  contributor: { colors: ["#19d290", "#7ef0c0"], glow: "#00d1d1" }, // emerald / teal
  pro: { colors: ["#aef7ff", "#e0fbff"], glow: "#43afff" }, // ice / sky
};

type BadgeDef = Extract<CosmeticDef, { kind: "badge" }>;
type TitleDef = Extract<CosmeticDef, { kind: "title" }>;
type BannerDef = Extract<CosmeticDef, { kind: "banner" }>;

/** A badge whose id is its art key (the approved catalog). */
const badge = (id: string, tier: CosmeticTier, priority: number, source: CosmeticSource, exclusive?: true): BadgeDef => ({
  id,
  kind: "badge",
  tier,
  priority,
  source,
  ...(exclusive ? { exclusive } : {}),
  style: { art: id },
});

const title = (id: string, tier: CosmeticTier, priority: number, source: CosmeticSource, colors: Stops, exclusive?: true, glow?: string): TitleDef => ({
  id,
  kind: "title",
  tier,
  priority,
  source,
  ...(exclusive ? { exclusive } : {}),
  style: glow ? { colors, glow } : { colors },
});

const banner = (
  id: string,
  tier: CosmeticTier,
  priority: number,
  source: CosmeticSource,
  style: BannerStyle,
  exclusive?: true,
): BannerDef => ({
  id,
  kind: "banner",
  tier,
  priority,
  source,
  ...(exclusive ? { exclusive } : {}),
  style,
});

/** Pre-season peak rank → badge id + rarity (design file, "Pico de rank"). */
const PRESEASON_RANK_BADGES: [rankId: string, id: string, tier: CosmeticTier][] = [
  ["bronze", "pre-season-bronze", "common"],
  ["silver", "pre-season-silver", "common"],
  ["gold", "pre-season-gold", "uncommon"],
  ["platinum", "pre-season-platinum", "uncommon"],
  ["diamond", "pre-season-diamond", "rare"],
  ["champion", "pre-season-champion", "epic"],
  ["grand-champion", "pre-season-grand-champion", "epic"],
  ["supersonic-legend", "pre-season-supersonic", "legend"],
];

/** Pre-season peak rank → title colour (the source document: grey, grey, weak
 *  yellow, weak light blue, blue, purple, pure red, white gold). */
/** rc.21 (Miguel): Bronze / Silver / Gold plain grey, Platinum / Diamond green
 *  (uncommon), Champion green (rare), Grand Champion red (epic), SSL white gold. */
const PRESEASON_RANK_TITLES: [rankId: string, id: string, tier: CosmeticTier, colors: Stops][] = [
  ["bronze", "legacy-title-ps-bronze", "common", ["#a3adbd"]],
  ["silver", "legacy-title-ps-silver", "common", ["#a3adbd"]],
  ["gold", "legacy-title-ps-gold", "common", ["#a3adbd"]],
  ["platinum", "legacy-title-ps-platinum", "uncommon", ["#20a93e"]],
  ["diamond", "legacy-title-ps-diamond", "uncommon", ["#20a93e"]],
  ["champion", "legacy-title-ps-champion", "rare", ["#20a93e"]],
  ["grand-champion", "legacy-title-ps-grand-champion", "epic", ["#ff1f1f", "#ff6b6b"]],
  ["supersonic-legend", "legacy-title-ps-supersonic-legend", "legend", WHITE_GOLD],
];

/** Pre-season final board place → badge (non-cumulative bands, rc.20 bands). */
const PRESEASON_BOARD_BADGES: [id: string, tier: CosmeticTier, min: number, max: number][] = [
  ["season-champion-ps", "legend", 1, 1],
  ["season-runner-up-ps", "epic", 2, 2],
  ["season-third-place-ps", "epic", 3, 3],
  ["season-elite-ps", "epic", 4, 10],
  ["season-finalist-ps", "rare", 11, 50],
];

/** Pre-season final board place → title (same bands; solid / gradient / white gold). */
const PRESEASON_BOARD_TITLES: [id: string, tier: CosmeticTier, min: number, max: number, colors: Stops, glow?: string][] = [
  ["legacy-title-ps-board-champion", "legend", 1, 1, WHITE_GOLD],
  ["legacy-title-ps-board-2", "epic", 2, 2, GOLD, GOLD_GLOW],
  ["legacy-title-ps-board-3", "epic", 3, 3, GOLD, GOLD_GLOW],
  ["legacy-title-ps-board-elite", "epic", 4, 10, GOLD, GOLD_GLOW],
  ["legacy-title-ps-board-finalist", "rare", 11, 50, ["#60a5fa"]],
];

/** The approved badge catalog (design file rev. 2026-10-21: 36 entries). */
const BADGES: CosmeticDef[] = [
  // --- Login streak -------------------------------------------------------------
  badge("spark", "uncommon", 22, { type: "login-streak", days: 7 }),
  badge("wildfire", "epic", 52, { type: "login-streak", days: 30 }),
  // --- Challenge stars ----------------------------------------------------------
  badge("rising-star", "uncommon", 23, { type: "challenge-stars", stars: 25 }),
  badge("constellation", "rare", 43, { type: "challenge-stars", stars: 50 }),
  badge("supernova", "epic", 63, { type: "challenge-stars", stars: 70 }),
  // --- Runs won (lifetime) ------------------------------------------------------
  badge("veteran-drafter-1", "uncommon", 24, { type: "runs-won", count: 50 }),
  badge("veteran-drafter-2", "rare", 44, { type: "runs-won", count: 250 }),
  badge("veteran-drafter-3", "epic", 64, { type: "runs-won", count: 500 }),
  badge("veteran-drafter-4", "legend", 84, { type: "runs-won", count: 1000 }),
  // --- Daily quiz (days solved) -------------------------------------------------
  badge("scholar-1", "uncommon", 25, { type: "quiz-solved", count: 10 }),
  badge("scholar-2", "rare", 45, { type: "quiz-solved", count: 25 }),
  badge("scholar-3", "epic", 65, { type: "quiz-solved", count: 50 }),
  // --- Missions -----------------------------------------------------------------
  badge("on-target", "rare", 46, { type: "missions-completed", count: 25 }),
  // --- Pre-season participation -------------------------------------------------
  badge("first-chapter", "rare", 47, { type: "legacy-participation" }, true),
  // --- Pre-season board (final place) -------------------------------------------
  ...PRESEASON_BOARD_BADGES.map(([id, tier, min, max], i) =>
    badge(id, tier, 99 - i, { type: "legacy-position", minPosition: min, maxPosition: max }, true),
  ),
  // --- Pre-season peak rank (cumulative) ----------------------------------------
  ...PRESEASON_RANK_BADGES.map(([rankId, id, tier], i) => badge(id, tier, 30 + i * 4, { type: "legacy-rank", rankId }, true)),
  // --- Road to Worlds -----------------------------------------------------------
  badge("road-warrior", "rare", 48, { type: "career-mark", markId: "car-three-seasons" }),
  badge("underdog", "rare", 49, { type: "career-mark", markId: "car-worlds-underdog" }),
  badge("world-champion-crowned", "epic", 69, { type: "career-worlds", count: 1 }),
  badge("dynasty", "legend", 100, { type: "season-feat", rankId: "supersonic-legend", careerWorlds: 3, legacyTitles: 25 }),
  // --- Manual grants ------------------------------------------------------------
  badge("early-supporter", "epic", 73, { type: "grant", grantId: "early-supporter" }, true),
  badge("supporter", "epic", 72, { type: "grant", grantId: "supporter" }, true),
  badge("contributor", "epic", 71, { type: "grant", grantId: "contributor" }, true),
  badge("verified-pro", "epic", 70, { type: "grant", grantId: "pro" }, true),
];

const GREY: Stops = ["#a3adbd"];

/** Login calendar (30 days; the XP-only days live in `LOGIN_STREAK`). */
const LOGIN: CosmeticDef[] = [
  title("login-title-the-regular", "common", 10, { type: "login-streak", days: 3 }, GREY),
  banner("login-banner-kickoff", "common", 10, { type: "login-streak", days: 5 }, { art: "kickoff", glow: "#5fd6c4" }),
  title("login-title-locked-in", "uncommon", 11, { type: "login-streak", days: 10 }, ["#9fd0b8"]),
  banner("login-banner-after-hours", "uncommon", 11, { type: "login-streak", days: 14 }, { art: "after-hours", glow: "#46c8e8" }),
  banner("login-banner-solar-flare", "rare", 12, { type: "login-streak", days: 21 }, { art: "solar-flare", glow: "#ff5a2a" }),
  title("login-title-on-fire", "uncommon", 12, { type: "login-streak", days: 21 }, ["#ff8a3d"]),
  title("login-title-cant-stop", "uncommon", 13, { type: "login-streak", days: 25 }, ["#ffd166"]),
  banner("login-banner-wildfire", "epic", 14, { type: "login-streak", days: 30 }, { art: "wildfire", glow: "#ff3a1a" }),
  title("login-title-daily-driver", "epic", 14, { type: "login-streak", days: 30 }, ["#ff5f6d", "#ffc371", "#fff0a8"]),
];

/** Season 1 rank track (first time a rank is reached; lower ranks included). */
const S1 = 1;
const RANK_TRACK: CosmeticDef[] = [
  banner("rank-banner-circuit", "common", 20, { type: "season-rank", seasonId: S1, rankId: "bronze" }, { art: "circuit", glow: "#2f7f93" }),
  title("rank-title-challenger", "common", 20, { type: "season-rank", seasonId: S1, rankId: "silver" }, ["#b8c2cc"]),
  banner("rank-banner-neon-grid", "uncommon", 21, { type: "season-rank", seasonId: S1, rankId: "gold" }, { art: "neon-grid", glow: "#dcae52" }),
  title("rank-title-playmaker", "uncommon", 21, { type: "season-rank", seasonId: S1, rankId: "gold" }, ["#8fe0d0"]),
  banner("rank-banner-slipstream", "rare", 22, { type: "season-rank", seasonId: S1, rankId: "platinum" }, { art: "slipstream", glow: "#2f7bff" }),
  title("rank-title-unstoppable", "rare", 22, { type: "season-rank", seasonId: S1, rankId: "diamond" }, ["#5ab0ff"]),
  banner("rank-banner-singularity", "epic", 23, { type: "season-rank", seasonId: S1, rankId: "champion" }, { art: "singularity", glow: "#8a5cff" }),
  title("rank-title-rocketeer", "epic", 23, { type: "season-rank", seasonId: S1, rankId: "champion" }, ["#7c3aed", "#c084fc", "#22d3ee"]),
  banner("rank-banner-overdrive", "epic", 24, { type: "season-rank", seasonId: S1, rankId: "grand-champion" }, { art: "overdrive", glow: "#ff2a4a" }),
  banner("rank-banner-cosmic-ascension", "legend", 25, { type: "season-rank", seasonId: S1, rankId: "supersonic-legend" }, { art: "cosmic-ascension", glow: "#8fe9ff" }),
  title("rank-title-rocket-demigod", "legend", 25, { type: "season-rank", seasonId: S1, rankId: "supersonic-legend" }, WHITE_GOLD),
];

/** Play milestones (counted from the Season 1 reset on). */
const PLAY: CosmeticDef[] = [
  title("runs-title-rookie", "common", 30, { type: "runs-won-since-s1", count: 1 }, GREY),
  banner("runs-banner-blueprint", "common", 30, { type: "runs-finished-since-s1", count: 10 }, { art: "blueprint", glow: "#7fd0ff" }),
  banner("runs-banner-victory-lane", "uncommon", 31, { type: "runs-won-since-s1", count: 25 }, { art: "victory-lane", glow: "#22e6a8" }),
  title("runs-title-draft-veteran", "rare", 32, { type: "runs-won-since-s1", count: 100 }, ["#f4b860"]),
  title("streak-title-on-a-roll", "rare", 33, { type: "legacy-streak", count: 3 }, ["#ff4fd8"]),
  banner("streak-banner-heatwave", "epic", 34, { type: "legacy-streak", count: 5 }, { art: "heatwave", glow: "#ff4fa3" }),
  title("specials-title-card-hunter", "common", 35, { type: "specials-owned", count: 1 }, GREY),
  banner("specials-banner-the-vault", "rare", 36, { type: "specials-owned", count: 10 }, { art: "the-vault", glow: "#4f7fd6" }),
  banner("missions-banner-target-practice", "rare", 37, { type: "missions-completed", count: 25 }, { art: "target-practice", glow: "#c8d2de" }),
  title("quiz-title-rl-nerd", "uncommon", 38, { type: "quiz-solved", count: 10 }, ["#b7a9ff"]),
  banner("quiz-banner-playbook", "rare", 39, { type: "quiz-solved", count: 50 }, { art: "playbook", glow: "#4fd3ee" }),
  title("career-title-rtw-champion", "epic", 40, { type: "career-worlds", count: 1 }, GOLD, undefined, GOLD_GLOW),
];

/** The three fixed challenges with exclusive cosmetics (three stars each). */
const CHALLENGES: CosmeticDef[] = [
  title("challenge-title-homegrown", "rare", 50, { type: "challenge-perfect", challengeId: "ch-homegrown" }, ["#9ccc3c"]),
  banner("challenge-banner-golden-era", "rare", 50, { type: "challenge-perfect", challengeId: "ch-time-capsule" }, { art: "golden-era", glow: "#e8b25a" }),
  banner("challenge-banner-back-to-basics", "rare", 51, { type: "challenge-perfect", challengeId: "ch-pure-talent" }, { art: "back-to-basics", glow: "#2f7bff" }),
  title("challenge-title-pure-talent", "rare", 51, { type: "challenge-perfect", challengeId: "ch-pure-talent" }, ["#22d3ee"]),
];

/** Pre-season rewards (handed out at the Season 1 turnover; exclusive). */
const LEGACY: CosmeticDef[] = [
  title("legacy-title-first-chapter", "rare", 60, { type: "legacy-participation" }, ["#fb923c"], true),
  ...PRESEASON_BOARD_TITLES.map(([id, tier, min, max, colors, glow], i) =>
    title(id, tier, 99 - i, { type: "legacy-position", minPosition: min, maxPosition: max }, colors, true, glow),
  ),
  ...PRESEASON_RANK_TITLES.map(([rankId, id, tier, colors], i) => title(id, tier, 70 + i, { type: "legacy-rank", rankId }, colors, true)),
];

/** Manual grants (reserved colours). */
const grantTitle = (id: string, priority: number, grantId: GrantId): TitleDef =>
  title(id, "epic", priority, { type: "grant", grantId }, GRANT_COLORS[grantId].colors, true, GRANT_COLORS[grantId].glow);
const GRANTS: CosmeticDef[] = [
  grantTitle("grant-title-early-supporter", 83, "early-supporter"),
  grantTitle("grant-title-supporter", 82, "supporter"),
  grantTitle("grant-title-contributor", 81, "contributor"),
  grantTitle("grant-title-pro", 80, "pro"),
];

export const COSMETICS: CosmeticDef[] = [...BADGES, ...LOGIN, ...RANK_TRACK, ...PLAY, ...CHALLENGES, ...LEGACY, ...GRANTS];

export const cosmeticById: ReadonlyMap<string, CosmeticDef> = new Map(COSMETICS.map((c) => [c.id, c]));

/** Pre-season leaderboard tiers by final position (highest first) — the recap's
 *  wording for a place, independent of which reward the band grants. */
export const LEGACY_POSITION_TIERS = [
  { id: "champion", maxPosition: 1 },
  { id: "runner-up", maxPosition: 2 },
  { id: "third", maxPosition: 3 },
  { id: "elite", maxPosition: 10 },
  { id: "finalist", maxPosition: 50 },
] as const;
