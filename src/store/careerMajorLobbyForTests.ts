/**
 * Test-only (v2.2 event formats): a SAM career walked to its first Major's
 * lobby with the user in the field — the event-format flow test and its
 * screen fixtures start from it.
 */
import { CAREER_CALENDAR } from "@/config/balance";
import { eventDayFor, firstDayOfWeek, seasonSchedule } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { stepDayForTests } from "./careerClockForTests";
import {
  advanceDayFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Test Org",
    abbrev: "TST",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};
const SEED = 55501;
export const MAJOR_WEEK = seasonSchedule().find((w) => w.kind === "major")!.week;

function autoPlayTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 900) {
    const phase = eventDayPhaseOf(save);
    if (phase === "lobby" || phase === "swiss" || phase === "playoffs" || phase === "finished") {
      save = simEventToEnd(phase === "lobby" ? startEvent(save, false) : save);
      if (save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
      continue;
    }
    const before = save.clock.day;
    save = stepDayForTests(save);
    if (save.clock.day === before) throw new Error(`clock blocked on day ${before}`);
  }
  return save;
}

/** The first Major's lobby, the user in the field. */
export function majorLobbyForTests(): CareerSave {
  const fresh = createCareerSave(INPUT, SEED);
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) fresh.flags[`insertRolled:${s}:${w}`] = true;
  }
  fresh.sponsorOffers = null;
  let save = autoPlayTo(fresh, firstDayOfWeek(MAJOR_WEEK) - 1);
  save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
  save = advanceDayFlow(save);
  let guard = 0;
  while (save.clock.day < eventDayFor(MAJOR_WEEK) && guard++ < 20) save = stepDayForTests(save);
  return save;
}
