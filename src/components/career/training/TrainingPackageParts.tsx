"use client";

/**
 * Road to Worlds — training pieces (rc.35 front T; rc.36 front T2, R83).
 *
 * Miguel (rc.35 playtest): nothing runs until you pick, the focus comes back
 * as a choice, Evolve / Gel / Recover, no blocks that repeat the plan, a
 * progress bar on the running plan, a prettier report. A plan is four
 * choices — objective, focus, intensity, scrims — each an icon tile with a
 * one-line effect; the picker starts EMPTY and tags the recommendation (the
 * special cards' NEW pill, `NewTag`) only where the preset or the coach gives
 * one.
 *  - `PackageChips`: a plan at a glance (icon chips);
 *  - `PlanPicker`: pick the four, then "Start training" (or "Apply changes"
 *    midway) — the promise and the absence risk from the engine that runs it
 *    (`projectTrainingPackage`), never UI math;
 *  - `PromiseBar`: the running cycle's gain — earned, to come, and the part
 *    that lands on completion (CAREER_PLAN.payout);
 *  - `CycleReportBody` / `PeriodReport`: a finished cycle, player by player;
 *  - `TrainingProposalCard`: rc.34's waiting proposal (kept for HQ's queue;
 *    nothing raises one since rc.35).
 * Mobile first: every control is ≥ 44 px tall, nothing scrolls sideways at 360 px.
 */

import { useMemo, useState } from "react";
import { CAREER_PLAN } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { seasonLabelFor } from "@/engine/career/calendar";
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
  AlertIcon,
  BaseDotIcon,
  BoltIcon,
  CheckIcon,
  FlameIcon,
  GaugeIcon,
  HandshakeIcon,
  HeartPulseIcon,
  MindIcon,
  ScaleIcon,
  ShieldIcon,
  StarIcon,
  SwordsIcon,
  TargetIcon,
  TrendUpIcon,
  TrophyIcon,
} from "@/components/ui/icons";


export const fmt1 = (n: number): string => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const fmt2 = (n: number): string => n.toFixed(2);

/** The label of a squad focus (rc.36: by its attribute — Balanced, Mechanics, Defense…). */
export function focusLabel(C: CareerCopy, focus: SquadFocus): string {
  return C.training.cycle.focuses[focus] ?? C.training.drills[focus] ?? focus;
}

/** What a squad player trains this cycle (his tweak, else the squad focus, else the base) — the player sheet's line. */
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

const QUIET_TONE: Tone = { text: "text-ink", ring: "border-line", bg: "bg-white/[0.02]" };
export const OBJECTIVE_TONE: Record<TrainingObjective, Tone> = {
  development: QUIET_TONE,
  preparation: QUIET_TONE,
  recovery: QUIET_TONE,
};
const NEUTRAL_TONE = QUIET_TONE;
const HEAVY_TONE = QUIET_TONE;
const FOCUS_TONE = QUIET_TONE;

export function RecommendedTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("display pointer-events-none inline-flex items-center rounded-full border border-amber-300/35 bg-[#241e0d] px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-amber-300", className)}>{children}</span>;
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

/** A gauge with 1–3 filled bars for the intensity. */
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

/** A plan at a glance — objective, focus, intensity, scrims (icon chips, wraps on a phone). */
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
      <Chip icon={<FocusIcon focus={pkg.focus} className="h-3.5 w-3.5" />} label={focusLabel(C, pkg.focus)} tone="text-sub" />
      <Chip icon={<IntensityBars workload={pkg.workload} />} label={Y.intensities[pkg.workload]} tone={pkg.workload === "heavy" ? "text-sub" : undefined} />
      <Chip
        icon={<SwordsIcon className="h-3.5 w-3.5" />}
        label={`${Y.steps.scrims} · ${Y.scrimChoices[scrims]}`}
        tone={scrims === "hard" ? "text-sub" : undefined}
      />
    </div>
  );
}

function Chip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: string }) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-2.5 text-[11px] font-semibold",
        tone ?? "text-sub",
      )}
    >
      {icon}
      <span className="text-ink">{label}</span>
    </span>
  );
}

/** A quiet days-left counter; the gain bar carries the meaningful progress. */
export function CycleRing({ label, className }: { progress: number; daysLeft: number; label: string; className?: string }) {
  return <span className={cx("shrink-0 whitespace-nowrap text-[11px] tabular-nums text-faint", className)}>{label}</span>;
}

const COMPLETION_FILL = "bg-white/30";

