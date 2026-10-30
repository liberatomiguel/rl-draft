/**
 * Road to Worlds — HQ's figures (rc.34, ROADMAP UX-01 b/d/e/f; HQ-CONTRACT
 * H2, H4–H6, contract (h): "HQ shows engine truth").
 *
 * Read-side view-models over the save, built ONLY from the functions the
 * owning screens read: the Finances desk's statement, runway and debts
 * (`weeklyStatementOf`, `runwayWeeksOf`, the bank and Backer state), the gear
 * ladder's prices and gates (economy.ts), the toolbox flows' own refusals
 * (dry-run), the direct-8 seeding (`userIsDirect`, R45) and the squad
 * screen's growth / band helpers. No React: the hub's blocks only render
 * these, and Finances reads the same projection.
 */

import { CAREER_CALENDAR, CAREER_GEAR, CAREER_SPONSOR } from "@/config/balance";
import {
  DAYS_PER_SEASON,
  dayOfWeekOf,
  officialEventDefsForWeek,
  splitEndDayFor,
  weekAt,
  weekOfDay,
} from "@/engine/career/calendar";
import type { ToolboxItemId } from "@/engine/career/careerNew";
import {
  bootcampCostFor,
  bootcampTierFor,
  gearNextItem,
  gearPriceFor,
  moneyIndex,
  nextPaydayFor,
  psychologistPerSplitFor,
  quantize,
  weeklyOf,
} from "@/engine/career/economy";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import { committedSeedingFor } from "@/engine/career/worldSim";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import {
  backerLineOf,
  buyGearFlow,
  runBootcampFlow,
  runwayWeeksOf,
  setPsychologistFlow,
  userIsDirect,
  weeklyStatementOf,
} from "./careerFlow";

// ---------------------------------------------------------------------------
// H5 — the finance block (decision 4-A's chart reads mondayBalancesOf)
// ---------------------------------------------------------------------------

export interface HqFinance {
  balance: number;
  /** Next Monday's net (Finances' "weekly net"). */
  net: number;
  /** Weeks of runway at that net (Finances' runway line); null = not burning. */
  runway: number | null;
  /** The next payroll: its Monday and the week's expenses it books (the statement's expenses). */
  payroll: { seasonIndex: number; day: number; amount: number };
  /**
   * The balance at the end of the split (its last day, `splitEndDayFor`) from
   * committed flows only — every Monday's statement, the bank's instalments
   * running out, the rescue partner's remaining Mondays, the sponsor fines'
   * instalments until each is paid (rc.34 review; as the Monday funnel books
   * them: never below the floor) — and no prize money.
   */
  projection: { seasonIndex: number; day: number; mondays: number; balance: number };
}

/** HQ's finance block — every figure from the Finances desk's own functions. */
export function hqFinanceOf(save: CareerSave): HqFinance {
  const fin = save.finances;
  const st = weeklyStatementOf(save);
  const payday = nextPaydayFor(save.clock);
  const bank = fin.bankLoan ?? null;
  const rescue = fin.rescuePartner ?? null;
  const partner = st.foundingPartner + st.rescuePartner;

  // The projection: Mondays after today up to the split's last day.
  const endDay = splitEndDayFor(save.clock.day);
  let balance = fin.balance;
  let mondays = 0;
  let bankLeft = bank?.remaining ?? 0;
  let partnerLeft = rescue?.mondaysLeft ?? 0;
  let finesLeft = (fin.sponsorFines ?? []).map((f) => ({ ...f }));
  const fixedIncome = st.sponsorBase + st.foundingPartner + st.fanbase;
  const fixedCost = st.payroll + st.coach + st.psychologist + st.upkeep;
  // rc.34 review: the fines' floor is the Monday funnel's (economy.weeklyPayroll: on the wage bill booked).
  const floor = backerLineOf(save).floor;
  for (let day = save.clock.day + 1; day <= endDay && day <= DAYS_PER_SEASON; day++) {
    if (dayOfWeekOf(day) !== 1) continue;
    mondays += 1;
    const help = partnerLeft > 0 ? st.rescuePartner : 0;
    partnerLeft = Math.max(0, partnerLeft - 1);
    const instalment = bank ? Math.min(bankLeft, bank.weeklyPayment) : 0;
    bankLeft -= instalment;
    balance += fixedIncome + help - fixedCost - instalment;
    // Each fine's instalment until it is paid; with `neverBreaches` what would cross the floor is waived.
    for (const f of finesLeft) {
      const due = Math.max(0, Math.min(f.remaining, f.perMonday));
      const room = CAREER_SPONSOR.fines.neverBreaches ? quantize(Math.max(0, balance - floor)) : due;
      balance -= Math.min(due, room);
      f.remaining -= due;
    }
    finesLeft = finesLeft.filter((f) => f.remaining > 0);
  }

  return {
    balance: fin.balance,
    net: st.net,
    runway: save.phase === "ended" ? null : runwayWeeksOf(save, st.net),
    payroll: { seasonIndex: payday.seasonIndex, day: payday.day, amount: st.expenses },
    projection: { seasonIndex: save.clock.seasonIndex, day: endDay, mondays, balance },
  };
}

