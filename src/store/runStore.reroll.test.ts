/** rc.29 (E2E DRAFT-12): a paid reroll is never spent on an offer where nothing fits. */
import { beforeEach, describe, expect, it } from "vitest";
import { useRunStore } from "./runStore";

beforeEach(() => {
  useRunStore.setState({ run: null });
});

describe("reroll on a dead offer", () => {
  it("rerolls for free when no card in the offer is pickable", () => {
    useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true, regionLock: null });
    const run = useRunStore.getState().run!;
    const dead = { ...run.draft.offer!, hasPickableCard: false };
    useRunStore.setState({ run: { ...run, draft: { ...run.draft, offer: dead, rerollsLeft: 1 } } });

    useRunStore.getState().reroll();
    const after = useRunStore.getState().run!;
    expect(after.draft.rerollsLeft).toBe(1);
    expect(after.rngState).not.toBe(run.rngState);
  });

  it("still spends the paid reroll on a live offer", () => {
    useRunStore.getState().startRun({ mode: "classic", difficulty: "normal", showOverall: true, regionLock: null });
    const run = useRunStore.getState().run!;
    useRunStore.setState({ run: { ...run, draft: { ...run.draft, offer: { ...run.draft.offer!, hasPickableCard: true }, rerollsLeft: 2 } } });
    useRunStore.getState().reroll();
    expect(useRunStore.getState().run!.draft.rerollsLeft).toBe(1);
  });
});
