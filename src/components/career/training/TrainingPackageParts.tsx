"use client";

/**
 * Road to Worlds — training pieces (rc.35 front T; rc.36 front T2, R83;
 * rc9 TRAIN-MARKET: the screen is built around one decision).
 *
 * A plan is four choices: objective, focus, intensity, scrims. The picker
 * starts EMPTY and tags the recommendation only where the preset or the coach
 * gives one.
 *  - `PackageChips`: a plan at a glance (icon chips, used by the report and HQ);
 *  - `PlanRows`: a running plan as four rows, each with what it does in plain words;
 *  - `PlanPicker`: pick the four, then "Start training" (or "Apply changes"
 *    midway); the promise and the absence risk come from the engine that runs
 *    it (`projectTrainingPackage`), never UI math;
 *  - `PromiseBar`: the running cycle's gain, as a figure with its bar;
 *  - `CycleReportBody`: a finished cycle, player by player;
 *  - `TrainingProposalCard`: rc.34's waiting proposal (kept for HQ's queue;
 *    nothing raises one since rc.35).
 * Mobile first: every control is at least 44 px tall, nothing scrolls sideways at 320 px.
 */

import { useMemo, useState } from "react";
import { CAREER_PLAN } from "@/config/balance";
import { useCareerStore } from "@/store/careerStore";
import type { CareerCopy } from "@/content/careerCopy";
import { weekOfDay } from "@/engine/career/calendar";
import {
  focusAttrsOf,
  OBJECTIVES,
  SCRIM_CHOICES,
  scrimChoiceOf,
  simplePackageOf,
  SQUAD_FOCI,
  WORKLOADS,
  type ScrimChoice,
} from "@/engine/career/training";
import type {
  CareerSave,
  SquadFocus,
  TrainingObjective,
  TrainingPackage,
  TrainingSummary,
  TrainingWorkload,
} from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { cx } from "@/lib/util";
import { projectTrainingPackage, trainingOf, type TrainingBlockView, type TrainingDecision } from "@/store/careerTraining";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { Button } from "@/components/ui/Button";
import {
  BaseDotIcon,
  BoltIcon,
  CheckIcon,
  FlameIcon,
  HandshakeIcon,
  HeartPulseIcon,
  MindIcon,
  ScaleIcon,
  ShieldIcon,
  SwordsIcon,
  TargetIcon,
  TrendUpIcon,
} from "@/components/ui/icons";

export const fmt1 = (n: number): string => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const fmt2 = (n: number): string => n.toFixed(2);

/** The label of a squad focus (rc.36: by its attribute: Balanced, Mechanics, Defense...). */
export function focusLabel(C: CareerCopy, focus: SquadFocus): string {
  return C.training.cycle.focuses[focus] ?? C.training.drills[focus] ?? focus;
}

/** What a squad player trains this cycle (his tweak, else the squad focus, else the base): the player sheet's line. */
export function playerFocusLabel(save: CareerSave, playerId: string, C: CareerCopy, statLabels: Record<string, string>): string {
  const pkg = trainingOf(save).plan?.package ?? null;
  if (!pkg) return C.training.plan.base;
  const tweak = pkg.tweaks?.[playerId];
  if (tweak?.rest) return C.training.plan.rest;
  if (tweak?.focus) return statLabels[tweak.focus] ?? tweak.focus;
  return focusLabel(C, pkg.focus);
}

// ---------------------------------------------------------------------------
// Icons and tones per choice
// ---------------------------------------------------------------------------

type Tone = { text: string; ring: string; bg: string };

export const OBJECTIVE_TONE: Record<TrainingObjective, Tone> = {
  development: { text: "text-good", ring: "border-good/60", bg: "bg-good/10" },
  preparation: { text: "text-blue-bright", ring: "border-blue/60", bg: "bg-blue/10" },
  recovery: { text: "text-orange-bright", ring: "border-orange/60", bg: "bg-orange/10" },
};

export function RecommendedTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("display pointer-events-none inline-flex items-center rounded-sm bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium uppercase leading-none tracking-[0.05em] text-amber-300", className)}>{children}</span>;
}

export function ObjectiveIcon({ objective, className }: { objective: TrainingObjective | null; className?: string }) {
  if (objective === "development") return <TrendUpIcon className={className} />;
  if (objective === "preparation") return <HandshakeIcon className={className} />;
  if (objective === "recovery") return <HeartPulseIcon className={className} />;
  return <BaseDotIcon className={className} />;
}

