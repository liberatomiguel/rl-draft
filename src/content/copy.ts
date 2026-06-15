"use client";

/**
 * Copy access layer (i18n, v1.0).
 *
 * - `useCopy()` — reactive dictionary for client components. MOUNTED-GATED:
 *   returns EN on the first render (matching the server) and then the persisted
 *   language, so there's no hydration mismatch/flash.
 * - `getCopy()` — non-reactive access for helpers / outside React (EN on the
 *   server; tracks the language on the client).
 * - The EN named groups are re-exported for back-compat (server metadata reads
 *   them from `copy.en` directly; any client spot not yet migrated still works,
 *   just in EN).
 */

import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { EN, type Copy } from "./copy.en";
import { PT } from "./copy.pt";

const DICT: Record<"en" | "pt", Copy> = { en: EN, pt: PT };

export type { Copy };

export function useCopy(): Copy {
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  return DICT[mounted ? lang : "en"];
}

let active: Copy = EN;
if (typeof window !== "undefined") {
  active = DICT[useSettings.getState().lang] ?? EN;
  useSettings.subscribe((s) => {
    active = DICT[s.lang] ?? EN;
  });
}
export function getCopy(): Copy {
  return active;
}

export const {
  APP,
  NAV,
  HOME,
  NAV_UI,
  RUN_UI,
  SETUP,
  DIFFICULTY_LABELS,
  DRAFT_UI,
  ONBOARDING,
  REVIEW,
  TOURNAMENT_UI,
  RESULTS_UI,
  COLLECTION_UI,
  SETTINGS_UI,
  PROFILE_UI,
  ACH_UI,
  HOWTO,
  NARRATION,
  STAT_LABELS,
  SPECIAL_TYPE_LABELS,
  RARITY_LABELS,
  EFFECT_LABELS,
  CHEM_TIERS,
} = EN;
