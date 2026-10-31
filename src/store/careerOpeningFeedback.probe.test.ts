/** FEEDBACK=1: matched local-scene progression, real money/training/gear.
 * FEEDBACK_SLICE=0/4..3/4, FEEDBACK_OUT, FEEDBACK_REGIONS/DIFFS/ROSTERS/SEEDS.
 * Same rc.36.5 sponsor/prize/scrim rules on both sides; isolate annual rebasing.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { BALANCE_VERSION, CAREER_UNOFFICIAL } from "@/config/balance";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer } from "./careerArcBot";

it.skipIf(!process.env.FEEDBACK)("compares the local-scene opening in every difficulty/roster/region", () => {
  const env = process.env;
  const list = <T extends string>(s: string | undefined, fallback: T[]) => s ? s.split(",") as T[] : fallback;
  const regions = list<Region>(env.FEEDBACK_REGIONS, ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]);
  const diffs = list<CareerDifficulty>(env.FEEDBACK_DIFFS, ["easy", "normal", "hard"]);
  const rosters = list<"balanced" | "prospects" | "journeymen">(env.FEEDBACK_ROSTERS, ["balanced", "prospects", "journeymen"]);
  const cells = regions.flatMap(region => diffs.flatMap(difficulty => rosters.flatMap(rosterKey =>
    Array.from({ length: Number(env.FEEDBACK_SEEDS ?? 1) }, (_, k) => ({ region, difficulty, rosterKey, seed: 9100 + k * 7919 })))));
  const [slice, slices] = (env.FEEDBACK_SLICE ?? "0/1").split("/").map(Number);
  const mutable = CAREER_UNOFFICIAL as { localSceneGrowthPerSeason: number | null };
  const candidate = mutable.localSceneGrowthPerSeason;
  const careers: unknown[] = [];
  const write = () => { if (env.FEEDBACK_OUT) writeFileSync(env.FEEDBACK_OUT, JSON.stringify({ balanceVersion: BALANCE_VERSION, historicalSeasons: 6, seasons: Number(env.FEEDBACK_SEASONS ?? 3), candidateGrowth: candidate, careers })); };
  write();
  try {
    for (const [i, cell] of cells.entries()) {
      if (i % slices !== slice) continue;
      for (const variant of ["annualRebase", "localGrowth"] as const) {
        mutable.localSceneGrowthPerSeason = variant === "annualRebase" ? null : candidate;
        const events: unknown[] = [], anchors: unknown[] = [];
        const career = playArcCareer({ ...cell, policy: "loyal", fullSupport: true,
          seasons: Number(env.FEEDBACK_SEASONS ?? 3), budgetMs: 300_000,
          onEvent(save) {
            const e = save.activeEvent!;
            const user = e.tournament.teams.user;
            events.push({ season: save.clock.seasonIndex, split: e.def.split, tier: e.def.tier,
              rating: user?.rating.total, field: Object.values(e.tournament.teams).filter(t => !t.isUser).map(t => ({ id:t.id, rating:t.rating.total })) });
          },
          onSeason(moment, save) {
            if (moment === "end") anchors.push({ season: save.clock.seasonIndex,
              localAnchor: save.competition.localAnchor, localOrigin: save.competition.localOrigin,
              results: save.eventResults.filter(r => r.userPlacement).map(r => ({ tier:r.tier, week:r.week, split:r.split, placement:r.userPlacement })) });
          },
        });
        careers.push({ ...career, rosterKey: cell.rosterKey, variant, events, anchors });
        write();
      }
    }
  } finally { mutable.localSceneGrowthPerSeason = candidate; }
  console.log(`Opening feedback: ${careers.length} careers`);
}, 7_200_000);
