/**
 * v2.2 event formats — career probe (opt-in: EVENT_FORMATS_PROBE=1). Plays
 * whole careers with FEATURES.eventFormats on and checks, season by season,
 * that every Major / Worlds compiled the shape of CAREER_EVENT_LAYOUTS (16
 * rows, the bracket's placement counts) and that the career never stalls.
 * Seven seasons cover the six dataset rows and the first rotation (2027 =
 * Season X's row, its Worlds played).
 *
 *   EVENT_FORMATS_PROBE=1 EF_REGIONS=EU,NA EF_SEASONS=7 npx vitest run src/store/careerEventFormats.probe.test.ts
 *
 * The full soft-lock probe runs with the flag on through the environment:
 *   NEXT_PUBLIC_EVENT_FORMATS=1 P1_SOFT=1 npx vitest run src/store/careerSoftlock.probe.test.ts
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/config/balance";
import { eventLayoutFor } from "@/engine/career/calendar";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import { LAYOUT_PLACEMENTS } from "@/engine/eventLayouts";
import type { Placement, Region } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const ON = env.EVENT_FORMATS_PROBE === "1";
const REGIONS = (env.EF_REGIONS ?? "EU").split(",") as Region[];
const POLICY = (env.EF_POLICY ?? "tuned") as ArcPolicyId;
const DIFFICULTY = (env.EF_DIFF ?? "normal") as CareerDifficulty;
const SEASONS = Number(env.EF_SEASONS ?? 7);

describe.skipIf(!ON)("v2.2 event formats: career probe", () => {
  it(
    "every Major / Worlds plays its season's shape, careers run to the end",
    () => {
      const flags = FEATURES as { eventFormats: boolean };
      const before = flags.eventFormats;
      flags.eventFormats = true;
      const findings: string[] = [];
      const seen = new Map<string, number>();
      const userShapes = new Set<string>();
      const lines: string[] = [];
      try {
        for (const region of REGIONS) {
          const check = (save: CareerSave) => {
            for (const r of save.eventResults) {
              if (r.tier !== "major" && r.tier !== "worlds") continue;
              const layout = eventLayoutFor(r.seasonIndex, r.tier);
              const key = `S${r.seasonIndex} ${r.tier} ${layout?.stage}/${layout?.bracket}`;
              seen.set(key, (seen.get(key) ?? 0) + 1);
              if (r.rows.length !== 16) findings.push(`${key}: ${r.rows.length} rows`);
              if (!layout || layout.bracket === "double8") continue;
              const counts = new Map<Placement, number>();
              for (const row of r.rows) counts.set(row.placement, (counts.get(row.placement) ?? 0) + 1);
              const want = new Map(LAYOUT_PLACEMENTS[layout.bracket]);
              for (const [p, n] of want) if (counts.get(p) !== n) findings.push(`${key} ${r.eventId}: ${p} ×${counts.get(p) ?? 0}, want ${n}`);
            }
          };
          const career = playArcCareer({
            region,
            difficulty: DIFFICULTY,
            policy: POLICY,
            seed: 4242,
            seasons: SEASONS,
            budgetMs: 1_800_000,
            onSeason: (moment, save) => {
              if (moment === "end") check(save);
            },
            onEvent: (save) => {
              const ev = save.activeEvent;
              if (!ev || (ev.def.tier !== "major" && ev.def.tier !== "worlds")) return;
              const want = eventLayoutFor(ev.def.seasonIndex, ev.def.tier);
              if (JSON.stringify(ev.tournament.layout) !== JSON.stringify(want ?? undefined)) {
                findings.push(`user ${ev.def.id}: played ${JSON.stringify(ev.tournament.layout)}, want ${JSON.stringify(want)}`);
              }
              userShapes.add(`${ev.def.id} ${ev.tournament.layout?.stage}/${ev.tournament.layout?.bracket} → ${ev.tournament.playoffs?.championTeamId === "user" ? "title" : "out"}`);
            },
          });
          lines.push(`${region} ${DIFFICULTY} ${POLICY}:${career.seasons.length} seasons, ended ${career.ended ?? "-"}, softlock ${career.softlock ?? "-"}`);
          if (career.softlock) findings.push(`${region}: softlock ${career.softlock}`);
        }
      } finally {
        flags.eventFormats = before;
      }
      const report = [
        ...lines,
        ...[...seen].map(([k, n]) => `  ${k} ×${n}`),
        ...[...userShapes].map((s) => `  user ${s}`),
        ...findings.map((f) => `  ! ${f}`),
      ].join("\n");
      console.log(report);
      if (env.EF_OUT) writeFileSync(env.EF_OUT, report);
      expect(seen.size).toBeGreaterThan(0);
      expect(findings).toEqual([]);
    },
    3_600_000,
  );
});
