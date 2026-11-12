/**
 * Season 1 (R133) — Rocket Street, South America's regional partner: what its
 * news desk files, and which news the feed signs with its name.
 *
 * Pure. Every story is derived from results, the transfer log and the
 * calendar; its line (the `v` param, one of CAREER_ROCKET_STREET.variants) and
 * the regionals it recaps come from their own derived streams
 * (`gen:rsDesk:*`), so nothing here draws from — or reorders — an RNG the
 * world, the market or an event uses. The desk writes only for a career based
 * in its region; it adds no field to the save.
 */

import { CAREER_ROCKET_STREET } from "@/config/balance";
import { ROCKET_STREET_EVENT_NAME } from "@/data/career/names";
import type { Region } from "../types";
import { derivedFloat, streams } from "./seeds";
import type { CareerEventDef, CompactEventResult, NewsItem, TransferLogEntry } from "./types";

export type RocketStreetDraft = Omit<NewsItem, "id" | "seasonIndex" | "week" | "day" | "read">;

/** The desk's own templated stories (career.news.tpl / .body keys). */
export const ROCKET_STREET_KEYS: ReadonlySet<string> = new Set([
  "rsCupPreview",
  "rsCupRecap",
  "rsRegionalRecap",
  "rsBerths",
  "rsWindowWrap",
]);

/** A scripted beat the desk signs (curated: never inferred from a club's region). */
const SIGNED_BEATS: ReadonlySet<string> = new Set(["sx-sam-hungry"]);
/** World news the desk signs when it is about its region (`params.region`). */
const SIGNED_REGIONAL_KEYS: ReadonlySet<string> = new Set(["rookieClass", "orgLeaves"]);

/** Is `region` the one the partner covers? */
export function rocketStreetCovers(region: Region | undefined): boolean {
  return region === CAREER_ROCKET_STREET.region;
}

/**
 * Does Rocket Street sign this item? Its own stories, the curated beat, and
 * the region's rookie class and departing organisations. Transfers and news
 * centred on one club keep the desk's general brand.
 */
export function rocketStreetSigns(item: Pick<NewsItem, "titleKey" | "beatId" | "params">): boolean {
  if (item.beatId !== undefined && SIGNED_BEATS.has(item.beatId)) return true;
  if (ROCKET_STREET_KEYS.has(item.titleKey)) return true;
  return SIGNED_REGIONAL_KEYS.has(item.titleKey) && item.params?.region === CAREER_ROCKET_STREET.region;
}

/** The line a story is written in: stable per story, drawn on the desk's own stream. */
function variantOf(careerSeed: number, story: string): number {
  return Math.floor(derivedFloat(careerSeed, streams.gen("rsDesk", story)) * CAREER_ROCKET_STREET.variants);
}

const REGION = CAREER_ROCKET_STREET.region;
const PRIORITY = CAREER_ROCKET_STREET.priority;

/** Monday of a championship week: the build-up (the invitation is the week's offer). */
export function rocketStreetCupPreview(ctx: {
  careerSeed: number;
  userRegion: Region;
  def: CareerEventDef | null;
  orgName: string;
}): RocketStreetDraft | null {
  if (!rocketStreetCovers(ctx.userRegion) || ctx.def?.name !== ROCKET_STREET_EVENT_NAME) return null;
  return {
    type: "milestone",
    priority: PRIORITY.cupPreview,
    titleKey: "rsCupPreview",
    params: {
      event: ctx.def.name,
      org: ctx.orgName,
      region: REGION,
      v: variantOf(ctx.careerSeed, `cupPreview:${ctx.def.id}`),
    },
  };
}

/**
 * A banked result the desk reports: its own championship (always), or one of
 * the region's regionals (CAREER_ROCKET_STREET.regionalRecapChance of them).
 */
