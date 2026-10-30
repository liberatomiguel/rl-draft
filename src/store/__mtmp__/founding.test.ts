import { it } from "vitest";
import { CAREER_ECONOMY } from "@/config/balance";
import { startingBudgetFor, weeklyWageBill } from "@/engine/career/economy";
import { foundingWageOf, starterOffersForRegion } from "@/store/careerFlow";
import type { Region } from "@/engine/types";

const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
it("founding bills", () => {
  const seeds = [9100, 17019, 31337, 1000, 8919, 16838, 24757, 32676];
  const out: string[] = [];
  for (const d of ["easy", "normal", "hard"] as const) {
    for (const key of ["prospects", "balanced", "journeymen"]) {
      const rows: string[] = [];
      const all: number[] = [];
      const full: number[] = [];
      const budgets: number[] = [];
      for (const r of REGIONS) {
        const b: number[] = [];
        for (const s of seeds) {
          const o = starterOffersForRegion(r, s).find((x) => x.key === key)!;
          const paid = weeklyWageBill(o.players.map((v) => foundingWageOf(v, d, s)), null);
          const f = weeklyWageBill(o.players.map((v) => foundingWageOf(v, d, s, true)), null);
          b.push(paid);
          all.push(paid);
          full.push(f);
          budgets.push(startingBudgetFor(d, f));
        }
        b.sort((x, y) => x - y);
        rows.push(`${r} ${b[0]}-${b[b.length - 1]}`);
      }
      all.sort((x, y) => x - y);
      full.sort((x, y) => x - y);
      budgets.sort((x, y) => x - y);
      const flat = CAREER_ECONOMY.startingBudget[d];
      out.push(
        `${d} ${key}: paid p50 ${all[all.length >> 1]} max ${all[all.length - 1]} | full p50 ${full[full.length >> 1]} | rc35 budget p50 ${budgets[budgets.length >> 1]} max ${budgets[budgets.length - 1]} | flat ${flat} → weeks at p50 ${(flat / all[all.length >> 1]).toFixed(1)} min ${(flat / all[all.length - 1]).toFixed(1)} | ${rows.join(" · ")}`,
      );
    }
  }
  console.log(out.join("\n"));
});
