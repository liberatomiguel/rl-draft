"use client";

/**
 * Team review v0.3: field + analyst column on the left, numbers column on
 * the right, the six cards in a compact strip right below the fold.
 * Starting the tournament drops straight into the auto-simulation.
 * On hidden-overall runs nothing here may leak numbers or buffs.
 */

import { useMemo } from "react";
import { useCopy } from "@/content/copy";
import { displayTeamOverall } from "@/engine/rating";
import { buildUserTeam } from "@/engine/teams";
import type { RunState, StatKey } from "@/engine/types";
import { lineupById, orgById, specialCardById } from "@/data";
import { sfx } from "@/lib/sfx";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { FieldView } from "@/components/cards/FieldView";
import { rosterSlots } from "@/components/cards/rosterView";
import { RunStepper } from "./RunStepper";

export function ReviewScreen({ run }: { run: RunState }) {
  const { REVIEW, STAT_LABELS, CHEM_TIERS, CHALLENGES_UI } = useCopy();
  const startTournament = useRunStore((s) => s.startTournament);
  const isQuick = run.mode === "quick";

  const team = useMemo(
    () => buildUserTeam(run.draft.roster, run.difficulty, { mode: run.mode }),
    [run.draft.roster, run.difficulty, run.mode],
  );

  const slots = rosterSlots(run.draft.roster).filter((s) => s.card);
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
      lines.push(REVIEW.statHigh[top[0]]);
      if (low[0] !== top[0]) lines.push(REVIEW.statLow[low[0]]);
    }
    lines.push(REVIEW.chemistryLine(CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier));
    // Org buffs are hidden information on blackout runs.
    if (org && run.showOverall) {
      lines.push(REVIEW.orgBrings(org.name, STAT_LABELS[org.buffType].toLowerCase(), org.buffLevel));
    }
    if (specials.length > 0) {
      lines.push(specials.length === 1 ? REVIEW.oneSpecial : REVIEW.manySpecials(specials.length));
    }
    return lines;
  }, [team, org, specials, run.showOverall, REVIEW, STAT_LABELS, CHEM_TIERS]);

  return (
    <div className="rise-in">
      <RunStepper run={run} />
      <SectionTitle kicker={REVIEW.subtitle} title={REVIEW.title} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Field + readout */}
        <div className="space-y-4">
          <FieldView
            roster={run.draft.roster}
            showOverall={run.showOverall}
            showBench={!isQuick}
            className="mx-auto w-full max-w-md lg:max-w-none"
          />
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
        </div>

        {/* Numbers column */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel strong glow="blue" className="p-5">
              <p className="kicker mb-1">{REVIEW.teamOverall}</p>
              <p className="display text-5xl font-bold leading-none text-ink">
                {run.showOverall ? displayTeamOverall(team.rating) : "??"}
              </p>
              {run.showOverall ? (
                <dl className="mt-4 space-y-1 text-xs text-sub">
                  <Row label={REVIEW.rowPlayers} value={team.rating.avgPlayerOverall.toFixed(1)} />
                  {!isQuick ? (
                    <>
                      <Row label={REVIEW.rowCoach} value={`+${team.rating.coachMod.toFixed(1)}`} />
                      <Row label={REVIEW.rowSub} value={`+${team.rating.subMod.toFixed(1)}`} />
                      <Row label={REVIEW.rowOrg} value={`+${team.rating.orgMod.toFixed(1)}`} />
                    </>
                  ) : null}
                  <Row label={REVIEW.rowChemistry} value={`+${team.rating.chemMod.toFixed(1)}`} />
                  <Row label={REVIEW.rowSpecials} value={`+${team.rating.specialMod.toFixed(1)}`} />
                </dl>
              ) : (
                <p className="mt-3 text-xs text-faint">{REVIEW.hiddenNote}</p>
              )}
            </Panel>

            <Panel className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker">{REVIEW.chemistry}</p>
                <Badge tone={team.chemistry.percent >= 62 ? "good" : team.chemistry.percent >= 40 ? "blue" : "neutral"}>
                  {CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier}
                </Badge>
              </div>
              <ProgressBar value={team.chemistry.percent / 100} tone="good" label={REVIEW.chemistry} />
              {team.chemistry.items.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {team.chemistry.items.slice(0, 6).map((item, i) => (
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
          </div>

          {specials.length > 0 ? (
            <Panel className="p-5">
              <p className="kicker mb-3">{REVIEW.specialEffects}</p>
              <ul className="space-y-2.5">
                {specials.map((sp) => (
                  <li key={sp.id} className="text-xs">
                    <span className="display block font-bold uppercase tracking-wide text-orange-bright">
                      {/* Hidden runs show the EFFECT, never which card it is */}
                      {run.showOverall ? sp.title : "???"}
                    </span>
                    <span className="text-sub">{sp.effect.description}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            full
            onClick={() => {
              sfx.start();
              startTournament();
            }}
          >
            {run.mode === "challenge" ? CHALLENGES_UI.toMatch : REVIEW.startTournament}
          </Button>
        </div>
      </div>

      {/* Cards strip — fluid cards inside capped cells (mobile fix, v0.7.0):
          a fixed size="sm" card (w-32) overflowed its 3-column mobile track
          and the cards overlapped. This uses the SAME proven fluid + max-width
          wrapper the draft and results screens already use — the card
          internals are untouched, so no other view changes. */}
      <div className="mt-8 grid grid-cols-3 gap-2 md:gap-3 lg:grid-cols-6">
        {slots.map((s) => {
          const fromLineupId = run.draft.roster[s.slot]?.fromLineupId;
          const lu = fromLineupId ? lineupById.get(fromLineupId) : undefined;
          return (
            <div key={s.slot} className="mx-auto w-full max-w-32">
              <GameCard
                card={s.card!}
                showOverall={run.showOverall}
                maskOrgId={lu?.orgId}
                maskSeasonId={lu?.seasonId}
                size="sm"
                fluid
              />
            </div>
          );
        })}
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
