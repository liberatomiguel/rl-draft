"use client";

/**
 * Road to Worlds — the ONE news/mail text resolver (v0.2).
 *
 * Titles come from career.news.tpl, bodies from career.news.body (same key,
 * same params); scripted beats resolve from the beats data by language.
 * Mail resolves from career.mail.tpl/.body + sender labels. Both the HQ feed
 * and the Inbox import from HERE — no more duplicated resolvers.
 */

import { CAREER_BEATS } from "@/data/career/beats";
import { sponsorBrandById } from "@/data/career/sponsors";
import type { CareerCopy } from "@/content/careerCopy";
import { getCopy } from "@/content/copy";
import { formatMoney } from "@/lib/format";
import type { MailItem, NewsItem } from "@/engine/career/types";

/**
 * v2.0 (R40): a qualifier's "resultUser" reads Qualified / Eliminated (its
 * own templates), never a bracket placement. Legacy items (no `tier`) keep
 * the generic template.
 */
function templateKeyOf(titleKey: string, raw: Record<string, string | number>): string {
  if (titleKey === "resultUser" && raw.tier === "qualifier") {
    return raw.placement === "swiss_exit" ? "resultUserEliminated" : "resultUserQualified";
  }
  return titleKey;
}

/**
 * Param keys that carry raw dollar amounts (formatted before interpolation).
 * rc.32: the economy mails' amounts too (the runway's net and burn, the
 * Backer's floor / rescue / debt, the founding partner's base). rc.33
 * review: the rescue partner's weekly help (the rescue mail printed
 * "1540 a week"). A template tests an amount with `positive()`, never
 * `Number()` (NaN once formatted).
 */
const MONEY_PARAM_KEYS = new Set([
  "fee",
  "bonus",
  "f1",
  "f2",
  "f3",
  "net",
  "burn",
  "floor",
  "rescueTo",
  "owed",
  "base",
  "garnished",
  "balance",
  "partnerWeekly",
  // rc.34: the emergency loan's mails — what the bank lent, what it took on the deadline.
  "lent",
  "collected",
  // rc.34 review: the deadline's projection — the books on that Monday and the shortfall.
  "projected",
  "gap",
  // rc.34 (ECO-04): the deals' mails — a fine, its instalment, a milestone payment.
  "fine",
  "perMonday",
  "milestone",
]);

/** rc.34 (ECO-04): the sponsor mails and news whose `name` is a brand id (shown as the brand's name). */
const SPONSOR_NAME_KEYS = new Set([
  "objectiveHit",
  "objectiveMissed",
  "sponsorSigned",
  "sponsorGoalHit",
  "sponsorGoalMissed",
  "sponsorGoalSet",
  "sponsorEnded",
]);

type TplMap = Record<string, (q: Record<string, string | number>) => string>;

export interface ResolvedNews {
  title: string;
  body?: string;
  wire?: boolean;
  /** rc.36 (UX-03): a beat filed "From the archive" — real history, not this save's. */
  archive?: boolean;
  /** rc.36: a beat's orgs (the feed's crests). */
  orgRefs?: readonly string[];
}

/** Params with unlock keys swapped for their Club display labels. */
function displayParams(
  career: CareerCopy,
  titleKey: string,
  raw: Record<string, string | number>,
): Record<string, string | number> {
  let p = raw;
  for (const key of Object.keys(p)) {
    if (MONEY_PARAM_KEYS.has(key) && typeof p[key] === "number") {
      if (p === raw) p = { ...raw };
      p[key] = formatMoney(p[key] as number);
    }
  }
  if (titleKey === "insertResolved" && typeof p.insert === "string") {
    p = { ...p, insert: insertTitle(career, p.insert) };
  }
  if (titleKey === "unlock" || titleKey === "gearBought") {
    const label =
      (career.club.unlockables as Record<string, string>)[String(p.name ?? "")] ??
      (career.finances.gear as Record<string, string>)[String(p.name ?? "")] ??
      String(p.name ?? "");
    return { ...p, name: label };
  }
  if (SPONSOR_NAME_KEYS.has(titleKey)) {
    const brand = sponsorBrandById.get(String(p.name ?? ""))?.name ?? String(p.name ?? "");
    return { ...p, name: brand };
  }
  if (titleKey === "resultUser" && p.placement) {
    const label =
      (career.common.placement as Record<string, string>)[String(p.placement)] ??
      String(p.placement);
    return { ...p, placement: label };
  }
  return p;
}

