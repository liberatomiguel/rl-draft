/**
 * Road to Worlds v2.0 (R40 review) — the HQ / calendar / top-bar previews of
 * the weekend (careerUi): the next-stop list around a two-day event, the
 * week agenda after a mid-week seeding drift, and the top bar's Continue
 * while the event screen is still revealing Saturday. Driven through the
 * REAL career flow; results are forced by roster strength, never a lucky seed.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import {
  eventDayFor,
  firstDayOfWeek,
  playoffsDayFor,
  qualifierDayFor,
  regionalDayFor,
  seasonSchedule,
} from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import {
  advanceDayFlow,
  createCareerSave,
  eventDayPhaseOf,
  finishEvent,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "@/store/careerFlow";
import {
  agendaDays,
  continueKind,
  isUserEventDef,
  upcomingStops,
  visibleContinueKind,
} from "./careerUi";

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
/** A starter roster outside the direct 8 at the first regional (careerWeekend.test). */
const SEED = 55501;
const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
const MAJOR_W = seasonSchedule().find((w) => w.kind === "major")!.week;

function freshCareer(): CareerSave {
  const save = createCareerSave(INPUT, SEED);
  for (let s = 0; s < 2; s++) {
    for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  }
  save.sponsorOffers = null;
  return save;
}

function advanceTo(input: CareerSave, day: number): CareerSave {
  let save = input;
  let guard = 0;
  while (save.clock.day < day && save.phase === "running" && guard++ < 400) {
    const before = save.clock.day;
    save = advanceDayFlow(save);
    if (save.clock.day === before) break;
  }
  return save;
}

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
    save = advanceDayFlow(save);
    if (save.clock.day === before) throw new Error(`clock blocked on day ${before}`);
  }
  return save;
}

/** The first Major paused after its Saturday Swiss, with the user in the field. */
function pausedMajor(): CareerSave {
  let save = autoPlayTo(freshCareer(), firstDayOfWeek(MAJOR_W) - 1);
  save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 100_000 };
  save = advanceTo(advanceDayFlow(save), eventDayFor(MAJOR_W));
  const lobby = structuredClone(save);
  for (const p of lobby.squad) p.overall = 99;
  return simEventToEnd(startEvent(lobby, true));
}

describe("next stops around a two-day event (R40 review)", { timeout: 30_000 }, () => {
  it("a paused Saturday points at TOMORROW's Championship Sunday; on Sunday the event in progress is today's stop", () => {
    const sat = pausedMajor();
    expect(eventDayPhaseOf(sat)).toBe("paused");
    const def = sat.activeEvent!.def;
    const [first] = upcomingStops(sat, 3);
    expect(first).toMatchObject({ kind: "event", day: playoffsDayFor(def), daysAway: 1 });
    expect(first.event?.id).toBe(def.id);

    const sun = advanceDayFlow(sat);
    expect(eventDayPhaseOf(sun)).toBe("playoffs");
    const stops = upcomingStops(sun, 3);
    expect(stops[0]).toMatchObject({ kind: "event", day: sun.clock.day, daysAway: 0 });
    expect(stops[0].event?.id).toBe(def.id);
    expect(stops.filter((s) => s.event?.id === def.id)).toHaveLength(1);
  });

  it("the top bar keeps the event's Continue while Saturday is still being revealed", () => {
    const sat = pausedMajor();
    const id = sat.activeEvent!.def.id;
    expect(continueKind(sat)).toBe("eventPaused");
    expect(visibleContinueKind(sat, null)).toBe("eventPaused");
    expect(visibleContinueKind(sat, id)).toBe("event");
    expect(visibleContinueKind(sat, "some-other-event")).toBe("eventPaused");
    // On Sunday the hold no longer matters (nothing is paused).
    const sun = advanceDayFlow(sat);
    expect(visibleContinueKind(sun, id)).toBe(continueKind(sun));
  });
});

describe("the week agenda follows the commit (R40 review)", () => {
  it("a direct user who drifts out of the 8: Saturday reads rest, the next stop is Sunday's regional", () => {
    let save = advanceTo(freshCareer(), firstDayOfWeek(W) - 1);
    save.competition.splitPoints.SAM = { ...save.competition.splitPoints.SAM, user: 10_000 };
    save = advanceDayFlow(save); // Monday commit: direct
    const regional = save.pendingEventDef!;
    delete save.competition.splitPoints.SAM.user; // drift out of the direct 8
    const week = agendaDays(save, firstDayOfWeek(W), 7);
    const saturday = week.find((d) => d.day === qualifierDayFor(W))!;
    const sunday = week.find((d) => d.day === regionalDayFor(W))!;
    expect(saturday.event).toBeNull();
    expect(saturday.kinds).toContain("rest");
    expect(sunday.event?.id).toBe(regional.id);
    expect(sunday.kinds).toContain("matchday");
    const firstEvent = upcomingStops(save, 4).find((s) => s.kind === "event");
    expect(firstEvent?.event?.id).toBe(regional.id);
    expect(isUserEventDef(save, regional)).toBe(true);
  });
});
