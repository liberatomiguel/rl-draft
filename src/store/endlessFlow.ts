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
  rivalProjectsPass,
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
  const res = rivalProjectsPass(save.world, {
    careerSeed: save.careerSeed,
    seasonIndex: nextSeason,
    difficulty: save.difficulty,
    userSquadIds: save.squad.map((p) => p.id),
    userRating: userRatingOf(save),
    userRegion: save.identity.region,
    lastProjectRefs: last.filter((p) => p.season >= nextSeason - CAREER_ENDLESS.projects.seasons).map((p) => p.orgRef),
    runningProjectRefs: last.filter((p) => p.season > nextSeason - CAREER_ENDLESS.projects.seasons && p.facility > 0).map((p) => p.orgRef),
  });
  save.world = res.world;
  // The running projects stay on the record (rotation, the review); only the new ones make the news.
  save.endless.projects = [...last.filter((p) => p.season > nextSeason - CAREER_ENDLESS.projects.seasons), ...res.projects];
  save.endless.gap = Math.round(res.gap * 10) / 10;
  for (const p of res.projects) {
    const mine = p.region === save.identity.region;
    const [a, b, c] = p.signed.map((s) => s.playerName);
    deliverNews(save, {
      type: "milestone",
      priority: mine ? 3 : 2,
      titleKey: "endlessProject",
      params: {
        org: p.orgName,
        region: p.region,
        p1: a ?? "",
        p2: b ?? "",
        p3: c ?? "",
        n: p.signed.length,
        from: p.signed[0]?.fromName ?? "",
        before: p.ratingBefore.toFixed(1),
        after: p.ratingAfter.toFixed(1),
        fac: p.facility > 0 ? 1 : 0,
      },
    });
  }
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
