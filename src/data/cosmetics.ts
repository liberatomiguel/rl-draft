/**
 * Cosmetics catalog (v2.0, visual language reset in rc.3) — titles, badges and
 * profile banners.
 *
 * HAND-MAINTAINED, like achievements.json. Every entry is pure SVG/CSS (no
 * image asset, no request). Names and descriptions live in the copy
 * dictionaries (`COSMETICS.items[id]`, EN + PT) so this file stays
 * language-free. Reference for Miguel: `docs/COSMETICS-CATALOG.md` (generated).
 *
 * `source` is both the "how to get it" line AND the derivation rule used by
 * `src/engine/cosmetics.ts` — ownership is computed from the profile, never
 * hand-written into a save. Ids are a compatibility surface (saved `equipped`
 * choices reference them): never rename, only add.
 *
 * VISUAL LANGUAGE — the same one the rest of the game speaks (the logo, the
 * Legacy emblem, the achievement icons): thin line art, round caps, gradient
 * STROKES, no fills, no bevels. The tier decides how much colour and effect an
 * item gets, exactly like the special cards:
 *   common  → one muted colour, no effect.
 *   rare    → one accent colour (or a quiet two-tone).
 *   epic    → a two-colour gradient and a soft glow.
 *   legend  → a prismatic gradient, glow and the holo loop.
 * Rank rewards borrow the rank's palette so the reward reads as that rank.
 *
 * `exclusive` items (pre-season legacy, manual grants) can no longer be
 * earned: the locker hides them from players who do not own them.
 */

export type CosmeticKind = "title" | "badge" | "banner";
export type CosmeticTier = "common" | "rare" | "epic" | "legend";

export type CosmeticSource =
  | { type: "legacy-participation" }
  | { type: "legacy-rank"; rankId: string }
  | { type: "legacy-position"; maxPosition: number }
  | { type: "grant"; grantId: "supporter" | "pro" | "contributor" }
  | { type: "season-rank"; seasonId: number; rankId: string }
  | { type: "login-streak"; days: number }
  | { type: "challenge-stars"; stars: number }
  | { type: "quiz-solved"; count: number }
  | { type: "missions-completed"; count: number }
  /** v2.0 (career R32): a permanent career achievement id. */
  | { type: "career-mark"; markId: string };

export type BadgeGlyph =
  | "flag"
  | "heart"
  | "check"
  | "flame"
  | "star"
  | "trophy"
  | "bolt"
  | "shield"
  | "crown"
  | "book"
  | "target"
  | "rocket"
  | "ball"
  | "gem"
  | "medal"
  | "chevrons"
  | "globe"
  | "swords";

export type BadgeShape = "circle" | "shield" | "hex" | "octagon" | "diamond" | "pentagon" | "crest" | "square";

/** One to three stops: the stroke gradient (one colour = flat). */
export type Stops = [string] | [string, string] | [string, string, string];

export interface BadgeStyle {
  shape: BadgeShape;
  glyph: BadgeGlyph;
  colors: Stops;
}

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

const RANK_TIER: Record<string, CosmeticTier> = {
  bronze: "common",
  silver: "common",
  gold: "rare",
  platinum: "rare",
  diamond: "epic",
  champion: "epic",
  "grand-champion": "legend",
  "supersonic-legend": "legend",
};

const RANK_SHAPE: Record<string, BadgeShape> = {
  bronze: "circle",
  silver: "square",
  gold: "octagon",
  platinum: "shield",
  diamond: "diamond",
  champion: "hex",
  "grand-champion": "crest",
  "supersonic-legend": "pentagon",
};

/** Rank stroke: common ranks flat (one stop), rare two-tone, legend prismatic. */
const rankStops = (rankId: string): Stops => {
  const [a, b] = RANK_COLORS[rankId];
  const tier = RANK_TIER[rankId];
  if (tier === "common") return [b];
  if (tier === "legend") return rankId === "supersonic-legend" ? ["#f0abfc", "#f97316", "#22d3ee"] : [a, b, "#fcd34d"];
  return [a, b];
};

