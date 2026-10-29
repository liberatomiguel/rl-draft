/**
 * Road to Worlds — the event lobby's "The field" list (pure TS, no React).
 *
 * The lobby mirrors worldSim.fieldForEvent's selection without building the
 * event. rc.29 (CAR-06): every branch reads the ENGINE's own selection
 * helpers — t3CupRefsFor (Community Cup), orgsByPointsFor (Invitational, a
 * regional without Saturday's list), qualifierEventRefsFor /
 * regionalEventRefsFor (the seeded official fields) — around the team the
 * user fields (careerUi.eventTeamPreview, startEvent's build), so the lobby
 * lists exactly the teams that play. It used to rank by the orgs' STORED
 * ratings against the preview rating and could list a team that did not
 * play while omitting one that did; rc.29 review (R1): the seeded fields
 * also read the user's seeding row as the engine does — the fielded rating,
 * not the starters' plain average.
 */

import { TOURNAMENT } from "@/config/balance";
import { repTierOf } from "@/engine/career/economy";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import {
  orgsByPointsFor,
  qualifierEventRefsFor,
  regionalEventRefsFor,
  t3CupRefsFor,
} from "@/engine/career/worldSim";

/**
 * The refs the event fields ("user" = the user's team). `userRating` is the
 * fielded team's rating.total (careerUi.eventTeamPreview — startEvent's build).
 */
export function lobbyFieldRefs(save: CareerSave, def: CareerEventDef, userRating: number): string[] {
  if (def.tier === "major") return save.competition.majorFieldRefs ?? [];
  if (def.tier === "worlds") return save.competition.worldsFieldRefs ?? [];
  const region = def.region ?? save.identity.region;
  // fieldForEvent's user row: the user competes for the direct 8 of their
  // own region only, with the fielded rating and the reputation tier.
  const ownRegion = region === save.identity.region;
  // rc.30 (direct-8): the seeded fields read the week's committed seeding
  // (competition.weekSeeding) when it exists, exactly like the engine.
  const seeded = {
    world: save.world,
    competition: save.competition,
    region,
    seasonIndex: def.seasonIndex,
    week: def.week,
    userSeed: ownRegion ? { rating: userRating, prestige: repTierOf(save.reputation) } : null,
    fieldsUser: ownRegion,
    careerSeed: save.careerSeed,
  };
  const ranked = (points: Record<string, number>) =>
    orgsByPointsFor({
      world: save.world,
      region,
      points,
      seasonIndex: def.seasonIndex,
      careerSeed: save.careerSeed,
      difficulty: save.difficulty,
    });
  if (def.tier === "qualifier") {
    // v2.0 (R30 / R40): the non-direct orgs + the local scene, the user seated.
    return qualifierEventRefsFor(seeded);
  }
  if (def.tier === "regional") {
    const qualified = save.competition.qualifiedRefs?.[region];
    if (qualified && qualified.eventId === def.id) {
      // The direct top 8 + Saturday's eight (backfilled like the engine).
      return regionalEventRefsFor({ ...seeded, qualified: qualified.refs });
    }
    const top = ranked(save.competition.splitPoints[region] ?? {});
    return ownRegion
      ? ["user", ...top.slice(0, TOURNAMENT.swiss.teams - 1)]
      : top.slice(0, TOURNAMENT.swiss.teams);
  }
  if (def.tier === "t3") {
    // v2.0 (R23): closest orgs, ≤2 stronger, locals fill — the engine's helper.
    return [
      "user",
      ...t3CupRefsFor({
        world: save.world,
        region,
        seasonIndex: def.seasonIndex,
        careerSeed: save.careerSeed,
        difficulty: save.difficulty,
        userRating,
      }),
    ];
  }
  const top = ranked(save.competition.seasonPoints[region] ?? {});
  return ["user", ...top.slice(0, TOURNAMENT.quick.teams - 1)];
}
