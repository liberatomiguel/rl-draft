"use client";

/**
 * v2.0 hub rebuild (R26), re-cut in rc.2: HQ is a day you can read at a glance.
 *   main column — the TIMELINE block (date, week strip, play/pause · skip ·
 *                 +1 day; a pending insert takes the whole block over)
 *                 → Needs you (every pending decision as its own card)
 *                 → the SQUAD block → the TRAINING block → the wire(s)
 *   side column — season goal, Road to Worlds mini, finances, inbox, next unlock.
 * The decision cards live in hub/NowCards.tsx, the clock in hub/DayCard.tsx,
 * the squad and training blocks in hub/SquadBlock.tsx / TrainingBlock.tsx —
 * this file is layout.
 */

/**
 * Road to Worlds — HQ (v0.2 rebuild): the game's living room. A NOW hero
 * (next stop / blocking decision, always dated), the week strip for the new
 * day clock, contextual quick actions, and THE WIRE — the full news feed with
 * body text — surrounded by tap-through consequence tiles (goal, race, squad,
 * budget, inbox, next unlock).
 *
 * Desktop: 2-col grid (main 2fr / side 1fr). Mobile: single column.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAREER_PAYROLL,
  CAREER_SPONSOR,
} from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type {
  CareerSave,
  NewsItem,
  NewsType,
  SponsorObjectiveKind,
  TransferOffer,
} from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  dateOfDay,
  eventDayPhaseOf,
  isWindowWeek,
  nameOfRef,
  nextPaydayFor,
  runwayWeeks,
  seasonLabelFor,
  unlockTrack,
  useCareerSave,
  useRevealHeldEventId,
  userTeamPreview,
  weekOfDay,
} from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { ContinueToSundayLabel } from "@/components/career/event/WeekendPlan";
import { weekendRoleOf } from "@/components/career/event/weekendView";
import { DayCard } from "@/components/career/hub/DayCard";
import { NowBacker, NowBid, NowEvent, NowInvite, NowSeason, NowSponsorChoice, NowSquadShort } from "@/components/career/hub/NowCards";
import { squadHoldFor, weeklyStatementOf } from "@/store/careerFlow";
import { SquadBlock } from "@/components/career/hub/SquadBlock";
import { TrainingBlock } from "@/components/career/hub/TrainingBlock";
import { RaceBlock } from "@/components/career/hub/RaceBlock";
import { SaleConsequences } from "@/components/career/SaleConsequences";
import { resolveMail, resolveNews } from "@/components/career/news/newsText";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { formatMoneyDelta } from "@/lib/format";
import { ErrorBanner, withMoneyParams } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

// ---------------------------------------------------------------------------
// Wire filters (moved here from the old NewsScreen — the full feed lives on HQ)
// ---------------------------------------------------------------------------

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
// News type icons — hand-drawn 24×24 currentColor (house icon style)
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

function NewsTypeIcon({ type, className }: { type: NewsType; className?: string }) {
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
// Screen
// ---------------------------------------------------------------------------

export function HubScreen() {
  const copy = useCopy();
  const C = useCareerCopy();
  const CHEM = copy.CHEM_TIERS;
  const D = C.dates;
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const save = useCareerSave();
  const router = useRouter();

  const acceptBid = useCareerStore((s) => s.acceptBid);
  const acceptUnofficial = useCareerStore((s) => s.acceptUnofficial);
  const resolveInsert = useCareerStore((s) => s.resolveInsert);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  const declineBid = useCareerStore((s) => s.declineBid);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);
  const markNewsRead = useCareerStore((s) => s.markNewsRead);
  const markFlag = useCareerStore((s) => s.markFlag);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const revealHeld = useRevealHeldEventId(save);

  const [confirmBid, setConfirmBid] = useState<TransferOffer | null>(null);
  const [wireOpen, setWireOpen] = useState(false);
  const [wireFilter, setWireFilter] = useState<FilterKey>("all");
  const [wireLimit, setWireLimit] = useState(WIRE_BATCH);
  // Render-phase reset so a filter switch never carries a stale page count.
  const [prevFilter, setPrevFilter] = useState<FilterKey>(wireFilter);
  if (wireFilter !== prevFilter) {
    setPrevFilter(wireFilter);
    setWireLimit(WIRE_BATCH);
  }

  const team = useMemo(() => (save ? userTeamPreview(save) : null), [save]);

  const wireHasMore =
    Boolean(save) &&
    wireOpen &&
    wireLimit <
      (save?.news.filter((n) => matchesFilter(n, wireFilter, save.identity.region)).length ?? 0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setWireLimit((l) => l + WIRE_BATCH);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, wireOpen, wireFilter, wireHasMore]);

  if (!mounted || !save || !team) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy>
          <div className="space-y-4 lg:col-span-2">
            <div className="h-60 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const region = save.identity.region;
  const today = save.clock.day;
  // ECO-02 (R46): an ended career is closed — HQ keeps the season stop and
  // drops every decision card and money warning (the actions are refused).
  const ended = save.phase === "ended";

  // --- Needs you: every pending decision / stop, each its own card ----------
  // RTW-05 (rc.33): a short squad's event — the clock holds until a third player signs.
  const squadHold = ended ? null : squadHoldFor(save);
  const eventNow =
    ended || squadHold
      ? null
      : (save.activeEvent?.def ??
        (save.pendingEventDef && save.pendingEventDef.day === today ? save.pendingEventDef : null));
  // R40: the weekend phase of today's event (Saturday Swiss · the pause · Championship Sunday).
  // rc.29 (CAR-02): a Saturday the playback has not finished revealing still
  // reads as the Swiss stage — "Swiss stage complete" and the Sunday CTA would
  // spoil the unfinished round (and skip its replay).
  const rawPhase = eventDayPhaseOf(save);
  const eventPhase =
    rawPhase === "paused" && revealHeld !== null && revealHeld === save.activeEvent?.def.id ? "swiss" : rawPhase;
  const eventRole = eventNow ? weekendRoleOf(eventNow, today) : null;
  const eventStage =
    eventPhase === "paused"
      ? { label: C.event.swissComplete, tone: "good" as const }
      : eventRole === "championshipSunday"
        ? { label: C.event.championshipSunday, tone: "gold" as const, live: true }
        : eventRole === "swissDay"
          ? { label: C.event.swissStage, tone: "orange" as const, live: true }
          : undefined;
  const outBid = ended
    ? null
    : (save.pendingOffers.find((o) => o.status === "pending" && o.direction === "out") ?? null);
  const sponsorOffers =
    !ended && save.sponsorOffers && save.sponsorOffers.length > 0 ? save.sponsorOffers : null;
  const phaseStop = save.phase === "seasonReview" || ended;
  const invite = !ended && !save.pendingEventDef && save.unofficialOffer ? save.unofficialOffer : null;
  const insert = !ended && save.pendingInsert && save.pendingInsert.day === today ? save.pendingInsert : null;
  const expiringContracts =
    !ended && weekOfDay(today) >= 23
      ? save.squad.filter((p) => p.contractEndSeason === save.clock.seasonIndex).length
      : 0;
  // rc.32: the statement the Monday books (the season's money index, the founding partner).
  const statement = weeklyStatementOf(save);
  // No runway, Backer or instalment notices once the books are closed.
  const runway = ended ? null : runwayWeeks(save.finances.balance, statement.net);
  const cashTight = runway !== null && runway <= CAREER_PAYROLL.runwayWarnWeeks;
  const backerOwed = ended ? null : save.finances.loan;
  const bankLoan = ended ? null : (save.finances.bankLoan ?? null);
  const nextPayday = nextPaydayFor(save.clock);
  const needsCount =
    (phaseStop ? 1 : 0) +
    (eventNow ? 1 : 0) +
    (squadHold ? 1 : 0) +
    (outBid ? 1 : 0) +
    (sponsorOffers ? 1 : 0) +
    (invite ? 1 : 0);

  // --- the wire ----------------------------------------------------------------
  const unreadNews = save.news.filter((n) => !n.read).length;
  const wireItems = wireOpen
    ? save.news.filter((n) => matchesFilter(n, wireFilter, region)).slice(0, wireLimit)
    : save.news.slice(0, WIRE_PREVIEW);

  // --- inbox teaser -----------------------------------------------------------
  const unreadMail = save.mail.filter((m) => !m.read).length;
  const latestMail = save.mail.slice(0, 2);

  // --- next unlock ------------------------------------------------------------
  const nextUnlock = unlockTrack(save)
    .filter((e) => !e.unlocked && !e.future)
    .sort((a, b) => a.gate - b.gate)[0];
  const unlockLabels = C.club.unlockables as Record<string, string>;

  const objectiveText = (kind: SponsorObjectiveKind): string =>
    kind === "enterEvents"
      ? C.finances.objective.enterEvents(CAREER_SPONSOR.enterEventsTarget)
      : C.finances.objective[kind];

  const goalText = (key: string): string => {
    const suffix = key.split(".").pop() ?? key;
    const v = C.goals[suffix as keyof typeof C.goals];
    return typeof v === "string" ? v : key;
  };



  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <ErrorBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ============ main column (2fr): NOW · week · office · wire ============ */}
        <div className="space-y-4 lg:col-span-2">
          {/* 1 — THE DAY CARD (clock + week strip + advance) */}
          <DayCard save={save} C={C} insertId={insert?.id ?? null} onInsert={resolveInsert} />

          {/* 2 — NEEDS YOU (decisions and stops, one card each) */}
          {needsCount > 0 || expiringContracts > 0 || cashTight || backerOwed ? (
            <div className="space-y-3">
              <p className="kicker text-[10px] text-orange-bright">{C.hub.needsYou}</p>
              {phaseStop ? (
                <Panel strong glow="orange" className="rise-in p-5">
                  <NowSeason save={save} C={C} onGo={() => router.push("/career/season")} />
                </Panel>
              ) : null}
              {eventNow ? (
                <Panel strong glow="orange" className="rise-in p-5">
                  <NowEvent
                    save={save}
                    C={C}
                    D={D}
                    def={eventNow}
                    daysAway={0}
                    day={today}
                    stage={eventStage}
                    primaryLabel={eventPhase === "paused" ? <ContinueToSundayLabel /> : C.hub.continue}
                    onPrimary={() => {
                      // R40: the paused Saturday moves exactly one day, to Championship Sunday.
                      if (eventPhase === "paused") continueEventToNextDay();
                      router.push("/career/event");
                    }}
                  />
                </Panel>
              ) : null}
              {squadHold ? (
                <Panel strong glow="orange" className="rise-in border-bad/40 p-5">
                  <NowSquadShort save={save} C={C} def={squadHold} onPass={passUnofficial} />
                </Panel>
              ) : null}
              {invite ? (
                <Panel strong className="rise-in border-orange/40 p-5">
                  <NowInvite
                    save={save}
                    C={C}
                    D={D}
                    def={invite}
                    onAccept={acceptUnofficial}
                    onPass={passUnofficial}
                  />
                </Panel>
              ) : null}
              {outBid ? (
                <Panel strong className="rise-in border-orange/40 p-5">
                  <NowBid
                    save={save}
                    C={C}
                    offer={outBid}
                    onAccept={() => setConfirmBid(outBid)}
                    onDecline={() => declineBid(outBid.id)}
                  />
                </Panel>
              ) : null}
              {sponsorOffers ? (
                <Panel strong className="rise-in border-blue/40 p-5">
                  <NowSponsorChoice
                    C={C}
                    lang={lang}
                    offers={sponsorOffers}
                    objectiveText={objectiveText}
                    onChoose={(id) => chooseSponsor(id)}
                  />
                </Panel>
              ) : null}
              {expiringContracts > 0 ? (
                <AppLink href="/career/squad" className="block">
                  <Panel className="rise-in border-orange/30 p-3.5 text-sm text-ink transition-colors hover:border-orange/60">
                    {C.hub.contractsExpiring(expiringContracts)}
                  </Panel>
                </AppLink>
              ) : null}
              {cashTight ? (
                <AppLink href="/career/finances" className="block">
                  <Panel className="rise-in border-bad/40 p-3.5 text-sm text-bad transition-colors hover:border-bad/70">
                    {C.hub.cashWarningCard(runway ?? 0)}
                  </Panel>
                </AppLink>
              ) : null}
              {backerOwed ? (
                <AppLink href="/career/finances" className="block">
                  <Panel className="rise-in border-orange/30 p-3.5 text-sm text-sub transition-colors hover:border-orange/60">
                    {/* rc.32 (M4): the debt and what the next breach means. */}
                    <NowBacker save={save} C={C} owed={formatMoney(backerOwed.remaining)} />
                  </Panel>
                </AppLink>
              ) : null}
            </div>
          ) : insert ? null : (
            // rc.31: the day card's inline insert IS today's decision — never say "nothing needs one" under it.
            <p className="px-1 text-xs text-faint">{C.hub.nothingNeeded}</p>
          )}

          {/* 3 — THE SQUAD + TRAINING (rc.2) */}
          <SquadBlock save={save} C={C} team={team} chemTiers={CHEM} />
          <TrainingBlock save={save} C={C} statLabels={copy.STAT_LABELS} />

          {/* 7 — THE WIRE (full feed, filterable, expands in place) */}
          <Panel className="rise-in p-4" style={{ animationDelay: "120ms" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="kicker text-[10px]">
                {C.hub.news}
                {unreadNews > 0 ? (
                  <span className="ml-2 rounded-full bg-orange/20 px-1.5 py-px font-mono text-[10px] normal-case tracking-normal text-orange-bright">
                    {unreadNews}
                  </span>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                {wireOpen && unreadNews > 0 ? (
                  <Button size="sm" variant="ghost" onClick={markNewsRead}>
                    {C.news.markAllRead}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setWireOpen((v) => !v)}>
                  {wireOpen ? C.common.close : C.hub.newsAll}
                </Button>
              </div>
            </div>

            {wireOpen ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {FILTERS.map((key) => (
                  <button
                    key={key}
                    onClick={() => setWireFilter(key)}
                    aria-pressed={wireFilter === key}
                    className={cx(
                      "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                      wireFilter === key
                        ? "border-blue/50 bg-blue/15 text-blue-bright"
                        : "border-line-strong bg-white/5 text-sub hover:text-ink",
                    )}
                  >
                    {C.news.filter[key]}
                  </button>
                ))}
              </div>
            ) : null}

            {wireItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-sub">{C.hub.emptyStateBody}</p>
            ) : (
              <div className="space-y-2">
                {wireItems.map((item) => (
                  <WireRow key={item.id} item={item} save={save} C={C} D={D} lang={lang} />
                ))}
              </div>
            )}

            {wireHasMore ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
          </Panel>

          {/* 8 — v0.3 THE TRANSFER WIRE (window panel, region-filterable) */}
          <TransferWirePanel save={save} C={C} D={D} />
        </div>

        {/* ============ side column (1fr): goal · race · squad · budget · inbox · unlock ============ */}
        <div className="space-y-4">
          {/* 4a — season goal */}
          {save.seasonGoals ? (
            <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
              <p className="kicker mb-1 text-[10px]">{C.hub.seasonGoal}</p>
              <p className="display text-base font-bold uppercase tracking-wide text-ink">
                {goalText(save.seasonGoals.targetKey)}
              </p>
              <p className="mt-1 text-xs text-sub">
                <span className="kicker mr-1.5 text-[9px]">{C.hub.goalStretch}</span>
                {goalText(save.seasonGoals.stretchKey)}
              </p>
            </Panel>
          ) : null}

          {/* 4b — RTW-01 (R49, UX-01d): the Major / Worlds race toggle */}
          <RaceBlock save={save} C={C} />

          {/* 5 — finances at a glance (rc.2) */}
          <AppLink href="/career/finances" className="block">
            <Panel
              className={cx(
                "rise-in p-4 transition-colors hover:border-line-strong",
                save.finances.balance < 0 ? "border-bad/40" : cashTight ? "border-orange/40" : "",
              )}
              style={{ animationDelay: "120ms" }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="kicker text-[10px]">{C.hub.financesTitle}</p>
                {backerOwed ? <Badge tone="orange">{C.finances.backer}</Badge> : bankLoan ? <Badge tone="blue">{C.finances.bankTitle}</Badge> : null}
              </div>
              <p className={cx("display text-2xl font-bold leading-none", save.finances.balance < 0 ? "text-bad" : "text-ink")}>
                {formatMoney(save.finances.balance, { compact: true })}
              </p>
              <p className="mt-1.5 text-xs text-sub">
                <span className={statement.net >= 0 ? "text-good" : "text-bad"}>{formatMoneyDelta(statement.net, { compact: true })}</span>{" "}
                <span className="text-faint">/ {C.hub.week(1).toLowerCase().replace(/\s*1$/, "")}</span>
                {runway !== null ? <span className="text-faint"> · {C.finances.runway(runway)}</span> : null}
              </p>
              {/* ECO-02 (R46): the debts as Finances and the ledger have them (not once the career ended). */}
              {backerOwed ? (
                <p className="mt-1 text-xs font-semibold text-orange-bright">
                  {C.finances.backerRemaining(formatMoney(backerOwed.remaining))}
                </p>
              ) : null}
              {bankLoan ? (
                <p className="mt-1 text-xs text-sub">
                  {C.finances.bankNext(
                    formatMoney(Math.min(bankLoan.remaining, bankLoan.weeklyPayment)),
                    formatDateTiny(D, dateOfDay(nextPayday.seasonIndex, nextPayday.day)),
                  )}
                </p>
              ) : null}
              <p className="mt-2 text-right text-xs font-semibold text-blue-bright">{C.hub.financesOpen} →</p>
            </Panel>
          </AppLink>

          {/* 8 — inbox teaser */}
          <AppLink href="/career/news" className="block">
            <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "180ms" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="kicker text-[10px]">{C.hub.inboxTeaser}</p>
                {unreadMail > 0 ? (
                  <Badge tone="orange">{C.mail.unread(unreadMail)}</Badge>
                ) : null}
              </div>
              {latestMail.length === 0 ? (
                <p className="text-xs text-faint">{C.mail.empty}</p>
              ) : (
                <ul>
                  {latestMail.map((m) => {
                    const r = resolveMail(withMoneyParams(m), C);
                    return (
                      <li
                        key={m.id}
                        className="flex items-start gap-2 border-b border-line py-1.5 last:border-0"
                      >
                        <span
                          className={cx(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            m.read ? "bg-white/15" : "bg-orange",
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cx(
                              "truncate text-xs",
                              m.read ? "text-sub" : "font-semibold text-ink",
                            )}
                          >
                            {r.title}
                          </p>
                          <p className="text-[10px] text-faint">
                            {r.from} · {formatDateTiny(D, dateOfDay(m.seasonIndex, m.day))}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-right text-xs font-semibold text-blue-bright">
                {C.hub.inboxAll}
              </p>
            </Panel>
          </AppLink>

          {/* 9 — next unlock */}
          {nextUnlock ? (
            <AppLink href="/career/club" className="block">
              <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "210ms" }}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="kicker text-[10px]">{C.hub.progression}</p>
                  <span className="text-[10px] text-faint">
                    {Math.round(save.reputation)} / {nextUnlock.gate} {C.common.rep}
                  </span>
                </div>
                <p className="display text-sm font-bold uppercase tracking-wide text-ink">
                  {unlockLabels[nextUnlock.key] ?? nextUnlock.key}
                </p>
                <ProgressBar
                  value={save.reputation / nextUnlock.gate}
                  tone="orange"
                  className="mt-2"
                  label={C.hub.progression}
                />
                <p className="mt-1.5 text-[10px] text-faint">{C.club.unlockAt(nextUnlock.gate)}</p>
              </Panel>
            </AppLink>
          ) : null}
        </div>
      </div>

      {/* Accept-bid confirm: cost + balance-after BEFORE commit (principle 4). */}
      <Modal
        open={Boolean(confirmBid)}
        title={C.market.incomingBid}
        onClose={() => setConfirmBid(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmBid(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirmBid) acceptBid(confirmBid.id);
                setConfirmBid(null);
              }}
            >
              {C.common.confirm}
            </Button>
          </>
        }
      >
        {confirmBid ? (
          <div className="space-y-2">
            <p className="text-ink">
              {C.market.bidFrom(confirmBid.otherRef ? nameOfRef(save, confirmBid.otherRef) : "?")} —{" "}
              {confirmBid.playerName}
            </p>
            {/* ECO-02 (R46) / ECO-03 (R47): the Market's own sale block — the Backer's share and the weekly bill. */}
            <SaleConsequences save={save} offer={confirmBid} />
          </div>
        ) : null}
      </Modal>

      {/* First-visit explainer (one-shot). */}
      <Modal
        open={!save.flags["seenHub"]}
        title={C.explainers.hub.title}
        onClose={() => markFlag("seenHub")}
        actions={
          <Button variant="primary" onClick={() => markFlag("seenHub")}>
            {C.explainers.gotIt}
          </Button>
        }
      >
        {C.explainers.hub.body}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v0.3 — THE TRANSFER WIRE (window panel: every move, all regions, filterable)
// ---------------------------------------------------------------------------

const TRANSFER_PREVIEW = 6;
/** Keep the wire visible this many days past the last logged move. */
const TRANSFER_LINGER_DAYS = 14;

function TransferWirePanel({
  save,
  C,
  D,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
}) {
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  const seasonMoves = save.transferLog.filter(
    (t) => t.seasonIndex === save.clock.seasonIndex,
  );
  const windowOpen = isWindowWeek(weekOfDay(save.clock.day));
  const recent = seasonMoves.some((t) => save.clock.day - t.day <= TRANSFER_LINGER_DAYS);
  if (!windowOpen && !recent) return null;

  const filtered =
    regionFilter === "all"
      ? seasonMoves
      : seasonMoves.filter((t) => t.region === regionFilter);
  const shownMoves = expanded ? filtered : filtered.slice(0, TRANSFER_PREVIEW);

  const orgCell = (ref: string | null) => {
    if (!ref) {
      return (
        <span className="display text-[10px] font-bold uppercase tracking-[0.1em] text-good">
          {C.hub.transfersFa}
        </span>
      );
    }
    const tappable = ref !== "user" && Boolean(save.world.orgs[ref]);
    const body = (
      <>
        <OrgMark save={save} orgRef={ref} size="xs" />
        <span className="max-w-24 truncate">{nameOfRef(save, ref)}</span>
      </>
    );
    if (!tappable) {
      return <span className="flex min-w-0 items-center gap-1 text-sub">{body}</span>;
    }
    return (
      <button
        type="button"
        title={C.orgSheet.viewTeam}
        onClick={() => setSheetRef(ref)}
        className="flex min-w-0 items-center gap-1 text-sub transition-colors hover:text-ink"
      >
        {body}
      </button>
    );
  };

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "140ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">
          {C.hub.transfersTitle}
          <span className="ml-2 font-normal normal-case tracking-normal text-faint">
            {C.hub.transfersWire}
          </span>
        </p>
        {windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", ...Object.keys(REGION_BADGE)].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegionFilter(r)}
            aria-pressed={regionFilter === r}
            className={cx(
              "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
              regionFilter === r
                ? r === "all"
                  ? "border-blue/50 bg-blue/15 text-blue-bright"
                  : REGION_BADGE[r as keyof typeof REGION_BADGE]
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {r === "all" ? C.hub.transfersAll : r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-faint">{C.hub.transfersEmpty}</p>
      ) : (
        <ul className="space-y-1.5">
          {shownMoves.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-xs"
            >
              <span className="w-12 shrink-0 text-[10px] text-faint">
                {formatDateTiny(D, dateOfDay(t.seasonIndex, t.day))}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                {t.playerName}
              </span>
              <span className="flex min-w-0 items-center gap-1">
                {orgCell(t.fromRef)}
                <span className="text-faint" aria-hidden>
                  →
                </span>
                {orgCell(t.toRef)}
              </span>
              {t.kind === "userIn" || t.kind === "userOut" ? (
                <Badge tone="orange">{C.hub.transfersUser}</Badge>
              ) : null}
              {t.fee > 0 ? (
                <span className="shrink-0 font-semibold text-orange-bright">
                  {formatMoney(t.fee, { compact: true })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!expanded && filtered.length > TRANSFER_PREVIEW ? (
        <div className="mt-2 text-center">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>
            {C.hub.transfersShowAll(filtered.length)}
          </Button>
        </div>
      ) : null}

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Wire row (headline + support text + stamp)
// ---------------------------------------------------------------------------

function WireRow({
  item,
  save,
  C,
  D,
  lang,
}: {
  item: NewsItem;
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  lang: "en" | "pt";
}) {
  const resolved = resolveNews(withMoneyParams(item), C, lang);
  const gold = item.priority === 3;
  const sameSeason = item.seasonIndex === save.clock.seasonIndex;
  const stamp =
    typeof item.day === "number"
      ? formatDateTiny(D, dateOfDay(item.seasonIndex, item.day))
      : C.hub.week(item.week);

  return (
    <article
      className={cx(
        "flex gap-3 rounded-lg border border-line bg-white/[0.02] p-3",
        gold && "!border-amber-400/40 !bg-amber-400/5",
      )}
    >
      <div className={cx("mt-0.5 shrink-0", ICON_TONE[item.type])}>
        <NewsTypeIcon type={item.type} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        {resolved.wire ? (
          <p className="kicker mb-0.5 !text-[9px] !tracking-[0.28em] text-amber-300">
            {C.news.wire}
          </p>
        ) : null}
        <p
          className={cx(
            "text-sm leading-snug",
            item.read ? "text-sub" : "font-semibold text-ink",
          )}
        >
          {resolved.title}
        </p>
        {resolved.body ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-sub">{resolved.body}</p>
        ) : null}
        <p className="mt-1.5 text-[10px] text-faint">
          {sameSeason ? stamp : `${seasonLabelFor(item.seasonIndex)} · ${stamp}`}
        </p>
      </div>
      {!item.read ? (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange"
          aria-label={C.news.unread(1)}
        />
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// NOW card variants
// ---------------------------------------------------------------------------
