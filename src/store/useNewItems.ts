"use client";

/**
 * React side of the profile's "New" markers (rc.33, COL-02c). The model is pure
 * (`engine/newItems`, scope keys and dots in `engine/profileNew`); this file only
 * reads the profile store. Dataset-free, so the nav and the home can use it (#142).
 *
 * - `useProfileNew()` — the new items, split by where they show (tags inside).
 * - `useNewDots()` — one dot per destination (nav, home tiles), derived from the
 *   SAME items (`newDotsOf`), so a dot outside always has a tag inside.
 * - `useOpenContent()` — call it when the player OPENS content (a card's detail,
 *   a team page, a challenge briefing): it returns which of its keys were new,
 *   for the tags shown while it is open, and marks them seen. Visiting a tab
 *   never calls it.
 * Before mount everything reads empty: the server render and the hydration
 * render agree, and the persisted profile only exists in the browser.
 */

import { useCallback, useMemo } from "react";
import { FEATURES } from "@/config/balance";
import { unseenOwnedIds } from "@/engine/cosmetics";
import {
  EMPTY_PROFILE_NEW,
  newDotsOf,
  profileNewSummary,
  type NewDots,
  type ProfileNewSummary,
} from "@/engine/profileNew";
import { rankForXp } from "@/engine/progression";
import { selectCollectionUnlocked, useProfileStore } from "./profileStore";
import { useMounted } from "./useMounted";

export function useProfileNew(): ProfileNewSummary {
  const mounted = useMounted();
  const unlockedSpecials = useProfileStore((s) => s.unlockedSpecials);
  const nationalDiscovered = useProfileStore((s) => s.nationalDiscovered);
  const xp = useProfileStore((s) => s.xp);
  const challengesCompleted = useProfileStore((s) => s.challengesCompleted);
  const newItems = useProfileStore((s) => s.newItems);
  return useMemo(
    () =>
      mounted
        ? profileNewSummary(newItems, { unlockedSpecials, nationalDiscovered, xp, challengesCompleted })
        : EMPTY_PROFILE_NEW,
    [mounted, newItems, unlockedSpecials, nationalDiscovered, xp, challengesCompleted],
  );
}

export function useNewDots(): NewDots {
  const summary = useProfileNew();
  const collectionOpen = useProfileStore(selectCollectionUnlocked);
  const challengesOpen = useProfileStore((s) => rankForXp(s.xp).id !== "unranked");
  const unseenCosmetics = useProfileStore((s) => unseenOwnedIds(s.cosmetics).length);
  const mounted = useMounted();
  return newDotsOf(summary, {
    collectionOpen,
    challengesOpen,
    unseenCosmetics: mounted ? unseenCosmetics : 0,
    // The playtest build has no cosmetics (no locker), so nothing to point at.
    cosmeticsOn: !FEATURES.playtest,
  });
}

/** "The player opened this content": returns which of `keys` were new and marks them seen. */
export function useOpenContent(): (keys: readonly string[]) => ReadonlySet<string> {
  const markItemsSeen = useProfileStore((s) => s.markItemsSeen);
  return useCallback(
    (keys: readonly string[]) => {
      const state = useProfileStore.getState();
      const isNew = profileNewSummary(state.newItems, state).keys;
      const fresh = new Set(keys.filter((key) => isNew.has(key)));
      if (fresh.size) markItemsSeen([...fresh]);
      return fresh;
    },
    [markItemsSeen],
  );
}
