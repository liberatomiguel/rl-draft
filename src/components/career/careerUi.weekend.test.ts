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
  isEventPaused,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "@/store/careerFlow";
import { stepDayForTests } from "@/store/careerClockForTests";
import { startSundayFlow } from "@/store/careerSunday";
import {
  agendaDays,
  continueKind,
  isUserEventDef,
  persistedRevealHold,
  upcomingStops,
  visibleContinueKind,
} from "./careerUi";
import { initialRevealedRounds, resultsSeenOnMount, roundsOf } from "./event/eventPlayback";

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
    save = stepDayForTests(save); // rc.34: rc.33's walk past cups / invites / bids / offers
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
    save = stepDayForTests(save);
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

    // rc.36 (SUN-01): Saturday evening holds until HQ starts Sunday.
    expect(advanceDayFlow(sat)).toBe(sat);
    const sun = startSundayFlow(sat).save;
    expect(eventDayPhaseOf(sun)).toBe("playoffs");
    const stops = upcomingStops(sun, 3);
    expect(stops[0]).toMatchObject({ kind: "event", day: sun.clock.day, daysAway: 0 });
    expect(stops[0].event?.id).toBe(def.id);
    expect(stops.filter((s) => s.event?.id === def.id)).toHaveLength(1);
  });

  it("the top bar keeps the event's Continue while Saturday is still being revealed", () => {
    const sat = pausedMajor();
    const id = sat.activeEvent!.def.id;
    // rc.36 (SUN-01): the paused Saturday is the Saturday-evening stop ("sunday" → HQ).
    expect(continueKind(sat)).toBe("sunday");
    expect(visibleContinueKind(sat, null)).toBe("sunday");
    expect(visibleContinueKind(sat, id)).toBe("event");
    expect(visibleContinueKind(sat, "some-other-event")).toBe("sunday");
    // On Sunday the hold no longer matters (nothing is paused).
    const sun = startSundayFlow(sat).save;
    expect(visibleContinueKind(sun, id)).toBe(continueKind(sun));
  });

  it("rc.29 (CAR-02): a reload / trip to HQ mid-Saturday keeps the hold from the session cursor until the replay ends", () => {
    const sat = pausedMajor();
    const id = sat.activeEvent!.def.id;
    const saturday = roundsOf(sat.activeEvent!.tournament).length;
    expect(saturday).toBeGreaterThan(2);
    // The deciding round was mid-reveal: the cursor sits one round short.
    expect(persistedRevealHold(sat, saturday - 1)).toBe(id);
    expect(visibleContinueKind(sat, persistedRevealHold(sat, saturday - 1))).toBe("event");
    expect(persistedRevealHold(sat, 0)).toBe(id);
    // Every Saturday round revealed — or no cursor at all (a new tab): no hold.
    expect(persistedRevealHold(sat, saturday)).toBeNull();
    expect(persistedRevealHold(sat, null)).toBeNull();
    expect(persistedRevealHold(sat, undefined)).toBeNull();
    expect(visibleContinueKind(sat, persistedRevealHold(sat, saturday))).toBe("sunday");
    // An instant Saturday has nothing to replay; Sunday is not paused.
    expect(persistedRevealHold({ ...sat, activeEvent: { ...sat.activeEvent!, watched: false } }, 0)).toBeNull();
    expect(persistedRevealHold(startSundayFlow(sat).save, 0)).toBeNull();
  });
});

describe("the playback's starting cursor (rc.29 CAR-02)", () => {
  it("resumes at the session cursor, clamped to what the engine played; no cursor = everything simulated", () => {
    expect(initialRevealedRounds(undefined, 5)).toBe(5);
    expect(initialRevealedRounds(null, 5)).toBe(5);
    expect(initialRevealedRounds(3, 5)).toBe(3);
    expect(initialRevealedRounds(0, 5)).toBe(0);
    expect(initialRevealedRounds(9, 5)).toBe(5);
    expect(initialRevealedRounds(-2, 5)).toBe(0);
    expect(initialRevealedRounds(Number.NaN, 5)).toBe(5);
    expect(initialRevealedRounds(2, 0)).toBe(0);
  });
});

describe("the reduced-motion results stop on mount (rc.29 review R2)", { timeout: 30_000 }, () => {
  it("re-entering an event already at its results opens on them; the stop is for the click that plays the last round", () => {
    const sat = pausedMajor();
    expect(isEventPaused(sat)).toBe(true);
    const saturday = roundsOf(sat.activeEvent!.tournament).length;
    const atResults = isEventPaused(sat) || sat.activeEvent!.tournament.stage === "finished";
    // A reload / return from HQ on the paused Saturday (reduced motion writes
    // every round as shown; a new tab has no cursor): straight to the panel.
    expect(resultsSeenOnMount({ atResults, cursor: saturday, simulated: saturday })).toBe(true);
    expect(resultsSeenOnMount({ atResults, cursor: undefined, simulated: saturday })).toBe(true);
    expect(resultsSeenOnMount({ atResults, cursor: null, simulated: saturday })).toBe(true);
    // A watched replay left mid-round (the cursor is behind): the last round
    // shows first, then "See the Swiss result".
    expect(resultsSeenOnMount({ atResults, cursor: saturday - 1, simulated: saturday })).toBe(false);
    // Mid-event (Sunday's playoffs to play): the stop waits for the final.
    const sun = startSundayFlow(sat).save;
    expect(isEventPaused(sun)).toBe(false);
    expect(sun.activeEvent!.tournament.stage).not.toBe("finished");
    const sunday = roundsOf(sun.activeEvent!.tournament).length;
    expect(resultsSeenOnMount({ atResults: false, cursor: sunday, simulated: sunday })).toBe(false);
    // The finished event (digest) re-entered: no stop.
    const done = simEventToEnd(sun);
    expect(done.activeEvent!.tournament.stage).toBe("finished");
    const all = roundsOf(done.activeEvent!.tournament).length;
    expect(resultsSeenOnMount({ atResults: true, cursor: all, simulated: all })).toBe(true);
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


describe("unofficial cups on the calendar", () => {
  it("shows an offered Community Cup or Invitational and retains the played day", () => {
    for (const tier of ["t3", "t2"] as const) {
      const save = freshCareer();
      save.activeEvent = null;
      save.pendingEventDef = null;
      const day = eventDayFor(2);
      const def = { id: "0:2:unofficial", name: "Cup", seasonIndex: 0, week: 2, day, tier, format: "single" as const };
      save.unofficialOffer = def;
      expect(agendaDays(save, day, 1)[0]).toMatchObject({ event: def, participation: "playing" });
      save.unofficialOffer = null;
      save.clock.day = day + 1;
      save.eventResults.push({ eventId: def.id, name: def.name, tier, seasonIndex: 0, week: 2, championRef: "user", userPlacement: "champion", rows: [], fieldQuality: 1 });
      expect(agendaDays(save, day, 1)[0].event).toMatchObject({ id: def.id, tier });
      expect(agendaDays(save, day + 1, 1)[0].event).toBeNull();
      save.clock.day = day - 1; // an older save played the cup before its re-timed Saturday
      expect(agendaDays(save, day, 1)[0].event).toBeNull();
    }
  });
});
