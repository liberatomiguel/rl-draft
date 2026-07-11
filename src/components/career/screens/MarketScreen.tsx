"use client";

/**
 * Road to Worlds — the transfer Market (v0.2 rebuild, day clock).
 *
 * Four tabs over the live world: Free agents & Under contract (searchable,
 * sortable PlayerCardTile grids with MEMOIZED ask quotes — the old screen
 * recomputed every ask on every render), Coaches (current staff + the
 * window's shortlist, retired real pros tagged gold) and My deals (incoming
 * AI bids with expiry dates and consequence-first confirms).
 *
 * Signing flow: card → PlayerSheet (scout report stays available between
 * windows) → offer modal with role/length pickers, the "why this price"
 * factor readout and balance/payroll consequences BEFORE commit. Errors
 * surface the store's real lastError via career.market.errors.
 */

import { useMemo, useState } from "react";
import { CAREER_LOAN, CAREER_SCOUT, CAREER_UNLOCKS } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/copy.career.en";
import { repNeededForOverall, signableOverallCap } from "@/engine/career/economy";
import type {
  CareerPlayerView,
  PotentialBand,
  TransferOffer,
} from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { coachCandidatesFor, negotiationTriesFor } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import { OrgSheet } from "@/components/career/OrgSheet";
import { SalaryNegotiator } from "@/components/career/SalaryNegotiator";
import {
  askPackageFor,
  dateOfDay,
  daysUntilWindowCloses,
  isWindowWeek,
  listingFor,
  nameOfRef,
  potBandOfView,
  statsFromView,
  upcomingStops,
  useCareerSave,
  weekOfDay,
} from "@/components/career/careerUi";
import { formatDateTiny, formatDaysAway } from "@/components/career/dateText";
import { OrgMark } from "@/components/career/OrgMark";
import { PlayerCardTile } from "@/components/career/PlayerCardTile";
import { PlayerSheet } from "@/components/career/PlayerSheet";
import { TeamStars } from "@/components/career/TeamStars";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";

type Tab = "free" | "contracted" | "coaches" | "deals";
type SortKey = "ovr" | "age" | "price" | "pot";

const PAGE = 24;
const REGIONS = Object.keys(REGION_BADGE) as Region[];

interface MarketRow {
  view: CareerPlayerView;
  orgRef: string | null;
  splitsRemaining: number | null;
  /** Headline price: transfer fee when contracted, wage/split when free. */
  price: number;
  salary: number;
  band: PotentialBand;
}

// ---------------------------------------------------------------------------
// lastError → the REAL career.market.errors string (dismissible)
// ---------------------------------------------------------------------------

function errorTextFor(C: CareerCopy, key: string): string {
  return (C.market.errors as Record<string, string>)[key] ?? C.market.errors.unknown;
}

