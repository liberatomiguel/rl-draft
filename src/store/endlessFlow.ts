/**
 * v2.2 ENDLESS (FEATURES.endlessVariety): the store side of the front. The
 * rules live in engine/career/endless.ts; careerFlow calls these with one-line
 * hooks (the rollover, the Saturday offer, the cup's bracket).
 */
import { CAREER_CALENDAR, CAREER_ENDLESS, FEATURES } from "@/config/balance";
import { seasonLabelFor, weekAt } from "@/engine/career/calendar";
import { deliverNews } from "@/engine/career/communications";
import {
  cupDrawSeeds,
  endlessOn,
  endlessYear,
  isLegendRef,
  LEGEND_REF_PREFIX,
  legendsWeekFor,
  legendTeamFor,
  majorHostsFor,
  eliteBonusFor,
  rivalProjectsPass,
  worldsStreakOf,
  worldWeekFor,
} from "@/engine/career/endless";
import { PARTNER_EVENT_NAMES } from "@/data/career/names";
import type { CareerEventDef, CareerSave } from "@/engine/career/types";
import { userTeamFor } from "@/engine/career/worldSim";
import { createPlayoffs } from "@/engine/playoffs";
import type { TournamentState } from "@/engine/types";

/** The Legends invitational's event name (a proper name, like the Invitational rotation's). */
export const LEGENDS_EVENT_NAME = "Legends Invitational";
/** The Intercontinental Invitational: guests from the other regions' tables. */
export const WORLD_EVENT_NAME = "Intercontinental Invitational";
/** How many host cities the copy lists (copy.career endless.hosts); the draw picks four a season. */
export const HOST_CITY_COUNT = 12;

function userRatingOf(save: CareerSave): number {
  return userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: 0,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    unavailablePlayerId: null,
  }).team.rating.total;
}

/**
 * At the rollover into `nextSeason` (the clock already moved): the front
 * starts for this save if it had not, and in the endless years the world
 * answers a dominant team. The user's squad is never touched.
 */
export function endlessRollover(save: CareerSave, nextSeason: number): void {
  if (!FEATURES.endlessVariety) return;
  const last = save.endless?.projects ?? [];
  save.endless = { ...(save.endless ?? { fromSeason: nextSeason }), projects: [] };
  if (!endlessYear(nextSeason)) return;
  const cities = majorHostsFor(nextSeason, save.careerSeed, HOST_CITY_COUNT);
  save.endless.hosts = { season: nextSeason, cities };
  deliverNews(save, {
    type: "milestone",
    priority: 1,
    titleKey: "endlessHosts",
    params: { season: seasonLabelFor(nextSeason), h1: cities[0], h2: cities[1], h3: cities[2], h4: cities[3] },
  });
  const streak = worldsStreakOf(save.honors, nextSeason - 1);
  const running = last.filter((p) => p.season === nextSeason - 1);
  const res = rivalProjectsPass(save.world, {
    careerSeed: save.careerSeed,
    seasonIndex: nextSeason,
    difficulty: save.difficulty,
    userSquadIds: save.squad.map((p) => p.id),
    userRating: userRatingOf(save),
    userRegion: save.identity.region,
    running,
    // An org whose project ended last season (not continued now) rests this one.
    restingRefs: last.filter((p) => p.season === nextSeason - 2 && !running.some((r) => r.orgRef === p.orgRef)).map((p) => p.orgRef),
    streak,
  });
  save.world = res.world;
  // Last season's record stays one more season (who rests); this season's projects follow.
  save.endless.projects = [...running, ...res.projects];
  save.endless.gap = Math.round(res.gap * 10) / 10;
  save.endless.strength = res.strength;
  save.endless.streak = streak;
  for (const p of res.projects) {
    const mine = p.region === save.identity.region;
    const before = running.find((r) => r.orgRef === p.orgRef);
    const kit = p.items.join(",");
    if (before) {
      // A core kept together: news only when the kit grew or it signed again.
      const added = p.items.filter((k) => !before.items.includes(k));
      if (added.length === 0 && p.signed.length === 0) continue;
      deliverNews(save, {
        type: "milestone",
        priority: mine ? 2 : 1,
        titleKey: "endlessProjectGrows",
        params: { org: p.orgName, region: p.region, kit: added.join(","), p1: p.signed[0]?.playerName ?? "", season: p.season - p.since + 1, after: p.ratingAfter.toFixed(1) },
      });
      continue;
    }
    const [a, b, c] = p.signed.map((x) => x.playerName);
    deliverNews(save, {
      type: "milestone",
      priority: mine ? 3 : 2,
      titleKey: "endlessProject",
      params: { org: p.orgName, region: p.region, p1: a ?? "", p2: b ?? "", p3: c ?? "", n: p.signed.length, kit, before: p.ratingBefore.toFixed(1), after: p.ratingAfter.toFixed(1) },
    });
  }
}

