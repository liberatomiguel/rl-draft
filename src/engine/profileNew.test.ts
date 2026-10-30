/**
 * The profile scope of the "New" markers (rc.33, COL-02c): which items the
 * profile can show, and where each new one is counted (the nav/tab dots and the
 * tags inside read the same split, so they always agree).
 */

import { describe, expect, it } from "vitest";
import { RANKS } from "@/config/balance";
import { challenges } from "@/data/catalog";
import { NATIONAL_SPECIAL_PREFIX } from "@/data/counts";
import { challengeStatus } from "./challengeStars";
import { seedSeen } from "./newItems";
import {
  challengeKey,
  nationalTeamKey,
  newDotsOf,
  profileAvailableKeys,
  profileNewSummary,
  specialKey,
  type ProfileNewFacts,
} from "./profileNew";

const DATE = "2026-10-30T00:00:00.000Z";
const minXp = (rankId: string) => RANKS.find((r) => r.id === rankId)!.minXp;

function facts(over: Partial<ProfileNewFacts> = {}): ProfileNewFacts {
  return { unlockedSpecials: {}, nationalDiscovered: {}, xp: 0, challengesCompleted: {}, ...over };
}

describe("profile scope — available items", () => {
  it("owned specials (national cards included), found national teams, open challenges", () => {
    const national = `${NATIONAL_SPECIAL_PREFIX}someone-national-br-fifae-2025`;
    const keys = profileAvailableKeys(
      facts({
        unlockedSpecials: { "sp-a": DATE, [national]: DATE },
        nationalDiscovered: { "national-br-fifae-2025": DATE },
      }),
    );
    expect(keys).toEqual(
      expect.arrayContaining([specialKey("sp-a"), specialKey(national), nationalTeamKey("national-br-fifae-2025")]),
    );
    // Unranked: no challenge is open.
    expect(keys.some((k) => k.startsWith("ch:"))).toBe(false);
  });

  it("a challenge counts once it is open to the player (rank reached), locked ones never", () => {
    const xp = minXp("bronze");
    const keys = profileAvailableKeys(facts({ xp }));
    for (const ch of challenges) {
      const open = challengeStatus(ch, xp, {}) !== "locked";
      expect(keys.includes(challengeKey(ch.id)), ch.id).toBe(open);
    }
    expect(keys.some((k) => k.startsWith("ch:"))).toBe(true);
  });
});

describe("profile scope — dots outside agree with the tags inside", () => {
  const open = { collectionOpen: true, challengesOpen: true, unseenCosmetics: 0, cosmeticsOn: true };

  it("a dot shows exactly when its destination holds a new item", () => {
    const national = `${NATIONAL_SPECIAL_PREFIX}someone-national-br-fifae-2025`;
    const none = profileNewSummary(seedSeen([]), facts());
    expect(newDotsOf(none, open)).toEqual({ collection: false, challenges: false, profile: false });

    const card = profileNewSummary(seedSeen([]), facts({ unlockedSpecials: { [national]: DATE } }));
    expect(newDotsOf(card, open)).toMatchObject({ collection: true, challenges: false });

    const team = profileNewSummary(seedSeen([]), facts({ nationalDiscovered: { "national-br-fifae-2025": DATE } }));
    expect(newDotsOf(team, open).collection).toBe(true);

    const ch = profileNewSummary(seedSeen([]), facts({ xp: minXp("bronze") }));
    expect(newDotsOf(ch, open)).toMatchObject({ collection: false, challenges: true });

    expect(newDotsOf(none, { ...open, unseenCosmetics: 2 }).profile).toBe(true);
  });

  it("a destination the player cannot open yet shows no dot; no cosmetics, no profile dot", () => {
    const s = profileNewSummary(seedSeen([]), facts({ unlockedSpecials: { "sp-a": DATE }, xp: minXp("bronze") }));
    expect(newDotsOf(s, { ...open, collectionOpen: false, challengesOpen: false })).toMatchObject({
      collection: false,
      challenges: false,
    });
    expect(newDotsOf(s, { ...open, unseenCosmetics: 3, cosmeticsOn: false }).profile).toBe(false);
  });
});

describe("profile scope — the split the dots and the tags share", () => {
  it("unseeded: nothing is new", () => {
    const s = profileNewSummary(undefined, facts({ unlockedSpecials: { "sp-a": DATE }, xp: minXp("gold") }));
    expect(s.keys.size).toBe(0);
  });

  it("each new item lands in exactly one bucket", () => {
    const national = `${NATIONAL_SPECIAL_PREFIX}someone-national-br-fifae-2025`;
    const f = facts({
      unlockedSpecials: { "sp-a": DATE, [national]: DATE },
      nationalDiscovered: { "national-br-fifae-2025": DATE },
      xp: minXp("bronze"),
    });
    const s = profileNewSummary(seedSeen([]), f);
    expect(s.specials).toEqual(["sp-a"]);
    expect(s.nationalCards).toEqual([national]);
    expect(s.nationalTeams).toEqual(["national-br-fifae-2025"]);
    expect(s.challenges.length).toBeGreaterThan(0);
    expect(s.keys.size).toBe(s.specials.length + s.nationalCards.length + s.nationalTeams.length + s.challenges.length);
  });
});
