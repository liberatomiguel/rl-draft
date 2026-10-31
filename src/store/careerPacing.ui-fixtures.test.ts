/** Opt-in browser fixtures, never app imports or player saves. */
import { writeFileSync } from "node:fs";
import { it, expect } from "vitest";
import { createCareerSave, runScrimFlow } from "./careerFlow";

it.skipIf(!process.env.PACING_UI_OUT)("writes a real-scrim HQ fixture with unviewed unlocks and an overdraft", () => {
  let save = createCareerSave({ identity: {
    orgName: "Pacing Test", abbrev: "PCT", managerName: "Tester", country: "BR", region: "SAM",
    crestId: "shield", colors: { primary: "#f97316", secondary: "#102050" }, buffType: "consistency",
  }, difficulty: "normal", rosterKey: "prospects" }, 9191);
  save.flags.seenHub = true;
  save.reputation = 21;
  save.clock.day = 9; // Week 2, Tuesday.
  save = runScrimFlow(save).save;
  save.clock.day = 11; // Thursday, same week.
  save = runScrimFlow(save).save;
  expect(save.scrimLog).toHaveLength(2);
  save.finances.balance = -100;
  writeFileSync(process.env.PACING_UI_OUT!, JSON.stringify(save));
  const unlock = structuredClone(save);
  unlock.reputation = 7;
  unlock.finances.balance = 10_000;
  unlock.pendingInsert = { id: "ins-charity-cup", day: unlock.clock.day };
  writeFileSync(process.env.PACING_UI_OUT!.replace(/\.json$/, "-unlock.json"), JSON.stringify(unlock));
});
