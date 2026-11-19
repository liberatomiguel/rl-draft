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
import { coachTrainingProfileOf, coachImpactFor, type CoachImpact } from "@/store/careerTraining";
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

/** One attribute: its label and value on a line, a ten-step meter, what it does. */
function Meter({ label, value, fill, hint }: { label: string; value: string; fill: number; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="kicker">{label}</span>
        <span className="display text-base font-bold leading-none text-ink">{value}</span>
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx("h-1 flex-1 rounded-sm", i < Math.round(fill * 10) ? "bg-blue-bright/70" : "bg-white/8")} />
        ))}
      </div>
      <p className="mt-1 text-xs text-sub">{hint}</p>
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
  // His stat boost, rating effect and best card: one quiet line, not a row of pills.
  const extras = [
    `${statLabels[coach.bonusType] ?? coach.bonusType} ${coach.bonusLevel}`,
    fx.ratingMod > 0 ? C.market.coachRating(fx.ratingMod) : null,
    coach.bestCard ? C.market.coachBestCard(coach.bestCard) : null,
  ].filter(Boolean).join(" · ");
  // The coach in post: three columns of one strip (label, value, what it does).
  if (compact) return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-3 border-t border-line pt-3 sm:grid-cols-3" aria-label={C.market.coachEffects}>
      <div>
        <p className="kicker">{K.quality}</p>
        <p className="display mt-1 text-lg font-bold leading-none text-ink">{impact.quality}</p>
        <p className="mt-1 text-xs text-sub">{K.qualityEffect(impact.efficiencyPct)}</p>
      </div>
      <div>
        <p className="kicker">{K.experience}</p>
        <p className="display mt-1 text-lg font-bold leading-none text-ink">{K.experienceEffect(impact.experience)}</p>
        <p className="mt-1 text-xs text-sub">{K.experienceHint(impact.planQualityPct, impact.wearCutPct)}</p>
      </div>
      <div>
        <p className="kicker">{K.specialty}</p>
        <p className="display mt-1 flex items-center gap-1.5 text-lg font-bold leading-none text-ink">
          <ObjectiveIcon objective={impact.specialty} className={cx("h-4 w-4 shrink-0", spec.text)} />
          {Y.objectives[impact.specialty]}
        </p>
        <p className="mt-1 text-xs text-sub">{K.specialtyEffect(specialtyPct)}</p>
      </div>
      <p className="text-xs text-sub sm:col-span-3">{extras}</p>
    </div>
  );
  return (
    <div className="space-y-4" aria-label={C.market.coachEffects}>
      {/* The number that decides: the expected gain per starter, against today's setup. */}
      {showImpact ? (
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p className="display text-2xl font-bold leading-none text-ink">{Y.expectedGain(impact.perStarter.toFixed(2))}</p>
            <p className="mt-1 text-xs text-sub">{K.expected}</p>
          </div>
          <p className={cx("shrink-0 text-xs", vs > 0.005 ? "text-good" : vs < -0.005 ? "text-bad" : "text-sub")}>
            {Math.abs(vs) < 0.005 ? K.same : K.vsNow(`${vs > 0 ? "+" : "−"}${Math.abs(vs).toFixed(2)}`)}
          </p>
        </div>
      ) : null}
      <Meter
        label={K.quality}
        value={String(impact.quality)}
        fill={qualityMeter(impact)}
        hint={K.qualityEffect(impact.efficiencyPct)}
      />
      <Meter
        label={K.experience}
        value={K.experienceEffect(impact.experience)}
        fill={experienceMeter(impact)}
        hint={K.experienceHint(impact.planQualityPct, impact.wearCutPct)}
      />
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="kicker">{K.specialty}</span>
          <span className="display flex items-center gap-1.5 text-base font-bold leading-none text-ink">
            <ObjectiveIcon objective={impact.specialty} className={cx("h-4 w-4 shrink-0", spec.text)} />
            {Y.objectives[impact.specialty]}
          </span>
        </div>
        <p className="mt-1 text-xs text-sub">{K.specialtyEffect(specialtyPct)}</p>
      </div>
      <p className="text-xs text-sub">{extras}</p>
    </div>
  );
}

