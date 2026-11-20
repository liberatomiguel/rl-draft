import { CAREER_NAMES, CAREER_UNOFFICIAL, CAREER_WORLD } from "@/config/balance";
import { NAME_CATALOG } from "@/data/career/nameCatalog";
import { players } from "@/data";
import { playerNameBankFor as legacyBank } from "@/data/career/legacyNames";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";
import { derivedFloat, deriveSeed, streams } from "./seeds";

const playerPools = new Map<string, string[]>();
const orgPools = new Map<string, string[]>();
const nameKey = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const realKeys = new Set(players.map(p => nameKey(p.nickname)));
const counts = new Map<string, number>();
/** v2.0.34: the first region (catalogue order) a cross-region homonym appears in keeps it plain. */
const firstRegion = new Map<string, Region>();
for (const [region, bank] of Object.entries(NAME_CATALOG.players) as [Region, string[]][]) {
  for (const name of bank) {
    const key = nameKey(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!firstRegion.has(key)) firstRegion.set(key, region);
  }
}

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/**
 * v2.0.34 (name bank 4): another gamertag from the same base, the way the
 * scene does it ("Zico7", "Rw9") — never a Roman numeral. `wrap` 1 adds one
 * digit (2–9), later wraps two (10–99). Pure, deterministic.
 */
export function gamertagVariant(base: string, wrap: number): string {
  const h = fnv(`${base}:${wrap}`);
  return wrap <= 1 ? `${base}${2 + (h % 8)}` : `${base}${10 + (h % 90)}`;
}

/**
 * Keep the submitted base spelling; distinguish the real-player clashes and
 * cross-region homonyms: " II" / " {region}" up to name bank 3, a gamertag
 * variant from bank 4 (the first region keeps a homonym plain).
 */
export function catalogPlayerName(name: string, region: Region, version = 3): string {
  const key = nameKey(name);
  if (version >= 4) {
    if (realKeys.has(key)) return gamertagVariant(name, 1);
    return (counts.get(key) ?? 0) > 1 && firstRegion.get(key) !== region ? gamertagVariant(name, 1) : name;
  }
  return realKeys.has(key) ? `${name} II` : (counts.get(key) ?? 0) > 1 ? `${name} ${region}` : name;
}

/**
 * v2.0.34 (name bank 4): a region's org names with a seeded share in another
 * real-scene shape (CAREER_NAMES.orgShapes), one-to-one in catalogue order.
 */
export function shapedOrgNames(region: Region, seed: number): string[] {
  const s = CAREER_NAMES.orgShapes;
  const keep = new Set<string>(CAREER_NAMES.orgShapeKeepWords);
  const source = NAME_CATALOG.orgs[region];
  const used = new Set(source.map(nameKey));
  return source.map((name) => {
    const words = name.split(" ");
    if (words.length !== 2 || words.some((w) => keep.has(w))) return name;
    const f = derivedFloat(seed, streams.gen("orgShape", `${region}:${name}`));
    const head = words[0];
    const shaped =
      f < s.team ? `Team ${head}`
      : f < s.team + s.gaming ? `${head} Gaming`
      : f < s.team + s.gaming + s.esports ? `${head} Esports`
      : f < s.team + s.gaming + s.esports + s.single ? head
      : name;
    if (shaped === name || used.has(nameKey(shaped))) return name;
    used.add(nameKey(shaped));
    return shaped;
  });
}

function poolFor(region: Region, seed: number, type: "players" | "orgs", version: number): string[] {
  const cache = type === "players" ? playerPools : orgPools;
  const v = version >= 4 ? 4 : 3;
  const cacheKey = `${region}:${seed}:${v}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const source =
    type === "players"
      ? NAME_CATALOG.players[region].map(name => catalogPlayerName(name, region, v))
      : v >= 4 ? shapedOrgNames(region, seed) : NAME_CATALOG.orgs[region];
  // The shuffle reads the same stream for every version: a name keeps its place.
  const bank = createRng(deriveSeed(seed, streams.gen(type === "players" ? "nameCatalog" : "orgNameCatalog", region))).shuffle(source);
  if (cache.size > 64) cache.clear();
  cache.set(cacheKey, bank);
  return bank;
}

/** A seeded allocation, never a separate amateur/pro/founder naming style. */
export function playerNamePoolFor(region: Region, seed: number, group: "starter" | "local" | "player", version = 3): readonly string[] {
  const bank = poolFor(region, seed, "players", version);
  const founderEnd = 9;
  const localEnd = founderEnd + CAREER_UNOFFICIAL.localScenePool * 3;
  return group === "starter" ? bank.slice(0, founderEnd) : group === "local" ? bank.slice(founderEnd, localEnd) : bank.slice(localEnd);
}

export function playerNameBankFor(region: Region, version: number | undefined, seed = 0): readonly string[] {
  return (version ?? 1) < 3 ? legacyBank(region, version) : playerNamePoolFor(region, seed, "player", version);
}

export function orgNamePoolFor(region: Region, seed: number, group: "pro" | "local", version = 3): readonly string[] {
  const bank = poolFor(region, seed, "orgs", version);
  return group === "pro" ? bank.slice(0, CAREER_WORLD.minOrgsPerRegion) : bank.slice(CAREER_WORLD.minOrgsPerRegion);
}
