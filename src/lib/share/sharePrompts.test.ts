import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHARE_PROMPTS } from "@/config/balance";
import { EN } from "@/content/copy.en";
import { PT } from "@/content/copy.pt";
import {
  EMPTY_SHARE_PROMPTS,
  SHARE_PROMPTS_KEY,
  careerTitlePrompts,
  claimImagePrompt,
  claimInvitePrompt,
  imageDue,
  inviteDue,
  onTitle,
  optOutImagePrompt,
  readSharePrompts,
  resetSharePromptsForTests,
  setSharePromptStorageForTests,
  type InviteSignals,
  type SharePromptRecord,
} from "./sharePrompts";
import { inviteContextOf, inviteMessage, playsCareer } from "./inviteText";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-11-27T12:00:00Z");

function memStore(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const goodRun: InviteSignals = { activeDays: 3, runsCompleted: 8, careerSeasons: 0, moment: "run", placement: "champion", ordinaryRun: true };

describe("the invite prompt (once, at a good moment)", () => {
  it("never on the first day, never before a few runs, never after a bad run", () => {
    expect(inviteDue(goodRun, EMPTY_SHARE_PROMPTS, false)).toBe(true);
    expect(inviteDue({ ...goodRun, activeDays: 1 }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
    expect(inviteDue({ ...goodRun, runsCompleted: SHARE_PROMPTS.invite.minRuns - 1 }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
    expect(inviteDue({ ...goodRun, placement: "swiss_exit" }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
    expect(inviteDue({ ...goodRun, placement: "top8" }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
    expect(inviteDue({ ...goodRun, ordinaryRun: false }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
  });

  it("a career season's end counts once a season is done", () => {
    const season: InviteSignals = { activeDays: 2, runsCompleted: 0, careerSeasons: 1, moment: "season" };
    expect(inviteDue(season, EMPTY_SHARE_PROMPTS, false)).toBe(true);
    expect(inviteDue({ ...season, careerSeasons: 0 }, EMPTY_SHARE_PROMPTS, false)).toBe(false);
  });

  it("once shown, never again; and never in a session that already prompted", () => {
    expect(inviteDue(goodRun, { ...EMPTY_SHARE_PROMPTS, inviteShownAt: "2026-01-01T00:00:00Z" }, false)).toBe(false);
    expect(inviteDue(goodRun, EMPTY_SHARE_PROMPTS, true)).toBe(false);
  });
});

describe("the share-image prompt (sparse)", () => {
  const titles = (n: number, start: SharePromptRecord = EMPTY_SHARE_PROMPTS, step = DAY * 3) => {
    let r = start;
    const shown: number[] = [];
    for (let i = 0; i < n; i++) {
      const out = onTitle(r, `run-${i}`, T0 + i * step, false);
      r = out.record;
      if (out.show) shown.push(i);
    }
    return { r, shown };
  };

  it("never on the very first title", () => {
    expect(onTitle(EMPTY_SHARE_PROMPTS, "a", T0, false).show).toBe(false);
    expect(titles(2).shown).toEqual([1]);
  });

  it("never on two consecutive titles", () => {
    const { shown } = titles(40, EMPTY_SHARE_PROMPTS, DAY * 30);
    for (let i = 1; i < shown.length; i++) expect(shown[i] - shown[i - 1]).toBeGreaterThan(1);
  });

  it("waits the cooldown between two prompts", () => {
    // A title a day: the gaps between prompts are at least the cooldown.
    const { shown } = titles(60, EMPTY_SHARE_PROMPTS, DAY);
    for (let i = 1; i < shown.length; i++) expect(shown[i] - shown[i - 1]).toBeGreaterThanOrEqual(SHARE_PROMPTS.image.cooldownDays);
  });

  it("stops at the cap", () => {
    expect(titles(500, EMPTY_SHARE_PROMPTS, DAY * 30).shown).toHaveLength(SHARE_PROMPTS.image.maxShows);
  });

  it("honours Don't show again, and never twice in a session", () => {
    const due = { ...EMPTY_SHARE_PROMPTS, titlesSince: 5 };
    expect(imageDue(due, T0, false)).toBe(true);
    expect(imageDue({ ...due, imageOptOut: true }, T0, false)).toBe(false);
    expect(imageDue(due, T0, true)).toBe(false);
  });

  it("the same title (a remount of the results) is counted once", () => {
    const first = onTitle(EMPTY_SHARE_PROMPTS, "same", T0, false).record;
    expect(onTitle(first, "same", T0 + DAY, false).record).toBe(first);
  });

  it("career cups and qualifiers do not prompt; regionals, Majors and the Worlds may", () => {
    expect(careerTitlePrompts("t3")).toBe(false);
    expect(careerTitlePrompts("qualifier")).toBe(false);
    expect(careerTitlePrompts(null)).toBe(false);
    expect(careerTitlePrompts("regional")).toBe(true);
    expect(careerTitlePrompts("worlds")).toBe(true);
  });
});

describe("the prompts' record", () => {
  let local: ReturnType<typeof memStore>;
  let session: ReturnType<typeof memStore>;
  beforeEach(() => {
    local = memStore();
    session = memStore();
    setSharePromptStorageForTests({ local, session });
    resetSharePromptsForTests();
  });
  afterEach(() => {
    setSharePromptStorageForTests(undefined);
    resetSharePromptsForTests();
  });

  it("one prompt per session across both kinds, and the invite once ever", () => {
    expect(claimImagePrompt("t1", T0)).toBe(false); // first title: counted, no prompt
    expect(claimImagePrompt("t2", T0 + DAY)).toBe(true);
    expect(claimInvitePrompt(goodRun, T0 + DAY)).toBe(false); // same session
    resetSharePromptsForTests();
    session.data.clear(); // a new session
    expect(claimInvitePrompt(goodRun, T0 + 2 * DAY)).toBe(true);
    resetSharePromptsForTests();
    session.data.clear();
    expect(claimInvitePrompt(goodRun, T0 + 30 * DAY)).toBe(false);
  });

  it("Don't show again is stored", () => {
    optOutImagePrompt();
    expect(JSON.parse(local.data.get(SHARE_PROMPTS_KEY)!).imageOptOut).toBe(true);
    expect(claimImagePrompt("x", T0)).toBe(false);
  });

  it("a broken or blocked storage never throws and never re-asks in the same load", () => {
    local.data.set(SHARE_PROMPTS_KEY, "{not json");
    expect(readSharePrompts()).toEqual(EMPTY_SHARE_PROMPTS);
    setSharePromptStorageForTests({ local: null, session: null });
    expect(claimInvitePrompt(goodRun, T0)).toBe(true);
    expect(claimInvitePrompt(goodRun, T0)).toBe(false);
  });
});

describe("the invitation's words", () => {
  it("picks the message by context", () => {
    expect(inviteContextOf({ justWon: true, playsCareer: true })).toBe("won");
    expect(inviteContextOf({ playsCareer: true })).toBe("career");
    expect(inviteContextOf({ playsCareer: false })).toBe("draft");
    expect(playsCareer(["run-lock-sam", "share-first"], false)).toBe(false);
    expect(playsCareer(["first-signing"], false)).toBe(true);
    expect(playsCareer([], true)).toBe(true);
  });

  it("reads like a person: first person, one sentence or two, no exclamation stack", () => {
    for (const S of [EN.SHARE_UI, PT.SHARE_UI]) {
      for (const ctx of ["won", "career", "draft"] as const) {
        const msg = inviteMessage(ctx, S);
        expect(msg.length).toBeLessThan(180);
        expect((msg.match(/!/g) ?? []).length).toBeLessThanOrEqual(1);
        expect(msg).not.toMatch(/—|ultimate|revolution|definitivo/i);
      }
    }
    expect(inviteMessage("draft", EN.SHARE_UI)).toMatch(/^I/);
  });
});
