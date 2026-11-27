/**
 * v2.2 rc.6 (ORGMODE E3): the season budget as a reading of the books. Pure.
 *
 * No money rule lives here: the board's allocation is what `offerSeason`
 * offered and the package paid (`boardGrant`), the committed lines are the
 * Monday statement (economy.weeklyStatement, the same numbers the Monday
 * funnel books) times the Mondays left, and "spent" and "income" sum this
 * season's ledger by kind. The Finances screen of an established org draws it.
 *
 * The ledger keeps its last CAREER_SAVE.ledgerTailCap entries, which is less
 * than a full season of Monday lines: `ledgerFromWeek` says from which week
 * this season's "spent" and "income" are complete (1 = the whole season).
 *
 * rc.6 (R170), the income lines against the ledger: sponsor = sponsorBase (the
 * deal's weekly pay), sponsorBonus, sponsorSigning, sponsorMilestone and the
 * founding partner; prizes = prize net of playerShare; fanbase = the Monday
 * fanbase line, which is 0 in every career while
 * CAREER_ECONOMY.passivePerRepPoint is 0 (the line exists, it pays nothing);
 * sales = transferIn. The contracted projection counts the deal's base for its
 * own Mondays (through `terms.endsOn`) and the fanbase for the Mondays left.
 */

import { CAREER_CALENDAR } from "@/config/balance";
import type { BoardState } from "./boardTypes";
import { weekOfDay } from "./calendar";
import { foundingPartnerBaseFor, moneyIndex, quantize, weeklyStatement, type WeeklyStatement } from "./economy";
import type { CareerSave, LedgerKind } from "./types";

/** The wage ceiling in this season's money (the board sized it in its own season's). */
export function wageCeilingOf(board: Pick<BoardState, "wageRoom" | "startSeason">, seasonIndex: number): number {
  return quantize(board.wageRoom * (moneyIndex(seasonIndex) / moneyIndex(board.startSeason)));
}

/** The season's budget base in this season's money: `grantBase` (fixed at the takeover) on the money index. */
export function grantBaseNow(board: Pick<BoardState, "grantBase" | "startSeason">, seasonIndex: number): number {
  return quantize(board.grantBase * (moneyIndex(seasonIndex) / moneyIndex(board.startSeason)));
}

export type SpentLine = "wages" | "staff" | "facilities" | "camps" | "transfers" | "other";
export type IncomeLine = "sponsor" | "prizes" | "fanbase" | "sales";
export type CommittedLine = "wages" | "coach" | "staff" | "upkeep" | "loan";

export interface SeasonBudget {
  seasonIndex: number;
  /** The board's money this season (the package's budget + upfront), 0 before the choice. */
  allocation: number;
  /** The package's bonus while its objective is not settled (0 after it, or with no package). */
  bonusAtStake: number;
  /** What the rest of the season will book, by line (weekly statement × Mondays left). */
  committed: Record<CommittedLine, number>;
  committedTotal: number;
  /** Booked so far this season, by line (positive amounts). */
  spent: Record<SpentLine, number>;
  spentTotal: number;
  /** Received so far this season, by line. */
  income: Record<IncomeLine, number>;
  /** Contracted to come (sponsor base and fanbase × Mondays left). */
  incomeToCome: Record<IncomeLine, number>;
  /** Balance + contracted income to come − committed. */
  free: number;
  /** The balance at the season's end at this pace (= free), and with the bonus earned. */
  projectedEnd: number;
  projectedEndIfMet: number;
  /** Weekly wages (squad + coach), the board's ceiling (null without a board), over it? */
  wageBill: number;
  wageCeiling: number | null;
  overCeiling: boolean;
  /** Weeks of the wage bill the allocation covers. */
  weeksCovered: number;
  /** Mondays left in the season (the committed lines' multiplier). */
  mondaysLeft: number;
  /** The first week this season's ledger is complete from (1 = all of it). */
  ledgerFromWeek: number;
}

const SPENT_OF: Partial<Record<LedgerKind, SpentLine>> = {
  payroll: "wages",
  salary: "wages",
  coachSalary: "wages",
  severance: "wages",
  releaseFee: "wages",
  standInFee: "wages",
  facility: "facilities",
  upkeep: "facilities",
  transferOut: "transfers",
  signingBonus: "transfers",
};

const INCOME_OF: Partial<Record<LedgerKind, IncomeLine>> = {
  sponsorBase: "sponsor",
  sponsorBonus: "sponsor",
  sponsorSigning: "sponsor",
  sponsorMilestone: "sponsor",
  foundingPartner: "sponsor",
  prize: "prizes",
  playerShare: "prizes",
  fanbase: "fanbase",
  transferIn: "sales",
};

