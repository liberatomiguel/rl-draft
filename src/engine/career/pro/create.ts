/**
 * v2.2 Pro (PRO-SPEC §4.1, §7, R150): creating a player career.
 *
 * The world is the manager's own (`buildWorldAtCreation` + stars), on the
 * same seed rules, so a Pro and a manager career with the same seed live in
 * the same world. Everything the player gets from the seed is derived with
 * cursor-free `derivedFloat` streams under "pro:", so adding a draw later
 * never moves an earlier one.
 */

import { CAREER_PRO } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey, Stats } from "../../types";
import { emptyCompetition } from "../competition";
import { seasonYear } from "../development";
import { derivedFloat } from "../seeds";
import type { DeclineRate } from "../types";
import { buildWorldAtCreation, computeStars } from "../worldSim";
import { PRO_STAT_KEYS, round2 } from "./attrs";
import type { CreateProInput, ProPlayer, ProSave } from "./types";
import { withProInWorld } from "./world";

const proStream = (what: string) => `pro:${what}`;

/** A trimmed nickname, or null when it is outside CAREER_PRO.nameMin..nameMax. */
export function cleanProName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < CAREER_PRO.nameMin || name.length > CAREER_PRO.nameMax) return null;
  return name;
}

/** The hidden talent: the mean of two seeded uniforms over CAREER_PRO.talentRange (the middle is likelier). */
export function talentFor(careerSeed: number): number {
  const [lo, hi] = CAREER_PRO.talentRange;
  const u = (derivedFloat(careerSeed, proStream("talent:a")) + derivedFloat(careerSeed, proStream("talent:b"))) / 2;
  return Math.round((lo + (hi - lo) * u) * 1000) / 1000;
}

export function peakAgeFor(careerSeed: number): number {
  const [lo, hi] = CAREER_PRO.peakAgeRange;
  return lo + Math.floor(derivedFloat(careerSeed, proStream("peak")) * (hi - lo + 1));
}

export function declineRateFor(careerSeed: number): DeclineRate {
  const weights = CAREER_PRO.declineRateWeights;
  const order: DeclineRate[] = ["slow", "normal", "fast"];
  let u = derivedFloat(careerSeed, proStream("decline"));
  for (const rate of order) {
    u -= weights[rate] ?? 0;
    if (u < 0) return rate;
  }
  return "normal";
}

/** The starting attributes: the start-age overall, the style's lean, a little seeded noise. */
export function startAttrsFor(input: Pick<CreateProInput, "startAge" | "archetype">, careerSeed: number): Stats {
  const base = CAREER_PRO.startOverall[input.startAge] ?? CAREER_PRO.startOverall[13];
  const lean: readonly StatKey[] = CAREER_PRO.styleAttrs[input.archetype] ?? [];
  const attrs = {} as Stats;
  for (const k of PRO_STAT_KEYS) {
    const styled = lean.length === 0 ? 0 : lean.includes(k) ? CAREER_PRO.styleBonus : -CAREER_PRO.stylePenalty;
    const noise = (derivedFloat(careerSeed, proStream(`start:${k}`)) * 2 - 1) * CAREER_PRO.startJitter;
    attrs[k] = round2(clamp(base + styled + noise, CAREER_PRO.attrMin, CAREER_PRO.attrMax));
  }
  return attrs;
}

export function createProPlayer(input: CreateProInput, careerSeed: number): ProPlayer {
  const name = cleanProName(input.name);
  if (!name) throw new Error("pro: invalid name");
  if (!(CAREER_PRO.startAges as readonly number[]).includes(input.startAge)) throw new Error("pro: invalid start age");
  return {
    name,
    country: input.country.toUpperCase(),
    region: input.region,
    birthYear: seasonYear(0) - input.startAge,
    archetype: input.archetype,
    attrs: startAttrsFor(input, careerSeed),
    talent: talentFor(careerSeed),
    peakAge: peakAgeFor(careerSeed),
    declineRate: declineRateFor(careerSeed),
    mechanics: [],
    energy: CAREER_PRO.startEnergy,
    confidence: 0,
    fame: 0,
    money: 0,
    mmr: CAREER_PRO.startMmr,
  };
}

/** A new Pro career: the shared world, the player, the ranked prologue. */
export function createProSave(input: CreateProInput, careerSeed: number, appVersion: string): ProSave {
  const seed = careerSeed >>> 0;
  let world = buildWorldAtCreation(seed);
  world = computeStars(world, { seasonIndex: 0, careerSeed: seed, difficulty: input.difficulty });
  const save: ProSave = {
    kind: "pro",
    proSaveVersion: 1,
    createdAtAppVersion: appVersion,
    careerSeed: seed,
    difficulty: input.difficulty,
    clock: { seasonIndex: 0, day: 1 },
    world,
    competition: emptyCompetition(),
    player: createProPlayer(input, seed),
    stage: "ranked",
    team: null,
    growthLog: [],
    offers: [],
    history: [],
    honors: [],
    news: [],
    flags: {},
    bridge: null,
  };
  return withProInWorld(save);
}
