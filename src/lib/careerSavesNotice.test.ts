import { afterEach, describe, expect, it } from "vitest";
import { CAREER_SAVES_NOTICE } from "@/config/balance";
import { careerSavesNoticeDue, resetCareerSavesNoticeForTests, settleCareerSavesNotice } from "./careerSavesNotice";

describe("v2.0.34 — the one-off HQ card about several careers and the account copy", () => {
  afterEach(() => resetCareerSavesNoticeForTests());

  it("waits for the opening weeks of a first season, then shows from the next season on", () => {
    expect(careerSavesNoticeDue({ seasonIndex: 0, day: 1 })).toBe(false);
    expect(careerSavesNoticeDue({ seasonIndex: 0, day: CAREER_SAVES_NOTICE.minDay - 1 })).toBe(false);
    expect(careerSavesNoticeDue({ seasonIndex: 0, day: CAREER_SAVES_NOTICE.minDay })).toBe(true);
    expect(careerSavesNoticeDue({ seasonIndex: 2, day: 1 })).toBe(true);
  });

  it("an answer ends it on the device, either way", () => {
    settleCareerSavesNotice("dismissed");
    expect(careerSavesNoticeDue({ seasonIndex: 3, day: 100 })).toBe(false);
    resetCareerSavesNoticeForTests();
    settleCareerSavesNotice("opened");
    expect(careerSavesNoticeDue({ seasonIndex: 3, day: 100 })).toBe(false);
  });
});