// ---------------------------------------------------------------------------
// H6 — the toolbox (decision 7-A: buy on HQ with a confirm sheet)
// ---------------------------------------------------------------------------

export type ToolboxStatus =
  | "owned" // gear installed / the psychologist retained
  | "active" // the bootcamp edge running now (its end in `until`)
  | "buyable" // can be bought now (the flow may still refuse on money: see toolboxRefusalOf)
  | "used" // the bootcamp already ran this split
  | "queued" // gear unlocked by reputation, after the previous rung of the ladder
  | "superseded" // a bootcamp tier the higher tier replaced
  | "locked"; // reputation gate not met

export interface ToolboxItem {
  id: ToolboxItemId;
  kind: "gear" | "bootcamp" | "psychologist";
  status: ToolboxStatus;
  /** What a buy books now (0 for the psychologist's retainer, or a sponsor's free bootcamp). */
  price: number;
  /** Before the sponsor discount / free run. */
  listPrice: number;
  /** A sponsor-perk free bootcamp covers the next run. */
  free: boolean;
  repGate: number;
  /** Effect: gear training %, org-buff levels; the bootcamp's rating edge and chemistry; the psychologist's stats. */
  trainingPct: number;
  buffLevels: number;
  ratingEdge: number;
  chemistry: number;
  stats: Record<string, number> | null;
  /** Weekly upkeep (gear) or retainer (psychologist); 0 when none. */
  weekly: number;
  /**
   * "permanent" gear · the bootcamp's last day if bought (or running) now
   * (5-A) · rc.33's one-event camp ("nextEvent", CAREER_GEAR.bootcampSpan
   * "event") · the retainer runs weekly until dropped.
   */
  duration:
    | { kind: "permanent" }
    | { kind: "until"; seasonIndex: number; day: number }
    | { kind: "nextEvent" }
    | { kind: "weekly" };
}

/** The gear ladder rung that has to be bought first (strict order), or null. */
export function gearBlockerOf(save: CareerSave, id: ToolboxItemId): ToolboxItemId | null {
  const next = gearNextItem(save.finances.gear);
  const item = CAREER_GEAR.items.find((i) => i.id === id);
  if (!item || !next || next.id === id || save.finances.gear[item.id]) return null;
  return next.id;
}

/** Every toolbox item with its state, price, effect and duration — the HQ block and its sheet. */
export function toolboxOf(save: CareerSave): ToolboxItem[] {
  const fin = save.finances;
  const rep = save.reputation;
  const seasonIndex = save.clock.seasonIndex;
  const sponsorTier = save.sponsor?.tier ?? null;
  const flatIndex = moneyIndex(seasonIndex, "flat");
  const next = gearNextItem(fin.gear);
  const out: ToolboxItem[] = [];
  const base = { free: false, trainingPct: 0, buffLevels: 0, ratingEdge: 0, chemistry: 0, stats: null, weekly: 0 };

  for (const item of CAREER_GEAR.items) {
    const status: ToolboxStatus = fin.gear[item.id]
      ? "owned"
      : rep < item.repGate
        ? "locked"
        : next?.id === item.id
          ? "buyable"
          : "queued";
    out.push({
      ...base,
      id: item.id,
      kind: "gear",
      status,
      price: gearPriceFor(item.cost, sponsorTier, seasonIndex),
      listPrice: gearPriceFor(item.cost, null, seasonIndex),
      repGate: item.repGate,
      trainingPct: Math.round(item.trainingBonus * 100),
      buffLevels: item.buffLevels,
      weekly: item.upkeepPerSplit > 0 ? weeklyOf(item.upkeepPerSplit * flatIndex) : 0,
      duration: { kind: "permanent" },
    });
  }

  const tier = bootcampTierFor(rep);
  const freeAllowance = sponsorFreeBootcampsOf(save.sponsor);
  const freeNext = fin.freeBootcampsUsedThisSeason < freeAllowance;
  const lastsSplit = CAREER_GEAR.bootcampSpan === "split";
  const until = fin.bootcampUntil ?? null;
  for (const camp of CAREER_GEAR.bootcamp) {
    const id: ToolboxItemId = camp.tier === 2 ? "bootcamp2" : "bootcamp1";
    const running = fin.bootcampSharp > 0 && tier === camp.tier;
    const status: ToolboxStatus =
      rep < camp.repGate
        ? "locked"
        : tier > camp.tier
          ? "superseded"
          : running
            ? "active"
            : fin.bootcampUsedThisSplit
              ? "used"
              : "buyable";
    const listPrice = bootcampCostFor(camp.tier, seasonIndex);
    const end = running && until ? until : { seasonIndex, day: splitEndDayFor(save.clock.day) };
    out.push({
      ...base,
      id,
      kind: "bootcamp",
      status,
      price: freeNext && tier === camp.tier ? 0 : listPrice,
      listPrice,
      free: freeNext && tier === camp.tier,
      repGate: camp.repGate,
      ratingEdge: running ? fin.bootcampSharp : camp.sharpRating * (lastsSplit ? CAREER_GEAR.bootcampSplitEdgeShare : 1),
      chemistry: camp.chemistryCredit,
      duration: lastsSplit ? { kind: "until", seasonIndex: end.seasonIndex, day: end.day } : { kind: "nextEvent" },
    });
  }

  out.push({
    ...base,
    id: "psych",
    kind: "psychologist",
    status: fin.gear.psychologist ? "owned" : rep < CAREER_GEAR.psychologistRep ? "locked" : "buyable",
    price: 0,
    listPrice: 0,
    repGate: CAREER_GEAR.psychologistRep,
    stats: { ...CAREER_GEAR.psychologistStatBonus },
    weekly: weeklyOf(psychologistPerSplitFor(seasonIndex)),
    duration: { kind: "weekly" },
  });
  return out;
}

