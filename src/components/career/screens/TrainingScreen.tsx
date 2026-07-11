"use client";

/**
 * Road to Worlds — Training (v0.2 rebuild).
 *
 * The screen that finally makes training LEGIBLE: a Mon-Sun rhythm strip for
 * the day clock (session dots, matchday, rest, +25% training-week chip), a
 * coach/gear effects row, the delegate toggle, and per-player training cards
 * where every focus and intensity option previews its TRUTHFUL engine
 * projection on hover/tap (squadTrainingProjection — no UI math). Balanced is
 * pure overall; single-attribute focus trades overall share for a real
 * attribute offset; auto is the coach's near-optimal plan. The daily scrim
 * block lives here too (opponent, remaining blocks, latest result).
 *
 * All numbers render from CAREER_TRAINING/CAREER_CALENDAR/CAREER_SCRIM
 * constants or the engine projection — never inline literals.
 */

import Link from "next/link";
import { useState } from "react";
import { CAREER_CALENDAR, CAREER_SCRIM, CAREER_TRAINING } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/copy.career.en";
import type {
  CareerSave,
  SquadPlayer,
  TrainingFocus,
  TrainingIntensity,
} from "@/engine/career/types";
import type { StatKey } from "@/engine/types";
import { clamp, cx } from "@/lib/util";
import { scrimProjection, scrimShortlistFor } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import {
  DAYS_PER_SEASON,
  agePhase,
  agendaDays,
  clockLabel,
  dateOfDay,
  dayOfWeekOf,
  gearTrainingBonus,
  nameOfRef,
  potBandOfSquad,
  scrimAvailability,
  squadAge,
  squadTrainingProjection,
  useCareerSave,
} from "@/components/career/careerUi";
import { formatDateShort, formatDateTiny } from "@/components/career/dateText";
import { ErrorBanner } from "@/components/career/hub/hubShared";
import { TeamStars } from "@/components/career/TeamStars";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Toggle } from "@/components/ui/Toggle";

const STAT_KEYS: StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

const INTENSITIES: TrainingIntensity[] = ["light", "normal", "heavy"];

const PHASE_TONE = { growing: "good", prime: "blue", declining: "neutral" } as const;

/** "0.08" — projections are round2 from the engine; render both decimals. */
const fmt2 = (n: number): string => n.toFixed(2);

