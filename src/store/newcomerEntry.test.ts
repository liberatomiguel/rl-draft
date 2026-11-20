import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileStore } from "./profileStore";
import { useRewardToasts } from "./rewardToastStore";
import { initialLang } from "./settingsStore";

/**
 * v2.0.24: what a brand-new player meets before the game. Launch data (12-16/11):
 * 57% of 903 new players left without playing, 36% of the mobile ones after one
 * page; they had to close the welcome tour, the 2.0 announcement and the login
 * calendar first, and a Portuguese browser still got the English game.
 */
describe("newcomer entry (v2.0.24)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    useProfileStore.getState().resetAll();
    useRewardToasts.setState({ loginModal: null });
  });
  afterEach(() => vi.useRealTimers());

  it("starts in Portuguese only when the browser's first language is Portuguese", () => {
    expect(initialLang(["pt-BR", "en-US"])).toBe("pt");
    expect(initialLang(["pt-PT"])).toBe("pt");
    expect(initialLang(["en-US", "pt-BR"])).toBe("en");
    expect(initialLang(["fr-FR"])).toBe("en");
    expect(initialLang([])).toBe("en");
  });

  it("a newcomer's first login pays its XP without the calendar; the second day opens it", () => {
    const first = useProfileStore.getState().recordLogin();
    expect(first.counted).toBe(true);
    expect(first.xp).toBeGreaterThan(0);
    expect(useProfileStore.getState().xp).toBe(first.xp);
    expect(useRewardToasts.getState().loginModal).toBeNull();

    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    const second = useProfileStore.getState().recordLogin();
    expect(second.counted).toBe(true);
    expect(useRewardToasts.getState().loginModal).toMatchObject({ streak: 2 });
  });

  it("a player who has already played gets the calendar on the first login", () => {
    useProfileStore.setState({ runsCompleted: 3 });
    expect(useProfileStore.getState().recordLogin().counted).toBe(true);
    expect(useRewardToasts.getState().loginModal).toMatchObject({ streak: 1 });
  });
});
