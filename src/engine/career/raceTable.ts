/**
 * Road to Worlds — the two race tables (RTW-01, R49), per region:
 *  - the MAJOR table: that split's regional points (`competition.splitPoints`),
 *    cut at CAREER_SLOTS.major — the split's Major field;
 *  - the WORLDS table: the season's regional + Major points
 *    (`competition.seasonPoints`), cut at CAREER_SLOTS.worlds — the Worlds field.
 *
 * A pure view-model (no React) that the Standings screen and the HQ toggle
 * both read. It ranks with `rankByPoints`, the order majorFieldFor /
 * worldsFieldFor select by, so the line on screen is the line that decides
 * the field. Every team of the region is listed — real orgs, generic (filler)
 * orgs, the user and, from their first points, local amateur sides.
 */

import { CAREER_CALENDAR, CAREER_POINTS, CAREER_SLOTS, CAREER_UNOFFICIAL } from "@/config/balance";
import type { Region } from "../types";
import { eventEndDayFor, officialEventDefsForWeek, splitOfWeek, weekOfDay } from "./calendar";
import { rankByPoints } from "./careerResults";
import { isLocalRef } from "./localScene";
import type { CompactEventResult, CompetitionState, WorldState } from "./types";

export type RaceKind = "major" | "worlds";

/** Who a row is: the user, a real (dataset) org, a generic (filler) org or a local amateur side. */
export type RaceSide = "user" | "org" | "generic" | "local";

/** The user's standing in the race: safe whatever happens, still open, or out of reach. */
export type RaceStatus = "clinched" | "contention" | "out";

export interface RaceRow {
  ref: string;
  name: string;
  points: number;
  /** 1-based position, in the selection's own order. */
  rank: number;
  side: RaceSide;
  /** Inside the cut (rank ≤ cut): holds a slot if the race ended today. */
  inCut: boolean;
  /** In the announced field; null while the field is not announced. */
  qualified: boolean | null;
}

export interface RaceTable {
  kind: RaceKind;
  region: Region;
  /** The region's slots (CAREER_SLOTS.major / .worlds) — the cut line sits under this rank. */
  cut: number;
  rows: RaceRow[];
  /** The user's row (their own region only). */
  userRow: RaceRow | null;
  /** The user's status (their own region only). */
  userStatus: RaceStatus | null;
  /** Points behind the last seat of the cut (0 inside it). */
  userGap: number;
  /** The split the Major table counts (the Worlds table counts the whole season). */
  split: 1 | 2 | 3;
  /** Points events of this race still to finish: the region's regionals, plus the Majors for Worlds. */
  fixturesLeft: { regionals: number; majors: number; total: number };
  /** The most one team can still add: a champion's haul in every fixture left. */
  maxPointsLeft: number;
  /** The field this race decides is announced (`majorFieldRefs` / `worldsFieldRefs`). */
  announced: boolean;
}

export interface RaceTableInput {
  kind: RaceKind;
  region: Region;
  competition: CompetitionState;
  world: WorldState;
  clock: { seasonIndex: number; day: number };
  userRegion: Region;
  careerSeed: number;
  /** Results on file: an event that ends today counts as left until its result lands. */
  results: readonly Pick<CompactEventResult, "eventId">[];
  nameOf: (ref: string) => string;
}

export function sideOfRef(ref: string): RaceSide {
  if (ref === "user") return "user";
  if (isLocalRef(ref)) return "local";
  // Filler orgs carry the documented "fill:{region}:{n}" grammar (WorldOrgState.ref).
  return ref.startsWith("fill:") ? "generic" : "org";
}

/** The split whose points the split table holds in `week` (the next one in the preseason). */
export function tableSplitOf(week: number): 1 | 2 | 3 {
  for (let w = week; w >= 1; w--) {
    const split = splitOfWeek(w);
    if (split) return split;
  }
  return 1;
}

