"use client";

/**
 * Road to Worlds — training pieces (rc.35, front T: the simplified cycle).
 *
 * Miguel (rc.34 playtest): "too many choices, no hierarchy, you can't tell
 * what anything does". A plan is now three choices — objective, intensity,
 * scrims — each an icon tile with a one-line effect; the focus follows the
 * coach (or balanced) and per-player tweaks are gone from the screen.
 *  - `PackageChips`: a plan at a glance (icon chips);
 *  - `PlanPicker`: pick the three, see the expected result from the engine
 *    that runs it (`projectTrainingPackage` — never UI math); Normal tags
 *    the most effective option Recommended, Hard shows no tag;
 *  - `CycleReportBody`: a finished cycle's per-player gains (the results
 *    modal and the history share it);
 *  - `PeriodReport`: one past cycle, collapsible;
 *  - `TrainingProposalCard`: rc.34's waiting proposal (kept for HQ's queue;
 *    rc.35 never raises one).
 * Mobile first: every control is ≥ 44 px tall, nothing scrolls sideways at 360 px.
 */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { seasonLabelFor } from "@/engine/career/calendar";
import {
  focusForStat,
  OBJECTIVES,
  SCRIM_CHOICES,
  scrimChoiceOf,
  simplePackageOf,
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
import {
  coachProposalOf,
  projectTrainingPackage,
  recommendedPackageOf,
  trainingControllerOf,
  trainingOf,
  type TrainingDecision,
} from "@/store/careerTraining";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AlertIcon,
  BaseDotIcon,
  GaugeIcon,
  HeartPulseIcon,
  StarIcon,
  SwordsIcon,
  TrendUpIcon,
  TrophyIcon,
} from "@/components/ui/icons";

export const fmt1 = (n: number): string => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const fmt2 = (n: number): string => n.toFixed(2);