/** Only gain already paid fills the track; projected gain never masquerades as progress. */
export function PromiseBar({ promise, C, className }: { promise: NonNullable<TrainingBlockView["promise"]>; C: CareerCopy; className?: string }) {
  const Y = C.training.cycle;
  const total = Math.max(Number.EPSILON, promise.total);
  const paidShare = Math.max(0, Math.min(1, promise.paid / total));
  const atEnd = Math.max(0, promise.held + promise.restHeld);
  const completionStart = Math.max(0, Math.min(1, 1 - atEnd / total));
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[11px] text-sub">{Y.promiseTitle}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink">{Y.promiseLine(fmt2(promise.paid), fmt2(promise.total))}</span>
      </div>
      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label={Y.promiseTitle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paidShare * 100)}>
        <span className="absolute inset-0 origin-left rounded-full bg-blue-bright/70 transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: 'scaleX(' + paidShare + ')' }} />
        {atEnd > 0.004 ? <span className="absolute inset-y-0 w-px bg-white/30" style={{ left: (completionStart * 100) + '%' }} aria-hidden /> : null}
      </div>
      {atEnd > 0.004 ? <p className="mt-1.5 text-[10px] text-faint">{Y.onCompletion(fmt2(atEnd))}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

function OptionTile({
  selected,
  recommended,
  onClick,
  icon,
  title,
  effect,
  tone,
  C,
}: {
  selected: boolean;
  recommended: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  effect: string;
  tone: Tone;
  C: CareerCopy;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "relative flex min-h-[4.5rem] w-full min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected ? "border-blue/40 bg-white/[0.05]" : "border-line bg-white/[0.03] hover:border-line-strong",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          selected ? "border-line-strong bg-white/[0.03] text-ink" : "border-line text-faint",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("display block truncate text-xs font-bold uppercase tracking-[0.08em]", selected ? tone.text : "text-ink")}>{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-faint">{effect}</span>
      </span>
      {recommended ? <RecommendedTag className="absolute -top-1.5 right-2">{C.training.cycle.recommended}</RecommendedTag> : null}
    </button>
  );
}

/**
 * rc.36: a compact choice (icon over its label) for the six foci and the four
 * scrim levels — a phone fits them three / two to a row without truncating;
 * the step prints the selected one's effect under the grid.
 */
function CompactTile({
  selected,
  recommended,
  onClick,
  icon,
  title,
  tone,
  C,
}: {
  selected: boolean;
  recommended: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  tone: Tone;
  C: CareerCopy;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "relative flex min-h-[4.25rem] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 pb-2 pt-3 text-center transition-colors",
        selected ? "border-blue/40 bg-white/[0.05]" : "border-line bg-white/[0.03] hover:border-line-strong",
      )}
    >
      <span className={cx("flex h-6 w-6 items-center justify-center", selected ? tone.text : "text-faint")}>{icon}</span>
      <span className={cx("display block max-w-full break-words text-[11px] font-bold leading-tight", selected ? tone.text : "text-ink")}>{title}</span>
      {recommended ? (
        <RecommendedTag className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">{C.training.cycle.recommended}</RecommendedTag>
      ) : null}
    </button>
  );
}

