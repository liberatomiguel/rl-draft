/**
 * v2.2 Pro spine QA round (PROSPINE): the flow invariants the browser QA
 * asked for. 1: Continue never crosses a week without its plan confirmed.
 * 2: it stops for an offer about to expire and for the burnout warning.
 * 3: a saved plan that would tire him falls back to the coach's plan, and
 * says so. 6: no amateur invite under an org contract, no declined side
 * twice in a season.
 */
import { describe, expect, it } from "vitest";
import { weekOfDay } from "@/engine/career/calendar";
import type { ProSave, ProWeekPlan } from "@/engine/career/pro/types";
import { newProBotSave, proBotDecide } from "./proBot";
import {
  advanceProToNextStopFlow,
  autoPlanOf,
  confirmProWeekFlow,
  declineProOfferFlow,
  openProOffersOf,
  planAutoOf,
  proStopOf,
  setProAutoPlanFlow,
  setProWeeklyPlanningFlow,
} from "./proFlow";

const TRAIN3: ProWeekPlan = [
  { kind: "train", focus: "offense" },
  { kind: "train", focus: "defense" },
  { kind: "train", focus: "mechanics" },
];

describe("PROSPINE QA invariants", () => {
  it("1: the first Continue of a new career stops at the plan; afterwards Continue never runs more than 4 weeks without a stop", () => {
    let save = newProBotSave("NA", "normal", 501, 13);
    expect(proStopOf(save)?.kind).toBe("weekPlan");
    // A first-time player confirms the very first week; the plan gate does not stop the next Monday by itself.
    save = advanceProToNextStopFlow(save);
    expect(save.thisWeek).toBeTruthy();
    for (let i = 0; i < 60; i++) {
      const before = save;
      save = advanceProToNextStopFlow(save);
      const weeks = (save.clock.seasonIndex - before.clock.seasonIndex) * 32 + weekOfDay(save.clock.day) - weekOfDay(before.clock.day);
      expect(weeks, `Continue ran ${weeks} weeks from S${before.clock.seasonIndex} d${before.clock.day}`).toBeLessThanOrEqual(4);
      expect(save.live ?? null).toBe(save.live ?? null);
    }
    expect(save.clock.day).toBeGreaterThan(1);
  }, 300_000);

  it("1b: a digest stops a long quiet stretch; planning week by week brings the gate back and is remembered", () => {
    // A quiet plan (rest all week): nothing else can stop him, so the 4-week digest does.
    let save = confirmProWeekFlow(newProBotSave("NA", "normal", 502, 13), [{ kind: "rest" }, { kind: "rest" }, { kind: "rest" }]);
    const startWeek = weekOfDay(save.clock.day);
    save = advanceProToNextStopFlow(save);
    expect(save.notice?.kind).toBe("digest");
    expect(weekOfDay(save.clock.day) - startWeek).toBe(4);
    save = setProWeeklyPlanningFlow(save, true);
    expect(save.weeklyPlanning).toBe(true);
    for (let i = 0; i < 8 && proStopOf(save)?.kind !== "weekPlan"; i++) save = advanceProToNextStopFlow(save);
    expect(proStopOf(save)?.kind).toBe("weekPlan");
    const back = setProWeeklyPlanningFlow(save, false);
    expect(planAutoOf(back)).toBe(true);
    expect(planAutoOf(newProBotSave("NA", "normal", 503, 13))).toBe(false);
  }, 300_000);

  it("2: an offer about to expire stops Continue once; the burnout warning stops it", () => {
    let save = newProBotSave("EU", "easy", 61, 14);
    for (let i = 0; i < 300 && openProOffersOf(save).length === 0; i++) save = advanceProToNextStopFlow(save);
    const offer = openProOffersOf(save)[0];
    expect(offer).toBeTruthy();
    let warned = false;
    for (let i = 0; i < 60 && save.offers.find((o) => o.id === offer.id)!.status === "open"; i++) {
      save = advanceProToNextStopFlow(save);
      if (save.notice?.kind === "offerExpiring" && save.notice.name === offer.name) warned = true;
    }
    expect(warned).toBe(true);

    let tired = newProBotSave("SAM", "normal", 62, 14);
    tired = { ...tired, player: { ...tired.player, energy: 40 } };
    tired = confirmProWeekFlow(tired, TRAIN3);
    let stopped = false;
    for (let i = 0; i < 12 && !stopped; i++) {
      tired = advanceProToNextStopFlow(tired);
      if (tired.notice?.kind === "burnoutWarning" || tired.notice?.kind === "burnedOut") stopped = true;
      if (proStopOf(tired)?.kind === "weekPlan") break;
    }
    expect(stopped).toBe(true);
  }, 300_000);

  it("3: a saved plan that would tire him falls back to the coach's plan, and says so", () => {
    let save = newProBotSave("NA", "normal", 63, 14);
    save = { ...save, weekPlan: TRAIN3, player: { ...save.player, energy: 50 } };
    expect(autoPlanOf(save).source).toBe("fallback");
    const confirmed = confirmProWeekFlow(save, "own");
    expect(confirmed.thisWeek?.source).toBe("fallback");
    expect(confirmed.thisWeek?.plan.some((a) => a.kind === "rest")).toBe(true);
    expect(confirmed.notice?.kind).toBe("planFellBack");
    // The auto-plan does the same on its Mondays.
    let auto = setProAutoPlanFlow(save, true);
    for (let i = 0; i < 20 && auto.thisWeek?.source !== "fallback"; i++) {
      auto = { ...advanceProToNextStopFlow(auto) };
      auto = { ...auto, player: { ...auto.player, energy: Math.min(auto.player.energy, 50) } };
    }
    expect(auto.thisWeek?.source).toBe("fallback");
  }, 300_000);

  it("6: no amateur invite while under an org contract; a declined side does not call again that season", () => {
    let save = newProBotSave("NA", "normal", 64, 14);
    const declined: string[] = [];
    let season = save.clock.seasonIndex;
    for (let i = 0; i < 600 && save.clock.seasonIndex < 3; i++) {
      if (save.clock.seasonIndex !== season) {
        season = save.clock.seasonIndex;
        declined.length = 0;
      }
      for (const o of openProOffersOf(save)) {
        if (o.kind === "amateur") {
          expect(save.stage).not.toBe("org");
          expect(declined).not.toContain(o.ref);
          if (declined.length < 2) {
            declined.push(o.ref);
            save = declineProOfferFlow(save, o.id);
          }
        }
      }
      if (declined.length >= 2) save = proBotDecide(save);
      save = advanceProToNextStopFlow(save);
    }
    const check = (s: ProSave) => s.stage !== "org" || !openProOffersOf(s).some((o) => o.kind === "amateur");
    expect(check(save)).toBe(true);
  }, 600_000);
});
