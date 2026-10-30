"use client";

/**
 * Road to Worlds — Training (rc.35 front T; rc.36 front T2, R83: Miguel's
 * rc.35 playtest).
 *
 * The screen reads top-down:
 *  1. the cycle HERO — a running plan (its objective, focus, intensity and
 *     scrims as chips, the days-left ring and the PROGRESS BAR of its promised
 *     gain: earned, to come, what lands on completion) with "Adjust plan";
 *     or, when nothing runs, "No plan running" and the picker right under it
 *     as the main action (empty by default, the recommendation only where the
 *     preset or the coach gives one), then "Start training";
 *  2. the coach — "he plans each cycle" (on / off), or the hire link;
 *  3. the squad's growth (the next point the cards will print, the band);
 *  4. past cycles (the results, visual), recent scrims, what the attributes do.
 * Gone (Miguel): "this cycle so far" and "expected result" (they repeated the
 * plan), "use the base" (not picking is the base), the season ceiling.
 * Every number comes from the engine or balance.ts — never inline math.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { CAREER_CALENDAR, CAREER_TRAINING } from "@/config/balance";
import { statEffectsFor } from "@/engine/statEffects";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { clamp, cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { coachTrainingProfileOf, playerEffectOf, trainingBlockOf, trainingOf } from "@/store/careerTraining";
import {
  agePhase,
  clockLabel,
  dateOfDay,
  gearTrainingBonus,
  potBandOfSquad,
  squadAge,
  squadTrainingEta,
  squadTrainingProjection,
  useCareerSave,
  userTeamPreview,
} from "@/components/career/careerUi";
import { formatDateShort, formatDateTiny } from "@/components/career/dateText";
import { ErrorBanner } from "@/components/career/hub/hubShared";
import {
  CycleRing,
  OBJECTIVE_TONE,
  ObjectiveIcon,
  PackageChips,
  PeriodReport,
  PlanPicker,
  PromiseBar,
} from "@/components/career/training/TrainingPackageParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertIcon, BaseDotIcon, StarIcon, SwordsIcon, WhistleIcon } from "@/components/ui/icons";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Toggle } from "@/components/ui/Toggle";

const PHASE_TONE = { growing: "good", prime: "blue", declining: "neutral", unknown: "neutral" } as const;

export function TrainingScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = useCareerCopy();
  const setTrainingPackage = useCareerStore((s) => s.setTrainingPackage);
  const setCoachPlans = useCareerStore((s) => s.setTrainingCoachPlans);
  const [editing, setEditing] = useState(false);

  const block = useMemo(() => (save ? trainingBlockOf(save) : null), [save]);

  if (!mounted || !save || !block) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        <div className="h-10 w-52 animate-pulse rounded-lg bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  const D = C.dates;
  const Y = C.training.cycle;
  const clock = clockLabel(save);
  const training = trainingOf(save);
  const coachProfile = coachTrainingProfileOf(save.coach);
  const running = save.phase === "running";
  const pkg = block.package;
  const objective = pkg?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : { text: "text-sub", ring: "border-line", bg: "bg-white/[0.03]" };

  // Engine truth: Mon–Fri sessions; a committed week trains at half load.
  const matchPrepWeek = save.pendingEventDef !== null;
  const trainingWeek = !matchPrepWeek && (clock.kind === "open" || clock.kind === "preseason");
  const trainingWeekPct = Math.round(CAREER_CALENDAR.trainingWeekBonus * 100);
  const sessionToday = running && clock.dow <= CAREER_TRAINING.trainingDaysPerWeek;
  const gearPct = Math.round(gearTrainingBonus(save.finances.gear) * 100);

  const teamNow = userTeamPreview(save);
  const effects = statEffectsFor(teamNow.stats);

  const endDate = formatDateTiny(D, dateOfDay(save.clock.seasonIndex, block.period.endDay));
  const seasonScrims = save.scrimLog.filter((e) => e.seasonIndex === save.clock.seasonIndex);
  const cycles = training.history.filter((h) => h.package);
  const controllerLine =
    block.controller === "coach" && coachProfile
      ? Y.controllerCoach(coachProfile.name)
      : coachProfile
        ? Y.controllerCoachOff(coachProfile.name)
        : Y.controller[block.controller];
  const coachPct = block.coach?.effectPct ?? 0;
  const soFar = block.promise ? block.promise.paid + block.promise.held : 0;
  const cycleNo = Y.cycleOf(block.period.index + 1, block.period.count);

  const sessionChip = (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", sessionToday ? "bg-cyan/10 text-cyan" : "bg-white/5 text-faint")}>
      <span className={cx("h-1.5 w-1.5 rounded-full", sessionToday ? "animate-pulse bg-cyan" : "bg-white/20")} aria-hidden />
      {sessionToday && matchPrepWeek ? C.training.matchPrepWeek : sessionToday ? C.training.sessionToday : C.training.noSessionToday}
    </span>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle kicker={C.meta.title} title={C.training.title} right={<Badge tone="neutral">{formatDateShort(D, clock.date)}</Badge>} />

      <ErrorBanner />

      {/* 1 — the cycle: a running plan, or the picker as the main action */}
      {block.running && block.cycle ? (
        <Panel glow="blue" className="rise-in overflow-hidden p-0">
          <div className={cx("flex items-center gap-3 border-b border-line px-4 py-3", tone.bg)}>
            <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-black/25", tone.ring, tone.text)}>
              <ObjectiveIcon objective={objective} className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="kicker text-[10px] leading-snug">
                {cycleNo} · {Y.running}
              </p>
              <p className={cx("display truncate text-xl font-bold", tone.text)}>{objective ? Y.objectives[objective] : Y.by.base}</p>
              <p className="truncate text-[11px] text-sub">{Y.by[block.author] ?? ""}</p>
            </div>
            <CycleRing progress={block.cycle.progress} daysLeft={block.cycle.daysLeft} label={Y.daysLeft(block.cycle.daysLeft)} />
          </div>
          <div className="space-y-3 px-4 py-3">
            <PackageChips pkg={pkg} C={C} />
            {block.promise ? <PromiseBar promise={block.promise} C={C} /> : null}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-faint">
                {save.clock.day < block.cycle.fromDay ? Y.startsTomorrow : Y.dayOf(block.cycle.dayOf, block.cycle.length)} · {Y.endsOn(endDate)}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {sessionChip}
                {trainingWeek ? (
                  <span className="rounded-full bg-good/10 px-2 py-0.5 font-semibold text-good">
                    +{trainingWeekPct}% · {C.hub.trainingWeek}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {pkg && pkg.scrimsPerWeek > 0 ? (
                <span className="inline-flex items-center gap-1 text-sub">
                  <SwordsIcon className="h-3.5 w-3.5" />
                  {Y.scrimsDone(block.scrims.done, block.scrims.planned)}
                  {block.scrims.done > 0 ? ` · ${Y.record(block.scrims.won, block.scrims.lost)}` : ""}
                </span>
              ) : null}
              <span className={cx("inline-flex items-center gap-1", block.unavailabilityPts > 0 ? "text-orange-bright" : "text-faint")}>
                <AlertIcon className="h-3.5 w-3.5" />
                {block.unavailabilityPts > 0 ? Y.risk(block.unavailabilityPts.toFixed(1)) : Y.noRisk}
              </span>
              {coachProfile && coachPct > 0 ? (
                <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-cyan">
                  <WhistleIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {coachProfile.name} · {Y.coachBoost(coachPct)}
                  </span>
                </span>
              ) : null}
            </div>
            {running && !editing ? (
              <Button variant="secondary" size="md" className="min-h-11 w-full sm:w-auto" onClick={() => setEditing(true)}>
                {Y.adjust}
              </Button>
            ) : null}
            {running && editing ? (
              <div className="border-t border-line pt-3">
                <PlanPicker
                  key={`adjust:${save.clock.seasonIndex}:${block.period.startDay}`}
                  save={save}
                  C={C}
                  statLabels={t.STAT_LABELS}
                  initial={pkg}
                  recommended={block.recommended}
                  lastPlan={null}
                  soFar={soFar}
                  onSubmit={(p) => {
                    setTrainingPackage(p);
                    setEditing(false);
                  }}
                  onCancel={() => setEditing(false)}
                />
              </div>
            ) : null}
          </div>
        </Panel>
      ) : (
        <Panel strong className="rise-in overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-line bg-white/[0.02] px-4 py-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-black/25 text-faint">
              <BaseDotIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="kicker text-[10px] leading-snug">
                {cycleNo} · {Y.daysLeft(block.period.daysLeft)}
              </p>
              <p className="display text-xl font-bold leading-tight text-ink">{Y.idle}</p>
              <p className="text-[11px] leading-snug text-sub">{Y.idleLine}</p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div>
              <p className="display text-base font-bold text-ink">{Y.pickTitle}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-[11px] text-sub">
                {block.controller === "coach" || coachProfile ? (
                  <WhistleIcon className="mt-px h-3.5 w-3.5 shrink-0 text-cyan" />
                ) : (
                  <StarIcon className="mt-px h-3.5 w-3.5 shrink-0 text-good" filled={block.recommended !== null} />
                )}
                <span className="min-w-0">{controllerLine}</span>
              </p>
            </div>
            {running ? (
              <PlanPicker
                key={`start:${save.clock.seasonIndex}:${block.period.startDay}`}
                save={save}
                C={C}
                statLabels={t.STAT_LABELS}
                initial={null}
                recommended={block.recommended}
                lastPlan={block.lastPlan}
                onSubmit={(p) => setTrainingPackage(p)}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">{sessionChip}</div>
          </div>
        </Panel>
      )}

      {/* 2 — the coach: he plans each cycle, or the hire link */}
      <Panel className="rise-in p-4" style={{ animationDelay: "40ms" }}>
        {coachProfile ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/40 bg-cyan/10 text-cyan">
              <WhistleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Toggle checked={block.coachPlans} onChange={setCoachPlans} label={Y.coachPlans(coachProfile.name)} hint={Y.coachPlansHint} disabled={!running} />
            </div>
          </div>
        ) : (
          <AppLink href="/career/market#coaches" className="flex min-h-11 items-center gap-3 text-[11px] font-semibold text-orange-bright hover:underline">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange/40 bg-orange/10">
              <WhistleIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              {Y.noCoach} · {Y.hireCoach} →
            </span>
          </AppLink>
        )}
        <p className="mt-2 text-[10px] text-faint">
          <AppLink href="/career/finances" className="underline-offset-4 hover:text-ink hover:underline">
            {C.training.facilityEffect(gearPct)}
          </AppLink>
        </p>
      </Panel>

      {/* 3 — the squad's growth */}
      <div>
        <p className="kicker mb-2 text-[10px]">{C.training.plan.squadGrowth}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {save.squad.map((p, i) => (
            <GrowthCard key={p.id} save={save} p={p} C={C} statLabels={t.STAT_LABELS} style={{ animationDelay: `${80 + i * 40}ms` }} />
          ))}
        </div>
      </div>

      {/* 4 — past cycles (a period on the base is not a cycle) */}
      <Panel className="rise-in p-4" style={{ animationDelay: "200ms" }}>
        <p className="kicker mb-2 text-[10px]">{Y.history}</p>
        {cycles.length === 0 ? (
          <p className="text-xs text-faint">{Y.historyEmpty}</p>
        ) : (
          <div className="space-y-2">
            {cycles.slice(0, 8).map((h, i) => (
              <PeriodReport key={`${h.seasonIndex}:${h.startDay}`} summary={h} C={C} statLabels={t.STAT_LABELS} open={i === 0} />
            ))}
          </div>
        )}
      </Panel>

      {/* 4b — recent scrims */}
      <Panel className="rise-in p-4" style={{ animationDelay: "220ms" }}>
        <p className="kicker mb-1.5 flex items-center gap-1.5 text-[10px]">
          <SwordsIcon className="h-3.5 w-3.5" />
          {C.scrim.results}
        </p>
        {seasonScrims.length === 0 ? (
          <p className="text-xs text-faint">{C.scrim.noResults}</p>
        ) : (
          <ul className="space-y-1.5">
            {seasonScrims.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cx("h-2 w-2 shrink-0 rounded-full", e.won ? "bg-good" : "bg-bad")} aria-hidden />
                <span className={cx("min-w-0 font-semibold", e.won ? "text-good" : "text-bad")}>
                  {e.won ? C.scrim.won(e.oppName, e.scoreA, e.scoreB) : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}
                </span>
                {e.level ? <Badge tone="neutral">{Y.scrimChoices[e.level]}</Badge> : null}
                <span className="ml-auto shrink-0 text-[10px] text-faint">{formatDateTiny(D, dateOfDay(e.seasonIndex, e.day))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 4c — what the attributes do */}
      <details className="rise-in group panel p-0" style={{ animationDelay: "240ms" }}>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="kicker text-[10px]">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ▸
            </span>
            {C.training.effectsTitle}
          </span>
          <span className="text-[10px] text-faint">{C.training.effectsHint}</span>
        </summary>
        <div className="grid grid-cols-2 gap-1.5 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-6">
          {effects.map((e) => {
            const positive = e.value > 0;
            return (
              <div key={e.key} className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="display text-[10px] font-bold uppercase tracking-[0.08em] text-ink">{t.STAT_LABELS[e.key]}</span>
                  <span className="font-mono text-[11px] font-bold text-sub">{Math.round(teamNow.stats[e.key])}</span>
                </div>
                <p className={cx("mt-0.5 text-sm font-bold", positive ? "text-good" : e.value < 0 ? "text-bad" : "text-sub")}>
                  {e.unit === "rating" ? C.training.effectRating(e.value) : C.training.effectPct(e.value)}
                </p>
                <p className="text-[10px] leading-tight text-faint">{C.training.effectWhen[e.when]}</p>
              </div>
            );
          })}
        </div>
      </details>

      <p className="rise-in text-center text-[11px] text-faint">{C.training.matchXpHint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A squad player's growth — the next point and the band (no per-card controls)
// ---------------------------------------------------------------------------

function GrowthCard({
  save,
  p,
  C,
  statLabels,
  style,
}: {
  save: CareerSave;
  p: SquadPlayer;
  C: CareerCopy;
  statLabels: Record<string, string>;
  style?: React.CSSProperties;
}) {
  const band = potBandOfSquad(save, p);
  const phase = agePhase(save, p);
  const age = squadAge(save, p);
  const growth = clamp((p.overall - 60) / Math.max(1, band.max - 60), 0, 1);
  const eta = squadTrainingEta(save, p);
  const proj = squadTrainingProjection(save, p);
  const weeklyDecline = eta.splitCapped ? 0 : proj.weeklyDecline;
  const offsets = (Object.entries(playerEffectOf(save, p.id).offsets) as [StatKey, number][]).filter(([, v]) => v > 0);
  return (
    <Panel className="rise-in p-3.5" style={style}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="display text-2xl font-bold leading-none text-ink" title={C.common.ovr}>
            {Math.round(p.overall)}
          </span>
          <div className="min-w-0">
            <p className="display truncate font-bold leading-tight text-ink">{p.name}</p>
            <p className="text-[10px] text-faint">
              {C.common.ovr} · {C.player.age(age)}
            </p>
          </div>
        </div>
        <Badge tone={PHASE_TONE[phase]}>{C.player.phase[phase]}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <ProgressBar value={growth} tone="blue" className="flex-1" label={C.player.growthRoom} />
        <span className="shrink-0 text-[10px] text-faint">
          {C.player.growthRoom} · {C.player.potBand(band.min, band.max)}
        </span>
      </div>
      <div className="mt-2 rounded-lg border border-line bg-black/20 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-ink">
            {eta.atPotential ? (eta.splitCapped ? C.training.etaAtPotential : C.training.etaAtPeak) : C.training.nextPoint(eta.nextPoint)}
          </span>
          <span className={cx("font-semibold", eta.daysToNext !== null ? "text-good" : "text-faint")}>
            {eta.atPotential ? "" : eta.daysToNext !== null ? C.training.etaDays(eta.daysToNext) : C.training.etaNone}
          </span>
        </div>
        <ProgressBar value={eta.progress} tone={eta.daysToNext !== null ? "good" : "blue"} className="mt-1.5 h-1.5" label={C.training.growth} />
        <p className="mt-1 text-[10px] text-faint">
          {C.training.perWeekOverall(proj.weeklyOverall.toFixed(2))}
          {offsets.map(([k, v]) => ` · ${C.training.perWeekOffset(v.toFixed(2), statLabels[k] ?? k)}`).join("")}
        </p>
        {weeklyDecline > 0 ? <p className="mt-0.5 text-[10px] text-bad">{C.training.declineLine(weeklyDecline.toFixed(2))}</p> : null}
      </div>
    </Panel>
  );
}
