/**
 * rc.30 (rc.29 review, P1): the playtest build mounts no unlock pop-up
 * (AppShell), and the results XP count-up waits for the unlock queue to empty
 * — so a queued unlock froze the total at "+0 XP" for the rest of the tab.
 * The playtest build never queues; a normal build still announces unlocks.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { COSMETICS } from "@/data/cosmetics";

async function load(playtest: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_PLAYTEST", playtest ? "1" : "");
  const { useProfileStore } = await import("./profileStore");
  const { useCosmeticUnlocks } = await import("./cosmeticUnlockStore");
  return { useProfileStore, useCosmeticUnlocks };
}

/** A newly owned catalog cosmetic, the way a run or a milestone grants one. */
function grantOne(store: Awaited<ReturnType<typeof load>>["useProfileStore"]): string {
  const owned = store.getState().cosmetics.owned;
  const id = COSMETICS.find((c) => !owned[c.id])!.id;
  store.setState((s) => ({ cosmetics: { ...s.cosmetics, owned: { ...s.cosmetics.owned, [id]: "2026-10-29" } } }));
  return id;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the unlock pop-up queue (rc.30)", () => {
  it("a normal build queues every newly owned cosmetic", async () => {
    const { useProfileStore, useCosmeticUnlocks } = await load(false);
    const id = grantOne(useProfileStore);
    expect(useCosmeticUnlocks.getState().queue).toContain(id);
  });

  it("the playtest build never queues (nothing there would ever drain it)", async () => {
    const { useProfileStore, useCosmeticUnlocks } = await load(true);
    grantOne(useProfileStore);
    expect(useCosmeticUnlocks.getState().queue).toEqual([]);
  });
});
