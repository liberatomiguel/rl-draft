"use client";

/**
 * Road to Worlds — Finances (v0.2 rebuild): the org's financial dashboard.
 *
 * v2.0 (R20/R21): the statement is WEEKLY — the tiles, the "Weekly statement"
 * breakdown and the hub tile all read economy.weeklyStatement, the same
 * function the Monday funnel books, so no screen can disagree with the
 * ledger. "Loans & debt" holds both of the bank's loans: the voluntary one
 * (request / pay early) and, rc.34, the emergency one (its deadline and the
 * pay-down; rc.31–rc.33 the Emergency Backer).
 *
 * Statement tiles (balance + sparkline · net/week · projected + runway),
 * the GEAR LADDER as the progression centerpiece
 * (7 steps: peripherals → monitors → PCs → bootcamp T1 → bootcamp T2 →
 * psychologist → Performance Center, unlocked by rep, bought in order, sponsor
 * perks discounting; rc.36 (POL-02, Miguel on rc.35): back to the stacked
 * list of every step, each with its icon badge on the rail, as before
 * rc.35's compact track), the sponsor desk (active deal with objective/patience/
 * perks + season offers), the date-grouped ledger and the emergency loan
 * panel. Every gate and price reads from CAREER_* constants — zero literals.
 */

import { useState } from "react";
import {
  CAREER_BANK,
  CAREER_ECONOMY,
  CAREER_LOAN,
  CAREER_PAYROLL,
  CAREER_PRIZES,
  CAREER_SPONSOR,
} from "@/config/balance";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { RESCUE_PARTNER_BRAND, sponsorBrandById } from "@/data/career/sponsors";
import {
  bankInstalmentsLeft,
  bankLoanLimitFor,
  bankLoanRefusal,
  bankLoanTerms,
  bankMinAmountFor,
  bootcampCostFor,
  breachesToEndFor,
  canSettleLoan,
  deadlineWeeksFor,
  debtPaymentFor,
  foundingPartnerActive,
  investorShareFor,
  loanBreachesOf,
  maxLoansFor,
  moneyIndex,
  nextPaydayFor,
  psychologistPerSplitFor,
  quantize,
  rescuePartnerLastPayday,
  weeklyOf,
  type BankLoanRefusal,
  type BreachOutcome,
  type WeeklyStatement,
} from "@/engine/career/economy";
import {
  backerLineOf,
  emergencyLoanViewOf,
  foundingPartnerPerSplitOf,
  mondayBalancesOf,
  nextBreachParamsOf,
  runwayWeeksOf,
  weeklyStatementOf,
} from "@/store/careerFlow";
import type {
  BankLoanState,
  FinanceState,
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
import { BalanceHistory } from "@/components/career/finances/BalanceHistory";
import { hqFinanceOf } from "@/store/careerHq";
import { careerNewSummary, toolboxNewKey, type ToolboxItemId } from "@/engine/career/careerNew";
import { NewTag } from "@/components/ui/NewDot";
import { deadlineDateText } from "@/components/career/finances/loanDates";
import { SponsorDealPanel, SponsorDecision } from "@/components/career/sponsors/SponsorOfferCard";
import { otherIncomeRoomOfSave } from "@/engine/career/inserts";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RungBadge } from "@/components/career/ladder/LadderParts";
import type { LadderRungId } from "@/engine/career/ladder";
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
// Loan pay-down (v0.3; rc.34: the emergency loan and the bank's): amount stepper + pay / pay-it-all
// ---------------------------------------------------------------------------

