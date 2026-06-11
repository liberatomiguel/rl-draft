"use client";

/**
 * Team review: final roster, team overall, chemistry breakdown, org bonus,
 * special effects and an analyst readout. Picks are locked at this point.
 * On hidden-overall runs nothing here may leak numbers (base doc §8).
 */

import { useMemo } from "react";
import { REVIEW, STAT_LABELS } from "@/content/copy";
import { displayTeamOverall } from "@/engine/rating";
import { buildUserTeam } from "@/engine/teams";
import type { RunState, StatKey } from "@/engine/types";
import { orgById, specialCardById } from "@/data";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { rosterSlots } from "@/components/cards/rosterView";
import { RunStepper } from "./RunStepper";

const STAT_HIGH: Record<StatKey, string> = {
  offense: "Heavy attacking pressure.",
  defense: "Hard to break down.",
  mechanics: "Elite mechanical ceiling.",
  consistency: "Reliable floor, series after series.",
  experience: "Deep big-stage experience.",
  clutch: "Built for deciding games.",
};

const STAT_LOW: Record<StatKey, string> = {
  offense: "May struggle to create chances.",
  defense: "Defensively exposed at times.",
  mechanics: "Limited mechanical ceiling.",
  consistency: "Prone to volatile results.",
  experience: "Short on big-stage experience.",
  clutch: "Untested in deciding games.",
};

export function ReviewScreen({ run }: { run: RunState }) {
  const startTournament = useRunStore((s) => s.startTournament);

  const team = useMemo(
    () => buildUserTeam(run.draft.roster, run.difficulty),
    [run.draft.roster, run.difficulty],
  );

  const slots = rosterSlots(run.draft.roster);
  const org = run.draft.roster.org ? orgById.get(run.draft.roster.org.refId) : undefined;
  const specials = team.specialIds
    .map((id) => specialCardById.get(id))
    .filter((sp): sp is NonNullable<typeof sp> => Boolean(sp));

  const readout = useMemo(() => {
    const lines: string[] = [];
    if (run.showOverall) {
      const entries = Object.entries(team.stats) as [StatKey, number][];
      const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      const low = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
      lines.push(STAT_HIGH[top[0]]);
      if (low[0] !== top[0]) lines.push(STAT_LOW[low[0]]);
    }
    lines.push(`${team.chemistry.tier} chemistry between the pieces.`);
    if (org) {
      lines.push(`${org.name} brings ${STAT_LABELS[org.buffType].toLowerCase()} ${org.buffLevel} to the table.`);
    }
    if (specials.length > 0) {
      lines.push(
        specials.length === 1
          ? "One special card effect is live for this run."
          : `${specials.length} special card effects are live for this run.`,
      );
    }
    return lines;
  }, [team, org, specials, run.showOverall]);

  return (
    <div className="rise-in">
      <RunStepper run={run} />
      <SectionTitle kicker={REVIEW.subtitle} title={REVIEW.title} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Roster cards */}
        <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
          {slots.map((s) =>
            s.card ? (
              <GameCard key={s.slot} card={s.card} showOverall={run.showOverall} size="md" />
            ) : null,
          )}
        </div>

        {/* Summary column */}
        <div className="space-y-4">
          <Panel strong glow="blue" className="p-5">
            <p className="kicker mb-1">{REVIEW.teamOverall}</p>
            <p className="display text-5xl font-bold leading-none text-ink">
              {run.showOverall ? displayTeamOverall(team.rating) : "??"}
            </p>
            {run.showOverall ? (
              <dl className="mt-4 space-y-1 text-xs text-sub">
                <Row label="Players (avg)" value={team.rating.avgPlayerOverall.toFixed(1)} />
                <Row label="Coach" value={`+${team.rating.coachMod.toFixed(1)}`} />
                <Row label="Substitute" value={`+${team.rating.subMod.toFixed(1)}`} />
                <Row label="Organization" value={`+${team.rating.orgMod.toFixed(1)}`} />
                <Row label="Chemistry" value={`+${team.rating.chemMod.toFixed(1)}`} />
                <Row label="Specials" value={`+${team.rating.specialMod.toFixed(1)}`} />
              </dl>
            ) : (
              <p className="mt-3 text-xs text-faint">{REVIEW.hiddenNote}</p>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="kicker">{REVIEW.chemistry}</p>
              <Badge tone={team.chemistry.percent >= 62 ? "good" : team.chemistry.percent >= 40 ? "blue" : "neutral"}>
                {team.chemistry.tier}
              </Badge>
            </div>
            <ProgressBar value={team.chemistry.percent / 100} tone="good" label={REVIEW.chemistry} />
            {team.chemistry.items.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {team.chemistry.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-xs text-sub">
                    <span className="truncate">{item.label}</span>
                    <span className="display shrink-0 font-bold text-good">+{item.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-faint">{REVIEW.noChemistry}</p>
            )}
          </Panel>

          {specials.length > 0 ? (
            <Panel className="p-5">
              <p className="kicker mb-3">{REVIEW.specialEffects}</p>
              <ul className="space-y-2.5">
                {specials.map((sp) => (
                  <li key={sp.id} className="text-xs">
                    <span className="display block font-bold uppercase tracking-wide text-orange-bright">
                      {sp.title}
                    </span>
                    <span className="text-sub">{sp.effect.description}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel className="p-5">
            <p className="kicker mb-3">{REVIEW.readout}</p>
            <ul className="space-y-2">
              {readout.map((line, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-sub">
                  <span className="mt-1 h-1 w-3 shrink-0 -skew-x-12 bg-blue" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </Panel>

          <Button variant="primary" size="lg" full onClick={startTournament}>
            {REVIEW.startTournament}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="display font-bold text-ink">{value}</dd>
    </div>
  );
}
