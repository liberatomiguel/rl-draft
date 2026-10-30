"use client";

/**
 * Road to Worlds hub — THE SQUAD BLOCK (rc.2; rc.34 ROADMAP UX-01b / UX-06b,
 * HQ-CONTRACT H2, decisions 2-A and 3-A). The squad as compact Draft cards:
 * the Draft's rarity frame by overall (decision 3-A: engine/cards
 * `baseRarityOf`, 70 / 80 / 90 — the GameCard's own `card-frame card-*`
 * classes), the user's crest in the logo slot (2-A), no initials square.
 * Each card reads, at 360 px: the overall, the name, age · trait (archetype,
 * the phase once revealed), growth to the next point, the potential band, the
 * role and the contract (UX-06b: its time left, warning in its final stretch,
 * with the "New" tag until it is opened). A tap opens the player's sheet (and
 * marks his contract seen).
 * rc.35 (front C, Miguel on rc.34): the three starter seats in a row, the
 * reserve seat beside the coach under them (as before rc.34), each card a
 * bit larger with its phase as an icon chip (PhaseChip); no star text.
 * rc.36 (POL-02, Miguel on rc.35): the reserve and the coach thin again, as
 * in rc.33 — one row each under the starters (stacked on a phone, side by
 * side from `sm`): the reserve's OVR in his rarity frame, name, "New", role ·
 * age · trait and the contract chip (a tap opens his sheet); the coach's
 * whistle, name, OVR and training edge (a tap opens Training).
 */

