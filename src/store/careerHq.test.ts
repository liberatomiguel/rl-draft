/**
 * rc.34 (Etapa 3, front G — ROADMAP UX-01 b/d/e/f; HQ-CONTRACT H2, H4–H6,
 * Gate 3a decisions 2–7 A): HQ's figures are the owning screens' figures.
 * The finance block equals the Finances desk (statement, runway, debts) and
 * its projection is the committed Mondays only; the seeding line is the
 * direct-8 seeding itself; the toolbox's sheet quotes the flows' prices and
 * refusals; the bootcamp lasts the split (5-A); the squad cards wear the
 * Draft's rarity frame and the user's crest (2-A, 3-A).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_GEAR } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { baseRarityOf } from "@/engine/cards";
import {
  firstDayOfWeek,
  officialEventDefsForWeek,
  splitBoundaryWeeks,
  splitEndDayFor,
  weekOfDay,
} from "@/engine/career/calendar";
import { bootcampCostFor, gearPriceFor, nextPaydayFor } from "@/engine/career/economy";
import type { CareerSave } from "@/engine/career/types";
import { SquadBlock } from "@/components/career/hub/SquadBlock";
import { RaceBlock, defaultRaceKind } from "@/components/career/hub/RaceBlock";
import { raceTableOf, userTeamPreview } from "@/components/career/careerUi";
import { stepDayForTests } from "./careerClockForTests";
import {
  backerLineOf,
  buyGearFlow,
  createCareerSave,
  finishEvent,
  simEventToEnd,
  migrateSaveToV5,
  repairHqOnLoad,
  rolloverToNextSeason,
  runBootcampFlow,
  runwayWeeksOf,
  startEvent,
  takeBankLoanFlow,
  userIsDirect,
  userTeamForEvent,
  weeklyStatementOf,
  type CreateCareerInput,
} from "./careerFlow";
import { contractClockOf, hqFinanceOf, nextRegionalSeatOf, toolboxAfterOf, toolboxOf, toolboxRefusalOf } from "./careerHq";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "HQ Org",
    abbrev: "HQO",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield:wolf",
    colors: { primary: "#1d4ed8", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

function fresh(seed = 34_101): CareerSave {
  const save = createCareerSave(INPUT, seed);
  for (let s = 0; s < 2; s++) for (let w = 1; w <= CAREER_CALENDAR.weeksPerSeason; w++) save.flags[`insertRolled:${s}:${w}`] = true;
  save.sponsorOffers = null;
  return save;
}

describe("rc.34 UX-01e (H5) — the finance block reads the Finances desk", () => {
  it("balance, net, runway, the next payroll and the guaranteed income are the statement's", () => {
    const save = fresh();
    const f = hqFinanceOf(save);
    const st = weeklyStatementOf(save);
    expect(f.balance).toBe(save.finances.balance);
    expect(f.net).toBe(st.net);
    expect(f.runway).toBe(runwayWeeksOf(save, st.net));
    const payday = nextPaydayFor(save.clock);
    expect(f.payroll).toEqual({ seasonIndex: payday.seasonIndex, day: payday.day, amount: st.expenses });
    expect(f.guaranteed.total).toBe(st.sponsorBase + st.foundingPartner + st.rescuePartner + st.fanbase);
    expect(f.debt).toEqual({ backer: null, bankRemaining: null, bankNext: null });
  });

  it("the projection runs the committed Mondays to the split's end — the bank's instalments end, no prize counted", () => {
    const loaned = takeBankLoanFlow(fresh(), 3_000);
    expect(loaned.error).toBeUndefined();
    const save = loaned.save;
    const f = hqFinanceOf(save);
    const bank = save.finances.bankLoan!;
    expect(f.debt).toEqual({ backer: null, bankRemaining: bank.remaining, bankNext: Math.min(bank.remaining, bank.weeklyPayment) });
    const end = splitEndDayFor(save.clock.day);
    expect(f.projection.day).toBe(end);
    // By hand: each Monday's statement, the instalment while the loan lasts.
    const st = weeklyStatementOf(save);
    let bal = save.finances.balance;
    let left = bank.remaining;
    let mondays = 0;
    for (let d = save.clock.day + 1; d <= end; d++) {
      if ((d - 1) % 7 !== 0) continue;
      mondays += 1;
      const inst = Math.min(left, bank.weeklyPayment);
      left -= inst;
      bal += st.sponsorBase + st.foundingPartner + st.fanbase + st.rescuePartner - (st.payroll + st.coach + st.psychologist + st.upkeep) - inst;
    }
    expect(f.projection.mondays).toBe(mondays);
    expect(f.projection.balance).toBe(bal);
  });

  it("rc.34 review: the projection books the sponsor fines' instalments, each until it is paid", () => {
    const save = fresh();
    save.finances.balance = 50_000; // far above the floor: nothing is waived
    const without = hqFinanceOf(save).projection;
    const fined = structuredClone(save);
    fined.finances.sponsorFines = [
      { sponsorId: "voltway", remaining: 800, perMonday: 200 },
      { sponsorId: "brightline", remaining: 150, perMonday: 100 },
    ];
    const f = hqFinanceOf(fined).projection;
    expect(f.mondays).toBe(without.mondays);
    expect(f.mondays).toBeGreaterThanOrEqual(4);
    // 200 × 4 Mondays, then 100 + 50: $950 in all within the split.
    expect(f.balance).toBe(without.balance - 950);
    // At the floor an instalment is waived, as the Monday funnel waives it: it never takes the books below the floor.
    const net = weeklyStatementOf(save).net;
    expect(net).toBeLessThan(0);
    const atFloor = (s: CareerSave): CareerSave => ({ ...s, finances: { ...s.finances, balance: backerLineOf(s).floor - net } });
    expect(hqFinanceOf(atFloor(fined)).projection.balance).toBe(hqFinanceOf(atFloor(save)).projection.balance);
  });
});

describe("rc.34 UX-01d (6-A) — the seeding line is the direct-8 seeding", () => {
  it("previews live before the regional's Monday, then reads the Monday's commit", () => {
    let save = fresh(34_111);
    const seat0 = nextRegionalSeatOf(save)!;
    expect(seat0.week).toBe(4);
    expect(seat0.committed).toBe(false);
    expect(seat0.direct).toBe(userIsDirect(save, 4));
    while (save.clock.day < firstDayOfWeek(4)) save = stepDayForTests(save);
    const seat = nextRegionalSeatOf(save)!;
    expect(seat.committed).toBe(true);
    expect(seat.direct).toBe(save.competition.weekSeeding!.direct.includes("user"));
    // The lobby's event is the line's answer: a qualifier when not direct.
    expect(save.pendingEventDef?.tier).toBe(seat.direct ? "regional" : "qualifier");
  });
});

describe("rc.34 UX-01d — the race block shows the selection's table and the seeding line", () => {
  it("after the first regional: rank and points are raceTableOf's, the line is the next regional's seat", () => {
    let save = fresh(34_112);
    for (let guard = 0; save.clock.day <= firstDayOfWeek(5) && guard < 200; guard++) {
      if (save.pendingEventDef && save.pendingEventDef.day === save.clock.day && !save.activeEvent) {
        const s = simEventToEnd(startEvent(save, false));
        save = s.activeEvent?.tournament.stage === "finished" ? finishEvent(s) : s;
        continue;
      }
      save = stepDayForTests(save);
    }
    const table = raceTableOf(save, "SAM", defaultRaceKind(save));
    const html = renderToStaticMarkup(createElement(RaceBlock, { save, C: CAREER_EN }));
    if (table.userRow && table.started) expect(html).toContain(CAREER_EN.hub.pointsRank(table.userRow.rank, table.userRow.points));
    const seat = nextRegionalSeatOf(save)!;
    expect(seat.week).toBe(6);
    expect(html).toContain(CAREER_EN.hub.nextRegional(seat.ordinal, seat.week));
    expect(html).toContain(seat.direct ? CAREER_EN.hub.seatDirect : CAREER_EN.hub.seatQualifier);
  });
});

describe("rc.34 UX-01f (H6, 7-A) — the toolbox sheet quotes the flows", () => {
  it("price (the sponsor discount), effect, duration; the after line; the flow's own refusal", () => {
    const save = fresh();
    save.reputation = 30;
    const items = toolboxOf(save);
    const periph = items.find((i) => i.id === "peripherals")!;
    expect(periph).toMatchObject({ status: "buyable", price: gearPriceFor(1_500, null, 0), duration: { kind: "permanent" }, trainingPct: 5 });
    expect(items.find((i) => i.id === "monitors")!.status).toBe("queued");
    expect(items.find((i) => i.id === "perfCenter")!.status).toBe("locked");
    const camp = items.find((i) => i.id === "bootcamp1")!;
    expect(camp).toMatchObject({ status: "buyable", price: bootcampCostFor(1, 0), ratingEdge: 0.5 });
    expect(camp.duration).toEqual({ kind: "until", seasonIndex: 0, day: splitEndDayFor(save.clock.day) });
    expect(toolboxRefusalOf(save, "peripherals")).toBeNull();
    expect(toolboxRefusalOf(save, "monitors")).toBe("locked"); // the ladder's order
    expect(toolboxAfterOf(save, periph).balance).toBe(save.finances.balance - periph.price);
    // Broke: the flow refuses on funds, and the sheet says so (not a silent no-op).
    const broke = { ...save, finances: { ...save.finances, balance: -50_000 } };
    expect(toolboxRefusalOf(broke, "peripherals")).toBe(buyGearFlow(broke, "peripherals").error);
    expect(toolboxRefusalOf(broke, "peripherals")).toBe("funds");
    // Bought: the same flow Finances calls, and the item reads owned.
    const bought = buyGearFlow(save, "peripherals").save;
    expect(toolboxOf(bought).find((i) => i.id === "peripherals")!.status).toBe("owned");
    expect(toolboxOf(bought).find((i) => i.id === "monitors")!.status).toBe("buyable");
  });
});

describe("rc.34 UX-01f (5-A) — the bootcamp lasts the split and shows its end", () => {
  it("every official event of the split plays with the edge; the next boundary Monday ends it", () => {
    let save = fresh(34_121);
    save.reputation = 30;
    const camp = runBootcampFlow(save);
    expect(camp.error).toBeUndefined();
    save = camp.save;
    const end = splitEndDayFor(save.clock.day);
    expect(save.finances.bootcampUntil).toEqual({ seasonIndex: 0, day: end });
    expect(save.finances.bootcampSharp).toBe(CAREER_GEAR.bootcamp[0].sharpRating);
    expect(end).toBe(firstDayOfWeek(splitBoundaryWeeks()[0]) - 1);
    // The first regional week's event: the edge is in the fielded team, and it survives the event.
    while (save.clock.day < firstDayOfWeek(4)) save = stepDayForTests(save);
    const def = save.pendingEventDef!;
    while (save.clock.day < def.day) save = stepDayForTests(save);
    const withEdge = userTeamForEvent(save, def).team.rating.total;
    const without = userTeamForEvent({ ...save, finances: { ...save.finances, bootcampSharp: 0 } }, def).team.rating.total;
    expect(withEdge - without).toBeCloseTo(0.5, 1);
    const started = startEvent(save, false);
    expect(started.finances.bootcampSharp).toBe(0.5);
    // It lasts through its last day and ends on the arrival of the next one.
    let s: CareerSave = { ...started, activeEvent: null, pendingEventDef: null };
    s = { ...s, finances: { ...s.finances, bootcampUntil: { seasonIndex: 0, day: s.clock.day + 1 } } };
    s = stepDayForTests(s);
    expect(s.finances.bootcampSharp).toBe(0.5);
    s = stepDayForTests(s);
    expect(s.finances.bootcampSharp).toBe(0);
    expect(s.finances.bootcampUntil).toBeNull();
    // The split's own end: the boundary Monday clears it and reopens the one-a-split allowance.
    const last: CareerSave = { ...camp.save, clock: { seasonIndex: 0, day: end }, pendingEventDef: null };
    expect(last.finances.bootcampSharp).toBe(0.5);
    const monday = stepDayForTests(last);
    expect(weekOfDay(monday.clock.day)).toBe(splitBoundaryWeeks()[0]);
    expect(monday.finances.bootcampSharp).toBe(0);
    expect(monday.finances.bootcampUntil).toBeNull();
    expect(monday.finances.bootcampUsedThisSplit).toBe(false);
  });

  it("rc.34 review: a camp bought in W31–32 never blocks next season's first split — the rollover reopens the allowance", () => {
    let save = fresh(34_123);
    save.reputation = 30;
    save = { ...save, clock: { seasonIndex: 0, day: firstDayOfWeek(31) + 1 }, pendingEventDef: null, unofficialOffer: null };
    save = runBootcampFlow(save).save;
    expect(save.finances.bootcampUsedThisSplit).toBe(true);
    const review: CareerSave = { ...save, phase: "seasonReview", clock: { seasonIndex: 0, day: CAREER_CALENDAR.weeksPerSeason * 7 } };
    const next = rolloverToNextSeason(review);
    expect(next.clock).toMatchObject({ seasonIndex: 1 });
    expect(next.finances.bootcampUsedThisSplit).toBe(false);
    expect(runBootcampFlow(next).error).toBeUndefined();
  });

  it("rc.33's rule stays behind the key (\"event\": spent by the next official event); 5-B halves the edge", () => {
    const gear = CAREER_GEAR as unknown as { bootcampSpan: string; bootcampSplitEdgeShare: number };
    const span = gear.bootcampSpan;
    const share = gear.bootcampSplitEdgeShare;
    try {
      gear.bootcampSpan = "event";
      let save = fresh(34_122);
      save.reputation = 30;
      save = runBootcampFlow(save).save;
      expect(save.finances.bootcampUntil).toBeNull();
      while (save.clock.day < firstDayOfWeek(4)) save = stepDayForTests(save);
      while (save.clock.day < save.pendingEventDef!.day) save = stepDayForTests(save);
      expect(startEvent(save, false).finances.bootcampSharp).toBe(0);
      gear.bootcampSpan = "split";
      gear.bootcampSplitEdgeShare = 0.5;
      const half = runBootcampFlow({ ...fresh(34_123), reputation: 30 }).save;
      expect(half.finances.bootcampSharp).toBe(0.25);
    } finally {
      gear.bootcampSpan = span;
      gear.bootcampSplitEdgeShare = share;
    }
  });

  it("the load repair dates an edge an rc.33 save armed (idempotent), and a reload keeps it", () => {
    const save = fresh();
    save.finances.bootcampSharp = 1.0;
    delete save.finances.bootcampUntil;
    const up = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(up.finances.bootcampUntil).toEqual({ seasonIndex: 0, day: splitEndDayFor(save.clock.day) });
    const again = structuredClone(up);
    repairHqOnLoad(again);
    expect(again.finances.bootcampUntil).toEqual(up.finances.bootcampUntil);
    // Nothing armed: nothing dated.
    const none = fresh();
    repairHqOnLoad(none);
    expect(none.finances.bootcampUntil).toBeUndefined();
  });
});

describe("rc.34 UX-01b (H2, 2-A, 3-A) — the squad as Draft cards", () => {
  it("the Draft's rarity frame by overall, the user's crest, no initials square", () => {
    const save = fresh();
    const ovrs = [69, 74, 85, 92];
    save.squad.forEach((p, i) => (p.overall = ovrs[i] ?? 75));
    const html = renderToStaticMarkup(
      createElement(SquadBlock, { save, C: CAREER_EN, team: userTeamPreview(save), chemTiers: {} }),
    );
    for (const p of save.squad) expect(html).toContain(`card-frame flex min-h-52 min-w-0 flex-col p-3 text-left transition-transform duration-200 hover:-translate-y-0.5 card-${baseRarityOf(Math.round(p.overall))}`);
    expect(baseRarityOf(70)).toBe("silver");
    expect(baseRarityOf(80)).toBe("gold");
    expect(baseRarityOf(90)).toBe("blue");
    // The crest is the user's (decision 2-A) — its colours are drawn on every card.
    expect(html.split(save.identity.colors.primary).length - 1).toBeGreaterThanOrEqual(save.squad.length);
    // rc.33's initials square (a gradient of the org colours) is gone.
    expect(html).not.toContain("linear-gradient(135deg");
    for (const p of save.squad) expect(html).toContain(p.name);
  });

  it("an empty seat (R67) shows the way to the Market; a final-season contract shows its time left", () => {
    const save = fresh();
    save.squad = save.squad.slice(0, 2);
    save.starterIds = [save.squad[0].id, save.squad[1].id, ""];
    save.squad[0].contractEndSeason = 0;
    save.clock = { seasonIndex: 0, day: firstDayOfWeek(26) };
    const html = renderToStaticMarkup(
      createElement(SquadBlock, { save, C: CAREER_EN, team: userTeamPreview(save), chemTiers: {} }),
    );
    expect(html).toContain(CAREER_EN.hub.cardEmptySeat);
    expect(contractClockOf(save, save.squad[0])).toEqual({ seasonsAfter: 0, weeksLeft: 32 - 26 + 1 });
    expect(html).toContain(CAREER_EN.hub.cardEndsIn(7));
  });
});

describe("rc.34 — the HQ projection and Finances' read one function", () => {
  it("officialEventDefsForWeek sanity: the split's regionals fall before its end day", () => {
    const end = splitEndDayFor(1);
    for (const w of [4, 6, 8, 10]) for (const d of officialEventDefsForWeek(0, w)) expect(d.day).toBeLessThanOrEqual(end);
  });
});

describe("rc.34 review — no \"Backer\" in what a new career shows (the emergency loan's names)", () => {
  /** Every plain-string leaf of a copy tree, by its path (templates are checked by name below). */
  function leaves(node: unknown, path: string, out: [string, string][]): [string, string][] {
    if (typeof node === "string") out.push([path, node]);
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) leaves(v, `${path}.${k}`, out);
    return out;
  }
  // Kept on purpose: the sender and texts of mails an older save still holds, and the loan take-over that explains the change.
  const HISTORY = /\.(backerIn|restructured|loanTakenOver)\b|\.mail\.from\.backer$/;

  it("the HQ finance tile, the toolbox refusals and every label say emergency loan / empréstimo emergencial (EN + PT)", () => {
    expect(CAREER_EN.hub.financeDebtBacker("$1,000")).toBe("Emergency loan $1,000");
    expect(CAREER_PT.hub.financeDebtBacker("$1,000")).toBe("Empréstimo emergencial $1,000");
    for (const [C, lang] of [[CAREER_EN, "en"], [CAREER_PT, "pt"]] as const) {
      for (const text of Object.values(C.toolbox.refusal)) expect(text, lang).not.toMatch(/Backer|Investidor de emergência/);
      for (const [path, text] of leaves(C, lang, [])) {
        if (HISTORY.test(path)) continue;
        expect(text, path).not.toMatch(/Backer|Investidor de emergência/);
      }
    }
  });
});
