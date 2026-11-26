/**
 * v2.2 Pro (R150): a bot that plays a whole Pro career on the pure modules, for
 * the calibration of the spec §4.1 targets (lifecycle.test.ts). Not shipped
 * code: nothing in the game imports it.
 *
 * What it models of the real calendar (engine/career/calendar.ts): the number
 * of regional weeks a region has in a season, and in each of them the official
 * series a mid-table side plays (SERIES_PER_REGIONAL: about three in the Swiss
 * and one in the playoffs, less the weeks a mid-table side is out). What it
 * leaves out: org offers, benching, majors and Worlds (a mid-table side seldom
 * plays them), coach changes, injuries, the real opponents.
 */

import { CAREER_CALENDAR } from "@/config/balance";
import { isWindowWeek, officialEventDefsForWeek } from "../calendar";
import { createProSave } from "./create";
import { applyMatchXp, proAgeOf, proOverall } from "./growth";
import { cupsUnlocked } from "./ranked";
import { coachPlanFor } from "./week";
import { applyWeekToSave, nextWeekClock, rolloverProPlayer } from "./weekFlow";
import type { CreateProInput, ProSave, ProWeekPlan } from "./types";

export type Behaviour = "managed" | "careless";

export interface BotOptions {
  talent: number;
  behaviour: Behaviour;
  /** The org's coach overall once signed (undefined = none, to measure the coach's weight). */
  coach?: number;
  seasons?: number;
}

export interface BotResult {
  peak: number;
  /** Season index of the first week he was within half a point of his peak. */
  peakAge: number;
  /** Overall at the end of the season he turns 16. */
  at16: number;
  weeksToGc: number;
  weeksToOrg: number;
  finalAge: number;
}

/** Official series a mid-table side plays in one regional week, and the opponent's overall. */
export const SERIES_PER_REGIONAL = 3;
export const GAMES_PER_SERIES = 3;
/** An amateur side plays the weekend cup (Rocket Street, qualifiers) outside the transfer windows. */
export const AMATEUR_SERIES_PER_WEEK = 2;
export const OPPONENT = { org: 80, amateur: 62 };
/** The week he joins an amateur side, and the overall at which an org signs him. */
export const AMATEUR_FROM_WEEK = 40;
export const ORG_MIN_OVERALL = 72;

const INPUT: CreateProInput = { name: "Bot", country: "br", region: "SAM", startAge: 13, archetype: "allround", difficulty: "normal" };

/** The weeks of a season in which his region plays a regional (from the real calendar). */
function regionalWeeks(seasonIndex: number): number[] {
  const out: number[] = [];
  for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) {
    if (officialEventDefsForWeek(seasonIndex, w).some((d) => d.tier === "regional" && d.region === INPUT.region)) out.push(w);
  }
  return out;
}

const weeksCache = new Map<number, number[]>();
const weeksOf = (s: number) => {
  let w = weeksCache.get(s);
  if (!w) weeksCache.set(s, (w = regionalWeeks(s)));
  return w;
};

export function playBotCareer(seed: number, opt: BotOptions): BotResult {
  let save: ProSave = createProSave(INPUT, seed, "bot");
  save = { ...save, player: { ...save.player, talent: opt.talent } };
  const seasons = opt.seasons ?? 12;
  const total = seasons * CAREER_CALENDAR.weeksPerSeason;
  let weeksToGc = -1;
  let weeksToOrg = -1;
  let at16 = 0;
  const trace: number[] = [];
  for (let w = 0; w < total && save.stage !== "retired"; w++) {
    const week = (w % CAREER_CALENDAR.weeksPerSeason) + 1;
    if (weeksToGc < 0 && cupsUnlocked(save.player)) weeksToGc = w;
    // The careless profile is on a side by definition (the brief): a local team that did not need Grand Champion calls him.
    const called = opt.behaviour === "careless" ? w >= AMATEUR_FROM_WEEK + 20 : w >= AMATEUR_FROM_WEEK && weeksToGc >= 0;
    if (save.stage === "ranked" && called) save = { ...save, stage: "amateur", team: { kind: "amateur", ref: "bot-amateur" } };
    if (save.stage === "amateur" && proOverall(save.player.attrs) >= ORG_MIN_OVERALL && proAgeOf(save.player, save.clock.seasonIndex) >= 15) {
      save = { ...save, stage: "org", team: { kind: "org", ref: "bot-org" } };
      weeksToOrg = w;
    }
    const coachOverall = save.stage === "org" ? opt.coach : undefined;
    const ctx = { seasonIndex: save.clock.seasonIndex, hasTeam: save.team !== null, careerSeed: save.careerSeed, coachOverall };
    const plan: ProWeekPlan =
      opt.behaviour === "managed"
        ? coachPlanFor(save.player, ctx)
        : save.team
          ? [{ kind: "content" }, { kind: "scrim" }, { kind: "content" }]
          : [{ kind: "content" }, { kind: "ranked" }, { kind: "content" }];
    save = applyWeekToSave(save, plan, coachOverall).save;

    // The official series of the week he is on a side: org = a mid-table regional run, amateur = one cup series.
    const plays = save.stage === "org" ? weeksOf(save.clock.seasonIndex).includes(week) : save.team !== null && !isWindowWeek(week);
    if (save.team && plays) {
      const series = save.stage === "org" ? SERIES_PER_REGIONAL : AMATEUR_SERIES_PER_WEEK;
      const opponent = save.stage === "org" ? OPPONENT.org : OPPONENT.amateur;
      let p = save.player;
      for (let g = 0; g < series * GAMES_PER_SERIES; g++) {
        const level = proOverall(p.attrs);
        p = applyMatchXp(p, {
          rating: Math.min(9.5, Math.max(3, 6 + (level - opponent) * 0.1 + p.confidence * 0.3)),
          opponentStrength: opponent,
          tier: save.stage === "org" ? "regional" : "t3",
          seasonIndex: save.clock.seasonIndex,
          day: save.clock.day,
        }).player;
      }
      save = { ...save, player: p };
    }
    const next = nextWeekClock(save.clock);
    save = { ...save, clock: next.clock };
    if (next.rolledOver) {
      if (proAgeOf(save.player, save.clock.seasonIndex) === 17) at16 = proOverall(save.player.attrs);
      save = rolloverProPlayer(save).save;
    }
    trace.push(proOverall(save.player.attrs));
  }
  const peak = save.player.peakOverall ?? proOverall(save.player.attrs);
  const firstNearPeak = trace.findIndex((v) => v >= peak - 0.5);
  const peakSeason = Math.floor(firstNearPeak / CAREER_CALENDAR.weeksPerSeason);
  return {
    peak,
    peakAge: proAgeOf(save.player, peakSeason),
    at16: at16 || trace[trace.length - 1],
    weeksToGc,
    weeksToOrg,
    finalAge: proAgeOf(save.player, save.clock.seasonIndex),
  };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
