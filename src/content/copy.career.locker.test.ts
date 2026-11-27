/** v2.3 LOCKER: EN and PT keyed identically; every template the flow mails or the engine names exists. */
import { describe, expect, it } from "vitest";
import { CAREER_LOCKER_EN } from "./copy.career.locker.en";
import { CAREER_LOCKER_PT } from "./copy.career.locker.pt";
import { CAREER_EN } from "./copy.career.en";
import { CAREER_PT } from "./copy.career.pt";

function keysOf(o: unknown, prefix = ""): string[] {
  if (!o || typeof o !== "object") return [prefix];
  return Object.keys(o)
    .sort()
    .flatMap((k) => keysOf((o as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
}

const P = { player: "Zen", n: 3, need: 3, of: 4, answer: "earnIt", topic: "bench", inherited: 0, reason: "listed", changes: "Zen~unhappy|Vatira~content", count: 2 };
const MOODS = ["angry", "unhappy", "neutral", "content", "delighted"];
const REASONS = [
  "bench", "played", "backInSide", "title", "deepRun", "losingRun", "listed", "promiseMade", "promiseKept",
  "promiseBroken", "teammateBroken", "blunt", "refused", "agreedSale", "settling", "inherited",
];
const ANSWERS = ["promiseMinutes", "promiseStay", "earnIt", "focus", "blunt", "sell", "refuse"];
const MAIL = [
  ...["bench", "bid", "request"].flatMap((t) => [`lockerTalk_${t}`, ...[0, 1, 2].map((v) => `lockerTalk_${t}_${v}`)]),
  "lockerTalkAuto", "lockerPromiseKept", "lockerPromiseKept_minutes", "lockerPromiseKept_stay",
  "lockerPromiseBroken", "lockerPromiseBroken_minutes", "lockerPromiseBroken_stay", "lockerMood", "lockerListLater",
];

describe("locker copy", () => {
  it("EN and PT have the same keys and are spread into the career copy", () => {
    expect(keysOf(CAREER_LOCKER_PT)).toEqual(keysOf(CAREER_LOCKER_EN));
    expect(CAREER_EN.locker).toBe(CAREER_LOCKER_EN);
    expect(CAREER_PT.locker).toBe(CAREER_LOCKER_PT);
  });

  it("names every mood, reason and answer, and every mail key renders in both languages", () => {
    for (const C of [CAREER_LOCKER_EN, CAREER_LOCKER_PT]) {
      for (const m of MOODS) expect(C.moods[m]).toBeTruthy();
      for (const r of REASONS) expect(C.reasons[r]).toBeTruthy();
      for (const a of ANSWERS) expect(C.answers[a]?.(P)).toBeTruthy();
      for (const key of MAIL) {
        const text = C.mail.tpl[key]?.(P) ?? C.mail.body[key]?.(P);
        expect(text, key).toBeTruthy();
        expect(text).not.toContain("undefined");
      }
    }
    expect(CAREER_LOCKER_PT.mail.body.lockerMood(P)).toContain("Insatisfeito");
    expect(CAREER_LOCKER_EN.mail.body.lockerMood(P)).toContain("Zen: Unhappy");
  });
});
