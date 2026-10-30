/**
 * rc.33 front B — the contract through the real flow: the prize share each
 * contract carries (ECO-10), the wage talk (ECO-11) on a signing and a
 * renewal, the share booked out of a podium for the players who played, and
 * the Market's "signable at my reputation" filter agreeing with the signing
 * rule (UX-07). The model's own properties: engine/career/contract.test.ts.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CONTRACT, CAREER_PRIZE_SHARE, CAREER_PRIZES } from "@/config/balance";
import {
  contractSharePctFor,
  prizeShareAskFor,
  sharePointWeeklyFor,
  talkPressFor,
  type ContractOffer,
  type NegotiationAnswer,
  type TalkLever,
} from "@/engine/career/contract";
import { ageOf, playerViewById } from "@/engine/career/development";
import { playerShareFor, prizeFor, quantize, signableOverallCap, weeklyWage } from "@/engine/career/economy";
import { askPackageFor, signableAtRep } from "@/engine/career/market";
import type { CareerDifficulty, CareerPlayerView, CareerSave, CompactEventResult } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { placementOf } from "@/engine/career/careerResults";
import {
  advanceDayFlow,
  createCareerSave,
  eventPlayerShareFor,
  finishEvent,
  isEventPaused,
  migrateSaveToV5,
  renewalTalkFor,
  repairFoundingShareOnLoad,
  renewalTermsOfSave,
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

const askOf = (save: CareerSave, view: CareerPlayerView, lengthSeasons: 1 | 2 | 3 = 2) =>
  askPackageFor(view, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons,
  });

/**
 * rc.34 (front I): a free agent pushed past the share threshold (his overall
 * through the world's delta), at a reputation that signs anyone — a player
 * who asks a share, `minAsk` points or more.
 */
function shareAsker(save: CareerSave, minAsk = 4): CareerPlayerView {
  save.reputation = 90;
  const fa = freeAgents(save)[0];
  const base = fa.overall;
  save.world.overallDelta[fa.id] = (save.world.overallDelta[fa.id] ?? 0) + Math.max(0, CAREER_PRIZE_SHARE.shareThresholdOverall + 6 - Math.round(base));
  const view = viewsOf(save, [fa.id])[0];
  expect(prizeShareAskFor(view)).toBeGreaterThanOrEqual(minAsk);
  return view;
}

