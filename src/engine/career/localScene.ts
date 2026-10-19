/**
 * Road to Worlds — the LOCAL AMATEUR SCENE (v2.0, R23).
 *
 * Community Cups used to field the seven closest world orgs — and at season
 * 0 every org in a region out-rates a starter roster, so a new org lost every
 * cup for splits (Miguel's playtests). Local teams are procedural amateur
 * sides that exist only inside t3 fields: deterministic per (career, region,
 * season, slot), rated within CAREER_UNOFFICIAL.localSceneBand of the user
 * team, never persisted, never in standings. Refs look like
 * `local:<region>:<seasonIndex>:<k>` and resolve by hash — no save state.
 *
 * Pure TS: names and offsets come from `derivedFloat` (no Rng cursor).
 */

import { CAREER_UNOFFICIAL } from "@/config/balance";
import { LOCAL_TEAM_NAME_BANK, PLAYER_NAME_BANK } from "@/data/career/names";
import type { Region } from "../types";
import { derivedFloat, streams } from "./seeds";

export const LOCAL_PREFIX = "local:";

export function isLocalRef(ref: string): boolean {
  return ref.startsWith(LOCAL_PREFIX);
}

export function localRef(region: Region, seasonIndex: number, k: number): string {
  return `${LOCAL_PREFIX}${region}:${seasonIndex}:${k}`;
}

export function parseLocalRef(
  ref: string,
): { region: Region; seasonIndex: number; k: number } | null {
  if (!isLocalRef(ref)) return null;
  const [region, season, k] = ref.slice(LOCAL_PREFIX.length).split(":");
  const seasonIndex = Number(season);
  const slot = Number(k);
  if (!region || !Number.isFinite(seasonIndex) || !Number.isFinite(slot)) return null;
  return { region: region as Region, seasonIndex, k: slot };
}

/** The pool of local refs for a region-season (CAREER_UNOFFICIAL.localScenePool). */
export function localSceneRefs(region: Region, seasonIndex: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < CAREER_UNOFFICIAL.localScenePool; k++) out.push(localRef(region, seasonIndex, k));
  return out;
}

/** Team name — regional bank pick by hash; two teams in one pool never share a name. */
export function localTeamName(ref: string, careerSeed: number): string {
  const parsed = parseLocalRef(ref);
  if (!parsed) return ref;
  const bank = LOCAL_TEAM_NAME_BANK[parsed.region] ?? LOCAL_TEAM_NAME_BANK.NA;
  const base = Math.floor(
    derivedFloat(careerSeed, streams.gen("localName", `${parsed.region}:${parsed.seasonIndex}`)) *
      bank.length,
  );
  // Stride through the bank from a per-season start so the k slots are distinct.
  const stride = 1 + (Math.floor(derivedFloat(careerSeed, streams.gen("localStride", parsed.region)) * 5) % 5);
  return bank[(base + parsed.k * stride) % bank.length];
}

/** Rating offset vs. the user team, uniform in localSceneBand (one decimal). */
export function localTeamOffset(ref: string, careerSeed: number): number {
  const [lo, hi] = CAREER_UNOFFICIAL.localSceneBand;
  const f = derivedFloat(careerSeed, streams.gen("localOffset", ref));
  return Math.round((lo + f * (hi - lo)) * 10) / 10;
}

/** Three amateur gamertags for the side — the regional bank, no numeric tags
 *  (rc.2: "Pivete", not "Pivete37"), distinct within the side. */
export function localPlayerNames(ref: string, careerSeed: number): [string, string, string] {
  const parsed = parseLocalRef(ref);
  const region = parsed?.region ?? "NA";
  const bank = PLAYER_NAME_BANK[region] ?? PLAYER_NAME_BANK.NA;
  const start = Math.floor(derivedFloat(careerSeed, streams.gen("localPlayer", ref)) * bank.length);
  const stride = 1 + (Math.floor(derivedFloat(careerSeed, streams.gen("localTag", ref)) * 7) % 7);
  const names: string[] = [];
  for (let i = 0; i < 3; i++) names.push(bank[(start + i * stride) % bank.length]);
  return names as [string, string, string];
}
