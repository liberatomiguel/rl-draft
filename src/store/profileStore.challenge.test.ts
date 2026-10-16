/**
 * Challenge stars on the profile (v2.0): masks OR in, XP pays only for NEW stars,
 * the clear date is written once, and a repeat with nothing new changes nothing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { CHALLENGE } from "@/config/balance";
import { challenges } from "@/data";
import { STAR_2, STAR_3, STAR_CLEAR, starRewardXp, totalStars } from "@/engine/challenges";
import { useProfileStore } from "./profileStore";

const ch = challenges.find((c) => c.stars)!;

describe("profileStore.recordChallengeResult", () => {
  beforeEach(() => useProfileStore.getState().resetAll());

  it("first clear: clear XP + the new stars' XP, date written, mask stored", () => {
    const s = useProfileStore.getState();
    const mask = STAR_CLEAR | STAR_3;
    const xp = starRewardXp(ch, 0, mask);
    expect(xp).toBe(ch.reward.xp + CHALLENGE.starXp[ch.tier]);
    const fresh = s.recordChallengeResult(ch.id, mask, xp, ch.reward);
    expect(fresh).toBe(mask);
    const after = useProfileStore.getState();
    expect(after.xp).toBe(xp);
    expect(after.lifetime.xp).toBe(xp);
    expect(after.challengeStars[ch.id]).toBe(mask);
    expect(after.challengesCompleted[ch.id]).toBeTruthy();
    expect(totalStars(after.challengeStars)).toBe(2);
  });

  it("a repeat that adds star 2 pays only star 2; a repeat with nothing new is a no-op", () => {
    const s = useProfileStore.getState();
    s.recordChallengeResult(ch.id, STAR_CLEAR | STAR_3, starRewardXp(ch, 0, STAR_CLEAR | STAR_3), ch.reward);
    const date = useProfileStore.getState().challengesCompleted[ch.id];
    const xpBefore = useProfileStore.getState().xp;
    const mask2 = STAR_CLEAR | STAR_2;
    const had = useProfileStore.getState().challengeStars[ch.id];
    const xp2 = starRewardXp(ch, had, mask2);
    expect(xp2).toBe(CHALLENGE.starXp[ch.tier]); // only star 2 is new
    expect(useProfileStore.getState().recordChallengeResult(ch.id, mask2, xp2, ch.reward)).toBe(STAR_2);
    expect(useProfileStore.getState().xp).toBe(xpBefore + xp2);
    expect(useProfileStore.getState().challengeStars[ch.id]).toBe(STAR_CLEAR | STAR_2 | STAR_3);
    expect(useProfileStore.getState().challengesCompleted[ch.id]).toBe(date);
    const snapshot = useProfileStore.getState();
    expect(snapshot.recordChallengeResult(ch.id, STAR_CLEAR, 0, ch.reward)).toBe(0);
    expect(useProfileStore.getState().xp).toBe(xpBefore + xp2);
  });

  it("the Season 1 reset clears stars along with the cleared map", async () => {
    const { normalizeToSeason } = await import("@/engine/season");
    const out = normalizeToSeason({
      xp: 100,
      mmr: 1000,
      runsCompleted: 3,
      wins: { easy: 1, normal: 0, hard: 0, legacy: 0 },
      challengesCompleted: { [ch.id]: "2026-01-01" },
      challengeStars: { [ch.id]: 7 },
    });
    expect(out.challengesCompleted).toEqual({});
    expect(out.challengeStars).toEqual({});
    expect(out.legacy?.preseason?.challengesCleared).toBe(1);
  });
});
