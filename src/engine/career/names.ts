import { CAREER_UNOFFICIAL, CAREER_WORLD } from "@/config/balance";
import { NAME_CATALOG } from "@/data/career/nameCatalog";
import { players } from "@/data";
import { playerNameBankFor as legacyBank } from "@/data/career/legacyNames";
import type { Region } from "@/engine/types";
import { createRng } from "@/lib/rng";
import { deriveSeed, streams } from "./seeds";

const playerPools = new Map<Region, { seed: number; bank: string[] }>();
const orgPools = new Map<Region, { seed: number; bank: string[] }>();
const nameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const realKeys = new Set(players.map(p => nameKey(p.nickname)));
const counts = new Map<string, number>();
for (const bank of Object.values(NAME_CATALOG.players)) for (const name of bank) counts.set(nameKey(name), (counts.get(nameKey(name)) ?? 0) + 1);

/** Keep the submitted base spelling; distinguish the five real-player clashes and cross-region homonyms. */
export function catalogPlayerName(name: string, region: Region): string {
  return realKeys.has(nameKey(name)) ? `${name} II` : (counts.get(nameKey(name)) ?? 0) > 1 ? `${name} ${region}` : name;
}

function poolFor(region: Region, seed: number, type: "players" | "orgs"): string[] {
  const cache = type === "players" ? playerPools : orgPools;
  const cached = cache.get(region);
  if (cached?.seed === seed) return cached.bank;
  const source = type === "players" ? NAME_CATALOG.players[region].map(name => catalogPlayerName(name, region)) : NAME_CATALOG.orgs[region];
  const bank = createRng(deriveSeed(seed, streams.gen(type === "players" ? "nameCatalog" : "orgNameCatalog", region))).shuffle(source);
  cache.set(region, { seed, bank });
  return bank;
}

/** A seeded allocation, never a separate amateur/pro/founder naming style. */
export function playerNamePoolFor(region: Region, seed: number, group: "starter" | "local" | "player"): readonly string[] {
  const bank = poolFor(region, seed, "players");
  const founderEnd = 9;
  const localEnd = founderEnd + CAREER_UNOFFICIAL.localScenePool * 3;
  return group === "starter" ? bank.slice(0, founderEnd) : group === "local" ? bank.slice(founderEnd, localEnd) : bank.slice(localEnd);
}

export function playerNameBankFor(region: Region, version: number | undefined, seed = 0): readonly string[] {
  return (version ?? 1) < 3 ? legacyBank(region, version) : playerNamePoolFor(region, seed, "player");
}

export function orgNamePoolFor(region: Region, seed: number, group: "pro" | "local"): readonly string[] {
  const bank = poolFor(region, seed, "orgs");
  return group === "pro" ? bank.slice(0, CAREER_WORLD.minOrgsPerRegion) : bank.slice(CAREER_WORLD.minOrgsPerRegion);
}