export function resolveNews(
  item: NewsItem,
  career: CareerCopy,
  lang: "en" | "pt",
): ResolvedNews {
  if (item.beatId) {
    const beat = CAREER_BEATS.find((b) => b.id === item.beatId);
    if (beat) {
      const text = lang === "pt" ? beat.pt : beat.en;
      const preempted = lang === "pt" ? beat.preemptedPt : beat.preemptedEn;
      return {
        title: text.title,
        body: item.titleKey === "beatPreempted" ? (preempted ?? text.body) : text.body,
        wire: true,
        ...(item.titleKey === "beatArchive" ? { archive: true } : {}),
        ...(beat.orgRefs ? { orgRefs: beat.orgRefs } : {}),
      };
    }
  }

  const raw = item.params ?? {};
  const p = displayParams(career, item.titleKey, raw);
  const key = templateKeyOf(item.titleKey, raw);

  // A few titleKeys have no news.tpl entry — route them to their home groups.
  if (item.titleKey === "digest") return { title: career.news.digest(Number(p.n ?? 0)) };
  if (item.titleKey === "incomingBid") {
    return {
      title: `${career.market.bidFrom(String(p.org ?? ""))} · ${String(p.player ?? "")}`,
      body: (career.news.body as unknown as TplMap).incomingBid?.(p),
    };
  }
  if (item.titleKey === "objectiveHit" || item.titleKey === "objectiveMissed") {
    const outcome =
      item.titleKey === "objectiveHit"
        ? career.finances.objectiveHit
        : career.finances.objectiveMissed;
    return { title: `${String(p.name ?? "")}: ${outcome}` };
  }

  const titles = career.news.tpl as unknown as TplMap;
  const bodies = career.news.body as unknown as TplMap;
  const tpl = titles[key];
  const title = tpl ? tpl(p) : item.titleKey;
  const bodyTpl = bodies[key];
  return { title, body: bodyTpl ? bodyTpl(p) : undefined };
}

/**
 * v0.3 toast titles — one-line resolution for the popup layer (mail tpl first,
 * then news tpl, with the same param display fixes as the feeds).
 */
/** v2.0 (R33): insert ids in news params read as their titles. */
function insertTitle(career: CareerCopy, id: string): string {
  return career.inserts.items[id]?.title ?? id;
}

export function resolveToastTitle(
  toast: { source: "mail" | "news" | "achievement"; titleKey: string; params?: Record<string, string | number> },
  career: CareerCopy,
): string {
  // v2.0 (R32): achievement toasts carry the achievement id.
  if (toast.source === "achievement") {
    // rc.36 (UX-05, #155): one source for the words — the core copy the general list reads.
    return getCopy().ACH_UI.careerItems[toast.titleKey]?.name ?? toast.titleKey;
  }
  const p = displayParams(career, toast.titleKey, toast.params ?? {});
  const mailTitles = career.mail.tpl as unknown as TplMap;
  const newsTitles = career.news.tpl as unknown as TplMap;
  const newsKey = templateKeyOf(toast.titleKey, toast.params ?? {});
  if (toast.source === "mail" && mailTitles[toast.titleKey]) return mailTitles[toast.titleKey](p);
  if (newsTitles[newsKey]) return newsTitles[newsKey](p);
  if (mailTitles[toast.titleKey]) return mailTitles[toast.titleKey](p);
  return toast.titleKey;
}

export interface ResolvedMail {
  title: string;
  body: string;
  from: string;
  kindLabel: string;
}

export function resolveMail(item: MailItem, career: CareerCopy): ResolvedMail {
  const raw = item.params ?? {};
  const p = displayParams(career, item.titleKey, raw);
  const titles = career.mail.tpl as unknown as TplMap;
  const bodies = career.mail.body as unknown as TplMap;
  const title = titles[item.titleKey] ? titles[item.titleKey](p) : item.titleKey;
  const bodyKey = item.bodyKey ?? item.titleKey;
  const body = bodies[bodyKey] ? bodies[bodyKey](p) : "";
  const from =
    (career.mail.from as Record<string, string>)[item.fromKey] ?? career.mail.from.board;
  const kindLabel =
    (career.mail.kinds as Record<string, string>)[item.kind] ?? item.kind;
  return { title, body, from, kindLabel };
}
