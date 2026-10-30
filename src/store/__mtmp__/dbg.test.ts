import { it } from "vitest";
import { CAREER_DEV, CAREER_LOAN, CAREER_WORLD } from "@/config/balance";
import { firstDayOfWeek } from "@/engine/career/calendar";
import { playerViewById } from "@/engine/career/development";
import type { CareerPlayerView, CareerSave } from "@/engine/career/types";
import { createCareerSave, emptySeatPriceFor, signingPlanFor, weeklyStatementOf, type CreateCareerInput } from "../careerFlow";
import { askPackageFor } from "@/engine/career/market";

const INPUT: CreateCareerInput = {
  identity: { orgName: "Eco Org", abbrev: "ECO", managerName: "Bot", country: "BR", region: "SAM", crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

it("dbg", () => {
  (CAREER_LOAN as unknown as Record<string, unknown>).lockCommitments = true;
  if (process.env.SHIFT0) (CAREER_DEV as unknown as Record<string, unknown>).peakAgeShift = 0;
  if (process.env.NOLIST) (CAREER_WORLD.listingProspects as unknown as Record<string, unknown>).minPotential = null;
  const save: CareerSave = createCareerSave(INPUT, 50_401);
  save.clock.day = firstDayOfWeek(11) + 1;
  for (const p of save.squad) p.salaryPerSplit = 8_000;
  save.finances.loan = { remaining: 6_000 };
  save.finances.loanUsed = true;
  save.reputation = 20;
  save.finances.balance = -weeklyStatementOf(save).net * 10;
  save.squad = save.squad.slice(0, 2);
  save.starterIds = [save.squad[0].id, save.squad[1].id, ""];
  save.finances.balance = -weeklyStatementOf(save).net * 10;
  const fas = save.world.freeAgentIds
    .map((id) => playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world }))
    .filter((v): v is CareerPlayerView => v !== null && v.age >= 13 && Math.round(v.overall) <= 74)
    .sort((a, b) => a.overall - b.overall);
  const fa = fas[0];
  console.log("SEAT", JSON.stringify(emptySeatPriceFor(save, 2)), "ASK", JSON.stringify(askPackageFor(fa, { rep: 20, seasonIndex: 0, difficulty: "normal", careerSeed: save.careerSeed, lengthSeasons: 2 })).slice(0, 200));
  console.log("FA", fa.id, fa.overall, fa.age, fa.potential, fa.peakAge, JSON.stringify(signingPlanFor(save, fa.id, { lengthSeasons: 2 })).slice(0, 400));
});
