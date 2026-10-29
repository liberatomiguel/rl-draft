/**
 * Road to Worlds rc.29 (CAR-06) — the event lobby's "The field" lists exactly
 * the teams that play. The Community Cup lobby ranked the orgs by their
 * STORED ratings against the preview rating while the engine ranked intrinsic
 * team ratings against the fielded user team, so it could list a team that
 * did not play and omit one that did (the Invitational and a regional without
 * Saturday's list had the same tie-break). The lobby now reads the engine's
 * own helpers; every check starts the event for real and compares. Review R1:
 * the seeded fields (the Saturday qualifier, a regional with Saturday's list)
 * also seed the user as the engine does — the fielded rating, not the
 * starters' plain average — so the direct-8 line cannot split them. rc.30
 * (direct-8): the Monday commit reads that same team rating, so the HQ, the
 * lobby and the engine sit on the same side of the line.
 */

import { describe, expect, it } from "vitest";
import { TOURNAMENT } from "@/config/balance";
import { officialEventDefsForWeek, qualifierDefsForWeek, seasonSchedule } from "@/engine/career/calendar";
import { repTierOf } from "@/engine/career/economy";
import { localSceneRefs } from "@/engine/career/localScene";
import { deriveSeed } from "@/engine/career/seeds";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { regionalSeedingFor, t3FieldRefsFor } from "@/engine/career/worldSim";
import {
  createCareerSave,
  startEvent,
  userIsDirect,
  userTeamForEvent,
  type CreateCareerInput,
} from "@/store/careerFlow";
import { eventTeamPreview, userTeamPreview } from "../careerUi";
import { lobbyFieldRefs } from "./lobbyField";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Lobby Check",
    abbrev: "LBY",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

/** A save parked on `def`'s matchday, the event committed. */
function onMatchday(seed: number, def: CareerEventDef): CareerSave {
  const save = structuredClone(createCareerSave(INPUT, seed));
  save.clock.day = def.day;
  save.pendingEventDef = def;
  save.unofficialOffer = null;
  return save;
}

/** Stored org ratings drift from the rosters between computeStars passes. */
function staleRatings(save: CareerSave): void {
  for (const org of Object.values(save.world.orgs)) {
    const bump = deriveSeed(7, org.ref) % 2 === 0 ? 7 : -7;
    org.rating = (org.rating ?? 70) + bump;
  }
}

/**
 * Review R1: puts the direct-8 line BETWEEN the starters' plain average (the
 * Monday commit's read, careerFlow.userSeedingFor) and the fielded team's
 * rating (what fieldForEvent seeds the user with): every SAM org at the
 * user's prestige with no split points, seven clear of both, the 8th in the
 * gap, the rest below. Returns the 8th org's ref.
 */
function straddleDirectLine(save: CareerSave, def: CareerEventDef): string {
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  const average = starters.reduce((s, p) => s + p.overall, 0) / starters.length;
  const fielded = eventTeamPreview(save, def).rating.total;
  expect(Math.abs(fielded - average), "the two reads differ").toBeGreaterThan(0.5);
  const prestige = repTierOf(save.reputation);
  expect(prestige).toBeLessThanOrEqual(3);
  save.competition.splitPoints.SAM = {};
  const orgs = Object.values(save.world.orgs)
    .filter((o) => o.region === "SAM")
    .sort((a, b) => a.ref.localeCompare(b.ref));
  expect(orgs.length).toBeGreaterThan(TOURNAMENT.swiss.teams / 2);
  orgs.forEach((org, i) => {
    org.prestige = prestige as typeof org.prestige;
    org.rating = i < 7 ? 99 - i : i === 7 ? (average + fielded) / 2 : 40 + i / 10;
  });
  return orgs[7].ref;
}

/** Would the starters' plain average (the pre-rc.30 Monday read) seat the user in the direct 8? */
function starterAverageSeating(save: CareerSave): boolean {
  const starters = save.squad.filter((p) => save.starterIds.includes(p.id));
  const average = starters.reduce((s, p) => s + p.overall, 0) / starters.length;
  return regionalSeedingFor({
    orgs: Object.values(save.world.orgs).filter((o) => o.region === "SAM"),
    splitPoints: save.competition.splitPoints.SAM ?? {},
    user: { rating: average, prestige: repTierOf(save.reputation) },
  }).direct.includes("user");
}

function playedRefs(save: CareerSave): string[] {
  const started = startEvent(save, false);
  expect(started.activeEvent, "the event starts").not.toBeNull();
  return Object.keys(started.activeEvent!.tournament.teams).sort();
}

function listedRefs(save: CareerSave, def: CareerEventDef): string[] {
  return lobbyFieldRefs(save, def, eventTeamPreview(save, def).rating.total).sort();
}

const cupOf = (tier: "t3" | "t2"): CareerEventDef => ({
  id: `0:5:unofficial`,
  tier,
  region: "SAM",
  seasonIndex: 0,
  week: 5,
  day: 34,
  name: tier === "t3" ? "Neon Cup" : "Prime Showdown",
  format: "single",
});

