/**
 * rc.44 (R118): the dataset's real coaches on the coach market.
 */
import { describe, expect, it } from "vitest";
import { CAREER_COACH_MARKET, CAREER_LADDER } from "@/config/balance";
import { coaches, seasonById } from "@/data";
import { seasonOrderFor } from "./development";
import { coachHireRefusalFor } from "./ladder";
import { coachCandidatesFor, staffCoachCandidatesFor } from "./market";
import { agePassAndIntake, buildWorldAtCreation } from "./worldSim";

const S = CAREER_COACH_MARKET.staff;
const base = { region: "SAM" as const, careerSeed: 4_321, difficulty: "normal" as const };
const windows = (seasonIndex: number, reputation: number) =>
  [0, 1, 2, 3].flatMap((windowIdx) => staffCoachCandidatesFor({ ...base, seasonIndex, windowIdx, reputation }));

describe("rc.44 (R118): real coaches on the market", () => {
  it("every window seats real people who already coached, at the quality of their best season so far", () => {
    for (const seasonIndex of [0, 3, 8]) {
      const order = seasonOrderFor(seasonIndex);
      for (const c of windows(seasonIndex, 60)) {
        const id = c.id.slice("coach:staff:".length);
        const past = coaches.filter((x) => x.personId === id && (seasonById.get(x.seasonId)?.order ?? 99) <= order);
        expect(past.length).toBeGreaterThan(0);
        expect(c.overall).toBe(Math.max(...past.map((x) => x.overall)));
        expect(c.source).toBe("dataset");
        expect(c.experience).toBeGreaterThanOrEqual(1);
        expect(c.experience).toBeLessThanOrEqual(S.maxExperience);
        expect(c.ceiling).toBeGreaterThanOrEqual(c.overall);
      }
      for (const windowIdx of [0, 1, 2, 3]) {
        const picks = staffCoachCandidatesFor({ ...base, seasonIndex, windowIdx, reputation: 60 });
        expect(picks.length).toBe(S.perWindow);
        expect(new Set(picks.map((c) => c.id)).size).toBe(picks.length);
      }
    }
  });

  it("reputation decides who answers: a small club never sees the elite, a big one does", () => {
    const capAt = (rep: number) => S.repCapBase + S.repCapPerRep * rep;
    for (const rep of [0, 40, 90]) for (const c of windows(7, rep)) expect(c.overall).toBeLessThanOrEqual(capAt(rep));
    const best = (rep: number) => Math.max(...[5, 6, 7, 8].flatMap((s) => windows(s, rep)).map((c) => c.overall));
    expect(best(90)).toBeGreaterThan(best(0));
    expect(best(90)).toBeGreaterThanOrEqual(86);
  });

  it("the shortlist is the same on a reload and rotates between windows", () => {
    const a = staffCoachCandidatesFor({ ...base, seasonIndex: 6, windowIdx: 1, reputation: 50 });
    expect(staffCoachCandidatesFor({ ...base, seasonIndex: 6, windowIdx: 1, reputation: 50 })).toEqual(a);
    const ids = new Set([5, 6, 7].flatMap((s) => windows(s, 50)).map((c) => c.id));
    expect(ids.size).toBeGreaterThan(S.perWindow * 2);
  });

  it("the full shortlist seats them first, never twice with an ex-pro, and gates them like an ex-pro", () => {
    const seed = 4_321;
    let world = buildWorldAtCreation(seed);
    for (let s = 1; s <= 6; s++) world = agePassAndIntake(world, s, seed, [], false).world;
    const ctx = { world, ...base, seasonIndex: 6, windowIdx: 0, nameBank: ["A"] };
    const list = coachCandidatesFor({ ...ctx, reputation: 60 });
    expect(list.length).toBe(CAREER_COACH_MARKET.candidatesPerWindow);
    expect(list.slice(0, S.perWindow).every((c) => c.source === "dataset")).toBe(true);
    expect(list.some((c) => c.source === "generated")).toBe(true);
    const people = list.map((c) => c.id.replace(/^coach:(staff|real):/, ""));
    expect(new Set(people).size).toBe(people.length);
    // No reputation passed: rc.43's shortlist, no real coach.
    expect(coachCandidatesFor(ctx).some((c) => c.source === "dataset")).toBe(false);
    const staff = list[0];
    expect(coachHireRefusalFor(CAREER_LADDER.exProCoachRep - 1, staff)).toBe("exProGate");
    expect(coachHireRefusalFor(CAREER_LADDER.exProCoachRep, staff)).toBeNull();
  });
});