/** How a coach develops: his quality against his ceiling, then the two rules every contract follows. */
export function CoachDevelopment({
  coach,
  C,
  notesOnly = false,
}: {
  coach: CoachState;
  C: CareerCopy;
  /** Only the two rules (the host already prints the quality line). */
  notesOnly?: boolean;
}) {
  const profile = coachTrainingProfileOf(coach)!;
  return (
    <div className="space-y-1">
      {notesOnly ? null : (
        <p className="text-sm font-semibold text-ink">{C.launch.coachGrowth(Math.round(profile.quality), profile.ceiling)}</p>
      )}
      <p className="text-xs leading-relaxed text-sub">{C.launch.coachEvolution}</p>
      <p className="text-xs leading-relaxed text-sub">{C.launch.coachRetainer}</p>
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
    <div className={cx("relative flex flex-col rounded-xl border p-3", lockedNote ? "border-line bg-black/25" : "border-line bg-white/[0.02]")} data-coach-locked={Boolean(lockedNote)}>
      {lockedNote ? <div className="mb-3 flex items-center gap-2 rounded-lg border border-orange/25 bg-orange/5 px-2.5 py-2 text-xs font-semibold text-orange-bright"><LockIcon className="h-4 w-4 shrink-0" />{lockedNote}</div> : null}
      <div className={cx("sm:flex sm:flex-1 sm:flex-col", lockedNote ? "flex flex-1 flex-col opacity-40 grayscale" : "contents")}>
      <div className="order-1 flex items-center gap-3 sm:order-none">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-blue-bright">
          <WhistleIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="display truncate text-sm font-bold text-ink">{coach.name}</div>
          <Badge tone={coach.source === "generated" ? "neutral" : "gold"}>{C.launch.coachTypes[coach.source]}</Badge>
        </div>
        <div className="shrink-0 text-right leading-none">
          <div className="display text-2xl font-bold text-ink">{Math.round(coach.overall)}</div>
          <div className="kicker text-faint">{C.common.ovr}</div>
        </div>
      </div>
      <div className="order-4 mt-3 flex-1 space-y-3 sm:order-none">
        <p className="flex items-center gap-2 text-xs font-semibold text-cyan"><ObjectiveIcon objective={coachTrainingProfileOf(coach)!.specialty} className="h-4 w-4" />{C.training.cycle.objectives[coachTrainingProfileOf(coach)!.specialty]}</p>
        <CoachDevelopment coach={coach} C={C} />
        <details className="rounded-lg border border-line p-2.5"><summary className="cursor-pointer text-xs font-semibold text-blue-bright">{C.launch.coachDetails}</summary><div className="mt-3"><CoachAttributeLines save={save} coach={coach} C={C} statLabels={statLabels} showImpact /></div></details>
      </div>
      <p className="order-2 mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-sub sm:order-none">
        <WalletIcon className="h-4 w-4 text-orange-bright" />
        <span>{K.wage}</span>
        <span className="ml-auto text-sm font-bold text-ink">{wageLabel(C, coach.salaryPerSplit)}</span>
      </p>
      </div>
      <button
        type="button"
        disabled={disabled || Boolean(lockedNote)}
        onClick={onHire}
        className="order-3 mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue/35 bg-blue/[0.06] px-4 text-xs font-semibold text-blue-bright transition-opacity hover:bg-blue/15 disabled:cursor-not-allowed disabled:opacity-40 sm:order-none"
      >
        {lockedNote ? <LockIcon className="h-3.5 w-3.5" /> : null}
        {M.hireCoach}
      </button>
    </div>
  );
}
