/**
 * Road to Worlds — renewing your own players (rc.32, ECONOMY-CONTRACT M2,
 * decision 2-B as a PROVISIONAL default, ROAD-TO-WORLDS-DECISIONS R58).
 *
 * ONE pure function prices a renewal for `renewPlayerFlow`, the Squad screen
 * and the Market's renewal panel, so the readout can never quote a different
 * deal. Under CAREER_SALARY.renewalRule "capFloor":
 *
 *   ask = min(fresh, max(current wage × renewalRaiseCap, fresh × floorShare))
 *
 * where the floor never exceeds current wage × maxJump (rc.33), on the core
 * fresh ask (no ambition premium, no Blockbuster surcharge), then the ambition
 * premium and the Blockbuster-refusal surcharge on top. A player who developed
 * is not repriced at full market value in one step (the raise is capped), a
 * breakout star still pays at least the floor of his value, and a declining
 * veteran renews at his lower fresh ask. "fresh" is rc.31: the plain fresh ask
 * (`renewalAskFor`), with rc.32's fix that a refused Blockbuster surcharges it
 * (the stamp `blockbusterRefusedUntil`, `market.blockbusterRefusalApplies` —
 * the one source for both rules).
 *
 * rc.37 (F1 package 3, CAREER_RENEWAL_TENURE): floorShare and maxJump are
 * rc.36's renewalMarketFloor (0.6) and renewalMaxJump (×2.5) for his first
 * renewal at the club and while he has at most protectedTenure seasons there —
 * the initial protection — then rise a step a season with the club (the jump
 * ×2.75 / ×3.0; the floor stays 0.6 by default, floorPerSeason 0 — measured,
 * a rising floor repriced ordinary players), so a developed player's renewal
 * — bound by the jump — climbs toward his market ask instead of staying a
 * fraction of it. The top's extremes are capped: ambition × refused
 * Blockbuster × titles at most premiumMax, and with his rep premium at most
 * premiumStackCap × his rep-neutral price.
 *
 * Engine rules: pure, no React; every number from CAREER_SALARY and
 * CAREER_RENEWAL_TENURE.
 */

import { CAREER_RENEWAL_TENURE, CAREER_SALARY } from "@/config/balance";
import { quantize, repPremiumFor } from "./economy";
import { blockbusterRefusalApplies, isAmbitiousRenewal, renewalAskFor } from "./market";
import type { CareerDifficulty, SquadPlayer } from "./types";

export interface RenewalTerms {
  /** What the renewal prices (the rule applied, surcharges on top). */
  ask: number;
  /** His fresh market ask (rc.31's renewal price, ambition included). */
  freshAsk: number;
  /** The wage he renews from. */
  oldWage: number;
  rule: "capFloor" | "fresh";
  /** Current wage × renewalRaiseCap (quantized). */
  raiseCap: number;
  /** The core fresh ask × floorShare (quantized), never above current wage × maxJump. */
  marketFloor: number;
  /**
   * What priced it: his fresh ask (lower than the cap), the raise cap, the
   * market floor, or the floor held at maxJump × his wage (rc.33).
   */
  bound: "fresh" | "cap" | "floor" | "jump";
  ambitious: boolean;
  blockbusterRefused: boolean;
  /** rc.33 (M6 lever 3): the title raise applied on top (0 = none), from `titlePremiumFor`. */
  titlePremium: number;
  /** rc.37 (F1): his seasons with the club at pricing (seasonIndex − joinedSeason; 0 without a joinedSeason). */
  tenure: number;
  /** rc.37 (F1): the steps past the protection (0 = rc.36's rule: his first renewal, or tenure ≤ protectedTenure). */
  tenureSteps: number;
  /** rc.37 (F1): the market floor's share of his core fresh ask (0.6 protected, up to floorMax). */
  floorShare: number;
  /** rc.37 (F1): the most this renewal multiplies his wage before premiums (×2.5 protected, up to jumpMax). */
  maxJump: number;
  /** rc.37 (F1): true when the premium stack (ambition × Blockbuster × titles) hit its cap. */
  premiumCapped: boolean;
  /** rc.37 (F1): the premium multiple applied on top (1 = none; the cap when `premiumCapped`). */
  premiumMult: number;
}

/** The titles the user won while this player was in the squad, inside the premium's window. */
export interface RenewalTitles {
  majorOrWorlds: number;
  regional: number;
}

/** rc.33 (M6 lever 3): the title raise a renewal carries — capped, 0 without titles. */
export function titlePremiumFor(titles: RenewalTitles | undefined): number {
  if (!titles) return 0;
  const T = CAREER_SALARY.titleRenewalPremium;
  const raw = titles.majorOrWorlds * T.perMajorOrWorlds + titles.regional * T.perRegional;
  return Math.max(0, Math.min(T.max, Math.round(raw * 100) / 100));
}

/**
 * rc.37 (F1): the renewal ladder for a player — his seasons with the club and
 * the floor share and jump they allow. His first renewal at the club
 * (`renewalCount` 0) always reads rc.36's rule, whatever window he joined in.
 */
