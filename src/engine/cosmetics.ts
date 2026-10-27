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
 *
 * rc.4: the FIRST equipped badge is the FEATURED one (shown larger on the
 * profile hero and first on leaderboard rows) — order is the choice, so the
 * cloud row shape (`equipped_badges: string[]`) did not change. Rewards whose
 * facts are season-scoped (the season track, Dynasty) are kept once earned:
 * `refreshOwned` never drops them when the season moves on.
 *
 * rc.20: the facts also carry the Season 1 counters (runs won / finished since
 * the reset, the Legacy win streak, specials collected since the reset, the
 * challenges with all three stars) that the final title / banner set reads.
 * `newlyOwnedIds` is what the unlock pop-up announces.
 */

import { FEATURES, RANKS } from "@/config/balance";
import { isNationalSpecialId } from "@/data/counts";
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
/** Badges shown at once (profile card + leaderboard row). The first is featured. */
export const MAX_BADGES = 3;

/** `owned` date marking an item only the preview switch grants (dev / staging). */
const PREVIEW_DATE = "preview";

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
  /** rc.4: tournament runs won, lifetime (every difficulty / mode). */
  runsWon?: number;
  /** rc.4: Road to Worlds World Championships won, across saves. */
  careerWorlds?: number;
  /** rc.4: this season's Legacy runs won and Worlds won (Dynasty). */
  seasonLegacyTitles?: number;
  seasonCareerWorlds?: number;
  /** rc.20: runs won / finished since the Season 1 reset (the pre-season
   *  snapshot subtracted; a fresh account counts everything). */
  runsWonSinceS1?: number;
  runsFinishedSinceS1?: number;
  /** rc.20: best run of consecutive Legacy-difficulty titles. */
  legacyStreakBest?: number;
  /** rc.20: different special cards collected since the Season 1 reset. */
  specialsOwned?: number;
  /** rc.20: challenge ids with all three stars. */
  challengePerfect?: string[];
  /** rc.2: preview switch (dev / staging only) — every item counts as owned. */
  previewAll?: boolean;
}

const rankIndex = (id: string): number => Math.max(0, RANKS.findIndex((r) => r.id === id));

/** The facts the cosmetics derivation reads from a profile (v2.0). Counters owned
 *  by later systems (login streak, stars, quiz, missions) are read defensively. */
