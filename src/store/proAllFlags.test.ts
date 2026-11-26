/**
 * v2.2 POLISH: the Pro under every staging flag (board, real-org start,
 * endless, world life, the matchday fronts). With the board on, the Pro's
 * hidden host once held the clock on a package nobody could answer, so no day
 * moved. The host is now inert for the board and the endless bids.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return {
    ...m,
    FEATURES: {
      ...m.FEATURES,
      board: true,
      realOrgStart: true,
      endlessVariety: true,
      worldLife: true,
      matchdayStyles: true,
      matchdayDecisions: true,
      matchdayBoxScore: true,
      proCareer: true,
    },
  };
});

import { createProSave } from "@/engine/career/pro/create";
import { endlessProjectBid } from "./endlessFlow";
import { advanceProToNextStopFlow, confirmProWeekFlow, continueProSeasonFlow, ensureProHost, hostOf, proStopOf } from "./proFlow";

const input = { name: "Polly", country: "BR", region: "SAM" as const, startAge: 13 as const, archetype: "allround" as const, difficulty: "normal" as const };

describe("the Pro with every staging flag on", () => {
  it("the host has no board and the first Continue moves the clock", () => {
    let s = ensureProHost(createProSave(input, 12345, "test"));
    const host = hostOf(s)!;
    expect(host.proHost).toBe(true);
    expect(host.board).toBeUndefined();
    expect(host.manager).toBeUndefined();
    expect(proStopOf(s)?.kind).toBe("weekPlan");
    s = advanceProToNextStopFlow(confirmProWeekFlow(s, "coach"));
    expect(s.clock.day).toBeGreaterThan(1);
  }, 300_000);

  it("a Pro advances through a full season and its rollover, with no board decision ever pending", () => {
    let s = confirmProWeekFlow(ensureProHost(createProSave(input, 4242, "test")), "coach");
    for (let i = 0; i < 400 && proStopOf(s)?.kind !== "seasonEnd"; i++) {
      s = advanceProToNextStopFlow(s);
      const host = hostOf(s)!;
      expect(host.board).toBeUndefined();
      expect(host.manager?.offers ?? null).toBeNull();
    }
    expect(proStopOf(s)?.kind).toBe("seasonEnd");
    const season = s.clock.seasonIndex;
    s = continueProSeasonFlow(s);
    expect(s.clock.seasonIndex).toBe(season + 1);
    const before = s.clock.day;
    s = advanceProToNextStopFlow(s);
    expect(s.clock.day).toBeGreaterThan(before - 1);
    expect(hostOf(s)!.board).toBeUndefined();
  }, 600_000);

  it("an older host that carries a board is cleaned and the endless bids never name the host", () => {
    let s = ensureProHost(createProSave(input, 777, "test"));
    const host = hostOf(s)!;
    const dirty = { ...s, host: { ...(s.host as object), proHost: undefined, board: { confidence: 10 } } } as unknown as typeof s;
    s = advanceProToNextStopFlow(confirmProWeekFlow(dirty, "coach"));
    expect(s.clock.day).toBeGreaterThan(1);
    expect(hostOf(s)!.board).toBeUndefined();
    expect(endlessProjectBid({ ...host, proHost: true, endless: { fromSeason: 0, projects: [], streak: { ref: "user", titles: 3 } } } as typeof host, 5, 0)).toBeNull();
  }, 300_000);
});
