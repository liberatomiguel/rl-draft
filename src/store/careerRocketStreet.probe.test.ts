/**
 * Season 1 — Rocket Street presence probe (opt-in: RS_PROBE=1). Plays SAM
 * careers with the arc bot and counts, per season, what a SAM manager is
 * actually shown from the regional partner:
 *
 *  - news items the feed signs as Rocket Street (`rocketStreetNews`, the
 *    predicate the feed, the toaster and the headline pop-up share);
 *  - open weeks on which the Rocket Street LATAM Championship was the week's
 *    offer on the calendar, and how many of those were played;
 *  - the reputation the season started and ended on (the invitational gate).
 *
 *   RS_PROBE=1 RS_SEEDS=4 RS_SEASONS=3 RS_POLICIES=autopilot,tuned npx vitest run src/store/careerRocketStreet.probe.test.ts
 *
 * RS_REGIONS=NA adds a control region (it must read zero on every line).
 * RS_OUT=<file> also writes the lines to a file (an agent reporter hides the
 * console of a passing test).
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAREER_UNOFFICIAL } from "@/config/balance";
import { ROCKET_STREET_EVENT_NAME } from "@/data/career/names";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { rocketStreetNews } from "@/components/career/news/newsView";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const ON = env.RS_PROBE === "1";
const REGIONS = (env.RS_REGIONS ?? "SAM").split(",") as Region[];
const POLICIES = (env.RS_POLICIES ?? "autopilot,tuned").split(",") as ArcPolicyId[];
const DIFFS = (env.RS_DIFFS ?? "normal").split(",") as CareerDifficulty[];
const SEEDS = Number(env.RS_SEEDS ?? 4);
const SEASONS = Number(env.RS_SEASONS ?? 3);

interface Row {
  news: Set<string>;
  allNews: Set<string>;
  keys: Map<string, number>;
  offered: Set<string>;
  played: Set<string>;
  repStart: number;
  repEnd: number;
  gateWeek: number | null;
}

describe.skipIf(!ON)("Rocket Street presence probe", () => {
  it(
    "SAM careers: Rocket Street news and championship per season",
    () => {
      const lines: string[] = [];
      const say = (line: string) => {
        lines.push(line);
        console.log(line);
        if (env.RS_OUT) writeFileSync(env.RS_OUT, lines.join("\n"));
      };
      const totals: { news: number; offered: number; played: number; seasons: number; seasonsWithCup: number }[] = [];
      for (const region of REGIONS)
        for (const difficulty of DIFFS)
          for (const policy of POLICIES)
            for (let k = 0; k < SEEDS; k++) {
              const seed = 9100 + k * 7919;
              const rows = new Map<number, Row>();
              const seen = new Set<string>();
              const rowOf = (s: number, rep: number): Row => {
                let r = rows.get(s);
                if (!r) {
                  r = { news: new Set(), allNews: new Set(), keys: new Map(), offered: new Set(), played: new Set(), repStart: rep, repEnd: rep, gateWeek: null };
                  rows.set(s, r);
                }
                return r;
              };
              const career = playArcCareer({
                region,
                difficulty,
                policy,
                seed,
                seasons: SEASONS,
                budgetMs: 1_800_000,
                onDay: (save) => {
                  const r = rowOf(save.clock.seasonIndex, save.reputation);
                  r.repEnd = save.reputation;
                  if (r.gateWeek === null && save.reputation >= CAREER_UNOFFICIAL.t2RepGate) r.gateWeek = Math.ceil(save.clock.day / 7);
                  // Counted in the season the manager first reads it (the rollover's news is stamped a season back).
                  for (const n of save.news) {
                    if (seen.has(n.id)) continue;
                    seen.add(n.id);
                    r.allNews.add(n.id);
                    if (rocketStreetNews(n)) {
                      r.news.add(n.id);
                      const key = n.beatId ?? n.titleKey;
                      r.keys.set(key, (r.keys.get(key) ?? 0) + 1);
                    }
                  }
                  const offer = save.unofficialOffer;
                  if (offer?.name === ROCKET_STREET_EVENT_NAME) r.offered.add(offer.id);
                },
                onEvent: (save) => {
                  const def = save.activeEvent?.def;
                  if (def?.name === ROCKET_STREET_EVENT_NAME) rowOf(save.clock.seasonIndex, save.reputation).played.add(def.id);
                },
              });
              say(`${region} ${difficulty} ${policy} seed ${seed}${career.softlock ? ` SOFTLOCK ${career.softlock}` : ""}`);
              for (const [s, r] of [...rows].sort((a, b) => a[0] - b[0])) {
                const keys = [...r.keys].map(([key, n]) => `${key}×${n}`).join(" ");
                say(
                  `   S${s}: RS news ${r.news.size} of ${r.allNews.size} | cup offered ${r.offered.size} played ${r.played.size} | rep ${r.repStart}→${r.repEnd} gate W${r.gateWeek ?? "-"}${keys ? ` | ${keys}` : ""}`,
                );
                totals[s] ??= { news: 0, offered: 0, played: 0, seasons: 0, seasonsWithCup: 0 };
                totals[s].news += r.news.size;
                totals[s].offered += r.offered.size;
                totals[s].played += r.played.size;
                totals[s].seasons += 1;
                if (r.offered.size > 0) totals[s].seasonsWithCup += 1;
              }
              expect(career.softlock).toBeNull();
            }
      totals.forEach((t, s) =>
        say(
          `TOTAL S${s}: ${t.seasons} seasons | RS news avg ${(t.news / t.seasons).toFixed(1)} | cup on the calendar in ${t.seasonsWithCup}/${t.seasons} seasons (avg ${(t.offered / t.seasons).toFixed(1)} weeks, played ${(t.played / t.seasons).toFixed(1)})`,
        ),
      );
    },
    7_200_000,
  );
});
