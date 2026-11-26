/**
 * v2.2 ENDLESS, flag on: an old save (no `endless`) loads and plays on, gets
 * the front from its next rollover only, and the Legends invitational and a
 * drawn Invitational play through the real flows (start, sim, settle).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";

type Flow = typeof import("./careerFlow");
type Bot = typeof import("./careerArcBot");
type EndlessFlow = typeof import("./endlessFlow");
let flow: Flow;
let bot: Bot;
let ef: EndlessFlow;

beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_ENDLESS_VARIETY", "1");
  flow = await import("./careerFlow");
  bot = await import("./careerArcBot");
  ef = await import("./endlessFlow");
  const { FEATURES } = await import("@/config/balance");
  expect(FEATURES.endlessVariety).toBe(true);
}, 90_000);
afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function oldSave(): CareerSave {
  let save: CareerSave | null = null;
  bot.playArcCareer({ region: "NA", difficulty: "normal", policy: "strong", seed: 9100, seasons: 1, budgetMs: 100_000, onSeason: (m, s) => { if (m === "end") save = structuredClone(s); } });
  const s = save as unknown as CareerSave;
  delete s.endless; // a save from before the front
  return s;
}

describe("endless flow (flag on)", () => {
  it("an old save plays its season unchanged and gets the front at the next rollover", { timeout: 120_000 }, () => {
    const s = oldSave();
    expect(s.endless).toBeUndefined();
    // Its current season's Saturday offer is left alone (the front starts next season).
    expect(ef.endlessOffer(s, { id: "0:5:unofficial", tier: "t2", seasonIndex: s.clock.seasonIndex, week: 5, day: 33, name: "X", format: "single" }, 99)?.endless).toBeUndefined();
    const res = bot.playArcCareer({ region: "NA", difficulty: "normal", policy: "strong", seed: 9100, seasons: 2, budgetMs: 100_000, startFrom: s });
    expect(res.ended).toBeNull();
    expect(res.softlock).toBeNull();
  });

  it("the rollover sets the front from the next season on", { timeout: 120_000 }, () => {
    const s = oldSave();
    const next = flow.rolloverToNextSeason(s);
    expect(next.clock.seasonIndex).toBe(s.clock.seasonIndex + 1);
    expect(next.endless?.fromSeason).toBe(s.clock.seasonIndex + 1);
    expect(next.endless?.projects).toEqual([]); // no project before the endless years
  });

  it("a Legends, a drawn and an Intercontinental Invitational play and settle", { timeout: 120_000 }, () => {
    const base = flow.createCareerSave(
      { identity: { orgName: "Test Org", abbrev: "TST", region: "EU", managerName: "M", crestId: "c1", colors: { primary: "#000000", secondary: "#ffffff" } } as CareerSave["identity"], difficulty: "normal", rosterKey: "balanced" },
      777,
    );
    for (const kind of ["legends", "cup", "world"] as const) {
      const save = structuredClone(base);
      save.endless = { fromSeason: 0, projects: [] };
      const def: CareerEventDef = { id: `0:${save.clock.day}:unofficial`, tier: "t2", seasonIndex: 0, week: 1, day: save.clock.day, name: kind === "legends" ? ef.LEGENDS_EVENT_NAME : "Elite Eight", format: "single", endless: kind };
      save.pendingEventDef = def;
      save.unofficialOffer = null;
      const started = flow.startEvent(save, false);
      expect(started.activeEvent).toBeTruthy();
      const teams = Object.keys(started.activeEvent!.tournament.teams);
      expect(teams).toHaveLength(8);
      if (kind === "legends") expect(teams.filter((t) => t.startsWith("legend:"))).toHaveLength(7);
      // The Intercontinental's guests come from the other regions.
      if (kind === "world") expect(teams.filter((t) => t !== "user").every((t) => started.world.orgs[t] && started.world.orgs[t].region !== "EU")).toBe(true);
      const done = flow.simEventToEnd(started);
      expect(done.activeEvent?.tournament.stage).toBe("finished");
      const settled = flow.finishEvent(done);
      expect(settled.activeEvent).toBeNull();
      const result = settled.eventResults.find((r) => r.eventId === def.id)!;
      expect(result.rows).toHaveLength(8);
      // Names resolve for every row (a Legends side reads "<lineup> <year>", never its ref).
      for (const row of result.rows) expect(row.name.startsWith("legend:")).toBe(false);
      // No Season Points from an Invitational.
      expect(result.rows.every((r) => r.points === 0)).toBe(true);
    }
  });
});
