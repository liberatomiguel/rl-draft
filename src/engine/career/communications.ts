import { CAREER_SAVE } from "@/config/balance";
import { weekOfDay } from "./calendar";
import type { CareerSave, MailItem, NewsItem } from "./types";

type NewsDraft = Omit<NewsItem, "id" | "seasonIndex" | "week" | "day" | "read">;
type MailDraft = Omit<MailItem, "id" | "seasonIndex" | "day" | "read">;

/** Public reporting belongs on the wire; private operations go to the manager. */
const PUBLIC_KEYS = new Set([
  "beat", "beatArchive", "beatPreempted", "transfer", "transferFee", "transferFa",
  "userSigned", "userSold", "userReleased", "result", "resultUser", "seasonChampion",
  "windowOpen", "windowClose", "windowReport", "retired", "rookieClass", "breakout", "orgEnters", "orgLeaves",
  "worldsCancelled",
]);

/**
 * v2.0 (C1): the bombshells — news the UI opens as a pop-up (`headline: true`).
 * The scripted beats that changed the scene, the keys that are always one,
 * and the unlocks nobody buys (the `unlock` item's `params.name`).
 */
export const HEADLINE_BEATS: ReadonlySet<string> = new Set([
  "sx-bds-rise", "s1-kc-enters", "s1-lan-back", "s2-furia-north", "s2-falcons-project",
  "s3-vitality-zen", "s3-vatira-kc", "s5-final-season",
]);
export const HEADLINE_KEYS: ReadonlySet<string> = new Set(["worldsCancelled", "sponsorBootcamp"]);
export const HEADLINE_UNLOCKS: ReadonlySet<string> = new Set([
  "coach", "exProCoach", "sponsors1", "sponsors2", "sponsors3", "sponsors4", "t2", "relocation",
]);

/** Is this item a bombshell? A live beat of the list, a headline key, or a non-purchasable unlock. */
export function isHeadline(item: { titleKey: string; params?: Record<string, string | number>; beatId?: string }): boolean {
  if (item.titleKey === "beat" && item.beatId !== undefined) return HEADLINE_BEATS.has(item.beatId);
  if (item.titleKey === "unlock") return HEADLINE_UNLOCKS.has(String(item.params?.name ?? ""));
  return HEADLINE_KEYS.has(item.titleKey);
}
const QUIET_KEYS = new Set([
  "flavor1", "flavor2", "flavor3", "flavor4", "flavor5", "registryRepair", "digest",
  "trainingReport", "trainingPeriod", "scrimWeek", "scrimWin", "scrimLoss",
  "repUp", "repDown", "starUp", "gearBought", "insertResolved", "bootcampRun",
]);

export function newsChannelOf(item: Pick<NewsItem, "titleKey" | "params">): "news" | "mail" | "quiet" {
  if (item.titleKey === "resultUser" && item.params?.tier === "qualifier") return "mail";
  if (QUIET_KEYS.has(item.titleKey)) return "quiet";
  return PUBLIC_KEYS.has(item.titleKey) ? "news" : "mail";
}

function sameMessage(a: MailItem, b: Pick<MailDraft, "titleKey" | "params">, seasonIndex: number, day: number): boolean {
  if (a.titleKey !== b.titleKey || a.seasonIndex !== seasonIndex || a.day !== day) return false;
  const identity = (p?: Record<string, string | number>) => String(p?.player ?? p?.event ?? p?.name ?? "");
  return identity(a.params) === identity(b.params);
}

export function deliverMail(save: CareerSave, draft: MailDraft): void {
  const item: MailDraft = !draft.headline && isHeadline(draft) ? { ...draft, headline: true } : draft;
  if (PUBLIC_KEYS.has(item.titleKey) && !(item.titleKey === "resultUser" && item.params?.tier === "qualifier")) return;
  // The league's Sunday notice already contains the qualifier outcome.
  if (item.titleKey === "qualifiedRegional" || item.titleKey === "missedRegional") {
    save.mail = save.mail.filter(m => !(m.titleKey === "resultUser" && m.params?.tier === "qualifier" && m.seasonIndex === save.clock.seasonIndex && m.day === save.clock.day));
  }
  const existing = save.mail.find(m => sameMessage(m, item, save.clock.seasonIndex, save.clock.day));
  if (existing) {
    Object.assign(existing, item);
    return;
  }
  save.seq += 1;
  save.mail.unshift({ ...item, id: `m:${save.seq}`, seasonIndex: save.clock.seasonIndex, day: save.clock.day, read: false });
  if (save.mail.length > CAREER_SAVE.mailCap) save.mail.length = CAREER_SAVE.mailCap;
}

export function deliverNews(save: CareerSave, item: NewsDraft): void {
  const channel = newsChannelOf(item);
  if (channel === "quiet") return;
  if (channel === "mail") {
    const competition = /qualified|missed|resultUser|regionalSkipped|eventMissedNoReserve/.test(item.titleKey);
    deliverMail(save, { kind: "club", titleKey: item.titleKey, bodyKey: item.titleKey, params: item.params, fromKey: competition ? "league" : "staff", linkTo: competition ? "/career/calendar" : "/career" });
    return;
  }
  save.seq += 1;
  save.news.unshift({ ...item, ...(item.headline || isHeadline(item) ? { headline: true as const } : {}), id: `n:${save.seq}`, seasonIndex: save.clock.seasonIndex, week: weekOfDay(save.clock.day), day: save.clock.day, read: false });
  if (save.news.length > CAREER_SAVE.newsCap) save.news.length = CAREER_SAVE.newsCap;
}

/** Additive repair: retain dates/read state while reclassifying an older inbox/feed. */
export function repairCommunicationsOnLoad(save: CareerSave): void {
  const news: NewsItem[] = [];
  const mail = save.mail.filter(m => !PUBLIC_KEYS.has(m.titleKey) || (m.titleKey === "resultUser" && m.params?.tier === "qualifier"));
  for (const item of save.news) {
    const day = item.day ?? (item.week - 1) * 7 + 1;
    const channel = newsChannelOf(item);
    if (channel === "news") news.push(item);
    else if (channel === "mail" && !mail.some(m => sameMessage(m, item, item.seasonIndex, day))) {
      save.seq += 1;
      mail.push({ id: `m:${save.seq}`, seasonIndex: item.seasonIndex, day, read: item.read, kind: "club", titleKey: item.titleKey, bodyKey: item.titleKey, params: item.params, fromKey: "staff", linkTo: "/career" });
    }
  }
  save.news = news;
  save.mail = mail.filter(m => !(m.titleKey === "resultUser" && m.params?.tier === "qualifier" && mail.some(other =>
    (other.titleKey === "qualifiedRegional" || other.titleKey === "missedRegional") && other.seasonIndex === m.seasonIndex && other.day === m.day,
  ))).sort((a, b) => b.seasonIndex - a.seasonIndex || b.day - a.day).slice(0, CAREER_SAVE.mailCap);
}
