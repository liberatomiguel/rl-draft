/**
 * The PROFILE scope of the "New" markers (rc.33, COL-02c; the model is
 * `./newItems`). Dataset-free on purpose — the nav and the home read it on every
 * page (#142): it needs the profile's own facts plus the light challenge
 * catalog, never `@/data`.
 *
 * Items of this scope (kind → what makes it available):
 * - `sp:<specialId>` — a special card in the collection, national cards included;
 * - `nt:<lineupId>` — a national team the player found in a draft (its album page);
 * - `ch:<challengeId>` — a challenge open to the player (unlocked or cleared).
 * Cosmetics keep their own seen list (`cosmetics.seen`, the locker dots); the
 * profile's dot reads it through `unseenOwnedIds`.
 */

import { challenges } from "@/data/catalog";
import { isNationalSpecialId } from "@/data/counts";
import { challengeStatus } from "./challengeStars";
import { itemKey, keyId, keyKind, newKeys, type SeenState } from "./newItems";

export const NEW_KIND = {
  special: "sp",
  nationalTeam: "nt",
  challenge: "ch",
} as const;

/** What the profile scope reads (a subset of the profile store's state). */
export interface ProfileNewFacts {
  unlockedSpecials: Record<string, string>;
  /** National lineup id → ISO date found (rc.33). Missing on older saves. */
  nationalDiscovered?: Record<string, string>;
  xp: number;
  challengesCompleted: Record<string, string>;
}

export const specialKey = (id: string): string => itemKey(NEW_KIND.special, id);
export const nationalTeamKey = (lineupId: string): string => itemKey(NEW_KIND.nationalTeam, lineupId);
export const challengeKey = (id: string): string => itemKey(NEW_KIND.challenge, id);

/** Every key the profile can show right now. */
export function profileAvailableKeys(p: ProfileNewFacts): string[] {
  const keys: string[] = [];
  for (const id of Object.keys(p.unlockedSpecials ?? {})) keys.push(specialKey(id));
  for (const id of Object.keys(p.nationalDiscovered ?? {})) keys.push(nationalTeamKey(id));
  for (const ch of challenges) {
    if (challengeStatus(ch, p.xp ?? 0, p.challengesCompleted ?? {}) !== "locked") keys.push(challengeKey(ch.id));
  }
  return keys;
}

/** The new items of the profile, split by where they show. */
export interface ProfileNewSummary {
  /** Every new key (for `isNew`). */
  keys: ReadonlySet<string>;
  /** New special cards of the special-card album (national cards excluded). */
  specials: string[];
  /** New national cards (`nt-…` special ids). */
  nationalCards: string[];
  /** National lineups found and not opened yet. */
  nationalTeams: string[];
  /** Challenges opened to the player and not opened yet. */
  challenges: string[];
}

export function profileNewSummary(state: SeenState | undefined, p: ProfileNewFacts): ProfileNewSummary {
  const keys = newKeys(state, profileAvailableKeys(p));
  const out: ProfileNewSummary = {
    keys: new Set(keys),
    specials: [],
    nationalCards: [],
    nationalTeams: [],
    challenges: [],
  };
  for (const key of keys) {
    const id = keyId(key);
    switch (keyKind(key)) {
      case NEW_KIND.special:
        (isNationalSpecialId(id) ? out.nationalCards : out.specials).push(id);
        break;
      case NEW_KIND.nationalTeam:
        out.nationalTeams.push(id);
        break;
      case NEW_KIND.challenge:
        out.challenges.push(id);
        break;
    }
  }
  return out;
}

/** One dot per destination (nav items, home tiles). */
export interface NewDots {
  /** Special cards, national cards or national team pages not opened yet. */
  collection: boolean;
  /** Challenges opened to the player whose briefing is not read yet. */
  challenges: boolean;
  /** Owned cosmetics not looked at in the locker yet (the rc.2 locker dots). */
  profile: boolean;
}

/**
 * The dots outside, from the SAME summary as the tags inside — so a dot always
 * has a tag behind it and a tag always shows its dot. A destination the player
 * cannot open yet (the rank-gated collection and challenges) never shows one.
 */
export function newDotsOf(
  s: ProfileNewSummary,
  gates: { collectionOpen: boolean; challengesOpen: boolean; unseenCosmetics: number; cosmeticsOn: boolean },
): NewDots {
  return {
    collection: gates.collectionOpen && s.specials.length + s.nationalCards.length + s.nationalTeams.length > 0,
    challenges: gates.challengesOpen && s.challenges.length > 0,
    profile: gates.cosmeticsOn && gates.unseenCosmetics > 0,
  };
}

export const EMPTY_PROFILE_NEW: ProfileNewSummary = {
  keys: new Set(),
  specials: [],
  nationalCards: [],
  nationalTeams: [],
  challenges: [],
};
