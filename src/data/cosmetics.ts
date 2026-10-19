/**
 * Cosmetics catalog (v2.0, visual rework in v2.0.0-rc.2) — avatars, titles,
 * badges, profile frames and banners.
 *
 * HAND-MAINTAINED, like achievements.json. Every entry is pure CSS/SVG (no image
 * asset, no request): avatars and badges are layered SVG emblems, frames are
 * SVG shapes around the avatar, banners are gradients + a pattern, titles are
 * styled chips. Names and descriptions live in the copy dictionaries
 * (`COSMETICS.items[id]`, EN + PT) so this file stays language-free.
 *
 * `source` is both the "how to get it" line AND the derivation rule used by
 * `src/engine/cosmetics.ts` — ownership is computed from the profile, never
 * hand-written into a save. Ids are a compatibility surface (saved `equipped`
 * choices reference them): never rename, only add.
 *
 * VISUAL LANGUAGE (the rule every entry follows, Miguel's rc.2 feedback):
 *   common  → basic. One muted colour, flat shape, no effects.
 *   rare    → two-tone, a rim, one accent. Still quiet.
 *   epic    → metal rim, gem, glow. Clearly special.
 *   legend  → prismatic / animated, wings or laurels. Worth the grind.
 * Rank rewards (season track, legacy frames) borrow the rank's own palette so
 * the reward reads as "that rank" at a glance.
 *
 * `exclusive` items (pre-season legacy, manual grants) can no longer be earned:
 * the locker hides them from players who do not own them.
 */

export type CosmeticKind = "avatar" | "title" | "badge" | "frame" | "banner";
export type CosmeticTier = "common" | "rare" | "epic" | "legend";

export type CosmeticSource =
  /** Owned by everyone (the starter avatars). */
  | { type: "default" }
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
  | "wings"
  | "gem"
  | "medal"
  | "chevrons"
  | "globe"
  | "swords";

export type BadgeShape = "circle" | "shield" | "hex" | "octagon" | "diamond" | "pentagon" | "crest";

export interface BadgeStyle {
  shape: BadgeShape;
  glyph: BadgeGlyph;
  /** Face gradient [top, bottom]. */
  colors: [string, string];
  /** Rim colour; tier default when omitted. */
  rim?: string;
  /** Glyph colour (default near-white). */
  ink?: string;
  /** Rank pips under the glyph (1–3) — the rank ladder motif. */
  pips?: number;
  /** Gem colour set on the crown of the badge (epic / legend). */
  gem?: string;
  /** Side wings (legend). */
  wings?: boolean;
}

export type FrameShape = "ring" | "hex" | "octagon" | "shield" | "square" | "wings" | "laurel" | "crest";

export interface FrameStyle {
  shape: FrameShape;
  /** Stroke gradient stops (2–3 CSS colours). */
  colors: string[];
  /** 1 = single outline, 2 = double line / bevel. */
  weight: 1 | 2;
  /** Studs or gems on the frame's corners. */
  studs?: boolean;
  /** Decorative loop (disabled under `lite-fx` / reduced motion). */
  animated?: "sheen" | "holo" | "pulse";
}

export type BannerPattern = "none" | "rays" | "grid" | "stripes" | "hex" | "waves" | "circuit" | "aurora" | "stadium";

export interface BannerStyle {
  from: string;
  to: string;
  /** Accent colour for the pattern / edge glow. */
  accent?: string;
  pattern?: BannerPattern;
  animated?: boolean;
}

export interface TitleStyle {
  color: string;
  /** Effect by tier: rare = none, epic = glow, legend = holo (animated). */
  fx?: "glow" | "holo";
}

export type AvatarMotif =
  | "octane"
  | "ball"
  | "boost"
  | "bolt"
  | "star"
  | "visor"
  | "planet"
  | "comet"
  | "trophy"
  | "phoenix"
  | "crown"
  | "skull"
  | "rocket"
  | "diamond"
  | "shield"
  | "flame";

