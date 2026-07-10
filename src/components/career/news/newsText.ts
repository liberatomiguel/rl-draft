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
import type { Copy } from "@/content/copy";
import type { MailItem, NewsItem } from "@/engine/career/types";

type CareerCopy = Copy["CAREER"];
type TplMap = Record<string, (q: Record<string, string | number>) => string>;

export interface ResolvedNews {
  title: string;
  body?: string;
  wire?: boolean;
}

/** Params with unlock keys swapped for their Club display labels. */
function displayParams(
  career: CareerCopy,
  titleKey: string,
  p: Record<string, string | number>,
): Record<string, string | number> {
  if (titleKey === "unlock" || titleKey === "gearBought") {
    const label =
      (career.club.unlockables as Record<string, string>)[String(p.name ?? "")] ??
      (career.finances.gear as Record<string, string>)[String(p.name ?? "")] ??
      String(p.name ?? "");
    return { ...p, name: label };
  }
  if (titleKey === "objectiveHit" || titleKey === "objectiveMissed" || titleKey === "sponsorSigned") {
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
      };
    }
  }

  const raw = item.params ?? {};
  const p = displayParams(career, item.titleKey, raw);

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
  const tpl = titles[item.titleKey];
  const title = tpl ? tpl(p) : item.titleKey;
  const bodyTpl = bodies[item.titleKey];
  return { title, body: bodyTpl ? bodyTpl(p) : undefined };
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
