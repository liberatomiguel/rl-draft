"use client";

/**
 * v2.0.32 (DESIGN-DECISIONS #171): the client half of `lib/assetHeal`. Once the
 * app has mounted it stands the watchdog down (browsers without
 * `responseStatus`), and it reports a repair the inline script made on the
 * previous load, once (`quality_error`, source "heal").
 */

import { useEffect } from "react";
import { reportAssetHeal } from "@/lib/analytics";
import { markAppBooted, takeAssetHealNote } from "@/lib/assetHeal";

export function AssetHealReport(): null {
  useEffect(() => {
    markAppBooted();
    let store: Storage | null = null;
    try {
      store = window.sessionStorage;
    } catch {
      store = null;
    }
    const note = takeAssetHealNote(store);
    if (note) reportAssetHeal(note);
  }, []);
  return null;
}
