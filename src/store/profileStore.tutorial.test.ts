/**
 * rc.29 (E2E DRAFT-13): the first-run tour is due only for a brand-new player —
 * one whose first stop was /play (a run already finished) never gets the
 * "Welcome" tour afterwards.
 */

import { describe, expect, it } from "vitest";
import { selectTutorialDue } from "./profileStore";

const flags = (seenTutorial: boolean) => ({
  seenHowToPlay: false,
  seenLegacyIntro: false,
  seenRegionalIntro: false,
  seenTutorial,
  seenSeasonRecap: false,
});

describe("selectTutorialDue", () => {
  it("a new player gets the tour", () => {
    expect(selectTutorialDue({ flags: flags(false), runsCompleted: 0 })).toBe(true);
  });

  it("a player who already finished a run skips it, even if they never saw it", () => {
    expect(selectTutorialDue({ flags: flags(false), runsCompleted: 1 })).toBe(false);
    expect(selectTutorialDue({ flags: flags(false), runsCompleted: 40 })).toBe(false);
  });

  it("seen once, never again", () => {
    expect(selectTutorialDue({ flags: flags(true), runsCompleted: 0 })).toBe(false);
  });
});