/** Pre-season peak-rank badges: the rank's palette, shape rising with the rank. */
const legacyRankBadges: CosmeticDef[] = Object.keys(RANK_COLORS).map((rankId, i) => ({
  id: `legacy-badge-${rankId}`,
  kind: "badge",
  tier: RANK_TIER[rankId],
  priority: 30 + i,
  source: { type: "legacy-rank", rankId },
  exclusive: true,
  style: { shape: RANK_SHAPE[rankId], glyph: "chevrons", colors: rankStops(rankId) },
}));

/** v2.0 (career R32): Road to Worlds milestones, worn in the draft game too. */
const careerCosmetics: CosmeticDef[] = [
  { id: "career-badge-regional", kind: "badge", tier: "rare", priority: 70, source: { type: "career-mark", markId: "car-first-regional" }, style: { shape: "shield", glyph: "trophy", colors: ["#60a5fa"] } },
  { id: "career-title-major", kind: "title", tier: "epic", priority: 71, source: { type: "career-mark", markId: "car-first-major" }, style: { colors: ["#fb923c", "#fcd34d"] } },
  { id: "career-title-world-champion", kind: "title", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { colors: ["#fcd34d", "#fb923c", "#f0abfc"] } },
  { id: "career-banner-world-champion", kind: "banner", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { from: "#3b1d0a", to: "#b45309", accent: "#fcd34d", pattern: "rays", animated: true } },
  { id: "career-badge-underdog", kind: "badge", tier: "legend", priority: 73, source: { type: "career-mark", markId: "car-worlds-underdog" }, style: { shape: "pentagon", glyph: "bolt", colors: ["#34d399", "#22d3ee", "#fcd34d"] } },
  { id: "career-title-homegrown", kind: "title", tier: "legend", priority: 74, source: { type: "career-mark", markId: "car-worlds-homegrown" }, style: { colors: ["#a7f3d0", "#34d399", "#22d3ee"] } },
  { id: "career-badge-dynasty", kind: "badge", tier: "legend", priority: 75, source: { type: "career-mark", markId: "car-three-worlds" }, style: { shape: "crest", glyph: "crown", colors: ["#fcd34d", "#fb923c", "#f0abfc"] } },
  { id: "career-badge-road-warrior", kind: "badge", tier: "rare", priority: 69, source: { type: "career-mark", markId: "car-three-seasons" }, style: { shape: "octagon", glyph: "flag", colors: ["#22d3ee"] } },
];