/** Not income, not spending: the board's own money and borrowed money. */
const NEUTRAL: ReadonlySet<LedgerKind> = new Set(["boardGrant", "boardBonus", "loanGrant", "bankLoan", "rescuePartner"]);

function statementOf(save: CareerSave): WeeklyStatement {
  return weeklyStatement({
    squadSalaries: save.squad.map((p) => ({ name: p.name, amount: p.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    sponsor: save.sponsor,
    rep: save.reputation,
    gear: save.finances.gear,
    bankLoan: save.finances.bankLoan ?? null,
    seasonIndex: save.clock.seasonIndex,
    foundingPartnerPerSplit: foundingPartnerBaseFor(save.foundingPartner, save.clock.seasonIndex),
    rescuePartner: save.finances.rescuePartner ?? null,
    sponsorFines: save.finances.sponsorFines ?? null,
  });
}

/** The season's budget, spent, committed and free (null without a board). */
export function seasonBudgetOf(save: CareerSave): SeasonBudget | null {
  const board = save.board;
  if (!board) return null;
  const s = save.clock.seasonIndex;
  const week = weekOfDay(save.clock.day);
  // The Monday of the current week is booked on arrival: the Mondays still to come are the weeks after it.
  const mondaysLeft = save.phase === "running" ? Math.max(0, CAREER_CALENDAR.weeksPerSeason - week) : 0;
  const st = statementOf(save);

  const spent: Record<SpentLine, number> = { wages: 0, staff: 0, facilities: 0, camps: 0, transfers: 0, other: 0 };
  const income: Record<IncomeLine, number> = { sponsor: 0, prizes: 0, fanbase: 0, sales: 0 };
  let allocation = 0;
  const mine = save.finances.ledger.filter((e) => e.seasonIndex === s);
  for (const e of mine) {
    if (e.kind === "boardGrant") {
      allocation += e.amount;
      continue;
    }
    if (NEUTRAL.has(e.kind)) continue;
    const inc = INCOME_OF[e.kind];
    if (inc) {
      income[inc] += e.amount;
      continue;
    }
    if (e.amount >= 0) continue;
    const line: SpentLine =
      e.kind === "buff" ? (e.refName === "Bootcamp" ? "camps" : e.refName ? "other" : "staff") : (SPENT_OF[e.kind] ?? "other");
    spent[line] += -e.amount;
  }
  const oldest = save.finances.ledger[0];
  const ledgerFromWeek = oldest && oldest.seasonIndex === s ? oldest.week : 1;

  const committed: Record<CommittedLine, number> = {
    wages: st.payroll * mondaysLeft,
    coach: st.coach * mondaysLeft,
    staff: (st.psychologist + st.staff) * mondaysLeft,
    upkeep: st.upkeep * mondaysLeft,
    loan: Math.min(st.bankPayment * mondaysLeft, save.finances.bankLoan?.remaining ?? 0),
  };
  const committedTotal = committed.wages + committed.coach + committed.staff + committed.upkeep + committed.loan;
  // rc.6 (R170): a deal pays through its `endsOn` Monday, so a deal that ends this season counts its own Mondays only.
  const ends = save.sponsor?.terms?.endsOn;
  const sponsorMondays = ends && ends.seasonIndex === s ? Math.max(0, Math.min(mondaysLeft, weekOfDay(ends.day) - week)) : mondaysLeft;
  const incomeToCome: Record<IncomeLine, number> = {
    sponsor: st.sponsorBase * sponsorMondays + st.foundingPartner * mondaysLeft,
    prizes: 0,
    fanbase: st.fanbase * mondaysLeft,
    sales: 0,
  };
  const free = save.finances.balance + incomeToCome.sponsor + incomeToCome.fanbase - committedTotal;

  const season = board.season?.seasonIndex === s ? board.season : null;
  const pkg = season?.choice ? season.offers.find((o) => o.id === season.choice) : undefined;
  const bonusAtStake = pkg && season?.met === null ? pkg.bonus : 0;
  const wageBill = st.payroll + st.coach;
  const wageCeiling = board.kind === "board" ? wageCeilingOf(board, s) : null;
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return {
    seasonIndex: s,
    allocation,
    bonusAtStake,
    committed,
    committedTotal,
    spent,
    spentTotal: sum(spent),
    income,
    incomeToCome,
    free,
    projectedEnd: free,
    projectedEndIfMet: free + bonusAtStake,
    wageBill,
    wageCeiling,
    overCeiling: wageCeiling !== null && wageBill > wageCeiling,
    weeksCovered: wageBill > 0 ? Math.floor(allocation / wageBill) : 0,
    mondaysLeft,
    ledgerFromWeek,
  };
}

// ---------------------------------------------------------------------------
// rc9 org (R223): one truth for the money
// ---------------------------------------------------------------------------

/**
 * Why the Finances screen read two figures that did not match: the season
 * budget (`allocation`, the board's payment, 1.3M) and the cash (`balance`,
 * 1.8M) are not two pots. The board pays its budget INTO the cash once, when
 * the mandate is read; the cash also holds what the org had before that
 * payment (its runway at the takeover, last season's money after it) and
 * moves every week with income and spending. So
 *
 *   cash = openingCash + allocation + netSince
 *
 * and the gap between the two figures is `openingCash + netSince`. Every
 * figure below is read from the same books, so they reconcile by construction:
 *
 *   projectedEnd = cash + incomeToCome.total − commitments.total
 *   freeToSpend  = projectedEnd − keepBack.amount
 */

export interface SeasonMoney {
  seasonIndex: number;
  /** Cash today (the balance). */
  cash: number;
  /** What the rest of the season still commits, by line (the Monday statement × the Mondays left). */
  commitments: { payroll: number; coach: number; retainers: number; upkeep: number; loan: number; total: number };
  /** Income still contracted this season (the sponsor's weekly pay through its last Monday, the fanbase). Prizes and sales are not counted. */
  incomeToCome: { sponsor: number; fanbase: number; total: number };
  /** The cash at the season's end at this pace. */
  projectedEnd: number;
  /**
   * What the board's plan keeps back from the season's end: the money goal's cash floor, or the
   * part of the end that the net-spend cap does not let the transfer market reach. 0 with no plan line.
   */
  keepBack: { amount: number; reason: "cashFloor" | "transferCap" | "none" };
  /** What the manager can spend this season and still meet the plan (negative: the plan is already short). */
  freeToSpend: number;
  /** The board's budget this season: paid (in the cash) or proposed (paid when the mandate is read). */
  budget: { amount: number; paid: boolean };
  /**
   * Budget to cash: cash = opening + allocation + netSince. Null when the opening is not known (an
   * older save whose ledger no longer holds the board's payment).
   */
  bridge: { opening: number; allocation: number; netSince: number } | null;
  /** The one sentence that explains the gap between the budget and the cash (the copy's key). */
  gap: "pending" | "carried" | "carriedAndSpent" | "carriedAndEarned" | "spent" | "earned" | "same" | "unknown";
}

/** An established org's money as one summary whose figures reconcile (null without a board). */
export function seasonMoneyOf(save: CareerSave): SeasonMoney | null {
  const b = seasonBudgetOf(save);
  const board = save.board;
  if (!b || !board) return null;
  const s = save.clock.seasonIndex;
  const season = board.season?.seasonIndex === s ? board.season : null;
  const cash = save.finances.balance;
  const c = b.committed;
  const commitments = { payroll: c.wages, coach: c.coach, retainers: c.staff, upkeep: c.upkeep, loan: c.loan, total: b.committedTotal };
  const incomeToCome = { sponsor: b.incomeToCome.sponsor, fanbase: b.incomeToCome.fanbase, total: b.incomeToCome.sponsor + b.incomeToCome.fanbase };
  const projectedEnd = cash + incomeToCome.total - commitments.total;

  const money = season?.mandate?.money;
  let keepBack: SeasonMoney["keepBack"] = { amount: 0, reason: "none" };
  if (money?.kind === "cashFloor") keepBack = { amount: money.amount, reason: "cashFloor" };
  else if (money?.kind === "netSpend") {
    const t = save.finances.transferTally;
    const net = t && t.seasonIndex === s ? t.out - t.in : 0;
    const room = Math.max(0, money.amount - net);
    keepBack = { amount: Math.max(0, projectedEnd - room), reason: "transferCap" };
  }
  const freeToSpend = projectedEnd - keepBack.amount;

  const pending = season !== null && season.choice === null;
  const proposed = pending ? (season!.offers.find((o) => o.id === "expected") ?? season!.offers[0])?.grant ?? 0 : 0;
  const budget = { amount: pending ? proposed : b.allocation, paid: !pending };
  const opening = season?.openingCash;
  const bridge = opening === undefined ? null : { opening, allocation: b.allocation, netSince: cash - opening - b.allocation };

  let gap: SeasonMoney["gap"];
  if (pending) gap = "pending";
  else if (!bridge) gap = "unknown";
  else {
    const carried = Math.abs(bridge.opening) > 0;
    const moved = bridge.netSince === 0 ? 0 : Math.sign(bridge.netSince);
    gap = carried ? (moved < 0 ? "carriedAndSpent" : moved > 0 ? "carriedAndEarned" : "carried") : moved < 0 ? "spent" : moved > 0 ? "earned" : "same";
  }
  return { seasonIndex: s, cash, commitments, incomeToCome, projectedEnd, keepBack, freeToSpend, budget, bridge, gap };
}