export function TrainingScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = t.CAREER;
  const setAutoTrain = useCareerStore((s) => s.setAutoTrain);
  const setTrainingFocus = useCareerStore((s) => s.setTrainingFocus);
  const setTrainingIntensity = useCareerStore((s) => s.setTrainingIntensity);
  const runScrim = useCareerStore((s) => s.runScrim);
  const scheduleScrim = useCareerStore((s) => s.scheduleScrim);
  const cancelScrim = useCareerStore((s) => s.cancelScrim);
  const advanceDay = useCareerStore((s) => s.advanceDay);
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);

  /** v0.3 sparring — chosen opponent (null = closest) + booking day. */
  const [oppRef, setOppRef] = useState<string | null>(null);
  const [bookDay, setBookDay] = useState<number | null>(null);

  if (!mounted || !save) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4" aria-busy>
        <div className="h-10 w-52 animate-pulse rounded-lg bg-white/5" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-9 animate-pulse rounded-2xl bg-white/5" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  const D = C.dates;
  const clock = clockLabel(save);
  const today = save.clock.day;
  const monday = today - (dayOfWeekOf(today) - 1);
  const weekDays = agendaDays(save, monday, 7);

  // Engine truth (careerFlow daily tick): training only runs Mon-Fri on weeks
  // WITHOUT a committed user event; open/preseason weeks add the +25% bonus.
  const matchPrepWeek = save.pendingEventDef !== null;
  const trainingWeek = !matchPrepWeek && (clock.kind === "open" || clock.kind === "preseason");
  const trainingWeekPct = Math.round(CAREER_CALENDAR.trainingWeekBonus * 100);
  const sessionToday =
    save.phase === "running" &&
    !matchPrepWeek &&
    clock.dow <= CAREER_TRAINING.trainingDaysPerWeek;

  // --- effects row ----------------------------------------------------------
  const cm = CAREER_TRAINING.coachMult;
  const coachMult = save.coach
    ? clamp(1 + (save.coach.overall - 75) * cm.perPoint, cm.min, cm.max)
    : null;
  const coachEffectPct = coachMult !== null ? Math.round((coachMult - 1) * 100) : null;
  const gearPct = Math.round(gearTrainingBonus(save.finances.gear) * 100);

  const canDelegate = Boolean(save.coach);
  const effectiveAuto = save.prefs.autoTrain && canDelegate;

  const focusOptions: { key: TrainingFocus; label: string }[] = [
    ...(canDelegate ? [{ key: "auto" as TrainingFocus, label: C.training.auto }] : []),
    { key: "balanced" as TrainingFocus, label: C.training.balanced },
    ...STAT_KEYS.map((k) => ({ key: k as TrainingFocus, label: t.STAT_LABELS[k] })),
  ];

  // --- scrim block (v0.3 sparring partners) ----------------------------------
  const scrim = scrimAvailability(save);
  const scrimReasonText =
    scrim.reason === "used"
      ? C.scrim.usedUp
      : scrim.reason === "restDay"
        ? C.scrim.restDay
        : C.hub.scrimUnavailable;

  const shortlist = scrimShortlistFor(save);
  const selectedOpp =
    (oppRef ? shortlist.find((c) => c.ref === oppRef) : null) ?? shortlist[0] ?? null;
  const benefit = selectedOpp ? scrimProjection(save, selectedOpp.ref) : null;

  // Bookable days: the next free weekdays inside the scheduling horizon.
  const bookableDays: number[] = [];
  for (
    let d = today + 1;
    d <= Math.min(DAYS_PER_SEASON, today + CAREER_SCRIM.scheduleHorizonDays);
    d++
  ) {
    if (dayOfWeekOf(d) > CAREER_TRAINING.trainingDaysPerWeek) continue;
    bookableDays.push(d);
  }
  const selectedBookDay =
    bookDay !== null && bookableDays.includes(bookDay) ? bookDay : (bookableDays[0] ?? null);

  const seasonScrims = save.scrimLog.filter((e) => e.seasonIndex === save.clock.seasonIndex);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle
        kicker={C.meta.title}
        title={C.training.title}
        right={<Badge tone="neutral">{formatDateShort(D, clock.date)}</Badge>}
      />

      <ErrorBanner />

      {/* ==================== 1 — week rhythm strip ==================== */}
      <Panel strong className="rise-in p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="kicker text-[10px]">{C.training.weeklyPlan}</p>
          {trainingWeek ? (
            <span className="rounded-full border border-good/40 bg-good/10 px-2.5 py-0.5 text-[11px] font-semibold text-good">
              +{trainingWeekPct}% · {C.hub.trainingWeek}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {weekDays.map((d) => {
            const isSession =
              d.dow <= CAREER_TRAINING.trainingDaysPerWeek && !matchPrepWeek;
            const isMatch = d.dow === 6 && matchPrepWeek;
            const isRest = d.dow === 7;
            return (
              <div
                key={d.day}
                title={
                  isMatch
                    ? save.pendingEventDef?.name
                    : isSession
                      ? C.calendar.trainingDay
                      : isRest
                        ? C.calendar.restDay
                        : undefined
                }
                className={cx(
                  "flex flex-col items-center gap-0.5 rounded-lg border py-1.5",
                  isMatch ? "border-orange/50 bg-orange/10" : "border-line bg-white/[0.03]",
                  d.isToday && "ring-2 ring-orange",
                  d.isPast && "opacity-40",
                )}
              >
                <span className="kicker text-[8px] leading-none sm:text-[9px]">
                  {D.weekdays[d.dow - 1]}
                </span>
                <span
                  className={cx(
                    "display text-sm font-bold leading-none",
                    isMatch ? "text-orange-bright" : "text-ink",
                  )}
                >
                  {d.date.d}
                </span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                  {isSession ? <span className="h-1.5 w-1.5 rounded-full bg-cyan/80" /> : null}
                  {isMatch ? <span className="h-1.5 w-1.5 rounded-full bg-orange" /> : null}
                  {isRest ? <span className="h-px w-2 bg-white/20" /> : null}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 font-semibold",
              sessionToday ? "text-cyan" : "text-faint",
            )}
          >
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                sessionToday ? "animate-pulse bg-cyan" : "bg-white/15",
              )}
              aria-hidden
            />
            {sessionToday ? C.training.sessionToday : C.training.noSessionToday}
          </span>
          <span className="text-faint">{C.training.weeklyPlanHint}</span>
        </div>
      </Panel>

      {/* ==================== 2 — effects row ==================== */}
      <div className="rise-in flex flex-wrap items-center gap-2 text-xs" style={{ animationDelay: "40ms" }}>
        {save.coach && coachEffectPct !== null ? (
          <span className="rounded-full border border-blue/40 bg-blue/10 px-3 py-1 font-semibold text-cyan">
            {C.training.coachEffect(save.coach.name, coachEffectPct)}
          </span>
        ) : (
          <Link
            href="/career/market"
            className="rounded-full border border-orange/40 bg-orange/10 px-3 py-1 font-semibold text-orange-bright transition-colors hover:bg-orange/20"
          >
            {C.training.noCoach}
          </Link>
        )}
        <Link
          href="/career/finances"
          className="rounded-full border border-line-strong bg-white/5 px-3 py-1 font-semibold text-sub transition-colors hover:text-ink"
        >
          {C.training.facilityEffect(gearPct)}
        </Link>
      </div>

      {/* ==================== 3 — delegate toggle ==================== */}
      {canDelegate ? (
        <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
          <Toggle
            checked={save.prefs.autoTrain}
            onChange={setAutoTrain}
            label={C.training.autoTrain}
            hint={C.training.autoTrainDesc}
          />
        </Panel>
      ) : null}

      {/* ==================== 4 — per-player training cards ==================== */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {save.squad.map((p, i) => (
          <TrainingCard
            key={p.id}
            save={save}
            p={p}
            C={C}
            statLabels={t.STAT_LABELS}
            focusOptions={focusOptions}
            delegated={effectiveAuto}
            onFocus={(f) => setTrainingFocus(p.id, f)}
            onIntensity={(v) => setTrainingIntensity(p.id, v)}
            onTakeOver={() => setAutoTrain(false)}
            style={{ animationDelay: `${80 + i * 40}ms` }}
          />
        ))}
      </div>

      {/* ============ 5 — sparring partners (v0.3 scrims) ============ */}
      <Panel
        glow={scrim.available ? "orange" : undefined}
        className="rise-in p-4"
        style={{ animationDelay: "240ms" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="kicker mb-1 text-[10px]">{C.scrim.planTitle}</p>
            <p className="max-w-md text-xs text-sub">{C.scrim.planDesc}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1.5" title={C.hub.scrimsLeft(scrim.remaining)}>
              {Array.from({ length: CAREER_SCRIM.maxPerWeek }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    "h-2 w-6 rounded-full",
                    i < scrim.remaining ? "bg-orange" : "bg-white/10",
                  )}
                  aria-hidden
                />
              ))}
            </div>
            <span className="text-[10px] text-faint">{C.hub.scrimsLeft(scrim.remaining)}</span>
          </div>
        </div>

        {/* opponent shortlist */}
        <div className="mt-3">
          <p className="kicker mb-1.5 text-[10px]">{C.scrim.chooseOpponent}</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {shortlist.map((c) => {
              const selected = selectedOpp?.ref === c.ref;
              return (
                <button
                  key={c.ref}
                  type="button"
                  onClick={() => setOppRef(c.ref)}
                  aria-pressed={selected}
                  className={cx(
                    "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                    selected
                      ? "border-orange/60 bg-orange/10"
                      : "border-line bg-white/[0.03] hover:border-line-strong",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink">{c.name}</span>
                    <TeamStars stars={c.stars} size="xs" />
                  </span>
                  <span
                    className={cx(
                      "shrink-0 font-mono text-[11px] font-bold",
                      c.gap > 0 ? "text-orange-bright" : "text-faint",
                    )}
                    title={C.scrim.strongerSide}
                  >
                    {c.gap > 0 ? `+${c.gap}` : c.gap}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* benefit preview + actions */}
        {selectedOpp && benefit ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-black/20 px-3 py-2">
            <div className="min-w-0">
              <p className="kicker text-[9px]">{C.scrim.benefit}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold">
                <span className="text-good">{C.scrim.projGain(fmt2(benefit.avgOverallGain))}</span>
                <span className="text-cyan">{C.scrim.projChem}</span>
                <span className="text-faint">{C.scrim.strongerSide}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                disabled={!scrim.available}
                title={scrim.available ? undefined : scrimReasonText}
                onClick={() => runScrim(selectedOpp.ref)}
              >
                {C.scrim.run}
              </Button>
              {selectedBookDay !== null ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => scheduleScrim(selectedBookDay, selectedOpp.ref)}
                >
                  {C.scrim.bookCta}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* booking day picker */}
        {bookableDays.length > 0 ? (
          <div className="mt-2.5">
            <p className="kicker mb-1.5 text-[10px]">{C.scrim.pickDay}</p>
            <div className="flex flex-wrap gap-1.5">
              {bookableDays.slice(0, 8).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setBookDay(d)}
                  aria-pressed={selectedBookDay === d}
                  className={cx(
                    "min-h-9 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                    selectedBookDay === d
                      ? "border-blue/60 bg-blue/10 text-blue-bright"
                      : "border-line bg-white/[0.03] text-sub hover:border-line-strong",
                  )}
                >
                  {formatDateTiny(D, dateOfDay(save.clock.seasonIndex, d))}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* booked scrims */}
        {save.scheduledScrims.length > 0 ? (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="kicker mb-1.5 text-[10px]">{C.scrim.upcoming}</p>
            <ul className="space-y-1">
              {save.scheduledScrims.map((s) => (
                <li
                  key={`${s.day}:${s.oppRef}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate font-semibold text-sub">
                    {C.scrim.booked(
                      formatDateTiny(D, dateOfDay(save.clock.seasonIndex, s.day)),
                      nameOfRef(save, s.oppRef),
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => cancelScrim(s.day)}>
                    {C.scrim.cancel}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* recent results — game-by-game */}
        <div className="mt-3 border-t border-line pt-2.5">
          <p className="kicker mb-1.5 text-[10px]">{C.scrim.results}</p>
          {seasonScrims.length === 0 ? (
            <p className="text-xs text-faint">{C.scrim.noResults}</p>
          ) : (
            <ul className="space-y-1.5">
              {seasonScrims.slice(0, 6).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cx(
                      "h-2 w-2 shrink-0 rounded-full",
                      e.won ? "bg-good" : "bg-bad",
                    )}
                    aria-hidden
                  />
                  <span className={cx("font-semibold", e.won ? "text-good" : "text-bad")}>
                    {e.won
                      ? C.scrim.won(e.oppName, e.scoreA, e.scoreB)
                      : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}
                  </span>
                  <span className="flex flex-wrap gap-1" aria-label={C.scrim.gameLine(e.games.join(" · "))}>
                    {e.games.map((g, i) => (
                      <span
                        key={i}
                        className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-sub"
                      >
                        {g}
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-faint">
                    {formatDateTiny(D, dateOfDay(e.seasonIndex, e.day))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* ==================== 6 — footer hint ==================== */}
      <p className="rise-in text-center text-[11px] text-faint" style={{ animationDelay: "280ms" }}>
        {C.training.matchXpHint}
      </p>

      {/* ==================== 7 — advance footer (v0.3) ==================== */}
      <Panel strong className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 p-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={save.phase !== "running"}
          onClick={advanceDay}
        >
          {C.calendar.advanceDay}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={save.phase !== "running"}
          onClick={advanceToNextStop}
        >
          {C.hub.continue}
        </Button>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-player training card — every option previews its TRUTHFUL projection
// ---------------------------------------------------------------------------

function TrainingCard({
  save,
  p,
  C,
  statLabels,
  focusOptions,
  delegated,
  onFocus,
  onIntensity,
  onTakeOver,
  style,
}: {
  save: CareerSave;
  p: SquadPlayer;
  C: CareerCopy;
  statLabels: Record<string, string>;
  focusOptions: { key: TrainingFocus; label: string }[];
  delegated: boolean;
  onFocus: (f: TrainingFocus) => void;
  onIntensity: (v: TrainingIntensity) => void;
  onTakeOver: () => void;
  style?: React.CSSProperties;
}) {
  const [hoverFocus, setHoverFocus] = useState<TrainingFocus | null>(null);
  const [hoverIntensity, setHoverIntensity] = useState<TrainingIntensity | null>(null);

  const band = potBandOfSquad(save, p);
  const phase = agePhase(save, p);
  const age = squadAge(save, p);

  /** Engine projection for any focus × intensity combination (pure, cheap). */
  const projFor = (focus: TrainingFocus, intensity: TrainingIntensity) =>
    squadTrainingProjection(save, { ...p, trainingFocus: focus, trainingIntensity: intensity });

  const currentFocus: TrainingFocus = delegated ? "auto" : p.trainingFocus;
  const currentIntensity: TrainingIntensity = p.trainingIntensity ?? "normal";

  const previewFocus = hoverFocus ?? currentFocus;
  const previewIntensity = hoverIntensity ?? currentIntensity;
  const preview = projFor(previewFocus, previewIntensity);
  const previewIsAttr = previewFocus !== "auto" && previewFocus !== "balanced";
  const focusHint =
    previewFocus === "auto"
      ? C.training.focusHintAuto
      : previewFocus === "balanced"
        ? C.training.focusHintBalanced
        : C.training.focusHintAttr;

  const intensityHints: Record<TrainingIntensity, string> = {
    light: C.training.intensityLightHint,
    normal: C.training.intensityNormalHint,
    heavy: C.training.intensityHeavyHint,
  };
  const intensityLabels: Record<TrainingIntensity, string> = {
    light: C.training.intensityLight,
    normal: C.training.intensityNormal,
    heavy: C.training.intensityHeavy,
  };

  const growth = clamp((p.overall - 60) / Math.max(1, band.max - 60), 0, 1);

  return (
    <Panel className="rise-in p-4" style={style}>
      {/* --- header: identity + phase --------------------------------------- */}
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

      {/* --- growth toward potential ----------------------------------------- */}
      <div className="mt-2.5 flex items-center gap-3">
        <ProgressBar value={growth} tone="blue" className="flex-1" label={C.player.growthRoom} />
        <span className="shrink-0 text-[10px] text-faint">
          {C.player.growthRoom} · {C.player.potBand(band.min, band.max)}
        </span>
      </div>

      {/* --- focus ------------------------------------------------------------ */}
      <div className="mt-3.5">
        <p className="kicker mb-1.5 text-[10px]">{C.training.focus}</p>
        {delegated ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue/40 bg-blue/10 px-2.5 py-1 text-[11px] font-semibold text-cyan">
              {C.training.handledByCoach}
            </span>
            <Button size="sm" variant="ghost" onClick={onTakeOver}>
              {C.training.manageMyself}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={C.training.focus}>
            {focusOptions.map((f) => {
              const selected = p.trainingFocus === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onFocus(f.key)}
                  onMouseEnter={() => setHoverFocus(f.key)}
                  onMouseLeave={() => setHoverFocus(null)}
                  onFocus={() => setHoverFocus(f.key)}
                  onBlur={() => setHoverFocus(null)}
                  className={cx(
                    "display min-h-9 rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    selected
                      ? "border-orange/60 bg-orange/15 text-orange-bright"
                      : "border-line bg-white/[0.03] text-sub hover:border-line-strong hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* live projection strip — hovered option, else the selected one */}
        <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-black/20 px-2.5 py-1.5">
          <span className="rounded bg-good/10 px-2 py-0.5 text-[11px] font-semibold text-good">
            {C.training.perWeekOverall(fmt2(preview.weeklyOverall))}
          </span>
          {previewIsAttr ? (
            <span className="rounded bg-blue/10 px-2 py-0.5 text-[11px] font-semibold text-cyan">
              {C.training.perWeekOffset(
                fmt2(preview.weeklyOffset),
                statLabels[previewFocus as StatKey] ?? String(previewFocus),
              )}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-[10px] leading-tight text-faint">{focusHint}</span>
        </div>
      </div>

      {/* --- intensity ---------------------------------------------------------- */}
      <div className="mt-3">
        <p className="kicker mb-1.5 text-[10px]">{C.training.intensity}</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={C.training.intensity}>
          {INTENSITIES.map((v) => {
            const selected = currentIntensity === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onIntensity(v)}
                onMouseEnter={() => setHoverIntensity(v)}
                onMouseLeave={() => setHoverIntensity(null)}
                onFocus={() => setHoverIntensity(v)}
                onBlur={() => setHoverIntensity(null)}
                className={cx(
                  "rounded-lg border px-1 py-1.5 text-center transition-colors",
                  selected
                    ? v === "heavy"
                      ? "border-orange/60 bg-orange/15"
                      : "border-blue/50 bg-blue/10"
                    : "border-line bg-white/[0.03] hover:border-line-strong",
                )}
              >
                <span
                  className={cx(
                    "display block text-[11px] font-bold uppercase tracking-[0.08em]",
                    selected ? (v === "heavy" ? "text-orange-bright" : "text-blue-bright") : "text-sub",
                  )}
                >
                  {intensityLabels[v]}
                </span>
                <span className="mt-0.5 block text-[10px] leading-none text-faint">
                  ×{CAREER_TRAINING.intensityMult[v]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[10px] leading-tight text-faint">
            {intensityHints[previewIntensity]}
          </p>
          {currentIntensity === "heavy" ? (
            <span className="rounded bg-orange/10 px-2 py-0.5 text-[10px] font-semibold text-orange-bright">
              {C.training.fatigueWarning}
            </span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

