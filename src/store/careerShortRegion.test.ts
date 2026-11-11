/**
 * v2.0 (P1) — a region short of organizations still fields 16 teams.
 *
 * The launch-wave soft lock (11/11): C1-2b moves an org to the region its
 * dataset lineup plays in (FURIA and Elevate leave SAM in 2022-23) and does
 * not refill the seat. SAM then had 14 orgs: 8 direct, 6 in the qualifier,
 * and the 8 local sides made 14 — `fieldForEvent` threw "needs 16 teams,
 * built 14". Every career stopped there, in every region: the AI qualifier
 * resolves on the day's arrival (a dead Advance), and a SAM manager's own
 * lobby had two dead buttons.
 */
import { describe, expect, it } from "vitest";
import { CAREER_UNOFFICIAL, TOURNAMENT } from "@/config/balance";
import { qualifierDefsForWeek } from "@/engine/career/calendar";
import { isLocalRef, localOverflowRefs, localPlayerNames, localSceneRefs, localTeamName } from "@/engine/career/localScene";
import type { CareerSave } from "@/engine/career/types";
import { fieldForEvent, qualifierFieldRefsFor } from "@/engine/career/worldSim";
import type { Region } from "@/engine/types";
import { advanceDayFlow, createCareerSave, eventFieldFor, startEvent, type CreateCareerInput } from "./careerFlow";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const SEATS = TOURNAMENT.swiss.teams;

const inputFor = (region: Region): CreateCareerInput => ({
  identity: {
    orgName: "Short Region",
    abbrev: "SHR",
    managerName: "Bot",
    country: "BR",
    region,
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
});

/** `n` of the region's orgs move away (what C1-2b's relocation does to a region). */
function drain(save: CareerSave, region: Region, n: number): CareerSave {
  const next = structuredClone(save);
  const to: Region = region === "NA" ? "EU" : "NA";
  const refs = Object.values(next.world.orgs).filter((o) => o.region === region).map((o) => o.ref).sort().slice(0, n);
  for (const ref of refs) next.world.orgs[ref] = { ...next.world.orgs[ref], region: to };
  next.world.version += 1;
  next.competition.weekSeeding = null;
  return next;
}

describe("v2.0 (P1) — a region short of orgs", () => {
  it("the qualifier's seats are always filled, the pool first and local sides past it after", () => {
    const pool = localSceneRefs("SAM", 2);
    for (const orgs of [8, 6, 3, 0]) {
      const rest = Array.from({ length: orgs }, (_, i) => `org${i}`);
      const refs = qualifierFieldRefsFor({ region: "SAM", seasonIndex: 2, seeding: { direct: [], rest }, seats: SEATS });
      expect(refs, `${orgs} orgs`).toHaveLength(SEATS);
      expect(new Set(refs).size).toBe(SEATS);
      expect(refs.slice(0, orgs)).toEqual(rest);
      expect(refs.slice(orgs, orgs + pool.length)).toEqual(pool);
    }
    // A full region never reaches past the pool (nothing changes for it).
    const full = qualifierFieldRefsFor({ region: "SAM", seasonIndex: 2, seeding: { direct: [], rest: Array.from({ length: 8 }, (_, i) => `org${i}`) }, seats: SEATS });
    expect(full.filter(isLocalRef)).toEqual(pool);
  });

  it("sides past the pool have their own names and players, in every region", () => {
    for (const region of REGIONS) {
      const refs = [...localSceneRefs(region, 3), ...localOverflowRefs(region, 3, 6)];
      const names = refs.map((r) => localTeamName(r, 4242));
      expect(new Set(names).size, `${region} team names`).toBe(refs.length);
      const players = refs.flatMap((r) => localPlayerNames(r, 4242));
      expect(players.every((p) => typeof p === "string" && p.length > 0)).toBe(true);
      expect(new Set(players).size, `${region} player names`).toBe(players.length);
    }
    expect(localOverflowRefs("SAM", 2, 2)).toEqual([
      `local:SAM:2:${CAREER_UNOFFICIAL.localScenePool}`,
      `local:SAM:2:${CAREER_UNOFFICIAL.localScenePool + 1}`,
    ]);
  });

  it("another region's qualifier resolves and the clock moves on (it threw, and Advance did nothing)", () => {
    const def = qualifierDefsForWeek(0, 4).find((d) => d.region === "SAM")!;
    const base = createCareerSave(inputFor("NA"), 71_001);
    const short = drain(base, "SAM", 3);
    const { field } = fieldForEvent(def, {
      world: short.world,
      competition: short.competition,
      userTeam: null,
      userRegion: "NA",
      careerSeed: short.careerSeed,
      difficulty: short.difficulty,
    });
    expect(field).toHaveLength(SEATS);
    expect(new Set(field.map((t) => t.id)).size).toBe(SEATS);
    // The real flow: walk the calendar through the first qualifier weekend.
    let save = short;
    for (let i = 0; i < 40 && save.clock.day <= def.day + 1; i++) {
      const next = save.pendingEventDef?.day === save.clock.day && !save.activeEvent ? { ...save, pendingEventDef: null } : advanceDayFlow(save);
      if (next === save) break;
      save = next;
    }
    expect(save.clock.day).toBeGreaterThan(def.day);
  });

  it("the manager's own qualifier in the short region starts", () => {
    const def = qualifierDefsForWeek(0, 4).find((d) => d.region === "SAM")!;
    const base = drain(createCareerSave(inputFor("SAM"), 71_002), "SAM", 3);
    const save: CareerSave = { ...base, clock: { ...base.clock, day: def.day }, pendingEventDef: def, unofficialOffer: null };
    const { field } = eventFieldFor(save, def);
    expect(field).toHaveLength(SEATS);
    expect(field.some((t) => t.isUser)).toBe(true);
    expect(startEvent(save, true).activeEvent?.def.id).toBe(def.id);
  });
});
