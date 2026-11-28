/**
 * rc9 STORIES (R253): opt-in measure (FEED_SIM=1). Plays arc-bot careers with
 * the fan feed on and counts the post offers per season, by moment. The aim:
 * a handful a season (about three to six), never one after every event.
 * FEED_SIM_SEEDS / FEED_SIM_SEASONS / FEED_SIM_REGION size the run.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, fanFeed: true } };
});

import { CAREER_FEED } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer } from "./careerArcBot";

const env = process.env;

describe("post offers per season", () => {
  it.skipIf(!env.FEED_SIM)("measures", () => {
    const seeds = Number(env.FEED_SIM_SEEDS ?? 2);
    const seasons = Number(env.FEED_SIM_SEASONS ?? 3);
    const regions = (env.FEED_SIM_REGION ?? "EU").split(",") as Region[];
    const rows: { region: string; seed: number; season: number; offers: number; events: number; moments: Record<string, number> }[] = [];
    for (const region of regions) {
      for (let k = 0; k < seeds; k++) {
        const seed = 1000 + k * 97;
        let lastOffer = "";
        let moments: Record<string, number> = {};
        let events = 0;
        let seenResults = 0;
        const out = playArcCareer({
          region,
          difficulty: (env.FEED_SIM_DIFF ?? "normal") as never,
          policy: (env.FEED_SIM_POLICY ?? "tuned") as never,
          seed,
          seasons,
          budgetMs: 540_000,
          onDay: (save: CareerSave) => {
            const o = save.fanFeed?.offer;
            const key = o ? `${o.seasonIndex}:${o.day}:${o.seriesN}` : "";
            if (o && key !== lastOffer) {
              lastOffer = key;
              moments[o.moment] = (moments[o.moment] ?? 0) + 1;
            }
            const played = save.eventResults.filter((r) => r.userPlacement !== undefined).length;
            if (played > seenResults) events += played - seenResults;
            seenResults = played;
          },
          onSeason: (moment: "start" | "end", save: CareerSave) => {
            if (moment === "start") {
              moments = {};
              events = 0;
              seenResults = save.eventResults.filter((r) => r.userPlacement !== undefined).length;
              return;
            }
            const offers = (save.fanFeed?.offerLog ?? []).filter((x) => x.seasonIndex === save.clock.seasonIndex).length;
            rows.push({ region, seed, season: save.clock.seasonIndex, offers, events, moments, series: save.fanFeed?.seq ?? -1, res: save.eventResults.filter((r) => r.seasonIndex === save.clock.seasonIndex && r.userPlacement).map((r) => `${r.tier}:${r.userPlacement}`), ups: save.fanFeed?.series.filter((x) => x.upset).length, log: save.fanFeed?.offerLog?.length ?? -1 } as never);
          },
        } as never);
        expect(out.softlock).toBeNull();
      }
    }
    console.log("FEED_SIM", JSON.stringify(rows));
    if (env.FEED_SIM_OUT) writeFileSync(env.FEED_SIM_OUT, JSON.stringify(rows));
    const avg = rows.reduce((n, r) => n + r.offers, 0) / Math.max(1, rows.length);
    console.log("FEED_SIM avg offers/season", avg.toFixed(2), "cap", CAREER_FEED.offer.perSeason);
    for (const r of rows) expect(r.offers).toBeLessThanOrEqual(CAREER_FEED.offer.perSeason);
  }, 600_000);
});
