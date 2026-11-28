"use client";

/**
 * Road to Worlds: the club's desk. The inbox is an email client over
 * `save.mail` (transfer bids, sponsor deals, contract notices, finance alerts,
 * unlock letters): the list on the left, the open message on the right;
 * opening marks it read, and mail with a deep link carries an Open action.
 * The HQ's news feed and transfer wire open here in full (#news, #transfers).
 *
 * rc9 CLUB-NEWS: what the player decides here is which message to open, and
 * what he must see first is which ones wait for an answer. Those carry a tag
 * and a count; the rest is a quiet list. On a phone the list and the open
 * message take turns, with a way back.
 *
 * File name + /career/news route are stable; only the content changed.
 */

import { useRouter } from "next/navigation";
import { LoanSummary } from "../finances/LoanSummary";
import { useEffect, useRef, useState } from "react";
import { type CareerCopy } from "@/content/careerCopy";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import type { MailItem, MailKind } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/store/settingsStore";
import { NewsFeed } from "@/components/career/news/NewsFeed";
import { TransferWirePanel } from "@/components/career/screens/HubScreen";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { dateOfDay, seasonLabelFor, useCareerSave } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { resolveMail } from "@/components/career/news/newsText";
import { mailNeedsReply } from "@/components/career/news/newsView";
import { withMoneyParams } from "@/components/career/hub/hubShared";
import { LockerTalkAnswers } from "@/components/career/locker/LockerTalkAnswers"; // v2.3 LOCKER
import { MediaOfferAnswers } from "@/components/career/media/MediaOfferAnswers"; // v2.3 MEDIA
import { FanFeedView } from "@/components/career/feed/FanFeedView"; // v2.3 UI
import { FEATURES } from "@/config/balance"; // v2.3 UI

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Filters: All + the six mail kinds
// ---------------------------------------------------------------------------

const KINDS: MailKind[] = ["offer", "sponsor", "contract", "finance", "unlock", "club"];
type FilterKey = "all" | MailKind;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type DeskView = "inbox" | "news" | "transfers" | "fans";
const VIEWS: DeskView[] = ["inbox", "news", "transfers", ...(FEATURES.fanFeed ? (["fans"] as const) : [])]; // v2.3 UI: "fans"
const viewOfHash = (hash: string): DeskView => (VIEWS as string[]).includes(hash.replace("#", "")) ? (hash.replace("#", "") as DeskView) : "inbox";

