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
  // rc9 LOCKER
  "goodResults", "poorResults", "goodForm", "poorForm", "heavyLoad", "rested", "heard", "passedOver", "madeWay", "sideEvent",
];
const ANSWERS = [
  "promiseMinutes", "promiseStay", "earnIt", "focus", "blunt", "sell", "refuse",
  "lighten", "keepLoad", "pushHim", "holdBack", "enterHim", "passCup", "startHim", "notYet", // rc9 LOCKER
];
const MAIL = [
  ...["bench", "bid", "request", "load", "more", "side", "start"].flatMap((t) => [`lockerTalk_${t}`, ...[0, 1, 2].map((v) => `lockerTalk_${t}_${v}`)]),
  "lockerSwapBack", // rc9 LOCKER
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
      // rc9 LOCKER: the bodies with and without the talk's params (the UI may not pass them), the commits, the chips.
      for (const key of Object.keys(C.mail.body).filter((k) => /^lockerTalk_(load|more|side|start)_|^lockerSwapBack$/.test(k))) {
        for (const params of [{ ...P, sub: "Vatira", size: 2 }, { player: "Zen", sub: "Vatira", n: 3, need: 3, of: 4 }]) {
          const text = C.mail.body[key](params);
          expect(text, key).not.toContain("undefined");
          expect(text, key).not.toMatch(/—/);
        }
      }
      for (const a of ANSWERS) expect(C.ui.commits[a]?.(P), a).toBeTruthy();
      for (const r of REASONS) expect(C.why[r], r).toBeTruthy();
      expect(C.matchLine(0)).toBeTruthy();
      expect(C.matchLine(-0.75)).toContain("0");
    }
    expect(CAREER_LOCKER_PT.mail.body.lockerMood(P)).toContain("Insatisfeito");
    expect(CAREER_LOCKER_EN.mail.body.lockerMood(P)).toContain("Zen: Unhappy");
  });
});
