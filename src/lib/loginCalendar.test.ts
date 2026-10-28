/**
 * rc.29 (E2E DRAFT-03): the login calendar (open on a cold home) draws reward
 * art in full only for today and the next milestone day.
 */

import { describe, expect, it } from "vitest";
import { LOGIN_STREAK } from "@/config/balance";
import { loginCalendarFocus } from "./loginCalendar";

const milestones = Object.keys(LOGIN_STREAK.milestoneBonus)
  .map(Number)
  .sort((a, b) => a - b);

describe("loginCalendarFocus", () => {
  it("day 1: today and the first milestone, nothing else", () => {
    const f = loginCalendarFocus(1);
    expect(f.today).toBe(1);
    expect(f.nextRewardDay).toBe(milestones[0]);
    expect([...f.artDays].sort((a, b) => a - b)).toEqual([1, milestones[0]]);
    expect(f.complete).toBe(false);
  });

  it("on a milestone day the next milestone is the following one", () => {
    const [first, second] = milestones;
    const f = loginCalendarFocus(first);
    expect(f.today).toBe(first);
    expect(f.nextRewardDay).toBe(second);
    expect(f.artDays.size).toBe(2);
  });

  it("never more than two days with art, at any point of the cycle", () => {
    for (let streak = 1; streak <= LOGIN_STREAK.cycleDays + 5; streak += 1) {
      const f = loginCalendarFocus(streak);
      expect(f.artDays.size, `streak ${streak}`).toBeLessThanOrEqual(2);
      expect(f.artDays.has(f.today)).toBe(true);
      if (f.nextRewardDay !== null) {
        expect(f.nextRewardDay).toBeGreaterThan(f.today);
        expect(LOGIN_STREAK.milestoneBonus[f.nextRewardDay]).toBeDefined();
        // No milestone is skipped between today and the next one.
        expect(milestones.some((d) => d > f.today && d < f.nextRewardDay!)).toBe(false);
      }
    }
  });

  it("past the cycle: today caps at the last day, no next reward, complete", () => {
    const f = loginCalendarFocus(LOGIN_STREAK.cycleDays + 7);
    expect(f.today).toBe(LOGIN_STREAK.cycleDays);
    expect(f.nextRewardDay).toBeNull();
    expect(f.complete).toBe(true);
    expect([...f.artDays]).toEqual([LOGIN_STREAK.cycleDays]);
  });
});
