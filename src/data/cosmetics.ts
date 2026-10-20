/**
 * Cosmetics catalog (v2.0, visual language reset in rc.3, badges replaced in
 * rc.4) — titles, badges and profile banners.
 *
 * HAND-MAINTAINED, like achievements.json. Names and descriptions live in the
 * copy dictionaries (`COSMETICS.items[id]`, EN + PT) so this file stays
 * language-free. Reference for Miguel: `docs/COSMETICS-CATALOG.md` (generated).
 *
 * `source` is both the "how to get it" line AND the derivation rule used by
 * `src/engine/cosmetics.ts` — ownership is computed from the profile, never
 * hand-written into a save. Ids are a compatibility surface (saved `equipped`
 * choices reference them): never rename once v2.0 ships, only add. (rc.4
 * replaced every pre-release badge id with the approved catalog's — nothing
 * outside staging ever saved the old ones.)
 *
 * BADGES (rc.4) are Miguel's "Gema & Moldura" art: one static SVG per badge in
 * `public/badges/<art>.svg`, exported from the design file in
 * `data-sources/badges/` by `npm run build:badges`. The approved catalog's id
 * IS its art key (and the SVG's file name). Rarity follows the design file's
 * five-step ladder (common → legend).
 *
 * TITLES + BANNERS are PROVISIONAL (new ones are coming): CSS line art, the
 * tier deciding how much colour and effect an item gets, like the special
 * cards — common one muted colour; rare one accent; epic a two-colour gradient
 * and a soft glow; legend a prismatic gradient, glow and the holo loop. Rank
 * rewards borrow the rank's palette.
 *
 * Rank- and rating-linked rewards are handed out only at a season's turnover
 * (rc.6): there is no in-season rank track; today that means the PS badges.
 *
 * Pre-season board and peak-rank rewards are NOT cumulative (Miguel's rule):
 * a player gets the reward of their own band only — 1st gets Season Champion,
 * not Elite + Finalist too; a Gold peak gets Pre-season Gold only.
 *
 * `exclusive` items (pre-season legacy, manual grants) can no longer be
 * earned: the locker hides them from players who do not own them.
 */

export type CosmeticKind = "title" | "badge" | "banner";
export type CosmeticTier = "common" | "uncommon" | "rare" | "epic" | "legend";

export type CosmeticSource =
  | { type: "legacy-participation" }
  /** Peak pre-season rank. `exact`: only that rank (non-cumulative). */
  | { type: "legacy-rank"; rankId: string; exact?: true }
  /** Final pre-season board place within [minPosition, maxPosition]. */
  | { type: "legacy-position"; minPosition: number; maxPosition: number }
  | { type: "grant"; grantId: "supporter" | "pro" | "contributor" }
  | { type: "season-rank"; seasonId: number; rankId: string }
  | { type: "login-streak"; days: number }
  | { type: "challenge-stars"; stars: number }
  | { type: "quiz-solved"; count: number }
  | { type: "missions-completed"; count: number }
  /** rc.4: tournament runs WON (titles, every difficulty and mode, lifetime). */
  | { type: "runs-won"; count: number }
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

/** One to three stops: the stroke gradient (one colour = flat). */
export type Stops = [string] | [string, string] | [string, string, string];

export interface TitleStyle {
  colors: Stops;
}

export type BannerPattern = "none" | "rays" | "grid" | "stripes" | "hex" | "waves" | "circuit" | "aurora";