export interface AvatarStyle {
  motif: AvatarMotif;
  /** Background gradient [top-left, bottom-right]. */
  colors: [string, string];
  /** Glyph colour (default near-white). */
  ink?: string;
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
  | (Base & { kind: "avatar"; style: AvatarStyle })
  | (Base & { kind: "title"; style: TitleStyle })
  | (Base & { kind: "badge"; style: BadgeStyle })
  | (Base & { kind: "frame"; style: FrameStyle })
  | (Base & { kind: "banner"; style: BannerStyle });

/** Rank palettes shared by rank-themed rewards (match RankBadge's tints). */
export const RANK_COLORS: Record<string, [string, string]> = {
  bronze: ["#d97706", "#78350f"],
  silver: ["#e2e8f0", "#64748b"],
  gold: ["#fde68a", "#b45309"],
  platinum: ["#a5f3fc", "#0369a1"],
  diamond: ["#7dd3fc", "#1d4ed8"],
  champion: ["#c4b5fd", "#6d28d9"],
  "grand-champion": ["#fda4af", "#b91c1c"],
  "supersonic-legend": ["#f0abfc", "#f97316"],
};

const RANK_FRAME_TIER: Record<string, CosmeticTier> = {
  bronze: "common",
  silver: "common",
  gold: "rare",
  platinum: "rare",
  diamond: "epic",
  champion: "epic",
  "grand-champion": "legend",
  "supersonic-legend": "legend",
};

const RANK_FRAME_SHAPE: Record<string, FrameShape> = {
  bronze: "ring",
  silver: "hex",
  gold: "octagon",
  platinum: "shield",
  diamond: "hex",
  champion: "crest",
  "grand-champion": "wings",
  "supersonic-legend": "laurel",
};

/** Pre-season peak-rank frames: the rank's palette, shape rising with the rank. */
const legacyRankFrames: CosmeticDef[] = Object.keys(RANK_COLORS).map((rankId, i) => ({
  id: `legacy-frame-${rankId}`,
  kind: "frame",
  tier: RANK_FRAME_TIER[rankId],
  priority: 30 + i,
  source: { type: "legacy-rank", rankId },
  exclusive: true,
  style: {
    shape: RANK_FRAME_SHAPE[rankId],
    colors: rankId === "supersonic-legend" ? ["#f0abfc", "#f97316", "#22d3ee"] : RANK_COLORS[rankId],
    weight: i >= 2 ? 2 : 1,
    studs: i >= 4,
    animated: rankId === "supersonic-legend" ? "holo" : i >= 6 ? "sheen" : undefined,
  },
}));

/** Starter avatars — owned by everyone, picked in the profile (basic by design). */
const starterAvatars: CosmeticDef[] = [
  { id: "avatar-octane", kind: "avatar", tier: "common", priority: 6, source: { type: "default" }, style: { motif: "octane", colors: ["#334155", "#0f172a"] } },
  { id: "avatar-ball", kind: "avatar", tier: "common", priority: 5, source: { type: "default" }, style: { motif: "ball", colors: ["#1d4ed8", "#0c1a3a"] } },
  { id: "avatar-boost", kind: "avatar", tier: "common", priority: 4, source: { type: "default" }, style: { motif: "boost", colors: ["#c2410c", "#3b1206"] } },
  { id: "avatar-bolt", kind: "avatar", tier: "common", priority: 3, source: { type: "default" }, style: { motif: "bolt", colors: ["#ca8a04", "#422006"], ink: "#fef3c7" } },
  { id: "avatar-star", kind: "avatar", tier: "common", priority: 2, source: { type: "default" }, style: { motif: "star", colors: ["#6d28d9", "#1e1038"] } },
  { id: "avatar-visor", kind: "avatar", tier: "common", priority: 1, source: { type: "default" }, style: { motif: "visor", colors: ["#0e7490", "#082f3a"] } },
];

/** Earnable avatars — the special ones. */
const earnedAvatars: CosmeticDef[] = [
  { id: "avatar-planet", kind: "avatar", tier: "rare", priority: 20, source: { type: "missions-completed", count: 10 }, style: { motif: "planet", colors: ["#2563eb", "#1e1b4b"], ink: "#bfdbfe" } },
  { id: "avatar-comet", kind: "avatar", tier: "rare", priority: 21, source: { type: "quiz-solved", count: 5 }, style: { motif: "comet", colors: ["#7c3aed", "#172554"], ink: "#e9d5ff" } },
  { id: "avatar-trophy", kind: "avatar", tier: "rare", priority: 22, source: { type: "challenge-stars", stars: 5 }, style: { motif: "trophy", colors: ["#b45309", "#1c1917"], ink: "#fde68a" } },
  { id: "avatar-flame", kind: "avatar", tier: "epic", priority: 40, source: { type: "login-streak", days: 14 }, style: { motif: "flame", colors: ["#ea580c", "#450a0a"], ink: "#fff7ed" } },
  { id: "avatar-shield", kind: "avatar", tier: "epic", priority: 41, source: { type: "career-mark", markId: "car-first-regional" }, style: { motif: "shield", colors: ["#0f766e", "#042f2e"], ink: "#99f6e4" } },
  { id: "avatar-rocket", kind: "avatar", tier: "epic", priority: 42, source: { type: "season-rank", seasonId: 1, rankId: "diamond" }, style: { motif: "rocket", colors: RANK_COLORS.diamond, ink: "#f0f9ff" } },
  { id: "avatar-crown", kind: "avatar", tier: "legend", priority: 60, source: { type: "career-mark", markId: "car-first-worlds" }, style: { motif: "crown", colors: ["#fbbf24", "#78350f"], ink: "#fffbeb" } },
  { id: "avatar-phoenix", kind: "avatar", tier: "legend", priority: 61, source: { type: "legacy-participation" }, exclusive: true, style: { motif: "phoenix", colors: ["#f97316", "#581c87"], ink: "#fff7ed" } },
  { id: "avatar-skull", kind: "avatar", tier: "legend", priority: 62, source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" }, style: { motif: "skull", colors: RANK_COLORS["supersonic-legend"], ink: "#fdf4ff" } },
];

/** v2.0 (career R32): Road to Worlds milestones, worn in the draft game too. */
const careerCosmetics: CosmeticDef[] = [
  { id: "career-badge-regional", kind: "badge", tier: "rare", priority: 70, source: { type: "career-mark", markId: "car-first-regional" }, style: { shape: "shield", glyph: "trophy", colors: ["#60a5fa", "#1e3a8a"], rim: "#93c5fd" } },
  { id: "career-title-major", kind: "title", tier: "epic", priority: 71, source: { type: "career-mark", markId: "car-first-major" }, style: { color: "#fb923c", fx: "glow" } },
  { id: "career-title-world-champion", kind: "title", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { color: "#fcd34d", fx: "holo" } },
  { id: "career-frame-world-champion", kind: "frame", tier: "legend", priority: 72, source: { type: "career-mark", markId: "car-first-worlds" }, style: { shape: "laurel", colors: ["#fcd34d", "#fb923c", "#f0abfc"], weight: 2, studs: true, animated: "sheen" } },
  { id: "career-badge-underdog", kind: "badge", tier: "legend", priority: 73, source: { type: "career-mark", markId: "car-worlds-underdog" }, style: { shape: "pentagon", glyph: "bolt", colors: ["#34d399", "#064e3b"], rim: "#a7f3d0", gem: "#fde68a", wings: true } },
  { id: "career-title-homegrown", kind: "title", tier: "legend", priority: 74, source: { type: "career-mark", markId: "car-worlds-homegrown" }, style: { color: "#a7f3d0", fx: "holo" } },
  { id: "career-badge-dynasty", kind: "badge", tier: "legend", priority: 75, source: { type: "career-mark", markId: "car-three-worlds" }, style: { shape: "crest", glyph: "crown", colors: ["#fcd34d", "#92400e"], rim: "#fef3c7", gem: "#f0abfc", wings: true, pips: 3 } },
  { id: "career-badge-road-warrior", kind: "badge", tier: "rare", priority: 69, source: { type: "career-mark", markId: "car-three-seasons" }, style: { shape: "octagon", glyph: "flag", colors: ["#22d3ee", "#164e63"], rim: "#a5f3fc" } },
];

export const COSMETICS: CosmeticDef[] = [
  ...starterAvatars,
  ...earnedAvatars,
  ...careerCosmetics,
  // --- Pre-season legacy: participation -------------------------------------
  {
    id: "legacy-title-day-one",
    kind: "title",
    tier: "rare",
    priority: 20,
    source: { type: "legacy-participation" },
    exclusive: true,
    style: { color: "#fb923c" },
  },
  {
    id: "legacy-badge-first-chapter",
    kind: "badge",
    tier: "rare",
    priority: 20,
    source: { type: "legacy-participation" },
    exclusive: true,
    style: { shape: "shield", glyph: "book", colors: ["#fb923c", "#7c2d12"], rim: "#fdba74" },
  },
  // --- Pre-season legacy: peak rank frames (Bronze → SSL) --------------------
  ...legacyRankFrames,
  {
    id: "legacy-title-preseason-legend",
    kind: "title",
    tier: "legend",
    priority: 60,
    source: { type: "legacy-rank", rankId: "supersonic-legend" },
    exclusive: true,
    style: { color: "#f0abfc", fx: "holo" },
  },
  // --- Pre-season legacy: final board position ---------------------------------
  {
    id: "legacy-banner-challenger",
    kind: "banner",
    tier: "rare",
    priority: 40,
    source: { type: "legacy-position", maxPosition: 100 },
    exclusive: true,
    style: { from: "#0f172a", to: "#1e3a8a", accent: "#60a5fa", pattern: "stripes" },
  },
  {
    id: "legacy-title-challenger",
    kind: "title",
    tier: "rare",
    priority: 70,
    source: { type: "legacy-position", maxPosition: 100 },
    exclusive: true,
    style: { color: "#60a5fa" },
  },
  {
    id: "legacy-banner-contender",
    kind: "banner",
    tier: "epic",
    priority: 50,
    source: { type: "legacy-position", maxPosition: 50 },
    exclusive: true,
    style: { from: "#111827", to: "#4c1d95", accent: "#c4b5fd", pattern: "circuit" },
  },
  {
    id: "legacy-title-contender",
    kind: "title",
    tier: "epic",
    priority: 80,
    source: { type: "legacy-position", maxPosition: 50 },
    exclusive: true,
    style: { color: "#c4b5fd", fx: "glow" },
  },
  {
    id: "legacy-banner-elite",
    kind: "banner",
    tier: "legend",
    priority: 60,
    source: { type: "legacy-position", maxPosition: 10 },
    exclusive: true,
    style: { from: "#1c1917", to: "#9a3412", accent: "#fb923c", pattern: "rays", animated: true },
  },
  {
    id: "legacy-title-elite",
    kind: "title",
    tier: "legend",
    priority: 90,
    source: { type: "legacy-position", maxPosition: 10 },
    exclusive: true,
    style: { color: "#fb923c", fx: "holo" },
  },
  {
    id: "legacy-banner-champion",
    kind: "banner",
    tier: "legend",
    priority: 70,
    source: { type: "legacy-position", maxPosition: 1 },
    exclusive: true,
    style: { from: "#1f1300", to: "#b45309", accent: "#fcd34d", pattern: "stadium", animated: true },
  },
  {
    id: "legacy-title-champion",
    kind: "title",
    tier: "legend",
    priority: 100,
    source: { type: "legacy-position", maxPosition: 1 },
    exclusive: true,
    style: { color: "#fcd34d", fx: "holo" },
  },
  // --- Manual grants -----------------------------------------------------------
  {
    id: "grant-title-early-supporter",
    kind: "title",
    tier: "epic",
    priority: 65,
    source: { type: "grant", grantId: "supporter" },
    exclusive: true,
    style: { color: "#f472b6", fx: "glow" },
  },
  {
    id: "grant-badge-early-supporter",
    kind: "badge",
    tier: "epic",
    priority: 50,
    source: { type: "grant", grantId: "supporter" },
    exclusive: true,
    style: { shape: "circle", glyph: "heart", colors: ["#f472b6", "#831843"], rim: "#fbcfe8", gem: "#fde68a" },
  },
  {
    id: "grant-title-founding-contributor",
    kind: "title",
    tier: "epic",
    priority: 66,
    source: { type: "grant", grantId: "contributor" },
    exclusive: true,
    style: { color: "#34d399", fx: "glow" },
  },
  {
    id: "grant-badge-founding-contributor",
    kind: "badge",
    tier: "epic",
    priority: 51,
    source: { type: "grant", grantId: "contributor" },
    exclusive: true,
    style: { shape: "hex", glyph: "shield", colors: ["#34d399", "#064e3b"], rim: "#a7f3d0", gem: "#fcd34d" },
  },
  {
    id: "grant-title-pro-player",
    kind: "title",
    tier: "legend",
    priority: 95,
    source: { type: "grant", grantId: "pro" },
    exclusive: true,
    style: { color: "#38bdf8", fx: "holo" },
  },
  {
    id: "grant-badge-pro-player",
    kind: "badge",
    tier: "legend",
    priority: 90,
    source: { type: "grant", grantId: "pro" },
    exclusive: true,
    style: { shape: "diamond", glyph: "check", colors: ["#38bdf8", "#0c4a6e"], rim: "#e0f2fe", gem: "#fde68a", wings: true },
  },
  // --- Season 1 progression track (one reward per rank, in the rank's colours) --
  {
    id: "s1-banner-kickoff",
    kind: "banner",
    tier: "common",
    priority: 10,
    source: { type: "season-rank", seasonId: 1, rankId: "bronze" },
    style: { from: "#1c1008", to: "#3b1d0a", accent: RANK_COLORS.bronze[0], pattern: "none" },
  },
  {
    id: "s1-badge-ignition",
    kind: "badge",
    tier: "common",
    priority: 10,
    source: { type: "season-rank", seasonId: 1, rankId: "silver" },
    style: { shape: "circle", glyph: "chevrons", colors: RANK_COLORS.silver, pips: 1 },
  },
  {
    id: "s1-frame-chrome",
    kind: "frame",
    tier: "rare",
    priority: 20,
    source: { type: "season-rank", seasonId: 1, rankId: "gold" },
    style: { shape: "octagon", colors: RANK_COLORS.gold, weight: 2 },
  },
  {
    id: "s1-title-grinder",
    kind: "title",
    tier: "rare",
    priority: 30,
    source: { type: "season-rank", seasonId: 1, rankId: "platinum" },
    style: { color: RANK_COLORS.platinum[0] },
  },
  {
    id: "s1-banner-neon-circuit",
    kind: "banner",
    tier: "epic",
    priority: 30,
    source: { type: "season-rank", seasonId: 1, rankId: "diamond" },
    style: { from: "#042f2e", to: "#1d4ed8", accent: "#7dd3fc", pattern: "circuit" },
  },
  {
    id: "s1-frame-prism",
    kind: "frame",
    tier: "epic",
    priority: 45,
    source: { type: "season-rank", seasonId: 1, rankId: "champion" },
    style: { shape: "crest", colors: ["#c4b5fd", "#6d28d9", "#f472b6"], weight: 2, studs: true, animated: "sheen" },
  },
  {
    id: "s1-title-relentless",
    kind: "title",
    tier: "epic",
    priority: 55,
    source: { type: "season-rank", seasonId: 1, rankId: "grand-champion" },
    style: { color: RANK_COLORS["grand-champion"][0], fx: "glow" },
  },
  {
    id: "s1-frame-supersonic",
    kind: "frame",
    tier: "legend",
    priority: 70,
    source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" },
    style: { shape: "wings", colors: ["#f97316", "#f0abfc", "#22d3ee"], weight: 2, studs: true, animated: "holo" },
  },
  {
    id: "s1-title-season-1-legend",
    kind: "title",
    tier: "legend",
    priority: 85,
    source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" },
    style: { color: "#f97316", fx: "holo" },
  },
  // --- Login streak -------------------------------------------------------------
  {
    id: "streak-badge-3",
    kind: "badge",
    tier: "common",
    priority: 12,
    source: { type: "login-streak", days: 3 },
    style: { shape: "circle", glyph: "bolt", colors: ["#fcd34d", "#854d0e"] },
  },
  {
    id: "streak-frame-7",
    kind: "frame",
    tier: "rare",
    priority: 22,
    source: { type: "login-streak", days: 7 },
    style: { shape: "hex", colors: ["#fcd34d", "#f97316"], weight: 1 },
  },
  {
    id: "streak-banner-14",
    kind: "banner",
    tier: "epic",
    priority: 32,
    source: { type: "login-streak", days: 14 },
    style: { from: "#1f1300", to: "#7c2d12", accent: "#fcd34d", pattern: "waves" },
  },
  {
    id: "streak-title-30",
    kind: "title",
    tier: "epic",
    priority: 58,
    source: { type: "login-streak", days: 30 },
    style: { color: "#fcd34d", fx: "glow" },
  },
  // --- Challenge stars ----------------------------------------------------------
  {
    id: "stars-badge-10",
    kind: "badge",
    tier: "rare",
    priority: 25,
    source: { type: "challenge-stars", stars: 10 },
    style: { shape: "pentagon", glyph: "star", colors: ["#fbbf24", "#78350f"], rim: "#fde68a" },
  },
  {
    id: "stars-frame-25",
    kind: "frame",
    tier: "epic",
    priority: 42,
    source: { type: "challenge-stars", stars: 25 },
    style: { shape: "shield", colors: ["#fbbf24", "#a78bfa"], weight: 2, studs: true },
  },
  {
    id: "stars-title-45",
    kind: "title",
    tier: "legend",
    priority: 75,
    source: { type: "challenge-stars", stars: 45 },
    style: { color: "#fbbf24", fx: "holo" },
  },
  // --- Daily quiz ---------------------------------------------------------------
  {
    id: "quiz-badge-10",
    kind: "badge",
    tier: "rare",
    priority: 24,
    source: { type: "quiz-solved", count: 10 },
    style: { shape: "hex", glyph: "book", colors: ["#a78bfa", "#3b0764"], rim: "#ddd6fe" },
  },
  {
    id: "quiz-title-30",
    kind: "title",
    tier: "epic",
    priority: 57,
    source: { type: "quiz-solved", count: 30 },
    style: { color: "#a78bfa", fx: "glow" },
  },
  // --- Missions -----------------------------------------------------------------
  {
    id: "missions-badge-25",
    kind: "badge",
    tier: "rare",
    priority: 23,
    source: { type: "missions-completed", count: 25 },
    style: { shape: "octagon", glyph: "target", colors: ["#34d399", "#064e3b"], rim: "#a7f3d0" },
  },
  {
    id: "missions-title-100",
    kind: "title",
    tier: "epic",
    priority: 56,
    source: { type: "missions-completed", count: 100 },
    style: { color: "#34d399", fx: "glow" },
  },
];

export const cosmeticById: ReadonlyMap<string, CosmeticDef> = new Map(COSMETICS.map((c) => [c.id, c]));

/** The avatar shown when nothing is equipped (always owned). */
export const DEFAULT_AVATAR_ID = "avatar-octane";

/** Pre-season leaderboard tiers by final position (highest first). */
export const LEGACY_POSITION_TIERS = [
  { id: "champion", maxPosition: 1 },
  { id: "elite", maxPosition: 10 },
  { id: "contender", maxPosition: 50 },
  { id: "challenger", maxPosition: 100 },
] as const;
