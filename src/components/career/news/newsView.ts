/**
 * rc.36 (ROADMAP UX-03, R87): what a news item shows besides its words — the
 * crests (the user's org, the orgs it names, a beat's orgs), its region, and
 * the action it leads to (the screen where its consequence is handled).
 * Presentation only: it reads the item's params and the save, never changes
 * either.
 */

import type { CareerSave, NewsItem } from "@/engine/career/types";
import type { Region } from "@/engine/types";

/** News about the user's own org (its crest leads the row). */
const USER_KEYS = new Set([
  "resultUser",
  "qualifiedRegional",
  "missedRegional",
  "qualifiedMajor",
  "missedMajor",
  "qualifiedWorlds",
  "missedWorlds",
  "userSigned",
  "userSold",
  "userReleased",
  "stability",
  "regionalSkipped",
  "scrimWin",
  "scrimLoss",
  "scrimSkipped",
  "bootcampRun",
  "coachHired",
]);

const MINE_TYPES = new Set(["org", "training", "rep"]);

export type NewsAction = "market" | "standings" | "squad" | "finances" | "training" | "club" | "calendar";

const ACTION_HREF: Record<NewsAction, string> = {
  market: "/career/market",
  standings: "/career/standings",
  squad: "/career/squad",
  finances: "/career/finances",
  training: "/career/training",
  club: "/career/club",
  calendar: "/career/calendar",
};

const ACTION_BY_KEY: Record<string, NewsAction> = {
  transfer: "market",
  transferFee: "market",
  transferFa: "market",
  userSigned: "squad",
  userSold: "market",
  userReleased: "market",
  windowOpen: "market",
  windowReport: "market",
  incomingBid: "market",
  rookieClass: "market",
  retired: "market",
  retiredToCoach: "market",
  resultUser: "standings",
  result: "standings",
  seasonChampion: "standings",
  qualifiedRegional: "calendar",
  missedRegional: "standings",
  qualifiedMajor: "calendar",
  missedMajor: "standings",
  qualifiedWorlds: "calendar",
  missedWorlds: "standings",
  stability: "standings",
  regionalSkipped: "squad",
  contractReminder: "squad",
  contractExpiring: "squad",
  playerLeft: "squad",
  retiredLeaves: "squad",
  retirementAnnounce: "squad",
  decline: "squad",
  unavailable: "squad",
  cashWarning: "finances",
  cashNotice: "finances",
  bankLoan: "finances",
  bankCleared: "finances",
  debtCleared: "finances",
  loanCollected: "finances",
  loanDeadline: "finances",
  loanSlipped: "finances",
  loanTakenOver: "finances",
  insolvency: "finances",
  sponsorSigned: "finances",
  sponsorEnded: "finances",
  sponsorGoalHit: "finances",
  sponsorGoalMissed: "finances",
  sponsorGoalSet: "finances",
  sponsorLapsed: "finances",
  sponsorOffers: "finances",
  objectiveHit: "finances",
  objectiveMissed: "finances",
  foundingPartner: "finances",
  foundingPartnerEnds: "finances",
  foundingHandover: "finances",
  gearBought: "finances",
  scrimWin: "training",
  scrimLoss: "training",
  scrimSkipped: "training",
  bootcampRun: "training",
  coachHired: "training",
  unlock: "club",
  insertResolved: "club",
  repUp: "club",
  repDown: "club",
};

/** The crest refs an item shows (OrgMark refs — "user" for the player's org), at most two. */
export function newsCrestsOf(item: NewsItem, save: CareerSave, beatOrgRefs?: readonly string[]): string[] {
  if (beatOrgRefs && beatOrgRefs.length > 0) return beatOrgRefs.slice(0, 2);
  if (USER_KEYS.has(item.titleKey) || MINE_TYPES.has(item.type)) return ["user"];
  const byName = (name: unknown): string | null => {
    if (typeof name !== "string" || !name) return null;
    if (name === save.identity.orgName) return "user";
    return Object.values(save.world.orgs).find((o) => o.name === name)?.ref ?? null;
  };
  const p = item.params ?? {};
  const refs = [byName(p.to) ?? byName(p.org), byName(p.from)].filter((r): r is string => Boolean(r));
  return [...new Set(refs)].slice(0, 2);
}

/** The region an item is about, when it names one (an org's arrival, a rookie class). */
export function newsRegionOf(item: NewsItem): Region | null {
  const r = item.params?.region;
  return typeof r === "string" && ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"].includes(r) ? (r as Region) : null;
}

/** The screen an item's consequence is handled on, if any. */
export function newsActionOf(item: NewsItem): { action: NewsAction; href: string } | null {
  const byType: Partial<Record<NewsItem["type"], NewsAction>> = { transfer: "market", rep: "club", training: "training" };
  const action = ACTION_BY_KEY[item.titleKey] ?? byType[item.type] ?? null;
  return action ? { action, href: ACTION_HREF[action] } : null;
}

/**
 * The feed's lead story: the most important headline of the last
 * `maxAgeDays` days (the newest on a tie), at `minPriority` or above.
 */
export function leadStoryOf(save: CareerSave, minPriority: number, maxAgeDays: number): NewsItem | null {
  let lead: NewsItem | null = null;
  for (const n of save.news) {
    if (n.seasonIndex !== save.clock.seasonIndex) break;
    const age = typeof n.day === "number" ? save.clock.day - n.day : Infinity;
    if (age > maxAgeDays) break;
    if (n.priority >= minPriority && (!lead || n.priority > lead.priority)) lead = n;
  }
  return lead;
}
