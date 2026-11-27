/**
 * v2.2 event formats (FORMATS-SPEC.md): the USER's Major in every shape of
 * CAREER_EVENT_LAYOUTS, through the real flow. From one lobby (the first
 * Major, the user in the field), each shape plays its Saturday step by step
 * to the pause, holds until Championship Sunday, plays Sunday to the end and
 * settles with the bracket's own points and prize.
 */
import { describe, expect, it } from "vitest";
import { CAREER_EVENT_LAYOUTS, FEATURES } from "@/config/balance";
import { eventLayoutFor, officialEventDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { placementOf } from "@/engine/career/careerResults";
import { pointsFor, prizeFor, prizeShapeOf } from "@/engine/career/economy";
import { atPlayoffsStart } from "@/engine/tournament";
import type { EventLayout } from "@/engine/types";
import {
  eventDayPhaseOf,
  finishEvent,
  isEventPaused,
  isLegacySaturdayPlayoffs,
  startEvent,
  stepEventRound,
} from "./careerFlow";
import { MAJOR_WEEK, majorLobbyForTests } from "./careerMajorLobbyForTests";
import { startSundayFlow } from "./careerSunday";

const MAJOR_W = MAJOR_WEEK;
const majorLobby = majorLobbyForTests;

const LAYOUTS: EventLayout[] = [];
for (const row of CAREER_EVENT_LAYOUTS.seasons) {
  for (const l of [row.major, row.worlds]) {
    if (!LAYOUTS.some((x) => x.stage === l.stage && x.bracket === l.bracket)) LAYOUTS.push(l);
  }
}

describe("v2.2 event formats: the user's Major through the flow", { timeout: 120_000 }, () => {
  it("the calendar stamps each season's shape on its Majors and Worlds (flag on), nothing with it off", () => {
    const flags = FEATURES as { eventFormats: boolean };
    const worldsW = seasonSchedule().find((w) => w.kind === "worlds")!.week;
    expect(flags.eventFormats).toBe(false);
    expect(officialEventDefsForWeek(5, MAJOR_W)[0].layout).toBeUndefined();
    flags.eventFormats = true;
    try {
      expect(officialEventDefsForWeek(5, MAJOR_W)[0].layout).toEqual({ stage: "groups4", bracket: "hybrid8" });
      expect(officialEventDefsForWeek(5, worldsW)[0].layout).toEqual({ stage: "groups4", bracket: "hybrid12" });
      // Season X's Worlds stays cancelled; 2027 plays Season X's row, its Worlds included.
      expect(officialEventDefsForWeek(0, worldsW)).toEqual([]);
      expect(officialEventDefsForWeek(6, worldsW)[0].layout).toEqual(CAREER_EVENT_LAYOUTS.seasons[0].worlds);
      expect(eventLayoutFor(12, "major")).toEqual(CAREER_EVENT_LAYOUTS.seasons[0].major);
      expect(eventLayoutFor(8, "worlds")).toEqual(CAREER_EVENT_LAYOUTS.seasons[2].worlds);
      // Regionals keep the classic shape.
      const regionalW = seasonSchedule().find((w) => w.kind === "regional")!.week;
      expect(officialEventDefsForWeek(5, regionalW).every((d) => d.layout === undefined)).toBe(true);
    } finally {
      flags.eventFormats = false;
    }
  });

  it("every shape: Saturday to the pause, Championship Sunday to the end, settled by its bracket", () => {
    const lobby = majorLobby();
    expect(lobby.pendingEventDef?.tier).toBe("major");
    expect(lobby.pendingEventDef?.day).toBe(lobby.clock.day);
    for (const layout of LAYOUTS) {
      const at = structuredClone(lobby);
      at.pendingEventDef = { ...at.pendingEventDef!, layout };
      for (const p of at.squad) p.overall = 99;
      let save = startEvent(at, true);
      expect(save.activeEvent?.tournament.layout).toEqual(layout);
      expect(isLegacySaturdayPlayoffs(save)).toBe(false);

      // Saturday, one round at a time, until the pause.
      let guard = 0;
      while (!isEventPaused(save) && save.activeEvent!.tournament.stage !== "finished" && guard++ < 30) {
        const next = stepEventRound(save);
        expect(next).not.toBe(save);
        save = next;
      }
      const sat = save.activeEvent!.tournament;
      expect(isEventPaused(save)).toBe(true);
      expect(atPlayoffsStart(sat)).toBe(true);
      expect(eventDayPhaseOf(save)).toBe("paused");
      // Nothing more is played on Saturday.
      expect(stepEventRound(save)).toBe(save);

      // Championship Sunday.
      save = startSundayFlow(save).save;
      expect(isEventPaused(save)).toBe(false);
      guard = 0;
      while (save.activeEvent!.tournament.stage !== "finished" && guard++ < 30) save = stepEventRound(save);
      const t = save.activeEvent!.tournament;
      expect(t.stage).toBe("finished");
      const def = save.activeEvent!.def;
      const placement = placementOf(t, "user");
      const done = finishEvent(save);
      expect(done.activeEvent).toBeNull();
      const result = done.eventResults.find((r) => r.eventId === def.id)!;
      expect(result.rows).toHaveLength(16);
      expect(result.userPlacement).toBe(placement);
      const row = result.rows.find((r) => r.ref === "user")!;
      expect(row.points).toBe(pointsFor("major", placement, prizeShapeOf(def)));
      expect(row.prize).toBe(prizeFor("major", placement, prizeShapeOf(def), done.difficulty, def.seasonIndex));
    }
  });
});
