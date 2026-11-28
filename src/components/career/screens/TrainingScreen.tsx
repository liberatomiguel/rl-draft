"use client";

/**
 * Road to Worlds — Training (rc.35 front T; rc.36 front T2, R83; rc9
 * TRAIN-MARKET: rebuilt around the one decision).
 *
 * What the player decides here: what the squad works on this cycle and how
 * hard. What he must see first: the plan running now (or the choice, when
 * none runs) and what it gives him in plain words.
 *
 * The screen reads top-down:
 *  1. the cycle: a running plan (its gain as a figure, then the four choices
 *     as rows with what each does) with "Adjust plan"; or, when nothing runs,
 *     the picker as the main action (empty by default, the recommendation only
 *     where the preset or the coach gives one), then "Start training";
 *  2. the squad's growth, one row per player (the next point, the band);
 *  3. on the right: the coach, the week's scrims and the report switch;
 *  4. at the bottom, out of the way: what each attribute does.
 * Every number comes from the engine or balance.ts, never inline math.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CAREER_CALENDAR, CAREER_TRAINING, SIMULATION } from "@/config/balance";
import { statEffectsFor } from "@/engine/statEffects";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { useSettings } from "@/store/settingsStore";
import { coachTrainingProfileOf, trainingBlockOf } from "@/store/careerTraining";
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
  PlanPicker,
  PlanRows,
  PromiseBar,
  WeeklyScrimRecap,
} from "@/components/career/training/TrainingPackageParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Toggle } from "@/components/ui/Toggle";
import { MatchdayModeSetting } from "@/components/career/MatchdayModeSetting"; // rc9 MATCHDAY

export function TrainingScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = useCareerCopy();
  const setTrainingPackage = useCareerStore((s) => s.setTrainingPackage);
  const setCoachPlans = useCareerStore((s) => s.setTrainingCoachPlans);
  const scrimPlaying = useCareerStore((s) => Boolean(s.scrimPlayback));
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const requestedEdit = useSearchParams().get("edit") === "1";
  const showEditor = editing || requestedEdit;
  const closeEditor = () => { setEditing(false); if (requestedEdit) router.replace("/career/training"); };
  const showReports = useSettings((s) => s.careerTrainingReports);
  const setSettings = useSettings((s) => s.set);

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
  const coachProfile = coachTrainingProfileOf(save.coach);
  const running = save.phase === "running";
  const pkg = block.package;

  // Engine truth: Mon-Fri sessions; a committed week trains at half load.
  const matchPrepWeek = save.pendingEventDef !== null;
  const trainingWeek = !matchPrepWeek && (clock.kind === "open" || clock.kind === "preseason");
  const trainingWeekPct = Math.round(CAREER_CALENDAR.trainingWeekBonus * 100);
  const sessionToday = running && clock.dow <= CAREER_TRAINING.trainingDaysPerWeek;
  const gearPct = Math.round(gearTrainingBonus(save.finances.gear) * 100);

  const teamNow = userTeamPreview(save);
  const effects = statEffectsFor(teamNow.stats);

  const endDate = formatDateTiny(D, dateOfDay(save.clock.seasonIndex, block.period.endDay));
  const controllerLine =
    block.controller === "coach" && coachProfile
      ? Y.controllerCoach(coachProfile.name)
      : coachProfile
        ? Y.controllerCoachOff(coachProfile.name)
        : Y.controller[block.controller];
  const coachPct = block.coach?.effectPct ?? 0;
  const soFar = block.promise ? block.promise.paid + block.promise.held : 0;
  const cycleNo = Y.cycleOf(block.period.index + 1, block.period.count);
  const sessionText = sessionToday && matchPrepWeek ? C.training.matchPrepWeek : sessionToday ? C.training.sessionToday : C.training.noSessionToday;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <SectionTitle title={C.training.title} right={<Badge tone="neutral">{formatDateShort(D, clock.date)}</Badge>} />

      <ErrorBanner />

      {/* rc9 MATCHDAY: the match mode setting goes here, as one full-width block. */}

      {/* The plan and what it does to the squad on the left; who plans it, the week's scrims and the report switch on the right. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          {/* 1: the cycle, a running plan or the picker as the main action */}
          {block.running && block.cycle ? (
            <Panel data-tour="training-cycle" className="rise-in p-5">
              <div className="card-head">
                <h2 className="card-title">{Y.title}</h2>
                <span className="text-xs tabular-nums text-faint">
                  {cycleNo} · {Y.daysLeft(block.cycle.daysLeft)}
                </span>
              </div>
              {block.promise ? <PromiseBar promise={block.promise} C={C} /> : null}
              <p className="mb-5 mt-2 text-xs text-faint">
                {save.clock.day < block.cycle.fromDay ? Y.startsTomorrow : Y.dayOf(block.cycle.dayOf, block.cycle.length)} · {Y.endsOn(endDate)}
              </p>
              <PlanRows pkg={pkg} C={C} statLabels={t.STAT_LABELS} />
              <dl className="mb-5 text-[13px]">
                <FactRow label={Y.facts.session} value={sessionText} extra={trainingWeek ? `+${trainingWeekPct}% · ${C.hub.trainingWeek}` : null} />
                {pkg && pkg.scrimsPerWeek > 0 ? (
                  <FactRow
                    label={Y.steps.scrims}
                    value={Y.scrimsDone(block.scrims.done, block.scrims.planned)}
                    extra={block.scrims.done > 0 && !scrimPlaying ? Y.record(block.scrims.won, block.scrims.lost) : null}
                  />
                ) : null}
                <FactRow label={Y.facts.risk} value={block.unavailabilityPts > 0 ? Y.risk(block.unavailabilityPts.toFixed(1)) : Y.noRisk} />
                {coachProfile && coachPct > 0 ? <FactRow label={C.training.coachTitle} value={`${coachProfile.name} · ${Y.coachBoost(coachPct)}`} /> : null}
              </dl>
              {running && !showEditor ? (
                <Button variant="secondary" size="md" className="min-h-11 w-full sm:w-auto" onClick={() => setEditing(true)}>
                  {Y.adjust}
                </Button>
              ) : null}
              {running && showEditor ? (
                <div className="border-t border-line pt-4" data-training-editor="adjust">
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
                      closeEditor();
                    }}
                    onCancel={closeEditor}
                  />
                </div>
              ) : null}
            </Panel>
          ) : (
            <Panel data-tour="training-cycle" strong className="rise-in p-5">
              <div className="card-head">
                <h2 className="card-title">{Y.pickTitle}</h2>
                <span className="text-xs tabular-nums text-faint">
                  {cycleNo} · {Y.daysLeft(block.period.daysLeft)}
                </span>
              </div>
              {running ? (
                <>
                  <p className="text-sm leading-snug text-sub">{Y.idleLine}</p>
                  <p className="mb-5 mt-1 text-[13px] leading-snug text-faint">{controllerLine}</p>
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
                </>
              ) : (
                <p className="text-sm text-sub">{Y.paused}</p>
              )}
            </Panel>
          )}

          {/* 2: the squad's growth, one row per player */}
          <Panel data-tour="training-growth" className="rise-in p-5" style={{ animationDelay: "60ms" }}>
            <div className="card-head">
              <h2 className="card-title">{C.training.plan.squadGrowth}</h2>
            </div>
            {save.squad.length === 0 ? (
              <p className="text-sm text-sub">{C.training.growthEmpty}</p>
            ) : (
              <ul>
                {save.squad.map((p) => (
                  <GrowthRow key={p.id} save={save} p={p} C={C} />
                ))}
              </ul>
            )}
            <p className="mt-4 text-[13px] text-faint">{C.training.matchXpHint}</p>
          </Panel>
        </div>

        <div className="space-y-6">
          {/* 3: the coach, or the hire link */}
          <Panel data-tour="training-coach" className="rise-in p-5" style={{ animationDelay: "40ms" }}>
            <div className="card-head">
              <h2 className="card-title">{C.training.coachTitle}</h2>
              {!coachProfile ? (
                <AppLink href="/career/market#coaches" className="inline-flex min-h-11 items-center text-xs font-semibold text-blue-bright hover:underline">
                  {Y.hireCoach}
                </AppLink>
              ) : null}
            </div>
            {coachProfile ? (
              <Toggle checked={block.coachPlans} onChange={setCoachPlans} label={Y.coachPlans(coachProfile.name)} hint={Y.coachPlansHint} disabled={!running} />
            ) : (
              <>
                <p className="display text-[15px] font-semibold text-ink">{C.training.noCoachTitle}</p>
                <p className="mt-0.5 text-[13px] text-sub">{Y.noCoach}</p>
              </>
            )}
            <p className="mt-4 border-t border-line pt-3 text-[13px] text-faint">
              <AppLink href="/career/finances" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline">
                {C.training.facilityEffect(gearPct)}
              </AppLink>
            </p>
          </Panel>

          {/* rc9 MATCHDAY */}<MatchdayModeSetting save={save} className="rise-in" />

          {/* The current week's scrims, in one compact recap. */}
          <Panel className="rise-in p-5" style={{ animationDelay: "120ms" }}>
            <WeeklyScrimRecap save={save} C={C} />
          </Panel>

          <Toggle checked={showReports} onChange={(on) => setSettings("careerTrainingReports", on)} label={Y.report.showAutomatic} />
        </div>
      </div>

      {/* 4: the reference, out of the way */}
      <details className="group rise-in border-t border-line pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="card-title">{C.training.effectsTitle}</span>
          <span className="text-xs text-faint group-open:hidden">{C.training.effectsOpen}</span>
          <span className="hidden text-xs text-faint group-open:inline">{C.training.effectsClose}</span>
        </summary>
        <p className="mt-2 text-[13px] text-sub">{C.training.effectBaseline(SIMULATION.statBaseline)}</p>
        <ul className="mt-3 border-t border-line">
          {effects.map((e) => (
            <li key={e.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-line py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)_11rem]">
              <p className="flex items-baseline gap-2">
                <span className="display text-[15px] font-semibold text-ink">{t.STAT_LABELS[e.key]}</span>
                <span className="text-[13px] tabular-nums text-faint">{Math.round(teamNow.stats[e.key])}</span>
              </p>
              <p className={cx("text-right text-[13px] font-semibold tabular-nums sm:order-3", e.value > 0 ? "text-good" : e.value < 0 ? "text-bad" : "text-sub")}>
                {e.unit === "rating" ? C.training.effectRating(e.value) : C.training.effectPct(e.value)}
                <span className="block text-xs font-normal text-faint">{C.training.effectWhen[e.when]}</span>
              </p>
              <p className="col-span-2 text-[13px] leading-snug text-sub sm:order-2 sm:col-span-1">{C.training.effectDescription[e.key]}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** One fact of the running cycle: the label in the faint step, the value on the right. */
function FactRow({ label, value, extra }: { label: string; value: string; extra?: string | null }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-b border-line py-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="kicker pt-0.5">{label}</dt>
      <dd className="min-w-0">
        <span className="block text-sm text-ink">{value}</span>
        {extra ? <span className="mt-0.5 block text-[13px] text-sub">{extra}</span> : null}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A squad player's growth: the next point and the band (no per-row controls)
// ---------------------------------------------------------------------------

function GrowthRow({ save, p, C }: { save: CareerSave; p: SquadPlayer; C: CareerCopy }) {
  const band = potBandOfSquad(save, p);
  const phase = agePhase(save, p);
  const age = squadAge(save, p);
  const eta = squadTrainingEta(save, p);
  const proj = squadTrainingProjection(save, p);
  const weeklyDecline = eta.splitCapped ? 0 : proj.weeklyDecline;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_3rem]">
      <div className="min-w-0">
        <p className="display truncate text-[15px] font-semibold text-ink">{p.name}</p>
        <p className="mt-0.5 text-xs text-faint">
          {C.player.age(age)} · {C.player.phase[phase]} · {C.player.potBand(band.min, band.max)}
        </p>
      </div>
      <p className="display text-right text-2xl font-bold leading-none tabular-nums text-ink sm:order-3" title={C.common.ovr}>
        {Math.round(p.overall)}
      </p>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:order-2">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-sub">
            {eta.atPotential ? (eta.splitCapped ? C.training.etaAtPotential : C.training.etaAtPeak) : C.training.nextPoint(eta.nextPoint)}
          </span>
          <span className={cx("shrink-0 text-xs", eta.daysToNext !== null && !eta.atPotential ? "text-good" : "text-faint")}>
            {eta.atPotential ? "" : eta.daysToNext !== null ? C.training.etaDays(eta.daysToNext) : C.training.etaNone}
          </span>
        </div>
        <ProgressBar value={eta.progress} tone={eta.atPotential || phase === "prime" ? "gold" : eta.daysToNext !== null ? "good" : "blue"} className="mt-1.5 h-1.5" label={C.training.growth} />
        <p className="mt-1.5 text-xs text-faint">{C.training.perWeekOverall(proj.weeklyOverall.toFixed(2))}</p>
        {weeklyDecline > 0 ? <p className="mt-0.5 text-xs text-bad">{C.training.declineLine(weeklyDecline.toFixed(2))}</p> : null}
      </div>
    </li>
  );
}
