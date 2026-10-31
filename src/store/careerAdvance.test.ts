import { expect, it } from "vitest";
import { advanceDayFlow, createCareerSave, type CreateCareerInput } from "./careerFlow";
import { stepDayForTests, walkPastForTests } from "./careerClockForTests";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Immutable",
    abbrev: "IMM",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object") return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

it("a Monday advance retains an immutable, independently owned prior save", () => {
  let save = createCareerSave(INPUT, 36090);
  for (let guard = 0; save.clock.day < 7 && guard < 20; guard++) save = stepDayForTests(save);
  save = walkPastForTests(save);
  expect(save.clock.day).toBe(7);
  const before = JSON.stringify(save);
  deepFreeze(save);

  const next = advanceDayFlow(save);
  expect(next.clock.day).toBe(8);
  expect(next.finances.ledger.length).toBeGreaterThan(save.finances.ledger.length);
  next.squad[0].overall += 1;
  expect(JSON.stringify(save)).toBe(before);
});
