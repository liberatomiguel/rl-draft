"use client";

/**
 * Road to Worlds — Finances (v0.2 rebuild): the org's financial dashboard.
 *
 * Statement tiles (balance + sparkline · net/split · projected) computed from
 * balance constants only, the GEAR LADDER as the progression centerpiece
 * (7 steps: peripherals → monitors → PCs → bootcamp T1 → bootcamp T2 →
 * psychologist → Performance Center, unlocked by rep, bought in order, sponsor
 * perks discounting), the sponsor desk (active deal with objective/patience/
 * perks + season offers), the date-grouped ledger and the Emergency Backer
 * panel. Every gate and price reads from CAREER_* constants — zero literals.
 */

import { useState } from "react";
import { CAREER_ECONOMY, CAREER_LOAN, CAREER_SPONSOR } from "@/config/balance";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { sponsorBrandById } from "@/data/career/sponsors";
import { gearUpkeepPerSplit, quantize } from "@/engine/career/economy";
import type {
  LedgerEntry,
  SponsorObjectiveKind,
  SponsorState,
} from "@/engine/career/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import {
  CAREER_GEAR,
  bootcampTierFor,
  dateOfDay,
  gearNextItem,
  gearPriceFor,
  seasonLabelFor,
  useCareerSave,
} from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

type LedgerFilter = "all" | "in" | "out";
type StepStatus = "owned" | "next" | "locked";

// ---------------------------------------------------------------------------
// lastError → the REAL career.market.errors string (dismissible)
// ---------------------------------------------------------------------------

function errorTextFor(C: CareerCopy, key: string): string {
  return (C.market.errors as Record<string, string>)[key] ?? C.market.errors.unknown;
}