/**
 * Why the purchase would be refused right now — the flow's own answer (a dry
 * run of buyGearFlow / runBootcampFlow / setPsychologistFlow on a copy):
 * "locked" (reputation or ladder order), "loanActive" / "loanRunway" (the
 * Backer), "funds", "used", "maxed". Null = it goes through.
 */
export function toolboxRefusalOf(save: CareerSave, id: ToolboxItemId): string | null {
  if (save.phase === "ended") return "blocked";
  const res =
    id === "bootcamp1" || id === "bootcamp2"
      ? runBootcampFlow(save)
      : id === "psych"
        ? setPsychologistFlow(save, true)
        : buyGearFlow(save, id);
  return res.error ?? null;
}

/** The confirm sheet's "after" line: the balance after the purchase and the runway at the new weekly net. */
export function toolboxAfterOf(save: CareerSave, item: ToolboxItem): { balance: number; runway: number | null } {
  const fin = save.finances;
  const gear =
    item.kind === "gear"
      ? { ...fin.gear, [item.id]: true }
      : item.kind === "psychologist"
        ? { ...fin.gear, psychologist: true }
        : fin.gear;
  const after: CareerSave = { ...save, finances: { ...fin, gear, balance: fin.balance - item.price } };
  return { balance: after.finances.balance, runway: runwayWeeksOf(after) };
}

// ---------------------------------------------------------------------------
// H4 — the seeding line (decision 6-A)
// ---------------------------------------------------------------------------

export interface RegionalSeat {
  week: number;
  ordinal: 1 | 2 | 3;
  /** True: a direct seat in Sunday's regional; false: Saturday's qualifier first. */
  direct: boolean;
  /** The week's Monday committed it (R45) — otherwise today's preview. */
  committed: boolean;
}

/**
 * "Next regional: direct seat / Saturday qualifier" — the user's next
 * regional still to play this season, read from `userIsDirect` (the week's
 * Monday commit, R45; a later week previews it live). Null when none is left.
 */
export function nextRegionalSeatOf(save: CareerSave): RegionalSeat | null {
  if (save.phase !== "running") return null;
  const region = save.identity.region;
  const seasonIndex = save.clock.seasonIndex;
  for (let week = weekOfDay(save.clock.day); week <= CAREER_CALENDAR.weeksPerSeason; week++) {
    const cal = weekAt(week);
    if (cal.kind !== "regional") continue;
    const regional = officialEventDefsForWeek(seasonIndex, week).find((d) => d.tier === "regional" && d.region === region);
    if (!regional || save.eventResults.some((r) => r.eventId === regional.id)) continue;
    return {
      week,
      ordinal: cal.ordinal ?? 1,
      direct: userIsDirect(save, week),
      committed: committedSeedingFor(save.competition, { region, seasonIndex, week }) !== null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// UX-06b — a contract's time left
// ---------------------------------------------------------------------------

export interface ContractClock {
  /** Seasons after this one the contract still covers (0 = this is its final season). */
  seasonsAfter: number;
  /** In the final season: the weeks until the season ends (0 in the season review); null otherwise. */
  weeksLeft: number | null;
}

export function contractClockOf(save: CareerSave, p: Pick<SquadPlayer, "contractEndSeason">): ContractClock {
  const seasonsAfter = Math.max(0, p.contractEndSeason - save.clock.seasonIndex);
  if (seasonsAfter > 0) return { seasonsAfter, weeksLeft: null };
  const weeksLeft =
    save.phase === "running" ? Math.max(0, CAREER_CALENDAR.weeksPerSeason - weekOfDay(save.clock.day) + 1) : 0;
  return { seasonsAfter: 0, weeksLeft };
}
