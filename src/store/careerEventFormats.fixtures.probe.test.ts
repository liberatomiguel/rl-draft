/**
 * v2.2 event formats — screen fixtures (opt-in: EF_FIX=1, EF_FIX_OUT=<dir>).
 * Writes persisted career stores (the exact localStorage value of
 * "rocket-draft:career:v1") of the user's first Major in several shapes and
 * moments, for checking the screens in a dev build with the flag on:
 *   lobby (4 groups → 12 hybrid), mid group stage, paused after the groups,
 *   a 16-team double elimination paused after Saturday, a hybrid-8 Sunday
 *   half played, a 12-team knockout finished (the digest).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import type { EventLayout } from "@/engine/types";
import { isEventPaused, startEvent, stepEventRound } from "./careerFlow";
import { majorLobbyForTests } from "./careerMajorLobbyForTests";
import { startSundayFlow } from "./careerSunday";

const ON = process.env.EF_FIX === "1";
const OUT = process.env.EF_FIX_OUT ?? "";

const store = (save: CareerSave) =>
  JSON.stringify({ state: { slots: [save, null, null], activeSlot: 0, achievements: { unlocked: {}, worldsWonOn: {} } }, version: 3 });

function withLayout(lobby: CareerSave, layout: EventLayout): CareerSave {
  const at = structuredClone(lobby);
  at.pendingEventDef = { ...at.pendingEventDef!, layout };
  for (const p of at.squad) p.overall = Math.max(p.overall, 90);
  return at;
}

function toPause(save: CareerSave): CareerSave {
  let s = save;
  let guard = 0;
  while (!isEventPaused(s) && s.activeEvent?.tournament.stage !== "finished" && guard++ < 30) s = stepEventRound(s);
  return s;
}

describe.skipIf(!ON)("v2.2 event formats: screen fixtures", () => {
  it("writes the stores", () => {
    mkdirSync(OUT, { recursive: true });
    const lobby = majorLobbyForTests();
    const h12 = withLayout(lobby, { stage: "groups4", bracket: "hybrid12" });
    writeFileSync(join(OUT, "ef-lobby-hybrid12.json"), store(h12));

    const mid = stepEventRound(startEvent(h12, true));
    writeFileSync(join(OUT, "ef-groups-mid.json"), store(mid));
    writeFileSync(join(OUT, "ef-groups-paused.json"), store(toPause(mid)));

    const d16 = toPause(startEvent(withLayout(lobby, { stage: "none", bracket: "double16" }), true));
    writeFileSync(join(OUT, "ef-double16-paused.json"), store(d16));

    let h8 = startSundayFlow(toPause(startEvent(withLayout(lobby, { stage: "swiss", bracket: "hybrid8" }), true))).save;
    h8 = stepEventRound(stepEventRound(h8));
    writeFileSync(join(OUT, "ef-hybrid8-sunday.json"), store(h8));

    let s12 = startSundayFlow(toPause(startEvent(withLayout(lobby, { stage: "groups4", bracket: "single12" }), true))).save;
    let guard = 0;
    while (s12.activeEvent?.tournament.stage !== "finished" && guard++ < 30) s12 = stepEventRound(s12);
    writeFileSync(join(OUT, "ef-single12-finished.json"), store(s12));

    const gsl = toPause(startEvent(withLayout(lobby, { stage: "gsl8", bracket: "hybrid8" }), true));
    writeFileSync(join(OUT, "ef-gsl8-paused.json"), store(gsl));
    expect(gsl.activeEvent?.tournament.playoffs).not.toBeNull();
  }, 120_000);
});