function FinanceErrorNotice({ className }: { className?: string }) {
  const C = useCareerCopy();
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
// Emergency Backer pay-down (v0.3): amount stepper + pay / pay-it-all
// ---------------------------------------------------------------------------

function BackerPayDown({ remaining, balance }: { remaining: number; balance: number }) {
  const C = useCareerCopy();
  const payDebt = useCareerStore((s) => s.payDebt);
  const [raw, setRaw] = useState<number | null>(null);

  const payMin = CAREER_ECONOMY.roundQuantum;
  const step = Math.max(payMin, quantize(remaining / 10));
  const maxPay = Math.min(remaining, quantize(balance - CAREER_LOAN.floor));
  const canPay = maxPay >= payMin;
  const clamp = (n: number) => Math.min(Math.max(n, payMin), Math.max(payMin, maxPay));
  const amount = clamp(raw ?? step);
  const canPayAll = balance - remaining >= CAREER_LOAN.floor;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="-"
          className="h-11 w-11 shrink-0 rounded-lg border border-line text-lg font-bold text-sub transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setRaw(clamp(amount - step))}
          disabled={!canPay || amount - step < payMin}
        >
          −
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="display text-lg font-bold tabular-nums text-ink">{formatMoney(amount)}</p>
          <p className="text-[10px] text-faint">{C.finances.payDebtAmount}</p>
        </div>
        <button
          type="button"
          aria-label="+"
          className="h-11 w-11 shrink-0 rounded-lg border border-line text-lg font-bold text-sub transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setRaw(clamp(amount + step))}
          disabled={!canPay || amount >= maxPay}
        >
          +
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={!canPay} onClick={() => payDebt(amount)}>
          {C.finances.payDebt}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canPayAll}
          onClick={() => payDebt(remaining)}
        >
          {C.finances.payDebtAll(formatMoney(remaining))}
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-faint">{C.finances.payDebtHint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balance sparkline (running balance reconstructed from the ledger tail)
// ---------------------------------------------------------------------------

const SPARK_POINTS = 40;

function BalanceSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = Math.max(1, max - min);
  const pts = data
    .map(
      (v, i) =>
        `${((i / (data.length - 1)) * w).toFixed(2)},${(h - ((v - min) / span) * h).toFixed(2)}`,
    )
    .join(" ");
  const zeroY = h - ((0 - min) / span) * h;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-9 w-full text-cyan"
      aria-hidden
    >
      {min < 0 ? (
        <line
          x1="0"
          y1={zeroY}
          x2={w}
          y2={zeroY}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Gear ladder step (timeline node + card)
// ---------------------------------------------------------------------------

function StepNode({ status }: { status: StepStatus }) {
  return (
    <span
      aria-hidden
      className={cx(
        "absolute left-0 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2",
        status === "owned" && "border-orange bg-orange/20 text-orange-bright",
        status === "next" && "border-orange bg-orange/10 text-orange-bright",
        status === "locked" && "border-line-strong bg-white/5 text-faint",
      )}
    >
      {status === "owned" ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : status === "next" ? (
        <span className="h-2 w-2 animate-pulse rounded-full bg-orange" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
    </span>
  );
}

function LadderStep({
  status,
  title,
  desc,
  badges,
  aside,
  notes,
  last,
}: {
  status: StepStatus;
  title: string;
  desc: string;
  badges?: React.ReactNode;
  aside?: React.ReactNode;
  notes?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className={cx("relative pl-10", !last && "pb-3")}>
      {!last ? (
        <span
          aria-hidden
          className={cx(
            "absolute left-[11px] top-7 h-[calc(100%-20px)] w-0.5 rounded",
            status === "owned" ? "bg-orange/50" : "bg-line",
          )}
        />
      ) : null}
      <StepNode status={status} />
      <div
        className={cx(
          "rounded-lg border p-3 transition-colors",
          status === "owned" && "border-orange/40 bg-orange/[0.05]",
          status === "next" &&
            "border-orange/60 bg-white/[0.03] shadow-[0_0_20px_-8px_rgba(249,115,22,0.55)]",
          status === "locked" && "border-line bg-white/[0.02] opacity-70",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="display text-sm font-bold uppercase tracking-wide text-ink">
                {title}
              </span>
              {badges}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-sub">{desc}</p>
            {notes}
          </div>
          {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
        </div>
      </div>
    </li>
  );
}

/** Price tag with the base struck through when a sponsor perk discounts it. */
function PriceTag({ base, price }: { base: number; price: number }) {
  if (price >= base) return null;
  return <s className="text-xs text-faint">{formatMoney(base, { compact: true })}</s>;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function FinancesScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const D = C.dates;
  const lang = useSettings((s) => s.lang);

  const buyGear = useCareerStore((s) => s.buyGear);
  const setPsychologist = useCareerStore((s) => s.setPsychologist);
  const runBootcamp = useCareerStore((s) => s.runBootcamp);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);

  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        <div className="h-12 w-64 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="h-[32rem] animate-pulse rounded-2xl bg-white/5 lg:col-span-3" />
          <div className="space-y-4 lg:col-span-2">
            <div className="h-56 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const fin = save.finances;
  const gear = fin.gear;
  const rep = save.reputation;
  const sponsorTier = save.sponsor?.tier ?? null;

  // --- statement (balance constants ONLY — mirrors the splitPayday funnel) ---
  const income =
    (save.sponsor?.basePerSplit ?? 0) + quantize(rep * CAREER_ECONOMY.passivePerRepPoint);
  const squadWages = save.squad.reduce((s, p) => s + p.salaryPerSplit, 0);
  const expenses =
    squadWages +
    (save.coach?.salaryPerSplit ?? 0) +
    (gear.psychologist ? CAREER_GEAR.psychologistPerSplit : 0) +
    gearUpkeepPerSplit(gear);
  const net = income - expenses;
  const projected = fin.balance + net;

  // --- sparkline series: running balance reconstructed backwards ------------
  const sparkSeries: number[] = [];
  {
    let bal = fin.balance;
    const after: number[] = new Array<number>(fin.ledger.length);
    for (let i = fin.ledger.length - 1; i >= 0; i--) {
      after[i] = bal;
      bal -= fin.ledger[i].amount;
    }
    sparkSeries.push(bal, ...after);
  }
  const sparkTail = sparkSeries.slice(-SPARK_POINTS);

  // --- gear ladder state ------------------------------------------------------
  const nextGear = gearNextItem(gear);
  const bootTier = bootcampTierFor(rep);
  const freeAllowance = save.sponsor
    ? CAREER_SPONSOR.tiers[save.sponsor.tier - 1].freeBootcampsPerSeason
    : 0;
  const freeLeft = Math.max(0, freeAllowance - fin.freeBootcampsUsedThisSeason);
  const [gearFront, perfCenter] = [CAREER_GEAR.items.slice(0, 3), CAREER_GEAR.items[3]];

  const gearStatus = (item: (typeof CAREER_GEAR.items)[number]): StepStatus =>
    gear[item.id] ? "owned" : nextGear?.id === item.id && rep >= item.repGate ? "next" : "locked";

  const gearAside = (item: (typeof CAREER_GEAR.items)[number]): React.ReactNode => {
    const status = gearStatus(item);
    const price = gearPriceFor(item.cost, sponsorTier);
    if (status === "owned") return null;
    if (status === "next") {
      return (
        <>
          <PriceTag base={item.cost} price={price} />
          <Button variant="primary" size="sm" onClick={() => buyGear(item.id)}>
            {C.finances.buy} · {formatMoney(price, { compact: true })}
          </Button>
        </>
      );
    }
    return <span className="text-xs text-faint">{formatMoney(price, { compact: true })}</span>;
  };

  const gearNotes = (item: (typeof CAREER_GEAR.items)[number]): React.ReactNode => {
    const status = gearStatus(item);
    return (
      <>
        {item.upkeepPerSplit > 0 ? (
          <p className="mt-1 text-[10px] text-faint">
            {C.finances.upkeepLabel(formatMoney(item.upkeepPerSplit, { compact: true }))}
          </p>
        ) : null}
        {status === "locked" ? (
          <p className="mt-1 text-[10px] font-semibold text-faint">
            {rep < item.repGate ? C.finances.lockedAtRep(item.repGate) : C.common.locked}
          </p>
        ) : null}
      </>
    );
  };

  const bootcampStep = (tier: 1 | 2, last = false): React.ReactNode => {
    const def = CAREER_GEAR.bootcamp[tier - 1];
    const unlocked = rep >= def.repGate;
    const isActiveTier = bootTier === tier;
    const superseded = bootTier > tier;
    const status: StepStatus = superseded ? "owned" : isActiveTier ? "next" : "locked";
    const nextRunFree = freeLeft > 0;
    return (
      <LadderStep
        status={status}
        last={last}
        title={tier === 1 ? C.finances.bootcampT1 : C.finances.bootcampT2}
        desc={tier === 1 ? C.finances.bootcampT1Desc : C.finances.bootcampT2Desc}
        badges={
          superseded ? (
            <Badge tone="orange">{C.finances.ownedLabel}</Badge>
          ) : isActiveTier && nextRunFree ? (
            <Badge tone="gold">{C.common.free}</Badge>
          ) : null
        }
        aside={
          isActiveTier ? (
            <>
              {nextRunFree ? (
                <s className="text-xs text-faint">{formatMoney(def.cost, { compact: true })}</s>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                disabled={fin.bootcampUsedThisSplit}
                onClick={runBootcamp}
              >
                {C.finances.buy}
                {nextRunFree ? null : <> · {formatMoney(def.cost, { compact: true })}</>}
              </Button>
            </>
          ) : !unlocked ? null : undefined
        }
        notes={
          <>
            {isActiveTier && fin.bootcampUsedThisSplit ? (
              <p className="mt-1 text-[10px] font-semibold text-faint">
                {C.finances.bootcampUsed}
              </p>
            ) : null}
            {isActiveTier && freeLeft > 0 ? (
              <p className="mt-1 text-[10px] font-semibold text-amber-300">
                {C.finances.freeBootcampLeft(freeLeft)}
              </p>
            ) : null}
            {!unlocked ? (
              <p className="mt-1 text-[10px] font-semibold text-faint">
                {C.finances.lockedAtRep(def.repGate)}
              </p>
            ) : null}
          </>
        }
      />
    );
  };

  const psychUnlocked = rep >= CAREER_GEAR.psychologistRep;
  const psychStatus: StepStatus = gear.psychologist ? "owned" : psychUnlocked ? "next" : "locked";

  // --- ledger groups (newest first, grouped by day stamp) ---------------------
  const filteredLedger = [...fin.ledger]
    .reverse()
    .filter((e) =>
      ledgerFilter === "all" ? true : ledgerFilter === "in" ? e.amount >= 0 : e.amount < 0,
    );
  const ledgerGroups: { key: string; label: string; items: LedgerEntry[] }[] = [];
  for (const e of filteredLedger) {
    const key = `${e.seasonIndex}:${typeof e.day === "number" ? e.day : `w${e.week}`}`;
    const last = ledgerGroups[ledgerGroups.length - 1];
    if (last && last.key === key) {
      last.items.push(e);
      continue;
    }
    const dayLabel =
      typeof e.day === "number"
        ? formatDateTiny(D, dateOfDay(e.seasonIndex, e.day))
        : C.hub.week(e.week);
    const label =
      e.seasonIndex === save.clock.seasonIndex
        ? dayLabel
        : `${seasonLabelFor(e.seasonIndex)} · ${dayLabel}`;
    ledgerGroups.push({ key, label, items: [e] });
  }

  // --- sponsor helpers ---------------------------------------------------------
  const objectiveText = (kind: SponsorObjectiveKind): string =>
    kind === "enterEvents"
      ? C.finances.objective.enterEvents(CAREER_SPONSOR.enterEventsTarget)
      : C.finances.objective[kind];

  const perkChips = (tier: number): React.ReactNode => {
    const row = CAREER_SPONSOR.tiers[tier - 1];
    const chips: string[] = [];
    if (row.gearDiscountPct > 0) chips.push(C.finances.perkDiscount(row.gearDiscountPct));
    if (row.freeBootcampsPerSeason > 0)
      chips.push(C.finances.perkBootcamps(row.freeBootcampsPerSeason));
    return (
      <div className="mt-2">
        <p className="kicker mb-1 text-[9px]">{C.finances.sponsorPerks}</p>
        <div className="flex flex-wrap gap-1.5">
          {chips.length > 0 ? (
            chips.map((c) => (
              <Badge key={c} tone="blue">
                {c}
              </Badge>
            ))
          ) : (
            <Badge tone="neutral">{C.finances.perkNone}</Badge>
          )}
        </div>
      </div>
    );
  };

  const sponsorMoneyLine = (s: SponsorState): React.ReactNode => (
    <>
      <p className="mt-2 text-sm font-semibold text-good">
        {C.finances.perSplitBase(formatMoney(s.basePerSplit, { compact: true }))}
      </p>
      <p className="text-xs text-sub">{C.finances.bonusFor(formatMoney(s.bonus, { compact: true }))}</p>
    </>
  );

  const brandFlavor = (sponsorId: string): string | null => {
    const brand = sponsorBrandById.get(sponsorId);
    if (!brand) return null;
    return lang === "pt" ? brand.flavorPt : brand.flavorEn;
  };

  const garnishPct = Math.round(CAREER_LOAN.garnishRate[save.difficulty] * 100);
  const patienceMax = CAREER_SPONSOR.patienceMisses;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle kicker={C.meta.title} title={C.finances.title} className="rise-in" />

      <FinanceErrorNotice className="rise-in" />

      {/* ================= statement tiles ================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Panel strong className="rise-in p-4">
          <p className="kicker text-[10px]">{C.finances.balance}</p>
          <p
            className={cx(
              "display mt-1 text-3xl font-bold leading-none",
              fin.balance < 0 ? "text-bad" : "text-ink",
            )}
          >
            {formatMoney(fin.balance)}
          </p>
          {fin.loan ? (
            <Badge tone="bad" className="mt-2">
              {C.finances.backerRemaining(formatMoney(fin.loan.remaining, { compact: true }))}
            </Badge>
          ) : null}
          <div className="mt-3 border-t border-line pt-2">
            <BalanceSparkline data={sparkTail} />
          </div>
        </Panel>

        <Panel className="rise-in p-4" style={{ animationDelay: "40ms" }}>
          <p className="kicker text-[10px]">{C.finances.net}</p>
          <p
            className={cx(
              "display mt-1 text-3xl font-bold leading-none",
              net >= 0 ? "text-good" : "text-bad",
            )}
          >
            {formatMoneyDelta(net, { compact: true })}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-line bg-white/[0.03] px-2 py-1.5">
              <span className="kicker block text-[9px]">{C.finances.income}</span>
              <span className="font-semibold text-good">
                {formatMoney(income, { compact: true })}
              </span>
            </div>
            <div className="rounded-md border border-line bg-white/[0.03] px-2 py-1.5">
              <span className="kicker block text-[9px]">{C.finances.expenses}</span>
              <span className="font-semibold text-bad">
                {formatMoney(expenses, { compact: true })}
              </span>
            </div>
          </div>
        </Panel>

        <Panel className="rise-in p-4" style={{ animationDelay: "80ms" }}>
          <p className="kicker text-[10px]">{C.finances.projected}</p>
          <p
            className={cx(
              "display mt-1 text-3xl font-bold leading-none",
              projected < 0 ? "text-bad" : "text-ink",
            )}
          >
            {formatMoney(projected, { compact: true })}
          </p>
          <p className="mt-3 text-[11px] text-faint">
            {C.finances.payday} · {C.hub.budgetNet(formatMoneyDelta(net, { compact: true }))}
          </p>
        </Panel>
      </div>

      {/* ================= Emergency Backer ================= */}
      {fin.loan ? (
        <Panel glow="orange" className="rise-in p-4">
          <p className="kicker mb-1 text-[10px]">{C.finances.backer}</p>
          <p className="display text-lg font-bold text-orange-bright">
            {C.finances.backerRemaining(formatMoney(fin.loan.remaining))}
          </p>
          <p className="mt-1 text-xs text-sub">{C.finances.backerLine(garnishPct)}</p>
          <p className="mt-0.5 text-xs text-sub">
            {C.finances.backerSaleLine(Math.round(CAREER_LOAN.saleGarnishRate * 100))}
          </p>
          <BackerPayDown remaining={fin.loan.remaining} balance={fin.balance} />
        </Panel>
      ) : fin.loanUsed ? (
        <Panel className="rise-in !border-bad/40 p-4">
          <p className="kicker mb-1 text-[10px]">{C.finances.backer}</p>
          <p className="text-sm font-semibold text-bad">{C.finances.insolvencyWarning}</p>
          <p className="mt-1 text-xs text-faint">{C.finances.backerRescued}</p>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        {/* ================= THE GEAR LADDER (centerpiece) ================= */}
        <Panel className="rise-in p-4 sm:p-5 lg:col-span-3" style={{ animationDelay: "120ms" }}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="kicker text-[11px]">{C.finances.gearLadder}</p>
            <span className="shrink-0 text-[10px] font-semibold text-faint">
              {C.common.reputation} {Math.round(rep)}
            </span>
          </div>
          <p className="mb-4 text-xs text-sub">{C.finances.gearLadderHint}</p>

          <ol>
            {/* 1-3 · peripherals → monitors → PCs */}
            {gearFront.map((item) => (
              <LadderStep
                key={item.id}
                status={gearStatus(item)}
                title={C.finances.gear[item.id as keyof typeof C.finances.gear]}
                desc={C.finances.gearDesc[item.id as keyof typeof C.finances.gearDesc]}
                badges={
                  gear[item.id] ? <Badge tone="orange">{C.finances.ownedLabel}</Badge> : null
                }
                aside={gearAside(item)}
                notes={gearNotes(item)}
              />
            ))}

            {/* 4-5 · bootcamps (consumables, one run per split) */}
            {bootcampStep(1)}
            {bootcampStep(2)}

            {/* 6 · sports psychologist (rolling retainer) */}
            <LadderStep
              status={psychStatus}
              title={C.finances.psychologist}
              desc={C.finances.psychologistDesc}
              badges={
                gear.psychologist ? <Badge tone="good">{C.finances.retainedLabel}</Badge> : null
              }
              aside={
                gear.psychologist ? (
                  <Button variant="danger" size="sm" onClick={() => setPsychologist(false)}>
                    {C.finances.dropLabel}
                  </Button>
                ) : psychUnlocked ? (
                  <Button variant="primary" size="sm" onClick={() => setPsychologist(true)}>
                    {C.finances.hireLabel} ·{" "}
                    {formatMoney(CAREER_GEAR.psychologistPerSplit, { compact: true })}
                  </Button>
                ) : null
              }
              notes={
                <>
                  <p className="mt-1 text-[10px] text-faint">
                    {C.finances.upkeepLabel(
                      formatMoney(CAREER_GEAR.psychologistPerSplit, { compact: true }),
                    )}
                  </p>
                  {!psychUnlocked ? (
                    <p className="mt-1 text-[10px] font-semibold text-faint">
                      {C.finances.lockedAtRep(CAREER_GEAR.psychologistRep)}
                    </p>
                  ) : null}
                </>
              }
            />

            {/* 7 · Performance Center (the summit) */}
            <LadderStep
              status={gearStatus(perfCenter)}
              last
              title={C.finances.gear[perfCenter.id as keyof typeof C.finances.gear]}
              desc={C.finances.gearDesc[perfCenter.id as keyof typeof C.finances.gearDesc]}
              badges={
                gear[perfCenter.id] ? <Badge tone="orange">{C.finances.ownedLabel}</Badge> : null
              }
              aside={gearAside(perfCenter)}
              notes={gearNotes(perfCenter)}
            />
          </ol>
        </Panel>

        {/* ================= right column: sponsors + ledger ================= */}
        <div className="space-y-4 lg:col-span-2">
          {/* Sponsors */}
          <Panel className="rise-in p-4" style={{ animationDelay: "160ms" }}>
            <p className="kicker mb-3 text-[11px]">{C.finances.sponsors}</p>

            {save.sponsor ? (
              <div className="rounded-lg border border-line-strong bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                    {sponsorBrandById.get(save.sponsor.sponsorId)?.name ?? save.sponsor.sponsorId}
                  </span>
                  <Badge tone="blue">{C.finances.sponsorTier(save.sponsor.tier)}</Badge>
                </div>
                {brandFlavor(save.sponsor.sponsorId) ? (
                  <p className="mt-1 text-xs italic text-faint">
                    {brandFlavor(save.sponsor.sponsorId)}
                  </p>
                ) : null}
                {sponsorMoneyLine(save.sponsor)}

                <div className="mt-3 border-t border-line pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="kicker text-[9px]">{C.finances.sponsorObjective}</p>
                    {save.sponsor.hitThisSplit ? (
                      <Badge tone="good">{C.finances.objectiveHit}</Badge>
                    ) : (
                      <Badge tone="neutral">{C.finances.onTrack}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-sub">
                    {objectiveText(save.sponsor.objectiveKind)}
                  </p>
                  {save.sponsor.objectiveKind === "enterEvents" && !save.sponsor.hitThisSplit ? (
                    <ProgressBar
                      value={save.sponsor.progress / CAREER_SPONSOR.enterEventsTarget}
                      tone="blue"
                      className="mt-2"
                      label={C.finances.sponsorObjective}
                    />
                  ) : null}
                </div>

                {/* Patience meter */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1" aria-hidden>
                    {Array.from({ length: patienceMax }).map((_, i) => (
                      <span
                        key={i}
                        className={cx(
                          "h-1.5 w-4 rounded-full",
                          i < patienceMax - save.sponsor!.missedCount ? "bg-good" : "bg-bad/60",
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-[10px] text-faint">
                    {C.finances.patience(save.sponsor.missedCount, patienceMax)}
                  </span>
                </div>
                {save.sponsor.missedCount === patienceMax - 1 ? (
                  <p className="mt-1 text-[11px] font-semibold text-orange-bright">
                    {C.finances.patienceWarn}
                  </p>
                ) : null}

                {perkChips(save.sponsor.tier)}
              </div>
            ) : null}

            {save.sponsorOffers && save.sponsorOffers.length > 0 ? (
              <div className={cx(save.sponsor && "mt-3")}>
                <p className="kicker mb-2 text-[10px]">{C.finances.offerTitle}</p>
                <div className="space-y-2.5">
                  {save.sponsorOffers.map((o) => (
                    <div
                      key={o.sponsorId}
                      className="rounded-lg border border-blue/40 bg-blue/[0.05] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                          {sponsorBrandById.get(o.sponsorId)?.name ?? o.sponsorId}
                        </span>
                        <Badge tone="blue">{C.finances.sponsorTier(o.tier)}</Badge>
                      </div>
                      {brandFlavor(o.sponsorId) ? (
                        <p className="mt-1 text-xs italic text-faint">{brandFlavor(o.sponsorId)}</p>
                      ) : null}
                      {sponsorMoneyLine(o)}
                      <p className="mt-1.5 text-xs text-sub">
                        {C.finances.sponsorObjective}: {objectiveText(o.objectiveKind)}
                      </p>
                      {perkChips(o.tier)}
                      <Button
                        variant="primary"
                        size="sm"
                        full
                        className="mt-3"
                        onClick={() => chooseSponsor(o.sponsorId)}
                      >
                        {C.common.confirm}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!save.sponsor && (!save.sponsorOffers || save.sponsorOffers.length === 0) ? (
              <div>
                <p className="text-sm text-sub">
                  {C.finances.lockedAtRep(CAREER_SPONSOR.firstOfferRepGate)}
                </p>
                <ProgressBar
                  value={rep / CAREER_SPONSOR.firstOfferRepGate}
                  tone="orange"
                  className="mt-2"
                  label={C.finances.sponsors}
                />
                <p className="mt-1.5 text-[10px] text-faint">
                  {C.common.reputation} {Math.round(rep)} / {CAREER_SPONSOR.firstOfferRepGate}
                </p>
              </div>
            ) : null}
          </Panel>

          {/* Ledger */}
          <Panel className="rise-in p-4" style={{ animationDelay: "200ms" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="kicker text-[11px]">{C.finances.ledger}</p>
              <div className="flex gap-1.5">
                {(
                  [
                    ["all", C.news.filter.all],
                    ["in", C.finances.income],
                    ["out", C.finances.expenses],
                  ] as [LedgerFilter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLedgerFilter(k)}
                    aria-pressed={ledgerFilter === k}
                    className={cx(
                      "display inline-flex min-h-8 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                      ledgerFilter === k
                        ? "border-blue/50 bg-blue/15 text-blue-bright"
                        : "border-line-strong bg-white/5 text-sub hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {ledgerGroups.length === 0 ? (
              <p className="py-6 text-center text-xs text-faint">—</p>
            ) : (
              <div className="-mr-2 max-h-[26rem] space-y-3 overflow-y-auto pr-2">
                {ledgerGroups.map((g) => (
                  <div key={g.key}>
                    <p className="kicker mb-1 text-[9px]">{g.label}</p>
                    <div className="rounded-lg border border-line bg-white/[0.02]">
                      {g.items.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-baseline justify-between gap-3 border-b border-line/50 px-2.5 py-1.5 text-xs last:border-0"
                        >
                          <span className="min-w-0 truncate text-sub">
                            {C.finances.ledgerKind[e.kind]}
                            {e.refName ? (
                              <span className="text-faint"> · {e.refName}</span>
                            ) : null}
                          </span>
                          <span
                            className={cx(
                              "shrink-0 font-mono font-semibold",
                              e.amount >= 0 ? "text-good" : "text-bad",
                            )}
                          >
                            {formatMoneyDelta(e.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