/** M2.1's extra ceiling for this rollover's new elite promotions (careerFlow's worldLifeRollover passes it on). */
export function endlessEliteBonus(save: CareerSave, nextSeason: number): number {
  if (!endlessOn(save, nextSeason)) return 0;
  return eliteBonusFor(worldsStreakOf(save.honors, nextSeason - 1), nextSeason);
}

/** The arrival of a stronger elite generation, in the news (only when the dynasty lifted it). */
export function endlessGenerationNews(save: CareerSave, lifted: readonly { playerName: string; region: string; potential: number }[], bonus: number): void {
  if (bonus <= 0 || lifted.length === 0) return;
  const best = [...lifted].sort((x, y) => y.potential - x.potential)[0];
  deliverNews(save, { type: "milestone", priority: 2, titleKey: "endlessGeneration", params: { n: lifted.length, player: best.playerName, region: best.region } });
}

/** The season's open weeks (the Legends draw reads them). */
function openWeeks(): number[] {
  const out: number[] = [];
  for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) if (weekAt(w).kind === "open") out.push(w);
  return out;
}

/**
 * The Saturday offer as the front shapes it: an Invitational with the drawn
 * field and bracket, or, on the season's Legends weeks for a strong enough
 * team, the Legends invitational. Partner championships (a set region) and
 * Community Cups are left as they are. Same id, day and tier, so the forecast,
 * the lobby and the settlement read one event.
 */
export function endlessOffer(save: CareerSave, def: CareerEventDef | null, starterAverage: number): CareerEventDef | null {
  if (!def || def.tier !== "t2" || def.region || def.endless || !endlessOn(save, def.seasonIndex)) return def;
  // A partner's edition (Duds Cup) keeps its week and its art: only its field and draw change.
  if (PARTNER_EVENT_NAMES.includes(def.name)) return { ...def, endless: "cup" };
  if (
    starterAverage >= CAREER_ENDLESS.legends.minStarterOverall &&
    legendsWeekFor(def.seasonIndex, def.week, save.careerSeed, openWeeks())
  ) {
    return { ...def, name: LEGENDS_EVENT_NAME, endless: "legends" };
  }
  if (worldWeekFor(def.seasonIndex, def.week, save.careerSeed, openWeeks())) return { ...def, name: WORLD_EVENT_NAME, endless: "world" };
  return { ...def, endless: "cup" };
}

/** startEvent's bracket: a drawn cup re-seeds its single elimination (the two best seeds stay apart). */
export function withEndlessDraw(t: TournamentState, def: CareerEventDef, careerSeed: number): TournamentState {
  if (!def.endless || def.format !== "single" || !t.playoffs) return t;
  return { ...t, playoffs: createPlayoffs(cupDrawSeeds(t.teams, def, careerSeed), "single") };
}

/** A Legends side's display name (the lineup and its year), for results and the wire. */
export function legendNameOf(ref: string): string | null {
  if (!isLegendRef(ref)) return null;
  try {
    return legendTeamFor(ref.slice(LEGEND_REF_PREFIX.length), "normal").name;
  } catch {
    return null;
  }
}
