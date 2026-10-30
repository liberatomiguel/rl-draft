"use client";

/**
 * Road to Worlds — DEV-03 training package pieces (rc.34, TRAINING-CONTRACT).
 *
 * One set of components for the Training screen and HQ's training block:
 *  - `PackageChips`: a package at a glance (objective · focus · load · scrims);
 *  - `PackageBuilder`: build or adjust a package, with its projection read
 *    from the engine that runs it (`projectTrainingPackage` — never UI math);
 *  - `TrainingProposalCard`: the coach's plan waiting for approval (H1's
 *    decision; front G places it in the queue);
 *  - `PeriodReport`: a filed period's summary (T7).
 * Mobile first: every control is ≥ 44 px tall, nothing scrolls sideways.
 */

import { useMemo, useState } from "react";
import { CAREER_PLAN, CAREER_SCRIM } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { seasonLabelFor } from "@/engine/career/calendar";
import { focusAttrsOf, OBJECTIVES, SQUAD_FOCI, WORKLOADS } from "@/engine/career/training";
import type {
  CareerSave,
  PlayerTweak,
  ScrimLevel,
  SquadFocus,
  TrainingPackage,
  TrainingSummary,
  TrainingWorkload,
} from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { cx } from "@/lib/util";
import { coachProposalOf, projectTrainingPackage, trainingOf, type TrainingDecision } from "@/store/careerTraining";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const STAT_KEYS: StatKey[] = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];
const LEVELS: (ScrimLevel | "auto")[] = ["auto", "easy", "even", "hard"];

export const fmt1 = (n: number): string => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const fmt2 = (n: number): string => n.toFixed(2);

/** The label of a squad focus (balanced, or the drill theme's name). */
export function focusLabel(C: CareerCopy, focus: SquadFocus): string {
  return focus === "balanced" ? C.training.plan.balanced : (C.training.drills[focus] ?? focus);
}

/** rc.34: what a squad player trains this period (his tweak, else the squad focus, else the base) — the player sheet's line. */
export function playerFocusLabel(save: CareerSave, playerId: string, C: CareerCopy, statLabels: Record<string, string>): string {
  const pkg = trainingOf(save).plan?.package ?? null;
  if (!pkg) return C.training.plan.base;
  const tweak = pkg.tweaks?.[playerId];
  if (tweak?.rest) return C.training.plan.rest;
  if (tweak?.focus) return statLabels[tweak.focus] ?? tweak.focus;
  return focusLabel(C, pkg.focus);
}

/** A package at a glance — objective, focus, load, scrims (wraps on a phone). */
export function PackageChips({ pkg, C, className }: { pkg: TrainingPackage | null; C: CareerCopy; className?: string }) {
  const P = C.training.plan;
  if (!pkg) {
    return (
      <div className={cx("flex flex-wrap gap-1.5", className)}>
        <Badge tone="neutral">{P.base}</Badge>
      </div>
    );
  }
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      <Badge tone="blue">{P.objectives[pkg.objective]}</Badge>
      <Badge tone="neutral">{focusLabel(C, pkg.focus)}</Badge>
      <Badge tone={pkg.workload === "heavy" ? "orange" : "neutral"}>
        {P.workload} · {P.workloads[pkg.workload]}
      </Badge>
      <Badge tone="neutral">
        {P.scrims} · {P.scrimsPerWeek(pkg.scrimsPerWeek)}
        {pkg.scrimsPerWeek > 0 ? ` · ${P.levels[pkg.scrimLevel]}` : ""}
      </Badge>
      {pkg.tweaks && Object.keys(pkg.tweaks).length > 0 ? (
        <Badge tone="neutral">
          {P.tweaks} · {Object.keys(pkg.tweaks).length}
        </Badge>
      ) : null}
    </div>
  );
}

/** One option of a radio group — a full-height tap target. */
function Choice({
  selected,
  onClick,
  title,
  hint,
  tone = "blue",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  tone?: "blue" | "orange";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "flex min-h-11 flex-col justify-center rounded-lg border px-2.5 py-1.5 text-left transition-colors",
        selected
          ? tone === "orange"
            ? "border-orange/60 bg-orange/15"
            : "border-blue/60 bg-blue/15"
          : "border-line bg-white/[0.03] hover:border-line-strong",
      )}
    >
      <span
        className={cx(
          "display text-[11px] font-bold uppercase tracking-[0.08em]",
          selected ? (tone === "orange" ? "text-orange-bright" : "text-blue-bright") : "text-ink",
        )}
      >
        {title}
      </span>
      {hint ? <span className="mt-0.5 text-[10px] leading-snug text-faint">{hint}</span> : null}
    </button>
  );
}

