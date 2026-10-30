/**
 * rc.33 front B — the contract through the real flow: the prize share each
 * contract carries (ECO-10), the wage talk (ECO-11) on a signing and a
 * renewal, the share booked out of a podium for the players who played, and
 * the Market's "signable at my reputation" filter agreeing with the signing
 * rule (UX-07). The model's own properties: engine/career/contract.test.ts.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CONTRACT, CAREER_PRIZE_SHARE } from "@/config/balance";
import { contractSharePctFor, prizeShareAskFor } from "@/engine/career/contract";
import { ageOf, playerViewById } from "@/engine/career/development";
import { playerShareFor, prizeFor, quantize, signableOverallCap, weeklyWage } from "@/engine/career/economy";
import { askPackageFor, signableAtRep } from "@/engine/career/market";
import type { CareerPlayerView, CareerSave } from "@/engine/career/types";
import { placementOf } from "@/engine/career/careerResults";
import {
  advanceDayFlow,
  createCareerSave,
  eventPlayerShareFor,
  finishEvent,
  isEventPaused,
  renewalTalkFor,
  renewPlayerFlow,
  resolveInsertFlow,
  signingPlanFor,
  signingTalkFor,
  signPlayerFlow,
  simEventToEnd,
  startEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Contract Org",
    abbrev: "CON",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

function makeSave(seed = 33_033): CareerSave {
  const save = createCareerSave(INPUT, seed);
  save.finances.balance = 400_000; // these tests are about terms, not runway
  return save;
}

function viewsOf(save: CareerSave, ids: string[]): CareerPlayerView[] {
  const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}

/** Signable free agents of competitive age, strongest first. */
function freeAgents(save: CareerSave): CareerPlayerView[] {
  const cap = signableOverallCap(save.reputation);
  return viewsOf(save, save.world.freeAgentIds)
    .filter((v) => Math.round(v.overall) <= cap && v.age >= 13)
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
}

const askOf = (save: CareerSave, view: CareerPlayerView) =>
  askPackageFor(view, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons: 2,
  });