export function rocketStreetResultStory(ctx: {
  careerSeed: number;
  userRegion: Region;
  result: CompactEventResult;
}): RocketStreetDraft | null {
  if (!rocketStreetCovers(ctx.userRegion)) return null;
  const { result } = ctx;
  const champion = result.rows.find((r) => r.placement === "champion");
  const runnerUp = result.rows.find((r) => r.placement === "runner_up");
  if (!champion || !runnerUp) return null;
  const common = { event: result.name, champion: champion.name, runnerUp: runnerUp.name, region: REGION };

  if (result.name === ROCKET_STREET_EVENT_NAME) {
    const mine = result.rows.find((r) => r.ref === "user");
    return {
      type: "result",
      priority: PRIORITY.cupRecap,
      titleKey: "rsCupRecap",
      params: {
        ...common,
        ...(mine ? { org: mine.name, placement: mine.placement } : {}),
        won: champion.ref === "user" ? 1 : 0,
        v: variantOf(ctx.careerSeed, `cupRecap:${result.eventId}`),
      },
    };
  }

  if (result.tier !== "regional" || result.region !== REGION) return null;
  if (derivedFloat(ctx.careerSeed, streams.gen("rsDesk", `covers:${result.eventId}`)) >= CAREER_ROCKET_STREET.regionalRecapChance) {
    return null;
  }
  return {
    type: "result",
    priority: PRIORITY.regionalRecap,
    titleKey: "rsRegionalRecap",
    params: { ...common, split: result.split ?? 0, v: variantOf(ctx.careerSeed, `regional:${result.eventId}`) },
  };
}

/** A Major / Worlds field is announced: the region's sides in it (none: no story). */
export function rocketStreetBerths(ctx: {
  careerSeed: number;
  userRegion: Region;
  eventId: string;
  eventName: string;
  /** The region's qualified sides, best seed first. */
  names: readonly string[];
}): RocketStreetDraft | null {
  if (!rocketStreetCovers(ctx.userRegion) || ctx.names.length === 0) return null;
  return {
    type: "milestone",
    priority: PRIORITY.berths,
    titleKey: "rsBerths",
    params: {
      event: ctx.eventName,
      t1: ctx.names[0],
      t2: ctx.names[1] ?? "",
      n: ctx.names.length,
      region: REGION,
      v: variantOf(ctx.careerSeed, `berths:${ctx.eventId}`),
    },
  };
}

/** A transfer window shut: the region's moves in it, led by its biggest signing. */
export function rocketStreetWindowWrap(ctx: {
  careerSeed: number;
  userRegion: Region;
  seasonIndex: number;
  windowIdx: number;
  /** The window's logged moves (every region; the desk keeps its own). */
  moves: readonly TransferLogEntry[];
  nameOf: (ref: string) => string;
}): RocketStreetDraft | null {
  if (!rocketStreetCovers(ctx.userRegion)) return null;
  const mine = ctx.moves.filter((t) => t.region === REGION);
  if (mine.length < CAREER_ROCKET_STREET.windowWrapMinMoves) return null;
  const lead = [...mine].filter((t) => t.toRef !== null).sort((a, b) => b.fee - a.fee)[0];
  if (!lead || lead.toRef === null) return null;
  return {
    type: "window",
    priority: PRIORITY.windowWrap,
    titleKey: "rsWindowWrap",
    params: {
      n: mine.length,
      player: lead.playerName,
      to: ctx.nameOf(lead.toRef),
      fee: lead.fee,
      paid: lead.fee > 0 ? 1 : 0,
      region: REGION,
      v: variantOf(ctx.careerSeed, `window:${ctx.seasonIndex}:${ctx.windowIdx}`),
    },
  };
}

/**
 * The rollover's rookie class: when the world's headline rookie is from
 * another region, the desk still files its own region's class (the feed's
 * existing "rookieClass" story, which it signs). Null: no rookie of the
 * region, or the headline already is one.
 */
export function rocketStreetRookieClass(ctx: {
  userRegion: Region;
  rookies: readonly { name: string; region: Region }[];
}): RocketStreetDraft | null {
  if (!rocketStreetCovers(ctx.userRegion) || ctx.rookies.length === 0 || ctx.rookies[0].region === REGION) return null;
  const local = ctx.rookies.find((r) => r.region === REGION);
  if (!local) return null;
  return {
    type: "milestone",
    priority: PRIORITY.rookies,
    titleKey: "rookieClass",
    params: { region: REGION, name: local.name },
  };
}
