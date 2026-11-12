/**
 * v2.0 (P1) — browser-probe fixtures (opt-in: P1_FIX=1). Plays a career with
 * the arc bot and writes the persisted career store (the exact localStorage
 * value of `rocket-draft:career:v1`) at a first-season weekday and at a
 * seventh-season weekday, plus a three-slot store. The interaction probe
 * (docs/handoff-2.0/P1.md) loads them into a production export.
 *   P1_FIX=1 P1_FIX_OUT=<dir> npx vitest run src/store/careerPerfFixtures.probe.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { dayOfWeekOf } from "@/engine/career/calendar";
import { playArcCareer } from "./careerArcBot";
import { clockHoldOf } from "./careerDecisions";
import { advanceDayFlow, eventStartBlockOf } from "./careerFlow";

const ON = process.env.P1_FIX === "1";
const OUT = process.env.P1_FIX_OUT ?? ".";
const LATE = Number(process.env.P1_FIX_SEASON ?? 6);

const store = (slots: (CareerSave | null)[]) =>
  JSON.stringify({ state: { slots, activeSlot: 0, achievements: { unlocked: {}, worldsWonOn: {} } }, version: 3 });

describe.skipIf(!ON)("v2.0 (P1) browser-probe fixtures", () => {
  it(
    "writes a season-1 and a late-season career store",
    () => {
      const shots = new Map<string, CareerSave>();
      // A quiet Tuesday: no event this week, no invite, nothing to answer — several days of plain clock ahead.
      const quiet = (s: CareerSave) =>
        s.phase === "running" && !s.activeEvent && !s.pendingEventDef && !s.unofficialOffer && !s.pendingInsert && !s.sponsorOffers &&
        s.pendingOffers.every((o) => o.status !== "pending") && dayOfWeekOf(s.clock.day) === 2 && clockHoldOf(s) === null;
      playArcCareer({
        region: "SAM",
        difficulty: "normal",
        policy: "tuned",
        seed: 9100,
        seasons: LATE + 1,
        budgetMs: 1_800_000,
        onDay: (save) => {
          // The soft-lock states (a starter ruled out, nobody on the bench), crafted from a real eve.
          const def = save.pendingEventDef;
          if (save.clock.seasonIndex >= 1 && save.phase === "running" && !save.activeEvent && def && def.day === save.clock.day + 1 && (def.tier === "qualifier" || def.tier === "regional")) {
            const kind = save.weekend?.eventId === def.id ? "satEve" : def.tier === "qualifier" ? "qualEve" : "regEve";
            if (!shots.has(kind)) {
              const absent = structuredClone(save);
              absent.squad = absent.squad.filter((p) => absent.starterIds.includes(p.id));
              absent.pendingUnavailability = { playerId: absent.starterIds[0], eventId: def.id, reason: "illness" };
              absent.pendingOffers = [];
              absent.sponsorOffers = null;
              absent.pendingInsert = null;
              shots.set(kind, absent);
              const onDay = structuredClone(absent);
              onDay.clock.day = def.day;
              shots.set(kind.replace("Eve", "Day"), onDay);
            }
          }
          // The save every career was stuck on before the fix: the eve of the first qualifier of 2022-23.
          if (save.clock.seasonIndex === 2 && save.clock.day === 26 && !shots.has("stuckS3")) shots.set("stuckS3", structuredClone(save));
          // A late-season matchday morning (the lobby): tomorrow's arrival, computed from the eve.
          if (save.clock.seasonIndex === LATE && !shots.has("matchday") && save.phase === "running" && !save.activeEvent && def && def.day === save.clock.day + 1 && def.tier === "qualifier" && clockHoldOf(save) === null) {
            const morning = advanceDayFlow(save);
            if (morning.pendingEventDef?.id === def.id && morning.clock.day === def.day && eventStartBlockOf(morning, def) === null) shots.set("matchday", morning);
          }
          const key = save.clock.seasonIndex === 0 ? "s1" : save.clock.seasonIndex === LATE ? "late" : null;
          if (!key || shots.has(key) || save.clock.day < 30 || !quiet(save)) return;
          shots.set(key, structuredClone(save));
        },
      });
      const s1 = shots.get("s1");
      const late = shots.get("late");
      expect(s1).toBeDefined();
      expect(late).toBeDefined();
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, "career-s1.json"), store([s1!, null, null]));
      writeFileSync(join(OUT, "career-late.json"), store([late!, null, null]));
      writeFileSync(join(OUT, "career-late-x3.json"), store([late!, structuredClone(late!), structuredClone(s1!)]));
      if (shots.has("matchday")) writeFileSync(join(OUT, "career-late-matchday.json"), store([shots.get("matchday")!, null, null]));
      if (shots.has("stuckS3")) writeFileSync(join(OUT, "career-stuck-s3.json"), store([shots.get("stuckS3")!, null, null]));
      for (const [kind, save] of shots) if (kind !== "s1" && kind !== "late" && kind !== "matchday" && kind !== "stuckS3") writeFileSync(join(OUT, `career-absent-${kind}.json`), store([save, null, null]));
      console.log(
        `fixtures: s1 ${Math.round(JSON.stringify(s1).length / 1024)} KB (S${s1!.clock.seasonIndex} d${s1!.clock.day}), late ${Math.round(JSON.stringify(late).length / 1024)} KB (S${late!.clock.seasonIndex} d${late!.clock.day})`,
      );
    },
    3_600_000,
  );
});