describe("ECO-10 — every contract carries a prize share", () => {
  it("the founders carry the share each one asks; a new career reads the honest bands (DEV-04)", () => {
    const save = makeSave();
    for (const p of save.squad) {
      expect(p.prizeSharePct).toBe(prizeShareAskFor({ overall: p.overall, age: ageOf(p.birthYear, 0) }));
    }
    expect(save.bandModel).toBe(2);
  });

  it("a podium books each played contract's own share; the reserve who sat out keeps none; an older deal reads the rc.32 rule", () => {
    let save = makeSave();
    const fa = freeAgents(save)[0];
    save = signPlayerFlow(save, fa.id, { lengthSeasons: 2 }).save; // the reserve
    expect(save.squad).toHaveLength(4);
    const reserve = save.squad.find((p) => p.role === "sub")!;
    const starters = save.squad.filter((p) => p.role === "starter");
    const ev = {
      def: { tier: "major" },
      fieldedIds: starters.map((p) => p.id),
    } as unknown as NonNullable<CareerSave["activeEvent"]>;
    const pct = starters.reduce((s, p) => s + p.prizeSharePct!, 0);
    expect(eventPlayerShareFor(save, ev, "champion", 45_000)).toBe(quantize((45_000 * pct) / 100 + 1e-6));
    // The reserve's share counts only when he plays.
    const withSub = { ...ev, fieldedIds: [starters[0].id, starters[1].id, reserve.id] };
    expect(eventPlayerShareFor(save, withSub, "champion", 45_000)).toBe(
      quantize((45_000 * (starters[0].prizeSharePct! + starters[1].prizeSharePct! + reserve.prizeSharePct!)) / 100 + 1e-6),
    );
    // Off the podium, or a qualifier: nothing.
    expect(eventPlayerShareFor(save, ev, "top8", 6_000)).toBe(0);
    expect(eventPlayerShareFor(save, { ...ev, def: { tier: "qualifier" } } as typeof ev, "champion", 600)).toBe(0);
    // Three deals signed before rc.33 (no share): the rc.32 team share — booked
    // on its exact quantum (rc.32's quantize(45,000 × 0.35) slipped to $15,700).
    const old = structuredClone(save);
    for (const p of old.squad) delete p.prizeSharePct;
    expect(eventPlayerShareFor(old, ev, "champion", 45_000)).toBe(15_750);
    expect(playerShareFor("major", "champion", 45_000)).toBe(15_700);
    expect(eventPlayerShareFor(old, ev, "champion", 12_000)).toBe(playerShareFor("major", "champion", 12_000));
  });

  it("finishEvent books the share the digest shows, from the same function (every event of a season)", () => {
    let save = makeSave();
    // A squad of 95s reaches the podiums; one deal keeps the rc.32 rule.
    for (const p of save.squad) p.overall = 95;
    save.squad[0].prizeSharePct = 12;
    save.squad[1].prizeSharePct = 7;
    delete save.squad[2].prizeSharePct;
    let events = 0;
    let podiums = 0;
    let guard = 0;
    while (save.phase === "running" && save.clock.seasonIndex === 0 && guard++ < 400) {
      if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) {
        save = simEventToEnd(startEvent(save, false));
        if (isEventPaused(save)) save = simEventToEnd(advanceDayFlow(save));
        const ev = save.activeEvent!;
        const placement = placementOf(ev.tournament, "user");
        const prize = prizeFor(ev.def.tier, placement, ev.def.format, save.difficulty, ev.def.seasonIndex);
        const expected = eventPlayerShareFor(save, ev, placement, prize);
        const before = save.finances.ledger.length;
        save = finishEvent(save);
        const booked = save.finances.ledger.slice(before).filter((l) => l.kind === "playerShare");
        expect(booked.reduce((sum, l) => sum - l.amount, 0)).toBe(expected);
        if (expected > 0) {
          podiums += 1;
          const pct = 12 + 7 + contractSharePctFor({}, ev.def.tier);
          expect(expected).toBe(Math.min(prize, quantize((prize * pct) / 100 + 1e-6)));
        }
        events += 1;
        continue;
      }
      if (save.pendingInsert && save.pendingInsert.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
      const day = save.clock.day;
      save = advanceDayFlow(save);
      if (save.clock.day === day && !save.pendingEventDef) break;
    }
    expect(events).toBeGreaterThan(3);
    expect(podiums).toBeGreaterThan(0);
  }, 120_000);
});

