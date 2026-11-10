import { HISTORICAL_WORLDS } from "@/data/career/historicalHonors";
import type { CareerSave, CompactEventResult } from "./types";

export interface CareerHonor {
  eventId: string;
  seasonIndex: number;
  tier: "major" | "worlds";
  orgRef: string;
  orgName: string;
  players: { id: string; name: string }[];
}
export interface HonorRow { id: string; name: string; majors: number; worlds: number }

/** Stored at settlement, before a transfer or season rollover can change the roster. */
export function recordHonor(save: CareerSave, result: CompactEventResult, players: { id: string; name: string }[]): void {
  if (result.tier !== "major" && result.tier !== "worlds") return;
  const records = save.honors ??= [];
  if (records.some(r => r.eventId === result.eventId && r.seasonIndex === result.seasonIndex)) return;
  records.push({ eventId: result.eventId, seasonIndex: result.seasonIndex, tier: result.tier, orgRef: result.championRef, orgName: result.rows.find(r => r.ref === result.championRef)?.name ?? result.championRef, players: players.map(p => ({ ...p })) });
}

export function honorsTableOf(save: CareerSave, mode: "orgs" | "players"): HonorRow[] {
  const rows = new Map<string, HonorRow>();
  const add = (id: string, name: string, tier: "major" | "worlds", count = 1) => {
    const row = rows.get(id) ?? { id, name, majors: 0, worlds: 0 };
    row[tier === "major" ? "majors" : "worlds"] += count;
    rows.set(id, row);
  };
  for (const event of HISTORICAL_WORLDS) {
    if (mode === "orgs") add(event.org, event.name, "worlds");
    else for (const [id, name] of event.players) add(id, name, "worlds");
  }
  for (const event of save.honors ?? []) {
    if (mode === "orgs") add(event.orgRef, event.orgName, event.tier);
    else for (const p of event.players) add(p.id, p.name, event.tier);
  }
  if (mode === "orgs") {
    // Legacy saves keep their known org results. Never invent missing player lineups.
    for (const event of save.eventResults) {
      if (event.tier !== "major" && event.tier !== "worlds") continue;
      if (save.honors?.some(r => r.eventId === event.eventId && r.seasonIndex === event.seasonIndex)) continue;
      add(event.championRef, event.rows.find(r => r.ref === event.championRef)?.name ?? event.championRef, event.tier);
    }
    const user = rows.get("user") ?? { id: "user", name: save.identity.orgName, majors: 0, worlds: 0 };
    user.majors = save.stats.titlesMajor;
    user.worlds = save.stats.titlesWorlds;
    rows.set("user", user);
  }
  return [...rows.values()].sort((a,b) => b.worlds-a.worlds || b.majors-a.majors || a.name.localeCompare(b.name));
}
