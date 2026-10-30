"use client";

/**
 * Road to Worlds — Training (rc.35, front T: the simplified 14-day cycle).
 *
 * Miguel (rc.34 playtest): "absurdly complex — too many choices, no
 * hierarchy". The screen reads top-down:
 *  1. the current plan HERO — its objective icon, who set it, the cycle's
 *     progress ring and days left, the expected gain, the coach;
 *  2. who sets it (the hired coach, else the preset: Easy auto, Normal
 *     recommended, Hard you) and Adjust → the three-choice picker
 *     (objective · intensity · scrims) with its expected result;
 *  3. the squad's growth (the next point, the peak);
 *  4. past cycles (the results, visual), recent scrims, what the attributes do.
 * Every number comes from the engine or balance.ts — never inline math.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_TRAINING } from "@/config/balance";
import { statEffectsFor } from "@/engine/statEffects";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { clamp, cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import { coachTrainingProfileOf, playerEffectOf, projectTrainingPackage, trainingBlockOf, trainingOf } from "@/store/careerTraining";
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
  ExpectedResult,
  OBJECTIVE_TONE,
  ObjectiveIcon,
  PackageChips,
  PeriodReport,
  PlanPicker,
} from "@/components/career/training/TrainingPackageParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertIcon, StarIcon, SwordsIcon, WhistleIcon } from "@/components/ui/icons";
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
  const setTrainingRepeat = useCareerStore((s) => s.setTrainingRepeat);
  const [editing, setEditing] = useState(false);

  const block = useMemo(() => (save ? trainingBlockOf(save) : null), [save]);
  const projection = useMemo(
    () => (save && save.phase === "running" ? projectTrainingPackage(save, trainingOf(save).plan?.package ?? null) : null),
    [save],
  );

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
  const plan = training.plan;
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
  const entries = Object.values(plan?.players ?? {});
  const gainedAvg = entries.length > 0 ? entries.reduce((s, e) => s + e.sessions + e.scrims + e.seriesGain, 0) / entries.length : 0;
  const seasonScrims = save.scrimLog.filter((e) => e.seasonIndex === save.clock.seasonIndex);
  const controllerLine = block.controller === "coach" && coachProfile ? Y.controllerCoach(coachProfile.name) : Y.controller[block.controller];
  const coachPct = block.coach?.effectPct ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle kicker={C.meta.title} title={C.training.title} right={<Badge tone="neutral">{formatDateShort(D, clock.date)}</Badge>} />

      <ErrorBanner />

      {/* 1 — the current plan: the hero */}
      <Panel glow={pkg ? "blue" : undefined} className="rise-in overflow-hidden p-0">
        <div className={cx("flex items-center gap-3 border-b border-line px-4 py-3", tone.bg)}>
          <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-black/25", tone.ring, tone.text)}>
            <ObjectiveIcon objective={objective} className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="kicker text-[10px]">
              {Y.cycleOf(block.period.index + 1, block.period.count)} · {Y.running}
            </p>
            <p className={cx("display truncate text-xl font-bold", objective ? tone.text : "text-ink")}>
              {objective ? Y.objectives[objective] : Y.by.base}
            </p>
            <p className="truncate text-[11px] text-sub">{Y.by[block.author] ?? ""}</p>
          </div>
          <CycleRing progress={block.progress} daysLeft={block.period.daysLeft} label={Y.daysLeft(block.period.daysLeft)} />
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-faint">
              {Y.dayOf(block.period.dayOf, block.period.length)} · {Y.daysLeft(block.period.daysLeft)} · {Y.endsOn(endDate)}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", sessionToday ? "bg-cyan/10 text-cyan" : "bg-white/5 text-faint")}>
                <span className={cx("h-1.5 w-1.5 rounded-full", sessionToday ? "animate-pulse bg-cyan" : "bg-white/20")} aria-hidden />
                {sessionToday && matchPrepWeek ? C.training.matchPrepWeek : sessionToday ? C.training.sessionToday : C.training.noSessionToday}
              </span>
              {trainingWeek ? (
                <span className="rounded-full bg-good/10 px-2 py-0.5 font-semibold text-good">
                  +{trainingWeekPct}% · {C.hub.trainingWeek}
                </span>
              ) : null}
            </span>
          </div>
          <PackageChips pkg={pkg} C={C} />
          {!pkg ? <p className="text-xs text-sub">{Y.baseLine}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-black/20 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-faint">{Y.progress}</p>
              <p className="display text-lg font-bold text-ink">{Y.gained(gainedAvg.toFixed(2))}</p>
              {pkg && pkg.scrimsPerWeek > 0 ? (
                <p className="flex items-center gap-1 text-[10px] text-sub">
                  <SwordsIcon className="h-3 w-3" />
                  {Y.scrimsDone(block.scrims.done, block.scrims.planned)}
                  {block.scrims.done > 0 ? ` · ${Y.record(block.scrims.won, block.scrims.lost)}` : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-good/30 bg-good/[0.06] px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-good">{Y.expected}</p>
              <p className="display text-lg font-bold text-good">{Y.expectedGain((projection?.startersAvg ?? 0).toFixed(2))}</p>
              <p className={cx("flex items-center gap-1 text-[10px]", block.unavailabilityPts > 0 ? "text-orange-bright" : "text-faint")}>
                <AlertIcon className="h-3 w-3" />
                {block.unavailabilityPts > 0 ? Y.risk(block.unavailabilityPts.toFixed(1)) : Y.noRisk}
              </p>
            </div>
          </div>

          {coachProfile ? (
            <p className="flex items-center gap-2 text-[11px] font-semibold text-cyan">
              <WhistleIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                {coachProfile.name}
                {coachPct > 0 ? ` · ${Y.coachBoost(coachPct)}` : ""}
              </span>
            </p>
          ) : (
            <AppLink href="/career/market#coaches" className="inline-flex min-h-11 items-center gap-2 text-[11px] font-semibold text-orange-bright hover:underline">
              <WhistleIcon className="h-4 w-4 shrink-0" />
              {Y.noCoach} · {Y.hireCoach} →
            </AppLink>
          )}
        </div>
      </Panel>

      {/* 2 — who sets it, and the picker */}
      <Panel strong={editing} className="rise-in p-4" style={{ animationDelay: "40ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-start gap-2 text-xs text-sub">
            {block.controller === "coach" ? (
              <WhistleIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
            ) : (
              <StarIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" filled={block.controller !== "manual"} />
            )}
            <span className="min-w-0">{controllerLine}</span>
          </p>
          {running && !editing ? (
            <Button variant="secondary" size="md" className="min-h-11" onClick={() => setEditing(true)}>
              {Y.adjust}
            </Button>
          ) : null}
        </div>
        {editing && running ? (
          <div className="mt-4">
            <PlanPicker
              save={save}
              C={C}
              initial={pkg ?? training.userPackage ?? null}
              onApply={(p) => {
                setTrainingPackage(p);
                setEditing(false);
              }}
              onBase={() => {
                setTrainingPackage(null);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : null}
        {!editing && projection && projection.players.length > 0 ? (
          <div className="mt-3">
            <ExpectedResult C={C} avg={projection.startersAvg} players={projection.players} risk={projection.unavailabilityPts} />
          </div>
        ) : null}
        {block.controller === "recommend" || block.controller === "manual" ? (
          <div className="mt-3">
            <Toggle checked={training.repeat} onChange={setTrainingRepeat} label={Y.keepPlan} hint={Y.keepPlanHint} />
          </div>
        ) : null}
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

      {/* 4 — past cycles */}
      <Panel className="rise-in p-4" style={{ animationDelay: "200ms" }}>
        <p className="kicker mb-2 text-[10px]">{Y.history}</p>
        {training.history.length === 0 ? (
          <p className="text-xs text-faint">{Y.historyEmpty}</p>
        ) : (
          <div className="space-y-2">
            {training.history.slice(0, 8).map((h, i) => (
              <PeriodReport key={`${h.seasonIndex}:${h.periodIndex}`} summary={h} C={C} statLabels={t.STAT_LABELS} open={i === 0} />
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
// A squad player's growth — the next point and the peak (no per-card controls)
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
            {eta.atPotential ? (eta.splitCapped ? C.training.etaAtPotential : C.training.etaAtPeak) : C.training.nextPoint(Math.floor(p.overall) + 1)}
          </span>
          <span className={cx("font-semibold", eta.daysToNext !== null ? "text-good" : "text-faint")}>
            {eta.atPotential ? "" : eta.daysToNext !== null ? C.training.etaDays(eta.daysToNext) : C.training.etaNone}
          </span>
        </div>
        <ProgressBar value={eta.progress} tone={eta.daysToNext !== null ? "good" : "blue"} className="mt-1.5 h-1.5" label={C.training.growth} />
        <p className="mt-1 text-[10px] text-faint">
          {C.training.perWeekOverall(proj.weeklyOverall.toFixed(2))}
          {offsets.map(([k, v]) => ` · ${C.training.perWeekOffset(v.toFixed(2), statLabels[k] ?? k)}`).join("")}
          {" · "}
          {eta.splitCapped
            ? C.training.capLine(p.gainedThisSplit.toFixed(1), CAREER_TRAINING.maxSplitGain, p.gainedThisSeason.toFixed(1), CAREER_TRAINING.maxSeasonGain)
            : C.training.capLineSeason(p.gainedThisSeason.toFixed(1), CAREER_DEV.seasonGainHardCap)}
        </p>
        {weeklyDecline > 0 ? <p className="mt-0.5 text-[10px] text-bad">{C.training.declineLine(weeklyDecline.toFixed(2))}</p> : null}
      </div>
    </Panel>
  );
}
