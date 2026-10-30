"use client";

/**
 * Road to Worlds hub — THE SQUAD BLOCK (rc.2). The roster as people, not a
 * stat line: three starter cards (OVR, archetype, age, phase, growth to the
 * next point), the sub and the coach as smaller tiles, the chemistry bar. One
 * tap goes to the Squad screen.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CareerSave, SquadPlayer } from "@/engine/career/types";
import type { TournamentTeam } from "@/engine/types";
import { cx } from "@/lib/util";
import { agePhase, potBandOfSquad, squadAge, squadTrainingEta, userStars } from "@/components/career/careerUi";
import { TeamStars } from "@/components/career/TeamStars";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

const PHASE_TONE = { growing: "good", prime: "blue", declining: "neutral", unknown: "neutral" } as const;

function initials(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
}

function StarterCard({ save, p, C }: { save: CareerSave; p: SquadPlayer; C: CareerCopy }) {
  const eta = squadTrainingEta(save, p);
  const phase = agePhase(save, p);
  const band = potBandOfSquad(save, p);
  const { primary: c1, secondary: c2 } = save.identity.colors;
  return (
    <div className="flex flex-col rounded-xl border border-line bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <span
          className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-inner"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          aria-hidden
        >
          {initials(p.name)}
        </span>
        <span className="display text-3xl font-bold leading-none text-ink" title={C.common.ovr}>
          {Math.round(p.overall)}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-bold text-ink">{p.name}</p>
      <p className="truncate text-[11px] text-sub">
        {C.player.archetype[p.archetype]} · {C.player.age(squadAge(save, p))}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge tone={PHASE_TONE[phase]}>{C.player.phase[phase]}</Badge>
        <span className="text-[10px] text-faint">{C.player.potBand(band.min, band.max)}</span>
      </div>
      <div className="mt-2">
        <ProgressBar value={eta.progress} tone={eta.daysToNext ? "good" : "blue"} className="h-1" label={C.training.growth} />
        <p className="mt-1 text-[10px] text-faint">{eta.daysToNext ? C.hub.growthNext(eta.daysToNext) : eta.atPotential ? C.training.etaNone : C.hub.growthStalled}</p>
      </div>
    </div>
  );
}

export function SquadBlock({ save, C, team, chemTiers }: { save: CareerSave; C: CareerCopy; team: TournamentTeam; chemTiers: Record<string, string> }) {
  const starters = save.starterIds
    .map((id) => save.squad.find((p) => p.id === id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const sub = save.squad.find((p) => !save.starterIds.includes(p.id)) ?? null;
  const coach = save.coach;
  const coachFx = coach ? coachEffectsFor(coach) : null;
  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "60ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">{C.hub.squadTitle}</p>
        <span className="flex items-center gap-2">
          <TeamStars stars={userStars(save)} size="xs" />
          <AppLink href="/career/squad" className="text-[11px] font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.hub.squadManage} →
          </AppLink>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {starters.map((p) => (
          <StarterCard key={p.id} save={save} p={p} C={C} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
          <span className="kicker shrink-0 !text-[9px]">{C.hub.squadSub}</span>
          {sub ? (
            <>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{sub.name}</span>
              <span className="display text-sm font-bold text-ink">{Math.round(sub.overall)}</span>
            </>
          ) : (
            <span className="text-[11px] text-faint">{C.hub.squadNoSub}</span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
          <span className="kicker shrink-0 !text-[9px]">{C.hub.squadCoach}</span>
          {coach && coachFx ? (
            <>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{coach.name}</span>
              <span className={cx("display text-[11px] font-bold", coachFx.trainingPct >= 0 ? "text-good" : "text-bad")}>
                {coachFx.trainingPct > 0 ? "+" : ""}
                {coachFx.trainingPct}%
              </span>
            </>
          ) : (
            <span className="truncate text-[11px] text-faint">{C.hub.squadNoCoach}</span>
          )}
        </div>
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
    </Panel>
  );
}
