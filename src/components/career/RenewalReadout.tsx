"use client";

/**
 * Road to Worlds — the renewal readout (rc.32, ECONOMY-CONTRACT M2, a
 * PROVISIONAL default, R58): the rule and both numbers — his market ask and
 * what the renewal prices — straight from `renewalTermsFor`, the function
 * `renewPlayerFlow` prices with. Used by the Squad renewal sheet and the
 * Market's renewal panel. Every number interpolates CAREER_SALARY. With the
 * save and the player it also shows the runway the renewal leaves (M4, the
 * same `runwayWeeksAfter` as the Market's signing readout).
 */

import { AppLink } from "@/components/ui/AppLink";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { CAREER_PAYROLL, CAREER_SALARY } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { payrollProjection, runwayWeeksAfter } from "@/engine/career/economy";
import type { RenewalTerms } from "@/engine/career/renewal";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { renewalTermsOfSave, weeklyStatementOf } from "@/store/careerFlow";
import { wageLabel } from "./careerUi";

/** The Market's renewal panel (My deals): this season's expiring contracts, priced for two seasons. */
export function RenewalsPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const expiring = save.squad.filter((p) => p.contractEndSeason === save.clock.seasonIndex);
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="display text-lg uppercase leading-none text-ink">{C.squad.renewalsTitle}</h3>
        {expiring.length > 0 ? (
          <AppLink href="/career/squad" className={buttonClass("secondary", "sm")}>
            {C.squad.renewalsGo}
          </AppLink>
        ) : null}
      </div>
      {expiring.length === 0 ? (
        <p className="mt-2 text-sm text-sub">{C.squad.renewalsEmpty}</p>
      ) : (
        // One row per expiring contract, divided by hairlines (no box per player).
        <div className="mt-3 border-t border-line">
          {expiring.map((p) => (
            <div key={p.id} className="border-b border-line py-3 last:border-b-0 last:pb-0">
              <p className="display mb-1.5 text-base font-bold text-ink">{p.name}</p>
              <RenewalReadout terms={renewalTermsOf(save, p, 2)} C={C} save={save} player={p} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** The terms the flow would price for `p` today (the same inputs as renewPlayerFlow). */
export function renewalTermsOf(save: CareerSave, p: SquadPlayer, lengthSeasons: 1 | 2 | 3): RenewalTerms {
  return renewalTermsOfSave(save, p, lengthSeasons);
}

/**
 * rc.32 (M4, provisional): the runway this renewal leaves — today's weekly
 * net with his wage swapped for the renewal's ask (null = still in the black).
 */
export function renewalRunwayOf(save: CareerSave, p: SquadPlayer, terms: RenewalTerms): number | null {
  const wageBill = payrollProjection({
    squadSalaries: save.squad.map((x) => ({ id: x.id, amount: x.salaryPerSplit })),
    coachSalary: save.coach?.salaryPerSplit ?? null,
    remove: [p.id],
    add: [terms.ask],
  });
  return runwayWeeksAfter({
    balance: save.finances.balance,
    weeklyNet: weeklyStatementOf(save).net,
    weeklyChange: -(wageBill.after - wageBill.now),
  });
}

const pct = (mult: number) => Math.round((mult - 1) * 100);

export function RenewalReadout({
  terms,
  C,
  className,
  save,
  player,
}: {
  terms: RenewalTerms;
  C: CareerCopy;
  className?: string;
  /** With both, the readout adds the runway the renewal leaves. */
  save?: CareerSave;
  player?: SquadPlayer;
}) {
  const S = CAREER_SALARY;
  const runway = save && player ? renewalRunwayOf(save, player, terms) : undefined;
  const cap = String(S.renewalRaiseCap);
  // rc.37 (F1): the floor and the jump his seasons with the club allow (the tenure ladder).
  const floorPct = Math.round(terms.floorShare * 100);
  const jump = String(terms.maxJump);
  const capFloor = terms.rule === "capFloor";
  return (
    // A section of its host (the renewal sheet, a row of the renewals board),
    // not a box inside it: the two asks as figures, then the rule's lines.
    <div className={cx("text-xs", className)}>
      <p className="kicker mb-2">{C.squad.renewalTerms}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={cx("display text-xl font-bold leading-none", terms.ask < terms.freshAsk ? "text-good" : "text-ink")}>
            {wageLabel(C, terms.ask, false)}
          </p>
          <p className="mt-1 text-xs text-sub">{C.squad.renewalAsk}</p>
        </div>
        <div>
          <p className="display text-xl font-bold leading-none text-sub">{wageLabel(C, terms.freshAsk, false)}</p>
          <p className="mt-1 text-xs text-sub">{C.squad.renewalMarketAsk}</p>
        </div>
      </div>
      <p className="mt-3 leading-relaxed text-sub">
        {capFloor ? C.squad.renewalRuleCapFloor(cap, floorPct, jump) : C.squad.renewalRuleFresh}
      </p>
      {/* rc.37 (F1): with the premiums capped he renews under the market ask (it carries
          them in full), so "he renews at his market ask" would mislead — the capped line says why. */}
      {capFloor && !(terms.premiumCapped && terms.bound === "fresh") ? (
        <p className="mt-1.5 text-sub">
          {terms.bound === "cap"
            ? C.squad.renewalBoundCap(cap)
            : terms.bound === "floor"
              ? C.squad.renewalBoundFloor(floorPct)
              : terms.bound === "jump"
                ? C.squad.renewalBoundJump(jump)
                : C.squad.renewalBoundFresh}
        </p>
      ) : null}
      {capFloor && terms.tenureSteps > 0 ? (
        <p className="mt-1 text-sub">{C.squad.renewalTenure(terms.tenure)}</p>
      ) : null}
      {/* rc.37 (F1): a capped stack shows its one applied total, never the premiums in full. */}
      {terms.premiumCapped ? (
        <p className="mt-1 text-orange-bright">{C.squad.renewalPremiumCapped(pct(terms.premiumMult))}</p>
      ) : null}
      {!terms.premiumCapped && terms.titlePremium > 0 ? (
        <p className="mt-1 text-orange-bright">{C.squad.renewalTitles(Math.round(terms.titlePremium * 100))}</p>
      ) : null}
      {!terms.premiumCapped && capFloor && terms.ambitious ? (
        <p className="mt-1 text-orange-bright">{C.squad.renewalAmbition(pct(S.ambitionRenewalMult))}</p>
      ) : null}
      {!terms.premiumCapped && terms.blockbusterRefused ? (
        <p className="mt-1 text-orange-bright">
          {C.squad.renewalBlockbuster(pct(S.blockbusterRefusalRenewalMult))}
        </p>
      ) : null}
      {runway !== undefined ? (
        <p
          className={cx(
            "mt-1.5",
            runway === null ? "text-good" : runway <= CAREER_PAYROLL.runwayWarnWeeks ? "text-bad" : "text-sub",
          )}
        >
          {C.market.runwayAfter(runway)}
        </p>
      ) : null}
    </div>
  );
}
