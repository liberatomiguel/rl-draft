"use client";

/**
 * Career copy access layer (Road to Worlds).
 *
 * The CAREER dictionaries (`copy.career.en.ts` / `copy.career.pt.ts`) are NOT
 * part of the core EN/PT dictionaries in `copy.ts`: folding them in shipped
 * ~26 KB gzipped of career strings to every page of the draft game. Import
 * this module (and `copy.career.*`) ONLY from career code — `src/app/career/**`
 * and `src/components/career/**` — so the strings stay in the career chunks.
 * The home card's few career strings live in the core `HOME` group instead.
 *
 * Same contract as `copy.ts`:
 * - `useCareerCopy()` — reactive, MOUNTED-GATED: EN on the first render
 *   (matching the server), then the persisted language.
 * - `getCareerCopy()` — non-reactive access outside React (EN on the server;
 *   tracks the language on the client).
 */

import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { CAREER_EN, type CareerCopy } from "./copy.career.en";
import { CAREER_PT } from "./copy.career.pt";

const DICT: Record<"en" | "pt", CareerCopy> = { en: CAREER_EN, pt: CAREER_PT };

export type { CareerCopy };

export function useCareerCopy(): CareerCopy {
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  return DICT[mounted ? lang : "en"];
}

let active: CareerCopy = CAREER_EN;
if (typeof window !== "undefined") {
  active = DICT[useSettings.getState().lang] ?? CAREER_EN;
  useSettings.subscribe((s) => {
    active = DICT[s.lang] ?? CAREER_EN;
  });
}
export function getCareerCopy(): CareerCopy {
  return active;
}
