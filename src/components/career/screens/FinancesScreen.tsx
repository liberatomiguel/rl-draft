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

import { LoanSummary } from "../finances/LoanSummary";
import { useState } from "react";
import {
  CAREER_BANK,
  CAREER_ECONOMY,
  CAREER_LOAN,
  CAREER_PAYROLL,
  CAREER_PRIZES,
  CAREER_SPONSOR,
  CAREER_STAFF,
} from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
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
  staffOn,
  staffPerSplitFor,
  quantize,
  rescuePartnerLastPayday,
  weeklyOf,
  type BankLoanRefusal,
  type BreachOutcome,
  type CreditOffer,
  type WeeklyStatement,
} from "@/engine/career/economy";
import { capitalApprovalFor, capitalRefusalOf, establishedOf, gateRepOf } from "@/engine/career/established";
import {
  backerLineOf,
  creditOfferOf,
  emergencyLoanViewOf,
  foundingPartnerPerSplitOf,
  balanceHistoryOf,
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
import { MoneyChange } from "@/components/career/finances/MoneyChange";
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
import { LadderGrid, RungIcon } from "@/components/career/ladder/LadderParts";
import { ladderOf, ladderRungs, type LadderRungId } from "@/engine/career/ladder";
import { Children, isValidElement, type ReactNode } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { OperationsBoard } from "@/components/career/finances/Operations";
import { SeasonMoneyBoard } from "@/components/career/finances/SeasonMoney";
import { ledgerRefNameOf } from "@/components/career/finances/operationsView";
import { useActiveCareerCopy, useOrgCareerCopy } from "@/components/career/orgCopy";

type LedgerFilter = "all" | "in" | "out";
type StepStatus = "owned" | "next" | "locked";

// ---------------------------------------------------------------------------
// lastError → the REAL career.market.errors string (dismissible)
// ---------------------------------------------------------------------------

function errorTextFor(C: CareerCopy, key: string): string {
  return (C.market.errors as Record<string, string>)[key] ?? C.market.errors.unknown;
}

function FinanceErrorNotice({ className }: { className?: string }) {
  const C = useOrgCareerCopy(useCareerSave());
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
      <Button
        variant="ghost"
        size="sm"
        onClick={clearError}
        aria-label={C.common.close}
        className="shrink-0 !px-2.5 !text-bad"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </Button>
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
  const C = useActiveCareerCopy();
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
    <div className="mt-4 border-t border-line pt-4">
      <AmountStepper
        amount={amount}
        label={C.finances.payDebtAmount}
        onDown={() => setRaw(clamp(amount - step))}
        onUp={() => setRaw(clamp(amount + step))}
        downDisabled={!canPay || amount - step < payMin}
        upDisabled={!canPay || amount >= maxPay}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={!canPay} onClick={() => onPay(amount)}>
          {cta}
        </Button>
        <Button variant="ghost" size="sm" disabled={!canPayAll} onClick={() => onPay(remaining)}>
          {C.finances.payDebtAll(formatMoney(remaining))}
        </Button>
      </div>

      {canPay ? (
        <p className={cx("mt-2 text-xs", balanceAfter < 0 ? "text-bad" : "text-sub")}>
          {C.market.balanceAfter(formatMoney(balanceAfter))}
        </p>
      ) : null}
      {canPay && balanceAfter < 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-bad">
          {next.next === "rescue" && !Number(next.owing)
            ? C.finances.payRiskBacker(formatMoney(floor, { compact: true }))
            : C.finances.payRiskNext(formatMoney(floor, { compact: true }), next)}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

/**
 * The amount control of the pay-downs and the bank request: the figure with
 * its label under it, a step down and a step up either side (44px targets).
 */
function AmountStepper({
  amount,
  label,
  onDown,
  onUp,
  downDisabled,
  upDisabled,
}: {
  amount: number;
  label: string;
  onDown: () => void;
  onUp: () => void;
  downDisabled: boolean;
  upDisabled: boolean;
}) {
  const C = useActiveCareerCopy();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        aria-label={C.finances.amountDown}
        className="h-11 w-11 shrink-0 !px-0 !text-lg"
        onClick={onDown}
        disabled={downDisabled}
      >
        −
      </Button>
      <div className="min-w-0 flex-1 text-center">
        <p className="display text-2xl font-bold leading-none tabular-nums text-ink">{formatMoney(amount)}</p>
        <p className="mt-1 text-xs text-sub">{label}</p>
      </div>
      <Button
        variant="secondary"
        aria-label={C.finances.amountUp}
        className="h-11 w-11 shrink-0 !px-0 !text-lg"
        onClick={onUp}
        disabled={upDisabled}
      >
        +
      </Button>
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

/**
 * ECO-02 (R46): the bank loan's schedule as the Monday funnel books it — the
 * next instalment (min(remaining, weekly)), its date, and how many are left.
 */
function BankSchedule({ loan, clock }: { loan: BankLoanState; clock: { seasonIndex: number; day: number } }) {
  const C = useActiveCareerCopy();
  const D = C.dates;
  const next = nextPaydayFor(clock);
  const due = Math.min(loan.remaining, loan.weeklyPayment);
  return (
    <p className="mt-1 text-xs text-sub">
      {C.finances.bankNext(
        formatMoney(due),
        formatDateTiny(D, dateOfDay(next.seasonIndex, next.day)),
      )}{" "}
      · {C.finances.bankLeft(bankInstalmentsLeft(loan))}
    </p>
  );
}

/** ECO-02 (R46): the flow's own refusal (bankLoanRefusal) → the error string the flow returns. */
const BANK_REFUSAL_COPY: Record<BankLoanRefusal, "bankActive" | "bankBacker" | "bankNegative" | "bankAmount" | "bankLimit"> = {
  active: "bankActive",
  backer: "bankBacker",
  negative: "bankNegative",
  amount: "bankAmount",
  limit: "bankLimit",
};

/** v2.0 (R21): request a bank loan — amount stepper, live terms, one button. */
function BankLoanRequest({
  fin,
  rep,
  balance,
  seasonIndex,
  suggested,
}: {
  fin: FinanceState;
  rep: number;
  balance: number;
  /** rc.32 (M1): the bank's limits are on the season money index. */
  seasonIndex: number;
  /** rc.37 F2: the bank's own suggestion on these books (careerFlow.creditOfferOf; null = none needed). */
  suggested?: CreditOffer | null;
}) {
  const C = useActiveCareerCopy();
  const takeBankLoan = useCareerStore((s) => s.takeBankLoan);
  const limit = bankLoanLimitFor(rep, seasonIndex);
  const minAmount = bankMinAmountFor(seasonIndex);
  const step = Math.max(CAREER_ECONOMY.roundQuantum, quantize(limit / 10));
  const [raw, setRaw] = useState<number | null>(null);
  const clamp = (n: number) => Math.min(limit, Math.max(minAmount, quantize(n)));
  // rc.37 F2: the stepper starts on the bank's suggestion when the books burn.
  const amount = clamp(raw ?? suggested?.principal ?? Math.min(limit, Math.max(minAmount, quantize(limit / 2))));
  const terms = bankLoanTerms(amount);
  // ECO-02 (R46): the panel states the REAL reason the bank would refuse —
  // the same bankLoanRefusal takeBankLoanFlow runs — instead of its own guess.
  const refusal = bankLoanRefusal(fin, rep, amount, seasonIndex);
  if (limit < minAmount) {
    return <p className="mt-2 text-xs text-faint">{C.finances.bankLockedRep}</p>;
  }
  if (refusal === "active" || refusal === "backer" || refusal === "negative") {
    return (
      <p className="mt-2 text-xs text-sub">{C.market.errors[BANK_REFUSAL_COPY[refusal]]}</p>
    );
  }
  return (
    <div className="mt-4 border-t border-line pt-4">
      {/* The amount first (the control), then what that amount means, then the one button. */}
      <AmountStepper
        amount={amount}
        label={C.finances.bankAmount}
        onDown={() => setRaw(clamp(amount - step))}
        onUp={() => setRaw(clamp(amount + step))}
        downDisabled={amount - step < minAmount}
        upDisabled={amount >= limit}
      />
      <p className="mt-2 text-center text-xs text-sub">{C.finances.bankAvailable(formatMoney(limit))}</p>
      <LoanSummary C={C} received={amount} total={terms.total} weekly={terms.weeklyPayment} weeks={terms.termWeeks} />
      {refusal ? (
        <p className="mt-2 text-xs text-bad">{C.market.errors[BANK_REFUSAL_COPY[refusal]]}</p>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        className="mt-1"
        disabled={refusal !== null}
        onClick={() => takeBankLoan(amount)}
      >
        {C.finances.bankRequest} · {formatMoney(amount, { compact: true })}
      </Button>
      <p className="mt-2 text-xs text-faint">
        {C.finances.projected}: {formatMoney(balance + amount, { compact: true })}
      </p>
    </div>
  );
}

/** The Monday breakdown, line by line (positive in, negative out). */
function StatementLines({ st }: { st: WeeklyStatement }) {
  const C = useActiveCareerCopy();
  const rows: { key: keyof typeof C.finances.line; amount: number }[] = [
    { key: "sponsorBase", amount: st.sponsorBase },
    { key: "foundingPartner", amount: st.foundingPartner },
    { key: "rescuePartner", amount: st.rescuePartner },
    { key: "payroll", amount: -st.payroll },
    { key: "coach", amount: -st.coach },
    { key: "psychologist", amount: -st.psychologist },
    { key: "staff", amount: -st.staff },
    { key: "upkeep", amount: -st.upkeep },
    { key: "bankPayment", amount: -st.bankPayment },
    // rc.34 (ECO-04): a missed goal's fine instalment.
    { key: "sponsorFine", amount: -st.sponsorFine },
  ];
  return (
    <dl className="border-t border-line">
      {rows
        .filter((r) => r.amount !== 0)
        .map((r) => (
          <div
            key={r.key}
            className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0"
          >
            <dt className="text-sm text-sub">{C.finances.line[r.key]}</dt>
            <dd className={cx("display shrink-0 text-base font-semibold tabular-nums", r.amount >= 0 ? "text-good" : "text-bad")}>
              {formatMoneyDelta(r.amount)}
            </dd>
          </div>
        ))}
    </dl>
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
  const low = Math.min(...data);
  const high = Math.max(...data);
  const padding = Math.max((high - low) * 0.15, 1);
  const min = low - padding;
  const max = high + padding;
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
      className="h-20 w-full text-cyan"
      aria-hidden
    >
      {min < 0 && max > 0 ? (
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

/**
 * One step of the arsenal: a row of the purchase list, not a box. The item's
 * icon, its title (with the one state tag it may carry), what it does and its
 * notes on the left; on the right the deciding figure (the price) over the
 * action. Rows are separated by a hairline. A locked row is the same row,
 * one step quieter. On a phone the price and the action sit under the text.
 */
function LadderStep({
  status,
  rung,
  title,
  desc,
  badges,
  aside,
  notes,
}: {
  status: StepStatus;
  rung: LadderRungId;
  title: string;
  desc: string;
  badges?: React.ReactNode;
  aside?: React.ReactNode;
  notes?: React.ReactNode;
}) {
  const locked = status === "locked";
  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 last:pb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <RungIcon id={rung} className={cx("h-5 w-5 shrink-0", locked ? "text-faint" : "text-sub")} />
        <div className="min-w-0 flex-1">
          <h4 className={cx("display flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold uppercase leading-tight", locked ? "text-sub" : "text-ink")}>
            {title}
            {badges}
          </h4>
          <p className="mt-1 text-sm leading-snug text-sub">{desc}</p>
          {notes}
        </div>
      </div>
      {aside ? (
        <div className="flex shrink-0 items-center justify-between gap-3 pl-8 sm:min-w-28 sm:flex-col sm:items-end sm:justify-start sm:gap-2 sm:pl-0">
          {aside}
        </div>
      ) : null}
    </li>
  );
}

/** Keep the purchase list in the same gate order as HQ, including new staff. */
function OrderedProgression({ children }: { children: ReactNode }) {
  const order = ladderRungs().map(r => r.id);
  const steps = Children.toArray(children)
    .filter(isValidElement<{ rung: LadderRungId }>)
    .sort((a, b) => order.indexOf(a.props.rung) - order.indexOf(b.props.rung));
  return <ol className="border-t border-line">{steps}</ol>;
}

/**
 * The deciding figure of a purchase row: the price, set as a number. A base
 * price struck through sits beside it when a sponsor perk discounts it; a
 * locked row's price is quiet.
 */
function Price({ value, base, tone = "ink" }: { value: string; base?: string | null; tone?: "ink" | "good" | "quiet" }) {
  return (
    <span className="flex items-baseline gap-2">
      {base ? <s className="text-xs text-faint">{base}</s> : null}
      <span
        className={cx(
          "display text-xl font-bold leading-none tabular-nums",
          tone === "good" ? "text-good" : tone === "quiet" ? "text-faint" : "text-ink",
        )}
      >
        {value}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

// Job: say whether the club can pay the coming weeks. The one decision: spend
// (the next upgrade, a retainer) or bring money in (a sponsor, a loan).
// Hierarchy: the three figures as one strip (balance first and largest), then
// the purchase list beside the sponsor desk; loans and the ledger are reference.
export function FinancesScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  // rc.6 (ORGMODE UI-C): an established org reads its Standing where a founded club reads reputation.
  const C = useOrgCareerCopy(save);
  const D = C.dates;
  const lang = useSettings((s) => s.lang);

  const buyGear = useCareerStore((s) => s.buyGear);
  const setPsychologist = useCareerStore((s) => s.setPsychologist);
  const setStaff = useCareerStore((s) => s.setStaff);
  const runBootcamp = useCareerStore((s) => s.runBootcamp);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);
  const payDebt = useCareerStore((s) => s.payDebt);
  const payBankLoan = useCareerStore((s) => s.payBankLoan);

  const [ladderOpen, setLadderOpen] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  // rc.33 (UX-07): the expanded balance chart.
  const [chartOpen, setChartOpen] = useState(false);

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        {/* Loading skeleton: the title, the figure strip, the two columns. */}
        <div className="h-10 w-56 animate-pulse rounded-md bg-white/5" />
        <div className="h-56 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="h-[32rem] animate-pulse rounded-xl bg-white/5 lg:col-span-3" />
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <div className="h-56 animate-pulse rounded-xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const fin = save.finances;
  const gear = fin.gear;
  const rep = save.reputation;
  // rc.6 (ORGMODE E1/E2): an established org's shelf is open: its gates read the ladder's top, its installations any order.
  const established = establishedOf(save);
  const gateRep = gateRepOf(save);
  const sponsorTier = save.sponsor?.tier ?? null;

  // --- statement (v2.0: THE weekly statement the Monday funnel books) --------
  // rc.32: weeklyStatementOf — the season's money index and the founding partner.
  const statement = weeklyStatementOf(save);
  const { income, expenses, net } = statement;
  const projected = fin.balance + net;
  const nextPayday = nextPaydayFor(save.clock);
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
  const bootTier = bootcampTierFor(gateRep);
  const freeAllowance = sponsorFreeBootcampsOf(save.sponsor);
  const freeLeft = Math.max(0, freeAllowance - fin.freeBootcampsUsedThisSeason);
  const [gearFront, perfCenter] = [CAREER_GEAR.items.slice(0, 3), CAREER_GEAR.items[3]];

  const gearStatus = (item: (typeof CAREER_GEAR.items)[number]): StepStatus =>
    gear[item.id]
      ? "owned"
      : (established ? !capitalRefusalOf(save, item.id) : nextGear?.id === item.id) && gateRep >= item.repGate
        ? "next"
        : "locked";

  // One filled button on the screen: the next gear purchase, unless a sponsor
  // decision is waiting (its Sign buttons are the action then).
  const sponsorPending = Boolean(save.sponsorOffers && save.sponsorOffers.length > 0);

  const gearAside = (item: (typeof CAREER_GEAR.items)[number]): React.ReactNode => {
    const status = gearStatus(item);
    const price = gearPriceFor(item.cost, sponsorTier, seasonIndex);
    const base = gearPriceFor(item.cost, null, seasonIndex);
    if (status === "owned") return null;
    if (status === "next") {
      return (
        <>
          <Price
            value={formatMoney(price, { compact: true })}
            base={price < base ? formatMoney(base, { compact: true }) : null}
          />
          <Button variant={sponsorPending ? "secondary" : "primary"} size="sm" onClick={() => buyGear(item.id)}>
            {C.finances.buy}
          </Button>
        </>
      );
    }
    return <Price value={formatMoney(price, { compact: true })} tone="quiet" />;
  };

  const gearNotes = (item: (typeof CAREER_GEAR.items)[number]): React.ReactNode => {
    const status = gearStatus(item);
    return (
      <>
        {item.upkeepPerSplit > 0 ? (
          <p className="mt-1 text-xs text-faint">
            {C.finances.upkeepLabel(formatMoney(weeklyOf(item.upkeepPerSplit * flatIndex), { compact: true }))}
          </p>
        ) : null}
        {status === "locked" ? (
          <p className="mt-1 text-xs text-faint">
            {capitalRefusalOf(save, item.id)
              ? C.board.approval.needs(capitalApprovalFor(save, item.id) ?? 0)
              : gateRep < item.repGate
                ? C.finances.lockedAtRep(item.repGate)
                : C.common.locked}
          </p>
        ) : null}
      </>
    );
  };

  const bootcampStep = (tier: 1 | 2): React.ReactNode => {
    const def = CAREER_GEAR.bootcamp[tier - 1];
    const campCost = bootcampCostFor(tier, seasonIndex);
    const unlocked = gateRep >= def.repGate;
    const isActiveTier = bootTier === tier;
    const superseded = bootTier > tier;
    const status: StepStatus = superseded ? "owned" : isActiveTier ? "next" : "locked";
    const nextRunFree = freeLeft > 0;
    return (
      <LadderStep
        status={status}
        rung={tier === 1 ? "bootcamp1" : "bootcamp2"}
        title={tier === 1 ? C.finances.bootcampT1 : C.finances.bootcampT2}
        desc={`${tier === 1 ? C.finances.bootcampT1Desc : C.finances.bootcampT2Desc} ${C.toolbox.rating(String(CAREER_GEAR.bootcamp[tier - 1].sharpRating * (CAREER_GEAR.bootcampSpan === "split" ? CAREER_GEAR.bootcampSplitEdgeShare : 1)))}`}
        badges={
          superseded ? (
            <Badge tone="neutral">{C.finances.ownedLabel}</Badge>
          ) : isActiveTier ? (
            newTag(tier === 2 ? "bootcamp2" : "bootcamp1")
          ) : null
        }
        aside={
          isActiveTier ? (
            <>
              {/* A sponsor-paid run reads "Free" where the price would be, the price struck beside it. */}
              {nextRunFree ? (
                <Price value={C.common.free} base={formatMoney(campCost, { compact: true })} tone="good" />
              ) : (
                <Price value={formatMoney(campCost, { compact: true })} />
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={fin.bootcampUsedThisSplit}
                onClick={runBootcamp}
              >
                {C.finances.buy}
              </Button>
            </>
          ) : !unlocked ? (
            <Price value={formatMoney(campCost, { compact: true })} tone="quiet" />
          ) : undefined
        }
        notes={
          <>
            {isActiveTier && fin.bootcampUsedThisSplit ? (
              <p className="mt-1 text-xs text-faint">
                {C.finances.bootcampUsed}
              </p>
            ) : null}
            {/* rc.34 (UX-01f, 5-A): the edge lasts the split, so its end date is stated. */}
            {isActiveTier && fin.bootcampSharp > 0 && fin.bootcampUntil ? (
              <p className="mt-1 text-xs text-good">
                {C.finances.bootcampUntil(formatDateTiny(D, dateOfDay(fin.bootcampUntil.seasonIndex, fin.bootcampUntil.day)))}
              </p>
            ) : null}
            {isActiveTier && freeLeft > 0 ? (
              <p className="mt-1 text-xs text-sub">
                {C.finances.freeBootcampLeft(freeLeft)}
              </p>
            ) : null}
            {!unlocked ? (
              <p className="mt-1 text-xs text-faint">
                {C.finances.lockedAtRep(def.repGate)}
              </p>
            ) : null}
          </>
        }
      />
    );
  };

  const psychUnlocked = gateRep >= CAREER_GEAR.psychologistRep;
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
    // The perks are sentences, so they read as a short list, not as tags.
    return chips.length > 0 ? (
      <ul className="mt-1 space-y-0.5 text-xs text-sub">
        {chips.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    ) : (
      <p className="mt-1 text-xs text-faint">{C.finances.perkNone}</p>
    );
  };

  const sponsorMoneyLine = (s: SponsorState): React.ReactNode => (
    <>
      <p className="display mt-2 text-xl font-bold leading-none tabular-nums text-good">
        {C.finances.perWeekBase(formatMoney(weeklyOf(s.basePerSplit), { compact: true }))}
      </p>
      <p className="mt-1 text-xs text-sub">{C.finances.bonusFor(formatMoney(s.bonus, { compact: true }))}</p>
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
      {/* rc9 ORG-UI (#272): no kicker; the statement's rows say what moves on a Monday. */}
      <SectionTitle title={C.finances.title} className="rise-in" />

      <FinanceErrorNotice className="rise-in" />

      {/* rc9 ORG-UI (#272): an established org's money is ONE board whose figures add up
          (seasonMoneyOf); the season budget card and the founded strip under it repeated it. */}
      {established ? <SeasonMoneyBoard save={save} C={C} onChart={() => setChartOpen(true)} className="rise-in" /> : null}

      {/* The books as ONE strip of three figures (the 1px gaps are its
          dividers): what is in the bank, what a Monday does to it, where that
          leaves it. Each cell is the figure first and large, its label under
          it, then the detail that explains it. A founded club's. */}
      {established ? null : (
      <div
        id="career-finance-summary"
        data-tour="finances-overview"
        className="rise-in grid scroll-mt-44 grid-cols-1 gap-px overflow-hidden rounded-xl border border-line-strong bg-line md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
      >
        {/* Balance: the figure of the screen, its history and how long it lasts. */}
        <div className="flex min-w-0 flex-col bg-surface-strong p-4 sm:p-5">
          <p className={cx("display text-4xl font-extrabold leading-none tabular-nums sm:text-5xl md:text-4xl lg:text-5xl", fin.balance < 0 ? "text-bad" : "text-ink")}>{formatMoney(fin.balance)}</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs text-sub">
            {C.finances.balance}
            <MoneyChange save={save} />
          </p>
          <button
            type="button"
            onClick={() => setChartOpen(true)}
            aria-label={C.finances.chartOpen}
            title={C.finances.chartOpen}
            className="group my-4 flex min-h-20 w-full items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-bright"
          >
            <span className="min-w-0 flex-1">
              {sparkTail.length >= 2 ? (
                <BalanceSparkline data={sparkTail} />
              ) : (
                <span className="flex h-20 items-center border-b border-dashed border-line text-xs leading-snug text-faint">{C.finances.chartEmpty}</span>
              )}
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-ink" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="mt-auto space-y-1 border-t border-line pt-3">
            <p className={cx("text-sm", runway === null ? "text-good" : runway <= CAREER_PAYROLL.runwayWarnWeeks ? "text-bad" : "text-ink")}>{runway === null ? C.finances.runwayOk : C.finances.runway(runway)}</p>
            {fin.loan ? <p className="text-xs text-bad">{C.finances.backerRemaining(formatMoney(fin.loan.remaining, { compact: true }))}</p> : null}
            {fin.bankLoan ? <p className="text-xs text-sub">{C.finances.bankRemaining(formatMoney(fin.bankLoan.remaining, { compact: true }))}</p> : null}
          </div>
        </div>

        {/* A Monday: the net, then the lines that make it. */}
        <div className="flex min-w-0 flex-col bg-surface p-4 sm:p-5">
          <p className={cx("display text-4xl font-extrabold leading-none tabular-nums", net >= 0 ? "text-good" : "text-bad")}>{formatMoneyDelta(net, { compact: true })}</p>
          <p className="mt-2 text-xs text-sub">
            {C.finances.net} · {C.finances.payday} {formatDateTiny(D, dateOfDay(nextPayday.seasonIndex, nextPayday.day))}
          </p>
          <h3 className="kicker mb-1.5 mt-4">{C.finances.weeklyStatement}</h3>
          <StatementLines st={statement} />
        </div>

        {/* After Monday, and at the end of the split. */}
        <div className="flex min-w-0 flex-col bg-surface p-4 sm:p-5">
          <p className={cx("display text-4xl font-extrabold leading-none tabular-nums", projected < 0 ? "text-bad" : "text-ink")}>{formatMoney(projected, { compact: true })}</p>
          <p className="mt-2 text-xs text-sub">{C.finances.projected}</p>
          <dl className="mb-3 mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div className="flex flex-col-reverse justify-end gap-1">
              <dt className="text-xs text-sub">{C.finances.income}</dt>
              <dd className="display text-2xl font-bold leading-none tabular-nums text-good">{formatMoney(income, { compact: true })}</dd>
            </div>
            <div className="flex flex-col-reverse justify-end gap-1">
              <dt className="text-xs text-sub">{C.finances.expenses}</dt>
              <dd className="display text-2xl font-bold leading-none tabular-nums text-bad">{formatMoney(expenses, { compact: true })}</dd>
            </div>
          </dl>
          {save.phase !== "ended" ? <p className={cx("mt-auto border-t border-line pt-3 text-xs leading-relaxed", projection.balance < 0 ? "text-bad" : "text-sub")}>{C.finances.projectionSplit(formatDateTiny(D, dateOfDay(projection.seasonIndex, projection.day)), formatMoney(projection.balance, { compact: true }))}</p> : null}
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
        {/* Phone: money first (sponsors, the ledger, the loans), the ladder after
            them (it is the longest board of the screen and was pushing them down). */}
        <div className="flex min-w-0 flex-col gap-4 max-sm:order-2 lg:col-span-3">
        {/* rc.6 (ORGMODE UI-C): an established org runs Operations; a founded club climbs the ladder. */}
        {established ? (
          <OperationsBoard save={save} C={C} primaryAllowed={!sponsorPending} className="rise-in" />
        ) : (
        /* ================= THE GEAR LADDER (centerpiece) ================= */
        <Panel id="career-ladder" data-tour="finances-progress" className="rise-in scroll-mt-20 p-4 sm:p-5" style={{ animationDelay: "60ms" }}>
          {/* The board's title, and the one number that opens its rows: reputation. */}
          <div className="card-head">
            <h3 className="card-title">{C.ladder.title}</h3>
            <p className="shrink-0 text-right">
              <span className="display block text-2xl font-bold leading-none tabular-nums text-ink">{Math.round(rep)}</span>
              <span className="mt-1 block text-xs text-sub">{C.common.reputation}</span>
            </p>
          </div>

          {/* Every step, in gate order, as one list: a row each, the price on the right. */}
          <OrderedProgression>
            {/* 1-3 · peripherals, monitors, PCs */}
            {gearFront.map((item) => (
              <LadderStep
                key={item.id}
                status={gearStatus(item)}
                rung={item.id}
                title={C.finances.gear[item.id as keyof typeof C.finances.gear]}
                desc={C.finances.gearDesc[item.id as keyof typeof C.finances.gearDesc]}
                badges={
                  gear[item.id] ? <Badge tone="neutral">{C.finances.ownedLabel}</Badge> : newTag(item.id)
                }
                aside={gearAside(item)}
                notes={gearNotes(item)}
              />
            ))}

            {/* 4-5 · bootcamps (consumables, one run per split) */}
            {bootcampStep(1)}
            {bootcampStep(2)}

            {/* 6 · sports psychologist (rolling retainer): the weekly cost is its price. */}
            <LadderStep
              status={psychStatus}
              rung="psychologist"
              title={C.finances.psychologist}
              desc={C.finances.psychologistDesc(CAREER_GEAR.psychologistStatBonus.clutch, CAREER_GEAR.psychologistStatBonus.consistency)}
              badges={
                gear.psychologist ? <Badge tone="good">{C.finances.retainedLabel}</Badge> : newTag("psych")
              }
              aside={
                <>
                  <Price
                    value={C.squad.perWeek(formatMoney(weeklyOf(psychologistPerSplitFor(seasonIndex)), { compact: true }))}
                    tone={gear.psychologist || psychUnlocked ? "ink" : "quiet"}
                  />
                  {gear.psychologist ? (
                    <Button variant="ghost" size="sm" onClick={() => setPsychologist(false)}>
                      {C.finances.dropLabel}
                    </Button>
                  ) : psychUnlocked ? (
                    <Button variant="secondary" size="sm" onClick={() => setPsychologist(true)}>
                      {C.finances.hireLabel}
                    </Button>
                  ) : null}
                </>
              }
              notes={
                !psychUnlocked ? (
                  <p className="mt-1 text-xs text-faint">
                    {C.finances.lockedAtRep(CAREER_GEAR.psychologistRep)}
                  </p>
                ) : null
              }
            />

            {/* rc.45 (R120) · support staff (rolling retainers) */}
            {CAREER_STAFF.order.map((id) => {
              const role = CAREER_STAFF.roles[id];
              const on = staffOn(gear, id);
              const open = gateRep >= role.repGate;
              const weekly = formatMoney(weeklyOf(staffPerSplitFor(id, seasonIndex)), { compact: true });
              return (
                <LadderStep
                  key={id}
                  status={on ? "owned" : open ? "next" : "locked"}
                  rung={id}
                  title={C.finances.staff[id].title}
                  desc={C.finances.staff[id].desc}
                  badges={on ? <Badge tone="good">{C.finances.retainedLabel}</Badge> : null}
                  aside={
                    <>
                      <Price value={C.squad.perWeek(weekly)} tone={on || open ? "ink" : "quiet"} />
                      {on ? (
                        <Button variant="ghost" size="sm" onClick={() => setStaff(id, false)}>
                          {C.finances.dropLabel}
                        </Button>
                      ) : open ? (
                        <Button variant="secondary" size="sm" onClick={() => setStaff(id, true)}>
                          {C.finances.hireLabel}
                        </Button>
                      ) : null}
                    </>
                  }
                  notes={!open ? <p className="mt-1 text-xs text-faint">{C.finances.lockedAtRep(role.repGate)}</p> : null}
                />
              );
            })}

            {/* 7 · Performance Center (the summit) */}
            <LadderStep
              status={gearStatus(perfCenter)}
              rung={perfCenter.id}
              title={C.finances.gear[perfCenter.id as keyof typeof C.finances.gear]}
              desc={`${C.finances.gearDesc[perfCenter.id as keyof typeof C.finances.gearDesc]} ${C.toolbox.rating(String(perfCenter.ratingBonus))}`}
              badges={
                gear[perfCenter.id] ? <Badge tone="neutral">{C.finances.ownedLabel}</Badge> : newTag(perfCenter.id)
              }
              aside={gearAside(perfCenter)}
              notes={gearNotes(perfCenter)}
            />
          </OrderedProgression>
          <Button variant="ghost" size="sm" className="-ml-3.5 mt-2" onClick={() => setLadderOpen(true)}>{C.ladder.seeMore}</Button>
          <Modal open={ladderOpen} title={C.ladder.title} onClose={() => setLadderOpen(false)}><LadderGrid rungs={ladderOf(save)} C={C} /></Modal>
        </Panel>
        )}

        </div>

        {/* ================= right column: sponsors + ledger ================= */}
        <div className="flex min-w-0 flex-col gap-4 max-sm:order-1 lg:col-span-2">
          {/* Sponsors */}
          <Panel id="career-sponsors" data-tour="finances-sponsor" className="rise-in scroll-mt-44 p-4 sm:p-5" style={{ animationDelay: "160ms" }}>
            <div className="card-head"><h3 className="card-title">{C.finances.sponsors}</h3></div>

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
                    <p className="kicker">{C.finances.sponsorObjective}</p>
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
                  <span className="text-[11px] text-faint">
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
                <p className="kicker mb-2">{C.finances.offerTitle}</p>
                <SponsorDecision save={save} onSign={chooseSponsor} bare />
              </div>
            ) : save.sponsorOffers && save.sponsorOffers.length > 0 ? (
              <div className={cx(save.sponsor && "mt-3")}>
                <p className="kicker mb-2">{C.finances.offerTitle}</p>
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
                <p className="kicker">{C.finances.deal.otherIncome}</p>
                <p className="mt-0.5 text-xs text-sub">
                  {C.finances.deal.otherIncomeLine(
                    formatMoney(otherRoom.taken, { compact: true }),
                    formatMoney(otherRoom.cap, { compact: true }),
                    CAREER_SPONSOR.otherIncome.perSplitCap - otherRoom.count,
                    CAREER_SPONSOR.otherIncome.perSplitCap,
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {C.finances.deal.otherIncomeHint(
                    Math.round(CAREER_SPONSOR.otherIncome.seasonShare * 100),
                    CAREER_SPONSOR.otherIncome.perSplitCap,
                  )}
                </p>
              </div>
            ) : null}

            {established && !save.sponsor && (!save.sponsorOffers || save.sponsorOffers.length === 0) ? (
              <p className="text-sm text-sub">{C.orgmode.budget.sponsorNone}</p>
            ) : !save.sponsor && (!save.sponsorOffers || save.sponsorOffers.length === 0) ? (
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
                <p className="mt-1.5 text-[11px] text-faint">
                  {C.common.reputation} {Math.round(rep)} / {CAREER_SPONSOR.firstOfferRepGate}
                </p>
              </div>
            ) : null}
          </Panel>

      {/* ================= Loans & debt (always visible below progression) ================= */}
      {/* Two boards, one per loan (they were two boxes inside a board whose title repeated theirs). */}
      <section data-tour="finances-loans" aria-label={C.finances.loans} className="rise-in flex flex-col gap-4 max-sm:order-1">
          {/* Bank */}
          <div className={cx("panel p-4 sm:p-5", fin.bankLoan && "panel-glow-blue")}>
            <div className="card-head">
              <h3 className="card-title">{C.finances.bankTitle}</h3>
            </div>
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
                <p className="mt-2 text-[11px] text-faint">{C.finances.bankBlockedActive}</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-sub">
                  {(nextBreach === "insolvent" ? C.finances.bankHintEnd : C.finances.bankHint)(
                    CAREER_BANK.termWeeks,
                    Math.round(CAREER_BANK.interestPct * 100),
                  )}
                </p>
                <BankLoanRequest
                  fin={fin}
                  rep={rep}
                  balance={fin.balance}
                  seasonIndex={seasonIndex}
                  suggested={creditOfferOf(save)}
                />
              </>
            )}
          </div>

          {/* rc.34 (Miguel, 31/10): the bank's emergency loan (rc.31–rc.33: the Emergency Backer) —
              what is owed, the deadline and what happens on it, how it is repaid, the top-ups,
              what the next breach does; the rule on this difficulty when nothing is owed. */}
          <div className={cx("panel p-4 sm:p-5", fin.loan ? "panel-glow-orange" : fin.loanUsed ? "!border-bad/40" : "")}>
            <div className="card-head">
              <h3 className="card-title">{C.finances.backer}</h3>
            </div>
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
      </section>

          {/* Ledger */}
          <Panel className="rise-in flex flex-col p-4 sm:p-5" style={{ animationDelay: "200ms" }}>
            {/* Phone: the three filters are a strip of tabs under the title. Beside it
                they ran 8px past the screen's edge and widened the whole page. */}
            <div className="card-head max-sm:flex-wrap">
              <p className="card-title">{C.finances.ledger}</p>
              <div className="phone-tabs max-sm:-mb-3 max-sm:w-full max-sm:!border-b-0 sm:flex sm:gap-1.5">
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
                      "display inline-flex min-h-8 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
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
              <p className="mb-2 text-[11px] text-faint">{C.finances.playerShareRule}</p>
            ) : null}
            {ledgerGroups.length === 0 ? (
              <p className="py-6 text-center text-xs text-faint">-</p>
            ) : (
              <div className="-mr-2 max-h-[26rem] space-y-3 overflow-y-auto pr-2">
                {ledgerGroups.map((g) => (
                  <div key={g.key}>
                    <p className="kicker mb-1">{g.label}</p>
                    {/* rc9 ORG-UI (#272): rows under hairlines, no box per day; the reference reads as a name
                        (a sponsor's brand, an org facility), never as a raw id. */}
                    <div className="border-t border-line">
                      {g.items.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0"
                        >
                          <span className="min-w-0 truncate text-ink">
                            {C.finances.ledgerKind[e.kind]}
                            {e.refName ? (
                              <span className="text-faint"> · {sponsorBrandById.get(e.refName)?.name ?? ledgerRefNameOf(C, e.refName, established)}</span>
                            ) : null}
                          </span>
                          <span
                            className={cx(
                              "shrink-0 tabular-nums",
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
        <BalanceHistory ring={balanceHistoryOf(save)} />
      </Modal>
    </div>
  );
}
