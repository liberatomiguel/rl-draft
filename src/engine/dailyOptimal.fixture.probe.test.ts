/** Opt-in (DAILY_OPT_FIXTURE=<file>): plays a date's Daily through the real
 * store with a reference bot and writes the finished run as the persisted
 * `rocket-draft:run:v1` value, to open the results screen in a browser. */
import { writeFileSync } from "node:fs";
import { it, vi } from "vitest";
import { generateDailyConfig } from "@/lib/daily";
import { dailySeedForDate } from "@/lib/dailyPlan";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { referenceDraft } from "./dailyOptimal";

it.skipIf(!process.env.DAILY_OPT_FIXTURE)("writes a finished Daily run", () => {
  const date = process.env.DAILY_OPT_DATE ?? "2026-11-24";
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
  useProfileStore.getState().resetAll();
  useRunStore.setState({ run: null });
  const start = { rules: generateDailyConfig(date), date, seed: dailySeedForDate(date) };
  const { actions } = referenceDraft(start, Number(process.env.DAILY_OPT_POLICY ?? 7));
  useRunStore.getState().startDailyRun();
  for (const a of actions) {
    const s = useRunStore.getState();
    if (a.kind === "reroll") s.reroll();
    else if (a.kind === "freeReroll") s.freeReroll();
    else s.pickCard(s.run!.draft.offer!.cards.find((c) => c.refId === a.refId && c.specialId === a.specialId)!, a.slot);
  }
  useRunStore.getState().startTournament();
  for (let g = 0; useRunStore.getState().run!.tournament!.stage !== "finished" && g < 30; g++) useRunStore.getState().playRound();
  useRunStore.getState().finishRun();
  const run = useRunStore.getState().run!;
  writeFileSync(process.env.DAILY_OPT_FIXTURE!, JSON.stringify({ state: { run }, version: 3 }));
  vi.useRealTimers();
});