type TweakKey = "follow" | "rest" | `focus:${StatKey}` | `load:${TrainingWorkload}`;

function tweakKeyOf(t: PlayerTweak | undefined): TweakKey {
  if (!t) return "follow";
  if (t.rest) return "rest";
  if (t.focus) return `focus:${t.focus}`;
  if (t.workload) return `load:${t.workload}`;
  return "follow";
}

function tweakOfKey(k: TweakKey): PlayerTweak | null {
  if (k === "follow") return null;
  if (k === "rest") return { rest: true };
  if (k.startsWith("focus:")) return { focus: k.slice(6) as StatKey };
  return { workload: k.slice(5) as TrainingWorkload };
}

/**
 * Build or adjust the period's package. The projection reads the same
 * engine functions that run the days (`projectTrainingPackage`): each
 * player's gain over the rest of the period, the wear and the absence risk
 * it adds, the sessions and scrims, and the end date.
 */
export function PackageBuilder({
  save,
  C,
  statLabels,
  initial,
  onApply,
  onCancel,
  onKeepBase,
}: {
  save: CareerSave;
  C: CareerCopy;
  statLabels: Record<string, string>;
  initial: TrainingPackage | null;
  onApply: (pkg: TrainingPackage) => void;
  onCancel?: () => void;
  onKeepBase?: () => void;
}) {
  const P = C.training.plan;
  const carry = trainingOf(save).carryTweaks;
  const [draft, setDraft] = useState<TrainingPackage>(
    () =>
      initial ??
      coachProposalOf(save)?.package ?? {
        objective: "development",
        focus: "balanced",
        workload: "normal",
        scrimsPerWeek: 2,
        scrimLevel: "auto",
        ...(carry ? { tweaks: carry } : {}),
      },
  );
  const proposal = coachProposalOf(save);
  const proj = useMemo(() => projectTrainingPackage(save, draft, { unsupervised: false }), [save, draft]);
  const set = (patch: Partial<TrainingPackage>) => setDraft((d) => ({ ...d, ...patch }));
  const setTweak = (id: string, k: TweakKey) =>
    setDraft((d) => {
      const tweaks = { ...(d.tweaks ?? {}) };
      const t = tweakOfKey(k);
      if (t) tweaks[id] = t;
      else delete tweaks[id];
      return { ...d, tweaks };
    });
  const D = C.dates;
  const fromDate = formatDateTiny(D, dateOfDay(save.clock.seasonIndex, proj.fromDay));
  const endDate = formatDateTiny(D, dateOfDay(save.clock.seasonIndex, proj.endDay));
  const attrs = focusAttrsOf(draft.focus);

  return (
    <div className="space-y-4">
      {/* objective */}
      <div>
        <p className="kicker mb-1.5 text-[10px]">{P.objective}</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={P.objective}>
          {OBJECTIVES.map((o) => (
            <Choice
              key={o}
              selected={draft.objective === o}
              onClick={() => set({ objective: o })}
              title={P.objectives[o]}
              hint={P.objectiveHint[o]}
            />
          ))}
        </div>
      </div>

      {/* squad focus */}
      <div>
        <p className="kicker mb-1.5 text-[10px]">{P.focus}</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label={P.focus}>
          {SQUAD_FOCI.map((f) => (
            <Choice
              key={f}
              selected={draft.focus === f}
              onClick={() => set({ focus: f })}
              title={focusLabel(C, f)}
              hint={f === "balanced" ? undefined : focusAttrsOf(f).map((a) => statLabels[a] ?? a).join(" + ")}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-faint">
          {P.focusHint(fmt2(CAREER_PLAN.focusOffsetPerWeek))}
          {attrs.length > 0 ? ` (${attrs.map((a) => statLabels[a] ?? a).join(" + ")})` : ""}
        </p>
      </div>

      {/* workload */}
      <div>
        <p className="kicker mb-1.5 text-[10px]">{P.workload}</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={P.workload}>
          {WORKLOADS.map((w) => (
            <Choice
              key={w}
              selected={draft.workload === w}
              onClick={() => set({ workload: w })}
              title={P.workloads[w]}
              hint={P.workloadHint[w]}
              tone={w === "heavy" ? "orange" : "blue"}
            />
          ))}
        </div>
      </div>

      {/* scrims */}
      <div>
        <p className="kicker mb-1.5 text-[10px]">{P.scrims}</p>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={P.scrims}>
          {Array.from({ length: CAREER_SCRIM.package.maxPerWeek + 1 }, (_, n) => (
            <Choice key={n} selected={draft.scrimsPerWeek === n} onClick={() => set({ scrimsPerWeek: n })} title={P.scrimsPerWeek(n)} />
          ))}
        </div>
        {draft.scrimsPerWeek > 0 ? (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label={P.scrims}>
            {LEVELS.map((l) => (
              <Choice
                key={l}
                selected={draft.scrimLevel === l}
                onClick={() => set({ scrimLevel: l })}
                title={P.levels[l]}
                hint={P.levelHint[l]}
                tone={l === "hard" ? "orange" : "blue"}
              />
            ))}
          </div>
        ) : null}
        <p className="mt-1.5 text-[10px] text-faint">{P.scrimDaysHint}</p>
      </div>

      {/* tweaks */}
      <details className="group rounded-lg border border-line bg-white/[0.02]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 [&::-webkit-details-marker]:hidden">
          <span className="kicker text-[10px]">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ▸
            </span>
            {P.tweaks}
          </span>
          <span className="text-[10px] text-faint">{P.tweaksHint}</span>
        </summary>
        <div className="space-y-1.5 px-3 pb-3">
          {carry ? <p className="text-[10px] text-cyan">{P.carryHint}</p> : null}
          {save.squad.map((p) => (
            <label key={p.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-semibold text-ink">{p.name}</span>
              <select
                className="min-h-11 max-w-full rounded-md border border-line bg-[color:var(--bg)] px-2 text-xs text-ink"
                value={tweakKeyOf(draft.tweaks?.[p.id])}
                onChange={(e) => setTweak(p.id, e.target.value as TweakKey)}
              >
                <option value="follow">{P.followSquad}</option>
                <option value="rest">
                  {P.rest} — {P.restHint}
                </option>
                <optgroup label={P.ownFocus}>
                  {STAT_KEYS.map((s) => (
                    <option key={s} value={`focus:${s}`}>
                      {P.tweakFocus(statLabels[s] ?? s)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={P.ownLoad}>
                  {(["light", "heavy"] as TrainingWorkload[]).map((w) => (
                    <option key={w} value={`load:${w}`}>
                      {P.tweakWorkload(P.workloads[w])}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ))}
        </div>
      </details>

      {/* projection — from the engine that runs it */}
      <div className="rounded-xl border border-good/30 bg-good/[0.04] p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="kicker text-[10px]">{P.projection}</p>
          <span className="text-[10px] text-faint">{P.runsTo(endDate, proj.daysLeft)}</span>
        </div>
        <p className="mt-1 display text-lg font-bold text-good">{P.startersAvg(fmt2(proj.startersAvg))}</p>
        <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {proj.players.map((pl) => {
            const offs = (Object.entries(pl.offsets) as [StatKey, number][]).filter(([, v]) => v > 0);
            return (
              <li key={pl.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
                <span className="min-w-0 truncate font-semibold text-ink">{pl.name}</span>
                <span className="font-mono font-bold text-good">{P.perPlayer(fmt2(pl.gain))}</span>
                {offs.length > 0 ? (
                  <span className="text-[10px] text-cyan">
                    {offs.map(([k, v]) => `${statLabels[k] ?? k} +${fmt2(v)}`).join(" · ")}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[11px] text-sub">{P.daysLine(proj.sessionDays, proj.scrimDays)}</p>
        <p className={cx("text-[11px]", proj.squadWear > 0 ? "text-orange-bright" : "text-faint")}>
          {proj.squadWear > 0 ? P.wearLine(proj.squadWear.toFixed(1), proj.unavailabilityPts.toFixed(1)) : P.noWear}
        </p>
        <p className="mt-1 text-[10px] text-faint">{P.projectionHint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="md" className="min-h-11" onClick={() => onApply(draft)}>
          {P.apply}
        </Button>
        {proposal ? (
          <Button variant="secondary" size="md" className="min-h-11" onClick={() => setDraft(proposal.package)}>
            {P.useProposal}
          </Button>
        ) : null}
        {onKeepBase ? (
          <Button variant="ghost" size="md" className="min-h-11" onClick={onKeepBase}>
            {P.keepBase}
          </Button>
        ) : null}
        {onCancel ? (
          <Button variant="ghost" size="md" className="min-h-11" onClick={onCancel}>
            {P.cancel}
          </Button>
        ) : null}
      </div>
      <p className="text-[10px] text-faint">{P.applyHint(fromDate)}</p>
    </div>
  );
}

/**
 * The coach's plan waiting for approval ("the coach proposes", HQ-CONTRACT
 * H1): the package, why, what it does (the projection) and the three
 * answers. The clock holds until one is taken.
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
  const proj = useMemo(() => projectTrainingPackage(save, decision.proposal, { unsupervised: false }), [save, decision]);
  return (
    <div className="rounded-xl border border-orange/40 bg-orange/[0.06] p-3">
      <p className="kicker text-[10px] text-orange-bright">{P.periodOf(decision.periodIndex + 1, decision.periodCount)}</p>
      <p className="display mt-0.5 text-base font-bold text-ink">{P.proposalTitle(decision.coachName)}</p>
      <p className="mt-0.5 text-xs text-sub">{P.proposalReason[decision.reasonKey]}</p>
      <PackageChips pkg={decision.proposal} C={C} className="mt-2" />
      <p className="mt-2 text-sm font-semibold text-good">{P.startersAvg(fmt2(proj.startersAvg))}</p>
      <p className={cx("text-[11px]", proj.squadWear > 0 ? "text-orange-bright" : "text-faint")}>
        {proj.squadWear > 0 ? P.wearLine(proj.squadWear.toFixed(1), proj.unavailabilityPts.toFixed(1)) : P.noWear}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="md" className="min-h-11" onClick={onApprove}>
          {P.approve}
        </Button>
        <Button variant="secondary" size="md" className="min-h-11" onClick={onAdjust}>
          {P.edit}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={onKeepBase}>
          {P.keepBase}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-faint">{P.decisionLine}</p>
    </div>
  );
}

/** T7: one filed period — per player before → after, attributes, series, scrims, the coach's share, wear. */
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
  const P = C.training.plan;
  const gains = summary.players.map((p) => p.after - p.before);
  const avg = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / gains.length : 0;
  const scrims = Object.entries(summary.scrims) as [ScrimLevel, [number, number]][];
  return (
    <details className="group rounded-lg border border-line bg-white/[0.02]" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ▸
            </span>
            {P.summaryTitle(summary.periodIndex + 1, seasonLabelFor(summary.seasonIndex))}
          </span>
          <span className="text-[10px] text-faint">
            {summary.package ? P.objectives[summary.package.objective] : P.base} · {P.by[summary.author]}
          </span>
        </span>
        <span className={cx("font-mono text-xs font-bold", avg > 0 ? "text-good" : avg < 0 ? "text-bad" : "text-sub")}>
          {P.summaryAvg(fmt1(avg))}
        </span>
      </summary>
      <div className="space-y-2 px-3 pb-3 text-[11px]">
        <ul className="space-y-1.5">
          {summary.players.map((p) => {
            const attrs = (Object.entries(p.attrs) as [StatKey, number][]).filter(([, v]) => Math.abs(v) >= 0.01);
            const bits = [
              p.series > 0 ? P.seriesPlayed(p.series) : null,
              p.scrims > 0 ? `${P.scrims} +${fmt2(p.scrims)}` : null,
              p.coachShare > 0 ? P.coachShare(fmt2(p.coachShare)) : null,
              p.wear > 0 ? P.wear(p.wear.toFixed(1)) : null,
              p.unavailable ? P.unavailable : null,
              p.joined ? P.joined : null,
            ].filter(Boolean);
            return (
              <li key={p.id} className="rounded-md border border-line/60 bg-black/20 px-2 py-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="min-w-0 truncate font-semibold text-ink">{p.name}</span>
                  <span className="font-mono">
                    <span className="text-faint">{p.before.toFixed(1)}</span>
                    <span className="mx-1 text-faint">→</span>
                    <span className="font-bold text-ink">{p.after.toFixed(1)}</span>
                    <span className={cx("ml-1.5 font-bold", p.after - p.before >= 0 ? "text-good" : "text-bad")}>
                      {fmt1(p.after - p.before)}
                    </span>
                  </span>
                </div>
                {attrs.length > 0 ? (
                  <p className="text-[10px] text-cyan">
                    {attrs.map(([k, v]) => `${statLabels[k] ?? k} ${v > 0 ? "+" : ""}${fmt2(v)}`).join(" · ")}
                  </p>
                ) : null}
                {bits.length > 0 ? <p className="text-[10px] text-faint">{bits.join(" · ")}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="text-sub">{P.chemistry(summary.chemStart, summary.chemEnd)}</p>
        {scrims.length > 0 ? (
          <p className="text-sub">
            {scrims.map(([lvl, [w, l]]) => `${P.levels[lvl]} ${w}–${l}`).join(" · ")}
          </p>
        ) : null}
        {summary.coaches.length > 0 ? (
          <p className="text-sub">{summary.coaches.map((c) => P.coachDays(c.name, c.days, fmt2(c.share))).join(" · ")}</p>
        ) : null}
        {summary.notes.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-faint">
            {summary.notes.map((n, i) => (
              <li key={i}>{P.notes[n.key]?.(n.params ?? {}) ?? n.key}</li>
            ))}
          </ul>
        ) : null}
        {summary.next !== undefined ? (
          <p className="text-faint">{P.next(summary.next ? P.objectives[summary.next] : P.base)}</p>
        ) : null}
      </div>
    </details>
  );
}
