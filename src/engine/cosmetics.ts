/**
 * Cosmetics (v2.0) — pure derivation of what a profile OWNS and what it SHOWS.
 *
 * Ownership is never hand-written into a save: it is derived from facts the
 * profile already stores (the pre-season snapshot, the cloud grants, the season
 * peak rank, streaks, stars, quiz solves) through each catalog entry's `source`.
 * The store caches the result with unlock dates (`cosmetics.owned`) so the
 * locker can mark NEW items; `equipped` holds explicit choices.
 *
 * rc.2: there is NO auto-equip any more (Miguel's feedback). A slot is either an
 * owned id or empty (null / NONE both mean empty). `seen` records the owned
 * ids the player has looked at in the locker, so the profile can show "N new"
 * until they do. rc.3: avatars and frames are gone — a player is their name,
 * title, badges and banner.
 */

import { RANKS } from "@/config/balance";
import {
  COSMETICS,
  cosmeticById,
  LEGACY_POSITION_TIERS,
  type CosmeticDef,
  type CosmeticKind,
  type CosmeticSource,
} from "@/data/cosmetics";
import type { PreseasonSnapshot } from "./season";

/** Explicit "show nothing" choice for a slot (kept for saved-state compatibility). */
export const NONE = "none";
/** Badges shown at once (profile card + leaderboard row). */
export const MAX_BADGES = 3;

export interface EquippedState {
  title: string | null;
  banner: string | null;
  /** null = none; an array = the explicit selection (up to MAX_BADGES). */
  badges: string[] | null;
}

export interface CosmeticsState {
  /** id → ISO date first owned (for "NEW" markers and the locker order). */
  owned: Record<string, string>;
  equipped: EquippedState;
  /** rc.2: owned ids the player has already seen in the locker. */
  seen?: string[];
}

export const EMPTY_COSMETICS: CosmeticsState = {
  owned: {},
  equipped: { title: null, banner: null, badges: null },
  seen: [],
};

/** Everything the derivation reads. Counters that later systems feed default to 0. */
export interface CosmeticFacts {
  preseason: PreseasonSnapshot | null;
  grants: string[];
  seasonId: number;
  seasonPeakRankId: string;
  loginBestStreak?: number;
  challengeStars?: number;
  quizSolved?: number;
  missionsCompleted?: number;
  /** v2.0 (career R32): permanent career achievement ids mirrored on the profile. */
  careerMarks?: string[];
  /** rc.2: preview switch (dev / staging only) — every item counts as owned. */
  previewAll?: boolean;
}

const rankIndex = (id: string): number => Math.max(0, RANKS.findIndex((r) => r.id === id));

/** The facts the cosmetics derivation reads from a profile (v2.0). Counters owned
 *  by later systems (login streak, stars, quiz, missions) are read defensively. */
