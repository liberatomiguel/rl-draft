/**
 * v2.2 Pro spine round 2 (PROSPINE): the Pro plays his series, with the
 * Matchday engine on (as on staging). One decision a game, its effect inside
 * the series ledger, his rating per game, sim the rest; the same in an org on
 * the host seat, and the org back in the world, in its ref, after the stint.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

type Flow = typeof import("./proFlow");
type Match = typeof import("./proMatch");
type Bot = typeof import("./proBot");
let F: Flow;
let M: Match;
let B: Bot;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_MATCHDAY_DECISIONS", "1");
  vi.stubEnv("NEXT_PUBLIC_MATCHDAY_STYLES", "1");
  vi.stubEnv("NEXT_PUBLIC_MATCHDAY_BOXSCORE", "1");
  vi.resetModules();
  F = await import("./proFlow");
  M = await import("./proMatch");
  B = await import("./proBot");
}, 300_000);

describe("PROSPINE the Pro plays his series", () => {
  it("amateur seat: a decision a game, his rating per game, the series booked once", async () => {
    const { MOMENTS_BOUNDS } = await import("./proMatch.testHelpers");
    let save = B.newProBotSave("NA", "normal", 2024, 14);
    let decided = 0;
    let seriesSeen = 0;
    for (let i = 0; i < 400 && seriesSeen < 3; i++) {
      if (save.live) {
        if (decided === 0) {
          const { renderToString } = await import("react-dom/server");
          const { createElement } = await import("react");
          const { ProLive } = await import("@/components/career/pro/spine/ProLive");
          expect(renderToString(createElement(ProLive, { save, eventName: "x" })).length).toBeGreaterThan(0);
        }
        const d = save.live.decision;
        const pick = d ? (d.options.find((o) => !o.locked)?.id ?? "instinct") : "instinct";
        const before = save.live;
        const after = M.decideProGameFlow(save, pick);
        expect(after).not.toBe(save);
        decided += 1;
        if (!after.live || after.live.roundKey !== before.roundKey) {
          seriesSeen += 1;
          const booked = after.report!.series.find((s) => s.roundKey === before.roundKey)!;
          expect(booked.games.length).toBe(before.games.length + 1);
          for (const g of booked.games) {
            expect(g.pro).not.toBeNull();
            expect(g.pro!.rating).toBeGreaterThanOrEqual(0);
            expect(g.pro!.rating).toBeLessThanOrEqual(10);
          }
        } else {
          expect(Math.abs(after.live.ledger.team)).toBeLessThanOrEqual(MOMENTS_BOUNDS.teamPerSeries + 1e-9);
        }
        save = after;
        continue;
      }
      save = B.proBotDecide(save);
      const stop = F.proStopOf(save);
      save = stop?.kind === "matchday" ? M.playProMatchdayFlow(save) : F.advanceProToNextStopFlow(save);
    }
    expect(decided).toBeGreaterThan(3);
    expect(seriesSeen).toBeGreaterThanOrEqual(3);
  }, 600_000);

  it("sim the rest of a series and of an event: every call on instinct, nothing stuck", () => {
    let save = B.newProBotSave("EU", "normal", 77, 14);
    let simmed = 0;
    for (let i = 0; i < 600 && simmed < 2; i++) {
      if (save.live) {
        const key = save.live.roundKey;
        const s1 = M.simProSeriesFlow(save);
        expect(s1.live?.roundKey ?? null).not.toBe(key);
        save = M.simProEventFlow(s1);
        expect(save.live).toBeFalsy();
        simmed += 1;
        continue;
      }
      save = B.proBotDecide(save);
      save = F.proStopOf(save)?.kind === "matchday" ? M.playProMatchdayFlow(save) : F.advanceProToNextStopFlow(save);
    }
    expect(simmed).toBe(2);
  }, 600_000);

  it("in an org he plays on the host seat; the org leaves the world for the stint and comes back in its ref", () => {
    let save = B.newProBotSave("NA", "easy", 55, 14);
    let regionCount = 0;
    for (let i = 0; i < 3000 && save.stage !== "org"; i++) {
      regionCount = Object.values(save.world.orgs).filter((o) => o.region === "NA").length;
      save = B.proBotDecide(save);
      save = F.advanceProToNextStopFlow(save);
    }
    expect(save.stage).toBe("org");
    const ref = save.contract!.orgRef;
    expect(save.orgShell?.org.ref).toBe(ref);
    expect(Object.values(save.world.orgs).filter((o) => o.region === "NA").length).toBe(regionCount - 1);
    // He plays its next series himself.
    let played = false;
    for (let i = 0; i < 400 && !played; i++) {
      if (save.live) {
        save = M.decideProGameFlow(save, "instinct");
        played = true;
        break;
      }
      save = F.proStopOf(save)?.kind === "matchday" ? M.playProMatchdayFlow(save) : F.advanceProToNextStopFlow(save);
      if (save.stage !== "org") break;
    }
    if (save.stage === "org" && F.seatOfPro(save) === "starter") expect(played).toBe(true);
    // The season's end puts the org back for the rollover, then on the seat again.
    for (let i = 0; i < 400 && F.proStopOf(save)?.kind !== "seasonEnd"; i++) {
      save = save.live ? M.simProEventFlow(save) : F.advanceProToNextStopFlow(save);
    }
    save = F.advanceProDayFlow(save);
    if (save.stage === "org") {
      expect(save.orgShell?.org.ref).toBe(save.contract!.orgRef);
      expect(save.world.orgs[save.contract!.orgRef]).toBeUndefined();
    } else {
      expect(save.orgShell ?? null).toBeNull();
      if (save.world.orgs[ref]) expect(save.world.orgs[ref].playerIds).not.toContain("pro:self");
    }
  }, 900_000);
});