export interface BannerStyle {
  /** Right-side colour wash [from, to]; the left side is always kept dark. */
  from: string;
  to: string;
  accent?: string;
  pattern?: BannerPattern;
  /** Holo sheen loop (legend). */
  animated?: boolean;
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

/** Rank palettes shared by rank-themed rewards (match RankBadge's tints). */
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

type BadgeDef = Extract<CosmeticDef, { kind: "badge" }>;

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

/** Pre-season peak rank → badge id + rarity (design file, "Pico de rank"). */
const PRESEASON_RANK_BADGES: [rankId: string, id: string, tier: CosmeticTier][] = [
  ["bronze", "pre-season-bronze", "common"],
  ["silver", "pre-season-silver", "common"],
  ["gold", "pre-season-gold", "uncommon"],
  ["platinum", "pre-season-platinum", "uncommon"],
  ["diamond", "pre-season-diamond", "rare"],
  ["champion", "pre-season-champion", "rare"], // rc.9: Miguel — only GC is epic
  ["grand-champion", "pre-season-grand-champion", "epic"],
  ["supersonic-legend", "pre-season-supersonic", "legend"],
];

/** Pre-season final board place → badge (non-cumulative bands). */
const PRESEASON_BOARD_BADGES: [id: string, tier: CosmeticTier, min: number, max: number][] = [
  ["season-champion-ps", "legend", 1, 1],
  ["season-runner-up-ps", "epic", 2, 2],
  ["season-third-place-ps", "epic", 3, 3],
  ["season-fourth-place-ps", "epic", 4, 4],
  ["season-fifth-place-ps", "epic", 5, 5],
  ["season-elite-ps", "epic", 6, 10],
  ["season-finalist-ps", "rare", 11, 50],
];

/** The approved badge catalog (rc.4: 36 entries, `Rocket-Draft-Badges-Desbloqueios.md`; rc.6: + Supernova). */
const BADGES: CosmeticDef[] = [
  // --- Login streak -------------------------------------------------------------
  badge("spark", "uncommon", 22, { type: "login-streak", days: 7 }),
  badge("wildfire", "epic", 52, { type: "login-streak", days: 30 }),
  // --- Challenge stars ----------------------------------------------------------
  badge("rising-star", "uncommon", 23, { type: "challenge-stars", stars: 25 }),
  badge("constellation", "rare", 43, { type: "challenge-stars", stars: 50 }),
  badge("supernova", "epic", 63, { type: "challenge-stars", stars: 70 }),
  // --- Runs won -----------------------------------------------------------------
  badge("veteran-drafter-1", "uncommon", 24, { type: "runs-won", count: 50 }),
  badge("veteran-drafter-2", "rare", 44, { type: "runs-won", count: 250 }),
  badge("veteran-drafter-3", "epic", 64, { type: "runs-won", count: 500 }),
  badge("veteran-drafter-4", "legend", 84, { type: "runs-won", count: 1000 }),
  // --- Daily quiz (days solved) -------------------------------------------------
  badge("scholar-1", "uncommon", 25, { type: "quiz-solved", count: 10 }),
  badge("scholar-2", "rare", 45, { type: "quiz-solved", count: 25 }),
  badge("scholar-3", "epic", 65, { type: "quiz-solved", count: 50 }),
  // --- Missions -----------------------------------------------------------------
  badge("on-target", "rare", 46, { type: "missions-completed", count: 50 }),
  // --- Pre-season participation -------------------------------------------------
  badge("first-chapter", "rare", 47, { type: "legacy-participation" }, true),
  // --- Pre-season board (final place) -------------------------------------------
  ...PRESEASON_BOARD_BADGES.map(([id, tier, min, max], i) =>
    badge(id, tier, 99 - i, { type: "legacy-position", minPosition: min, maxPosition: max }, true),
  ),
  // --- Pre-season peak rank -----------------------------------------------------
  ...PRESEASON_RANK_BADGES.map(([rankId, id, tier], i) => badge(id, tier, 30 + i * 4, { type: "legacy-rank", rankId, exact: true }, true)),
  // --- Road to Worlds -----------------------------------------------------------
  badge("road-warrior", "rare", 48, { type: "career-mark", markId: "car-three-seasons" }),
  badge("underdog", "rare", 49, { type: "career-mark", markId: "car-worlds-underdog" }),
  badge("world-champion", "epic", 68, { type: "career-worlds", count: 1 }),
  badge("world-champion-crowned", "epic", 69, { type: "career-worlds", count: 3 }),
  badge("dynasty", "legend", 100, { type: "season-feat", rankId: "supersonic-legend", careerWorlds: 3, legacyTitles: 25 }),
  // --- Manual grants ------------------------------------------------------------
  badge("contributor", "epic", 70, { type: "grant", grantId: "contributor" }, true),
  badge("supporter", "epic", 71, { type: "grant", grantId: "supporter" }, true),
  badge("verified-pro", "epic", 72, { type: "grant", grantId: "pro" }, true),
];

/** v2.0 (career R32): Road to Worlds milestones, worn in the draft game too (provisional). */
const careerCosmetics: CosmeticDef[] = [
  { id: "career-title-major", kind: "title", tier: "epic", priority: 71, source: { type: "career-mark", markId: "car-first-major" }, style: { colors: ["#fb923c", "#fcd34d"] } },
  { id: "career-title-world-champion", kind: "title", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { colors: ["#fcd34d", "#fb923c", "#f0abfc"] } },
  { id: "career-banner-world-champion", kind: "banner", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { from: "#3b1d0a", to: "#b45309", accent: "#fcd34d", pattern: "rays", animated: true } },
  { id: "career-title-homegrown", kind: "title", tier: "legend", priority: 74, source: { type: "career-mark", markId: "car-worlds-homegrown" }, style: { colors: ["#a7f3d0", "#34d399", "#22d3ee"] } },
];

export const COSMETICS: CosmeticDef[] = [
  ...BADGES,
  ...careerCosmetics,
  // --- Pre-season legacy: participation + peak rank ----------------------------
  { id: "legacy-title-day-one", kind: "title", tier: "common", priority: 20, source: { type: "legacy-participation" }, exclusive: true, style: { colors: ["#fb923c"] } },
  { id: "legacy-title-preseason-legend", kind: "title", tier: "legend", priority: 60, source: { type: "legacy-rank", rankId: "supersonic-legend", exact: true }, exclusive: true, style: { colors: ["#f0abfc", "#f97316", "#22d3ee"] } },
  // --- Pre-season legacy: final board position (non-cumulative bands) ---------
  { id: "legacy-banner-challenger", kind: "banner", tier: "rare", priority: 40, source: { type: "legacy-position", minPosition: 51, maxPosition: 100 }, exclusive: true, style: { from: "#0f172a", to: "#1e3a8a", accent: "#60a5fa", pattern: "stripes" } },
  { id: "legacy-title-challenger", kind: "title", tier: "common", priority: 70, source: { type: "legacy-position", minPosition: 51, maxPosition: 100 }, exclusive: true, style: { colors: ["#60a5fa"] } },
  { id: "legacy-banner-contender", kind: "banner", tier: "epic", priority: 50, source: { type: "legacy-position", minPosition: 11, maxPosition: 50 }, exclusive: true, style: { from: "#1e1b4b", to: "#6d28d9", accent: "#c4b5fd", pattern: "circuit" } },
  { id: "legacy-title-contender", kind: "title", tier: "epic", priority: 80, source: { type: "legacy-position", minPosition: 11, maxPosition: 50 }, exclusive: true, style: { colors: ["#c4b5fd", "#818cf8"] } },
  { id: "legacy-banner-elite", kind: "banner", tier: "legend", priority: 60, source: { type: "legacy-position", minPosition: 2, maxPosition: 10 }, exclusive: true, style: { from: "#431407", to: "#c2410c", accent: "#fb923c", pattern: "rays", animated: true } },
  { id: "legacy-title-elite", kind: "title", tier: "legend", priority: 90, source: { type: "legacy-position", minPosition: 2, maxPosition: 10 }, exclusive: true, style: { colors: ["#fb923c", "#fcd34d", "#f0abfc"] } },
  { id: "legacy-banner-champion", kind: "banner", tier: "legend", priority: 70, source: { type: "legacy-position", minPosition: 1, maxPosition: 1 }, exclusive: true, style: { from: "#422006", to: "#d97706", accent: "#fcd34d", pattern: "aurora", animated: true } },
  { id: "legacy-title-champion", kind: "title", tier: "legend", priority: 100, source: { type: "legacy-position", minPosition: 1, maxPosition: 1 }, exclusive: true, style: { colors: ["#fcd34d", "#fb923c", "#f472b6"] } },
  // --- Manual grants -----------------------------------------------------------
  { id: "grant-title-early-supporter", kind: "title", tier: "epic", priority: 65, source: { type: "grant", grantId: "supporter" }, exclusive: true, style: { colors: ["#f472b6", "#fb923c"] } },
  { id: "grant-title-founding-contributor", kind: "title", tier: "epic", priority: 66, source: { type: "grant", grantId: "contributor" }, exclusive: true, style: { colors: ["#34d399", "#22d3ee"] } },
  { id: "grant-title-pro-player", kind: "title", tier: "legend", priority: 95, source: { type: "grant", grantId: "pro" }, exclusive: true, style: { colors: ["#38bdf8", "#a78bfa", "#f472b6"] } },
  // rc.6: no Season 1 rank rewards — rank- and rating-linked rewards are only
  // handed out when a season turns over (the pre-season's are the PS badges).
  // The `season-rank` source stays for the Season 1 set at its turnover.
  // --- Login streak / challenge stars / quiz / missions (titles + banner) ------
  { id: "streak-banner-14", kind: "banner", tier: "epic", priority: 32, source: { type: "login-streak", days: 14 }, style: { from: "#431407", to: "#92400e", accent: "#fcd34d", pattern: "waves" } },
  { id: "streak-title-30", kind: "title", tier: "rare", priority: 58, source: { type: "login-streak", days: 30 }, style: { colors: ["#fcd34d"] } },
  { id: "stars-title-45", kind: "title", tier: "legend", priority: 75, source: { type: "challenge-stars", stars: 45 }, style: { colors: ["#fbbf24", "#f472b6", "#a78bfa"] } },
  { id: "quiz-title-30", kind: "title", tier: "rare", priority: 57, source: { type: "quiz-solved", count: 30 }, style: { colors: ["#a78bfa"] } },
  { id: "missions-title-100", kind: "title", tier: "rare", priority: 56, source: { type: "missions-completed", count: 100 }, style: { colors: ["#34d399"] } },
];

export const cosmeticById: ReadonlyMap<string, CosmeticDef> = new Map(COSMETICS.map((c) => [c.id, c]));

/** Pre-season leaderboard tiers by final position (highest first) — the recap's
 *  wording for a place, independent of which reward the band grants. */
export const LEGACY_POSITION_TIERS = [
  { id: "champion", maxPosition: 1 },
  { id: "elite", maxPosition: 10 },
  { id: "contender", maxPosition: 50 },
  { id: "challenger", maxPosition: 100 },
] as const;
