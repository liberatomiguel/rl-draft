"use client";

/**
 * rc.36 (ROADMAP UX-03, R87): HQ's news feed, visual — a lead story (the
 * freshest headline that matters), then rows: the crests of the orgs it is
 * about, a short subject, the headline, one line of body, and the action it
 * leads to. Historical beats that this save did not live read "From the
 * archive". The desk is presented by `CAREER_NEWS.brand` — the game's own
 * wire, or the 50/50 presentation once the partner agrees (its logo slot
 * renders a styled fallback until the art is dropped in). The headlines are
 * always the game's own.
 *
 * Moved out of HubScreen (the filters, the infinite scroll and the type
 * icons came with it).
 */

import { useEffect, useRef, useState } from "react";
import { CAREER_NEWS } from "@/config/balance";
import { newsChannelOf } from "@/engine/career/communications";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave, NewsItem, NewsType } from "@/engine/career/types";
import { partnerLogoSrc } from "@/lib/assets";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { OrgMark } from "@/components/career/OrgMark";
import { dateOfDay, seasonLabelFor } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { withMoneyParams } from "@/components/career/hub/hubShared";
import { resolveNews } from "@/components/career/news/newsText";
import { rocketStreetNews, leadStoryOf, newsActionOf, newsCrestsOf, newsRegionOf } from "@/components/career/news/newsView";

type DatesCopy = CareerCopy["dates"];

const WIRE_BATCH = 30;
const WIRE_PREVIEW = 5;

type FilterKey = "all" | "mine" | "region" | "world" | "deals";
const FILTERS: FilterKey[] = ["all", "mine", "region", "world", "deals"];

/** "My org" = notices about the user org itself (contracts, training, rep). */
const MINE_TYPES: NewsType[] = ["org", "training", "rep"];

function matchesFilter(item: NewsItem, filter: FilterKey, save: CareerSave): boolean {
  switch (filter) {
    case "all":
      return true;
    case "mine":
      return newsCrestsOf(item, save).includes("user");
    case "deals":
      return item.type === "transfer";
    case "region":
      // Region relevance rides on the params (event names carry the region
      // code, e.g. "EU Regional 2"; rookie classes carry params.region).
      return Object.values(item.params ?? {}).some((v) => String(v).includes(save.identity.region));
    case "world":
      return !MINE_TYPES.includes(item.type) && item.type !== "transfer";
  }
}

// ---------------------------------------------------------------------------
// Type icons — hand-drawn 24×24 currentColor (house icon style)
// ---------------------------------------------------------------------------

const ICON_TONE: Record<NewsType, string> = {
  result: "text-orange-bright",
  transfer: "text-blue-bright",
  beat: "text-amber-300",
  org: "text-cyan",
  training: "text-good",
  milestone: "text-orange-bright",
  window: "text-blue-bright",
  rep: "text-cyan",
  flavor: "text-faint",
};


