/**
 * Road to Worlds — renewing your own players (rc.32, ECONOMY-CONTRACT M2,
 * decision 2-B as a PROVISIONAL default, ROAD-TO-WORLDS-DECISIONS R58).
 *
 * ONE pure function prices a renewal for `renewPlayerFlow`, the Squad screen
 * and the Market's renewal panel, so the readout can never quote a different
 * deal. Under CAREER_SALARY.renewalRule "capFloor":
 *
 *   ask = min(fresh, max(current wage × renewalRaiseCap, fresh × renewalMarketFloor))
 *
 * on the core fresh ask (no ambition premium, no Blockbuster surcharge),
 * then the ambition premium and the Blockbuster-refusal surcharge on top. A
 * player who developed is not repriced at full market value in one step (the
 * raise is capped), a breakout star still pays at least the floor of his
 * value, and a declining veteran renews at his lower fresh ask. "fresh" is
 * rc.31: the plain fresh ask (`renewalAskFor`), with rc.32's fix that a
 * refused Blockbuster surcharges it (the stamp `blockbusterRefusedUntil`,
 * `market.blockbusterRefusalApplies` — the one source for both rules).
 *
 * Engine rules: pure, no React; every number from CAREER_SALARY.
 */

import { CAREER_SALARY } from "@/config/balance";
import { quantize } from "./economy";
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
  /** The core fresh ask × renewalMarketFloor (quantized). */
  marketFloor: number;
  /** What priced it: his fresh ask (lower than the cap), the raise cap, or the market floor. */
  bound: "fresh" | "cap" | "floor";
  ambitious: boolean;
  blockbusterRefused: boolean;
}

export function renewalTermsFor(
  player: Pick<SquadPlayer, "id" | "overall" | "potential" | "birthYear" | "salaryPerSplit"> &
    Partial<Pick<SquadPlayer, "contractEndSeason" | "blockbusterRefusedUntil">>,
  ctx: {
    rep: number;
    seasonIndex: number;
    difficulty: CareerDifficulty;
    careerSeed: number;
    lengthSeasons: 1 | 2 | 3;
  },
): RenewalTerms {
  const S = CAREER_SALARY;
  const askCtx = {
    rep: ctx.rep,
    seasonIndex: ctx.seasonIndex,
    difficulty: ctx.difficulty,
    careerSeed: ctx.careerSeed,
    lengthSeasons: ctx.lengthSeasons,
  };
  // The fresh ask carries both surcharges (ambition, a refused Blockbuster).
  const freshAsk = renewalAskFor(player, askCtx);
  const ambitious = isAmbitiousRenewal(player.overall, ctx.rep);
  const refused = blockbusterRefusalApplies(player);
  const oldWage = player.salaryPerSplit;
  const core = ambitious || refused ? renewalAskFor(player, { ...askCtx, surcharges: false }) : freshAsk;
  const raiseCap = quantize(oldWage * S.renewalRaiseCap);
  const marketFloor = quantize(core * S.renewalMarketFloor);
  if (S.renewalRule !== "capFloor") {
    return { ask: freshAsk, freshAsk, oldWage, rule: "fresh", raiseCap, marketFloor, bound: "fresh", ambitious, blockbusterRefused: refused };
  }
  const bounded = Math.max(raiseCap, marketFloor);
  const ruled = Math.min(core, bounded);
  const bound: RenewalTerms["bound"] = ruled >= core ? "fresh" : raiseCap >= marketFloor ? "cap" : "floor";
  const surcharge = refused ? S.blockbusterRefusalRenewalMult : 1;
  // Under the cap his fresh ask stands (both surcharges already in it);
  // otherwise the bound, with the ambition premium and the Blockbuster
  // surcharge on top.
  const ask =
    bound === "fresh" ? freshAsk : quantize(ruled * (ambitious ? S.ambitionRenewalMult : 1) * surcharge);
  return { ask, freshAsk, oldWage, rule: "capFloor", raiseCap, marketFloor, bound, ambitious, blockbusterRefused: refused };
}
