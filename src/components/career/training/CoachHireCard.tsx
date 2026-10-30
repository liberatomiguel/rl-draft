"use client";

/**
 * Road to Worlds — the coach card (rc.34, DEV-03 T4). Three attributes, each
 * with the one effect it has, printed from the functions that run it
 * (`careerTraining.coachImpactFor`): quality → focus efficiency (+ the team
 * rating modifier), experience → plan quality and wear, specialty → +25 % on
 * its objective; then the effect on the package you would run and the
 * expected impact over the next period against your current setup, and the
 * wage. The market's shortlist and the current-coach panel share it.
 */

import { useMemo } from "react";
import { CAREER_PLAN } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, CoachState } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { coachImpactFor } from "@/store/careerTraining";
import { wageLabel } from "@/components/career/careerUi";
import { Badge } from "@/components/ui/Badge";

export function CoachAttributeLines({
  save,
  coach,
  C,
  statLabels,
  showImpact,
}: {
  save: CareerSave;
  coach: CoachState;
  C: CareerCopy;
  statLabels: Record<string, string>;
  /** The expected impact vs the current setup (the shortlist; not the coach in post). */
  showImpact: boolean;
}) {
  const M = C.market;
  const P = C.training.plan;
  const impact = useMemo(() => coachImpactFor(save, coach), [save, coach]);
  const fx = coachEffectsFor(coach);
  const specialtyPct = Math.round(CAREER_PLAN.coach.specialtyBoost * 100);
  const vs = impact.vsCurrent;
  return (
    <ul className="space-y-1 text-[11px] leading-snug" aria-label={M.coachEffects}>
      <li>
        <span className="font-semibold text-ink">{M.coachQuality(Math.round(coach.overall))}</span>
        <span className="text-sub"> — {M.coachQualityEffect(impact.efficiencyPct)}</span>
        {fx.ratingMod > 0 ? <span className="text-cyan"> · {M.coachRating(fx.ratingMod)}</span> : null}
      </li>
      <li>
        <span className="font-semibold text-ink">{M.coachExperience(impact.experience)}</span>
        <span className="text-sub"> — {M.coachExperienceEffect(impact.planQualityPct, impact.wearCutPct)}</span>
      </li>
      <li>
        <span className="font-semibold text-ink">{M.coachSpecialty(P.objectives[impact.specialty])}</span>
        <span className="text-sub"> — {M.coachSpecialtyEffect(P.objectives[impact.specialty], specialtyPct)}</span>
      </li>
      <li className="text-faint">
        {M.coachBonus(statLabels[coach.bonusType] ?? coach.bonusType)} <span className="font-mono font-bold text-cyan">{coach.bonusLevel}</span>
        {coach.bestCard ? ` · ${M.coachBestCard(coach.bestCard)}` : ""}
        {coach.ceiling ? ` · ${M.coachGrows(coach.ceiling)}` : ""}
      </li>
      <li className="font-semibold text-good">{M.coachPackage(P.objectives[impact.packageObjective], impact.packagePct)}</li>
      {showImpact ? (
        <li className={cx("font-semibold", vs > 0.005 ? "text-good" : vs < -0.005 ? "text-bad" : "text-sub")}>
          {Math.abs(vs) < 0.005 ? M.coachImpactSame : M.coachImpact(`${vs > 0 ? "+" : "−"}${Math.abs(vs).toFixed(2)}`)}
        </li>
      ) : null}
    </ul>
  );
}

/** One coach on the shortlist: identity, the three attributes and their effects, the wage, Hire. */
export function CoachHireCard({
  save,
  coach,
  C,
  statLabels,
  disabled,
  onHire,
}: {
  save: CareerSave;
  coach: CoachState;
  C: CareerCopy;
  statLabels: Record<string, string>;
  disabled: boolean;
  onHire: () => void;
}) {
  const M = C.market;
  return (
    <div className="flex flex-col rounded-xl border border-line-strong bg-gradient-to-b from-white/[0.04] to-transparent p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="display truncate text-base font-bold text-ink">{coach.name}</div>
          <div className="mt-1">
            {coach.source === "real" ? <Badge tone="gold">{M.coachRealTag}</Badge> : <Badge tone="neutral">{M.coachGenTag}</Badge>}
          </div>
        </div>
        <div className="shrink-0 text-right leading-none">
          <div className="display text-2xl font-bold text-ink">{Math.round(coach.overall)}</div>
          <div className="kicker text-[9px] text-faint">{C.common.ovr}</div>
        </div>
      </div>
      <div className="mt-2">
        <CoachAttributeLines save={save} coach={coach} C={C} statLabels={statLabels} showImpact />
      </div>
      <p className="mt-2 text-xs font-semibold text-sub">{wageLabel(C, coach.salaryPerSplit)}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onHire}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-orange-bright to-orange px-4 text-sm font-semibold text-[#1a0d02] transition hover:brightness-110 disabled:opacity-40"
      >
        {M.hireCoach}
      </button>
    </div>
  );
}