export function NewsTypeIcon({ type, className }: { type: NewsType | "archive"; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (type) {
    case "archive":
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
          <path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10M10 12.5h4" />
        </svg>
      );
    case "result":
      return (
        <svg {...common}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 5H5.5a2.5 2.5 0 0 0 2.8 3.3M16 5h2.5a2.5 2.5 0 0 1-2.8 3.3" />
          <path d="M12 12v4M9 19h6" />
        </svg>
      );
    case "transfer":
      return (
        <svg {...common}>
          <path d="M4 9h13l-3-3M20 15H7l3 3" />
        </svg>
      );
    case "beat":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <path d="M8.8 15.2a4.6 4.6 0 0 1 0-6.4M15.2 8.8a4.6 4.6 0 0 1 0 6.4" />
          <path d="M6.2 17.8a8.2 8.2 0 0 1 0-11.6M17.8 6.2a8.2 8.2 0 0 1 0 11.6" />
        </svg>
      );
    case "org":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
        </svg>
      );
    case "training":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "milestone":
      return (
        <svg {...common}>
          <path d="M6 21V4" />
          <path d="M6 5h11l-2.5 3.5L17 12H6" />
        </svg>
      );
    case "window":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 9.5h16M8 3v4M16 3v4" />
        </svg>
      );
    case "rep":
      return (
        <svg {...common}>
          <path d="m12 3 2.5 5.4 5.5.7-4 4 1 5.9-5-2.9-5 2.9 1-5.9-4-4 5.5-.7L12 3Z" />
        </svg>
      );
    case "flavor":
      return (
        <svg {...common}>
          <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// The desk's brand (the wire, or the 50/50 presentation)
// ---------------------------------------------------------------------------

/** The partner art's id under public/partners/ (assets.partnerLogoSrc). */
const PARTNER_ART: Record<string, string> = { fiftyFifty: "fiftyfifty", duds: "duds", rocketStreet: "rocketstreet" };

export function BrandMark({ brand, name, small = false }: { brand: string; name: string; small?: boolean }) {
  const art = PARTNER_ART[brand];
  const src = art ? partnerLogoSrc(art) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a static-export asset URL from assets.ts (WebP in production)
      <img src={src} alt={name} className={cx("w-auto object-contain", small ? "h-4 max-w-8" : "h-7 max-w-24")} onError={() => setFailedSrc(src)} />
    );
  }
  // The styled fallback: the game's own broadcast glyph and the desk's name in plain text — never a redrawn logo.
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cx(
          "flex h-7 w-7 items-center justify-center rounded-md",
          art ? "border border-line-strong bg-white/5 text-sub" : "bg-orange/15 text-orange-bright",
        )}
      >
        <NewsTypeIcon type="beat" className="h-4 w-4" />
      </span>
      <span className="display text-xs font-bold uppercase tracking-[0.16em] text-ink">{name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pieces of a story
// ---------------------------------------------------------------------------

function Crests({ item, refs, save, size, type, archive }: { item: NewsItem; refs: string[]; save: CareerSave; size: "sm" | "md"; type: NewsType; archive: boolean }) {
  if (rocketStreetNews(item)) return <BrandMark brand="rocketStreet" name="Rocket Street" small={size === "sm"} />;
  if (refs.length === 0 && CAREER_NEWS.brand === "fiftyFifty") return <BrandMark brand="fiftyFifty" name="50/50" small={size === "sm"} />;
  if (refs.length === 0) {
    return (
      <span
        className={cx(
          "flex shrink-0 items-center justify-center rounded-lg bg-white/[0.04]",
          size === "md" ? "h-10 w-10" : "h-6 w-6",
          archive ? "text-amber-300/80" : ICON_TONE[type],
        )}
      >
        <NewsTypeIcon type={archive ? "archive" : type} className={size === "md" ? "h-6 w-6" : "h-4.5 w-4.5"} />
      </span>
    );
  }
  return (
    <span className={cx("flex shrink-0 items-center", refs.length > 1 && "-space-x-2")}>
      {refs.map((ref) => (
        <OrgMark key={ref} save={save} orgRef={ref} size={size === "md" ? "md" : "sm"} />
      ))}
    </span>
  );
}

function SubjectChips({
  item,
  C,
  archive,
  brandKicker,
  wire,
}: {
  item: NewsItem;
  C: CareerCopy;
  archive: boolean;
  brandKicker: string;
  wire: boolean;
}) {
  const region = newsRegionOf(item);
  return <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-faint">
    <span>{archive ? C.news.feed.archive + " · " + seasonLabelFor(item.seasonIndex) : wire ? brandKicker : C.news.feed.subject[item.type]}</span>
    {region ? <span>· {region}</span> : null}
  </span>;
}

function ActionLink({ item, C, lead }: { item: NewsItem; C: CareerCopy; lead?: boolean }) {
  const a = newsActionOf(item);
  if (!a) return null;
  // The headline's action is a button; a row's is a quiet link that leaves the HQ.
  if (lead) {
    return <AppLink href={a.href} className={buttonClass("secondary", "sm")}>{C.news.feed.action[a.action]}</AppLink>;
  }
  return (
    <AppLink
      href={a.href}
      className="inline-flex min-h-7 items-center text-xs font-semibold text-blue-bright underline-offset-4 hover:underline"
    >
      {C.news.feed.action[a.action]}
    </AppLink>
  );
}

function stampOf(item: NewsItem, save: CareerSave, C: CareerCopy, D: DatesCopy): string {
  const stamp = typeof item.day === "number" ? formatDateTiny(D, dateOfDay(item.seasonIndex, item.day)) : C.hub.week(item.week);
  return item.seasonIndex === save.clock.seasonIndex ? stamp : `${seasonLabelFor(item.seasonIndex)} · ${stamp}`;
}

function LeadStory({ item, save, C, lang, brandKicker }: { item: NewsItem; save: CareerSave; C: CareerCopy; lang: "en" | "pt"; brandKicker: string }) {
  const r = resolveNews(withMoneyParams(item), C, lang);
  const archive = Boolean(r.archive);
  const refs = newsCrestsOf(item, save, r.orgRefs);
  return (
    // The headline is a band across the feed, edge to edge: the front page of the desk.
    // The crests of the orgs it is about stand large on the right, like a lower-third.
    // The open story is marked in the desk's blue: a tinted band between two blue rules.
    <article className="border-y border-blue-bright/55 bg-blue/[0.09] px-4 py-5 first:border-t-0 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="display flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.05em] text-blue-bright">
          {C.news.feed.lead}
          <span className="font-sans text-[11px] font-normal normal-case tracking-normal text-faint">{stampOf(item, save, C, C.dates)}</span>
        </p>
        <SubjectChips item={item} C={C} archive={archive} brandKicker={rocketStreetNews(item) ? C.launch.rocketStreet : brandKicker} wire={Boolean(r.wire) || rocketStreetNews(item)} />
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <h3 className="display text-2xl font-bold uppercase leading-[1.05] text-ink sm:text-[2rem]">{r.title}</h3>
          {r.body ? <p className="mt-3 max-w-prose text-sm leading-relaxed text-sub">{r.body}</p> : null}
          {archive ? <p className="mt-2 text-xs text-faint">{C.news.feed.archiveNote}</p> : null}
        </div>
        {/* The mark has its own cell: a fixed square on the right, the art centred in it. */}
        <div className="hidden h-24 w-32 shrink-0 items-center justify-center sm:flex [&_img]:!h-16 [&_img]:!w-auto [&_img]:!max-w-28 [&_svg]:!h-16 [&_svg]:!w-16">
          <Crests item={item} refs={refs.slice(0, 2)} save={save} size="md" type={item.type} archive={archive} />
        </div>
      </div>
      <div className="mt-4"><ActionLink item={item} C={C} lead /></div>
    </article>
  );
}

