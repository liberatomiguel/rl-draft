/**
 * Test-only (v2.0, C1). Season X's Worlds is cancelled in the shipped game
 * (CAREER_CANCELLED_WORLDS), but the suites written before that play the
 * Worlds mechanics in a career's first season. `playSeasonXWorldsForTests()`
 * switches the cancellation off and returns the function that restores it:
 *
 *   let restore: () => void;
 *   beforeAll(() => { restore = playSeasonXWorldsForTests(); });
 *   afterAll(() => restore());
 *
 * Never imported by app code.
 */
import { CAREER_CANCELLED_WORLDS } from "@/config/balance";

export function playSeasonXWorldsForTests(): () => void {
  const cfg = CAREER_CANCELLED_WORLDS as { seasonIndexes: readonly number[] };
  const shipped = cfg.seasonIndexes;
  cfg.seasonIndexes = [];
  return () => {
    cfg.seasonIndexes = shipped;
  };
}
