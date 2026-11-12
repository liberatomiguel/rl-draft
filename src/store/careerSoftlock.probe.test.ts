/**
 * v2.0 (P1) — soft-lock probe (opt-in: P1_SOFT=1). Plays whole careers with
 * the arc bot and, every morning, checks the state the manager is about to
 * see the way the SCREENS use it:
 *
 *  - a matchday lobby either starts (`startEvent` yields an active event) or
 *    is blocked with a hold HQ can answer (sign / sit out);
 *  - the watched path (`stepEventRound` until the end) always terminates and
 *    `finishEvent` settles it;
 *  - nothing throws (an exception in a click handler is a dead button).
 *
 *   P1_SOFT=1 P1_SOFT_REGIONS=SAM,NA P1_SOFT_SEASONS=7 npx vitest run src/store/careerSoftlock.probe.test.ts
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";
import {
  advanceDayFlow,
  canSkipShortSquadEvent,
  eventStartBlockOf,
  finishEvent,
  isEventPaused,
  squadHoldFor,
  startEvent,
  stepEventRound,
} from "./careerFlow";

const env = process.env;
const ON = env.P1_SOFT === "1";
const REGIONS = (env.P1_SOFT_REGIONS ?? "NA,EU,SAM,MENA,OCE,APAC,SSA").split(",") as Region[];
const POLICIES = (env.P1_SOFT_POLICIES ?? "autopilot,tuned").split(",") as ArcPolicyId[];
const DIFFS = (env.P1_SOFT_DIFFS ?? "normal").split(",") as CareerDifficulty[];
const SEEDS = Number(env.P1_SOFT_SEEDS ?? 1);
const SEASONS = Number(env.P1_SOFT_SEASONS ?? 7);

/** The lobby the manager will open tomorrow, driven as the event screen drives it. */
function checkLobby(save: CareerSave, found: string[]): number {
  const at = (s: CareerSave) => `S${s.clock.seasonIndex} d${s.clock.day} ${s.pendingEventDef?.id ?? s.activeEvent?.def.id ?? "-"}`;
  let next: CareerSave;
  try {
    next = advanceDayFlow(save);
  } catch (e) {
    found.push(`advance throws at ${at(save)}: ${(e as Error).message}`);
    return 0;
  }
  const def = next.pendingEventDef;
  if (!def || next.activeEvent || def.day !== next.clock.day || next.phase !== "running") return 0;
  const block = eventStartBlockOf(next, def);
  if (block) {
    if (!squadHoldFor(next)) found.push(`blocked (${block}) with no hold at ${at(next)}`);
    else if (block === "absentNoReserve" && !canSkipShortSquadEvent(next)) found.push(`absence with no way out at ${at(next)}`);
    return 1;
  }
  try {
    let w = startEvent(next, true);
    if (!w.activeEvent) {
      found.push(`start refused with no block at ${at(next)}`);
      return 1;
    }
    let guard = 0;
    while (w.activeEvent && w.activeEvent.tournament.stage !== "finished" && !isEventPaused(w) && guard++ < 64) {
      const stepped = stepEventRound(w);
      if (stepped === w) {
        found.push(`step makes no progress at ${at(next)}`);
        break;
      }
      w = stepped;
    }
    if (guard >= 64) found.push(`watched event never ends at ${at(next)}`);
    if (w.activeEvent?.tournament.stage === "finished" && finishEvent(w).activeEvent) found.push(`finish leaves the event open at ${at(next)}`);
  } catch (e) {
    found.push(`event throws at ${at(next)}: ${(e as Error).message}`);
  }
  return 1;
}

describe.skipIf(!ON)("v2.0 (P1) soft-lock probe", () => {
  it(
    "whole careers: every lobby starts or has a way out, nothing throws",
    () => {
      const lines: string[] = [];
      const all: string[] = [];
      for (const region of REGIONS)
        for (const difficulty of DIFFS)
          for (const policy of POLICIES)
            for (let k = 0; k < SEEDS; k++) {
              const seed = 9100 + k * 7919;
              const found: string[] = [];
              let lobbies = 0;
              let softlock: string | null = null;
              let seasons = 0;
              const t0 = Date.now();
              try {
                const career = playArcCareer({
                  region,
                  difficulty,
                  policy,
                  seed,
                  seasons: SEASONS,
                  budgetMs: 1_800_000,
                  onDay: (save) => {
                    lobbies += checkLobby(save, found);
                  },
                });
                softlock = career.softlock;
                seasons = career.seasons.length;
              } catch (e) {
                found.push(`career throws: ${(e as Error).message}\n${(e as Error).stack?.split("\n").slice(1, 6).join("\n")}`);
              }
              if (softlock) found.push(`bot softlock: ${softlock}`);
              const line = `${region} ${difficulty} ${policy} seed ${seed}: ${seasons} seasons, ${lobbies} lobbies, ${found.length} findings, ${Math.round((Date.now() - t0) / 1000)}s`;
              lines.push(line, ...found.map((f) => `   ! ${f}`));
              all.push(...found);
              console.log(line);
              for (const f of found) console.log(`   ! ${f}`);
              if (env.P1_SOFT_OUT) writeFileSync(env.P1_SOFT_OUT, lines.join("\n"));
            }
      expect(all).toEqual([]);
    },
    7_200_000,
  );
});
