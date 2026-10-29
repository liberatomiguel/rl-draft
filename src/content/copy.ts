"use client";

/**
 * Copy access layer (i18n, v1.0).
 *
 * - `useCopy()` — reactive dictionary for client components. MOUNTED-GATED:
 *   the first render (the static HTML, then hydration) uses the URL's language
 *   (`UrlLocaleContext`, set by the root layout's `LocaleRoot`: PT on the /pt
 *   pages, EN elsewhere — rc.32, DRAFT-11), then the persisted language, so
 *   there's no hydration mismatch and a /pt page never paints English chrome.
 * - `useUiLocale()` — the same choice as a language code ("en" | "pt").
 * - `getCopy()` — non-reactive access for helpers / outside React (EN on the
 *   server; tracks the language on the client).
 * - The EN named groups are re-exported for back-compat (server metadata reads
 *   them from `copy.en` directly; any client spot not yet migrated still works,
 *   just in EN).
 * - Career mode (Road to Worlds) copy is NOT in this dictionary — career code
 *   reads it via `useCareerCopy()` / `getCareerCopy()` in `careerCopy.ts`, so
 *   the draft-game pages don't ship it.
 */

import { createContext, useContext } from "react";
import type { UiLocale } from "@/lib/locale";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { EN, type Copy } from "./copy.en";
import { PT } from "./copy.pt";

const DICT: Record<UiLocale, Copy> = { en: EN, pt: PT };

export type { Copy };

/** The URL's language (`localeOfPath`), provided once by the root layout.
 *  Outside a provider (tests, a detached render) it is EN, as before rc.32. */
export const UrlLocaleContext = createContext<UiLocale>("en");

/** The UI language: the URL's until the client has mounted, then the player's. */
export function useUiLocale(): UiLocale {
  const urlLocale = useContext(UrlLocaleContext);
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  return mounted ? lang : urlLocale;
}

export function useCopy(): Copy {
  return DICT[useUiLocale()];
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