describe("ECO-10 — every contract carries a prize share", () => {
  it("rc.34 (Miguel 31/10): the founding deals carry no prize share — 0 %, never the pre-rc.33 rule; a new career reads the honest bands (DEV-04)", () => {
    for (const rosterKey of ["balanced", "prospects", "journeymen"] as const) {
      const save = createCareerSave({ ...INPUT, rosterKey }, 33_034);
      for (const p of save.squad) {
        expect(p.prizeSharePct).toBe(0);
        expect(contractSharePctFor(p, "worlds")).toBe(0);
      }
      expect(save.bandModel).toBe(2);
    }
  });

  it("rc.34 review: an older save's founders keep no prize share while the founding deal runs (an idempotent load repair); a renewed deal keeps what it signed", () => {
    const save = makeSave(33_036);
    const [a, b, c] = save.squad;
    // rc.33's founding deals carried the share each founder asked (2–6 %); a pre-rc.33 one none at all.
    a.prizeSharePct = 4;
    delete b.prizeSharePct;
    // c renewed: a new deal to season 3 with the share it signed.
    c.contractEndSeason = 3;
    c.prizeSharePct = 5;
    // A season-0 signing on a one-season deal is no founder: it keeps its share.
    const fa = freeAgents(save)[0];
    const signed = signPlayerFlow(save, fa.id, { lengthSeasons: 1 }).save;
    const newcomer = signed.squad.find((p) => p.id === fa.id)!;
    newcomer.prizeSharePct = 3;
    expect(newcomer.contractEndSeason).toBe(a.contractEndSeason);
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(signed)))!;
    const share = (id: string) => loaded.squad.find((p) => p.id === id)!.prizeSharePct;
    expect([share(a.id), share(b.id), share(c.id), share(fa.id)]).toEqual([0, 0, 5, 3]);
    // Idempotent: a second load moves nothing; the repair alone on a repaired save neither.
    expect(migrateSaveToV5(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
    const again = structuredClone(loaded);
    repairFoundingShareOnLoad(again);
    expect(again).toEqual(loaded);
  });

  it("a podium books each played contract's own share; the reserve who sat out keeps none; an older deal reads the rc.32 rule", () => {
    let save = makeSave();
    const fa = freeAgents(save)[0];
    save = signPlayerFlow(save, fa.id, { lengthSeasons: 2 }).save; // the reserve
    expect(save.squad).toHaveLength(4);
    const reserve = save.squad.find((p) => p.role === "sub")!;
    const starters = save.squad.filter((p) => p.role === "starter");
    // rc.34: founders and a season-0 free agent ask none — give the deals shares to book.
    [starters[0].prizeSharePct, starters[1].prizeSharePct, starters[2].prizeSharePct, reserve.prizeSharePct] = [6, 3, 0, 4];
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
    const fa = shareAsker(save);
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
    // Two share points over his ask bought a lower wage at the bounded rate (weekly money: wagePerPoint of his weekly ask).
    expect(talk.zone.topWeekly).toBe(weeklyWage(ask.salaryPerSplit) - 2 * sharePointWeeklyFor(weeklyWage(ask.salaryPerSplit)));
    expect(sharePointWeeklyFor(weeklyWage(ask.salaryPerSplit))).toBe(
      Math.max(10, Math.round((weeklyWage(ask.salaryPerSplit) * CAREER_PRIZE_SHARE.wagePerPoint) / 10) * 10),
    );
    // Nothing hardens: the talk stores nothing.
    expect(res.save.negotiationTries).toEqual(save.negotiationTries);
  });

  it("far under his floor (0 % odds) nothing moves; his counter is shown before any confirm and taking it signs", () => {
    const save = makeSave();
    // rc.35: under the floor his odds fall to 0 over CAREER_NEGOTIATION.oddsFallPct of his ask.
    const fa = freeAgents(save).find((v) => {
      const z = signingTalkFor(save, v, askOf(save, v)).zone;
      return z.zeroWeekly >= z.minWeekly;
    })!;
    const ask = askOf(save, fa);
    const under = { weekly: signingTalkFor(save, fa, ask).zone.zeroWeekly };
    const talk = signingTalkFor(save, fa, ask, under);
    expect(talk.odds).toBe(0);
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
    p.overall = CAREER_PRIZE_SHARE.shareThresholdOverall + 7; // rc.34: grown past the threshold, he asks a share
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

describe("rc.34 front I — the share threshold through the flows (Miguel 31/10)", () => {
  it("a founder under the threshold renews at 0 % with no share lever; one who grew past it asks a share at his renewal", () => {
    const save = makeSave();
    const [a, b] = save.squad;
    const stays = renewalTalkFor(save, a, 2);
    expect(stays.ask.sharePct).toBe(0);
    expect(stays.zone.shareLever).toBe(CAREER_PRIZES.playerShare.enabled); // rc.35: the lever stays
    expect(renewPlayerFlow(save, a.id, 2).save.squad.find((p) => p.id === a.id)!.prizeSharePct).toBe(0);
    const grown = structuredClone(save);
    const g = grown.squad.find((p) => p.id === b.id)!;
    g.overall = CAREER_PRIZE_SHARE.shareThresholdOverall + 4;
    const talk = renewalTalkFor(grown, g, 2);
    expect(talk.ask.sharePct).toBe(prizeShareAskFor({ overall: g.overall, age: ageOf(g.birthYear, 0) }));
    expect(talk.ask.sharePct).toBeGreaterThan(0);
    expect(talk.zone.shareLever).toBe(CAREER_PRIZES.playerShare.enabled);
    expect(renewPlayerFlow(grown, g.id, 2).save.squad.find((p) => p.id === g.id)!.prizeSharePct).toBe(talk.ask.sharePct);
  });

  it("a deal signed with a share keeps it through a load and on every podium until it is renewed (an rc.33 renewal's 3 %)", () => {
    const save = makeSave();
    // rc.34 review: an rc.33 FOUNDING deal's share is 0 after the load (repairFoundingShareOnLoad,
    // "starting players get no percentage"); a deal he signed after it keeps what it signed.
    save.squad[0].prizeSharePct = 3; // rc.33 gave a 70 a 3 % share
    save.squad[0].contractEndSeason = 2; // a renewed deal, past the founding one
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)))!;
    expect(loaded.squad[0].prizeSharePct).toBe(3);
    const ev = { def: { tier: "regional" }, fieldedIds: [...loaded.starterIds] } as unknown as NonNullable<CareerSave["activeEvent"]>;
    expect(eventPlayerShareFor(loaded, ev, "champion", 10_000)).toBe(quantize((10_000 * 3) / 100 + 1e-6));
    // At its renewal he asks what the curve says today — none under the threshold.
    expect(renewalTalkFor(loaded, loaded.squad[0], 2).ask.sharePct).toBe(0);
  });
});

describe("rc.34 front I — the talk on real players: both levers move, every press moves its number, a closed way names its reason", () => {
  const PRESSES: [TalkLever, 1 | -1][] = [
    ["wage", -1],
    ["wage", 1],
    ["share", -1],
    ["share", 1],
  ];
  const REGIONS: Region[] = ["EU", "SAM", "SSA"];
  const careerIn = (region: Region, rosterKey: CreateCareerInput["rosterKey"], difficulty: CareerDifficulty, seed: number) =>
    createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region }, rosterKey, difficulty }, seed);

  /** Every state the sheet's presses reach from his ask (breadth-first), each checked; returns how many. */
  function walk(label: string, talk: (o?: ContractOffer) => NegotiationAnswer, askShare: number): number {
    const a0 = talk();
    expect(a0.ask.sharePct, label).toBe(askShare);
    expect(a0.zone.shareLever, label).toBe(CAREER_PRIZES.playerShare.enabled);
    if (a0.ask.weekly > a0.zone.minWeekly) expect(talkPressFor(a0, "wage", -1), `${label}: the wage moves`).not.toBeNull();
    const seen = new Set<string>();
    const queue: (ContractOffer | undefined)[] = [undefined];
    while (queue.length && seen.size < 120) {
      const a = talk(queue.shift());
      const key = `${a.offer.weekly}|${a.offer.sharePct}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expect(a.accepted, `${label} ${key}`).toBe(true);
      expect(weeklyWage(a.terms.wagePerSplit), `${label} ${key}`).toBe(a.offer.weekly);
      for (const [lever, dir] of PRESSES) {
        const next = talkPressFor(a, lever, dir);
        const why = lever === "wage" ? (dir < 0 ? a.limits.wageDown : a.limits.wageUp) : dir < 0 ? a.limits.shareDown : a.limits.shareUp;
        expect(next === null, `${label} ${key} ${lever}${dir}`).toBe(why !== null || (lever === "share" && !a.zone.shareLever));
        if (!next) continue;
        const b = talk(next);
        // A wage press moves the wage; a share press moves the share AND the wage.
        expect(b.offer.weekly, `${label} ${key} ${lever}${dir}`).not.toBe(a.offer.weekly);
        if (lever === "share") expect(b.offer.sharePct).toBe(a.offer.sharePct + dir);
        // rc.35: only a wage press down may leave the zone (his odds fall under his floor).
        if (!b.accepted) {
          expect(`${lever}${dir}`, `${label} ${key}`).toBe("wage-1");
          expect(b.odds).toBeLessThan(1);
          continue;
        }
        queue.push(next);
      }
    }
    return seen.size;
  }

  it("the founders renewing — as they are, grown past the threshold, at the raise cap / market floor / jump cap, with a title raise, ambitious, after a refused Blockbuster — at 1, 2 and 3 seasons", () => {
    let talks = 0;
    let withShare = 0;
    const bounds = new Set<string>();
    for (const region of REGIONS) {
      for (const rosterKey of ["balanced", "prospects", "journeymen"] as const) {
        for (const difficulty of ["normal", "hard"] as CareerDifficulty[]) {
          const save = careerIn(region, rosterKey, difficulty, 34_100 + talks);
          // Season 1, a Major won with them (the title raise); three growth paths; one refused Blockbuster.
          const s1 = structuredClone(save);
          s1.clock.seasonIndex = 1;
          s1.eventResults.push({
            eventId: "front-i",
            tier: "major",
            seasonIndex: 1,
            week: 10,
            name: "Major",
            rows: [],
            championRef: "user",
            userPlacement: "champion",
            fieldQuality: 1,
          } as CompactEventResult);
          const cases = [
            ...save.squad.map((p) => ({ s: save, p, tag: "as is" })),
            ...s1.squad.map((p, i) => ({
              s: s1,
              p: { ...p, overall: p.overall + [6, 12, 22][i % 3], ...(i === 1 ? { blockbusterRefusedUntil: p.contractEndSeason } : {}) },
              tag: "grown",
            })),
          ];
          for (const { s, p, tag } of cases) {
            for (const len of [1, 2, 3] as const) {
              const share = prizeShareAskFor({ overall: p.overall, age: ageOf(p.birthYear, s.clock.seasonIndex) });
              walk(`${region}/${rosterKey}/${difficulty} ${p.name} ${tag} ${p.overall} L${len}`, (o) => renewalTalkFor(s, p, len, o), share);
              bounds.add(renewalTermsOfSave(s, p, len).bound);
              talks += 1;
              if (share > 0) withShare += 1;
            }
          }
        }
      }
    }
    expect(talks).toBe(REGIONS.length * 3 * 2 * 6 * 3);
    expect(withShare).toBeGreaterThan(20);
    // The renewal rule's bounds the cases reach include the jump cap (a founder who grew far).
    expect(bounds.has("jump")).toBe(true);
    expect(bounds.has("fresh")).toBe(true);
  }, 120_000);

  it("every market player and generated rookie, at two reputations and 1, 2 and 3 seasons — and the flow writes the talk's terms", () => {
    let talks = 0;
    let rookies = 0;
    let askers = 0;
    let signed = 0;
    for (const region of REGIONS) {
      for (const rep of [5, 60]) {
        const save = careerIn(region, "balanced", "normal", 34_200 + REGIONS.indexOf(region));
        save.reputation = rep;
        save.finances.balance = 4_000_000;
        const ids = [
          ...save.world.freeAgentIds,
          ...Object.values(save.world.orgs)
            .filter((o) => o.region === region)
            .flatMap((o) => o.playerIds),
        ];
        for (const view of viewsOf(save, ids)) {
          if (view.age < 13) continue;
          const share = prizeShareAskFor(view);
          for (const len of [1, 2, 3] as const) {
            const pack = askOf(save, view, len);
            const talk = (o?: ContractOffer) => signingTalkFor(save, view, pack, o);
            walk(`${region}@${rep} ${view.name} ${view.overall} L${len}`, talk, share);
            talks += 1;
            if (view.kind === "fictional") rookies += 1;
            if (share > 0) askers += 1;
            // The deepest deal the presses reach (his floor at the most share he takes) is the contract written.
            if (rep === 60 && len === 2 && talks % 7 === 0) {
              let a = talk();
              for (let n = talkPressFor(a, "share", 1); n; n = talkPressFor(a, "share", 1)) a = talk(n);
              for (let n = talkPressFor(a, "wage", -1); n; n = talkPressFor(a, "wage", -1)) a = talk(n);
              const res = signPlayerFlow(save, view.id, { lengthSeasons: len, offer: { weekly: a.offer.weekly, sharePct: a.offer.sharePct } });
              if (res.error) continue;
              const p = res.save.squad.find((x) => x.id === view.id)!;
              expect(p.salaryPerSplit).toBe(a.terms.wagePerSplit);
              expect(p.prizeSharePct).toBe(a.terms.sharePct);
              signed += 1;
            }
          }
        }
      }
    }
    expect(talks).toBeGreaterThan(500);
    expect(rookies).toBeGreaterThan(50);
    expect(askers).toBeGreaterThan(50);
    expect(signed).toBeGreaterThan(5);
  }, 120_000);
});
