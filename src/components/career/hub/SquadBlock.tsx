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
 * with the "New" tag until it is opened). Phone: a 2 × 2 grid (three starters
 * and the reserve); desktop: four in a row; the coach as one line under it.
 * A tap opens the player's sheet (and marks his contract seen).
 */

import { useState } from "react";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/careerCopy";
import { baseRarityOf } from "@/engine/cards";
import { careerNewSummary, contractNewKey, contractWarnsFor } from "@/engine/career/careerNew";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
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
import { PlayerSheet, type PlayerSheetData } from "@/components/career/PlayerSheet";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
import { AppLink } from "@/components/ui/AppLink";
import { NewTag } from "@/components/ui/NewDot";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

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
  const clock = contractClockOf(save, p);
  const warns = contractWarnsFor(save, p);
  const contract =
    clock.seasonsAfter > 0
      ? C.hub.cardUntil(seasonLabelFor(p.contractEndSeason))
      : warns
        ? C.hub.cardEndsIn(clock.weeksLeft ?? 0)
        : C.hub.cardFinalSeason;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${p.name} · ${ovr}`}
      className={cx(
        "card-frame flex min-w-0 flex-col p-2.5 text-left transition-transform duration-200 hover:-translate-y-0.5",
        `card-${baseRarityOf(ovr)}`,
      )}
    >
      <span className="relative flex items-start justify-between gap-1">
        <span className="display text-3xl font-bold leading-none text-ink" title={C.common.ovr}>
          {ovr}
        </span>
        <UserCrest crestId={save.identity.crestId} colors={save.identity.colors} size="sm" />
      </span>
      <span className="relative mt-1.5 flex min-w-0 items-center gap-1">
        <span className="truncate text-sm font-bold text-ink">{p.name}</span>
        {isNew ? <NewTag className="shrink-0">{C.toolbox.newTag}</NewTag> : null}
      </span>
      <span className="relative truncate text-[11px] text-sub">
        {squadAge(save, p)} · {C.player.archetype[p.archetype]}
        {phase !== "unknown" ? ` · ${C.player.phase[phase]}` : ""}
      </span>
      <span className="relative mt-1.5 block">
        <ProgressBar value={eta.progress} tone={eta.daysToNext ? "good" : "blue"} className="h-1" label={C.training.growth} />
        <span className="mt-0.5 block truncate text-[10px] text-faint">
          {eta.daysToNext ? C.hub.growthNext(eta.daysToNext) : eta.atPotential ? C.training.etaNone : C.hub.growthStalled}
        </span>
      </span>
      <span className="relative mt-0.5 block truncate text-[10px] text-sub">{C.player.potBand(band.min, band.max)}</span>
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
      className="card-frame card-hidden flex min-h-44 flex-col items-center justify-center gap-1 p-2.5 text-center"
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
  const coachFx = coach ? coachEffectsFor(coach) : null;
  const fresh = careerNewSummary(save).keys;
  // Three starter seats and the reserve; an empty seat (R67) shows the way to the Market.
  const slots: (SquadPlayer | null)[] = [starters[0] ?? null, starters[1] ?? null, starters[2] ?? null, sub];

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
          <TeamStars stars={userStars(save)} size="xs" />
          <AppLink href="/career/squad" className="inline-flex min-h-11 items-center text-[11px] font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.hub.squadManage} →
          </AppLink>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {slots.map((p, i) =>
          p ? (
            <SquadCard
              key={p.id}
              save={save}
              p={p}
              C={C}
              isNew={fresh.has(contractNewKey(p.id, p.contractEndSeason))}
              onOpen={() => open(p)}
            />
          ) : i < 3 ? (
            <EmptySeat key={`empty:${i}`} C={C} />
          ) : (
            <div
              key="nosub"
              className="flex min-h-44 items-center justify-center rounded-[14px] border border-dashed border-line px-2 text-center text-[11px] text-faint"
            >
              {C.hub.squadNoSub}
            </div>
          ),
        )}
      </div>
      <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
        <span className="kicker shrink-0 !text-[9px]">{C.hub.squadCoach}</span>
        {coach && coachFx ? (
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
            {C.hub.cardCoach(coach.name, Math.round(coach.overall), coachFx.trainingPct)}
          </span>
        ) : (
          <span className="truncate text-[11px] text-faint">{C.hub.squadNoCoach}</span>
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
