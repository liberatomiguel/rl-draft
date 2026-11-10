/** One approved regional catalogue, shared by all fictional players and orgs.
 * Legacy pools are read only by the save compatibility layer. */
import { NAME_CATALOG } from "./nameCatalog";
import type { Region } from "@/engine/types";
import { catalogPlayerName } from "@/engine/career/names";

export const PLAYER_NAME_BANK = Object.fromEntries(Object.entries(NAME_CATALOG.players).map(([region, bank]) => [region, bank.map(name => catalogPlayerName(name, region as Region))])) as Record<Region, string[]>;
export const STARTER_NAME_BANK = PLAYER_NAME_BANK;
export const LOCAL_PLAYER_NAME_BANK = PLAYER_NAME_BANK;
export const FILLER_ORG_NAME_BANK: Record<Region, string[]> = NAME_CATALOG.orgs;
export const LOCAL_TEAM_NAME_BANK = FILLER_ORG_NAME_BANK;
export { PLAYER_NAME_BANK_SWAPS, STAND_IN_NAMES } from "./legacyNames";
export { playerNameBankFor } from "@/engine/career/names";

export const T3_EVENT_NAMES = [
  "The Grid Open", "Boost Bracket", "Kickoff Clash", "Garage Series", "Rocket Rumble",
  "Sunday Circuit", "Neon Cup", "Backboard Bash", "Aerial Alley", "50/50 Community Cup",
];
export const T2_EVENT_NAMES = [
  "Champions Invitational", "Prime Showdown", "Elite Eight", "Signature Series",
  "Crown Circuit", "Velocity Invitational", "Apex Gathering", "Masters Table", "Duds Cup Invitational",
];