export const COSMETICS: CosmeticDef[] = [
  ...careerCosmetics,
  // --- Pre-season legacy: participation -------------------------------------
  { id: "legacy-title-day-one", kind: "title", tier: "common", priority: 20, source: { type: "legacy-participation" }, exclusive: true, style: { colors: ["#fb923c"] } },
  { id: "legacy-badge-first-chapter", kind: "badge", tier: "rare", priority: 20, source: { type: "legacy-participation" }, exclusive: true, style: { shape: "shield", glyph: "book", colors: ["#fb923c"] } },
  // --- Pre-season legacy: peak rank badges (Bronze → SSL) --------------------
  ...legacyRankBadges,
  { id: "legacy-title-preseason-legend", kind: "title", tier: "legend", priority: 60, source: { type: "legacy-rank", rankId: "supersonic-legend" }, exclusive: true, style: { colors: ["#f0abfc", "#f97316", "#22d3ee"] } },
  // --- Pre-season legacy: final board position ---------------------------------
  { id: "legacy-banner-challenger", kind: "banner", tier: "rare", priority: 40, source: { type: "legacy-position", maxPosition: 100 }, exclusive: true, style: { from: "#0f172a", to: "#1e3a8a", accent: "#60a5fa", pattern: "stripes" } },
  { id: "legacy-title-challenger", kind: "title", tier: "common", priority: 70, source: { type: "legacy-position", maxPosition: 100 }, exclusive: true, style: { colors: ["#60a5fa"] } },
  { id: "legacy-banner-contender", kind: "banner", tier: "epic", priority: 50, source: { type: "legacy-position", maxPosition: 50 }, exclusive: true, style: { from: "#1e1b4b", to: "#6d28d9", accent: "#c4b5fd", pattern: "circuit" } },
  { id: "legacy-title-contender", kind: "title", tier: "epic", priority: 80, source: { type: "legacy-position", maxPosition: 50 }, exclusive: true, style: { colors: ["#c4b5fd", "#818cf8"] } },
  { id: "legacy-banner-elite", kind: "banner", tier: "legend", priority: 60, source: { type: "legacy-position", maxPosition: 10 }, exclusive: true, style: { from: "#431407", to: "#c2410c", accent: "#fb923c", pattern: "rays", animated: true } },
  { id: "legacy-title-elite", kind: "title", tier: "legend", priority: 90, source: { type: "legacy-position", maxPosition: 10 }, exclusive: true, style: { colors: ["#fb923c", "#fcd34d", "#f0abfc"] } },
  { id: "legacy-banner-champion", kind: "banner", tier: "legend", priority: 70, source: { type: "legacy-position", maxPosition: 1 }, exclusive: true, style: { from: "#422006", to: "#d97706", accent: "#fcd34d", pattern: "aurora", animated: true } },
  { id: "legacy-title-champion", kind: "title", tier: "legend", priority: 100, source: { type: "legacy-position", maxPosition: 1 }, exclusive: true, style: { colors: ["#fcd34d", "#fb923c", "#f472b6"] } },
  // --- Manual grants -----------------------------------------------------------
  { id: "grant-title-early-supporter", kind: "title", tier: "epic", priority: 65, source: { type: "grant", grantId: "supporter" }, exclusive: true, style: { colors: ["#f472b6", "#fb923c"] } },
  { id: "grant-badge-early-supporter", kind: "badge", tier: "epic", priority: 50, source: { type: "grant", grantId: "supporter" }, exclusive: true, style: { shape: "circle", glyph: "heart", colors: ["#f472b6", "#fb923c"] } },
  { id: "grant-title-founding-contributor", kind: "title", tier: "epic", priority: 66, source: { type: "grant", grantId: "contributor" }, exclusive: true, style: { colors: ["#34d399", "#22d3ee"] } },
  { id: "grant-badge-founding-contributor", kind: "badge", tier: "epic", priority: 51, source: { type: "grant", grantId: "contributor" }, exclusive: true, style: { shape: "hex", glyph: "shield", colors: ["#34d399", "#22d3ee"] } },
  { id: "grant-title-pro-player", kind: "title", tier: "legend", priority: 95, source: { type: "grant", grantId: "pro" }, exclusive: true, style: { colors: ["#38bdf8", "#a78bfa", "#f472b6"] } },
  { id: "grant-badge-pro-player", kind: "badge", tier: "legend", priority: 90, source: { type: "grant", grantId: "pro" }, exclusive: true, style: { shape: "diamond", glyph: "check", colors: ["#38bdf8", "#a78bfa", "#f472b6"] } },
  // --- Season 1 progression track (one reward per rank, in the rank's colours) --
  { id: "s1-banner-kickoff", kind: "banner", tier: "common", priority: 10, source: { type: "season-rank", seasonId: 1, rankId: "bronze" }, style: { from: "#1c1008", to: "#3b1d0a", accent: RANK_COLORS.bronze[0], pattern: "none" } },
  { id: "s1-badge-ignition", kind: "badge", tier: "common", priority: 10, source: { type: "season-rank", seasonId: 1, rankId: "silver" }, style: { shape: "circle", glyph: "flame", colors: [RANK_COLORS.silver[1]] } },
  { id: "s1-badge-gilded", kind: "badge", tier: "rare", priority: 20, source: { type: "season-rank", seasonId: 1, rankId: "gold" }, style: { shape: "octagon", glyph: "star", colors: RANK_COLORS.gold } },
  { id: "s1-title-grinder", kind: "title", tier: "common", priority: 30, source: { type: "season-rank", seasonId: 1, rankId: "platinum" }, style: { colors: [RANK_COLORS.platinum[0]] } },
  { id: "s1-banner-neon-circuit", kind: "banner", tier: "epic", priority: 30, source: { type: "season-rank", seasonId: 1, rankId: "diamond" }, style: { from: "#0c4a6e", to: "#1d4ed8", accent: "#7dd3fc", pattern: "circuit" } },
  { id: "s1-badge-prism", kind: "badge", tier: "epic", priority: 45, source: { type: "season-rank", seasonId: 1, rankId: "champion" }, style: { shape: "hex", glyph: "gem", colors: ["#c4b5fd", "#8b5cf6"] } },
  { id: "s1-title-relentless", kind: "title", tier: "epic", priority: 55, source: { type: "season-rank", seasonId: 1, rankId: "grand-champion" }, style: { colors: RANK_COLORS["grand-champion"] } },
  { id: "s1-banner-supersonic", kind: "banner", tier: "legend", priority: 70, source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" }, style: { from: "#4a044e", to: "#c2410c", accent: "#f0abfc", pattern: "aurora", animated: true } },
  { id: "s1-title-season-1-legend", kind: "title", tier: "legend", priority: 85, source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" }, style: { colors: ["#f97316", "#f0abfc", "#22d3ee"] } },
  // --- Login streak -------------------------------------------------------------
  { id: "streak-badge-3", kind: "badge", tier: "common", priority: 12, source: { type: "login-streak", days: 3 }, style: { shape: "circle", glyph: "bolt", colors: ["#94a3b8"] } },
  { id: "streak-badge-7", kind: "badge", tier: "rare", priority: 22, source: { type: "login-streak", days: 7 }, style: { shape: "hex", glyph: "flame", colors: ["#fcd34d"] } },
  { id: "streak-banner-14", kind: "banner", tier: "epic", priority: 32, source: { type: "login-streak", days: 14 }, style: { from: "#431407", to: "#92400e", accent: "#fcd34d", pattern: "waves" } },
  { id: "streak-title-30", kind: "title", tier: "rare", priority: 58, source: { type: "login-streak", days: 30 }, style: { colors: ["#fcd34d"] } },
  // --- Challenge stars ----------------------------------------------------------
  { id: "stars-badge-10", kind: "badge", tier: "rare", priority: 25, source: { type: "challenge-stars", stars: 10 }, style: { shape: "pentagon", glyph: "star", colors: ["#fbbf24"] } },
  { id: "stars-badge-25", kind: "badge", tier: "epic", priority: 42, source: { type: "challenge-stars", stars: 25 }, style: { shape: "shield", glyph: "medal", colors: ["#fbbf24", "#a78bfa"] } },
  { id: "stars-title-45", kind: "title", tier: "legend", priority: 75, source: { type: "challenge-stars", stars: 45 }, style: { colors: ["#fbbf24", "#f472b6", "#a78bfa"] } },
  // --- Daily quiz ---------------------------------------------------------------
  { id: "quiz-badge-10", kind: "badge", tier: "rare", priority: 24, source: { type: "quiz-solved", count: 10 }, style: { shape: "square", glyph: "book", colors: ["#a78bfa"] } },
  { id: "quiz-title-30", kind: "title", tier: "rare", priority: 57, source: { type: "quiz-solved", count: 30 }, style: { colors: ["#a78bfa"] } },
  // --- Missions -----------------------------------------------------------------
  { id: "missions-badge-25", kind: "badge", tier: "rare", priority: 23, source: { type: "missions-completed", count: 25 }, style: { shape: "octagon", glyph: "target", colors: ["#34d399"] } },
  { id: "missions-title-100", kind: "title", tier: "rare", priority: 56, source: { type: "missions-completed", count: 100 }, style: { colors: ["#34d399"] } },
];

export const cosmeticById: ReadonlyMap<string, CosmeticDef> = new Map(COSMETICS.map((c) => [c.id, c]));

/** Pre-season leaderboard tiers by final position (highest first). */
export const LEGACY_POSITION_TIERS = [
  { id: "champion", maxPosition: 1 },
  { id: "elite", maxPosition: 10 },
  { id: "contender", maxPosition: 50 },
  { id: "challenger", maxPosition: 100 },
] as const;
