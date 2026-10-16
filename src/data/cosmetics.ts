/**
 * Cosmetics catalog (v2.0) — titles, badges, profile frames and banners.
 *
 * HAND-MAINTAINED, like achievements.json. Every entry is pure CSS/SVG (no image
 * asset, no request): frames are gradient rings, banners are gradients, badges
 * are inline glyphs. Names and descriptions live in the copy dictionaries
 * (`COSMETICS.items[id]`, EN + PT) so this file stays language-free.
 *
 * `source` is both the "how to get it" line AND the derivation rule used by
 * `src/engine/cosmetics.ts` — ownership is computed from the profile, never
 * hand-written into a save. Ids are a compatibility surface (saved `equipped`
 * choices reference them): never rename, only add.
 *
 * Tiers drive the locker's visual family (same vocabulary as special cards).
 * `priority` ranks items of a kind for the AUTO pick (an unset equipped slot
 * shows the best owned item): higher wins.
 */

export type CosmeticKind = "title" | "badge" | "frame" | "banner";
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
  | { type: "missions-completed"; count: number };

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
  | "target";

export interface FrameStyle {
  /** Ring gradient stops (2–3 CSS colours). */
  colors: string[];
  rings: 1 | 2;
  /** Decorative loop (disabled under `lite-fx` / reduced motion). */
  animated?: "sheen" | "holo";
}
export interface BannerStyle {
  from: string;
  to: string;
  /** Optional accent colour for the pattern / edge glow. */
  accent?: string;
  pattern?: "none" | "rays" | "grid" | "stripes";
  animated?: boolean;
}
export interface BadgeStyle {
  glyph: BadgeGlyph;
  color: string;
}
export interface TitleStyle {
  color: string;
  glow?: boolean;
}

export type CosmeticDef =
  | { id: string; kind: "title"; tier: CosmeticTier; priority: number; source: CosmeticSource; style: TitleStyle }
  | { id: string; kind: "badge"; tier: CosmeticTier; priority: number; source: CosmeticSource; style: BadgeStyle }
  | { id: string; kind: "frame"; tier: CosmeticTier; priority: number; source: CosmeticSource; style: FrameStyle }
  | { id: string; kind: "banner"; tier: CosmeticTier; priority: number; source: CosmeticSource; style: BannerStyle };

