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
import { createRng } from "@/lib/rng";
import type { Region } from "../types";
import { deriveSeed, derivedFloat, streams } from "./seeds";

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
  // rc.28: a stride sharing a factor with the bank length cycles early (4 over
  // the 16-name banks gave a pool of 8 sides only 4 names, each twice), so it
  // steps up until one cycle covers the whole pool.
  let stride = 1 + (Math.floor(derivedFloat(careerSeed, streams.gen("localStride", parsed.region)) * 5) % 5);
  while (
    bank.length / gcd(stride, bank.length) < CAREER_UNOFFICIAL.localScenePool &&
    stride < bank.length
  ) {
    stride += 1;
  }
  return bank[(base + parsed.k * stride) % bank.length];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Rating offset vs. the user team, uniform in localSceneBand (one decimal). */
export function localTeamOffset(ref: string, careerSeed: number): number {
  const [lo, hi] = CAREER_UNOFFICIAL.localSceneBand;
  const f = derivedFloat(careerSeed, streams.gen("localOffset", ref));
  return Math.round((lo + f * (hi - lo)) * 10) / 10;
}

/** Three amateur gamertags for the side — the regional bank, no numeric tags
 *  (rc.2: "Pivete", not "Pivete37"). rc.28: one shuffle of the bank per
 *  region-season, three consecutive names per slot, so no two local sides of
 *  a pool share a player (8 sides × 3 = 24 of the 40 names) — a fixture used
 *  to show the same gamertag scoring for both teams. */
export function localPlayerNames(ref: string, careerSeed: number): [string, string, string] {
  const parsed = parseLocalRef(ref);
  const region = parsed?.region ?? "NA";
  const bank = PLAYER_NAME_BANK[region] ?? PLAYER_NAME_BANK.NA;
  const order = createRng(
    deriveSeed(careerSeed, streams.gen("localPlayers", `${region}:${parsed?.seasonIndex ?? 0}`)),
  ).shuffle(bank);
  const at = (parsed?.k ?? 0) * 3;
  return [0, 1, 2].map((i) => order[(at + i) % order.length]) as [string, string, string];
}
