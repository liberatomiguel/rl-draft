"use client";

/**
 * Road to Worlds — Training (rc.34, DEV-03: a package per period).
 *
 * One training decision per period, none per week (TRAINING-CONTRACT §2):
 *  1. today's status (session, match prep at half load, rest);
 *  2. a waiting proposal from the coach ("the coach proposes") — approve,
 *     adjust or keep the base; the clock holds until answered;
 *  3. the period's plan: which period, the days left, the package (or the
 *     base), who set it, the coach's effect, the wear and absence risk, and
 *     what the period has paid so far — with Adjust / Keep the base;
 *  4. who decides (the coach runs it / proposes / I set it) and "repeat";
 *  5. the package builder with its projection from the engine that runs it;
 *  6. the squad's growth (the next point, the peak) — no per-card controls;
 *  7. the period reports (T7) and the recent scrims;
 *  8. what the attributes do.
 * Every number comes from the engine or balance.ts — never inline math.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useState } from "react";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_TRAINING } from "@/config/balance";
import { statEffectsFor } from "@/engine/statEffects";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { CareerSave, SquadPlayer, TrainingMode } from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { clamp, cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import {
  coachTrainingProfileOf,
  playerEffectOf,
  trainingBlockOf,
  trainingDecisionOf,
  trainingOf,
} from "@/store/careerTraining";
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
  PackageBuilder,
  PackageChips,
  PeriodReport,
  TrainingProposalCard,
} from "@/components/career/training/TrainingPackageParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Toggle } from "@/components/ui/Toggle";

const PHASE_TONE = { growing: "good", prime: "blue", declining: "neutral", unknown: "neutral" } as const;
const MODES: TrainingMode[] = ["coach", "approve", "manual"];

export function TrainingScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = useCareerCopy();
  const setTrainingPackage = useCareerStore((s) => s.setTrainingPackage);
  const setTrainingMode = useCareerStore((s) => s.setTrainingMode);
  const setTrainingRepeat = useCareerStore((s) => s.setTrainingRepeat);
  const approveTrainingProposal = useCareerStore((s) => s.approveTrainingProposal);
  const keepBaseTraining = useCareerStore((s) => s.keepBaseTraining);
  /** The builder is open (null) or closed; `editFrom` seeds it (a proposal or the running package). */
  const [editing, setEditing] = useState(false);
  const [editFrom, setEditFrom] = useState<"plan" | "proposal">("plan");

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        <div className="h-10 w-52 animate-pulse rounded-lg bg-white/5" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  const D = C.dates;
  const P = C.training.plan;
  const clock = clockLabel(save);
  const block = trainingBlockOf(save);
  const training = trainingOf(save);
  const decision = trainingDecisionOf(save);
  const plan = training.plan;
  const coachProfile = coachTrainingProfileOf(save.coach);
  const running = save.phase === "running";

  // Engine truth: Mon–Fri sessions; a committed week trains at half load.
  const matchPrepWeek = save.pendingEventDef !== null;
  const trainingWeek = !matchPrepWeek && (clock.kind === "open" || clock.kind === "preseason");
  const trainingWeekPct = Math.round(CAREER_CALENDAR.trainingWeekBonus * 100);
  const sessionToday = running && clock.dow <= CAREER_TRAINING.trainingDaysPerWeek;
  const gearPct = Math.round(gearTrainingBonus(save.finances.gear) * 100);

  const teamNow = userTeamPreview(save);
  const effects = statEffectsFor(teamNow.stats);

  const endDate = formatDateTiny(D, dateOfDay(save.clock.seasonIndex, block.period.endDay));
  const soFar = Object.values(plan?.players ?? {}).reduce(
    (s, e) => ({ sessions: s.sessions + e.sessions, scrims: s.scrims + e.scrims, series: s.series + e.seriesGain }),
    { sessions: 0, scrims: 0, series: 0 },
  );
  const n = Math.max(1, Object.keys(plan?.players ?? {}).length);
  const seasonScrims = save.scrimLog.filter((e) => e.seasonIndex === save.clock.seasonIndex);

  const openBuilder = (from: "plan" | "proposal") => {
    setEditFrom(from);
    setEditing(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.training.title}
        right={<Badge tone="neutral">{formatDateShort(D, clock.date)}</Badge>}
      />

      <ErrorBanner />

      {/* 1 — today's status */}
      <div className="rise-in flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-[11px]">
        <span className={cx("inline-flex items-center gap-1.5 font-semibold", sessionToday ? "text-cyan" : "text-faint")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", sessionToday ? "animate-pulse bg-cyan" : "bg-white/15")} aria-hidden />
          {sessionToday && matchPrepWeek ? C.training.matchPrepWeek : sessionToday ? C.training.sessionToday : C.training.noSessionToday}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {trainingWeek ? (
            <span className="rounded-full border border-good/40 bg-good/10 px-2.5 py-0.5 font-semibold text-good">
              +{trainingWeekPct}% · {C.hub.trainingWeek}
            </span>
          ) : null}
          <AppLink href="/career/finances" className="text-faint underline-offset-4 hover:text-ink hover:underline">
            {C.training.facilityEffect(gearPct)}
          </AppLink>
        </span>
      </div>

      {/* 2 — the coach's proposal waiting for an answer */}
      {decision && !editing ? (
        <div className="rise-in">
          <TrainingProposalCard
            save={save}
            decision={decision}
            C={C}
            onApprove={approveTrainingProposal}
            onAdjust={() => openBuilder("proposal")}
            onKeepBase={keepBaseTraining}
          />
        </div>
      ) : null}

      {/* 3 — the period's plan */}
      <Panel glow={plan?.package ? "blue" : undefined} className="rise-in p-4" style={{ animationDelay: "30ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="kicker mb-0.5 text-[10px]">{P.title}</p>
            <p className="display text-lg font-bold text-ink">{P.periodOf(block.period.index + 1, block.period.count)}</p>
            <p className="text-[11px] text-faint">
              {P.dayOf(block.period.dayOf, block.period.length)} · {P.daysLeft(block.period.daysLeft)} · {endDate}
            </p>
          </div>
          <Badge tone={plan?.package ? "blue" : "neutral"}>{P.by[block.author]}</Badge>
        </div>
        <ProgressBar value={clamp(block.period.dayOf / block.period.length, 0, 1)} tone="blue" className="mt-2.5 h-1.5" label={P.title} />
        <PackageChips pkg={block.package} C={C} className="mt-3" />
        {!block.package ? <p className="mt-2 text-xs text-sub">{P.baseHint}</p> : null}
        <div className="mt-2.5 space-y-1 text-[11px]">
          {coachProfile ? (
            <p className="font-semibold text-cyan">
              {P.coachLine(coachProfile.name, block.coach?.effectPct ?? 0)}
              {block.mode === "coach" && block.author === "coach" ? (
                <span className="ml-1.5 font-normal text-faint">· {P.planQuality(Math.round(coachProfile.planQuality * 100))}</span>
              ) : null}
            </p>
          ) : (
            <AppLink href="/career/market#coaches" className="inline-flex min-h-11 items-center font-semibold text-orange-bright hover:underline">
              {P.coachless} →
            </AppLink>
          )}
          {block.package && block.package.scrimsPerWeek > 0 ? (
            <p className="text-sub">
              {C.hub.trainingScrims(block.scrims.done, block.scrims.planned, block.scrims.level ? P.levels[block.scrims.level] : "")}
              {block.scrims.done > 0 ? ` · ${P.scrimRecord(block.scrims.won, block.scrims.lost)}` : ""}
            </p>
          ) : null}
          <p className={cx(block.unavailabilityPts > 0 ? "text-orange-bright" : "text-faint")}>
            {block.unavailabilityPts > 0 ? C.hub.trainingRisk(block.unavailabilityPts.toFixed(1)) : P.noWear}
          </p>
          {plan ? (
            <p className="text-faint">
              {P.progress}: {P.soFar((soFar.sessions / n).toFixed(2), (soFar.scrims / n).toFixed(2), (soFar.series / n).toFixed(2))}
            </p>
          ) : null}
        </div>
        {running && !editing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="md" className="min-h-11" onClick={() => openBuilder("plan")}>
              {P.edit}
            </Button>
            {block.package ? (
              <Button variant="ghost" size="md" className="min-h-11" onClick={() => setTrainingPackage(null)}>
                {P.keepBase}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {/* 5 — the builder (adjust / set) */}
      {editing && running ? (
        <Panel strong className="rise-in p-4">
          <PackageBuilder
            save={save}
            C={C}
            statLabels={t.STAT_LABELS}
            initial={editFrom === "proposal" && decision ? decision.proposal : (plan?.package ?? training.userPackage ?? null)}
            onApply={(pkg) => {
              setTrainingPackage(pkg);
              setEditing(false);
            }}
            onKeepBase={() => {
              if (decision) keepBaseTraining();
              else setTrainingPackage(null);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Panel>
      ) : null}

      {/* 4 — who decides */}
      <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
        <p className="kicker mb-1.5 text-[10px]">{P.mode}</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={P.mode}>
          {MODES.map((m) => {
            const selected = training.mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTrainingMode(m)}
                className={cx(
                  "flex min-h-11 flex-col justify-center rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                  selected ? "border-blue/60 bg-blue/15" : "border-line bg-white/[0.03] hover:border-line-strong",
                )}
              >
                <span className={cx("display text-[11px] font-bold uppercase tracking-[0.08em]", selected ? "text-blue-bright" : "text-ink")}>
                  {P.modes[m]}
                </span>
                <span className="mt-0.5 text-[10px] leading-snug text-faint">{P.modeHint[m]}</span>
              </button>
            );
          })}
        </div>
        {!save.coach ? <p className="mt-2 text-[11px] text-orange-bright">{P.noCoachMode}</p> : null}
        <div className="mt-3">
          <Toggle checked={training.repeat} onChange={setTrainingRepeat} label={P.repeat} hint={P.repeatHint} />
        </div>
      </Panel>

      {/* 6 — the squad's growth */}
      <div>
        <p className="kicker mb-2 text-[10px]">{P.squadGrowth}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {save.squad.map((p, i) => (
            <GrowthCard key={p.id} save={save} p={p} C={C} statLabels={t.STAT_LABELS} style={{ animationDelay: `${80 + i * 40}ms` }} />
          ))}
        </div>
      </div>

      {/* 7 — period reports */}
      <Panel className="rise-in p-4" style={{ animationDelay: "200ms" }}>
        <p className="kicker mb-2 text-[10px]">{P.history}</p>
        {training.history.length === 0 ? (
          <p className="text-xs text-faint">{P.historyEmpty}</p>
        ) : (
          <div className="space-y-2">
            {training.history.slice(0, 8).map((h, i) => (
              <PeriodReport key={`${h.seasonIndex}:${h.periodIndex}`} summary={h} C={C} statLabels={t.STAT_LABELS} open={i === 0} />
            ))}
          </div>
        )}
      </Panel>

      {/* 7b — recent scrims (the package's and any booked earlier) */}
      <Panel className="rise-in p-4" style={{ animationDelay: "220ms" }}>
        <p className="kicker mb-1.5 text-[10px]">{C.scrim.results}</p>
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
                {e.level ? <Badge tone="neutral">{P.levels[e.level]}</Badge> : null}
                <span className="ml-auto shrink-0 text-[10px] text-faint">{formatDateTiny(D, dateOfDay(e.seasonIndex, e.day))}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 8 — what the attributes do */}
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
            : C.training.capLineSeason(p.gainedThisSeason.toFixed(1), CAREER_DEV.seasonGainCap)}
        </p>
        {weeklyDecline > 0 ? <p className="mt-0.5 text-[10px] text-bad">{C.training.declineLine(weeklyDecline.toFixed(2))}</p> : null}
      </div>
    </Panel>
  );
}