/** The race's points events still to finish this season (see RaceTable.fixturesLeft). */
export function fixturesLeftFor(input: {
  kind: RaceKind;
  region: Region;
  clock: { seasonIndex: number; day: number };
  results: readonly Pick<CompactEventResult, "eventId">[];
}): { regionals: number; majors: number; total: number } {
  const { seasonIndex, day } = input.clock;
  const split = tableSplitOf(weekOfDay(day));
  const done = new Set(input.results.map((r) => r.eventId));
  let regionals = 0;
  let majors = 0;
  for (let w = weekOfDay(day); w <= CAREER_CALENDAR.weeksPerSeason; w++) {
    for (const def of officialEventDefsForWeek(seasonIndex, w)) {
      if (done.has(def.id) || eventEndDayFor(def) < day) continue;
      if (def.tier === "regional" && def.region === input.region) {
        if (input.kind === "worlds" || def.split === split) regionals += 1;
      } else if (def.tier === "major" && input.kind === "worlds") {
        majors += 1;
      }
    }
  }
  return { regionals, majors, total: regionals + majors };
}

export function raceTableFor(input: RaceTableInput): RaceTable {
  const { kind, region, competition } = input;
  const table = (kind === "major" ? competition.splitPoints : competition.seasonPoints)[region] ?? {};
  const cut = (kind === "major" ? CAREER_SLOTS.major : CAREER_SLOTS.worlds)[region] ?? 0;
  const field = kind === "major" ? competition.majorFieldRefs : competition.worldsFieldRefs;

  // The selection's order for every team on the table, then the region's
  // teams still without a point (orgs; the user in their own region), by name.
  const ranked = rankByPoints(table, region, input.careerSeed);
  const onTable = new Set(ranked);
  const zero = Object.values(input.world.orgs)
    .filter((o) => o.region === region && !onTable.has(o.ref))
    .map((o) => o.ref);
  if (region === input.userRegion && !onTable.has("user")) zero.push("user");
  const names = new Map([...ranked, ...zero].map((ref) => [ref, input.nameOf(ref)]));
  zero.sort((a, b) => names.get(a)!.localeCompare(names.get(b)!) || a.localeCompare(b));

  const rows: RaceRow[] = [...ranked, ...zero].map((ref, i) => ({
    ref,
    name: names.get(ref)!,
    points: table[ref] ?? 0,
    rank: i + 1,
    side: sideOfRef(ref),
    inCut: i < cut,
    qualified: field ? field.includes(ref) : null,
  }));

  const fixturesLeft = fixturesLeftFor({ kind, region, clock: input.clock, results: input.results });
  const champion = CAREER_POINTS.regional.champion;
  const maxPointsLeft =
    fixturesLeft.regionals * champion + fixturesLeft.majors * champion * CAREER_POINTS.majorMultiplier;

  const userRow = rows.find((r) => r.side === "user") ?? null;
  const cutPoints = cut > 0 ? (rows[cut - 1]?.points ?? 0) : 0;
  const userGap = userRow && !userRow.inCut ? Math.max(0, cutPoints - userRow.points) : 0;

  return {
    kind,
    region,
    cut,
    rows,
    userRow,
    userStatus: userRow ? statusOf(userRow, rows, cut, maxPointsLeft) : null,
    userGap,
    split: tableSplitOf(weekOfDay(input.clock.day)),
    fixturesLeft,
    maxPointsLeft,
    announced: Boolean(field),
  };
}

/**
 * An announced field decides; with nothing left to play the table does.
 * Otherwise conservative bounds (the user may score nothing more, every rival
 * may take every remaining title): clinched when fewer than `cut` teams could
 * end above the user — the teams above today, every listed team within
 * reach, and the local sides that have not scored yet (they can still get
 * there). Out when even a champion's haul in every fixture left stays under
 * the last seat of the cut.
 */
function statusOf(user: RaceRow, rows: RaceRow[], cut: number, maxPointsLeft: number): RaceStatus {
  if (user.qualified !== null) return user.qualified ? "clinched" : "out";
  if (maxPointsLeft === 0) return user.inCut ? "clinched" : "out";
  const lastSeat = rows[cut - 1]?.points ?? 0;
  if (!user.inCut && user.points + maxPointsLeft < lastSeat) return "out";
  if (!user.inCut) return "contention";
  const above = user.rank - 1;
  const catchable = rows.filter((r) => r.rank > user.rank && r.points + maxPointsLeft >= user.points).length;
  const listedLocals = rows.filter((r) => r.side === "local").length;
  const unlisted = maxPointsLeft >= user.points ? Math.max(0, CAREER_UNOFFICIAL.localScenePool - listedLocals) : 0;
  return above + catchable + unlisted < cut ? "clinched" : "contention";
}