/** rc.36: one icon per squad focus (the attribute it sharpens). */
export function FocusIcon({ focus, className }: { focus: SquadFocus; className?: string }) {
  if (focus === "mechanics-lab") return <BoltIcon className={className} />;
  if (focus === "rotations") return <ShieldIcon className={className} />;
  if (focus === "set-plays") return <TargetIcon className={className} />;
  if (focus === "film-room") return <MindIcon className={className} />;
  if (focus === "clutch-sets") return <FlameIcon className={className} />;
  return <ScaleIcon className={className} />;
}

/** A gauge with 1-3 filled bars for the intensity. */
function IntensityBars({ workload, className }: { workload: TrainingWorkload; className?: string }) {
  const n = workload === "light" ? 1 : workload === "normal" ? 2 : 3;
  return (
    <span className={cx("inline-flex items-end gap-0.5", className)} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cx("w-1 rounded-sm", i <= n ? "bg-current" : "bg-white/15")} style={{ height: `${4 + i * 3}px` }} />
      ))}
    </span>
  );
}

/** A plan at a glance: objective, focus, intensity, scrims (icon chips, wraps on a phone). */
export function PackageChips({ pkg, C, className }: { pkg: TrainingPackage | null; C: CareerCopy; className?: string }) {
  const Y = C.training.cycle;
  if (!pkg) {
    return (
      <div className={cx("flex flex-wrap gap-1.5", className)}>
        <Chip icon={<BaseDotIcon className="h-3.5 w-3.5" />} label={Y.by.base} />
      </div>
    );
  }
  const tone = OBJECTIVE_TONE[pkg.objective];
  const scrims = scrimChoiceOf(pkg);
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      <Chip icon={<ObjectiveIcon objective={pkg.objective} className="h-3.5 w-3.5" />} label={Y.objectives[pkg.objective]} tone={tone.text} />
      <Chip icon={<FocusIcon focus={pkg.focus} className="h-3.5 w-3.5" />} label={focusLabel(C, pkg.focus)} tone="text-blue-bright" />
      <Chip icon={<IntensityBars workload={pkg.workload} />} label={Y.intensities[pkg.workload]} tone={pkg.workload === "heavy" ? "text-orange-bright" : undefined} />
      <Chip
        icon={<SwordsIcon className="h-3.5 w-3.5" />}
        label={`${Y.steps.scrims} · ${Y.scrimChoices[scrims]}`}
        tone={scrims === "hard" ? "text-orange-bright" : undefined}
      />
    </div>
  );
}

function Chip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: string }) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center gap-1.5 rounded-sm border border-line bg-white/[0.04] px-2.5 text-[11px] font-semibold",
        tone ?? "text-sub",
      )}
    >
      {icon}
      <span className="text-ink">{label}</span>
    </span>
  );
}

/** The focus's effect line: the attributes it sharpens a week (Balanced: overall only). */
export function focusEffectOf(C: CareerCopy, focus: SquadFocus, statLabels: Record<string, string>): string {
  const Y = C.training.cycle;
  if (focus === "balanced") return Y.focusBalanced;
  return Y.focusEffect(focusAttrsOf(focus).map((a: StatKey) => statLabels[a] ?? a).join(" + "), fmt2(CAREER_PLAN.focusOffsetPerWeek));
}

/** The scrim line: what the level does, and how many a week (none: nothing to count). */
function scrimEffectOf(C: CareerCopy, scrims: ScrimChoice): string {
  const Y = C.training.cycle;
  return scrims === "off" ? Y.scrimEffect.off : `${Y.scrimEffect[scrims]} · ${Y.scrimsAWeek(CAREER_PLAN.scrimsPerWeekOnLevel)}`;
}

/**
 * A running plan as four rows (rc9): the choice in ink, what it does in plain
 * words under it, the label in the faint step. Nothing here is a control.
 */