import { useState } from "react";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/careerCopy";
import { baseRarityOf } from "@/engine/cards";
import { careerNewSummary, contractNewKey, contractWarnsFor } from "@/engine/career/careerNew";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, CoachState, SquadPlayer } from "@/engine/career/types";
import type { TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { contractClockOf } from "@/store/careerHq";
import {
  agePhase,
  potBandOfSquad,
  prizeShareLabelOf,
  seasonLabelFor,
  squadAge,
  squadTrainingEta,
  statsOfSquad,
  userStars,
} from "@/components/career/careerUi";
import { PhaseChip } from "@/components/career/PhaseChip";
import { PlayerSheet, type PlayerSheetData } from "@/components/career/PlayerSheet";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
import { AppLink } from "@/components/ui/AppLink";
import { NewTag } from "@/components/ui/NewDot";
import { TrendDownIcon, TrendUpIcon, WhistleIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

/** A player's contract as his card and row print it (UX-06b): the season it runs to, or its time left once it warns. */
function contractLabelOf(save: CareerSave, p: SquadPlayer, C: CareerCopy): { text: string; warns: boolean } {
  const clock = contractClockOf(save, p);
  const warns = contractWarnsFor(save, p);
  const text =
    clock.seasonsAfter > 0
      ? C.hub.cardUntil(seasonLabelFor(p.contractEndSeason))
      : warns
        ? C.hub.cardEndsIn(clock.weeksLeft ?? 0)
        : C.hub.cardFinalSeason;
  return { text, warns };
}

/** The shell of a thin row (rc.36): an icon, then two lines — the name, and the role line with its chip. */
const THIN_ROW =
  "flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors";

/** rc.36: the reserve as one thin row — his OVR in the Draft's rarity frame (3-A); a tap opens his sheet. */
function ReserveRow({
  save,
  p,
  C,
  isNew,
  onOpen,
}: {
  save: CareerSave;
  p: SquadPlayer;
  C: CareerCopy;
  isNew: boolean;
  onOpen: () => void;
}) {
  const ovr = Math.round(p.overall);
  const contract = contractLabelOf(save, p, C);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${p.name} · ${ovr}`}
      className={cx(THIN_ROW, "border-line bg-white/[0.03] hover:border-line-strong")}
    >
      <span
        className={cx("card-frame flex h-10 w-10 shrink-0 items-center justify-center !rounded-lg", `card-${baseRarityOf(ovr)}`)}
        title={C.common.ovr}
      >
        <span className="display relative text-lg font-bold leading-none text-ink">{ovr}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-bold text-ink">{p.name}</span>
          {isNew ? <NewTag className="shrink-0">{C.toolbox.newTag}</NewTag> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-sub">
          <span className="shrink-0">
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-faint">{C.hub.cardReserve}</span> · {squadAge(save, p)}
            {/* The trait from `sm` (a phone keeps the line whole beside the contract chip). */}
            <span className="hidden sm:inline"> · {C.player.archetype[p.archetype]}</span>
          </span>
          <span
            className={cx(
              "min-w-0 truncate rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em]",
              contract.warns ? "bg-orange/20 text-orange-bright" : "bg-white/5 text-faint",
            )}
          >
            {contract.text}
          </span>
        </span>
      </span>
    </button>
  );
}

/** rc.36: the coach as one thin row — the whistle (as Training's block), name and OVR, his training edge; a tap opens Training. */
function CoachRow({ coach, C }: { coach: CoachState; C: CareerCopy }) {
  const pct = coachEffectsFor(coach).trainingPct;
  return (
    <AppLink href="/career/training" className={cx(THIN_ROW, "border-line bg-white/[0.03] hover:border-line-strong")}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
        <WhistleIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{coach.name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-sub">
          <span className="truncate">
            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-faint">{C.hub.squadCoach}</span> ·{" "}
            <span className="display font-bold text-ink">{Math.round(coach.overall)}</span> {C.common.ovr}
          </span>
          <span
            className={cx(
              "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold",
              pct >= 0 ? "border-good/40 bg-good/10 text-good" : "border-bad/40 bg-bad/10 text-bad",
            )}
          >
            {pct >= 0 ? <TrendUpIcon className="h-3 w-3" /> : <TrendDownIcon className="h-3 w-3" />}
            {C.hub.coachTrainingPct(pct)}
          </span>
        </span>
      </span>
    </AppLink>
  );
}

/** rc.36: an empty reserve or coach seat as a thin dashed row with the way to fill it. */
function EmptyRow({ href, icon, text, hint }: { href: string; icon: React.ReactNode; text: string; hint?: string }) {
  return (
    <AppLink href={href} className={cx(THIN_ROW, "border-dashed border-line hover:border-line-strong")}>
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-faint">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[11px] text-faint">{text}</span>
        {hint ? <span className="block truncate text-[11px] font-semibold text-blue-bright">{hint} →</span> : null}
      </span>
    </AppLink>
  );
}

function SquadCard({
  save,
  p,
  C,
  isNew,
  onOpen,
}: {
  save: CareerSave;
  p: SquadPlayer;
  C: CareerCopy;
  isNew: boolean;
  onOpen: () => void;
}) {
  const eta = squadTrainingEta(save, p);
  const phase = agePhase(save, p);
  const band = potBandOfSquad(save, p);
  const ovr = Math.round(p.overall);
  const { text: contract, warns } = contractLabelOf(save, p, C);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${p.name} · ${ovr}`}
      className={cx(
        "card-frame flex min-h-52 min-w-0 flex-col p-3 text-left transition-transform duration-200 hover:-translate-y-0.5",
        `card-${baseRarityOf(ovr)}`,
      )}
    >
      <span className="relative flex items-start justify-between gap-1">
        <span className="display text-4xl font-bold leading-none text-ink" title={C.common.ovr}>
          {ovr}
        </span>
        <UserCrest crestId={save.identity.crestId} colors={save.identity.colors} size="sm" />
      </span>
      <span className="relative mt-2 flex min-w-0 items-center gap-1">
        <span className="truncate text-sm font-bold text-ink sm:text-base">{p.name}</span>
        {isNew ? <NewTag className="shrink-0">{C.toolbox.newTag}</NewTag> : null}
      </span>
      <span className="relative truncate text-[11px] text-sub">
        {squadAge(save, p)} · {C.player.archetype[p.archetype]}
      </span>
      <span className="relative mt-1.5 flex min-w-0">
        <PhaseChip phase={phase} className="max-w-full" />
      </span>
      <span className="relative mt-1.5 block">
        <ProgressBar value={eta.progress} tone={eta.daysToNext ? "good" : "blue"} className="h-1" label={C.training.growth} />
        <span className="mt-0.5 block truncate text-[10px] text-faint">
          {eta.daysToNext ? C.hub.growthNext(eta.daysToNext) : eta.atPotential ? C.training.etaNone : C.hub.growthStalled}
        </span>
      </span>
      <span className="relative mt-1 block truncate text-[11px] font-semibold text-cyan">
        {band.min === band.max ? C.player.potExact(band.max) : C.player.potBand(band.min, band.max)}
      </span>
      <span className="relative mt-auto flex flex-wrap items-center gap-1 pt-1.5">
        <span className="rounded bg-white/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-sub">
          {p.role === "sub" ? C.hub.cardReserve : C.hub.cardStarter}
        </span>
        <span
          className={cx(
            "truncate rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em]",
            warns ? "bg-orange/20 text-orange-bright" : "bg-white/5 text-faint",
          )}
        >
          {contract}
        </span>
      </span>
    </button>
  );
}