function PayDown({
  remaining,
  balance,
  onPay,
  cta,
  hint,
  floor,
  next,
}: {
  remaining: number;
  balance: number;
  onPay: (amount: number) => void;
  cta: string;
  hint?: string;
  /** rc.32 (M4): the floor on this wage bill (the flows' own `backerLineOf`). */
  floor: number;
  /** rc.34: what the next breach would do — the flow's nextBreachParamsOf (a new loan, a top-up, the end). */
  next: Record<string, string | number>;
}) {
  const C = useCareerCopy();
  const [raw, setRaw] = useState<number | null>(null);

  // ECO-02 (R46): the quote is what the flow settles (debtPaymentFor) — a
  // debt off the $50 quantum is paid to the dollar, a stub included.
  const payMin = Math.min(CAREER_ECONOMY.roundQuantum, remaining);
  const step = Math.max(payMin, quantize(remaining / 10));
  const maxPay = debtPaymentFor(remaining, balance - floor);
  const canPay = maxPay > 0 && maxPay >= payMin;
  const clamp = (n: number) => Math.min(Math.max(n, payMin), Math.max(payMin, maxPay));
  const amount = debtPaymentFor(remaining, clamp(raw ?? step));
  // rc.34 review: the deadline's own rule (economy.canSettleLoan) — down to the floor.
  const canPayAll = canSettleLoan(balance, remaining, floor);
  const balanceAfter = balance - amount;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={C.finances.amountDown}
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
          aria-label={C.finances.amountUp}
          className="h-11 w-11 shrink-0 rounded-lg border border-line text-lg font-bold text-sub transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setRaw(clamp(amount + step))}
          disabled={!canPay || amount >= maxPay}
        >
          +
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" disabled={!canPay} onClick={() => onPay(amount)}>
          {cta}
        </Button>
        <Button variant="ghost" size="sm" disabled={!canPayAll} onClick={() => onPay(remaining)}>
          {C.finances.payDebtAll(formatMoney(remaining))}
        </Button>
      </div>

      {canPay ? (
        <p className={cx("mt-2 text-xs font-semibold", balanceAfter < 0 ? "text-bad" : "text-sub")}>
          {C.market.balanceAfter(formatMoney(balanceAfter))}
        </p>
      ) : null}
      {canPay && balanceAfter < 0 ? (
        <p className="mt-1 rounded-md border border-orange/40 bg-orange/10 px-2.5 py-1.5 text-xs font-semibold text-orange-bright">
          {next.next === "rescue" && !Number(next.owing)
            ? C.finances.payRiskBacker(formatMoney(floor, { compact: true }))
            : C.finances.payRiskNext(formatMoney(floor, { compact: true }), next)}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-[10px] text-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * ECO-02 (R46): the "Loans & debt" panel — open by default while a debt
 * exists (or once one appears on this screen), then it follows the user's own
 * toggling. Paying a debt off inside it never folds it away under the cursor
 * (the old `open={Boolean(fin.loan || fin.bankLoan)}` was controlled by the
 * debt, so "Pay it all" collapsed the panel and hid the bank's Request).
 */
function LoansDetails({
  hasDebt,
  className,
  children,
}: {
  hasDebt: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [debtSeen, setDebtSeen] = useState(hasDebt);
  if (hasDebt && !debtSeen) setDebtSeen(true);
  return (
    <details
      open={userOpen ?? debtSeen}
      onToggle={(e) => setUserOpen(e.currentTarget.open)}
      className={className}
    >
      {children}
    </details>
  );
}

/**
 * ECO-02 (R46): the bank loan's schedule as the Monday funnel books it — the
 * next instalment (min(remaining, weekly)), its date, and how many are left.
 */
function BankSchedule({ loan, clock }: { loan: BankLoanState; clock: { seasonIndex: number; day: number } }) {
  const C = useCareerCopy();
  const D = C.dates;
  const next = nextPaydayFor(clock);
  const due = Math.min(loan.remaining, loan.weeklyPayment);
  return (
    <p className="mt-0.5 text-xs text-sub">
      {C.finances.bankNext(
        formatMoney(due),
        formatDateTiny(D, dateOfDay(next.seasonIndex, next.day)),
      )}{" "}
      · {C.finances.bankLeft(bankInstalmentsLeft(loan))}
    </p>
  );
}

/** ECO-02 (R46): the flow's own refusal (bankLoanRefusal) → the error string the flow returns. */
const BANK_REFUSAL_COPY: Record<BankLoanRefusal, "bankActive" | "bankBacker" | "bankAmount" | "bankLimit"> = {
  active: "bankActive",
  backer: "bankBacker",
  amount: "bankAmount",
  limit: "bankLimit",
};

/** v2.0 (R21): request a bank loan — amount stepper, live terms, one button. */
function BankLoanRequest({
  fin,
  rep,
  balance,
  seasonIndex,
}: {
  fin: FinanceState;
  rep: number;
  balance: number;
  /** rc.32 (M1): the bank's limits are on the season money index. */
  seasonIndex: number;
}) {
  const C = useCareerCopy();
  const takeBankLoan = useCareerStore((s) => s.takeBankLoan);
  const limit = bankLoanLimitFor(rep, seasonIndex);
  const minAmount = bankMinAmountFor(seasonIndex);
  const step = Math.max(CAREER_ECONOMY.roundQuantum, quantize(limit / 10));
  const [raw, setRaw] = useState<number | null>(null);
  const clamp = (n: number) => Math.min(limit, Math.max(minAmount, quantize(n)));
  const amount = clamp(raw ?? Math.min(limit, Math.max(minAmount, quantize(limit / 2))));
  const terms = bankLoanTerms(amount);
  // ECO-02 (R46): the panel states the REAL reason the bank would refuse —
  // the same bankLoanRefusal takeBankLoanFlow runs — instead of its own guess.
  const refusal = bankLoanRefusal(fin, rep, amount, seasonIndex);
  if (limit < minAmount) {
    return <p className="mt-2 text-xs text-faint">{C.finances.bankLockedRep}</p>;
  }
  if (refusal === "active" || refusal === "backer") {
    return (
      <p className="mt-2 text-xs font-semibold text-faint">{C.market.errors[BANK_REFUSAL_COPY[refusal]]}</p>
    );
  }
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[11px] font-semibold text-sub">{C.finances.bankAvailable(formatMoney(limit))}</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={C.finances.amountDown}
          className="h-11 w-11 shrink-0 rounded-lg border border-line text-lg font-bold text-sub transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setRaw(clamp(amount - step))}
          disabled={amount - step < minAmount}
        >
          −
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="display text-lg font-bold tabular-nums text-ink">{formatMoney(amount)}</p>
          <p className="text-[10px] text-faint">{C.finances.bankAmount}</p>
        </div>
        <button
          type="button"
          aria-label={C.finances.amountUp}
          className="h-11 w-11 shrink-0 rounded-lg border border-line text-lg font-bold text-sub transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setRaw(clamp(amount + step))}
          disabled={amount >= limit}
        >
          +
        </button>
      </div>
      <p className="mt-2 text-xs text-sub">
        {C.finances.bankTerms(
          formatMoney(terms.weeklyPayment, { compact: true }),
          terms.termWeeks,
          formatMoney(terms.total, { compact: true }),
        )}
      </p>
      {refusal ? (
        <p className="mt-2 text-xs font-semibold text-bad">{C.market.errors[BANK_REFUSAL_COPY[refusal]]}</p>
      ) : null}
      <Button
        variant="primary"
        size="sm"
        className="mt-3"
        disabled={refusal !== null}
        onClick={() => takeBankLoan(amount)}
      >
        {C.finances.bankRequest} · {formatMoney(amount, { compact: true })}
      </Button>
      <p className="mt-2 text-[10px] text-faint">
        {C.finances.projected}: {formatMoney(balance + amount, { compact: true })}
      </p>
    </div>
  );
}

/** The Monday breakdown, line by line (positive in, negative out). */
function StatementLines({ st }: { st: WeeklyStatement }) {
  const C = useCareerCopy();
  const rows: { key: keyof typeof C.finances.line; amount: number }[] = [
    { key: "sponsorBase", amount: st.sponsorBase },
    { key: "foundingPartner", amount: st.foundingPartner },
    { key: "rescuePartner", amount: st.rescuePartner },
    { key: "fanbase", amount: st.fanbase },
    { key: "payroll", amount: -st.payroll },
    { key: "coach", amount: -st.coach },
    { key: "psychologist", amount: -st.psychologist },
    { key: "upkeep", amount: -st.upkeep },
    { key: "bankPayment", amount: -st.bankPayment },
    // rc.34 (ECO-04): a missed goal's fine instalment.
    { key: "sponsorFine", amount: -st.sponsorFine },
  ];
  return (
    <div className="rounded-lg border border-line bg-white/[0.02]">
      {rows
        .filter((r) => r.amount !== 0)
        .map((r) => (
          <div
            key={r.key}
            className="flex items-baseline justify-between gap-3 border-b border-line/50 px-2.5 py-1.5 text-xs last:border-0"
          >
            <span className="text-sub">{C.finances.line[r.key]}</span>
            <span className={cx("font-mono font-semibold", r.amount >= 0 ? "text-good" : "text-bad")}>
              {formatMoneyDelta(r.amount)}
            </span>
          </div>
        ))}
      <div className="flex items-baseline justify-between gap-3 px-2.5 py-1.5 text-xs">
        <span className="font-semibold text-ink">{C.finances.net}</span>
        <span className={cx("font-mono font-bold", st.net >= 0 ? "text-good" : "text-bad")}>
          {formatMoneyDelta(st.net)}
        </span>
      </div>
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

/** rc.36: the step's state as the ladder's icon badge reads it (owned · open to buy · locked). */
const BADGE_STATUS: Record<StepStatus, "owned" | "open" | "locked"> = { owned: "owned", next: "open", locked: "locked" };

/**
 * One step of the arsenal (rc.34's stacked list). rc.36: its node on the rail
 * is the item's icon badge (the HQ ladder's: a check when owned, a lock when
 * locked, the glow on the one to buy next); on a phone the price / Buy sits
 * under the text instead of squeezing it.
 */
function LadderStep({
  status,
  rung,
  title,
  desc,
  badges,
  aside,
  notes,
  last,
}: {
  status: StepStatus;
  rung: LadderRungId;
  title: string;
  desc: string;
  badges?: React.ReactNode;
  aside?: React.ReactNode;
  notes?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className={cx("relative pl-11", !last && "pb-3")}>
      {!last ? (
        <span
          aria-hidden
          className={cx(
            "absolute left-[15px] top-10 h-[calc(100%-34px)] w-0.5 rounded",
            status === "owned" ? "bg-orange/50" : "bg-line",
          )}
        />
      ) : null}
      <span className="absolute left-0 top-1.5 z-10">
        <RungBadge rung={{ id: rung, status: BADGE_STATUS[status] }} size="sm" highlight={status === "next"} />
      </span>
      <div
        className={cx(
          "rounded-lg border p-3 transition-colors",
          status === "owned" && "border-orange/40 bg-orange/[0.05]",
          status === "next" &&
            "border-orange/60 bg-white/[0.03] shadow-[0_0_20px_-8px_rgba(249,115,22,0.55)]",
          status === "locked" && "border-line bg-white/[0.02] opacity-70",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
          {aside ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div> : null}
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
  const payDebt = useCareerStore((s) => s.payDebt);
  const payBankLoan = useCareerStore((s) => s.payBankLoan);

  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  // rc.33 (UX-07): the expanded balance chart.
  const [chartOpen, setChartOpen] = useState(false);

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

  // --- statement (v2.0: THE weekly statement the Monday funnel books) --------
  // rc.32: weeklyStatementOf — the season's money index and the founding partner.
  const statement = weeklyStatementOf(save);
  const { income, expenses, net } = statement;
  const projected = fin.balance + net;
  // rc.33 review: the rescue partner's help counts only on its remaining Mondays.
  const runway = runwayWeeksOf(save, net);
  // rc.34 (UX-01e): the end-of-split projection HQ shows — one function, the same figure.
  const projection = hqFinanceOf(save).projection;
  // rc.34 (UX-06a): the toolbox items unlocked and not opened carry the "New" tag here too.
  const fresh = careerNewSummary(save).keys;
  const newTag = (id: ToolboxItemId) => (fresh.has(toolboxNewKey(id)) ? <NewTag>{C.toolbox.newTag}</NewTag> : null);
  // rc.32 (M1): season-0 prices on the money index; (M4) the Backer's line and the next breach.
  const seasonIndex = save.clock.seasonIndex;
  const flatIndex = moneyIndex(seasonIndex, "flat");
  const backer = backerLineOf(save);
  const breaches = loanBreachesOf(fin);
  // rc.34: what the next breach does (a new emergency loan, a top-up, or the end), the loan's
  // deadline view, a breach count only where one still ends a career, the investor's last payday.
  const nextBreachParams = nextBreachParamsOf(save);
  const nextBreach: BreachOutcome = nextBreachParams.next === "insolvent" ? "insolvent" : "rescue";
  const loanView = emergencyLoanViewOf(save);
  const breachEnd = breachesToEndFor(save.difficulty);
  const rescueLast = rescuePartnerLastPayday(fin.rescuePartner, save.clock);

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
  const freeAllowance = sponsorFreeBootcampsOf(save.sponsor);
  const freeLeft = Math.max(0, freeAllowance - fin.freeBootcampsUsedThisSeason);
  const [gearFront, perfCenter] = [CAREER_GEAR.items.slice(0, 3), CAREER_GEAR.items[3]];

  const gearStatus = (item: (typeof CAREER_GEAR.items)[number]): StepStatus =>
    gear[item.id] ? "owned" : nextGear?.id === item.id && rep >= item.repGate ? "next" : "locked";

  const gearAside = (item: (typeof CAREER_GEAR.items)[number]): React.ReactNode => {
    const status = gearStatus(item);
    const price = gearPriceFor(item.cost, sponsorTier, seasonIndex);
    if (status === "owned") return null;
    if (status === "next") {
      return (
        <>
          <PriceTag base={gearPriceFor(item.cost, null, seasonIndex)} price={price} />
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
            {C.finances.upkeepLabel(formatMoney(weeklyOf(item.upkeepPerSplit * flatIndex), { compact: true }))}
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
    const campCost = bootcampCostFor(tier, seasonIndex);
    const unlocked = rep >= def.repGate;
    const isActiveTier = bootTier === tier;
    const superseded = bootTier > tier;
    const status: StepStatus = superseded ? "owned" : isActiveTier ? "next" : "locked";
    const nextRunFree = freeLeft > 0;
    return (
      <LadderStep
        status={status}
        rung={tier === 1 ? "bootcamp1" : "bootcamp2"}
        last={last}
        title={tier === 1 ? C.finances.bootcampT1 : C.finances.bootcampT2}
        desc={tier === 1 ? C.finances.bootcampT1Desc : C.finances.bootcampT2Desc}
        badges={
          superseded ? (
            <Badge tone="orange">{C.finances.ownedLabel}</Badge>
          ) : isActiveTier && nextRunFree ? (
            <>
              <Badge tone="gold">{C.common.free}</Badge>
              {newTag(tier === 2 ? "bootcamp2" : "bootcamp1")}
            </>
          ) : isActiveTier ? (
            newTag(tier === 2 ? "bootcamp2" : "bootcamp1")
          ) : null
        }
        aside={
          isActiveTier ? (
            <>
              {nextRunFree ? (
                <s className="text-xs text-faint">{formatMoney(campCost, { compact: true })}</s>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                disabled={fin.bootcampUsedThisSplit}
                onClick={runBootcamp}
              >
                {C.finances.buy}
                {nextRunFree ? null : <> · {formatMoney(campCost, { compact: true })}</>}
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
            {/* rc.34 (UX-01f, 5-A): the edge lasts the split — its end date. */}
            {isActiveTier && fin.bootcampSharp > 0 && fin.bootcampUntil ? (
              <p className="mt-1 text-[10px] font-semibold text-orange-bright">
                {C.finances.bootcampUntil(formatDateTiny(D, dateOfDay(fin.bootcampUntil.seasonIndex, fin.bootcampUntil.day)))}
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
        {C.finances.perWeekBase(formatMoney(weeklyOf(s.basePerSplit), { compact: true }))}
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
  // rc.34 (ECO-05): the other-income cap this season and split.
  const otherRoom = otherIncomeRoomOfSave(save);

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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fin.loan ? (
              <Badge tone="bad">
                {C.finances.backerRemaining(formatMoney(fin.loan.remaining, { compact: true }))}
              </Badge>
            ) : null}
            {fin.bankLoan ? (
              <Badge tone="orange">
                {C.finances.bankRemaining(formatMoney(fin.bankLoan.remaining, { compact: true }))}
              </Badge>
            ) : null}
          </div>
          {/* rc.33 (UX-07): the sparkline opens the expanded chart of the recorded Mondays. */}
          <button
            type="button"
            onClick={() => setChartOpen(true)}
            aria-label={C.finances.chartOpen}
            title={C.finances.chartOpen}
            className="group mt-3 flex min-h-11 w-full items-center gap-2 border-t border-line pt-2 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-cyan/60"
          >
            <span className="min-w-0 flex-1">
              {sparkTail.length >= 2 ? (
                <BalanceSparkline data={sparkTail} />
              ) : (
                <span className="text-[11px] text-faint">{C.finances.chartTitle}</span>
              )}
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-ink" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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
          <p
            className={cx(
              "mt-1 text-[11px] font-semibold",
              runway === null
                ? "text-good"
                : runway <= CAREER_PAYROLL.runwayWarnWeeks
                  ? "text-bad"
                  : "text-orange-bright",
            )}
          >
            {runway === null ? C.finances.runwayOk : C.finances.runway(runway)}
          </p>
          {save.phase !== "ended" ? (
            <p className={cx("mt-1 text-[11px]", projection.balance < 0 ? "text-bad" : "text-faint")}>
              {C.finances.projectionSplit(
                formatDateTiny(D, dateOfDay(projection.seasonIndex, projection.day)),
                formatMoney(projection.balance, { compact: true }),
              )}
            </p>
          ) : null}
        </Panel>
      </div>

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

          {/* rc.36: every step stacked again (rc.34's list), each with its icon. */}
          <ol>
            {/* 1-3 · peripherals → monitors → PCs */}
            {gearFront.map((item) => (
              <LadderStep
                key={item.id}
                status={gearStatus(item)}
                rung={item.id}
                title={C.finances.gear[item.id as keyof typeof C.finances.gear]}
                desc={C.finances.gearDesc[item.id as keyof typeof C.finances.gearDesc]}
                badges={
                  gear[item.id] ? <Badge tone="orange">{C.finances.ownedLabel}</Badge> : newTag(item.id)
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
              rung="psychologist"
              title={C.finances.psychologist}
              desc={C.finances.psychologistDesc}
              badges={
                gear.psychologist ? <Badge tone="good">{C.finances.retainedLabel}</Badge> : newTag("psych")
              }
              aside={
                gear.psychologist ? (
                  <Button variant="danger" size="sm" onClick={() => setPsychologist(false)}>
                    {C.finances.dropLabel}
                  </Button>
                ) : psychUnlocked ? (
                  <Button variant="primary" size="sm" onClick={() => setPsychologist(true)}>
                    {C.finances.hireLabel} ·{" "}
                    {C.squad.perWeek(formatMoney(weeklyOf(psychologistPerSplitFor(seasonIndex)), { compact: true }))}
                  </Button>
                ) : null
              }
              notes={
                <>
                  <p className="mt-1 text-[10px] text-faint">
                    {C.finances.upkeepLabel(
                      formatMoney(weeklyOf(psychologistPerSplitFor(seasonIndex)), { compact: true }),
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
              rung={perfCenter.id}
              last
              title={C.finances.gear[perfCenter.id as keyof typeof C.finances.gear]}
              desc={C.finances.gearDesc[perfCenter.id as keyof typeof C.finances.gearDesc]}
              badges={
                gear[perfCenter.id] ? <Badge tone="orange">{C.finances.ownedLabel}</Badge> : newTag(perfCenter.id)
              }
              aside={gearAside(perfCenter)}
              notes={gearNotes(perfCenter)}
            />
          </ol>
        </Panel>

        {/* ================= right column: statement + sponsors + ledger ================= */}
        <div className="space-y-4 lg:col-span-2">
          {/* Weekly statement */}
          <Panel className="rise-in p-4" style={{ animationDelay: "140ms" }}>
            <p className="kicker mb-1 text-[11px]">{C.finances.weeklyStatement}</p>
            <p className="mb-3 text-[11px] text-faint">{C.finances.statementHint}</p>
            <StatementLines st={statement} />
          </Panel>

          {/* Sponsors */}
          <Panel className="rise-in p-4" style={{ animationDelay: "160ms" }}>
            <p className="kicker mb-3 text-[11px]">{C.finances.sponsors}</p>

            {/* rc.32 (M3, provisional): the founding partner, its own named line and its end condition. */}
            {foundingPartnerActive(save.foundingPartner) ? (
              <div
                className={cx(
                  "rounded-lg border border-good/40 bg-good/[0.04] p-3",
                  Boolean(save.sponsor || save.sponsorOffers?.length) && "mb-3",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                    {C.finances.foundingTitle}
                  </span>
                  <Badge tone="good">{C.finances.activeLabel}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-good">
                  {C.finances.perWeekBase(formatMoney(weeklyOf(foundingPartnerPerSplitOf(save)), { compact: true }))}
                </p>
                <p className="text-xs text-sub">
                  {C.finances.foundingTerms(Math.round(CAREER_SPONSOR.founding.payrollShare * 100))}
                </p>
                <p className="mt-1.5 text-[11px] text-faint">
                  {save.foundingPartner?.taperStep !== undefined
                    ? C.finances.foundingTapering(
                        Math.round((CAREER_SPONSOR.founding.taper[save.foundingPartner.taperStep - 1] ?? 0) * 100),
                        save.foundingPartner.taperStep >= CAREER_SPONSOR.founding.taper.length,
                      )
                    : C.finances.foundingEnds(seasonLabelFor(CAREER_SPONSOR.founding.throughSeasonIndex))}
                </p>
              </div>
            ) : save.foundingPartner?.endedSeason === seasonIndex ? (
              <p className="mb-3 text-[11px] text-faint">{C.finances.foundingEnded}</p>
            ) : null}

            {/* rc.33 (ECO-07): the rescue partner while it runs — who, the weekly help, its last payday. */}
            {rescueLast && fin.rescuePartner ? (
              <div
                className={cx(
                  "rounded-lg border border-good/40 bg-good/[0.04] p-3",
                  Boolean(save.sponsor || save.sponsorOffers?.length) && "mb-3",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                    {RESCUE_PARTNER_BRAND.name}
                  </span>
                  <Badge tone="good">{C.finances.rescueTitle}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-good">
                  {C.finances.perWeekBase(formatMoney(fin.rescuePartner.weekly, { compact: true }))}
                </p>
                <p className="text-xs text-sub">{C.finances.rescueTerms(CAREER_LOAN.investor.weeks)}</p>
                <p className="mt-1.5 text-[11px] text-faint">
                  {C.finances.rescueUntil(
                    formatDateTiny(D, dateOfDay(rescueLast.seasonIndex, rescueLast.day)),
                    fin.rescuePartner.mondaysLeft,
                  )}
                </p>
              </div>
            ) : null}

            {/* rc.34 (ECO-04): a deal signed since rc.34 reads its own panel; a deal from before keeps rc.33's. */}
            {save.sponsor?.terms ? <SponsorDealPanel save={save} perks={perkChips(save.sponsor.tier)} /> : null}
            {save.sponsor && !save.sponsor.terms ? (
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

            {save.sponsorOffers?.some((o) => o.terms) ? (
              <div className={cx(save.sponsor && "mt-3")}>
                <p className="kicker mb-2 text-[10px]">{C.finances.offerTitle}</p>
                <SponsorDecision save={save} onSign={chooseSponsor} bare />
              </div>
            ) : save.sponsorOffers && save.sponsorOffers.length > 0 ? (
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

            {/* rc.34 (ECO-05, S7): other income — capped, never guaranteed. */}
            {otherRoom.taken > 0 || otherRoom.count < CAREER_SPONSOR.otherIncome.perSplitCap ? (
              <div className="mt-3 rounded-lg border border-line bg-white/[0.02] p-2.5">
                <p className="kicker text-[9px]">{C.finances.deal.otherIncome}</p>
                <p className="mt-0.5 text-xs text-sub">
                  {C.finances.deal.otherIncomeLine(
                    formatMoney(otherRoom.taken, { compact: true }),
                    formatMoney(otherRoom.cap, { compact: true }),
                    CAREER_SPONSOR.otherIncome.perSplitCap - otherRoom.count,
                    CAREER_SPONSOR.otherIncome.perSplitCap,
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-faint">
                  {C.finances.deal.otherIncomeHint(
                    Math.round(CAREER_SPONSOR.otherIncome.seasonShare * 100),
                    CAREER_SPONSOR.otherIncome.perSplitCap,
                  )}
                </p>
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

            {/* The players' share of podium prizes, stated where it is booked (rc.33 ECO-10: per contract). */}
            {CAREER_PRIZES.playerShare.enabled ? (
              <p className="mb-2 text-[10px] text-faint">{C.finances.playerShareRule}</p>
            ) : null}
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

      {/* ================= Loans & debt (v2.0; rc.2: folded away unless a loan is live) ================= */}
      <LoansDetails
        hasDebt={Boolean(fin.loan || fin.bankLoan)}
        className={cx("rise-in group panel p-0", fin.loan && "panel-glow-orange")}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="kicker text-[10px]">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ▸
            </span>
            {C.finances.loans}
            {fin.loan ? <Badge tone="orange" className="ml-2">{C.finances.backer}</Badge> : fin.bankLoan ? <Badge tone="blue" className="ml-2">{C.finances.bankTitle}</Badge> : null}
          </span>
          {/* rc.33 review (ECO-08): where the next breach ends the career, no Backer is promised. */}
          <span className="text-[10px] text-faint">
            {nextBreach === "insolvent" ? C.finances.loansHintEnd : C.finances.loansHint}
          </span>
        </summary>
        <div className="px-4 pb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Bank */}
          <div className="rounded-lg border border-line bg-white/[0.02] p-3">
            <p className="display text-sm font-bold uppercase tracking-wide text-ink">
              {C.finances.bankTitle}
            </p>
            {fin.bankLoan ? (
              <>
                <p className="display mt-1 text-lg font-bold text-orange-bright">
                  {C.finances.bankRemaining(formatMoney(fin.bankLoan.remaining))}
                </p>
                <p className="mt-0.5 text-xs text-sub">
                  {C.finances.bankWeekly(formatMoney(fin.bankLoan.weeklyPayment, { compact: true }))}
                </p>
                <BankSchedule loan={fin.bankLoan} clock={save.clock} />
                <PayDown
                  remaining={fin.bankLoan.remaining}
                  balance={fin.balance}
                  onPay={payBankLoan}
                  cta={C.finances.bankPayEarly}
                  floor={backer.floor}
                  next={nextBreachParams}
                />
                <p className="mt-2 text-[10px] text-faint">{C.finances.bankBlockedActive}</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-sub">
                  {(nextBreach === "insolvent" ? C.finances.bankHintEnd : C.finances.bankHint)(
                    CAREER_BANK.termWeeks,
                    Math.round(CAREER_BANK.interestPct * 100),
                  )}
                </p>
                <BankLoanRequest fin={fin} rep={rep} balance={fin.balance} seasonIndex={seasonIndex} />
              </>
            )}
          </div>

          {/* rc.34 (Miguel, 31/10): the bank's emergency loan (rc.31–rc.33: the Emergency Backer) —
              what is owed, the deadline and what happens on it, how it is repaid, the top-ups,
              what the next breach does; the rule on this difficulty when nothing is owed. */}
          <div
            className={cx(
              "rounded-lg border bg-white/[0.02] p-3",
              fin.loan ? "border-orange/40" : fin.loanUsed ? "border-bad/40" : "border-line",
            )}
          >
            <p className="display text-sm font-bold uppercase tracking-wide text-ink">{C.finances.backer}</p>
            {fin.loan ? (
              <>
                <p className="display mt-1 text-lg font-bold text-orange-bright">
                  {C.finances.backerRemaining(formatMoney(fin.loan.remaining))}
                </p>
                {loanView?.deadline ? (
                  <>
                    <p className={cx("mt-1 text-sm font-semibold", loanView.covered ? "text-orange-bright" : "text-bad")}>
                      {C.finances.loanDeadline(
                        deadlineDateText(D, loanView.deadline, save.clock),
                        loanView.weeksLeft ?? 0,
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-sub">
                      {C.finances.loanCovered(loanView.covered)} {C.finances.loanDeadlineRule}
                    </p>
                  </>
                ) : null}
                <p className="mt-1 text-xs text-sub">{C.finances.backerLine(garnishPct)}</p>
                <p className="mt-0.5 text-xs text-sub">
                  {C.finances.backerSaleLine(Math.round(CAREER_LOAN.saleGarnishRate * 100))}
                </p>
                <p className="mt-0.5 text-xs text-sub">
                  {CAREER_LOAN.lockCommitments ? C.finances.backerLock : C.finances.loanNoLock}
                </p>
                {loanView?.lent ? (
                  <p className="mt-1 text-[11px] text-faint">{C.finances.loanLent(formatMoney(loanView.lent))}</p>
                ) : null}
                {loanView && (loanView.topUps > 0 || loanView.maxTopUps !== null) ? (
                  <p className="mt-0.5 text-[11px] text-faint">{C.finances.loanTopUps(loanView.topUps, loanView.maxTopUps)}</p>
                ) : null}
                {breachEnd !== null ? (
                  <p className="mt-0.5 text-[11px] text-faint">{C.finances.breachCount(breaches, breachEnd)}</p>
                ) : null}
                <p className={cx("mt-1 text-xs", nextBreach === "insolvent" ? "font-semibold text-bad" : "text-sub")}>
                  {C.hub.backerNextBreach(nextBreachParams)}
                </p>
                <PayDown
                  remaining={fin.loan.remaining}
                  balance={fin.balance}
                  onPay={payDebt}
                  cta={C.finances.payDebt}
                  hint={C.finances.payDebtHint}
                  floor={backer.floor}
                  next={nextBreachParams}
                />
              </>
            ) : fin.loanUsed ? (
              <>
                <p className={cx("mt-1 text-sm font-semibold", nextBreach === "insolvent" ? "text-bad" : "text-orange-bright")}>
                  {/* rc.34 review: the flow's own words — a breach count, or the career's last loan repaid (the loan cap). */}
                  {C.hub.backerNextBreach(nextBreachParams)}
                </p>
                <p className="mt-1 text-xs text-faint">{C.finances.backerRescued}</p>
                {breachEnd !== null ? (
                  <p className="mt-1 text-[11px] text-faint">{C.finances.breachCount(breaches, breachEnd)}</p>
                ) : null}
              </>
            ) : (
              <>
                {/* CAREER_LOAN.breachesToEnd may end this difficulty's careers at the first breach: no loan to describe. */}
                <p className="mt-1 text-xs text-sub">
                  {nextBreach === "insolvent"
                    ? C.finances.backerIdleNone(formatMoney(backer.floor, { compact: true }))
                    : C.finances.backerIdle(
                        formatMoney(backer.floor, { compact: true }),
                        formatMoney(backer.rescueTo, { compact: true }),
                        deadlineWeeksFor(save.difficulty),
                      )}
                </p>
                {CAREER_LOAN.sizing === "weeks" && nextBreach !== "insolvent" ? (
                  <p className="mt-1 text-[11px] text-faint">
                    {C.finances.backerWeeksLine(CAREER_LOAN.floorWeeks, CAREER_LOAN.rescueToWeeks)}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-faint">
                  {C.finances.loanRule({
                    term: deadlineWeeksFor(save.difficulty),
                    partnerPct: Math.round((investorShareFor(save.difficulty) ?? 0) * 100),
                    partnerWeeks: CAREER_LOAN.investor.weeks,
                    maxTopUps: CAREER_LOAN.emergency.maxTopUps,
                    endAt: breachEnd,
                    maxLoans: maxLoansFor(save.difficulty),
                  })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      </LoansDetails>

      {/* rc.33 (UX-07): the expanded balance chart (portal Modal; 360 px, no horizontal scroll). */}
      <Modal
        open={chartOpen}
        title={C.finances.chartTitle}
        onClose={() => setChartOpen(false)}
        wide
        actions={
          <Button variant="secondary" className="min-h-11" onClick={() => setChartOpen(false)}>
            {C.finances.chartClose}
          </Button>
        }
      >
        <BalanceHistory ring={mondayBalancesOf(save)} />
      </Modal>
    </div>
  );
}
