/**
 * National teams → collection (v2.0). Seeing a national team in a classic draft
 * collects ALL of its cards at once (it shows one card per pick, so collecting
 * by drafting would need the same rare draw three or four times). Drives the
 * REAL runStore actions (startRun + reroll) until a national offer appears.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { lineupById, nationalSpecialIdsByLineupId } from "@/data";
import { useProfileStore } from "./profileStore";
import { useRewardToasts } from "./rewardToastStore";
import { useRunStore } from "./runStore";

beforeEach(() => {
  useProfileStore.setState({ unlockedSpecials: {} });
  useRewardToasts.setState({ queue: [] });
  useRunStore.setState({ run: null });
});

/** Reroll until the current offer is a national team (bounded); returns its lineup id. */
function rerollToNational(): string | null {
  for (let i = 0; i < 1000; i++) {
    const offer = useRunStore.getState().run!.draft.offer!;
    if (lineupById.get(offer.lineupId)?.national) return offer.lineupId;
    useRunStore.getState().reroll();
  }
  return null;
}

describe("national teams — seeing one collects every card (v2.0)", () => {
  it("collects the whole roster once, with a single toast for the new cards", () => {
    useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true, regionLock: null });
    const run = useRunStore.getState().run!;
    expect(run.draft.nationalTeams).toBeTruthy(); // classic runs opt in
    useRunStore.setState({ run: { ...run, draft: { ...run.draft, rerollsLeft: 5000 } } });

    const lineupId = rerollToNational();
    expect(lineupId).not.toBeNull();
    const ids = nationalSpecialIdsByLineupId.get(lineupId!)!;
    const unlocked = useProfileStore.getState().unlockedSpecials;
    for (const id of ids) expect(unlocked[id], id).toBeTruthy();

    const toasts = useRewardToasts.getState().queue.filter((t) => t.kind === "nationalTeam");
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ kind: "nationalTeam", cards: ids.length });
  });

  it("a team already in the album collects nothing new and stays quiet", () => {
    // Pre-own EVERY national card: any national draw is then a repeat. Before
    // startRun — its first offer is a national team for ~2.5 % of the random
    // seeds, and that one used to be collected into an empty album (rc.28 fix
    // of an intermittent failure).
    const owned = Object.fromEntries(
      [...nationalSpecialIdsByLineupId.values()].flat().map((id) => [id, "2026-01-01T00:00:00.000Z"]),
    );
    useProfileStore.setState({ unlockedSpecials: owned });
    useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true, regionLock: null });
    const run = useRunStore.getState().run!;
    useRunStore.setState({ run: { ...run, draft: { ...run.draft, rerollsLeft: 5000 } } });

    expect(rerollToNational()).not.toBeNull();
    expect(useRewardToasts.getState().queue.some((t) => t.kind === "nationalTeam")).toBe(false);
    expect(useProfileStore.getState().unlockedSpecials).toEqual(owned);
  });
});
