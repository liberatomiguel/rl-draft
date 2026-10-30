/**
 * Road to Worlds — insert rolling (v2.0, R33). Pure and deterministic: a
 * (careerSeed, season, week) roll decides whether a mid-week insert surfaces
 * and which one, honouring requirements and a recency window so the same
 * card does not repeat for weeks. The STORE/flow layer applies choices.
 */

import { CAREER_ECONOMY, CAREER_INSERTS } from "@/config/balance";
import { CAREER_INSERTS_CATALOG, type InsertDef } from "@/data/career/inserts";
import { weekOfDay } from "./calendar";
import { insertMoneyFor, moneyIndex, weeklyOf } from "./economy";
import { otherIncomeRoomOf, type OtherIncomeRoom } from "./sponsorDeals";
import type { CareerSave } from "./types";
import { derivedFloat, streams } from "./seeds";

/**
 * rc.34 (ECO-05, S7): the org's weekly guaranteed income — the sponsor
 * deal's weekly pay and the fanbase (the statement's own figures) — the
 * floor of the other-income cap's basis.
 */
export function guaranteedWeeklyOf(save: CareerSave): number {
  const s = save.sponsor;
  const sponsor = s ? (s.terms?.weekly ?? weeklyOf(s.basePerSplit)) : 0;
  const fanbase = weeklyOf(
    Math.max(0, save.reputation) * CAREER_ECONOMY.passivePerRepPoint * moneyIndex(save.clock.seasonIndex, "flat"),
  );
  return sponsor + fanbase;
}

/** rc.34 (ECO-05): the other income this save may still take (the per-split count, the season's share). */
export function otherIncomeRoomOfSave(save: CareerSave): OtherIncomeRoom {
  return otherIncomeRoomOf({
    tally: save.finances.incomeTally,
    seasonIndex: save.clock.seasonIndex,
    week: weekOfDay(save.clock.day),
    guaranteedWeekly: guaranteedWeeklyOf(save),
  });
}

/** rc.34 (ECO-05): the fee an insert's option pays (its season-0 money on the index), or 0. */
export function insertFeeOf(def: InsertDef, seasonIndex: number): number {
  const money = Math.max(0, ...def.options.map((o) => o.effects.money ?? 0));
  return money > 0 ? insertMoneyFor(money, seasonIndex) : 0;
}

export function insertEligible(def: InsertDef, save: CareerSave): boolean {
  const r = def.requires;
  if (!r) return true;
  if (r.sponsor && !save.sponsor) return false;
  if (r.coach && !save.coach) return false;
  if (r.minRep !== undefined && save.reputation < r.minRep) return false;
  // rc.32 (M1): the catalogue's money is season-0 money, on the money index.
  if (r.minBalance !== undefined && save.finances.balance < insertMoneyFor(r.minBalance, save.clock.seasonIndex)) {
    return false;
  }
  return true;
}

/**
 * rc.34 (ECO-05, decision 6-B): an insert that pays a fee is other income —
 * it comes only while the cap has room (CAREER_SPONSOR.otherIncome: a count
 * a split, a share of the season's earned income).
 */
export function insertWithinCap(def: InsertDef, save: CareerSave): boolean {
  const fee = insertFeeOf(def, save.clock.seasonIndex);
  if (fee <= 0) return true;
  const room = otherIncomeRoomOfSave(save);
  return room.count >= 1 && fee <= room.amount;
}

/**
 * The insert that surfaces on this week's insert day, or null. Called once
 * per week (the flow guards with the week's roll flag).
 */
export function rollInsertFor(save: CareerSave, week: number): InsertDef | null {
  const key = `${save.clock.seasonIndex}:${week}`;
  if (derivedFloat(save.careerSeed, streams.gen("insertRoll", key)) >= CAREER_INSERTS.chancePerWeek) {
    return null;
  }
  const recent = new Set((save.insertsSeen ?? []).slice(-CAREER_INSERTS.recentWindow));
  const pool = CAREER_INSERTS_CATALOG.filter((d) => insertEligible(d, save) && insertWithinCap(d, save) && !recent.has(d.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, d) => s + d.weight, 0);
  let f = derivedFloat(save.careerSeed, streams.gen("insertPick", key)) * total;
  for (const d of pool) {
    f -= d.weight;
    if (f <= 0) return d;
  }
  return pool[pool.length - 1];
}

/** Which weekday the insert lands on this week (one of CAREER_INSERTS.days). */
export function insertDowFor(save: CareerSave, week: number): number {
  const days = CAREER_INSERTS.days;
  const f = derivedFloat(save.careerSeed, streams.gen("insertDay", `${save.clock.seasonIndex}:${week}`));
  return days[Math.min(days.length - 1, Math.floor(f * days.length))];
}