/** Rank colours shared by the legacy frames (match RankBadge's tints). */
const RANK_COLORS: Record<string, string[]> = {
  bronze: ["#b45309", "#78350f"],
  silver: ["#cbd5e1", "#64748b"],
  gold: ["#fcd34d", "#b45309"],
  platinum: ["#a5f3fc", "#0369a1"],
  diamond: ["#7dd3fc", "#1d4ed8"],
  champion: ["#c4b5fd", "#6d28d9"],
  "grand-champion": ["#fda4af", "#b91c1c"],
  "supersonic-legend": ["#f0abfc", "#f97316", "#22d3ee"],
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

const legacyRankFrames: CosmeticDef[] = Object.keys(RANK_COLORS).map((rankId, i) => ({
  id: `legacy-frame-${rankId}`,
  kind: "frame",
  tier: RANK_FRAME_TIER[rankId],
  priority: 30 + i,
  source: { type: "legacy-rank", rankId },
  style: {
    colors: RANK_COLORS[rankId],
    rings: i >= 3 ? 2 : 1,
    animated: rankId === "supersonic-legend" ? "holo" : i >= 5 ? "sheen" : undefined,
  },
}));

export const COSMETICS: CosmeticDef[] = [
  // --- Pre-season legacy: participation -------------------------------------
  {
    id: "legacy-title-day-one",
    kind: "title",
    tier: "rare",
    priority: 20,
    source: { type: "legacy-participation" },
    style: { color: "#fb923c" },
  },
  {
    id: "legacy-badge-first-chapter",
    kind: "badge",
    tier: "rare",
    priority: 20,
    source: { type: "legacy-participation" },
    style: { glyph: "flag", color: "#fb923c" },
  },
  // --- Pre-season legacy: peak rank frames (Bronze → SSL) --------------------
  ...legacyRankFrames,
  {
    id: "legacy-title-preseason-legend",
    kind: "title",
    tier: "legend",
    priority: 60,
    source: { type: "legacy-rank", rankId: "supersonic-legend" },
    style: { color: "#f0abfc", glow: true },
  },
  // --- Pre-season legacy: final board position ---------------------------------
  {
    id: "legacy-banner-challenger",
    kind: "banner",
    tier: "rare",
    priority: 40,
    source: { type: "legacy-position", maxPosition: 100 },
    style: { from: "#0f172a", to: "#1e3a8a", accent: "#60a5fa", pattern: "stripes" },
  },
  {
    id: "legacy-title-challenger",
    kind: "title",
    tier: "rare",
    priority: 70,
    source: { type: "legacy-position", maxPosition: 100 },
    style: { color: "#60a5fa" },
  },
  {
    id: "legacy-banner-contender",
    kind: "banner",
    tier: "epic",
    priority: 50,
    source: { type: "legacy-position", maxPosition: 50 },
    style: { from: "#111827", to: "#4c1d95", accent: "#c4b5fd", pattern: "grid" },
  },
  {
    id: "legacy-title-contender",
    kind: "title",
    tier: "epic",
    priority: 80,
    source: { type: "legacy-position", maxPosition: 50 },
    style: { color: "#c4b5fd" },
  },
  {
    id: "legacy-banner-elite",
    kind: "banner",
    tier: "legend",
    priority: 60,
    source: { type: "legacy-position", maxPosition: 10 },
    style: { from: "#1c1917", to: "#9a3412", accent: "#fb923c", pattern: "rays", animated: true },
  },
  {
    id: "legacy-title-elite",
    kind: "title",
    tier: "legend",
    priority: 90,
    source: { type: "legacy-position", maxPosition: 10 },
    style: { color: "#fb923c", glow: true },
  },
  {
    id: "legacy-banner-champion",
    kind: "banner",
    tier: "legend",
    priority: 70,
    source: { type: "legacy-position", maxPosition: 1 },
    style: { from: "#1f1300", to: "#b45309", accent: "#fcd34d", pattern: "rays", animated: true },
  },
  {
    id: "legacy-title-champion",
    kind: "title",
    tier: "legend",
    priority: 100,
    source: { type: "legacy-position", maxPosition: 1 },
    style: { color: "#fcd34d", glow: true },
  },
  // --- Manual grants -----------------------------------------------------------
  {
    id: "grant-title-early-supporter",
    kind: "title",
    tier: "epic",
    priority: 65,
    source: { type: "grant", grantId: "supporter" },
    style: { color: "#f472b6" },
  },
  {
    id: "grant-badge-early-supporter",
    kind: "badge",
    tier: "epic",
    priority: 50,
    source: { type: "grant", grantId: "supporter" },
    style: { glyph: "heart", color: "#f472b6" },
  },
  {
    id: "grant-title-founding-contributor",
    kind: "title",
    tier: "epic",
    priority: 66,
    source: { type: "grant", grantId: "contributor" },
    style: { color: "#34d399" },
  },
  {
    id: "grant-badge-founding-contributor",
    kind: "badge",
    tier: "epic",
    priority: 51,
    source: { type: "grant", grantId: "contributor" },
    style: { glyph: "shield", color: "#34d399" },
  },
  {
    id: "grant-title-pro-player",
    kind: "title",
    tier: "legend",
    priority: 95,
    source: { type: "grant", grantId: "pro" },
    style: { color: "#38bdf8", glow: true },
  },
  {
    id: "grant-badge-pro-player",
    kind: "badge",
    tier: "legend",
    priority: 90,
    source: { type: "grant", grantId: "pro" },
    style: { glyph: "check", color: "#38bdf8" },
  },
  // --- Season 1 progression track (generic, not rank-themed) ------------------
  {
    id: "s1-banner-kickoff",
    kind: "banner",
    tier: "common",
    priority: 10,
    source: { type: "season-rank", seasonId: 1, rankId: "bronze" },
    style: { from: "#0b1220", to: "#1e293b", accent: "#f97316", pattern: "none" },
  },
  {
    id: "s1-badge-ignition",
    kind: "badge",
    tier: "common",
    priority: 10,
    source: { type: "season-rank", seasonId: 1, rankId: "silver" },
    style: { glyph: "flame", color: "#f97316" },
  },
  {
    id: "s1-frame-chrome",
    kind: "frame",
    tier: "rare",
    priority: 20,
    source: { type: "season-rank", seasonId: 1, rankId: "gold" },
    style: { colors: ["#e2e8f0", "#64748b", "#f8fafc"], rings: 1 },
  },
  {
    id: "s1-title-grinder",
    kind: "title",
    tier: "rare",
    priority: 30,
    source: { type: "season-rank", seasonId: 1, rankId: "platinum" },
    style: { color: "#38bdf8" },
  },
  {
    id: "s1-banner-neon-circuit",
    kind: "banner",
    tier: "epic",
    priority: 30,
    source: { type: "season-rank", seasonId: 1, rankId: "diamond" },
    style: { from: "#042f2e", to: "#0e7490", accent: "#22d3ee", pattern: "grid" },
  },
  {
    id: "s1-frame-prism",
    kind: "frame",
    tier: "epic",
    priority: 45,
    source: { type: "season-rank", seasonId: 1, rankId: "champion" },
    style: { colors: ["#22d3ee", "#a78bfa", "#f472b6"], rings: 2, animated: "sheen" },
  },
  {
    id: "s1-title-relentless",
    kind: "title",
    tier: "epic",
    priority: 55,
    source: { type: "season-rank", seasonId: 1, rankId: "grand-champion" },
    style: { color: "#fda4af" },
  },
  {
    id: "s1-frame-supersonic",
    kind: "frame",
    tier: "legend",
    priority: 70,
    source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" },
    style: { colors: ["#f97316", "#f0abfc", "#22d3ee"], rings: 2, animated: "holo" },
  },
  {
    id: "s1-title-season-1-legend",
    kind: "title",
    tier: "legend",
    priority: 85,
    source: { type: "season-rank", seasonId: 1, rankId: "supersonic-legend" },
    style: { color: "#f97316", glow: true },
  },
  // --- Login streak -------------------------------------------------------------
  {
    id: "streak-badge-3",
    kind: "badge",
    tier: "common",
    priority: 12,
    source: { type: "login-streak", days: 3 },
    style: { glyph: "bolt", color: "#fcd34d" },
  },
  {
    id: "streak-frame-7",
    kind: "frame",
    tier: "rare",
    priority: 22,
    source: { type: "login-streak", days: 7 },
    style: { colors: ["#fcd34d", "#f97316"], rings: 1 },
  },
  {
    id: "streak-banner-14",
    kind: "banner",
    tier: "epic",
    priority: 32,
    source: { type: "login-streak", days: 14 },
    style: { from: "#1f1300", to: "#7c2d12", accent: "#fcd34d", pattern: "stripes" },
  },
  {
    id: "streak-title-30",
    kind: "title",
    tier: "epic",
    priority: 58,
    source: { type: "login-streak", days: 30 },
    style: { color: "#fcd34d" },
  },
  // --- Challenge stars ----------------------------------------------------------
  {
    id: "stars-badge-10",
    kind: "badge",
    tier: "rare",
    priority: 25,
    source: { type: "challenge-stars", stars: 10 },
    style: { glyph: "star", color: "#fbbf24" },
  },
  {
    id: "stars-frame-25",
    kind: "frame",
    tier: "epic",
    priority: 42,
    source: { type: "challenge-stars", stars: 25 },
    style: { colors: ["#fbbf24", "#a78bfa"], rings: 2 },
  },
  {
    id: "stars-title-45",
    kind: "title",
    tier: "legend",
    priority: 75,
    source: { type: "challenge-stars", stars: 45 },
    style: { color: "#fbbf24", glow: true },
  },
  // --- Daily quiz ---------------------------------------------------------------
  {
    id: "quiz-badge-10",
    kind: "badge",
    tier: "rare",
    priority: 24,
    source: { type: "quiz-solved", count: 10 },
    style: { glyph: "book", color: "#a78bfa" },
  },
  {
    id: "quiz-title-30",
    kind: "title",
    tier: "epic",
    priority: 57,
    source: { type: "quiz-solved", count: 30 },
    style: { color: "#a78bfa" },
  },
  // --- Missions -----------------------------------------------------------------
  {
    id: "missions-badge-25",
    kind: "badge",
    tier: "rare",
    priority: 23,
    source: { type: "missions-completed", count: 25 },
    style: { glyph: "target", color: "#34d399" },
  },
  {
    id: "missions-title-100",
    kind: "title",
    tier: "epic",
    priority: 56,
    source: { type: "missions-completed", count: 100 },
    style: { color: "#34d399" },
  },
];

export const cosmeticById: ReadonlyMap<string, CosmeticDef> = new Map(COSMETICS.map((c) => [c.id, c]));

/** Pre-season leaderboard tiers by final position (highest first). */
export const LEGACY_POSITION_TIERS = [
  { id: "champion", maxPosition: 1 },
  { id: "elite", maxPosition: 10 },
  { id: "contender", maxPosition: 50 },
  { id: "challenger", maxPosition: 100 },
] as const;