export function renewalLadderFor(
  player: Partial<Pick<SquadPlayer, "joinedSeason" | "renewalCount">>,
  seasonIndex: number,
): { tenure: number; tenureSteps: number; floorShare: number; maxJump: number } {
  const R = CAREER_RENEWAL_TENURE;
  const S = CAREER_SALARY;
  const tenure = player.joinedSeason == null ? 0 : Math.max(0, seasonIndex - player.joinedSeason);
  const tenureSteps = (player.renewalCount ?? 0) === 0 ? 0 : Math.max(0, tenure - R.protectedTenure);
  return {
    tenure,
    tenureSteps,
    floorShare: Math.min(R.floorMax, S.renewalMarketFloor + R.floorPerSeason * tenureSteps),
    maxJump: Math.min(R.jumpMax, S.renewalMaxJump + R.jumpPerSeason * tenureSteps),
  };
}

export function renewalTermsFor(
  player: Pick<SquadPlayer, "id" | "overall" | "potential" | "birthYear" | "salaryPerSplit"> &
    Partial<
      Pick<SquadPlayer, "contractEndSeason" | "blockbusterRefusedUntil" | "peakAge" | "joinedSeason" | "renewalCount">
    >,
  ctx: {
    rep: number;
    seasonIndex: number;
    difficulty: CareerDifficulty;
    careerSeed: number;
    lengthSeasons: 1 | 2 | 3;
    /** rc.33 (M6 lever 3): the titles won with him in the window (`renewalTitlesOf`); none = no raise. */
    titles?: RenewalTitles;
    /** rc.37 (F1): the career's development model (`growthModelOf(save.world)`; market.valueInputOf). */
    growthModel?: number;
  },
): RenewalTerms {
  const S = CAREER_SALARY;
  const R = CAREER_RENEWAL_TENURE;
  const askCtx = {
    rep: ctx.rep,
    seasonIndex: ctx.seasonIndex,
    difficulty: ctx.difficulty,
    careerSeed: ctx.careerSeed,
    lengthSeasons: ctx.lengthSeasons,
    growthModel: ctx.growthModel,
  };
  // The fresh ask carries both surcharges (ambition, a refused Blockbuster).
  const freshAsk = renewalAskFor(player, askCtx);
  const ambitious = isAmbitiousRenewal(player.overall, ctx.rep);
  const refused = blockbusterRefusalApplies(player);
  const oldWage = player.salaryPerSplit;
  const core = ambitious || refused ? renewalAskFor(player, { ...askCtx, surcharges: false }) : freshAsk;
  // rc.37 (F1): the floor and the jump climb with his seasons at the club.
  const ladder = renewalLadderFor(player, ctx.seasonIndex);
  const raiseCap = quantize(oldWage * S.renewalRaiseCap);
  // rc.33: the floor never lifts him more than maxJump × in one renewal.
  const fullFloor = quantize(core * ladder.floorShare);
  const jumpCap = quantize(oldWage * ladder.maxJump);
  const marketFloor = Math.min(fullFloor, Math.max(jumpCap, raiseCap));
  // rc.37 F6: the value floor — a share of his core ask by renewal count that the jump never caps (0 = off).
  const vf = R.valueFloorByRenewal;
  const valueShare = vf.length > 0 ? vf[Math.min(player.renewalCount ?? 0, vf.length - 1)] : 0;
  const valueFloor = valueShare > 0 ? quantize(core * valueShare) : 0;
  const titlePremium = titlePremiumFor(ctx.titles);
  const withTitles = (x: number) => (titlePremium > 0 ? quantize(x * (1 + titlePremium)) : x);
  // rc.37 (F1): the top's extremes — the premium stack, alone and with his rep premium, is capped.
  const rawStack = (ambitious ? S.ambitionRenewalMult : 1) * (refused ? S.blockbusterRefusalRenewalMult : 1) * (1 + titlePremium);
  const stackCap = Math.min(R.premiumMax, R.premiumStackCap / repPremiumFor(player.overall, ctx.rep));
  const premiumCapped = rawStack > stackCap + 1e-9;
  const premiumMult = premiumCapped ? stackCap : rawStack;
  const extra = { ...ladder, premiumCapped, premiumMult };
  if (S.renewalRule !== "capFloor") {
    return {
      ask: premiumCapped ? quantize(core * stackCap) : withTitles(freshAsk),
      freshAsk,
      oldWage,
      rule: "fresh",
      raiseCap,
      marketFloor,
      bound: "fresh",
      ambitious,
      blockbusterRefused: refused,
      titlePremium,
      ...extra,
    };
  }
  const bounded = Math.max(raiseCap, marketFloor, valueFloor);
  const ruled = Math.min(core, bounded);
  const bound: RenewalTerms["bound"] =
    ruled >= core
      ? "fresh"
      : valueFloor > Math.max(raiseCap, marketFloor)
        ? "floor"
        : raiseCap >= marketFloor
          ? "cap"
          : marketFloor < fullFloor
            ? "jump"
            : "floor";
  const surcharge = refused ? S.blockbusterRefusalRenewalMult : 1;
  // Under the cap his fresh ask stands (both surcharges already in it);
  // otherwise the bound, with the ambition premium and the Blockbuster
  // surcharge on top. rc.37 (F1): a stack over its cap applies the cap instead.
  const ask = premiumCapped
    ? quantize((bound === "fresh" ? core : ruled) * stackCap)
    : withTitles(
        bound === "fresh" ? freshAsk : quantize(ruled * (ambitious ? S.ambitionRenewalMult : 1) * surcharge),
      );
  return {
    ask,
    freshAsk,
    oldWage,
    rule: "capFloor",
    raiseCap,
    marketFloor,
    bound,
    ambitious,
    blockbusterRefused: refused,
    titlePremium,
    ...extra,
  };
}