function EmptySeat({ C }: { C: CareerCopy }) {
  return (
    <AppLink
      href="/career/market"
      className="card-frame card-hidden flex min-h-52 flex-col items-center justify-center gap-1 p-2.5 text-center"
    >
      <span className="relative text-xs font-bold uppercase tracking-[0.1em] text-sub">{C.hub.cardEmptySeat}</span>
      <span className="relative text-[11px] text-blue-bright">{C.hub.cardSignHint} →</span>
    </AppLink>
  );
}

export function SquadBlock({ save, C, team, chemTiers }: { save: CareerSave; C: CareerCopy; team: TournamentTeam; chemTiers: Record<string, string> }) {
  const t = useCopy();
  const markCareerSeen = useCareerStore((s) => s.markCareerSeen);
  const [sheet, setSheet] = useState<PlayerSheetData | null>(null);
  const starters = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const sub = save.squad.find((p) => !save.starterIds.includes(p.id)) ?? null;
  const coach = save.coach;
  const fresh = careerNewSummary(save).keys;
  // Three starter seats; an empty seat (R67) shows the way to the Market.
  const slots: (SquadPlayer | null)[] = [starters[0] ?? null, starters[1] ?? null, starters[2] ?? null];
  const cardOf = (p: SquadPlayer) => (
    <SquadCard
      key={p.id}
      save={save}
      p={p}
      C={C}
      isNew={fresh.has(contractNewKey(p.id, p.contractEndSeason))}
      onOpen={() => open(p)}
    />
  );

  const open = (p: SquadPlayer) => {
    // UX-06: opening the player is opening his contract — its "New" mark clears.
    markCareerSeen([contractNewKey(p.id, p.contractEndSeason)]);
    setSheet({
      name: p.name,
      overall: p.overall,
      age: squadAge(save, p),
      archetype: p.archetype,
      country: p.country,
      region: p.region,
      band: potBandOfSquad(save, p),
      stats: statsOfSquad(p),
      wage: p.salaryPerSplit,
      contractLabel: seasonLabelFor(p.contractEndSeason),
      shareLabel: prizeShareLabelOf(C, p),
      phase: agePhase(save, p),
      focusLabel:
        p.trainingFocus === "auto" || p.trainingFocus === "balanced" ? C.training[p.trainingFocus] : t.STAT_LABELS[p.trainingFocus],
    });
  };

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.squadTitle}</p>
        <span className="flex items-center gap-2">
          <TeamStars stars={userStars(save)} size="sm" />
          <AppLink href="/career/squad" className="inline-flex min-h-11 items-center text-[11px] font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.hub.squadManage} →
          </AppLink>
        </span>
      </div>
      <p className="kicker mb-1.5 !text-[9px]">{C.hub.cardStarters}</p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((p, i) => (p ? cardOf(p) : <EmptySeat key={`empty:${i}`} C={C} />))}
      </div>
      {/* rc.36: the reserve and the coach thin again (rc.33's rows), stacked on a phone. */}
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sub ? (
          <ReserveRow
            save={save}
            p={sub}
            C={C}
            isNew={fresh.has(contractNewKey(sub.id, sub.contractEndSeason))}
            onOpen={() => open(sub)}
          />
        ) : (
          <EmptyRow href="/career/market" icon={<span className="text-lg leading-none">+</span>} text={C.hub.squadNoSub} hint={C.hub.cardSignHint} />
        )}
        {coach ? (
          <CoachRow coach={coach} C={C} />
        ) : (
          <EmptyRow href="/career/market#coaches" icon={<WhistleIcon className="h-5 w-5" />} text={C.hub.squadNoCoach} />
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="kicker shrink-0 text-[10px]">{C.hub.chemistry}</span>
        <ProgressBar
          value={team.chemistry.percent / 100}
          tone={team.chemistry.percent >= 75 ? "good" : "blue"}
          className="flex-1"
          label={C.hub.chemistry}
        />
        <span className="display shrink-0 text-xs font-bold text-ink">
          {chemTiers[team.chemistry.tier] ?? team.chemistry.tier} · {team.chemistry.percent}%
        </span>
      </div>
      <PlayerSheet data={sheet} onClose={() => setSheet(null)} />
    </Panel>
  );
}
