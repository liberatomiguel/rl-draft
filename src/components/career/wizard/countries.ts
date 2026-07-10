/**
 * Road to Worlds — wizard-local country list + quick-start banks.
 *
 * A compact ISO 3166-1 alpha-2 list of esports-relevant countries (the manager
 * flag chip + home-region inference in the creation wizard). This is wizard
 * UI data, not dataset content — flags resolve from public/flags/<cc>.png with
 * CountryChip's text fallback when the file is missing.
 */

import type { Region } from "@/engine/types";

export interface WizardCountry {
  code: string;
  name: string;
  region: Region;
}

export const WIZARD_COUNTRIES: WizardCountry[] = [
  // North America
  { code: "US", name: "United States", region: "NA" },
  { code: "CA", name: "Canada", region: "NA" },
  { code: "MX", name: "Mexico", region: "NA" },
  // South America
  { code: "BR", name: "Brazil", region: "SAM" },
  { code: "AR", name: "Argentina", region: "SAM" },
  { code: "CL", name: "Chile", region: "SAM" },
  { code: "PE", name: "Peru", region: "SAM" },
  { code: "CO", name: "Colombia", region: "SAM" },
  { code: "UY", name: "Uruguay", region: "SAM" },
  // Europe
  { code: "GB", name: "United Kingdom", region: "EU" },
  { code: "FR", name: "France", region: "EU" },
  { code: "DE", name: "Germany", region: "EU" },
  { code: "ES", name: "Spain", region: "EU" },
  { code: "IT", name: "Italy", region: "EU" },
  { code: "NL", name: "Netherlands", region: "EU" },
  { code: "SE", name: "Sweden", region: "EU" },
  { code: "DK", name: "Denmark", region: "EU" },
  { code: "NO", name: "Norway", region: "EU" },
  { code: "FI", name: "Finland", region: "EU" },
  { code: "PL", name: "Poland", region: "EU" },
  { code: "PT", name: "Portugal", region: "EU" },
  { code: "BE", name: "Belgium", region: "EU" },
  { code: "AT", name: "Austria", region: "EU" },
  { code: "CH", name: "Switzerland", region: "EU" },
  { code: "CZ", name: "Czechia", region: "EU" },
  { code: "IE", name: "Ireland", region: "EU" },
  // Middle East & North Africa
  { code: "SA", name: "Saudi Arabia", region: "MENA" },
  { code: "AE", name: "United Arab Emirates", region: "MENA" },
  { code: "QA", name: "Qatar", region: "MENA" },
  { code: "EG", name: "Egypt", region: "MENA" },
  { code: "MA", name: "Morocco", region: "MENA" },
  { code: "JO", name: "Jordan", region: "MENA" },
  // Oceania
  { code: "AU", name: "Australia", region: "OCE" },
  { code: "NZ", name: "New Zealand", region: "OCE" },
  // Asia-Pacific
  { code: "JP", name: "Japan", region: "APAC" },
  { code: "KR", name: "South Korea", region: "APAC" },
  { code: "SG", name: "Singapore", region: "APAC" },
  { code: "MY", name: "Malaysia", region: "APAC" },
  { code: "PH", name: "Philippines", region: "APAC" },
  { code: "TH", name: "Thailand", region: "APAC" },
  { code: "IN", name: "India", region: "APAC" },
  { code: "ID", name: "Indonesia", region: "APAC" },
  // Sub-Saharan Africa
  { code: "ZA", name: "South Africa", region: "SSA" },
  { code: "NG", name: "Nigeria", region: "SSA" },
  { code: "KE", name: "Kenya", region: "SSA" },
  { code: "GH", name: "Ghana", region: "SSA" },
];

export function countryByCode(code: string): WizardCountry | undefined {
  const cc = code.toUpperCase();
  return WIZARD_COUNTRIES.find((c) => c.code === cc);
}

/** Home-region inference for the wizard's step-3 pre-select. */
export function regionForCountry(code: string): Region | null {
  return countryByCode(code)?.region ?? null;
}

/** Tag auto-suggestion: initials for multi-word names, first letters otherwise. */
export function suggestAbbrev(orgName: string): string {
  const words = orgName
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(" ")
    .filter(Boolean);
  let tag = "";
  if (words.length >= 2) {
    tag = words
      .slice(0, 4)
      .map((w) => w[0])
      .join("");
    if (tag.length < 2) tag = words[0].slice(0, 3);
  } else if (words.length === 1) {
    tag = words[0].slice(0, 3);
  }
  return tag
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

/**
 * Quick-start banks (wizard-local, generated-content style — same category as
 * the fictional player/filler banks in src/data/career/names.ts, but kept in
 * the wizard namespace and deliberately DISJOINT from FILLER_ORG_NAME_BANK so
 * a quick-started org never shares a name with a world filler org).
 */
export const QUICKSTART_ORG_NAMES: string[] = [
  "Horizon Peak", "Solstice Club", "Ninefold", "Kite Theory", "Ember Row",
  "Quarter Pipe", "Halcyon Works", "Tidal Mark", "Northlight", "Vermilion Co",
  "Longshot Society", "Gravity Well", "Second Wind", "Latchkey", "Crosswire",
  "Monarch Lane", "Outlier Group", "Daybreak Unit",
];

export const QUICKSTART_MANAGER_NAMES: string[] = [
  "Alex Mercer", "Sam Okoye", "Dana Cruz", "Riko Tanaka", "Lena Vogel",
  "Marco Sales", "Jules Baptiste", "Noa Berg", "Tariq Rahman", "Ivy Chen",
];