describe("the lobby lists exactly the teams that play (rc.29 CAR-06)", { timeout: 60_000 }, () => {
  it("Community Cup: same seven opponents as the engine, even with stale stored ratings and a ruled-out starter", () => {
    const def = cupOf("t3");
    let oldRuleMissed = 0;
    for (const seed of [101, 202, 303, 404, 505, 606]) {
      const save = onMatchday(seed, def);
      staleRatings(save);
      // A starter ruled out for this cup: the fielded team is not the preview.
      save.pendingUnavailability = { eventId: def.id, playerId: save.starterIds[0] };
      expect(eventTeamPreview(save, def).rating.total).not.toBe(userTeamPreview(save).rating.total);
      expect(eventTeamPreview(save, def).rating.total).toBe(userTeamForEvent(save, def).team.rating.total);

      const played = playedRefs(save);
      expect(listedRefs(save, def)).toEqual(played);

      // The pre-rc.29 lobby rule (stored ratings vs the preview) — it drifts.
      const old = [
        "user",
        ...t3FieldRefsFor({
          region: "SAM",
          seasonIndex: 0,
          userRating: userTeamPreview(save).rating.total,
          orgRatings: Object.values(save.world.orgs)
            .filter((o) => o.region === "SAM")
            .map((o) => ({ ref: o.ref, rating: o.rating ?? 70 })),
          seats: 7,
        }),
      ].sort();
      if (old.join() !== played.join()) oldRuleMissed += 1;
    }
    // The scenario is real: the old rule listed another field at least once.
    expect(oldRuleMissed).toBeGreaterThan(0);
  });

  it("Invitational and a regional without Saturday's list: the points ranking's tie-break is the engine's", () => {
    const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
    const regional = officialEventDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    for (const seed of [111, 222, 333]) {
      for (const def of [cupOf("t2"), regional]) {
        const save = onMatchday(seed, def);
        staleRatings(save);
        expect(save.competition.qualifiedRefs?.SAM ?? null).toBeNull();
        expect(listedRefs(save, def), `${def.tier} ${seed}`).toEqual(playedRefs(save));
      }
    }
  });

  it("the Saturday qualifier lists its sixteen, local sides included", () => {
    const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
    const def = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    const save = onMatchday(55501, def);
    const listed = listedRefs(save, def);
    expect(listed).toHaveLength(16);
    expect(listed.some((ref) => ref.startsWith("local:"))).toBe(true);
    expect(listed).toEqual(playedRefs(save));
  });

  it("review R1 / rc.30: near the direct-8 line the qualifier lobby, the engine and the Monday read agree", () => {
    const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
    const def = qualifierDefsForWeek(0, W).find((d) => d.region === "SAM")!;
    let averageMissed = 0;
    for (const seed of [55501, 66602, 77703, 88804]) {
      const save = onMatchday(seed, def);
      const eighth = straddleDirectLine(save, def);
      const played = playedRefs(save);
      expect(played).toContain("user");
      expect(listedRefs(save, def), `seed ${seed}`).toEqual(played);
      // A user the Monday read seats in the direct 8 displaces the org on the
      // line into Saturday — exactly the field the engine builds.
      expect(played.includes(eighth), `seed ${seed}`).toBe(userIsDirect(save));
      // The starters' plain average (the pre-rc.30 Monday read) sits on the
      // other side of the line every time.
      if (starterAverageSeating(save) !== userIsDirect(save)) averageMissed += 1;
    }
    expect(averageMissed).toBe(4);
  });

  it("review R1 / rc.30: Sunday's regional with Saturday's list seeds its direct 8 the same way", () => {
    const W = seasonSchedule().find((w) => w.kind === "regional")!.week;
    const def = officialEventDefsForWeek(0, W).find((d) => d.tier === "regional" && d.region === "SAM")!;
    for (const seed of [55501, 66602, 77703, 88804]) {
      const save = onMatchday(seed, def);
      const eighth = straddleDirectLine(save, def);
      // Saturday's eight: the low orgs and the local scene — neither the
      // user nor the org on the direct-8 line.
      const low = Object.values(save.world.orgs)
        .filter((o) => o.region === "SAM")
        .sort((a, b) => a.ref.localeCompare(b.ref))
        .slice(8)
        .map((o) => o.ref);
      const qualified = [...low, ...localSceneRefs("SAM", 0)].slice(0, 8);
      save.competition.qualifiedRefs = { ...(save.competition.qualifiedRefs ?? {}), SAM: { eventId: def.id, refs: qualified } };
      const played = playedRefs(save);
      expect(played).toContain("user");
      expect(listedRefs(save, def), `seed ${seed}`).toEqual(played);
      // The org on the line plays Sunday only from a direct seat the user did not take.
      expect(played.includes(eighth), `seed ${seed}`).toBe(!userIsDirect(save));
    }
  });
});
