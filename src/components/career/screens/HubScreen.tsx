"use client";

/**
 * Road to Worlds — HQ (v0.2 rebuild): the game's living room. A NOW hero
 * (next stop / blocking decision, always dated), the week strip for the new
 * day clock, contextual quick actions, and THE WIRE — the full news feed with
 * body text — surrounded by tap-through consequence tiles (goal, race, squad,
 * budget, inbox, next unlock).
 *
 * Desktop: 2-col grid (main 2fr / side 1fr). Mobile: single column.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CAREER_ECONOMY, CAREER_SPONSOR } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/copy.career.en";
import { sponsorBrandById } from "@/data/career/sponsors";
import type {
  CareerEventDef,
  CareerSave,
  NewsItem,
  NewsType,
  SponsorObjectiveKind,
  SponsorState,
  TransferOffer,
} from "@/engine/career/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  CAREER_GEAR,
  CAREER_SLOTS,
  agendaDays,
  clockLabel,
  dateOfDay,
  dayOfWeekOf,
  daysUntilWindowCloses,
  scrimAvailability,
  seasonLabelFor,
  squadAge,
  standingsRows,
  unlockTrack,
  upcomingStops,
  useCareerSave,
  userStars,
  userTeamPreview,
  nameOfRef,
  type AgendaDay,
  type UpcomingStop,
} from "@/components/career/careerUi";
import { formatDateShort, formatDateTiny, formatDaysAway } from "@/components/career/dateText";
import { resolveMail, resolveNews } from "@/components/career/news/newsText";
import { OrgMark } from "@/components/career/OrgMark";
import { TeamStars } from "@/components/career/TeamStars";
import {
  ErrorBanner,
  TierChip,
  maxPointsOf,
  prizePoolOf,
  withMoneyParams,
} from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Wire filters (moved here from the old NewsScreen — the full feed lives on HQ)
// ---------------------------------------------------------------------------

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
  const C = copy.CAREER;
  const CHEM = copy.CHEM_TIERS;
  const D = C.dates;
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const save = useCareerSave();
  const router = useRouter();

  const advanceDay = useCareerStore((s) => s.advanceDay);
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const runScrim = useCareerStore((s) => s.runScrim);
  const acceptBid = useCareerStore((s) => s.acceptBid);
  const declineBid = useCareerStore((s) => s.declineBid);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);
  const markNewsRead = useCareerStore((s) => s.markNewsRead);
  const markFlag = useCareerStore((s) => s.markFlag);

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
  const clock = clockLabel(save);
  const today = save.clock.day;

  // --- NOW hero decision chain (season stop > event today > out-bid >
  // sponsor choice > next stop preview) --------------------------------------
  const eventNow =
    save.activeEvent?.def ??
    (save.pendingEventDef && save.pendingEventDef.day === today ? save.pendingEventDef : null);
  const outBid =
    save.pendingOffers.find((o) => o.status === "pending" && o.direction === "out") ?? null;
  const sponsorOffers =
    save.sponsorOffers && save.sponsorOffers.length > 0 ? save.sponsorOffers : null;
  const phaseStop = save.phase === "seasonReview" || save.phase === "ended";
  const nextStop = upcomingStops(save, 1)[0] ?? null;
  const heroDecision = !phaseStop && !eventNow && Boolean(outBid || sponsorOffers);

  // --- week strip -----------------------------------------------------------
  const monday = today - (dayOfWeekOf(today) + -1);
  const weekDays = agendaDays(save, monday, 7);

  // --- quick actions --------------------------------------------------------
  const scrim = scrimAvailability(save);
  const windowDaysLeft = daysUntilWindowCloses(save);

  // --- budget tile ----------------------------------------------------------
  const wages =
    save.squad.reduce((s, p) => s + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0);
  const upkeep =
    CAREER_GEAR.items.reduce(
      (s, item) => s + (save.finances.gear[item.id] ? item.upkeepPerSplit : 0),
      0,
    ) + (save.finances.gear.psychologist ? CAREER_GEAR.psychologistPerSplit : 0);
  const incomePerSplit =
    (save.sponsor?.basePerSplit ?? 0) +
    Math.round(save.reputation * CAREER_ECONOMY.passivePerRepPoint);
  const net = incomePerSplit - wages - upkeep;
  const projectedNegative = save.finances.balance + net < 0;

  // --- Road to Worlds mini --------------------------------------------------
  const rows = standingsRows(save, region, "season");
  const userRow = rows.find((r) => r.isUser);
  const slots = CAREER_SLOTS.worlds[region] ?? 0;
  const gapToLine =
    userRow && userRow.rank > slots ? (rows[slots - 1]?.points ?? 0) - userRow.points : 0;
  const miniIdx = [...new Set([0, slots - 1, slots, rows.findIndex((r) => r.isUser)])]
    .filter((i) => i >= 0 && i < rows.length)
    .sort((a, b) => a - b);

  // --- squad strip ------------------------------------------------------------
  const starters = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

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

  const confirmSoldSalary = confirmBid
    ? (save.squad.find((p) => p.id === confirmBid.playerId)?.salaryPerSplit ?? 0)
    : 0;

  const actionChip =
    "display inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-xs font-bold uppercase tracking-[0.12em] transition-colors";

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <ErrorBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ============ main column (2fr): NOW · week · office · wire ============ */}
        <div className="space-y-4 lg:col-span-2">
          {/* 1 — NOW hero */}
          <Panel strong glow="orange" className="rise-in p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="kicker">{heroDecision ? C.hub.nowDecision : C.hub.nowNext}</p>
              <span className="text-xs font-semibold text-sub">
                {formatDateShort(D, clock.date)}
              </span>
            </div>
            {phaseStop ? (
              <NowSeason save={save} C={C} onGo={() => router.push("/career/season")} />
            ) : eventNow ? (
              <NowEvent
                save={save}
                C={C}
                D={D}
                def={eventNow}
                daysAway={0}
                primaryLabel={C.hub.continue}
                onPrimary={() => router.push("/career/event")}
              />
            ) : outBid ? (
              <NowBid
                save={save}
                C={C}
                offer={outBid}
                onAccept={() => setConfirmBid(outBid)}
                onDecline={() => declineBid(outBid.id)}
              />
            ) : sponsorOffers ? (
              <NowSponsorChoice
                C={C}
                lang={lang}
                offers={sponsorOffers}
                objectiveText={objectiveText}
                onChoose={(id) => chooseSponsor(id)}
              />
            ) : nextStop && nextStop.kind === "event" && nextStop.event ? (
              <NowEvent
                save={save}
                C={C}
                D={D}
                def={nextStop.event}
                daysAway={nextStop.daysAway}
                primaryLabel={C.hub.continueTo(nextStop.event.name)}
                onPrimary={advanceToNextStop}
                onAdvanceDay={advanceDay}
              />
            ) : (
              <NowAdvance
                save={save}
                C={C}
                D={D}
                stop={nextStop}
                windowDaysLeft={windowDaysLeft}
                onAdvance={advanceToNextStop}
                onAdvanceDay={advanceDay}
              />
            )}
          </Panel>

          {/* 2 — THIS WEEK strip */}
          <Link href="/career/calendar" className="block">
            <Panel className="rise-in p-3.5 transition-colors hover:border-line-strong" style={{ animationDelay: "40ms" }}>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="kicker text-[10px]">{C.hub.thisWeek}</p>
                <span className="flex items-center gap-2 text-[10px] text-faint">
                  {clock.split ? <span>{C.calendar.split(clock.split)}</span> : null}
                  <span>{C.hub.week(clock.week)}</span>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {weekDays.map((d) => (
                  <DayChip key={d.day} d={d} C={C} />
                ))}
              </div>
            </Panel>
          </Link>

          {/* 3 — TODAY AT THE OFFICE */}
          <Panel className="rise-in p-4" style={{ animationDelay: "80ms" }}>
            <p className="kicker mb-3 text-[10px]">{C.hub.quickActions}</p>
            <div className="flex flex-wrap items-center gap-2">
              {scrim.available && scrim.opponentName ? (
                <Button
                  variant="secondary"
                  size="md"
                  className="min-h-11"
                  onClick={runScrim}
                >
                  {C.hub.scrimCta(scrim.opponentName)}
                </Button>
              ) : null}
              {clock.dow <= 5 && !eventNow ? (
                <Link
                  href="/career/training"
                  className={cx(
                    actionChip,
                    "border-line-strong bg-white/5 text-sub hover:text-ink",
                  )}
                >
                  {C.nav.training}
                </Link>
              ) : null}
              {clock.windowOpen ? (
                <Link
                  href="/career/market"
                  className={cx(actionChip, "border-blue/50 bg-blue/10 text-blue-bright hover:bg-blue/20")}
                >
                  {C.calendar.windowOpen}
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>
            <div className="mt-2.5 space-y-1 text-xs">
              {scrim.reason === "ok" ? (
                <p className="text-sub">{C.hub.scrimsLeft(scrim.remaining)}</p>
              ) : scrim.reason === "restDay" ? (
                <p className="text-faint">{C.hub.restDay}</p>
              ) : scrim.reason === "used" ? (
                <p className="text-faint">{C.scrim.usedUp}</p>
              ) : (
                <p className="text-faint">{C.hub.scrimUnavailable}</p>
              )}
              {clock.windowOpen && windowDaysLeft !== null ? (
                <p className="text-blue-bright">{C.calendar.windowCloses(windowDaysLeft)}</p>
              ) : null}
            </div>
          </Panel>

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

          {/* 4b — Road to Worlds mini */}
          <Link href="/career/standings" className="block">
            <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "90ms" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="kicker text-[10px]">{C.hub.pointsRace}</p>
                <Badge className={REGION_BADGE[region]}>{region}</Badge>
              </div>
              {userRow ? (
                <>
                  <p className="display text-xl font-bold text-ink">
                    {C.hub.pointsRank(userRow.rank, userRow.points)}
                  </p>
                  {userRow.rank <= slots ? (
                    <Badge tone="good" className="mt-1">
                      {C.hub.pointsSafe}
                    </Badge>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-bad">{C.hub.pointsGap(gapToLine)}</p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {miniIdx.map((i, k) => {
                      const r = rows[i];
                      const prev = k > 0 ? rows[miniIdx[k - 1]] : null;
                      return (
                        <li key={r.ref}>
                          {prev && prev.rank <= slots && r.rank > slots ? (
                            <div className="my-1.5 flex items-center gap-2" aria-hidden>
                              <span className="flex-1 border-t border-dashed border-blue/60" />
                              <span className="kicker text-[9px] text-blue-bright">
                                {C.standings.worldsLine}
                              </span>
                              <span className="flex-1 border-t border-dashed border-blue/60" />
                            </div>
                          ) : prev && r.rank > prev.rank + 1 ? (
                            <p className="text-center text-[10px] leading-3 text-faint" aria-hidden>
                              ···
                            </p>
                          ) : null}
                          <div
                            className={cx(
                              "flex items-center gap-2 rounded-md px-1.5 py-1",
                              r.isUser && "border border-orange/40 bg-orange/10",
                            )}
                          >
                            <span className="display w-5 shrink-0 text-right text-xs font-bold text-faint">
                              {r.rank}
                            </span>
                            <OrgMark save={save} orgRef={r.ref} size="xs" />
                            <span
                              className={cx(
                                "min-w-0 flex-1 truncate text-xs",
                                r.isUser ? "font-bold text-ink" : "text-sub",
                              )}
                            >
                              {r.name}
                            </span>
                            <TeamStars stars={r.stars} size="xs" />
                            <span className="display shrink-0 text-xs font-bold text-ink">
                              {r.points}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </Panel>
          </Link>

          {/* 5 — squad strip */}
          <Link href="/career/squad" className="block">
            <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "120ms" }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="kicker text-[10px]">{C.hub.rosterForm}</p>
                <TeamStars stars={userStars(save)} size="xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {starters.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-line bg-white/[0.03] p-2.5 text-center"
                  >
                    <div className="display text-2xl font-bold leading-none text-ink" title={C.common.ovr}>
                      {Math.round(p.overall)}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-ink">{p.name}</div>
                    <div className="text-[10px] text-faint">{C.player.age(squadAge(save, p))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="kicker shrink-0 text-[10px]">{C.hub.chemistry}</span>
                <ProgressBar
                  value={team.chemistry.percent / 100}
                  tone={team.chemistry.percent >= 75 ? "good" : "blue"}
                  className="flex-1"
                  label={C.hub.chemistry}
                />
                <span className="display shrink-0 text-xs font-bold text-ink">
                  {CHEM[team.chemistry.tier] ?? team.chemistry.tier} · {team.chemistry.percent}%
                </span>
              </div>
            </Panel>
          </Link>

          {/* 6 — budget tile */}
          <Link href="/career/finances" className="block">
            <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "150ms" }}>
              <p className="kicker mb-1 text-[10px]">{C.hub.budget}</p>
              <p
                className={cx(
                  "display text-2xl font-bold leading-none",
                  save.finances.balance < 0 || projectedNegative ? "text-bad" : "text-ink",
                )}
              >
                {formatMoney(save.finances.balance)}
              </p>
              <p className={cx("mt-1 text-xs font-semibold", net >= 0 ? "text-good" : "text-bad")}>
                {C.hub.budgetNet(formatMoneyDelta(net, { compact: true }))}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-line bg-white/[0.03] px-2 py-1.5">
                  <span className="kicker block text-[9px]">{C.finances.income}</span>
                  <span className="font-semibold text-good">
                    {formatMoney(incomePerSplit, { compact: true })}
                  </span>
                </div>
                <div className="rounded-md border border-line bg-white/[0.03] px-2 py-1.5">
                  <span className="kicker block text-[9px]">{C.finances.expenses}</span>
                  <span className="font-semibold text-bad">
                    {formatMoney(wages + upkeep, { compact: true })}
                  </span>
                </div>
              </div>
              {projectedNegative ? (
                <p className="mt-2 text-xs font-semibold text-bad">{C.hub.budgetWarning}</p>
              ) : null}
              {save.finances.loan ? (
                <Badge tone="bad" className="mt-2">
                  {C.finances.backerRemaining(
                    formatMoney(save.finances.loan.remaining, { compact: true }),
                  )}
                </Badge>
              ) : null}
              {save.sponsor ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                    {sponsorBrandById.get(save.sponsor.sponsorId)?.name ?? save.sponsor.sponsorId}
                  </span>
                  <Badge tone="blue">{C.finances.sponsorTier(save.sponsor.tier)}</Badge>
                  {save.sponsor.hitThisSplit ? (
                    <Badge tone="good">{C.finances.objectiveHit}</Badge>
                  ) : null}
                </div>
              ) : null}
            </Panel>
          </Link>

          {/* 8 — inbox teaser */}
          <Link href="/career/news" className="block">
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
          </Link>

          {/* 9 — next unlock */}
          {nextUnlock ? (
            <Link href="/career/club" className="block">
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
            </Link>
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
            <p className="kicker text-[10px]">{C.market.consequences}</p>
            <p className="font-semibold text-good">
              {C.market.balanceAfter(formatMoney(save.finances.balance + confirmBid.fee))}
            </p>
            <p>{C.market.wageAfter(formatMoney(wages - confirmSoldSalary))}</p>
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
// Week strip day chip
// ---------------------------------------------------------------------------

function DayChip({ d, C }: { d: AgendaDay; C: CareerCopy }) {
  const D = C.dates;
  const matchday = d.kinds.includes("matchday");
  const windowOpens = d.kinds.includes("windowOpen");
  const payday = d.kinds.includes("payday");
  const rest = d.kinds.includes("rest");

  const label = d.event
    ? d.event.name
    : matchday
      ? C.calendar.matchday
      : windowOpens
        ? C.calendar.window
        : payday
          ? C.calendar.payday
          : rest
            ? C.calendar.restDay
            : d.kinds.includes("training")
              ? C.calendar.trainingDay
              : "";

  return (
    <div
      title={label || undefined}
      className={cx(
        "flex flex-col items-center gap-0.5 rounded-lg border py-1.5",
        matchday
          ? "border-orange/50 bg-orange/10"
          : "border-line bg-white/[0.03]",
        d.isToday && "ring-2 ring-orange",
        d.isPast && "opacity-40",
      )}
    >
      <span className="kicker text-[8px] leading-none sm:text-[9px]">{D.weekdays[d.dow - 1]}</span>
      <span
        className={cx(
          "display text-sm font-bold leading-none",
          matchday ? "text-orange-bright" : "text-ink",
        )}
      >
        {d.date.d}
      </span>
      <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
        {matchday ? <span className="h-1.5 w-1.5 rounded-full bg-orange" /> : null}
        {windowOpens ? <span className="h-1.5 w-1.5 rounded-full bg-blue" /> : null}
        {payday ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
        {rest && !matchday ? <span className="h-px w-2 bg-white/20" /> : null}
      </span>
    </div>
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

function NowSeason({ save, C, onGo }: { save: CareerSave; C: CareerCopy; onGo: () => void }) {
  const ended = save.phase === "ended";
  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
        {ended ? C.ceremonies.legacyTitle : C.ceremonies.seasonReview}
      </h2>
      <Button variant="primary" size="lg" className="mt-5 w-full sm:w-auto" onClick={onGo}>
        {C.hub.continue}
      </Button>
    </div>
  );
}

function NowEvent({
  save,
  C,
  D,
  def,
  daysAway,
  primaryLabel,
  onPrimary,
  onAdvanceDay,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  def: CareerEventDef;
  daysAway: number;
  primaryLabel: string;
  onPrimary: () => void;
  onAdvanceDay?: () => void;
}) {
  const fieldRegion =
    def.region ?? (def.tier === "t2" || def.tier === "t3" ? save.identity.region : null);
  const fieldOrgs = Object.values(save.world.orgs).filter(
    (o) => !fieldRegion || o.region === fieldRegion,
  );
  const fieldStars = fieldOrgs.length
    ? fieldOrgs.reduce((s, o) => s + o.stars, 0) / fieldOrgs.length
    : 0;
  const points = maxPointsOf(def.tier);
  const unavailable =
    daysAway === 0 && save.pendingUnavailability && save.pendingUnavailability.eventId === def.id
      ? save.squad.find((p) => p.id === save.pendingUnavailability?.playerId)
      : null;

  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
        {def.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="orange" className={cx(daysAway === 0 && "animate-pulse")}>
          {C.hub.matchdayIn(daysAway)}
        </Badge>
        <TierChip tier={def.tier} />
        {def.region ? <Badge className={REGION_BADGE[def.region]}>{def.region}</Badge> : null}
        <Badge>{formatDateShort(D, dateOfDay(save.clock.seasonIndex, def.day))}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.calendar.prizePool}</p>
          <p className="display text-lg font-bold text-orange-bright">
            {formatMoney(prizePoolOf(def.tier), { compact: true })}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.common.seasonPoints}</p>
          <p className="display text-lg font-bold text-ink">
            {points !== null ? `${points} ${C.standings.ptsShort}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.calendar.fieldQuality}</p>
          <TeamStars stars={Math.round(fieldStars)} size="md" className="mt-1" />
        </div>
      </div>
      <p className="mt-2 text-xs text-faint">
        {def.format === "swiss" ? C.event.formatSwiss : C.event.formatSingle}
      </p>

      {unavailable ? (
        <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {C.event.unavailableNotice(unavailable.name)}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={onPrimary}>
          {primaryLabel}
        </Button>
        {onAdvanceDay ? (
          <Button variant="ghost" size="md" className="min-h-11" onClick={onAdvanceDay}>
            {C.hub.advanceDay}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NowBid({
  save,
  C,
  offer,
  onAccept,
  onDecline,
}: {
  save: CareerSave;
  C: CareerCopy;
  offer: TransferOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const orgName = offer.otherRef ? nameOfRef(save, offer.otherRef) : "?";
  const orgStars = offer.otherRef ? (save.world.orgs[offer.otherRef]?.stars ?? 0) : 0;
  const player = save.squad.find((p) => p.id === offer.playerId);

  return (
    <div>
      {offer.blockbuster ? (
        <Badge tone="gold" className="mb-2">
          {C.market.blockbuster}
        </Badge>
      ) : null}
      <div className="flex items-center gap-3">
        {offer.otherRef ? <OrgMark save={save} orgRef={offer.otherRef} size="lg" /> : null}
        <div className="min-w-0">
          <p className="display truncate text-lg font-bold uppercase tracking-wide text-ink">
            {orgName} <TeamStars stars={orgStars} size="sm" className="ml-1 align-middle" />
          </p>
          <p className="text-xs text-sub">{C.market.bidFrom(orgName)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-line bg-white/[0.03] p-3">
        <div className="min-w-0">
          <p className="display truncate text-xl font-bold text-ink">{offer.playerName}</p>
          {player ? (
            <p className="text-xs text-sub">
              {C.common.ovrShort(Math.round(player.overall))} · {C.player.age(squadAge(save, player))}{" "}
              · {C.player.archetype[player.archetype]}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="kicker text-[9px]">{C.market.fee}</p>
          <p className="display text-2xl font-bold text-orange-bright">
            {formatMoney(offer.fee, { compact: true })}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-faint">{C.market.declineHint}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={onAccept}>
          {C.market.accept}
        </Button>
        <Button variant="danger" size="lg" onClick={onDecline}>
          {C.market.decline}
        </Button>
      </div>
    </div>
  );
}

function NowSponsorChoice({
  C,
  lang,
  offers,
  objectiveText,
  onChoose,
}: {
  C: CareerCopy;
  lang: "en" | "pt";
  offers: SponsorState[];
  objectiveText: (kind: SponsorObjectiveKind) => string;
  onChoose: (sponsorId: string) => void;
}) {
  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink">
        {C.finances.offerTitle}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {offers.map((o) => {
          const brand = sponsorBrandById.get(o.sponsorId);
          return (
            <div
              key={o.sponsorId}
              className="flex flex-col rounded-lg border border-line bg-white/[0.03] p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                  {brand?.name ?? o.sponsorId}
                </p>
                <Badge tone="blue">{C.finances.sponsorTier(o.tier)}</Badge>
              </div>
              {brand ? (
                <p className="mt-1 text-xs italic text-faint">
                  {lang === "pt" ? brand.flavorPt : brand.flavorEn}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold text-good">
                {C.finances.perSplitBase(formatMoney(o.basePerSplit, { compact: true }))}
              </p>
              <p className="text-xs text-sub">
                {C.finances.bonusFor(formatMoney(o.bonus, { compact: true }))}
              </p>
              <p className="mt-1.5 text-xs text-sub">
                {C.finances.sponsorObjective}: {objectiveText(o.objectiveKind)}
              </p>
              <Button
                variant="primary"
                size="md"
                full
                className="mt-3"
                onClick={() => onChoose(o.sponsorId)}
              >
                {C.market.accept}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NowAdvance({
  save,
  C,
  D,
  stop,
  windowDaysLeft,
  onAdvance,
  onAdvanceDay,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  stop: UpcomingStop | null;
  windowDaysLeft: number | null;
  onAdvance: () => void;
  onAdvanceDay: () => void;
}) {
  const clock = clockLabel(save);
  const firstSteps = save.eventResults.length === 0 && save.history.length === 0;

  const stopLabel = stop
    ? stop.kind === "window"
      ? C.calendar.window
      : stop.kind === "seasonEnd"
        ? C.calendar.seasonEnd
        : C.calendar.payday
    : C.calendar.seasonEnd;

  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
        {firstSteps ? C.hub.emptyStateTitle : stopLabel}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stop ? (
          <>
            <Badge tone="blue">
              {formatDateShort(D, stop.date)} · {formatDaysAway(D, stop.daysAway)}
            </Badge>
          </>
        ) : null}
        {clock.windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
      </div>
      {firstSteps ? <p className="mt-3 max-w-md text-sm text-sub">{C.hub.emptyStateBody}</p> : null}
      {clock.windowOpen && windowDaysLeft !== null ? (
        <p className="mt-3 text-xs text-blue-bright">{C.calendar.windowCloses(windowDaysLeft)}</p>
      ) : null}
      {clock.kind === "open" ? (
        <p className="mt-3 text-xs text-good">{C.hub.trainingWeek}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={onAdvance}>
          {C.hub.continueTo(stopLabel)}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={onAdvanceDay}>
          {C.hub.advanceDay}
        </Button>
      </div>
    </div>
  );
}