export function cosmeticFacts(p: {
  legacy?: { preseason: PreseasonSnapshot | null } | null;
  grants?: string[];
  season?: { id: number; peakRankId: string; legacyTitles?: number; careerWorlds?: number } | null;
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
  const wins = (p as { wins?: Record<string, number> }).wins;
  const runsWon = wins ? Object.values(wins).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0) : 0;
  const preseason = p.legacy?.preseason ?? null;
  // rc.20: Season 1 milestones count from the reset on — the snapshot holds what
  // the pre-season had already banked (titles, runs, and when it was frozen).
  const runsWonSinceS1 = Math.max(0, runsWon - (preseason?.titles ?? 0));
  const runsFinishedSinceS1 = Math.max(0, num("runsCompleted") - (preseason?.runsCompleted ?? 0));
  const specialDates = (p as { unlockedSpecials?: Record<string, string> }).unlockedSpecials;
  const since = preseason?.snapshotAt ?? "";
  // National-team cards (v2.0) have their own album — not counted here.
  const specialsOwned = specialDates
    ? Object.entries(specialDates).filter(([id, d]) => !isNationalSpecialId(id) && typeof d === "string" && d >= since).length
    : 0;
  const legacyStreak = (p as { legacyStreak?: { best?: number } }).legacyStreak;
  const challengePerfect = stars ? Object.entries(stars).filter(([, mask]) => (mask & 7) === 7).map(([id]) => id) : [];
  const careerMarks = Array.isArray((p as { careerMarks?: unknown }).careerMarks)
    ? ((p as { careerMarks: unknown[] }).careerMarks.filter((x) => typeof x === "string") as string[])
    : [];
  // Worlds won before rc.4 counted them are floored from the permanent marks.
  const worldsFloor = careerMarks.includes("car-three-worlds") ? 3 : careerMarks.includes("car-first-worlds") ? 1 : 0;
  return {
    preseason: p.legacy?.preseason ?? null,
    grants: p.grants ?? [],
    seasonId: p.season?.id ?? 0,
    seasonPeakRankId: p.season?.peakRankId ?? "unranked",
    loginBestStreak: login?.best ?? num("loginBestStreak"),
    challengeStars: stars ? Object.values(stars).reduce((n, mask) => n + countBits(mask), 0) : 0,
    quizSolved: quiz?.solved ?? 0,
    missionsCompleted: missions?.completedTotal ?? 0,
    careerMarks,
    runsWon,
    runsWonSinceS1,
    runsFinishedSinceS1,
    legacyStreakBest: legacyStreak?.best ?? 0,
    specialsOwned,
    challengePerfect,
    careerWorlds: Math.max(num("careerWorldsWon"), worldsFloor),
    seasonLegacyTitles: p.season?.legacyTitles ?? 0,
    seasonCareerWorlds: p.season?.careerWorlds ?? 0,
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
    case "legacy-rank": {
      if (!f.preseason || f.preseason.runsCompleted <= 0) return false;
      const peak = rankIndex(f.preseason.rankId);
      const want = rankIndex(source.rankId);
      return source.exact ? peak === want : peak >= want;
    }
    case "legacy-position": {
      const pos = f.preseason?.position;
      return !!pos && pos >= source.minPosition && pos <= source.maxPosition;
    }
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
    case "runs-won":
      return (f.runsWon ?? 0) >= source.count;
    case "runs-won-since-s1":
      return (f.runsWonSinceS1 ?? 0) >= source.count;
    case "runs-finished-since-s1":
      return (f.runsFinishedSinceS1 ?? 0) >= source.count;
    case "legacy-streak":
      return (f.legacyStreakBest ?? 0) >= source.count;
    case "specials-owned":
      return (f.specialsOwned ?? 0) >= source.count;
    case "challenge-perfect":
      return (f.challengePerfect ?? []).includes(source.challengeId);
    case "career-mark":
      return (f.careerMarks ?? []).includes(source.markId);
    case "career-worlds":
      return (f.careerWorlds ?? 0) >= source.count;
    case "season-feat":
      return (
        rankIndex(f.seasonPeakRankId) >= rankIndex(source.rankId) &&
        (f.seasonCareerWorlds ?? 0) >= source.careerWorlds &&
        (f.seasonLegacyTitles ?? 0) >= source.legacyTitles
      );
  }
}

/** Sources whose facts reset with the season: once earned, the item stays. */
function keptOnceOwned(source: CosmeticSource): boolean {
  return source.type === "season-rank" || source.type === "season-feat";
}

/** Pre-season rewards (the recap lists them; the locker hides the unowned). */
export function isLegacyReward(def: CosmeticDef): boolean {
  return def.source.type === "legacy-participation" || def.source.type === "legacy-rank" || def.source.type === "legacy-position";
}

/**
 * rc.4: rewards the locker never teases while locked — exclusives (pre-season,
 * grants) and Dynasty (it has its own story). Everything earned by playing
 * (streaks, stars, runs, quiz, missions, career, challenges and — rc.20 — the
 * Season 1 rank track) shows as a locked placeholder.
 */
export function isTeasedWhenLocked(def: CosmeticDef): boolean {
  if (def.exclusive) return false;
  const t = def.source.type;
  if (t === "season-feat") return false;
  // Road to Worlds rewards only tease where the mode is playable.
  if ((t === "career-mark" || t === "career-worlds") && !FEATURES.careerMode) return false;
  return true;
}

/** Ids the facts entitle the player to (catalog order). */
export function deriveOwnedIds(f: CosmeticFacts): string[] {
  if (f.previewAll) return COSMETICS.map((c) => c.id);
  return COSMETICS.filter((c) => sourceSatisfied(c.source, f)).map((c) => c.id);
}

/**
 * Refresh the owned map: newly earned ids get `now`, known ids keep their date,
 * and ids that are no longer in the catalog are dropped. A known id the facts
 * no longer entitle is dropped too (a stale id must not linger), EXCEPT a
 * season-scoped reward (`keptOnceOwned`): its facts reset with the season, the
 * reward does not. Preview ownership (dev switch) is transient: those ids carry
 * the PREVIEW date and go away when the switch is off (or take a real date
 * once actually earned).
 */