/** The selected compact choice's effect (else the step's hint), under its grid. */
function EffectLine({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <p className={cx("mt-2 flex min-h-8 items-start gap-1.5 text-[11px] leading-snug", alert ? "text-orange-bright" : "text-sub")}>
      {alert ? <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" /> : null}
      <span className="min-w-0">{text}</span>
    </p>
  );
}

function Step({
  n,
  icon,
  title,
  done,
  cols,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  done: boolean;
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-2">
        <span
          className={cx(
            "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
            done ? "bg-good/20 text-good" : "bg-blue/20 text-blue-bright",
          )}
        >
          {done ? <CheckIcon className="h-3.5 w-3.5" /> : n}
        </span>
        <span className="text-faint">{icon}</span>
        <span className="kicker text-[10px]">{title}</span>
      </p>
      <div className={cx("grid gap-2 pt-2", cols)} role="radiogroup" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

/** The focus's effect line: the attributes it sharpens a week (Balanced: overall only). */
function focusEffectOf(C: CareerCopy, focus: SquadFocus, statLabels: Record<string, string>): string {
  const Y = C.training.cycle;
  if (focus === "balanced") return Y.focusBalanced;
  return Y.focusEffect(focusAttrsOf(focus).map((a: StatKey) => statLabels[a] ?? a).join(" + "), fmt2(CAREER_PLAN.focusOffsetPerWeek));
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
 * Pick the cycle's plan (objective · focus · intensity · scrims). `initial`
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
              <StarIcon className="mr-1.5 h-4 w-4 text-amber-300" filled />
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

      <Step n={1} icon={<TrendUpIcon className="h-4 w-4" />} title={Y.steps.objective} done={picks.objective !== null} cols="grid-cols-1 sm:grid-cols-3">
        {OBJECTIVES.map((o) => (
          <OptionTile
            key={o}
            C={C}
            selected={picks.objective === o}
            recommended={rec.objective === o}
            onClick={() => set({ objective: o })}
            icon={<ObjectiveIcon objective={o} className="h-5 w-5" />}
            title={Y.objectives[o]}
            effect={Y.objectiveEffect[o]}
            tone={OBJECTIVE_TONE[o]}
          />
        ))}
      </Step>
      <div>
        <Step n={2} icon={<TargetIcon className="h-4 w-4" />} title={Y.steps.focus} done={picks.focus !== null} cols="grid-cols-3 sm:grid-cols-6">
          {SQUAD_FOCI.map((f) => (
            <CompactTile
              key={f}
              C={C}
              selected={picks.focus === f}
              recommended={rec.focus === f}
              onClick={() => set({ focus: f })}
              icon={<FocusIcon focus={f} className="h-5 w-5" />}
              title={focusLabel(C, f)}
              tone={FOCUS_TONE}
            />
          ))}
        </Step>
        <EffectLine text={picks.focus ? `${focusLabel(C, picks.focus)}: ${focusEffectOf(C, picks.focus, statLabels)}` : Y.focusHint} />
      </div>
      <Step n={3} icon={<GaugeIcon className="h-4 w-4" />} title={Y.steps.intensity} done={picks.workload !== null} cols="grid-cols-1 sm:grid-cols-3">
        {WORKLOADS.map((w) => (
          <OptionTile
            key={w}
            C={C}
            selected={picks.workload === w}
            recommended={rec.workload === w}
            onClick={() => set({ workload: w })}
            icon={<IntensityBars workload={w} />}
            title={Y.intensities[w]}
            effect={Y.intensityEffect[w]}
            tone={w === "heavy" ? HEAVY_TONE : NEUTRAL_TONE}
          />
        ))}
      </Step>
      <div>
        <Step n={4} icon={<SwordsIcon className="h-4 w-4" />} title={Y.steps.scrims} done={picks.scrims !== null} cols="grid-cols-2 sm:grid-cols-4">
          {SCRIM_CHOICES.map((s) => (
            <CompactTile
              key={s}
              C={C}
              selected={picks.scrims === s}
              recommended={rec.scrims === s}
              onClick={() => set({ scrims: s })}
              icon={s === "off" ? <BaseDotIcon className="h-5 w-5" /> : <SwordsIcon className="h-5 w-5" />}
              title={Y.scrimChoices[s]}
              tone={s === "hard" ? HEAVY_TONE : NEUTRAL_TONE}
            />
          ))}
        </Step>
        <EffectLine
          text={
            picks.scrims
              ? `${Y.scrimChoices[picks.scrims]}: ${Y.scrimEffect[picks.scrims]}${picks.scrims !== "off" ? ` · ${Y.scrimsAWeek(CAREER_PLAN.scrimsPerWeekOnLevel)}` : ""}`
              : Y.scrimsHint
          }
          alert={picks.scrims === "hard"}
        />
      </div>

      {/* The CTA: what this cycle promises, what it risks, then Start. */}
      <div className={cx("rounded-2xl border p-3", proj ? "border-line-strong bg-white/[0.03]" : "border-line bg-white/[0.02]")}>
        {proj ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="display text-lg font-bold text-ink">{Y.promised(fmt2(soFar + proj.startersAvg))}</p>
            <p className="text-[11px] text-sub">{Y.runsTo(endDate, days)}</p>
          </div>
        ) : (
          <p className="text-xs text-faint">{Y.pickAll}</p>
        )}
        {proj ? (
          <p className={cx("mt-1 flex items-center gap-1.5 text-[11px]", proj.unavailabilityPts > 0 ? "text-orange-bright" : "text-faint")}>
            <AlertIcon className="h-3.5 w-3.5 shrink-0" />
            {proj.unavailabilityPts > 0 ? Y.riskLine(proj.unavailabilityPts.toFixed(1)) : Y.noRisk}
          </p>
        ) : null}
        {proj && proj.fromDay > save.clock.day && !adjusting ? <p className="mt-1 text-[10px] text-faint">{Y.fromTomorrow}</p> : null}
        {adjusting ? <p className="mt-1 text-[10px] text-faint">{Y.adjustHint}</p> : null}
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

/** A finished cycle, player by player — the results modal and the history. */
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
    <div className="space-y-3">
      {stats ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label={R.avg} value={fmt1(avg)} tone={avg >= 0 ? "text-ink" : "text-bad"} />
          <Stat label={R.best} value={best ? fmt1(best.after - best.before) : "—"} sub={best?.name} tone="text-ink" />
          <Stat
            label={Y.legend.completion}
            value={completion > 0.004 ? `+${fmt2(completion)}` : "—"}
            tone="text-sub"
            icon={<TrophyIcon className="h-3.5 w-3.5" />}
          />
        </div>
      ) : null}
      <p className="kicker text-[10px]">{R.players}</p>
      <ul className="space-y-2">
        {summary.players.map((p) => {
          const gain = p.after - p.before;
          const end = Math.max(0, Math.min(p.completion ?? 0, Math.max(0, gain)));
          const along = Math.max(0, gain) - end;
          const attrs = (Object.entries(p.attrs) as [StatKey, number][]).filter(([, v]) => v >= 0.05);
          return (
            <li key={p.id} className="rounded-xl border border-line bg-black/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-ink">{p.name}</span>
                  {p.joined ? <span className="shrink-0 rounded-full bg-blue/15 px-1.5 py-px text-[9px] font-semibold text-blue-bright">{R.joined}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-xs">
                  <span className="text-faint">{p.before.toFixed(1)}</span>
                  <span className="mx-1 text-faint">→</span>
                  <span className="font-bold text-ink">{p.after.toFixed(1)}</span>
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  {gain >= 0 ? (
                    <>
                      <span className="h-full bg-white/35" style={{ width: `${Math.round((along / max) * 100)}%` }} />
                      <span className={cx("h-full", COMPLETION_FILL)} style={{ width: `${Math.round((end / max) * 100)}%` }} />
                    </>
                  ) : (
                    <span className="h-full bg-bad" style={{ width: `${Math.round((Math.abs(gain) / max) * 100)}%` }} />
                  )}
                </span>
                <span className={cx("w-12 shrink-0 text-right font-mono text-sm font-bold", gain >= 0 ? "text-good" : "text-bad")}>{fmt1(gain)}</span>
              </div>
              {attrs.length > 0 || end > 0.004 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {end > 0.004 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-sub">
                      <TrophyIcon className="h-3 w-3" />
                      {R.completionShort(fmt2(end))}
                    </span>
                  ) : null}
                  {attrs.map(([k, v]) => (
                    <span key={k} className="text-[10px] text-faint">
                      {statLabels[k] ?? k} +{fmt2(v)}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-2.5 font-semibold text-sub">
          <HandshakeIcon className="h-3.5 w-3.5 text-faint" />
          {Y.chemistry} <span className="text-ink">{summary.chemStart}% → {summary.chemEnd}%</span>
        </span>
        {(Object.entries(summary.scrims) as [string, [number, number]][]).map(([lvl, [w, l]]) => (
          <span key={lvl} className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-2.5 font-semibold text-sub">
            <SwordsIcon className="h-3.5 w-3.5" />
            {Y.scrims} {Y.scrimChoices[lvl] ?? lvl} <span className="text-ink">{Y.record(w, l)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-line bg-white/[0.03] px-1 py-2 text-center">
      <span className={cx("display flex items-center gap-1 text-xl font-bold leading-none", tone)}>
        {icon}
        {value}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.1em] text-faint">{label}</span>
      {sub ? <span className="max-w-full truncate text-[10px] font-semibold text-ink">{sub}</span> : null}
    </div>
  );
}

/** One past cycle in the history (collapsible; the newest opens). */
export function PeriodReport({
  summary,
  C,
  statLabels,
  open,
}: {
  summary: TrainingSummary;
  C: CareerCopy;
  statLabels: Record<string, string>;
  open?: boolean;
}) {
  const Y = C.training.cycle;
  const avg = reportAvgOf(summary);
  const objective = summary.package?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : NEUTRAL_TONE;
  return (
    <details className="group rounded-xl border border-line bg-white/[0.02]" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-black/20", tone.text)}>
          <ObjectiveIcon objective={objective} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-ink">
            {Y.report.title(summary.periodIndex + 1, seasonLabelFor(summary.seasonIndex))}
          </span>
          <span className="block truncate text-[10px] text-faint">
            {objective ? Y.objectives[objective] : Y.by.base}
            {summary.package ? ` · ${focusLabel(C, summary.package.focus)}` : ""} · {Y.by[summary.author] ?? ""}
          </span>
        </span>
        <span className={cx("shrink-0 font-mono text-sm font-bold", avg > 0 ? "text-good" : avg < 0 ? "text-bad" : "text-sub")}>{fmt1(avg)}</span>
        <span className="shrink-0 text-faint transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
      </summary>
      <div className="px-3 pb-3">
        <CycleReportBody summary={summary} C={C} statLabels={statLabels} />
      </div>
    </details>
  );
}

/**
 * rc.34's coach proposal waiting for approval (HQ-CONTRACT H1). rc.35 never
 * raises one (a hired coach runs his plan; nothing holds the clock) — kept
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
      <p className="kicker text-[10px] text-orange-bright">{Y.cycleOf(decision.periodIndex + 1, decision.periodCount)}</p>
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
