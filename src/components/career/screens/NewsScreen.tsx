"use client";

/**
 * Road to Worlds: the club's desk. The inbox is an email client over
 * `save.mail` (transfer bids, sponsor deals, contract notices, finance alerts,
 * unlock letters): the list on the left, the open message on the right;
 * opening marks it read, and mail with a deep link carries an Open action.
 * The HQ's news feed and transfer wire open here in full (#news, #transfers).
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
import { Button, buttonClass } from "@/components/ui/Button";
import { useSettings } from "@/store/settingsStore";
import { NewsFeed } from "@/components/career/news/NewsFeed";
import { TransferWirePanel } from "@/components/career/screens/HubScreen";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { dateOfDay, seasonLabelFor, useCareerSave } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { resolveMail } from "@/components/career/news/newsText";
import { withMoneyParams } from "@/components/career/hub/hubShared";
import { LockerTalkAnswers } from "@/components/career/locker/LockerTalkAnswers"; // v2.3 LOCKER
import { MediaOfferAnswers } from "@/components/career/media/MediaOfferAnswers"; // v2.3 MEDIA
import { FanFeedView } from "@/components/career/feed/FanFeedView"; // v2.3 UI
import { FEATURES } from "@/config/balance"; // v2.3 UI

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Filters — All + the six mail kinds
// ---------------------------------------------------------------------------

const KINDS: MailKind[] = ["offer", "sponsor", "contract", "finance", "unlock", "club"];
type FilterKey = "all" | MailKind;

const KIND_CHIP_TONE: Record<MailKind, "blue" | "gold" | "neutral" | "good" | "orange"> = {
  offer: "blue",
  sponsor: "gold",
  contract: "neutral",
  finance: "good",
  unlock: "orange",
  club: "neutral",
};

// ---------------------------------------------------------------------------
// Kind icons — hand-drawn 24×24 currentColor (house icon style)
// ---------------------------------------------------------------------------

import { ICON_TONE, MailKindIcon } from "../news/MailKindIcon";

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
  const items = filter === "all" ? save.mail : save.mail.filter((m) => m.kind === filter);
  const selected = items.find((m) => m.id === selectedId) ?? null;

  const onSelect = (item: MailItem) => {
    setSelectedId(item.id);
    if (!item.read) markMailRead(item.id);
  };

  const viewLabel: Record<DeskView, string> = { inbox: C.mail.title, news: C.news.feed.name, transfers: C.hub.transfersTitle, fans: C.feed.ui.tab }; // v2.3 UI

  return (
    <div className="rise-in mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle
        title={C.mail.title}
        right={
          view === "inbox" ? (
            <div className="flex items-center gap-3">
              {unread > 0 ? <Badge tone="orange">{C.mail.unread(unread)}</Badge> : null}
              <Button size="sm" variant="ghost" onClick={markAllMailRead} disabled={unread === 0}>
                {C.mail.markAllRead}
              </Button>
            </div>
          ) : null
        }
      />

      {/* The desk's three views: what was sent to you, the news, the transfer wire. */}
      {/* v2.3 UI: with the fourth view (Fans) the strip scrolls sideways on a narrow phone instead of wrapping. */}
      <div ref={tabsRef} role="tablist" aria-label={C.mail.title} className={cx("flex gap-6 border-b border-line", FEATURES.fanFeed && "max-sm:-mx-3 max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none]")}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cx(
              "display -mb-px flex min-h-10 items-center gap-2 border-b-2 text-[13px] uppercase tracking-[0.04em] transition-colors",
              FEATURES.fanFeed && "shrink-0 whitespace-nowrap max-sm:mb-0", // v2.3 UI
              view === v ? "border-orange font-bold text-ink" : "border-transparent font-semibold text-sub hover:text-ink",
            )}
          >
            {viewLabel[v]}
            {v === "inbox" && unread > 0 ? <span className="rounded-sm bg-orange/20 px-1 text-[11px] tabular-nums leading-4 text-orange-bright">{unread}</span> : null}
          </button>
        ))}
      </div>

      {view === "news" ? <NewsFeed save={save} C={C} lang={lang} full /> : null}
      {view === "transfers" ? <TransferWirePanel save={save} C={C} D={C.dates} full /> : null}
      {view === "fans" ? <FanFeedView save={save} C={C} lang={lang} /> : null} {/* v2.3 UI */}

      {view === "inbox" ? (
        <>
          {/* Filter chips: All + the six kinds. Phone: one row that scrolls sideways
              (they wrapped to three rows, 140px above the first mail). */}
          <div className="flex flex-wrap gap-2 max-sm:-mx-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:[scrollbar-width:none]">
            {(["all", ...KINDS] as FilterKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cx(
                  buttonClass(filter === key ? "secondary" : "ghost", "sm"),
                  "max-sm:shrink-0",
                  filter === key ? "!border-blue-bright/60" : "border border-transparent",
                )}
              >
                {key === "all" ? C.news.filter.all : C.mail.kinds[key]}
              </button>
            ))}
          </div>

          {/* The list on the left, the open message on the right. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start">
            <Panel className="overflow-hidden lg:col-span-2">
              {items.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-ink">{C.mail.empty}</p>
                  <p className="mt-1 text-xs text-sub">{C.mail.emptyHint}</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((item) => (
                    <MailRow
                      key={item.id}
                      item={item}
                      C={C}
                      D={C.dates}
                      currentSeason={save.clock.seasonIndex}
                      selected={selected?.id === item.id}
                      onSelect={() => onSelect(item)}
                    />
                  ))}
                </ul>
              )}
            </Panel>

            {/* Phone: with nothing open the reader is an empty board repeating the list's own line. */}
            <Panel strong className={cx("p-4 sm:p-5 lg:sticky lg:top-44 lg:col-span-3", !selected && "max-sm:hidden")}>
              {selected ? (
                <MailReader item={selected} C={C} D={C.dates} currentSeason={save.clock.seasonIndex} />
              ) : (
                <p className="py-10 text-center text-sm text-sub">{items.length === 0 ? C.mail.emptyHint : C.mail.pickOne}</p>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function datedOf(item: MailItem, D: DatesCopy, currentSeason: number): string {
  const stamp = formatDateTiny(D, dateOfDay(item.seasonIndex, item.day));
  return item.seasonIndex === currentSeason ? stamp : `${seasonLabelFor(item.seasonIndex)} · ${stamp}`;
}

// ---------------------------------------------------------------------------
// Mail row: unread mark, kind icon, sender, subject, date. The open one carries the orange rule.
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
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cx(
          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
          selected ? "bg-orange/[0.07] shadow-[inset_3px_0_0_var(--orange)]" : "hover:bg-white/[0.04]",
        )}
      >
        <span className={cx("relative mt-0.5 shrink-0", ICON_TONE[item.kind])}>
          <MailKindIcon kind={item.kind} className="h-5 w-5" />
          {!item.read ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange" aria-label={C.mail.unread(1)} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cx("truncate text-xs", item.read ? "text-faint" : "font-semibold text-sub")}>{resolved.from}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-faint">{datedOf(item, D, currentSeason)}</span>
          </span>
          <span className={cx("mt-0.5 line-clamp-2 block text-sm leading-snug", item.read ? "text-sub" : "font-semibold text-ink")}>
            {resolved.title}
          </span>
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The open message: who sent it and when, the subject as the title, the body, its action.
// ---------------------------------------------------------------------------

function MailReader({ item, C, D, currentSeason }: { item: MailItem; C: CareerCopy; D: DatesCopy; currentSeason: number }) {
  const router = useRouter();
  const resolved = resolveMail(withMoneyParams(item), C);
  const loan = item.titleKey === "creditOffer" && Number(item.params?.principal) > 0;
  return (
    <article>
      <div className="card-head">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cx("shrink-0", ICON_TONE[item.kind])}><MailKindIcon kind={item.kind} className="h-5 w-5" /></span>
          <span className="truncate text-sm font-semibold text-ink">{resolved.from}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          <Badge tone={KIND_CHIP_TONE[item.kind]}>{resolved.kindLabel}</Badge>
          <span className="text-xs tabular-nums text-sub">{datedOf(item, D, currentSeason)}</span>
        </span>
      </div>
      <h3 className="display text-2xl font-bold uppercase leading-[1.08] text-ink sm:text-3xl">{resolved.title}</h3>
      {loan ? (
        <div className="mt-4">
          <LoanSummary C={C} received={Number(item.params?.principal)} total={Number(item.params?.loanTotal)} weekly={Number(item.params?.loanWeekly)} weeks={Number(item.params?.loanTerm)} />
        </div>
      ) : resolved.body ? (
        <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed text-sub">{resolved.body}</p>
      ) : null}
      <LockerTalkAnswers item={item} C={C} /> {/* v2.3 LOCKER */}
      <MediaOfferAnswers item={item} C={C} /> {/* v2.3 MEDIA */}
      {item.linkTo ? (
        <Button variant="secondary" className="mt-5" onClick={() => router.push(item.linkTo!)}>
          {C.mail.open}
        </Button>
      ) : null}
    </article>
  );
}
