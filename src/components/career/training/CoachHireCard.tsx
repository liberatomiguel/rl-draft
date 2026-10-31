"use client";

/**
 * Road to Worlds — the coach card (rc.35, front T; rc.34 DEV-03 T4).
 *
 * Miguel: "the hire options are text-heavy and confusing". The card is now
 * icon-led with a clear order: who he is (name, ex-pro / staff, overall) →
 * the expected effect (per starter over the next cycle, vs now — the number
 * that decides) → three meters (quality → how much of a plan lands,
 * experience → his own plan's quality and less wear, specialty → +25 % on
 * its objective) → the wage → Hire. Every number comes from the functions
 * that run it (`careerTraining.coachImpactFor`); the meters read the engine's
 * own ranges (CAREER_PLAN.coach), never a UI scale.
 */

import { useMemo } from "react";
import { CAREER_PLAN } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, CoachState } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { coachImpactFor, type CoachImpact } from "@/store/careerTraining";
import { wageLabel } from "@/components/career/careerUi";
import { OBJECTIVE_TONE, ObjectiveIcon } from "@/components/career/training/TrainingPackageParts";
import { Badge } from "@/components/ui/Badge";
import { HourglassIcon, LockIcon, StarIcon, TrendUpIcon, WalletIcon, WhistleIcon } from "@/components/ui/icons";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Quality → the share of a plan that lands, on the engine's efficiency range. */
function qualityMeter(impact: CoachImpact): number {
  const [lo, hi] = CAREER_PLAN.coach.efficiencyRange;
  return clamp01((impact.efficiencyPct / 100 - lo) / (hi - lo));
}

/** Experience → his own plan's quality, from the base to 100 %. */
function experienceMeter(impact: CoachImpact): number {
  const base = CAREER_PLAN.coach.planQualityBase;
  return clamp01((impact.planQualityPct / 100 - base) / (1 - base));
}

function Meter({
  icon,
  label,
  value,
  fill,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  fill: number;
  hint: string;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className={tone}>{icon}</span>
          {label}
        </span>
        <span className="font-mono font-bold text-ink">{value}</span>
      </div>
      <div className="mt-1 flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx("h-1 flex-1 rounded-sm", i < Math.round(fill * 10) ? "bg-blue/55" : "bg-white/8")} />
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-faint">{hint}</p>
    </div>
  );
}