export function PlanRows({ pkg, C, statLabels }: { pkg: TrainingPackage | null; C: CareerCopy; statLabels: Record<string, string> }) {
  const Y = C.training.cycle;
  const scrims = pkg ? scrimChoiceOf(pkg) : null;
  const rows: [string, string, string | null][] = pkg
    ? [
        [Y.steps.objective, Y.objectives[pkg.objective], Y.objectiveEffect[pkg.objective]],
        [Y.steps.focus, focusLabel(C, pkg.focus), focusEffectOf(C, pkg.focus, statLabels)],
        [Y.steps.intensity, Y.intensities[pkg.workload], Y.intensityEffect[pkg.workload]],
        [Y.steps.scrims, scrims ? Y.scrimChoices[scrims] : "", scrims ? scrimEffectOf(C, scrims) : null],
      ]
    : [[Y.steps.objective, Y.by.base, Y.idleLine]];
  return (
    <dl className="border-t border-line">
      {rows.map(([label, value, effect]) => (
        <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-b border-line py-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <dt className="kicker pt-0.5">{label}</dt>
          <dd className="min-w-0">
            <span className="display block text-[15px] font-semibold leading-snug text-ink">{value}</span>
            {effect ? <span className="mt-0.5 block text-[13px] leading-snug text-sub">{effect}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A quick look at this week's already-recorded scrims; no separate simulation. */
export function WeeklyScrimRecap({ save, C, compact = false }: { save: CareerSave; C: CareerCopy; compact?: boolean }) {
  const playing = useCareerStore((s) => s.scrimPlayback?.id);
  const entries = save.scrimLog.filter((entry) => entry.id !== playing && entry.seasonIndex === save.clock.seasonIndex && weekOfDay(entry.day) === weekOfDay(save.clock.day));
  if (compact && entries.length === 0) return null;
  const won = entries.filter((entry) => entry.won).length;
  return (
    <section className={compact ? "border-t border-line pt-2.5" : ""}>
      <div className={compact ? "flex items-center justify-between gap-2" : "card-head"}>
        <h3 className="card-title">{C.training.weekScrims}</h3>
        {entries.length ? <span className="tabular-nums text-xs text-sub">{C.training.cycle.record(won, entries.length - won)}</span> : null}
      </div>
      {entries.length === 0 ? <p className="text-[13px] text-faint">{C.scrim.noResults}</p> : (
        <ul className="border-t border-line">
          {entries.slice(0, compact ? 2 : 3).map((entry) => (
            <li key={entry.id} className="flex min-h-11 items-center gap-3 border-b border-line py-2 text-[13px] last:border-b-0 last:pb-0">
              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", entry.won ? "bg-good" : "bg-bad")} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sub">{entry.won ? C.scrim.won(entry.oppName, entry.scoreA, entry.scoreB) : C.scrim.lost(entry.oppName, entry.scoreA, entry.scoreB)}</span>
              {!compact ? <span className="shrink-0 text-xs text-faint">{formatDateTiny(C.dates, dateOfDay(entry.seasonIndex, entry.day))}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A quiet days-left counter; the gain figure carries the meaningful progress. */
export function CycleRing({ label, className }: { progress: number; daysLeft: number; label: string; className?: string }) {
  return <span className={cx("shrink-0 whitespace-nowrap text-xs tabular-nums text-faint", className)}>{label}</span>;
}

const COMPLETION_FILL = "bg-amber-300/65";

/** The running cycle's gain as a figure. Only gain already paid fills the track; projected gain never masquerades as progress. */
export function PromiseBar({ promise, C, className }: { promise: NonNullable<TrainingBlockView["promise"]>; C: CareerCopy; className?: string }) {
  const Y = C.training.cycle;
  const total = Math.max(Number.EPSILON, promise.total);
  const paidShare = Math.max(0, Math.min(1, promise.paid / total));
  const atEnd = Math.max(0, promise.held + promise.restHeld);
  const completionStart = Math.max(0, Math.min(1, 1 - atEnd / total));
  return (
    <div className={className}>
      <p className="kicker">{Y.promiseTitle}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="display text-3xl font-bold leading-none tabular-nums text-ink">+{fmt2(promise.paid)}</span>
        <span className="text-[13px] tabular-nums text-sub">{Y.gainOf(fmt2(promise.total))}</span>
      </p>
      <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label={Y.promiseTitle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paidShare * 100)}>
        <span className="absolute inset-0 origin-left rounded-full bg-blue-bright/70 transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: "scaleX(" + paidShare + ")" }} />
        {atEnd > 0.004 ? <span className="absolute inset-y-0 w-px bg-white/30" style={{ left: completionStart * 100 + "%" }} aria-hidden /> : null}
      </div>
      {atEnd > 0.004 ? <p className="mt-2 text-xs text-faint">{Y.onCompletion(fmt2(atEnd))}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/**
 * One option of a step: its name, and the recommendation's mark when the preset
 * or the coach gives one. The chosen option is the orange hairline (state is a
 * coloured hairline); what it does is printed once under the step.
 */
function Choice({
  selected,
  recommended,
  onClick,
  title,
  C,
}: {
  selected: boolean;
  recommended: boolean;
  onClick: () => void;
  title: string;
  C: CareerCopy;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors",
        selected ? "border-orange bg-orange/[0.06]" : "border-line hover:border-line-strong",
      )}
    >
      <span className="display block max-w-full break-words text-sm font-semibold leading-tight text-ink">{title}</span>
      {recommended ? <RecommendedTag>{C.training.cycle.recommended}</RecommendedTag> : null}
    </button>
  );
}

/** One decision of the plan: its label, the options, and what the chosen one does. */
function Decision({
  label,
  done,
  cols,
  effect,
  children,
}: {
  label: string;
  done: boolean;
  cols: string;
  /** What the chosen option does (else the step's hint). */
  effect: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-4">
      <p className="mb-3 flex items-center justify-between gap-2">
        <span className="kicker">{label}</span>
        {done ? <CheckIcon className="h-4 w-4 text-good" /> : null}
      </p>
      <div className={cx("grid gap-2", cols)} role="radiogroup" aria-label={label}>
        {children}
      </div>
      <p className="mt-2.5 min-h-5 text-[13px] leading-snug text-sub">{effect}</p>
    </section>
  );
}

interface Picks {
  objective: TrainingObjective | null;
  focus: SquadFocus | null;
  workload: TrainingWorkload | null;
  scrims: ScrimChoice | null;
}

const EMPTY: Picks = { objective: null, focus: null, workload: null, scrims: null };

function picksOf(pkg: TrainingPackage | null): Picks {
  return pkg ? { objective: pkg.objective, focus: pkg.focus, workload: pkg.workload, scrims: scrimChoiceOf(pkg) } : EMPTY;
}

/**
 * Pick the cycle's plan (objective, focus, intensity, scrims). `initial`
 * null = empty (a new cycle); a plan = an adjustment midway. The CTA reads the
 * engine's projection: the promise to the cycle's end and the absence risk.
 */
export function PlanPicker({
  save,
  C,
  statLabels,
  initial,
  recommended,
  lastPlan,
  soFar = 0,
  onSubmit,
  onCancel,
}: {
  save: CareerSave;
  C: CareerCopy;
  statLabels: Record<string, string>;
  initial: TrainingPackage | null;
  recommended: TrainingPackage | null;
  lastPlan: TrainingPackage | null;
  /** The running cycle's starters' average so far (an adjustment's promise adds it). */
  soFar?: number;
  onSubmit: (pkg: TrainingPackage) => void;
  onCancel?: () => void;
}) {
  const Y = C.training.cycle;
  const D = C.dates;
  const adjusting = initial !== null;
  const [picks, setPicks] = useState<Picks>(() => picksOf(initial));
  const rec = useMemo(() => picksOf(recommended), [recommended]);
  const set = (p: Partial<Picks>) => setPicks((cur) => ({ ...cur, ...p }));
  const complete = picks.objective !== null && picks.focus !== null && picks.workload !== null && picks.scrims !== null;
  const pkg = useMemo(
    () =>
      complete
        ? simplePackageOf({ objective: picks.objective!, workload: picks.workload!, scrims: picks.scrims!, focus: picks.focus! })
        : null,
    [complete, picks],
  );
  const proj = useMemo(() => (pkg ? projectTrainingPackage(save, pkg) : null), [save, pkg]);
  const endDate = proj ? formatDateTiny(D, dateOfDay(save.clock.seasonIndex, proj.endDay)) : "";
  const days = proj ? proj.endDay - proj.fromDay + 1 : 0;
  const recommendedPicks = recommended !== null;
  const showSame = lastPlan !== null;

  return (
    <div className="space-y-4">
      {!adjusting && (recommendedPicks || showSame) ? (
        <div className="flex flex-wrap gap-2">
          {recommendedPicks ? (
            <Button variant="secondary" size="md" className="min-h-11" onClick={() => setPicks(rec)}>
              {Y.useRecommended}
            </Button>
          ) : null}
          {showSame ? (
            <Button variant="ghost" size="md" className="min-h-11" onClick={() => lastPlan && onSubmit(lastPlan)}>
              {Y.restart}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Decision
        label={Y.steps.objective}
        done={picks.objective !== null}
        cols="grid-cols-3"
        effect={picks.objective ? Y.objectiveEffect[picks.objective] : Y.objectiveHint}
      >
        {OBJECTIVES.map((o) => (
          <Choice key={o} C={C} selected={picks.objective === o} recommended={rec.objective === o} onClick={() => set({ objective: o })} title={Y.objectives[o]} />
        ))}
      </Decision>
      <Decision
        label={Y.steps.focus}
        done={picks.focus !== null}
        cols="grid-cols-2 min-[420px]:grid-cols-3 lg:grid-cols-6"
        effect={picks.focus ? focusEffectOf(C, picks.focus, statLabels) : Y.focusHint}
      >
        {SQUAD_FOCI.map((f) => (
          <Choice key={f} C={C} selected={picks.focus === f} recommended={rec.focus === f} onClick={() => set({ focus: f })} title={focusLabel(C, f)} />
        ))}
      </Decision>
      <Decision
        label={Y.steps.intensity}
        done={picks.workload !== null}
        cols="grid-cols-3"
        effect={picks.workload ? Y.intensityEffect[picks.workload] : Y.intensityHint}
      >
        {WORKLOADS.map((w) => (
          <Choice key={w} C={C} selected={picks.workload === w} recommended={rec.workload === w} onClick={() => set({ workload: w })} title={Y.intensities[w]} />
        ))}
      </Decision>
      <Decision
        label={Y.steps.scrims}
        done={picks.scrims !== null}
        cols="grid-cols-2 min-[420px]:grid-cols-4"
        effect={picks.scrims ? scrimEffectOf(C, picks.scrims) : Y.scrimsHint}
      >
        {SCRIM_CHOICES.map((s) => (
          <Choice key={s} C={C} selected={picks.scrims === s} recommended={rec.scrims === s} onClick={() => set({ scrims: s })} title={Y.scrimChoices[s]} />
        ))}
      </Decision>

      {/* The CTA: what this cycle promises, what it risks, then Start.
          Phone: it rides the bottom edge while the plan is on screen and rests
          at the plan's end (`.plan-dock`, sticky). */}
      <div className="plan-dock border-t border-line pt-4">
        {proj ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="display text-3xl font-bold leading-none tabular-nums text-ink">
              +{fmt2(soFar + proj.startersAvg)} <span className="text-[13px] font-medium text-sub">{Y.promisedUnit}</span>
            </p>
            <p className="text-[13px] text-sub">{Y.runsTo(endDate, days)}</p>
          </div>
        ) : (
          <p className="text-sm text-sub">{Y.pickAll}</p>
        )}
        {proj ? (
          <p className={cx("mt-1.5 text-[13px]", proj.unavailabilityPts > 0 ? "text-orange-bright" : "text-faint")}>
            {proj.unavailabilityPts > 0 ? Y.riskLine(proj.unavailabilityPts.toFixed(1)) : Y.noRisk}
          </p>
        ) : null}
        {proj && proj.fromDay > save.clock.day && !adjusting ? <p className="mt-1 text-[13px] text-faint">{Y.fromTomorrow}</p> : null}
        {adjusting ? <p className="mt-1 text-[13px] text-faint">{Y.adjustHint}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={!pkg}
            onClick={() => (pkg ? onSubmit(pkg) : undefined)}
          >
            {adjusting ? Y.applyChanges : Y.start}
          </Button>
          {onCancel ? (
            <Button variant="ghost" size="md" className="min-h-11" onClick={onCancel}>
              {Y.cancel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** The squad average of a filed cycle. */
export function reportAvgOf(summary: TrainingSummary): number {
  const gains = summary.players.map((p) => p.after - p.before);
  return gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / gains.length : 0;
}

/** The squad average that landed on completion (rc.36). */
export function reportCompletionOf(summary: TrainingSummary): number {
  const n = summary.players.length;
  return n > 0 ? summary.players.reduce((s, p) => s + (p.completion ?? 0), 0) / n : 0;
}

/** A finished cycle, player by player: the results modal. One list of rows, no box per player. */
export function CycleReportBody({
  summary,
  C,
  statLabels,
  stats = true,
}: {
  summary: TrainingSummary;
  C: CareerCopy;
  statLabels: Record<string, string>;
  /** The average / top gain / completion row (the results modal's hero carries them instead). */
  stats?: boolean;
}) {
  const Y = C.training.cycle;
  const R = Y.report;
  const avg = reportAvgOf(summary);
  const completion = reportCompletionOf(summary);
  const best = [...summary.players].sort((a, b) => b.after - b.before - (a.after - a.before))[0];
  const max = Math.max(0.05, ...summary.players.map((p) => Math.abs(p.after - p.before)));
  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid grid-cols-3 gap-4">
          <Stat label={R.avg} value={fmt1(avg)} tone={avg >= 0 ? "text-good" : "text-bad"} />
          <Stat label={R.best} value={best ? fmt1(best.after - best.before) : "-"} sub={best?.name} tone="text-good" />
          <Stat label={Y.legend.completion} value={completion > 0.004 ? `+${fmt2(completion)}` : "-"} tone="text-ink" />
        </div>
      ) : null}
      <div>
        <p className="kicker mb-1">{R.players}</p>
        <ul className="border-t border-line">
          {summary.players.map((p) => {
            const gain = p.after - p.before;
            const end = Math.max(0, Math.min(p.completion ?? 0, Math.max(0, gain)));
            const along = Math.max(0, gain) - end;
            const attrs = (Object.entries(p.attrs) as [StatKey, number][]).filter(([, v]) => v >= 0.05);
            return (
              <li key={p.id} className="border-b border-line py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="display truncate text-[15px] font-semibold text-ink">{p.name}</span>
                    {p.joined ? <span className="shrink-0 text-xs text-faint">{R.joined}</span> : null}
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-faint">
                    {p.before.toFixed(1)} <span aria-hidden>to</span> <span className="font-semibold text-ink">{p.after.toFixed(1)}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    {gain >= 0 ? (
                      <>
                        <span className="h-full bg-good/60" style={{ width: `${Math.round((along / max) * 100)}%` }} />
                        <span className={cx("h-full", COMPLETION_FILL)} style={{ width: `${Math.round((end / max) * 100)}%` }} />
                      </>
                    ) : (
                      <span className="h-full bg-bad" style={{ width: `${Math.round((Math.abs(gain) / max) * 100)}%` }} />
                    )}
                  </span>
                  <span className={cx("w-12 shrink-0 text-right text-sm font-semibold tabular-nums", gain >= 0 ? "text-good" : "text-bad")}>{fmt1(gain)}</span>
                </div>
                {attrs.length > 0 || end > 0.004 ? (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-faint">
                    {end > 0.004 ? <span>{R.completionShort(fmt2(end))}</span> : null}
                    {attrs.map(([k, v]) => (
                      <span key={k}>
                        {statLabels[k] ?? k} +{fmt2(v)}
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[13px] text-sub">
        {Y.chemistry} <span className="tabular-nums text-ink">{summary.chemStart}% to {summary.chemEnd}%</span>
        {(Object.entries(summary.scrims) as [string, [number, number]][]).map(([lvl, [w, l]]) => (
          <span key={lvl}>
            {" · "}
            {Y.scrims} {Y.scrimChoices[lvl] ?? lvl} <span className="tabular-nums text-ink">{Y.record(w, l)}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="min-w-0">
      <span className={cx("display block text-2xl font-bold leading-none tabular-nums", tone)}>{value}</span>
      <span className="kicker mt-1 block">{label}</span>
      {sub ? <span className="block max-w-full truncate text-[13px] text-sub">{sub}</span> : null}
    </div>
  );
}

/**
 * rc.34's coach proposal waiting for approval (HQ-CONTRACT H1). rc.35 never
 * raises one (a hired coach runs his plan; nothing holds the clock): kept
 * for an older save's queue until it loads through the repair.
 */
export function TrainingProposalCard({
  save,
  decision,
  C,
  onApprove,
  onAdjust,
  onKeepBase,
}: {
  save: CareerSave;
  decision: TrainingDecision;
  C: CareerCopy;
  onApprove: () => void;
  onAdjust: () => void;
  onKeepBase: () => void;
}) {
  const P = C.training.plan;
  const Y = C.training.cycle;
  const proj = useMemo(() => projectTrainingPackage(save, decision.proposal, { unsupervised: false }), [save, decision]);
  return (
    <div className="rounded-xl border border-orange/40 bg-orange/[0.06] p-3">
      <p className="kicker text-orange-bright">{Y.cycleOf(decision.periodIndex + 1, decision.periodCount)}</p>
      <p className="display mt-0.5 text-base font-bold text-ink">{P.proposalTitle(decision.coachName)}</p>
      <PackageChips pkg={decision.proposal} C={C} className="mt-2" />
      <p className="mt-2 text-sm font-semibold text-good">{Y.expectedGain(fmt2(proj.startersAvg))}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="md" className="min-h-11" onClick={onApprove}>
          {P.approve}
        </Button>
        <Button variant="secondary" size="md" className="min-h-11" onClick={onAdjust}>
          {Y.adjust}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={onKeepBase}>
          {Y.useBase}
        </Button>
      </div>
    </div>
  );
}
