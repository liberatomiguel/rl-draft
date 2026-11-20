import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RESEARCH_INVITE } from "@/config/research";
import { catalogProblems } from "./analyticsCatalog";
import {
  RESEARCH_INVITE_KEY,
  claimResearchInvite,
  inviteStillOpen,
  isReturningPlayer,
  readResearchRecord,
  resetResearchInviteForTests,
  setResearchStorageForTests,
  settleResearchInvite,
  shouldInvite,
  type ResearchConfig,
  type ResearchSignals,
} from "./researchInvite";

const CFG: ResearchConfig = {
  enabled: true,
  campaign: "test-round",
  minActiveDays: 2,
  minRuns: 10,
  minCareerSeasons: 1,
  firstDayRuns: 25,
  firstDayCareerSeasons: 2,
  maxShows: 2,
};

const VETERAN: ResearchSignals = { activeDays: 5, runsCompleted: 20, careerSeasons: 0 };

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

let store: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  store = memoryStorage();
  setResearchStorageForTests(store);
  resetResearchInviteForTests();
});

afterEach(() => {
  setResearchStorageForTests(undefined);
  resetResearchInviteForTests();
});

describe("who is a returning player", () => {
  it("never a new player", () => {
    expect(isReturningPlayer({ activeDays: 0, runsCompleted: 0, careerSeasons: 0 }, CFG)).toBe(false);
    expect(isReturningPlayer({ activeDays: 1, runsCompleted: 1, careerSeasons: 0 }, CFG)).toBe(false);
  });

  it("on the first day, only a heavy session", () => {
    expect(isReturningPlayer({ activeDays: 1, runsCompleted: 24, careerSeasons: 1 }, CFG)).toBe(false);
    expect(isReturningPlayer({ activeDays: 1, runsCompleted: 25, careerSeasons: 0 }, CFG)).toBe(true);
    expect(isReturningPlayer({ activeDays: 1, runsCompleted: 0, careerSeasons: 2 }, CFG)).toBe(true);
  });

  it("not someone who came back but barely played", () => {
    expect(isReturningPlayer({ activeDays: 12, runsCompleted: 9, careerSeasons: 0 }, CFG)).toBe(false);
  });

  it("a draft regular from the second day: enough runs", () => {
    expect(isReturningPlayer({ activeDays: 2, runsCompleted: 10, careerSeasons: 0 }, CFG)).toBe(true);
  });

  it("a career regular from the second day: a finished season, with few draft runs", () => {
    expect(isReturningPlayer({ activeDays: 2, runsCompleted: 0, careerSeasons: 1 }, CFG)).toBe(true);
  });

  it("the shipped thresholds: the regular bar opens on day 2, day 1 needs more", () => {
    expect(RESEARCH_INVITE.minActiveDays).toBe(2);
    expect(RESEARCH_INVITE.firstDayRuns).toBeGreaterThan(RESEARCH_INVITE.minRuns);
    expect(RESEARCH_INVITE.firstDayCareerSeasons).toBeGreaterThan(RESEARCH_INVITE.minCareerSeasons);
    expect(isReturningPlayer({ activeDays: 1, runsCompleted: RESEARCH_INVITE.minRuns, careerSeasons: 1 })).toBe(false);
  });

  it("the master switch hides it from everyone", () => {
    expect(shouldInvite(VETERAN, null, { ...CFG, enabled: false })).toBe(false);
  });
});

describe("once per player", () => {
  it("opens once per page load, and counts the show", () => {
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    expect(claimResearchInvite(VETERAN, CFG)).toBe(false);
    expect(readResearchRecord()).toEqual({ campaign: "test-round", shows: 1, outcome: null });
  });

  it("never asks a player who is not eligible, and stores nothing for them", () => {
    expect(claimResearchInvite({ activeDays: 1, runsCompleted: 2, careerSeasons: 0 }, CFG)).toBe(false);
    expect(store.map.has(RESEARCH_INVITE_KEY)).toBe(false);
  });

  it("never again after a dismiss, even on a later visit", () => {
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    settleResearchInvite("dismissed", CFG);
    resetResearchInviteForTests(); // a new page load: memory gone, storage kept
    expect(claimResearchInvite(VETERAN, CFG)).toBe(false);
    expect(readResearchRecord()?.outcome).toBe("dismissed");
  });

  it("never again after the link is opened; the first answer stands", () => {
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    settleResearchInvite("opened", CFG);
    settleResearchInvite("dismissed", CFG); // the close that follows the click
    resetResearchInviteForTests();
    expect(claimResearchInvite(VETERAN, CFG)).toBe(false);
    expect(readResearchRecord()?.outcome).toBe("opened");
  });

  it("an unanswered card (tab closed) may come back, up to maxShows", () => {
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    resetResearchInviteForTests();
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    resetResearchInviteForTests();
    expect(claimResearchInvite(VETERAN, CFG)).toBe(false);
    expect(readResearchRecord()?.shows).toBe(2);
  });

  it("a new campaign asks again; an old campaign's answer does not carry over", () => {
    store.setItem(RESEARCH_INVITE_KEY, JSON.stringify({ campaign: "old-round", shows: 1, outcome: "dismissed" }));
    expect(inviteStillOpen(readResearchRecord(), CFG)).toBe(true);
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    expect(readResearchRecord()).toEqual({ campaign: "test-round", shows: 1, outcome: null });
  });

  it("a damaged record reads as none", () => {
    store.setItem(RESEARCH_INVITE_KEY, "{not json");
    expect(readResearchRecord()).toBeNull();
    store.setItem(RESEARCH_INVITE_KEY, JSON.stringify({ campaign: "test-round", shows: "x", outcome: "maybe" }));
    expect(readResearchRecord()).toEqual({ campaign: "test-round", shows: 0, outcome: null });
  });

  it("without storage it still asks only once in the tab", () => {
    setResearchStorageForTests(null);
    expect(claimResearchInvite(VETERAN, CFG)).toBe(true);
    settleResearchInvite("dismissed", CFG);
    expect(readResearchRecord()?.outcome).toBe("dismissed");
    expect(claimResearchInvite(VETERAN, CFG)).toBe(false);
  });
});

describe("analytics", () => {
  it("the three actions match the catalogue", () => {
    for (const action of ["shown", "opened", "dismissed"]) {
      for (const surface of ["draft", "career"]) {
        expect(
          catalogProblems("research_invite", {
            gameMode: surface,
            action,
            surface,
            campaign: RESEARCH_INVITE.campaign,
            activeDays: 4,
            runsCompleted: 12,
            careerSeasons: 0,
          }),
        ).toEqual([]);
      }
    }
  });
});