/** The three attributes as meters (the market's shortlist and the coach in post). */
export function CoachAttributeLines({
  save,
  coach,
  C,
  statLabels,
  showImpact,
  compact = false,
}: {
  save: CareerSave;
  coach: CoachState;
  C: CareerCopy;
  statLabels: Record<string, string>;
  /** The expected impact vs the current setup (the shortlist; not the coach in post). */
  showImpact: boolean;
  compact?: boolean;
}) {
  const K = C.training.cycle.coach;
  const Y = C.training.cycle;
  const impact = useMemo(() => coachImpactFor(save, coach), [save, coach]);
  const fx = coachEffectsFor(coach);
  const specialtyPct = Math.round(CAREER_PLAN.coach.specialtyBoost * 100);
  const spec = OBJECTIVE_TONE[impact.specialty];
  const vs = impact.vsCurrent;
  if (compact) return (
    <div className="grid grid-cols-1 gap-2 border-t border-line pt-2.5 sm:grid-cols-3" aria-label={C.market.coachEffects}>
      <div><p className="text-[9px] uppercase tracking-[0.1em] text-faint">{K.quality}</p><p className="mt-0.5 text-xs font-semibold text-ink"><StarIcon className="mr-1 inline h-3 w-3 text-amber-300" filled />{impact.quality}<span className="ml-2 text-[10px] font-normal text-sub">{K.qualityEffect(impact.efficiencyPct)}</span></p></div>
      <div><p className="text-[9px] uppercase tracking-[0.1em] text-faint">{K.experience}</p><p className="mt-0.5 text-xs font-semibold text-ink"><HourglassIcon className="mr-1 inline h-3 w-3 text-blue-bright" />{K.experienceEffect(impact.experience)}</p><p className="mt-0.5 text-[10px] text-faint">{K.experienceHint(impact.planQualityPct, impact.wearCutPct)}</p></div>
      <div><p className="text-[9px] uppercase tracking-[0.1em] text-faint">{K.specialty}</p><p className={cx("mt-0.5 flex items-center gap-1 text-xs font-semibold", spec.text)}><ObjectiveIcon objective={impact.specialty} className="h-3 w-3" />{Y.objectives[impact.specialty]}</p><p className="mt-0.5 text-[10px] text-faint">{K.specialtyEffect(specialtyPct)} · {statLabels[coach.bonusType] ?? coach.bonusType} {coach.bonusLevel}</p></div>
      {fx.ratingMod > 0 || coach.bestCard ? <p className="text-[10px] text-faint sm:col-span-3">{fx.ratingMod > 0 ? C.market.coachRating(fx.ratingMod) : ""}{fx.ratingMod > 0 && coach.bestCard ? " · " : ""}{coach.bestCard ? C.market.coachBestCard(coach.bestCard) : ""}</p> : null}
    </div>
  );
  return (
    <div className="space-y-2.5" aria-label={C.market.coachEffects}>
      {showImpact ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-sub">
              <TrendUpIcon className="h-3 w-3 text-good" />
              {K.expected}
            </p>
            <p className={cx("text-[10px] font-semibold", vs > 0.005 ? "text-good" : vs < -0.005 ? "text-bad" : "text-faint")}>
              {Math.abs(vs) < 0.005 ? K.same : K.vsNow(`${vs > 0 ? "+" : "−"}${Math.abs(vs).toFixed(2)}`)}
            </p>
          </div>
          <p className="display shrink-0 text-lg font-bold text-ink">{Y.expectedGain(impact.perStarter.toFixed(2))}</p>
        </div>
      ) : null}
      <Meter
        icon={<StarIcon className="h-3.5 w-3.5" filled />}
        label={K.quality}
        value={String(impact.quality)}
        fill={qualityMeter(impact)}
        hint={K.qualityEffect(impact.efficiencyPct)}
        tone="text-amber-300"
      />
      <Meter
        icon={<HourglassIcon className="h-3.5 w-3.5" />}
        label={K.experience}
        value={K.experienceEffect(impact.experience)}
        fill={experienceMeter(impact)}
        hint={K.experienceHint(impact.planQualityPct, impact.wearCutPct)}
        tone="text-blue-bright"
      />
      <div className="flex items-center gap-2 border-t border-line pt-2">
        <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.03]", spec.text)}>
          <ObjectiveIcon objective={impact.specialty} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.1em] text-faint">{K.specialty}</p>
          <p className={cx("truncate text-xs font-bold", spec.text)}>{Y.objectives[impact.specialty]}</p>
          <p className="text-[10px] text-faint">{K.specialtyEffect(specialtyPct)}</p>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-faint">
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-semibold text-sub">
          {statLabels[coach.bonusType] ?? coach.bonusType} {coach.bonusLevel}
        </span>
        {fx.ratingMod > 0 ? <span className="rounded-full bg-white/5 px-2 py-0.5">{C.market.coachRating(fx.ratingMod)}</span> : null}
        {coach.bestCard ? <span className="rounded-full bg-white/5 px-2 py-0.5">{C.market.coachBestCard(coach.bestCard)}</span> : null}
      </p>
    </div>
  );
}

/** One coach on the shortlist: identity → expected effect → meters → wage → Hire. */
export function CoachHireCard({
  save,
  coach,
  C,
  statLabels,
  disabled,
  lockedNote,
  onHire,
}: {
  save: CareerSave;
  coach: CoachState;
  C: CareerCopy;
  statLabels: Record<string, string>;
  disabled: boolean;
  /** rc.35: the ladder gate this coach waits on (an ex-pro before his rung) — Hire stays off. */
  lockedNote?: string | null;
  onHire: () => void;
}) {
  const M = C.market;
  const K = C.training.cycle.coach;
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue/25 bg-blue/[0.05] text-blue-bright">
          <WhistleIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="display truncate text-sm font-bold text-ink">{coach.name}</div>
          {coach.source === "real" ? <Badge tone="gold">{K.exPro}</Badge> : <Badge tone="neutral">{K.staff}</Badge>}
        </div>
        <div className="shrink-0 text-right leading-none">
          <div className="display text-2xl font-bold text-ink">{Math.round(coach.overall)}</div>
          <div className="kicker text-[9px] text-faint">{C.common.ovr}</div>
        </div>
      </div>
      <div className="mt-3 flex-1">
        <CoachAttributeLines save={save} coach={coach} C={C} statLabels={statLabels} showImpact />
      </div>
      <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-sub">
        <WalletIcon className="h-4 w-4 text-orange-bright" />
        <span>{K.wage}</span>
        <span className="ml-auto text-sm font-bold text-ink">{wageLabel(C, coach.salaryPerSplit)}</span>
      </p>
      {lockedNote ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-faint">
          <LockIcon className="h-3.5 w-3.5 shrink-0" />
          {lockedNote}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || Boolean(lockedNote)}
        onClick={onHire}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-blue/35 bg-blue/[0.06] px-4 text-xs font-semibold text-blue-bright transition hover:bg-blue/15 disabled:opacity-40"
      >
        {M.hireCoach}
      </button>
    </div>
  );
}
