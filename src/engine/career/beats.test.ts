/**
 * rc.36 (ROADMAP UX-03, R87): a historical beat never claims what the save
 * contradicts — it runs live when its check holds, else files "From the
 * archive" (and its effect does not run).
 */

import { describe, expect, it } from "vitest";
import { CAREER_BEATS } from "@/data/career/beats";
import { orgById } from "@/data";
import { beatModeFor, type BeatContext } from "./beats";
import type { CompactEventResult, WorldState } from "./types";

function world(orgs: { ref: string; region: string; rating: number; playerIds?: string[] }[], over: Partial<WorldState> = {}): WorldState {
  return {
    orgs: Object.fromEntries(
      orgs.map((o) => [o.ref, { ref: o.ref, name: o.ref, region: o.region, prestige: 1, playerIds: o.playerIds ?? ["a", "b", "c"], rating: o.rating }]),
    ),
    freeAgentIds: [],
    retiredIds: [],
    overallDelta: {},
    version: 1,
    ...over,
  } as unknown as WorldState;
}

const ctx = (w: WorldState, over: Partial<BeatContext> = {}): BeatContext => ({
  world: w,
  careerSeed: 1,
  seasonIndex: 0,
  squadIds: [],
  results: [],
  userRegion: "SAM",
  ...over,
});

describe("beatModeFor (UX-03)", () => {
  it("real history only is always archive; no check is live", () => {
    expect(beatModeFor({ archiveOnly: true }, ctx(world([])))).toBe("archive");
    expect(beatModeFor({}, ctx(world([])))).toBe("live");
  });

  it("an org must be in the world, and near the top of its region when asked", () => {
    const w = world([
      { ref: "team-bds", region: "EU", rating: 80 },
      { ref: "x1", region: "EU", rating: 90 },
      { ref: "x2", region: "EU", rating: 88 },
      { ref: "x3", region: "EU", rating: 86 },
    ]);
    expect(beatModeFor({ check: { orgs: ["team-bds"] } }, ctx(w))).toBe("live");
    expect(beatModeFor({ check: { orgs: ["team-bds"], top: 3 } }, ctx(w))).toBe("archive");
    expect(beatModeFor({ check: { orgs: ["team-bds"], top: 4 } }, ctx(w))).toBe("live");
    expect(beatModeFor({ check: { orgs: ["gone"] } }, ctx(w))).toBe("archive");
  });

  it("a player must still be playing; an unsigned one must be on no roster", () => {
    const w = world([{ ref: "team-vitality", region: "EU", rating: 85, playerIds: ["zen", "b", "c"] }], { retiredIds: ["old"] });
    expect(beatModeFor({ check: { players: ["old"] } }, ctx(w))).toBe("archive");
    expect(beatModeFor({ check: { players: ["old"] } }, ctx(w, { squadIds: ["old"] }))).toBe("live");
    expect(beatModeFor({ check: { unsigned: ["zen"] } }, ctx(w))).toBe("archive");
    expect(beatModeFor({ check: { unsigned: ["zen"] } }, ctx(world([])))).toBe("live");
    expect(beatModeFor({ check: { unsigned: ["zen"] } }, ctx(world([]), { squadIds: ["zen"] }))).toBe("archive");
  });

  it("a region's Major run counts this season's Majors (the user's own run for its region too)", () => {
    const w = world([{ ref: "furia", region: "SAM", rating: 85 }, { ref: "eu1", region: "EU", rating: 90 }]);
    const major = (rows: { ref: string; placement: CompactEventResult["rows"][number]["placement"] }[], seasonIndex = 0): CompactEventResult => ({
      eventId: "m",
      tier: "major",
      seasonIndex,
      week: 10,
      name: "Major",
      rows: rows.map((r) => ({ ...r, name: r.ref, points: 0, prize: 0 })),
      championRef: "eu1",
      fieldQuality: 1,
    });
    const check = { majorRun: { regions: ["SAM"], place: 8 } };
    expect(beatModeFor({ check }, ctx(w, { results: [major([{ ref: "furia", placement: "top8" }])] }))).toBe("live");
    expect(beatModeFor({ check }, ctx(w, { results: [major([{ ref: "furia", placement: "swiss_exit" }])] }))).toBe("archive");
    expect(beatModeFor({ check }, ctx(w, { results: [major([{ ref: "user", placement: "top4" }])] }))).toBe("live");
    expect(beatModeFor({ check }, ctx(w, { results: [major([{ ref: "furia", placement: "top4" }], 1)] }))).toBe("archive");
  });

  it("the corpus: every check names real orgs, every beat has EN and PT words, Miguel's examples are covered", () => {
    for (const b of CAREER_BEATS) {
      for (const ref of [...(b.check?.orgs ?? []), ...(b.orgRefs ?? [])]) expect(orgById.has(ref), `${b.id}: ${ref}`).toBe(true);
      expect(b.en.title && b.pt.title && b.en.body && b.pt.body).toBeTruthy();
    }
    const zen = CAREER_BEATS.find((b) => b.id === "s3-vitality-zen")!;
    expect(zen.check).toMatchObject({ orgs: ["team-vitality"], players: ["zen"] });
    const furia = CAREER_BEATS.find((b) => b.id === "s2-furia-north")!;
    expect(furia.archiveOnly).toBe(true);
    expect(new Set(CAREER_BEATS.map((b) => b.id)).size).toBe(CAREER_BEATS.length);
  });
});
