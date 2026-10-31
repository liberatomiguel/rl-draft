/**
 * Road to Worlds — RTW-02 (rc.33, Miguel 30/10: "playing EU, the reputation
 * did not rise"). The newcomer's path pays what an underdog can reach,
 * judged against the user's SEED in the event: a Community Cup semi-final
 * as the third seed or lower (inside the cup's per-split cap), a qualifier
 * decider seeded outside the qualifying eight (one a split) — and only below
 * CAREER_REP.newcomer.repCeiling, so the easy regions gain little. finishEvent
 * awards it and the results digest previews the same rule.
 */

import { describe, expect, it } from "vitest";
import { CAREER_QUALIFIER, CAREER_REP, CAREER_UNOFFICIAL } from "@/config/balance";
import { firstDayOfWeek, qualifierDefsForWeek } from "@/engine/career/calendar";
import { placementOf } from "@/engine/career/careerResults";
import { t3RepKeyFor } from "@/engine/career/economy";
import { deepRunKeyFor, newcomerRepKindFor, userSeedIn, userSwissWinsIn } from "@/engine/career/reputation";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import type { Placement } from "@/engine/types";
import { eventRepPreview, eventRepPreviewKind } from "@/components/career/event/weekendView";
import { createCareerSave, finishEvent, localAnchorRatingFor, simEventToEnd, startEvent, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Rep Test",
    abbrev: "REP",
    managerName: "Bot",
    country: "BR",
    region: "EU",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

const N = CAREER_REP.newcomer;
const ctx = (over: Partial<Parameters<typeof newcomerRepKindFor>[2]> = {}) => ({
  rep: 5,
  seed: 3,
  swissWins: 2,
  t3CapReached: false,
  deepRunsThisSplit: 0,
  ...over,
});

describe("RTW-02 — the rule (engine)", () => {
  it("a cup semi-final pays from the third seed down; a top-two seed's semi does not", () => {
    expect(newcomerRepKindFor("t3", "top4", ctx({ seed: N.t3SemiMinSeed }))).toBe("t3Semi");
    expect(newcomerRepKindFor("t3", "top4", ctx({ seed: 6 }))).toBe("t3Semi");
    expect(newcomerRepKindFor("t3", "top4", ctx({ seed: N.t3SemiMinSeed - 1 }))).toBeNull();
    expect(newcomerRepKindFor("t3", "top8", ctx())).toBeNull();
    // The cup's shared per-split cap.
    expect(newcomerRepKindFor("t3", "top4", ctx({ t3CapReached: true }))).toBeNull();
  });

  it("a qualifier decider pays when seeded outside the qualifying slots, once a split", () => {
    const outside = CAREER_QUALIFIER.advanceSlots + 1;
    expect(newcomerRepKindFor("qualifier", "swiss_exit", ctx({ seed: outside, swissWins: N.deepRunWins }))).toBe("qualifierDeepRun");
    expect(newcomerRepKindFor("qualifier", "swiss_exit", ctx({ seed: outside, swissWins: N.deepRunWins - 1 }))).toBeNull();
    expect(newcomerRepKindFor("qualifier", "swiss_exit", ctx({ seed: CAREER_QUALIFIER.advanceSlots, swissWins: 2 }))).toBeNull();
    expect(
      newcomerRepKindFor("qualifier", "swiss_exit", ctx({ seed: outside, swissWins: 2, deepRunsThisSplit: N.deepRunsPerSplit })),
    ).toBeNull();
    // Qualifying already pays (eventRepKindFor's qualifierAdvance), never twice.
    expect(newcomerRepKindFor("qualifier", "top8", ctx({ seed: outside }))).toBeNull();
  });

  it("only while the org is making its name; no other tier pays", () => {
    expect(newcomerRepKindFor("t3", "top4", ctx({ rep: N.repCeiling }))).toBeNull();
    expect(newcomerRepKindFor("t3", "top4", ctx({ rep: N.repCeiling - 1 }))).toBe("t3Semi");
    for (const tier of ["t2", "regional", "major", "worlds"] as const)
      for (const p of ["top4", "swiss_exit", "top8"] as Placement[]) expect(newcomerRepKindFor(tier, p, ctx({ seed: 12 }))).toBeNull();
  });
});

/** The save on `def`'s matchday with it committed, played to the end (instant). */
function played(save: CareerSave, def: CareerEventDef): CareerSave {
  const next = structuredClone(save);
  next.clock.day = def.day;
  next.pendingEventDef = def;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.pendingUnavailability = null;
  return simEventToEnd(startEvent(next, false));
}

function previewOf(s: CareerSave) {
  const ev = s.activeEvent!;
  return {
    tier: ev.def.tier,
    placement: placementOf(ev.tournament, "user"),
    reputation: s.reputation,
    flags: s.flags,
    seasonIndex: s.clock.seasonIndex,
    day: s.clock.day,
    tournament: ev.tournament,
  };
}

describe("RTW-02 — finishEvent awards it, the digest previews the same (real EU events)", () => {
  const cup: CareerEventDef = {
    id: "0:5:unofficial",
    tier: "t3",
    region: "EU",
    seasonIndex: 0,
    week: 5,
    day: firstDayOfWeek(5) + 5,
    name: "Neon Cup",
    format: "single",
  };

  it("an EU cup semi-final as the third seed pays (the cup's per-split cap holds); the digest shows the same", () => {
    let checked = 0;
    for (let seed = 60_200; seed < 60_240 && checked < 2; seed++) {
      const grown = createCareerSave(INPUT, seed);
      // A late-split newcomer who has developed beyond the frozen local scene.
      // This integration test needs a semi-final, not easy founding matches.
      grown.competition.localAnchor = { region: "EU", rating: localAnchorRatingFor(grown) };
      for (const player of grown.squad) player.overall += 4;
      const s = played(grown, cup);
      const p = previewOf(s);
      if (p.placement !== "top4" || userSeedIn(s.activeEvent!.tournament) < N.t3SemiMinSeed) continue;
      checked += 1;
      expect(eventRepPreviewKind(p)).toBe("t3Semi");
      const after = finishEvent(s);
      expect(after.reputation - s.reputation).toBe(CAREER_REP.gains.t3Semi);
      expect(eventRepPreview(p)).toBe(after.reputation - s.reputation);
      // The cup's shared cap: once spent, the semi pays nothing.
      const capped = structuredClone(s);
      (capped.flags as Record<string, unknown>)[t3RepKeyFor(0, 1)] = CAREER_UNOFFICIAL.t3RepCapPerSplit;
      expect(finishEvent(capped).reputation).toBe(s.reputation);
      // Above the ceiling only placements pay.
      const established = structuredClone(s);
      established.reputation = N.repCeiling;
      expect(finishEvent(established).reputation).toBe(N.repCeiling);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("an EU qualifier decider seeded outside the eight pays, once a split", () => {
    const qualifier = qualifierDefsForWeek(0, 4).find((d) => d.region === "EU")!;
    let checked = 0;
    for (let seed = 60_300; seed < 60_360 && checked < 1; seed++) {
      const s = played(createCareerSave(INPUT, seed), qualifier);
      const p = previewOf(s);
      const t = s.activeEvent!.tournament;
      if (p.placement !== "swiss_exit" || userSwissWinsIn(t) < N.deepRunWins || userSeedIn(t) <= CAREER_QUALIFIER.advanceSlots) continue;
      checked += 1;
      expect(eventRepPreviewKind(p)).toBe("qualifierDeepRun");
      const after = finishEvent(s);
      expect(after.reputation - s.reputation).toBe(CAREER_REP.gains.qualifierDeepRun);
      expect((after.flags as Record<string, unknown>)[deepRunKeyFor(0, 1)]).toBe(1);
      // A second decider in the same split pays nothing.
      const again = structuredClone(s);
      (again.flags as Record<string, unknown>)[deepRunKeyFor(0, 1)] = N.deepRunsPerSplit;
      expect(finishEvent(again).reputation).toBe(s.reputation);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