function MarketErrorNotice({ className }: { className?: string }) {
  const C = useCopy().CAREER;
  const lastError = useCareerStore((s) => s.lastError);
  const clearError = useCareerStore((s) => s.clearError);
  if (!lastError) return null;
  return (
    <div
      role="alert"
      className={cx(
        "flex items-center justify-between gap-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2",
        className,
      )}
    >
      <span className="text-sm text-bad">{errorTextFor(C, lastError)}</span>
      <button
        type="button"
        onClick={clearError}
        aria-label={C.common.close}
        className="shrink-0 rounded-md p-1.5 text-bad transition-colors hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar chip (tabs, sort, region filter)
// ---------------------------------------------------------------------------

function Chip({
  active,
  onClick,
  className,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  activeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "display inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
        active
          ? (activeClass ?? "border-blue/50 bg-blue/15 text-blue-bright")
          : "border-line-strong bg-white/5 text-sub hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function MarketScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = t.CAREER;
  const D = C.dates;

  const signPlayer = useCareerStore((s) => s.signPlayer);
  const acceptBid = useCareerStore((s) => s.acceptBid);
  const declineBid = useCareerStore((s) => s.declineBid);
  const hireCoach = useCareerStore((s) => s.hireCoach);
  const fireCoach = useCareerStore((s) => s.fireCoach);
  const buyScoutReport = useCareerStore((s) => s.buyScoutReport);

  const [tab, setTab] = useState<Tab>("free");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("ovr");
  /** v0.3: flips the current sort key's natural direction. */
  const [sortFlip, setSortFlip] = useState(false);
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const [target, setTarget] = useState<MarketRow | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [role, setRole] = useState<"starter" | "sub">("starter");
  const [len, setLen] = useState<1 | 2 | 3>(2);
  /** v0.3 wage talk — the counter-offer on the table (0 = full ask). */
  const [offered, setOffered] = useState(0);
  const [confirmBid, setConfirmBid] = useState<TransferOffer | null>(null);
  const [confirmFire, setConfirmFire] = useState(false);
  /** v0.3 org sheet (deals tab — inspect the bidder's roster). */
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  // Render-phase pagination reset so filter switches never carry a stale page.
  const filterSig = `${tab}|${search}|${sort}|${sortFlip}|${regionFilter}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (filterSig !== prevSig) {
    setPrevSig(filterSig);
    setShown(PAGE);
  }

  // The counter-offer resets to the fresh ask whenever the quote changes.
  const offerSig = `${target?.view.id ?? ""}|${role}|${len}`;
  const [prevOfferSig, setPrevOfferSig] = useState(offerSig);
  if (offerSig !== prevOfferSig) {
    setPrevOfferSig(offerSig);
    setOffered(0);
  }

  // --- listing: only recomputed when the world/squad actually changes -------
  const squadKey = save?.squad.map((p) => p.id).join(",") ?? "";
  const listing = useMemo(() => {
    if (!save) return { freeAgents: [], contracted: [] };
    return listingFor({
      world: save.world,
      squadIds: save.squad.map((p) => p.id),
      seasonIndex: save.clock.seasonIndex,
      careerSeed: save.careerSeed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.world.version, save?.clock.seasonIndex, save?.careerSeed, squadKey]);

  // --- ask quotes + scouted bands, memoized per card (NOT per render) --------
  const rows: MarketRow[] = useMemo(() => {
    if (!save) return [];
    const quote = (
      view: CareerPlayerView,
      orgRef: string | null,
      splitsRemaining: number | null,
    ): MarketRow => {
      const pack = askPackageFor(view, {
        rep: save.reputation,
        seasonIndex: save.clock.seasonIndex,
        difficulty: save.difficulty,
        careerSeed: save.careerSeed,
        role: "starter",
        lengthSeasons: 2,
        contracted: splitsRemaining !== null ? { splitsRemaining } : undefined,
      });
      return {
        view,
        orgRef,
        splitsRemaining,
        price: orgRef ? pack.fee : pack.salaryPerSplit,
        salary: pack.salaryPerSplit,
        band: potBandOfView(save, view),
      };
    };
    return tab === "contracted"
      ? listing.contracted.map((c) => quote(c.view, c.orgRef, c.splitsRemaining))
      : listing.freeAgents.map((v) => quote(v, null, null));
  }, [listing, tab, save]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (q) out = out.filter((r) => r.view.name.toLowerCase().includes(q));
    if (regionFilter !== "all") out = out.filter((r) => r.view.region === regionFilter);
    const sorted = [...out];
    switch (sort) {
      case "ovr":
        sorted.sort((a, b) => b.view.overall - a.view.overall);
        break;
      case "age":
        sorted.sort((a, b) => a.view.age - b.view.age || b.view.overall - a.view.overall);
        break;
      case "price":
        sorted.sort((a, b) => a.price - b.price || b.view.overall - a.view.overall);
        break;
      case "pot":
        sorted.sort((a, b) => b.band.max - a.band.max || b.view.overall - a.view.overall);
        break;
    }
    // v0.3: the direction toggle flips whatever the key's natural order is.
    if (sortFlip) sorted.reverse();
    return sorted;
  }, [rows, search, regionFilter, sort, sortFlip]);

  const coaches = useMemo(() => (save ? coachCandidatesFor(save) : []), [save]);

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        <div className="h-12 w-64 animate-pulse rounded-xl bg-white/5" />
        <div className="h-10 animate-pulse rounded-xl bg-white/5" />
        <div className="h-16 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  // --- window state ----------------------------------------------------------
  const windowOpen = isWindowWeek(weekOfDay(save.clock.day));
  const closesIn = daysUntilWindowCloses(save);
  // v0.3 visible signing gate (new signings only; renewals/squad exempt).
  const signableCap = signableOverallCap(save.reputation);
  const targetLocked = target ? Math.round(target.view.overall) > signableCap : false;
  const nextWindowStop = windowOpen
    ? null
    : (upcomingStops(save, 12).find((s) => s.kind === "window") ?? null);

  // --- squad & money context ---------------------------------------------------
  const payroll =
    save.squad.reduce((s, p) => s + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0);
  const starterCount = save.squad.filter((p) => p.role === "starter").length;
  const subCount = save.squad.filter((p) => p.role === "sub").length;

  // --- deals ------------------------------------------------------------------
  const bids = save.pendingOffers.filter(
    (o) => o.status === "pending" && o.direction === "out",
  );

  // --- live offer package (single target — cheap, always fresh) ---------------
  const pack = target
    ? askPackageFor(target.view, {
        rep: save.reputation,
        seasonIndex: save.clock.seasonIndex,
        difficulty: save.difficulty,
        careerSeed: save.careerSeed,
        role,
        lengthSeasons: len,
        contracted:
          target.splitsRemaining !== null
            ? { splitsRemaining: target.splitsRemaining }
            : undefined,
      })
    : null;
  const cost = pack ? pack.fee + pack.signingBonus : 0;
  const balanceAfter = save.finances.balance - cost;
  const roleBlocked = role === "starter" ? starterCount >= 3 : subCount >= 1;
  const loanBlocked = Boolean(save.finances.loan) && (pack?.fee ?? 0) > 0;
  const fundsBlocked = balanceAfter < CAREER_LOAN.floor;
  const blockReason = !windowOpen
    ? C.market.errors.windowClosed
    : targetLocked
      ? C.market.errors.repGate
      : roleBlocked
        ? C.market.squadFullWarning
        : loanBlocked
          ? C.market.errors.loanActive
          : fundsBlocked
            ? C.market.errors.funds
            : null;
  // v0.3 wage talk — the live proposal (0 = pay the ask) + hardened count.
  const askNow = pack?.salaryPerSplit ?? 0;
  const proposal = offered > 0 ? Math.min(offered, askNow) : askNow;
  const targetRejects = target ? negotiationTriesFor(save, target.view.id) : 0;
  const backerRisk =
    pack !== null && !blockReason && balanceAfter < CAREER_LOAN.floor + pack.salaryPerSplit;
  const targetBand = target ? potBandOfView(save, target.view) : null;

  const confirmSoldSalary = confirmBid
    ? (save.squad.find((p) => p.id === confirmBid.playerId)?.salaryPerSplit ?? 0)
    : 0;

  const factorLabel = (key: string): string =>
    (C.market.factor as Record<string, string>)[key] ?? key;

  const tabs: [Tab, string][] = [
    ["free", C.market.freeAgents],
    ["contracted", C.market.contracted],
    ["coaches", C.market.coaches],
    ["deals", C.market.myDeals],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.market.title}
        className="rise-in"
        right={
          windowOpen ? (
            <Badge tone="good">
              {closesIn !== null ? C.calendar.windowCloses(closesIn) : C.calendar.windowOpen}
            </Badge>
          ) : (
            <Badge tone="neutral">{C.market.windowClosed}</Badge>
          )
        }
      />

      <MarketErrorNotice className="rise-in" />

      {!windowOpen ? (
        <Panel className="rise-in flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-xs text-sub">{C.market.scoutingOpen}</span>
          {nextWindowStop ? (
            <span className="text-xs font-semibold text-blue-bright">
              {C.market.windowClosedHint(formatDaysAway(D, nextWindowStop.daysAway))}
            </span>
          ) : null}
        </Panel>
      ) : null}

      {/* Tabs */}
      <div className="rise-in flex flex-wrap gap-2" style={{ animationDelay: "40ms" }}>
        {tabs.map(([k, label]) => (
          <Chip
            key={k}
            active={tab === k}
            onClick={() => setTab(k)}
            className="min-h-10 px-3.5 text-[11px]"
          >
            {label}
            {k === "deals" && bids.length > 0 ? (
              <span className="rounded-full bg-orange/20 px-1.5 py-px font-mono text-[10px] normal-case tracking-normal text-orange-bright">
                {bids.length}
              </span>
            ) : null}
          </Chip>
        ))}
      </div>

      {/* ================= player tabs ================= */}
      {tab === "free" || tab === "contracted" ? (
        <>
          {/* Toolbar: search · sort · region */}
          <Panel className="rise-in space-y-2.5 p-3" style={{ animationDelay: "60ms" }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={C.market.searchPlaceholder}
              className="w-full rounded-lg border border-line-strong bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-blue/60 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="kicker mr-1 text-[9px]">{C.market.sortBy}</span>
                {(
                  [
                    ["ovr", C.market.sortOvr],
                    ["age", C.market.sortAge],
                    ["price", C.market.sortPrice],
                    ["pot", C.market.sortPot],
                  ] as [SortKey, string][]
                ).map(([k, label]) => (
                  <Chip key={k} active={sort === k} onClick={() => setSort(k)}>
                    {label}
                  </Chip>
                ))}
                <Chip
                  active={sortFlip}
                  onClick={() => setSortFlip((f) => !f)}
                  className="font-mono"
                >
                  <span title={sortFlip ? C.market.sortAsc : C.market.sortDesc}>
                    {sortFlip ? "↑" : "↓"}
                  </span>
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="kicker mr-1 text-[9px]">{C.market.filterRegion}</span>
                <Chip active={regionFilter === "all"} onClick={() => setRegionFilter("all")}>
                  {C.market.allRegions}
                </Chip>
                {REGIONS.map((r) => (
                  <Chip
                    key={r}
                    active={regionFilter === r}
                    onClick={() => setRegionFilter(r)}
                    activeClass={REGION_BADGE[r]}
                  >
                    {r}
                  </Chip>
                ))}
              </div>
            </div>
          </Panel>

          {visible.length === 0 ? (
            <Panel className="rise-in p-8 text-center text-sm text-faint">
              {C.market.noResults}
            </Panel>
          ) : (
            <>
              <div
                className="rise-in grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
                style={{ animationDelay: "80ms" }}
              >
                {visible.slice(0, shown).map((r) => {
                  // v0.3 visible signing gate: over-cap players stay browsable
                  // but read as locked, with the rep that opens the door.
                  const locked = Math.round(r.view.overall) > signableCap;
                  const tile = (
                    <PlayerCardTile
                      key={locked ? undefined : r.view.id}
                      name={r.view.name}
                      overall={r.view.overall}
                      age={r.view.age}
                      band={r.band}
                      archetype={r.view.archetype}
                      country={r.view.country}
                      region={r.view.region}
                      onClick={() => {
                        setTarget(r);
                        setOfferOpen(false);
                        setRole("starter");
                        setLen(2);
                      }}
                      footer={
                        <div className="flex items-center justify-between gap-2">
                          {r.orgRef ? (
                            <span className="flex min-w-0 items-center gap-1.5 text-faint">
                              <OrgMark save={save} orgRef={r.orgRef} size="xs" />
                              <span className="truncate">{nameOfRef(save, r.orgRef)}</span>
                            </span>
                          ) : (
                            <span className="display text-[10px] font-bold uppercase tracking-[0.12em] text-good">
                              {C.market.freeAgentTag}
                            </span>
                          )}
                          <span className="shrink-0 font-semibold text-ink">
                            {r.orgRef
                              ? formatMoney(r.price, { compact: true })
                              : C.squad.perSplit(formatMoney(r.salary, { compact: true }))}
                          </span>
                        </div>
                      }
                    />
                  );
                  if (!locked) return tile;
                  return (
                    <div key={r.view.id} className="relative">
                      <div className="opacity-60 saturate-50">{tile}</div>
                      <span
                        className="pointer-events-none absolute right-2 top-2 rounded-md border border-line-strong bg-[color:var(--bg)]/90 px-2 py-0.5 text-[10px] font-bold text-sub"
                        title={C.market.lockedHint}
                      >
                        🔒 {C.market.lockedAtRep(repNeededForOverall(Math.round(r.view.overall)))}
                      </span>
                    </div>
                  );
                })}
              </div>
              {visible.length > shown ? (
                <div className="text-center">
                  <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
                    +{Math.min(PAGE, visible.length - shown)}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {/* ================= coaches tab ================= */}
      {tab === "coaches" && save.reputation < CAREER_UNLOCKS.coachRep ? (
        // v0.3: a coach is earned — the tab stays visible, the door is locked.
        <Panel className="rise-in p-8 text-center" style={{ animationDelay: "60ms" }}>
          <p className="display text-lg font-bold text-ink">🔒</p>
          <p className="mt-2 text-sm font-semibold text-sub">
            {C.market.coachLockedAt(CAREER_UNLOCKS.coachRep)}
          </p>
          <p className="mt-1 text-xs text-faint">
            {C.finances.lockedAtRep(CAREER_UNLOCKS.coachRep)} · {C.common.rep}:{" "}
            {Math.round(save.reputation)}
          </p>
        </Panel>
      ) : null}
      {tab === "coaches" && save.reputation >= CAREER_UNLOCKS.coachRep ? (
        <div className="rise-in space-y-4" style={{ animationDelay: "60ms" }}>
          {save.coach ? (
            <Panel strong className="p-4">
              <p className="kicker mb-2 text-[10px]">{C.market.currentCoach}</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="display truncate text-lg font-bold text-ink">
                      {save.coach.name}
                    </span>
                    {save.coach.source === "real" ? (
                      <Badge tone="gold">{C.market.coachRealTag}</Badge>
                    ) : (
                      <Badge tone="neutral">{C.market.coachGenTag}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-sub">
                    {C.market.coachBonus(t.STAT_LABELS[save.coach.bonusType])}{" "}
                    <span className="font-mono font-bold text-cyan">{save.coach.bonusLevel}</span>
                    <span className="mx-1.5 text-faint">·</span>
                    {C.squad.perSplit(formatMoney(save.coach.salaryPerSplit, { compact: true }))}
                  </p>
                </div>
                <div className="text-right leading-none">
                  <div className="display text-3xl font-bold text-ink">{save.coach.overall}</div>
                  <div className="kicker text-[9px] text-faint">{C.common.ovr}</div>
                </div>
                <Button variant="danger" size="sm" onClick={() => setConfirmFire(true)}>
                  {C.finances.dropLabel}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-faint">{C.market.replaceWarning}</p>
            </Panel>
          ) : null}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => (
              <div
                key={c.id}
                className="flex flex-col rounded-xl border border-line-strong bg-gradient-to-b from-white/[0.04] to-transparent p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="display truncate text-base font-bold text-ink">{c.name}</div>
                    <div className="mt-1">
                      {c.source === "real" ? (
                        <Badge tone="gold">{C.market.coachRealTag}</Badge>
                      ) : (
                        <Badge tone="neutral">{C.market.coachGenTag}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right leading-none">
                    <div className="display text-2xl font-bold text-ink">{c.overall}</div>
                    <div className="kicker text-[9px] text-faint">{C.common.ovr}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-sub">
                  {C.market.coachBonus(t.STAT_LABELS[c.bonusType])}{" "}
                  <span className="font-mono font-bold text-cyan">{c.bonusLevel}</span>
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {C.squad.perSplit(formatMoney(c.salaryPerSplit, { compact: true }))}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  full
                  className="mt-3"
                  disabled={save.coach?.id === c.id}
                  onClick={() => hireCoach(c)}
                >
                  {C.market.hireCoach}
                </Button>
              </div>
            ))}
          </div>
          {save.coach ? (
            <p className="text-center text-[11px] text-faint">{C.market.replaceWarning}</p>
          ) : null}
        </div>
      ) : null}

      {/* ================= my deals tab ================= */}
      {tab === "deals" ? (
        <div className="rise-in space-y-2.5" style={{ animationDelay: "60ms" }}>
          {bids.length === 0 ? (
            <Panel className="p-8 text-center text-sm text-faint">{C.market.dealsEmpty}</Panel>
          ) : (
            <>
              {bids.map((o) => {
                const orgName = o.otherRef ? nameOfRef(save, o.otherRef) : "?";
                const orgStars = o.otherRef ? (save.world.orgs[o.otherRef]?.stars ?? 0) : 0;
                const daysLeft = Math.max(0, o.resolveDay - save.clock.day);
                return (
                  <Panel key={o.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {o.otherRef ? (
                        <button
                          type="button"
                          title={C.orgSheet.viewTeam}
                          onClick={() => setSheetRef(o.otherRef!)}
                          className="shrink-0 rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
                        >
                          <OrgMark save={save} orgRef={o.otherRef} size="md" />
                        </button>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="display truncate text-base font-bold text-ink">
                            {o.playerName}
                          </span>
                          {o.blockbuster ? (
                            <Badge tone="gold">{C.market.blockbuster}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-sub">
                          {o.otherRef ? (
                            <button
                              type="button"
                              className="font-semibold text-cyan hover:underline"
                              onClick={() => setSheetRef(o.otherRef!)}
                            >
                              {C.market.bidFrom(orgName)}
                            </button>
                          ) : (
                            C.market.bidFrom(orgName)
                          )}
                          <TeamStars stars={orgStars} size="xs" />
                        </p>
                        <p className="mt-1 text-[10px] text-faint">
                          {formatDateTiny(D, dateOfDay(o.resolveSeason, o.resolveDay))}
                          <span className="mx-1">·</span>
                          {D.daysShort(daysLeft)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="kicker text-[9px]">{C.market.fee}</p>
                        <p className="display text-xl font-bold text-orange-bright">
                          {formatMoney(o.fee, { compact: true })}
                        </p>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => setConfirmBid(o)}
                        >
                          {C.market.accept}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => declineBid(o.id)}
                        >
                          {C.market.decline}
                        </Button>
                      </div>
                    </div>
                  </Panel>
                );
              })}
              <p className="text-center text-[11px] text-faint">{C.market.declineHint}</p>
            </>
          )}
        </div>
      ) : null}

      {/* ================= player sheet (browse/scout, sign entry) ================= */}
      <PlayerSheet
        data={
          target && !offerOpen
            ? {
                name: target.view.name,
                overall: target.view.overall,
                age: target.view.age,
                archetype: target.view.archetype,
                country: target.view.country,
                region: target.view.region,
                band: targetBand ?? { min: 60, max: 99, level: 0 },
                stats: statsFromView(target.view),
              }
            : null
        }
        onClose={() => setTarget(null)}
        actions={
          target ? (
            <>
              {targetBand && targetBand.level < CAREER_SCOUT.reportMaxLevel ? (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => buyScoutReport(target.view.id)}
                  title={C.player.scoutHint}
                >
                  {C.player.scoutCost(formatMoney(CAREER_SCOUT.reportCost, { compact: true }))}
                </Button>
              ) : (
                <Badge tone="blue" className="self-center">
                  {C.player.scoutDone}
                </Badge>
              )}
              {targetLocked ? (
                <span className="self-center" title={C.market.lockedHint}>
                  <Badge tone="neutral">
                    🔒{" "}
                    {C.market.lockedAtRep(
                      repNeededForOverall(Math.round(target.view.overall)),
                    )}
                  </Badge>
                </span>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  disabled={!windowOpen}
                  title={windowOpen ? undefined : C.market.windowClosed}
                  onClick={() => setOfferOpen(true)}
                >
                  {C.market.signCta}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {/* ================= offer modal ================= */}
      <Modal
        open={Boolean(target) && offerOpen}
        onClose={() => setOfferOpen(false)}
        title={target?.view.name ?? ""}
        wide
        actions={
          <>
            <Button variant="ghost" onClick={() => setOfferOpen(false)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="primary"
              disabled={Boolean(blockReason)}
              onClick={() => {
                if (!target) return;
                signPlayer(
                  target.view.id,
                  role,
                  len,
                  proposal < askNow ? proposal : undefined,
                );
                // A rejected counter keeps the modal open — the negotiator
                // re-reads the hardened tries count from the persisted save.
                if (!useCareerStore.getState().lastError) {
                  setOfferOpen(false);
                  setTarget(null);
                }
              }}
            >
              {C.market.signCta}
            </Button>
          </>
        }
      >
        {target && pack ? (
          <div className="space-y-4">
            <MarketErrorNotice />

            {/* Role + length pickers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="kicker mb-1.5 text-[10px]">{C.market.roleLabel}</p>
                <div className="flex gap-1.5">
                  {(["starter", "sub"] as const).map((r) => (
                    <Chip
                      key={r}
                      active={role === r}
                      onClick={() => setRole(r)}
                      activeClass="border-orange/50 bg-orange/15 text-orange-bright"
                      className="flex-1 justify-center"
                    >
                      {r === "starter" ? C.market.starter : C.market.sub}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="kicker mb-1.5 text-[10px]">{C.market.lengthLabel}</p>
                <div className="flex gap-1.5">
                  {([1, 2, 3] as const).map((l) => (
                    <Chip
                      key={l}
                      active={len === l}
                      onClick={() => setLen(l)}
                      className="flex-1 justify-center"
                    >
                      {C.market.seasons(l)}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            {/* Asking terms */}
            <div className="rounded-lg border border-line-strong bg-white/[0.03] p-3">
              <p className="kicker mb-2 text-[10px]">{C.market.ask}</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sub">{C.squad.wage}</span>
                  <span className="display font-bold text-ink">
                    {C.squad.perSplit(formatMoney(pack.salaryPerSplit))}
                  </span>
                </div>
                {target.orgRef ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sub">{C.market.fee}</span>
                    <span className="display font-bold text-orange-bright">
                      {formatMoney(pack.fee)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sub">{C.market.signingBonus}</span>
                    <span className="display font-bold text-ink">
                      {formatMoney(pack.signingBonus)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* v0.3 wage talk — counter below the ask, honest odds shown */}
            <SalaryNegotiator
              ask={askNow}
              offered={proposal}
              onChange={setOffered}
              rejects={targetRejects}
              disabled={Boolean(blockReason)}
            />

            {/* Why this price */}
            <div className="rounded-lg border border-line bg-white/[0.02] p-3">
              <p className="kicker mb-2 text-[10px]">{C.market.whyPrice}</p>
              <div className="space-y-1">
                {pack.factors.map((f) => (
                  <div key={f.key} className="flex items-center justify-between text-xs">
                    <span className="text-sub">{factorLabel(f.key)}</span>
                    <span
                      className={cx(
                        "font-semibold",
                        f.key === "overall"
                          ? "text-ink"
                          : f.delta >= 0
                            ? "text-bad"
                            : "text-good",
                      )}
                    >
                      {f.key === "overall"
                        ? formatMoney(f.delta, { compact: true })
                        : formatMoneyDelta(f.delta, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consequences */}
            <div className="rounded-lg border border-line-strong bg-white/[0.03] p-3 text-sm">
              <p className="kicker mb-2 text-[10px]">{C.market.consequences}</p>
              <p className={cx("font-semibold", balanceAfter < 0 ? "text-bad" : "text-ink")}>
                {C.market.balanceAfter(formatMoney(balanceAfter))}
              </p>
              <p className="mt-0.5 font-semibold text-ink">
                {C.market.wageAfter(formatMoney(payroll + proposal))}
              </p>
              {backerRisk ? (
                <p className="mt-2 rounded-md border border-orange/40 bg-orange/10 px-2.5 py-1.5 text-xs font-semibold text-orange-bright">
                  {C.finances.backerWarning}
                </p>
              ) : null}
              {blockReason ? (
                <p className="mt-2 rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs font-semibold text-bad">
                  {blockReason}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ================= accept-bid confirm ================= */}
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
              {C.market.bidFrom(confirmBid.otherRef ? nameOfRef(save, confirmBid.otherRef) : "?")}{" "}
              — {confirmBid.playerName} · {formatMoney(confirmBid.fee)}
            </p>
            <p className="kicker text-[10px]">{C.market.consequences}</p>
            <p className="font-semibold text-good">
              {C.market.balanceAfter(formatMoney(save.finances.balance + confirmBid.fee))}
            </p>
            <p>{C.market.wageAfter(formatMoney(payroll - confirmSoldSalary))}</p>
          </div>
        ) : null}
      </Modal>

      {/* ================= fire-coach confirm ================= */}
      <Modal
        open={confirmFire && Boolean(save.coach)}
        title={C.market.currentCoach}
        onClose={() => setConfirmFire(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmFire(false)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                fireCoach();
                setConfirmFire(false);
              }}
            >
              {C.common.confirm}
            </Button>
          </>
        }
      >
        {save.coach ? (
          <div className="space-y-2">
            <p className="text-ink">{save.coach.name}</p>
            <p className="font-semibold text-bad">
              {C.squad.releaseFee(formatMoney(save.coach.salaryPerSplit))}
            </p>
            <p>
              {C.market.balanceAfter(
                formatMoney(save.finances.balance - save.coach.salaryPerSplit),
              )}
            </p>
            <p className="text-xs text-faint">{C.market.replaceWarning}</p>
          </div>
        ) : null}
      </Modal>

      {/* v0.3 — the bidder's roster, one tap away */}
      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </div>
  );
}
