"use client";

/**
 * Road to Worlds — the renewal readout (rc.32, ECONOMY-CONTRACT M2, a
 * PROVISIONAL default, R58): the rule and both numbers — his market ask and
 * what the renewal prices — straight from `renewalTermsFor`, the function
 * `renewPlayerFlow` prices with. Used by the Squad renewal sheet and the
 * Market's renewal panel. Every number interpolates CAREER_SALARY.
 */

import { AppLink } from "@/components/ui/AppLink";
import { Panel } from "@/components/ui/Panel";
import { CAREER_SALARY } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { renewalTermsFor, blockbusterRefusedFlag, type RenewalTerms } from "@/engine/career/renewal";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { wageLabel } from "./careerUi";

/** The Market's renewal panel (My deals): this season's expiring contracts, priced for two seasons. */
export function RenewalsPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const expiring = save.squad.filter((p) => p.contractEndSeason === save.clock.seasonIndex);
  return (
    <Panel className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.squad.renewalsTitle}</p>
        {expiring.length > 0 ? (
          <AppLink href="/career/squad" className="text-xs font-semibold text-cyan hover:underline">
            {C.squad.renewalsGo}
          </AppLink>
        ) : null}
      </div>
      {expiring.length === 0 ? (
        <p className="text-xs text-faint">{C.squad.renewalsEmpty}</p>
      ) : (
        <div className="space-y-2">
          {expiring.map((p) => (
            <div key={p.id}>
              <p className="display mb-1 text-sm font-bold text-ink">{p.name}</p>
              <RenewalReadout terms={renewalTermsOf(save, p, 2)} C={C} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** The terms the flow would price for `p` today (the same inputs as renewPlayerFlow). */
export function renewalTermsOf(save: CareerSave, p: SquadPlayer, lengthSeasons: 1 | 2 | 3): RenewalTerms {
  return renewalTermsFor(p, {
    rep: save.reputation,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    careerSeed: save.careerSeed,
    lengthSeasons,
    blockbusterRefused: Boolean(save.flags[blockbusterRefusedFlag(p.id)]),
  });
}

const pct = (mult: number) => Math.round((mult - 1) * 100);

export function RenewalReadout({ terms, C, className }: { terms: RenewalTerms; C: CareerCopy; className?: string }) {
  const S = CAREER_SALARY;
  const cap = String(S.renewalRaiseCap);
  const floorPct = Math.round(S.renewalMarketFloor * 100);
  const capFloor = terms.rule === "capFloor";
  return (
    <div className={cx("rounded-lg border border-line bg-white/[0.02] p-3 text-xs", className)}>
      <p className="kicker mb-1.5 text-[10px]">{C.squad.renewalTerms}</p>
      <p className="leading-relaxed text-sub">
        {capFloor ? C.squad.renewalRuleCapFloor(cap, floorPct) : C.squad.renewalRuleFresh}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-faint">{C.squad.renewalMarketAsk}</p>
          <p className="font-semibold text-ink">{wageLabel(C, terms.freshAsk, false)}</p>
        </div>
        <div>
          <p className="text-[10px] text-faint">{C.squad.renewalAsk}</p>
          <p className={cx("font-semibold", terms.ask < terms.freshAsk ? "text-good" : "text-ink")}>
            {wageLabel(C, terms.ask, false)}
          </p>
        </div>
      </div>
      {capFloor ? (
        <p className="mt-1.5 text-[11px] text-sub">
          {terms.bound === "cap"
            ? C.squad.renewalBoundCap(cap)
            : terms.bound === "floor"
              ? C.squad.renewalBoundFloor(floorPct)
              : C.squad.renewalBoundFresh}
        </p>
      ) : null}
      {capFloor && terms.ambitious ? (
        <p className="mt-1 text-[11px] text-orange-bright">{C.squad.renewalAmbition(pct(S.ambitionRenewalMult))}</p>
      ) : null}
      {capFloor && terms.blockbusterRefused ? (
        <p className="mt-1 text-[11px] text-orange-bright">
          {C.squad.renewalBlockbuster(pct(S.blockbusterRefusalRenewalMult))}
        </p>
      ) : null}
    </div>
  );
}
