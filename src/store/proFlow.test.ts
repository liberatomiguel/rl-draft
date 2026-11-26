/**
 * v2.2 Pro spine (PROSPINE): the Pro in the world. Targeted flow tests; the
 * long bot runs are in proBot.probe.test.ts (PRO_BOT=1).
 */
import { describe, expect, it } from "vitest";
import { proRosterCount, proSeatOf } from "@/engine/career/pro/offers";
import { PRO_SELF_ID } from "@/engine/career/pro/world";
import { newProBotSave, proBotDecide } from "./proBot";
import { advanceProDayFlow, advanceProToNextStopFlow, hostOf, proStopOf } from "./proFlow";

describe("PROSPINE proFlow", () => {
  it("a new Pro gets a host sharing his world and clock; the host squad is him alone", () => {
    const save = newProBotSave("NA", "normal", 101);
    const host = hostOf(save)!;
    expect(host.world).toBe(save.world);
    expect(host.clock).toBe(save.clock);
    expect(host.squad.map((p) => p.id)).toEqual([PRO_SELF_ID]);
    expect(save.world.proSelf?.name).toBe("Bot Pro");
    expect(proRosterCount(save.world)).toBe(0);
  });

  it("days move, the world moves, a ranked Pro is never stuck", () => {
    let save = newProBotSave("EU", "normal", 7);
    const start = save.clock.day;
    for (let i = 0; i < 40; i++) save = advanceProDayFlow(save);
    expect(save.clock.day).toBeGreaterThan(start + 30);
  });

  it("an amateur side calls, the Pro joins, the side plays its matchday and he gets a report", () => {
    let save = newProBotSave("NA", "normal", 2024, 14);
    let reports = 0;
    for (let i = 0; i < 120 && reports < 1; i++) {
      save = proBotDecide(save);
      save = advanceProToNextStopFlow(save);
      if (save.report && save.report.series.length > 0) reports += 1;
    }
    expect(save.stage).toBe("amateur");
    expect(hostOf(save)!.squad).toHaveLength(3);
    expect(reports).toBe(1);
    const line = save.report!.series[0];
    expect(line.games.length).toBeGreaterThan(0);
    expect(line.rating).not.toBeNull();
    expect(proStopOf(save)?.kind ?? null).not.toBe("seasonEnd");
  });

  it("pro:self is never on two rosters, and an org signing puts him on exactly one", () => {
    let save = newProBotSave("NA", "easy", 55, 14);
    for (let i = 0; i < 1200 && save.stage !== "org"; i++) {
      save = proBotDecide(save);
      save = advanceProToNextStopFlow(save);
      expect(proRosterCount(save.world)).toBeLessThanOrEqual(1);
    }
    if (save.stage === "org") {
      // R-PROSPINE-6: his org sits on the host seat for the stint: off the world (no duplicate), him on its squad.
      expect(save.orgShell?.org.ref).toBe(save.contract!.orgRef);
      expect(save.world.orgs[save.contract!.orgRef]).toBeUndefined();
      expect(proRosterCount(save.world)).toBe(0);
      expect(hostOf(save)!.squad.filter((p) => p.id === PRO_SELF_ID)).toHaveLength(1);
      expect(hostOf(save)!.identity.orgName).toBe(save.contract!.orgName);
      void proSeatOf;
    }
  }, 600_000);
});
