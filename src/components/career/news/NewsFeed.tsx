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
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave, NewsItem, NewsType } from "@/engine/career/types";
import { partnerLogoSrc } from "@/lib/assets";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { OrgMark } from "@/components/career/OrgMark";
import { dateOfDay, seasonLabelFor } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { withMoneyParams } from "@/components/career/hub/hubShared";
import { resolveNews } from "@/components/career/news/newsText";
import { leadStoryOf, newsActionOf, newsCrestsOf, newsRegionOf } from "@/components/career/news/newsView";

type DatesCopy = CareerCopy["dates"];

const WIRE_BATCH = 30;
const WIRE_PREVIEW = 5;

type FilterKey = "all" | "mine" | "region" | "world" | "deals";
const FILTERS: FilterKey[] = ["all", "mine", "region", "world", "deals"];

/** "My org" = notices about the user org itself (contracts, training, rep). */
const MINE_TYPES: NewsType[] = ["org", "training", "rep"];

function matchesFilter(item: NewsItem, filter: FilterKey, region: string): boolean {
  switch (filter) {
    case "all":
      return true;
    case "mine":
      return MINE_TYPES.includes(item.type);
    case "deals":
      return item.type === "transfer";
    case "region":
      // Region relevance rides on the params (event names carry the region
      // code, e.g. "EU Regional 2"; rookie classes carry params.region).
      return Object.values(item.params ?? {}).some((v) => String(v).includes(region));
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
const PARTNER_ART: Record<string, string> = { fiftyFifty: "fiftyfifty" };

function BrandMark({ brand, name }: { brand: string; name: string }) {
  const art = PARTNER_ART[brand];
  const src = art ? partnerLogoSrc(art) : null;
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a static-export asset URL from assets.ts (WebP in production)
      <img src={src} alt={name} className="h-7 w-auto max-w-24 object-contain" onError={() => setFailed(true)} />
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

function Crests({ refs, save, size, type, archive }: { refs: string[]; save: CareerSave; size: "sm" | "md"; type: NewsType; archive: boolean }) {
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
  return <span className="flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-faint">
    <span>{archive ? C.news.feed.archive + " · " + seasonLabelFor(item.seasonIndex) : wire ? brandKicker : C.news.feed.subject[item.type]}</span>
    {region ? <span>· {region}</span> : null}
  </span>;
}

function ActionLink({ item, C }: { item: NewsItem; C: CareerCopy }) {
  const a = newsActionOf(item);
  if (!a) return null;
  return (
    <AppLink
      href={a.href}
      className="inline-flex min-h-7 items-center gap-1 text-[10px] font-semibold text-blue-bright hover:text-blue-bright/80"
    >
      {C.news.feed.action[a.action]}
      <span aria-hidden>→</span>
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
    <article className="relative mb-2 overflow-hidden rounded-xl border border-blue/25 bg-blue/[0.045] p-4 sm:p-5">
      <div aria-hidden className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-blue" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="kicker !text-[9px] text-blue-bright">{C.news.feed.lead}</p>
        <span className="text-[10px] text-faint">{stampOf(item, save, C, C.dates)}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <SubjectChips item={item} C={C} archive={archive} brandKicker={brandKicker} wire={Boolean(r.wire)} />
          <h3 className="mt-2 text-lg font-semibold leading-snug text-ink sm:text-xl">{r.title}</h3>
        </div>
        <Crests refs={refs.slice(0, 1)} save={save} size="md" type={item.type} archive={archive} />
      </div>
      {r.body ? <p className="mt-2 line-clamp-3 max-w-prose text-xs leading-relaxed text-sub">{r.body}</p> : null}
      {archive ? <p className="mt-2 text-[10px] italic text-faint">{C.news.feed.archiveNote}</p> : null}
      <div className="mt-3"><ActionLink item={item} C={C} /></div>
    </article>
  );
}

function StoryRow({ item, save, C, lang, brandKicker, compact }: { item: NewsItem; save: CareerSave; C: CareerCopy; lang: "en" | "pt"; brandKicker: string; compact: boolean }) {
  const r = resolveNews(withMoneyParams(item), C, lang);
  const archive = Boolean(r.archive);
  const refs = newsCrestsOf(item, save, r.orgRefs);
  return (
    <article className="flex items-start gap-2.5 border-b border-line/60 py-2.5 last:border-0">
      <Crests refs={item.type === "transfer" ? refs.slice(0, 1) : []} save={save} size="sm" type={item.type} archive={archive} />
      <div className="min-w-0 flex-1">
        {!compact || archive ? <SubjectChips item={item} C={C} archive={archive} brandKicker={brandKicker} wire={Boolean(r.wire)} /> : null}
        <p className={cx("text-xs leading-relaxed", item.read ? "text-sub" : "font-medium text-ink")}>{r.title}</p>
        {!compact && r.body ? <p className="mt-0.5 text-xs leading-relaxed text-sub">{r.body}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-faint">{stampOf(item, save, C, C.dates)}</span><ActionLink item={item} C={C} /></div>
      </div>
      {!item.read ? <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-bright" aria-label={C.news.unread(1)} /> : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// The feed
// ---------------------------------------------------------------------------

export function NewsFeed({ save, C, lang }: { save: CareerSave; C: CareerCopy; lang: "en" | "pt" }) {
  const markNewsRead = useCareerStore((s) => s.markNewsRead);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [limit, setLimit] = useState(WIRE_BATCH);
  // Render-phase reset so a filter switch never carries a stale page count.
  const [prevFilter, setPrevFilter] = useState<FilterKey>(filter);
  if (filter !== prevFilter) {
    setPrevFilter(filter);
    setLimit(WIRE_BATCH);
  }
  const region = save.identity.region;
  const filtered = open ? save.news.filter((n) => matchesFilter(n, filter, region)) : save.news;
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
  const unread = save.news.filter((n) => !n.read).length;
  const lead = !open ? (leadStoryOf(save, CAREER_NEWS.leadMinPriority, CAREER_NEWS.leadMaxAgeDays) ?? save.news[0] ?? null) : null;
  const rows = open
    ? filtered.slice(0, limit)
    : save.news.filter((n) => n.id !== lead?.id).slice(0, lead ? WIRE_PREVIEW - 1 : WIRE_PREVIEW);

  return (
    <Panel id="career-news" className="rise-in p-4" style={{ animationDelay: "120ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark brand={brand} name={B.name} />
          {unread > 0 ? (
            <span className="rounded-full bg-orange/20 px-1.5 py-px font-mono text-[10px] text-orange-bright">{unread}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open && unread > 0 ? (
            <Button size="sm" variant="ghost" onClick={markNewsRead}>
              {C.news.markAllRead}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-blue-bright" onClick={() => setOpen((v) => !v)}>
            {open ? C.common.close : C.hub.newsAll}
          </Button>
        </div>
      </div>
      {B.credit ? <p className="-mt-1.5 mb-3 text-[10px] text-faint">{B.credit}</p> : null}

      {open ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cx(
                "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                filter === key ? "border-blue/50 bg-blue/15 text-blue-bright" : "border-line-strong bg-white/5 text-sub hover:text-ink",
              )}
            >
              {C.news.filter[key]}
            </button>
          ))}
        </div>
      ) : null}

      {lead ? <LeadStory item={lead} save={save} C={C} lang={lang} brandKicker={B.kicker} /> : null}

      {rows.length === 0 && !lead ? (
        <p className="py-6 text-center text-sm text-sub">{C.hub.emptyStateBody}</p>
      ) : (
        <div>
          {rows.map((item) => (
            <StoryRow key={item.id} item={item} save={save} C={C} lang={lang} brandKicker={B.kicker} compact={!open} />
          ))}
        </div>
      )}

      {hasMore ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
    </Panel>
  );
}
