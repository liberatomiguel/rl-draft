import { it } from "vitest";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_TRAINING, CAREER_WORLD } from "@/config/balance";
import { ageOf, applyMatchXp, developmentProfileOf, peakAgeWithRoom, peakTargetOf, rookieView, seasonYear, squadRollover, trainDay } from "@/engine/career/development";
import type { CareerPlayerView, SquadPlayer } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const D = CAREER_DEV as unknown as Record<string, unknown>;

function squadOf(v: CareerPlayerView, seasonIndex: number): SquadPlayer {
  return {
    id: v.id, kind: v.kind, name: v.name, region: v.region, birthYear: seasonYear(seasonIndex) - v.age,
    archetype: v.archetype, overall: v.overall, attrOffsets: v.attrOffsets, potential: v.potential, peakAge: v.peakAge,
    declineRate: v.declineRate, role: "starter", salaryPerSplit: 1_000, contractEndSeason: seasonIndex + 9,
    trainingFocus: "auto", trainingIntensity: "normal", scoutLevel: 0, splitsTogether: 0, joinedSeason: seasonIndex,
    gainedThisSplit: 0, gainedThisSeason: 0,
  };
}

function season(p0: SquadPlayer, seasonIndex: number, seed: number, pkg: number, gear: number): SquadPlayer {
  let p = p0;
  for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
    const event = week % 2 === 0;
    for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
      const day = (week - 1) * CAREER_CALENDAR.daysPerWeek + dow;
      p = trainDay(
        p,
        { seasonIndex, coachOverall: null, gearBonus: gear, trainingWeekBonus: !event, splitGained: p.gainedThisSplit, seasonGained: p.gainedThisSeason, model: 2, day, careerSeed: seed, aging: true, ...(pkg > 1 ? { packageMult: pkg } : {}) },
        event ? CAREER_TRAINING.matchPrepShare : 1,
      ).player;
    }
    if (event) p = applyMatchXp(p, { seasonIndex, fieldQuality: 0.85, isSub: false, coachOverall: null, gearBonus: gear, seriesPlayed: 4, model: 2, day: week * CAREER_CALENDAR.daysPerWeek, careerSeed: seed });
  }
  const roll = squadRollover(p, seasonIndex + 1, createRng(seed + seasonIndex), { model: 2, careerSeed: seed });
  return { ...roll.player, finalSeasonAnnounced: false, gainedThisSeason: 0, gainedThisSplit: 0 };
}

function measure(label: string, pkg: number, gear: number, seeds: number) {
  const gainBy = new Map<number, number[]>();
  const gapBy = new Map<number, number[]>();
  const reached: number[] = [];
  const peakAges: number[] = [];
  for (let k = 0; k < seeds; k++) {
    const seed = 1000 + k * 7919;
    for (const region of REGIONS)
      for (let n = 0; n < CAREER_WORLD.rookiesPerRegionPerSeason; n++) {
        const v = rookieView(region, 1, n, seed, false, undefined, 2);
        if (v.potential < 82) continue;
        let p = squadOf(v, 1);
        peakAges.push(p.peakAge);
        const target = peakTargetOf(p.potential, developmentProfileOf(p.id, seed));
        let at = NaN;
        for (let si = 1; si <= 12; si++) {
          const age = ageOf(p.birthYear, si);
          const before = p.overall;
          p = season(p, si, seed, pkg, gear);
          if (!gainBy.has(age)) gainBy.set(age, []);
          gainBy.get(age)!.push(p.overall - before);
          if (!gapBy.has(age + 1)) gapBy.set(age + 1, []);
          gapBy.get(age + 1)!.push(target - p.overall);
          if (Number.isNaN(at) && p.overall >= target - 0.5) at = age + 1;
        }
        reached.push(Number.isNaN(at) ? 99 : at);
      }
  }
  const ages = [14, 15, 16, 17, 18, 19, 20, 21];
  return `${label.padEnd(26)} gain p50/p90 ${ages.map((a) => `${a}:${q(gainBy.get(a) ?? [], 0.5).toFixed(1)}/${q(gainBy.get(a) ?? [], 0.9).toFixed(1)}`).join(" ")} | gap@ ${[18, 19, 20, 21, 22].map((a) => `${a}:${q(gapBy.get(a) ?? [], 0.5).toFixed(1)}`).join(" ")} | peak reached p50 ${q(reached, 0.5)} p90 ${q(reached, 0.9)} | peakAge p50 ${q(peakAges, 0.5)}`;
}

function headliner(seeds: number) {
  // A Prospects headliner: 16, 66, potential 92.
  const out: number[][] = [];
  for (let k = 0; k < seeds; k++) {
    const seed = 2000 + k * 7919;
    const id = `fic:EU:starter${k % 3}`;
    const prof = developmentProfileOf(id, seed);
    let p: SquadPlayer = { ...squadOf({ id, kind: "fictional", name: "H", region: "EU", age: 16, archetype: "allround", overall: 66, attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 }, potential: 92, peakAge: peakAgeWithRoom(prof.peakAge, 16, 26), declineRate: "normal", anchored: false } as CareerPlayerView, 0) };
    const row: number[] = [];
    for (let si = 0; si < 7; si++) {
      p = season(p, si, seed, 1.3, 0.1);
      row.push(Math.round(p.overall * 10) / 10);
    }
    out.push(row);
  }
  const cols = out[0].map((_, i) => q(out.map((r) => r[i]), 0.5));
  return `headliner 16yo 66→92 (pkg 1.3, gear .1) overall at season end S0..S6 p50: ${cols.join(" · ")}`;
}

it("growth exploration", () => {
  const combos: Record<string, number>[] = JSON.parse(process.env.GX ?? "[{}]");
  const lines: string[] = [];
  for (const combo of combos) {
    const saved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(combo)) {
      saved[k] = D[k];
      D[k] = v;
    }
    lines.push(`--- ${JSON.stringify(combo)}`);
    lines.push(measure("base (no package)", 1, 0, 6));
    lines.push(measure("package 1.3 + gear .1", 1.3, 0.1, 6));
    lines.push(headliner(9));
    for (const [k, v] of Object.entries(saved)) D[k] = v;
  }
  console.log(lines.join("\n"));
});