/** The label of a squad focus (balanced, or the drill theme's name). */
export function focusLabel(C: CareerCopy, focus: SquadFocus): string {
  return focus === "balanced" ? C.training.plan.balanced : (C.training.drills[focus] ?? focus);
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

export const OBJECTIVE_TONE: Record<TrainingObjective, { text: string; ring: string; bg: string }> = {
  development: { text: "text-good", ring: "border-good/55", bg: "bg-good/10" },
  preparation: { text: "text-amber-300", ring: "border-amber-300/55", bg: "bg-amber-300/10" },
  recovery: { text: "text-cyan", ring: "border-cyan/55", bg: "bg-cyan/10" },
};

export function ObjectiveIcon({ objective, className }: { objective: TrainingObjective | null; className?: string }) {
  if (objective === "development") return <TrendUpIcon className={className} />;
  if (objective === "preparation") return <TrophyIcon className={className} />;
  if (objective === "recovery") return <HeartPulseIcon className={className} />;
  return <BaseDotIcon className={className} />;
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

/** A plan at a glance — objective, intensity, scrims (icon chips, wraps on a phone). */
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
      <Chip icon={<IntensityBars workload={pkg.workload} />} label={Y.intensities[pkg.workload]} tone={pkg.workload === "heavy" ? "text-orange-bright" : undefined} />
      <Chip icon={<SwordsIcon className="h-3.5 w-3.5" />} label={`${Y.steps.scrims} · ${Y.scrimChoices[scrims]}`} />
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

/** The cycle's progress ring (days gone of the cycle), the days left in the middle. */
export function CycleRing({ progress, daysLeft, label, className }: { progress: number; daysLeft: number; label: string; className?: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx("relative h-16 w-16 shrink-0", className)} role="img" aria-label={label}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          className="text-blue-bright"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="display text-lg font-bold text-ink">{daysLeft}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

/** The plan the screen tags Recommended (null on Hard without a coach). */
export function recommendedPlanOf(save: CareerSave): TrainingPackage | null {
  const controller = trainingControllerOf(save);
  if (controller === "manual") return null;
  if (controller === "coach") return coachProposalOf(save)?.package ?? null;
  return recommendedPackageOf(save).package;
}

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
  tone: { text: string; ring: string; bg: string };
  C: CareerCopy;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "relative flex min-h-[4.5rem] w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected ? cx(tone.ring, tone.bg) : "border-line bg-white/[0.03] hover:border-line-strong",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          selected ? cx(tone.ring, tone.text, "bg-black/20") : "border-line text-faint",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("display block text-xs font-bold uppercase tracking-[0.08em]", selected ? tone.text : "text-ink")}>{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-faint">{effect}</span>
      </span>
      {recommended ? (
        <span className="absolute -top-2 right-2 inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-[#1a1405] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-300">
          <StarIcon className="h-2.5 w-2.5" filled />
          {C.training.cycle.recommended}
        </span>
      ) : null}
    </button>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue/20 text-[11px] font-bold text-blue-bright">{n}</span>
        <span className="text-faint">{icon}</span>
        <span className="kicker text-[10px]">{title}</span>
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

const NEUTRAL_TONE = { text: "text-blue-bright", ring: "border-blue/60", bg: "bg-blue/15" };
const HEAVY_TONE = { text: "text-orange-bright", ring: "border-orange/60", bg: "bg-orange/15" };

/** Pick the cycle's plan (objective · intensity · scrims) and see what it does. */
export function PlanPicker({
  save,
  C,
  initial,
  onApply,
  onBase,
  onCancel,
}: {
  save: CareerSave;
  C: CareerCopy;
  initial: TrainingPackage | null;
  onApply: (pkg: TrainingPackage) => void;
  onBase: () => void;
  onCancel: () => void;
}) {
  const Y = C.training.cycle;
  const rec = useMemo(() => recommendedPlanOf(save), [save]);
  const seed = initial ?? rec;
  const [objective, setObjective] = useState<TrainingObjective>(seed?.objective ?? "development");
  const [workload, setWorkload] = useState<TrainingWorkload>(seed?.workload ?? "normal");
  const [scrims, setScrims] = useState<ScrimChoice>(seed ? scrimChoiceOf(seed) : "even");
  const focus = focusForStat(save.coach?.bonusType);
  const pkg = useMemo(() => simplePackageOf({ objective, workload, scrims, focus }), [objective, workload, scrims, focus]);
  const proj = useMemo(() => projectTrainingPackage(save, pkg), [save, pkg]);
  const recScrims = rec ? scrimChoiceOf(rec) : null;

  return (
    <div className="space-y-4">
      <Step n={1} icon={<TrendUpIcon className="h-4 w-4" />} title={Y.steps.objective}>
        {OBJECTIVES.map((o) => (
          <OptionTile
            key={o}
            C={C}
            selected={objective === o}
            recommended={rec?.objective === o}
            onClick={() => setObjective(o)}
            icon={<ObjectiveIcon objective={o} className="h-5 w-5" />}
            title={Y.objectives[o]}
            effect={Y.objectiveEffect[o]}
            tone={OBJECTIVE_TONE[o]}
          />
        ))}
      </Step>
      <Step n={2} icon={<GaugeIcon className="h-4 w-4" />} title={Y.steps.intensity}>
        {WORKLOADS.map((w) => (
          <OptionTile
            key={w}
            C={C}
            selected={workload === w}
            recommended={rec?.workload === w}
            onClick={() => setWorkload(w)}
            icon={<IntensityBars workload={w} />}
            title={Y.intensities[w]}
            effect={Y.intensityEffect[w]}
            tone={w === "heavy" ? HEAVY_TONE : NEUTRAL_TONE}
          />
        ))}
      </Step>
      <section>
        <p className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue/20 text-[11px] font-bold text-blue-bright">3</span>
          <span className="text-faint">
            <SwordsIcon className="h-4 w-4" />
          </span>
          <span className="kicker text-[10px]">{Y.steps.scrims}</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={Y.steps.scrims}>
          {SCRIM_CHOICES.map((s) => (
            <OptionTile
              key={s}
              C={C}
              selected={scrims === s}
              recommended={recScrims === s}
              onClick={() => setScrims(s)}
              icon={s === "off" ? <BaseDotIcon className="h-5 w-5" /> : <SwordsIcon className="h-5 w-5" />}
              title={Y.scrimChoices[s]}
              effect={Y.scrimEffect[s]}
              tone={s === "hard" ? HEAVY_TONE : NEUTRAL_TONE}
            />
          ))}
        </div>
        {scrims !== "off" ? <p className="mt-1.5 text-[10px] text-faint">{Y.scrimsAWeek(pkg.scrimsPerWeek)}</p> : null}
      </section>

      <ExpectedResult C={C} avg={proj.startersAvg} players={proj.players} risk={proj.unavailabilityPts} />

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="md" className="min-h-11 flex-1 sm:flex-none" onClick={() => onApply(pkg)}>
          {Y.apply}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={onBase}>
          {Y.useBase}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={onCancel}>
          {Y.cancel}
        </Button>
      </div>
    </div>
  );
}

/** The expected result: the starters' average (big), one bar per player, the absence risk. */
export function ExpectedResult({
  C,
  avg,
  players,
  risk,
}: {
  C: CareerCopy;
  avg: number;
  players: { id: string; name: string; gain: number }[];
  risk: number;
}) {
  const Y = C.training.cycle;
  const max = Math.max(0.01, ...players.map((p) => p.gain));
  return (
    <div className="rounded-xl border border-good/30 bg-gradient-to-br from-good/[0.08] to-transparent p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker text-[10px] text-good">{Y.expected}</p>
          <p className="text-[10px] leading-snug text-faint">{Y.expectedHint}</p>
        </div>
        <p className="display shrink-0 text-2xl font-bold text-good">{Y.expectedGain(fmt2(avg))}</p>
      </div>
      {players.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5" aria-label={Y.perPlayer}>
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-24 shrink-0 truncate font-semibold text-ink">{p.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-good" style={{ width: `${Math.round((Math.max(0, p.gain) / max) * 100)}%` }} />
              </span>
              <span className="w-11 shrink-0 text-right font-mono font-bold text-good">+{fmt2(p.gain)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={cx("mt-2 flex items-center gap-1.5 text-[11px]", risk > 0 ? "text-orange-bright" : "text-faint")}>
        <AlertIcon className="h-3.5 w-3.5 shrink-0" />
        {risk > 0 ? Y.risk(risk.toFixed(1)) : Y.noRisk}
      </p>
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

/** A finished cycle's per-player gains — the results modal and the history. */
export function CycleReportBody({
  summary,
  C,
  statLabels,
}: {
  summary: TrainingSummary;
  C: CareerCopy;
  statLabels: Record<string, string>;
}) {
  const Y = C.training.cycle;
  const avg = reportAvgOf(summary);
  const best = [...summary.players].sort((a, b) => b.after - b.before - (a.after - a.before))[0];
  const max = Math.max(0.05, ...summary.players.map((p) => Math.abs(p.after - p.before)));
  const objective = summary.package?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : NEUTRAL_TONE;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={Y.report.avg} value={fmt1(avg)} tone={avg >= 0 ? "text-good" : "text-bad"} />
        <Stat label={Y.report.best} value={best ? fmt1(best.after - best.before) : "—"} sub={best?.name} tone="text-amber-300" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white/[0.03] px-1 py-2 text-center">
          <span className={cx("flex h-7 w-7 items-center justify-center rounded-lg", tone.text)}>
            <ObjectiveIcon objective={objective} className="h-5 w-5" />
          </span>
          <span className="mt-0.5 truncate text-[10px] font-semibold text-ink">{objective ? Y.objectives[objective] : Y.by.base}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {summary.players.map((p) => {
          const gain = p.after - p.before;
          const attrs = (Object.entries(p.attrs) as [StatKey, number][]).filter(([, v]) => v >= 0.05);
          return (
            <li key={p.id} className="rounded-xl border border-line bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-bold text-ink">{p.name}</span>
                <span className="shrink-0 font-mono text-xs">
                  <span className="text-faint">{p.before.toFixed(1)}</span>
                  <span className="mx-1 text-faint">→</span>
                  <span className="font-bold text-ink">{p.after.toFixed(1)}</span>
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={cx("block h-full rounded-full", gain >= 0 ? "bg-good" : "bg-bad")}
                    style={{ width: `${Math.round((Math.abs(gain) / max) * 100)}%` }}
                  />
                </span>
                <span className={cx("w-12 shrink-0 text-right font-mono text-sm font-bold", gain >= 0 ? "text-good" : "text-bad")}>{fmt1(gain)}</span>
              </div>
              {attrs.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {attrs.map(([k, v]) => (
                    <span key={k} className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">
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
        <Badge tone="neutral">
          {Y.chemistry} {summary.chemStart}% → {summary.chemEnd}%
        </Badge>
        {(Object.entries(summary.scrims) as [string, [number, number]][]).map(([lvl, [w, l]]) => (
          <Badge key={lvl} tone="neutral">
            {Y.scrims} {Y.scrimChoices[lvl] ?? lvl} {Y.record(w, l)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-line bg-white/[0.03] px-1 py-2 text-center">
      <span className={cx("display text-xl font-bold leading-none", tone)}>{value}</span>
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
            {objective ? Y.objectives[objective] : Y.by.base} · {Y.by[summary.author] ?? ""}
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