function StoryRow({ item, save, C, lang, brandKicker, compact, onSelect }: { item: NewsItem; save: CareerSave; C: CareerCopy; lang: "en" | "pt"; brandKicker: string; compact: boolean; onSelect: () => void }) {
  const r = resolveNews(withMoneyParams(item), C, lang);
  const archive = Boolean(r.archive);
  const refs = newsCrestsOf(item, save, r.orgRefs);
  return (
    // Every story is a ruled row; its mark sits in a fixed column so the marks and the text line up down the feed.
    <article className="flex items-center gap-4 border-b border-line-strong px-4 py-4 last:border-0 sm:px-6">
      <span className="flex h-10 w-12 shrink-0 items-center justify-center [&_img]:!max-w-12">
        <Crests item={item} refs={refs.slice(0, 1)} save={save} size="sm" type={item.type} archive={archive} />
      </span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onSelect} className="block w-full cursor-pointer rounded text-left hover:text-blue-bright focus-visible:outline-2 focus-visible:outline-blue">
        {!compact || archive ? <SubjectChips item={item} C={C} archive={archive} brandKicker={rocketStreetNews(item) ? C.launch.rocketStreet : brandKicker} wire={Boolean(r.wire) || rocketStreetNews(item)} /> : null}
        <p className={cx("text-sm leading-snug", item.read ? "text-sub" : "font-semibold text-ink")}>{r.title}</p>
        {!compact && r.body ? <p className="mt-0.5 text-xs leading-relaxed text-sub">{r.body}</p> : null}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-faint">{stampOf(item, save, C, C.dates)}</span><ActionLink item={item} C={C} /></div>
      </div>
      {!item.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-bright" aria-label={C.news.unread(1)} /> : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// The feed
// ---------------------------------------------------------------------------

/** `full`: the whole feed with its filters (the desk's News view); otherwise the HQ's preview, which links there. */
export function NewsFeed({ save, C, lang, full = false }: { save: CareerSave; C: CareerCopy; lang: "en" | "pt"; full?: boolean }) {
  const markNewsRead = useCareerStore((s) => s.markNewsRead);
  const open = full;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(WIRE_BATCH);
  // Render-phase reset so a filter switch never carries a stale page count.
  const [prevFilter, setPrevFilter] = useState<FilterKey>(filter);
  if (filter !== prevFilter) {
    setPrevFilter(filter);
    setLimit(WIRE_BATCH);
  }
  const news = save.news.filter(n => newsChannelOf(n) === "news");
  const filtered = open ? news.filter((n) => matchesFilter(n, filter, save)) : news;
  const hasMore = open && limit < filtered.length;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit((l) => l + WIRE_BATCH);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [open, filter, hasMore]);

  const brand = CAREER_NEWS.brand;
  const B = C.news.brand[brand] ?? C.news.brand.wire;
  const unread = news.filter((n) => !n.read).length;
  const lead = leadStoryOf({ ...save, news: filtered }, CAREER_NEWS.leadMinPriority, CAREER_NEWS.leadMaxAgeDays) ?? filtered[0] ?? null;
  const expandedId = filtered.some(n => n.id === selectedId) ? selectedId : lead?.id;
  const rows = open
    ? filtered.filter(n => n.id !== lead?.id).slice(0, limit)
    : news.filter((n) => n.id !== lead?.id).slice(0, lead ? WIRE_PREVIEW - 1 : WIRE_PREVIEW);

  return (
    <Panel id="career-news" className="rise-in scroll-mt-36 overflow-hidden" style={{ animationDelay: "120ms" }}>
      {/* Masthead: the desk's mark and name, ruled off from the stories. */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          {/* The partner's mark, with its credit line right under it. */}
          <span className="flex shrink-0 flex-col items-start gap-1">
            <BrandMark brand={brand} name={B.name} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="card-title">{C.news.feed.name}</span>
              {unread > 0 ? (
                <span className="rounded-sm bg-orange/20 px-1.5 py-px tabular-nums text-[11px] text-orange-bright">{unread}</span>
              ) : null}
            </span>
            {B.credit ? <span className="mt-1.5 block text-xs text-sub">{B.credit}</span> : null}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && unread > 0 ? (
            <Button size="sm" variant="ghost" onClick={markNewsRead}>
              {C.news.markAllRead}
            </Button>
          ) : null}
          {/* Phone: the masthead is the desk's name alone (it wrapped to three
              lines beside this button); the way to the full feed closes the board. */}
          {full ? null : (
            <AppLink href="/career/news#news" className={cx(buttonClass("secondary", "sm"), "max-sm:hidden")}>
              {C.hub.newsAll}
            </AppLink>
          )}
        </div>
      </div>
      {open ? (
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-6">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cx(
                "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                filter === key ? "border-blue/50 bg-blue/15 text-blue-bright" : "border-line-strong bg-white/5 text-sub hover:text-ink",
              )}
            >
              {C.news.filter[key]}
            </button>
          ))}
        </div>
      ) : null}

      {lead ? expandedId === lead.id ? <LeadStory item={lead} save={save} C={C} lang={lang} brandKicker={B.kicker} /> : <StoryRow item={lead} save={save} C={C} lang={lang} brandKicker={B.kicker} compact={!open} onSelect={() => setSelectedId(lead.id)} /> : null}

      {rows.length === 0 && !lead ? (
        <p className="px-4 py-8 text-center text-sm text-sub">{C.hub.emptyStateBody}</p>
      ) : (
        <div className="wire-rows">
          {rows.map((item) => (
            <div key={item.id}>{expandedId === item.id ? <LeadStory item={item} save={save} C={C} lang={lang} brandKicker={B.kicker} /> : <StoryRow item={item} save={save} C={C} lang={lang} brandKicker={B.kicker} compact={!open} onSelect={() => setSelectedId(item.id)} />}</div>
          ))}
        </div>
      )}

      {hasMore ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
      {full ? null : (
        <AppLink href="/career/news#news" className="display flex min-h-12 items-center justify-center gap-1.5 border-t border-line text-xs font-bold uppercase tracking-[0.08em] text-blue-bright sm:hidden">
          {C.hub.newsAll}
          <span aria-hidden>→</span>
        </AppLink>
      )}

    </Panel>
  );
}
