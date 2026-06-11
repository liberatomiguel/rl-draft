/** Small shared helpers. UI-agnostic. */

/** Tailwind-friendly conditional class join. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Country code → display name (extend freely in one place). */
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  NL: "Netherlands",
  BE: "Belgium",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czechia",
  AT: "Austria",
  CH: "Switzerland",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  MA: "Morocco",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

/** Initials used by placeholder card art, e.g. "M0nkey M00n" → "MM". */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

let uidCounter = 0;
/** Cheap unique id for runs (not cryptographic). */
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}