describe("ECO-11 — the wage talk through the flows", () => {
  it("a signing writes the talk's terms: the weekly wage shown and the share offered", () => {
    const save = makeSave();
    const fa = freeAgents(save)[0];
    const ask = askOf(save, fa);
    const share = prizeShareAskFor(fa) + 2;
    const talk = signingTalkFor(save, fa, ask, { sharePct: share });
    const offer = { weekly: talk.zone.floorWeekly, sharePct: share };
    const answer = signingTalkFor(save, fa, ask, offer);
    expect(answer.accepted).toBe(true);
    // The plan prices the payroll checks with the wage on the table.
    const planned = signingPlanFor(save, fa.id, { lengthSeasons: 2, offer });
    expect("plan" in planned && planned.plan.talk.terms).toEqual(answer.terms);
    const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2, offer });
    expect(res.error).toBeUndefined();
    const signed = res.save.squad.find((p) => p.id === fa.id)!;
    expect(weeklyWage(signed.salaryPerSplit)).toBe(talk.zone.floorWeekly);
    expect(signed.prizeSharePct).toBe(share);
    // Two share points over his ask bought a lower wage at the bounded rate.
    expect(talk.zone.topPerSplit).toBe(quantize(ask.salaryPerSplit * (1 - 2 * CAREER_PRIZE_SHARE.wagePerPoint)));
    // Nothing hardens: the talk stores nothing.
    expect(res.save.negotiationTries).toEqual(save.negotiationTries);
  });

  it("under his floor nothing moves; his counter is shown before any confirm and taking it signs", () => {
    const save = makeSave();
    const fa = freeAgents(save)[1];
    const ask = askOf(save, fa);
    const floor = signingTalkFor(save, fa, ask).zone.floorWeekly;
    const under = { weekly: floor - 10 };
    const talk = signingTalkFor(save, fa, ask, under);
    expect(talk.accepted).toBe(false);
    const refused = signPlayerFlow(save, fa.id, { lengthSeasons: 2, offer: under });
    expect(refused.error).toBe("negotiationCounter");
    expect(refused.save).toBe(save);
    const counter = talk.counter!;
    const res = signPlayerFlow(save, fa.id, { lengthSeasons: 2, offer: { weekly: counter.weekly, sharePct: counter.sharePct } });
    expect(res.error).toBeUndefined();
    expect(res.save.squad.find((p) => p.id === fa.id)!.salaryPerSplit).toBe(counter.wagePerSplit);
  });

  it("a renewal runs the same talk on the M2 ask, and an older deal gets a share when renewed", () => {
    const base = makeSave();
    const save = structuredClone(base);
    const p = save.squad[0];
    delete p.prizeSharePct; // a deal signed before rc.33
    const talk = renewalTalkFor(save, p, 2, { sharePct: prizeShareAskFor({ overall: p.overall, age: ageOf(p.birthYear, 0) }) - 1 });
    expect(talk.offer.sharePct).toBe(talk.ask.sharePct - 1);
    // One point under his share ask: he wants more wage (his ask at that share is the top).
    expect(talk.zone.topPerSplit).toBeGreaterThanOrEqual(talk.ask.wagePerSplit);
    const res = renewPlayerFlow(save, p.id, 2, { weekly: talk.zone.topWeekly, sharePct: talk.offer.sharePct });
    expect(res.error).toBeUndefined();
    const renewed = res.save.squad.find((x) => x.id === p.id)!;
    expect(renewed.prizeSharePct).toBe(talk.offer.sharePct);
    expect(renewed.salaryPerSplit).toBe(talk.zone.topPerSplit);
    expect(renewed.contractEndSeason).toBe(2);
    // Under the floor: refused, nothing moves.
    const no = renewPlayerFlow(save, p.id, 2, { weekly: 0 });
    expect(no.error).toBe("negotiationCounter");
    expect(no.save).toBe(save);
  });
});

describe("UX-07 — the Market", () => {
  it("'signable at my reputation' is the rule a signing checks, at every reputation", () => {
    for (const rep of [0, 12, 40, 90]) {
      const save = makeSave();
      save.reputation = rep;
      const views = viewsOf(save, [...save.world.freeAgentIds, ...Object.values(save.world.orgs).flatMap((o) => o.playerIds)]);
      let checked = 0;
      for (const v of views.slice(0, 160)) {
        const planned = signingPlanFor(save, v.id, { lengthSeasons: 2 });
        const error = "error" in planned ? planned.error : null;
        if (error === "tooYoung" || error === "alreadySigned") continue;
        expect(error === "repGate", `${v.id} @${rep}`).toBe(!signableAtRep(v.overall, rep));
        checked += 1;
      }
      expect(checked).toBeGreaterThan(50);
    }
  });

  it("a full squad is refused until a seat is free — the sheet points to Squad, never a who-leaves pick", () => {
    let save = makeSave();
    const [a] = freeAgents(save);
    save = signPlayerFlow(save, a.id, { lengthSeasons: 2 }).save;
    expect(save.squad).toHaveLength(CAREER_CONTRACT.squadCap);
    const b = freeAgents(save)[0];
    const planned = signingPlanFor(save, b.id, { lengthSeasons: 2 });
    expect("error" in planned && planned.error).toBe("squadFull");
    expect(signPlayerFlow(save, b.id, { lengthSeasons: 2 }).error).toBe("squadFull");
  });
});
