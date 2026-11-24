/** Opt-in timing probe (DAILY_OPT_PROBE=1): solver nodes and time per day. */
import { it } from "vitest";
import { generateDailyConfig } from "@/lib/daily";
import { DAILY_ROTATION_START, dailySeedForDate } from "@/lib/dailyPlan";
import { referenceDistribution, solveDailyOptimal } from "./dailyOptimal";

it.skipIf(!process.env.DAILY_OPT_PROBE)("times the solver over the calendar", () => {
  const days = Number(process.env.DAILY_OPT_DAYS ?? 30);
  const rows: string[] = [];
  let worst = 0, total = 0, worstNodes = 0, refTotal = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
    const config = generateDailyConfig(date);
    const start = { rules: config, date, seed: dailySeedForDate(date) };
    const t0 = performance.now();
    const opt = solveDailyOptimal(start);
    const t1 = performance.now();
    const dist = referenceDistribution(start);
    const t2 = performance.now();
    worst = Math.max(worst, t1 - t0); total += t1 - t0; worstNodes = Math.max(worstNodes, opt.nodes); refTotal += t2 - t1;
    rows.push(`${date} ${config.info.templateId} nodes=${opt.nodes} ${Math.round(t1 - t0)}ms opt=${opt.score.rating} ovr=${opt.score.overall} refMax=${dist.ratings.at(-1)} refMed=${dist.ratings[100]} ref=${Math.round(t2 - t1)}ms ex=${opt.exhaustive}`);
  }
  console.log(rows.join("\n"));
  console.log(`avg ${Math.round(total / days)}ms worst ${Math.round(worst)}ms worstNodes ${worstNodes} refAvg ${Math.round(refTotal / days)}ms`);
}, 600_000);