// The desk's job: read what reached the club. One decision here: which message to open (and act on).
export function NewsScreen() {
  const C = useActiveCareerCopy();
  const mounted = useMounted();
  const save = useCareerSave();
  const lang = useSettings((s) => s.lang);
  const markMailRead = useCareerStore((s) => s.markMailRead);
  const markAllMailRead = useCareerStore((s) => s.markAllMailRead);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The HQ links here with #news / #transfers: each opens as its own view of the desk.
  const [view, setViewState] = useState<DeskView>(() => (typeof window === "undefined" ? "inbox" : viewOfHash(window.location.hash)));
  // A link to another view of this page (same path, new hash) does not remount the screen.
  useEffect(() => {
    const onHash = () => setViewState(viewOfHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // v2.3 UI: the open view stays in sight when the strip scrolls (horizontal only, on a view change).
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabsRef.current;
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (list && el && list.scrollWidth > list.clientWidth) list.scrollLeft += el.getBoundingClientRect().left - list.getBoundingClientRect().left - (list.clientWidth - el.offsetWidth) / 2;
  }, [view, mounted]);
  // rc9 CLUB-NEWS: Escape closes the open message (the phone shows it full screen, the desk shows the empty reader again).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector('[role="dialog"]')) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);
  const setView = (v: DeskView) => {
    setViewState(v);
    window.history.replaceState(null, "", v === "inbox" ? window.location.pathname : `#${v}`);
  };

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="space-y-4" aria-busy>
          <div className="h-10 w-56 animate-pulse rounded-lg bg-white/5" />
          <div className="h-9 animate-pulse rounded-lg bg-white/5" />
          <div className="h-96 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (!save) return null;

  const unread = save.mail.filter((m) => !m.read).length;
  const waiting = save.mail.filter((m) => mailNeedsReply(m)).length;
  const items = filter === "all" ? save.mail : save.mail.filter((m) => m.kind === filter);
  const selected = items.find((m) => m.id === selectedId) ?? null;

  const onSelect = (item: MailItem) => {
    setSelectedId(item.id);
    if (!item.read) markMailRead(item.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const viewLabel: Record<DeskView, string> = { inbox: C.mail.title, news: C.news.feed.name, transfers: C.hub.transfersTitle, fans: C.feed.ui.tab }; // v2.3 UI

  return (
    <div className="rise-in mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div className="stack-block">
        <SectionTitle
          title={viewLabel[view]}
          right={
            view === "inbox" && unread > 0 ? (
              <Button size="sm" variant="ghost" onClick={markAllMailRead}>
                {C.mail.markAllRead}
              </Button>
            ) : null
          }
        />

        {/* The desk's views: what was sent to you, the news, the transfer wire. */}
        {/* v2.3 UI: with the fourth view (Fans) the strip scrolls sideways on a narrow phone instead of wrapping. */}
        <div ref={tabsRef} role="tablist" aria-label={C.mail.title} className="flex gap-6 border-b border-line max-sm:-mx-3 max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:px-3 max-sm:[scrollbar-width:none]">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cx(
                "kicker -mb-px flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-blue sm:min-h-10",
                view === v ? "border-orange !text-ink" : "border-transparent hover:!text-ink",
              )}
            >
              {viewLabel[v]}
              {v === "inbox" && unread > 0 ? <span className="rounded-sm bg-orange/20 px-1 text-[11px] tabular-nums leading-4 text-orange-bright">{unread}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {view === "news" ? <NewsFeed save={save} C={C} lang={lang} full /> : null}
      {view === "transfers" ? <TransferWirePanel save={save} C={C} D={C.dates} full /> : null}
      {view === "fans" ? <FanFeedView save={save} C={C} lang={lang} /> : null} {/* v2.3 UI */}

      {view === "inbox" ? (
        <div className="stack-block">
          {/* The kinds: quiet text keys, the chosen one underlined. Phone: one row that scrolls sideways. */}
          <div role="group" aria-label={C.mail.title} className={cx("flex flex-wrap gap-x-5 gap-y-1 max-sm:-mx-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none]", selected && "max-lg:hidden")}>
            {(["all", ...KINDS] as FilterKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cx(
                  "min-h-11 shrink-0 whitespace-nowrap border-b-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-blue sm:min-h-9",
                  filter === key ? "border-blue-bright font-semibold text-ink" : "border-transparent text-sub hover:text-ink",
                )}
              >
                {key === "all" ? C.news.filter.all : C.mail.kinds[key]}
              </button>
            ))}
          </div>

          {/* The list on the left, the open message on the right. Phone: one at a time. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
            <Panel className={cx("overflow-hidden lg:col-span-2", selected && "max-lg:hidden")}>
              {items.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="display text-[15px] font-bold text-ink">{C.mail.empty}</p>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-sub">{C.mail.emptyHint}</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((item) => (
                    <MailRow key={item.id} item={item} C={C} D={C.dates} currentSeason={save.clock.seasonIndex} selected={selected?.id === item.id} onSelect={() => onSelect(item)} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel strong className={cx("p-4 sm:p-5 lg:sticky lg:top-44 lg:col-span-3", !selected && "max-lg:hidden")}>
              {selected ? (
                <MailReader item={selected} C={C} D={C.dates} currentSeason={save.clock.seasonIndex} onBack={() => setSelectedId(null)} />
              ) : (
                <div className="grid grid-cols-2 gap-6 py-6">
                  <Figure value={unread} label={C.mail.unreadLabel} />
                  <Figure value={waiting} label={C.mail.needsReply} tone={waiting > 0 ? "orange" : undefined} />
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Figure({ value, label, tone }: { value: number; label: string; tone?: "orange" }) {
  return (
    <div>
      <p className={cx("display text-4xl font-bold leading-none tabular-nums", tone === "orange" ? "text-orange-bright" : "text-ink")}>{value}</p>
      <p className="kicker mt-2">{label}</p>
    </div>
  );
}

function datedOf(item: MailItem, D: DatesCopy, currentSeason: number): string {
  const stamp = formatDateTiny(D, dateOfDay(item.seasonIndex, item.day));
  return item.seasonIndex === currentSeason ? stamp : `${seasonLabelFor(item.seasonIndex)} · ${stamp}`;
}

// ---------------------------------------------------------------------------
// Mail row: sender (faint), subject (ink while unread), date and the one tag it may carry.
// ---------------------------------------------------------------------------

function MailRow({
  item,
  C,
  D,
  currentSeason,
  selected,
  onSelect,
}: {
  item: MailItem;
  C: CareerCopy;
  D: DatesCopy;
  currentSeason: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const resolved = resolveMail(withMoneyParams(item), C);
  const reply = mailNeedsReply(item);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cx(
          "grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue sm:px-5",
          selected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {!item.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-label={C.mail.unread(1)} /> : null}
          <span className="truncate text-xs text-faint">{resolved.from}</span>
        </span>
        <span className="text-xs tabular-nums text-faint">{datedOf(item, D, currentSeason)}</span>
        <span className={cx("line-clamp-2 text-[15px] leading-snug", item.read ? "text-sub" : "display font-bold text-ink")}>{resolved.title}</span>
        {reply ? (
          <span className="self-start justify-self-end">
            <Badge tone="orange">{C.mail.needsReply}</Badge>
          </span>
        ) : null}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The open message: the subject as the title, who sent it and when, the body, its action.
// ---------------------------------------------------------------------------

function MailReader({ item, C, D, currentSeason, onBack }: { item: MailItem; C: CareerCopy; D: DatesCopy; currentSeason: number; onBack: () => void }) {
  const router = useRouter();
  const resolved = resolveMail(withMoneyParams(item), C);
  const loan = item.titleKey === "creditOffer" && Number(item.params?.principal) > 0;
  const reply = mailNeedsReply(item);
  return (
    <article>
      <div className="card-head">
        <span className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="-ml-2 inline-flex min-h-11 items-center rounded px-2 text-sm font-semibold text-blue-bright hover:underline focus-visible:outline-2 focus-visible:outline-blue lg:hidden">
            {C.mail.back}
          </button>
          <span className="kicker truncate">{resolved.kindLabel}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-faint">{datedOf(item, D, currentSeason)}</span>
      </div>
      <h3 className="display text-[22px] font-bold leading-[1.15] text-ink sm:text-2xl">{resolved.title}</h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-faint">
        <span>{resolved.from}</span>
        {reply ? <Badge tone="orange">{C.mail.needsReply}</Badge> : null}
      </p>
      {loan ? (
        <div className="mt-5">
          <LoanSummary C={C} received={Number(item.params?.principal)} total={Number(item.params?.loanTotal)} weekly={Number(item.params?.loanWeekly)} weeks={Number(item.params?.loanTerm)} />
        </div>
      ) : resolved.message ? (
        <div className="mt-5 max-w-prose space-y-3 text-[15px] leading-[1.55] text-sub max-sm:text-sm">
          {resolved.message.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}
      <LockerTalkAnswers item={item} C={C} /> {/* v2.3 LOCKER */}
      <MediaOfferAnswers item={item} C={C} /> {/* v2.3 MEDIA */}
      {item.linkTo ? (
        <Button variant={reply ? "primary" : "secondary"} className="mt-6" onClick={() => router.push(item.linkTo!)}>
          {C.mail.open}
        </Button>
      ) : null}
    </article>
  );
}