export function cosmeticFacts(p: {
  legacy?: { preseason: PreseasonSnapshot | null } | null;
  grants?: string[];
  season?: { id: number; peakRankId: string } | null;
  [k: string]: unknown;
}): CosmeticFacts {
  const num = (k: string): number => {
    const v = (p as Record<string, unknown>)[k];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  const login = (p as { login?: { best?: number } }).login;
  const stars = (p as { challengeStars?: Record<string, number> }).challengeStars;
  const quiz = (p as { quiz?: { solved?: number } }).quiz;
  const missions = (p as { missions?: { completedTotal?: number } }).missions;
  return {
    preseason: p.legacy?.preseason ?? null,
    grants: p.grants ?? [],
    seasonId: p.season?.id ?? 0,
    seasonPeakRankId: p.season?.peakRankId ?? "unranked",
    loginBestStreak: login?.best ?? num("loginBestStreak"),
    challengeStars: stars ? Object.values(stars).reduce((n, mask) => n + countBits(mask), 0) : 0,
    quizSolved: quiz?.solved ?? 0,
    missionsCompleted: missions?.completedTotal ?? 0,
    careerMarks: Array.isArray((p as { careerMarks?: unknown }).careerMarks)
      ? ((p as { careerMarks: unknown[] }).careerMarks.filter((x) => typeof x === "string") as string[])
      : [],
    previewAll: (p as { previewUnlockAll?: unknown }).previewUnlockAll === true,
  };
}

function countBits(mask: number): number {
  let n = 0;
  for (let m = mask | 0; m; m >>>= 1) n += m & 1;
  return n;
}

/** The pre-season board tier for a final position (null outside the top 100). */
export function legacyPositionTier(position: number | null | undefined): (typeof LEGACY_POSITION_TIERS)[number]["id"] | null {
  if (!position || position < 1) return null;
  for (const tier of LEGACY_POSITION_TIERS) if (position <= tier.maxPosition) return tier.id;
  return null;
}

function sourceSatisfied(source: CosmeticSource, f: CosmeticFacts): boolean {
  switch (source.type) {
    case "legacy-participation":
      return !!f.preseason && f.preseason.runsCompleted > 0;
    case "legacy-rank":
      return !!f.preseason && f.preseason.runsCompleted > 0 && rankIndex(f.preseason.rankId) >= rankIndex(source.rankId);
    case "legacy-position":
      return !!f.preseason && !!f.preseason.position && f.preseason.position <= source.maxPosition;
    case "grant":
      return f.grants.includes(source.grantId);
    case "season-rank":
      return f.seasonId === source.seasonId && rankIndex(f.seasonPeakRankId) >= rankIndex(source.rankId);
    case "login-streak":
      return (f.loginBestStreak ?? 0) >= source.days;
    case "challenge-stars":
      return (f.challengeStars ?? 0) >= source.stars;
    case "quiz-solved":
      return (f.quizSolved ?? 0) >= source.count;
    case "missions-completed":
      return (f.missionsCompleted ?? 0) >= source.count;
    case "career-mark":
      return (f.careerMarks ?? []).includes(source.markId);
  }
}

/** Ids the facts entitle the player to (catalog order). */
export function deriveOwnedIds(f: CosmeticFacts): string[] {
  if (f.previewAll) return COSMETICS.map((c) => c.id);
  return COSMETICS.filter((c) => sourceSatisfied(c.source, f)).map((c) => c.id);
}

/**
 * Refresh the owned map: newly earned ids get `now`, known ids keep their date,
 * and ids that are no longer in the catalog are dropped. Entitlements never go
 * away on their own (facts only grow), but a stale id from a renamed catalog
 * entry must not linger. Preview ownership (dev switch) is transient: when the
 * switch is off, ids the facts do not entitle are dropped again.
 */
export function refreshOwned(
  owned: Record<string, string>,
  f: CosmeticFacts,
  now = new Date().toISOString(),
): Record<string, string> {
  const entitled = new Set(deriveOwnedIds(f));
  const next: Record<string, string> = {};
  for (const [id, date] of Object.entries(owned)) if (cosmeticById.has(id) && entitled.has(id)) next[id] = date;
  for (const id of entitled) if (!next[id]) next[id] = now;
  return next;
}

/** Owned definitions of one kind, best first. */
export function ownedOfKind(owned: Record<string, string>, kind: CosmeticKind): CosmeticDef[] {
  return Object.keys(owned)
    .map((id) => cosmeticById.get(id))
    .filter((c): c is CosmeticDef => !!c && c.kind === kind)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

/** Owned ids the player has not looked at in the locker yet. */
export function unseenOwnedIds(c: CosmeticsState): string[] {
  const seen = new Set(c.seen ?? []);
  return Object.keys(c.owned).filter((id) => cosmeticById.has(id) && !seen.has(id));
}

/** Mark ids as seen (idempotent). */
export function markSeen(c: CosmeticsState, ids: string[]): CosmeticsState {
  const seen = new Set(c.seen ?? []);
  let changed = false;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  return changed ? { ...c, seen: [...seen] } : c;
}

/**
 * Which catalog items the locker LISTS for this player: everything owned, plus
 * the earnable (non-exclusive) items still to unlock. Exclusive items the
 * player does not own are hidden — they cannot be earned any more.
 */
export function lockerItems(owned: Record<string, string>, kind: CosmeticKind): { owned: CosmeticDef[]; locked: CosmeticDef[] } {
  const items = COSMETICS.filter((c) => c.kind === kind);
  return {
    owned: items.filter((c) => owned[c.id]).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
    locked: items.filter((c) => !owned[c.id] && !c.exclusive),
  };
}

export interface ResolvedCosmetics {
  title: CosmeticDef | null;
  banner: CosmeticDef | null;
  badges: CosmeticDef[];
}

/**
 * What the profile SHOWS: an explicit, still-owned choice; otherwise nothing.
 * A choice that is no longer owned (a catalog rename) resolves to empty, never
 * to a broken id.
 */
export function resolveEquipped(c: CosmeticsState): ResolvedCosmetics {
  const pick = (kind: "title" | "banner"): CosmeticDef | null => {
    const chosen = c.equipped[kind];
    if (!chosen || chosen === NONE) return null;
    if (c.owned[chosen] && cosmeticById.get(chosen)?.kind === kind) return cosmeticById.get(chosen)!;
    return null;
  };
  const badges = (c.equipped.badges ?? [])
    .map((id) => cosmeticById.get(id))
    .filter((d): d is CosmeticDef => !!d && d.kind === "badge" && !!c.owned[d.id])
    .slice(0, MAX_BADGES);
  return { title: pick("title"), banner: pick("banner"), badges };
}

/** Flat ids for the cloud row (`equipped_*` columns) — what other players see. */
export function equippedColumns(c: CosmeticsState): {
  equipped_title: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_badges: string[];
} {
  const r = resolveEquipped(c);
  // `equipped_frame` stays in the row shape (the column exists in the v2.0 SQL)
  // but frames are gone (rc.3): always null.
  return {
    equipped_title: r.title?.id ?? null,
    equipped_frame: null,
    equipped_banner: r.banner?.id ?? null,
    equipped_badges: r.badges.map((b) => b.id),
  };
}

/** Validate an explicit selection (the locker UI): only owned ids of the kind. */
export function sanitizeEquipped(owned: Record<string, string>, e: EquippedState): EquippedState {
  const ok = (id: string | null | undefined, kind: CosmeticKind): string | null =>
    id === null || id === undefined || id === NONE ? null : owned[id] && cosmeticById.get(id)?.kind === kind ? id : null;
  return {
    title: ok(e.title, "title"),
    banner: ok(e.banner, "banner"),
    badges:
      e.badges === null || e.badges === undefined
        ? null
        : [...new Set(e.badges)].filter((id) => owned[id] && cosmeticById.get(id)?.kind === "badge").slice(0, MAX_BADGES),
  };
}

/** Merge two cosmetics states (cloud ↔ local): owned = union with the earliest
 *  date; equipped = the local explicit choice, else the cloud's; seen = union. */
export function mergeCosmetics(local: CosmeticsState, cloud: CosmeticsState): CosmeticsState {
  const owned: Record<string, string> = { ...local.owned };
  for (const [id, date] of Object.entries(cloud.owned)) owned[id] = owned[id] ? (owned[id] < date ? owned[id] : date) : date;
  const e = (k: "title" | "banner") => local.equipped[k] ?? cloud.equipped[k] ?? null;
  return sanitizeEquippedState({
    owned,
    equipped: {
      title: e("title"),
      banner: e("banner"),
      badges: local.equipped.badges ?? cloud.equipped.badges ?? null,
    },
    seen: [...new Set([...(local.seen ?? []), ...(cloud.seen ?? [])])],
  });
}

function sanitizeEquippedState(c: CosmeticsState): CosmeticsState {
  return { owned: c.owned, equipped: sanitizeEquipped(c.owned, c.equipped), seen: c.seen ?? [] };
}

/** The cosmetics a leaderboard row shows (ids straight from the view). */
export function rowCosmetics(row: {
  equipped_title: string | null;
  equipped_banner: string | null;
  equipped_badges: string[];
}): ResolvedCosmetics {
  const def = (id: string | null | undefined, kind: CosmeticKind): CosmeticDef | null => {
    const d = id ? cosmeticById.get(id) : undefined;
    return d && d.kind === kind ? d : null;
  };
  return {
    title: def(row.equipped_title, "title"),
    banner: def(row.equipped_banner, "banner"),
    badges: row.equipped_badges
      .map((id) => def(id, "badge"))
      .filter((d): d is CosmeticDef => !!d)
      .slice(0, MAX_BADGES),
  };
}
