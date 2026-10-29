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
 * on the core fresh ask (no ambition premium), then the ambition premium and
 * the Blockbuster-refusal surcharge on top. A player who developed is not
 * repriced at full market value in one step (the raise is capped), a breakout
 * star still pays at least the floor of his value, and a declining veteran
 * renews at his lower fresh ask. "fresh" is rc.31: the plain fresh ask
 * (`renewalAskFor`, which never applied the Blockbuster surcharge).
 *
 * Engine rules: pure, no React; every number from CAREER_SALARY.
 */

import { CAREER_SALARY } from "@/config/balance";
import { quantize } from "./economy";
import { isAmbitiousRenewal, renewalAskFor } from "./market";
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

/** The save flag a declined Blockbuster bid leaves on its player (the +10 % renewal surcharge). */
export function blockbusterRefusedFlag(playerId: string): string {
  return `blockbusterRefused:${playerId}`;
}

export function renewalTermsFor(
  player: Pick<SquadPlayer, "id" | "overall" | "potential" | "birthYear" | "salaryPerSplit">,
  ctx: {
    rep: number;
    seasonIndex: number;
    difficulty: CareerDifficulty;
    careerSeed: number;
    lengthSeasons: 1 | 2 | 3;
    /** He refused (declined) a scripted Blockbuster bid. */
    blockbusterRefused?: boolean;
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
  const freshAsk = renewalAskFor(player, askCtx);
  const ambitious = isAmbitiousRenewal(player.overall, ctx.rep);
  const refused = Boolean(ctx.blockbusterRefused);
  const oldWage = player.salaryPerSplit;
  const core = ambitious ? renewalAskFor(player, { ...askCtx, surcharges: false }) : freshAsk;
  const raiseCap = quantize(oldWage * S.renewalRaiseCap);
  const marketFloor = quantize(core * S.renewalMarketFloor);
  if (S.renewalRule !== "capFloor") {
    return { ask: freshAsk, freshAsk, oldWage, rule: "fresh", raiseCap, marketFloor, bound: "fresh", ambitious, blockbusterRefused: refused };
  }
  const bounded = Math.max(raiseCap, marketFloor);
  const ruled = Math.min(core, bounded);
  const bound: RenewalTerms["bound"] = ruled >= core ? "fresh" : raiseCap >= marketFloor ? "cap" : "floor";
  const surcharge = refused ? S.blockbusterRefusalRenewalMult : 1;
  // Under the cap his fresh ask stands (ambition already in it); otherwise the
  // bound, with the ambition premium on top. The Blockbuster surcharge tops both.
  const ask =
    bound === "fresh"
      ? refused
        ? quantize(freshAsk * surcharge)
        : freshAsk
      : quantize(ruled * (ambitious ? S.ambitionRenewalMult : 1) * surcharge);
  return { ask, freshAsk, oldWage, rule: "capFloor", raiseCap, marketFloor, bound, ambitious, blockbusterRefused: refused };
}