export function refreshOwned(
  owned: Record<string, string>,
  f: CosmeticFacts,
  now = new Date().toISOString(),
): Record<string, string> {
  const earned = new Set(deriveOwnedIds({ ...f, previewAll: false }));
  const next: Record<string, string> = {};
  for (const [id, date] of Object.entries(owned)) {
    const def = cosmeticById.get(id);
    if (!def) continue;
    if (earned.has(id)) next[id] = date === PREVIEW_DATE ? now : date;
    else if (date !== PREVIEW_DATE && keptOnceOwned(def.source)) next[id] = date;
  }
  for (const id of earned) if (!next[id]) next[id] = now;
  if (f.previewAll) for (const c of COSMETICS) if (!next[c.id]) next[c.id] = PREVIEW_DATE;
  return next;
}

/** rc.20: ids owned in `next` that `prev` did not have (real unlocks only — the
 *  preview switch's transient ids are never announced). Feeds the unlock pop-up. */
export function newlyOwnedIds(prev: Record<string, string>, next: Record<string, string>): string[] {
  return Object.keys(next).filter((id) => !prev[id] && next[id] !== PREVIEW_DATE && cosmeticById.has(id));
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

/** rc.6: locker order — rarity first (legendary → common), then the item's
 *  family, then the catalog priority (e.g. the higher rank first). */
const TIER_ORDER: CosmeticDef["tier"][] = ["legend", "epic", "rare", "uncommon", "common"];
const GROUP_ORDER: CosmeticSource["type"][] = [
  "legacy-position", // pre-season board (rating)
  "legacy-rank", // pre-season peak rank
  "season-rank",
  "legacy-participation",
  "grant", // manual
  "season-feat", // Dynasty
  "career-worlds",
  "career-mark",
  "challenge-perfect",
  "legacy-streak",
  "runs-won",
  "runs-won-since-s1",
  "runs-finished-since-s1",
  "specials-owned",
  "challenge-stars",
  "quiz-solved",
  "missions-completed",
  "login-streak",
];

export function compareForLocker(a: CosmeticDef, b: CosmeticDef): number {
  return (
    TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
    GROUP_ORDER.indexOf(a.source.type) - GROUP_ORDER.indexOf(b.source.type) ||
    b.priority - a.priority ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Which catalog items the locker LISTS for this player: everything owned, plus
 * — as anonymous locked slots, never their art or name (rc.4) — the items
 * still to earn by playing (`isTeasedWhenLocked`). Exclusive items, the
 * season track and leaderboard rewards the player does not own are not listed.
 */
export function lockerItems(owned: Record<string, string>, kind: CosmeticKind): { owned: CosmeticDef[]; locked: CosmeticDef[] } {
  const items = COSMETICS.filter((c) => c.kind === kind);
  return {
    owned: items.filter((c) => owned[c.id]).sort(compareForLocker),
    locked: items.filter((c) => !owned[c.id] && isTeasedWhenLocked(c)).sort(compareForLocker),
  };
}

/** Owned-but-unseen ids of one kind (the locker tab dot, the hero slot dot). */
export function unseenOfKind(c: CosmeticsState, kind: CosmeticKind): string[] {
  return unseenOwnedIds(c).filter((id) => cosmeticById.get(id)?.kind === kind);
}

// --- Badge slots (rc.5 locker) ---------------------------------------------
// The equipped list IS the slot order: index 0 is the featured slot. Slots are
// always packed (no holes), so "the first free slot" is the end of the list.

/** Put a badge in the first free slot. Already shown or no free slot → unchanged
 *  (the locker then asks which slot to replace). */
export function addBadge(badges: string[], id: string): string[] {
  if (badges.includes(id) || badges.length >= MAX_BADGES) return badges;
  return [...badges, id];
}

/** Put a badge in slot `index`: a badge already shown elsewhere swaps places
 *  with that slot's badge; a new one replaces it (or fills the first free slot
 *  when `index` is past the end). */
export function placeBadgeAt(badges: string[], index: number, id: string): string[] {
  const from = badges.indexOf(id);
  if (from >= 0) return swapBadges(badges, from, index);
  if (index >= badges.length) return addBadge(badges, id);
  const next = [...badges];
  next[index] = id;
  return next;
}

/** Swap two shown badges (e.g. to move one into the featured slot). An index
 *  past the end moves the badge to the last filled slot. */
export function swapBadges(badges: string[], i: number, j: number): string[] {
  const a = Math.min(i, badges.length - 1);
  const b = Math.min(j, badges.length - 1);
  if (a < 0 || b < 0 || a === b) return badges;
  const next = [...badges];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Take the badge out of slot `index`; the slots behind it close the gap. */
export function removeBadgeAt(badges: string[], index: number): string[] {
  if (index < 0 || index >= badges.length) return badges;
  return badges.filter((_, k) => k !== index);
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
