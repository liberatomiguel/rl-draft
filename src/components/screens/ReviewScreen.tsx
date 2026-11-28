"use client";

import { challengeById } from "@/data";

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
import { OverallParts } from "./OverallParts";
import { ChallengeGoals } from "@/components/challenges/ChallengeGoals";

export function ReviewScreen({ run }: { run: RunState }) {
  const { REVIEW, STAT_LABELS, CHEM_TIERS, CHALLENGES_UI, DUEL_MATCH_UI } = useCopy();
  const startTournament = useRunStore((s) => s.startTournament);
  const finishDuelDraft = useRunStore((s) => s.finishDuelDraft); // rc9 duel-ui
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

  // Job: one last look at the team, then start the tournament. The team
  // overall is the figure of the screen and Start Tournament the one action;
  // the build-up, chemistry and special effects are one board under it, and
  // the analyst's lines are plain text beside the pitch.
  //
  // Phone (mobile redesign, stage 2): the first screen is the pitch and the
  // team overall with its build-up; chemistry, the special effects and the
  // analyst's lines follow. The two desktop columns dissolve (`contents`) so
  // the numbers board can sit between the pitch and the readout. The strip of
  // six cards under them repeated the pitch and is desktop only. Start
  // Tournament is the screen's one action, on ground (`.action-dock`).
  const start = () => {
    sfx.start();
    // rc9 duel-ui: a duel's draft ends here; PlayView takes the player to /duel.
    if (run.duelMatch) {
      finishDuelDraft();
      return;
    }
    startTournament();
  };
  const startLabel = run.duelMatch
    ? run.duelMatch.role === "challenger"
      ? DUEL_MATCH_UI.lockChallenger
      : DUEL_MATCH_UI.lockOpponent
    : run.mode === "challenge"
      ? run.challengeId && challengeById.get(run.challengeId)?.kind === "draft"
        ? CHALLENGES_UI.checkDraft
        : CHALLENGES_UI.toMatch
      : REVIEW.startTournament;

  return (
    <div className="rise-in">
      <RunStepper run={run} />
      {run.mode === "challenge" ? <ChallengeGoals challengeId={run.challengeId} /> : null}
      <SectionTitle kicker={REVIEW.subtitle} title={REVIEW.title} className="mb-4 sm:mb-6" />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Field + readout */}
        <div className="max-sm:contents">
          <FieldView
            roster={run.draft.roster}
            showOverall={run.showOverall}
            showBench={!isQuick}
            className="mx-auto w-full max-w-md lg:max-w-none"
          />
          <div className="max-sm:order-3 max-sm:mb-4">
            <h3 className="display text-lg uppercase leading-none text-ink sm:mt-6">{REVIEW.readout}</h3>
            <ul className="mt-3 border-t border-line">
              {readout.map((line, i) => (
                <li key={i} className="border-b border-line py-2.5 text-sm leading-relaxed text-sub">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Numbers column: one board, three parts divided by hairlines. */}
        <div className="space-y-4 max-sm:contents">
          <Panel strong className="divide-y divide-line max-sm:order-2">
            <div className={`grid ${run.showOverall ? "grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]"} items-center gap-x-6 gap-y-4 p-4 sm:gap-x-10 sm:p-5`}>
              <div>
                <p className="display text-6xl font-bold leading-[0.9] text-ink sm:text-7xl">
                  {run.showOverall ? displayTeamOverall(team.rating) : "??"}
                </p>
                <p className="mt-2 max-w-[6.5rem] text-xs leading-snug text-sub sm:max-w-none">{REVIEW.teamOverall}</p>
              </div>
              {run.showOverall ? (
                <OverallParts rating={team.rating} quick={isQuick} />
              ) : (
                <p className="text-sm leading-relaxed text-sub">{run.duelMatch ? DUEL_MATCH_UI.overallSecretHint /* rc9 duel-ui */ : REVIEW.hiddenNote}</p>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="display text-lg uppercase leading-none text-ink">{REVIEW.chemistry}</h3>
                <Badge tone={team.chemistry.percent >= 62 ? "good" : team.chemistry.percent >= 40 ? "blue" : "neutral"}>
                  {CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier}
                </Badge>
              </div>
              <ProgressBar value={team.chemistry.percent / 100} tone="good" label={REVIEW.chemistry} />
              {team.chemistry.items.length > 0 ? (
                <ul className="mt-3 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {team.chemistry.items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-1 text-sm text-sub">
                      <span className="truncate">{item.label}</span>
                      <span className="display shrink-0 font-bold text-good">+{item.points}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-sub">{REVIEW.noChemistry}</p>
              )}
            </div>

            {specials.length > 0 ? (
              <div className="p-4 sm:p-5">
                <h3 className="display text-lg uppercase leading-none text-ink">{REVIEW.specialEffects}</h3>
                <ul className="mt-3 space-y-3">
                  {specials.map((sp) => (
                    <li key={sp.id} className="text-sm leading-relaxed">
                      <span className="display block font-semibold uppercase leading-tight text-ink">
                        {/* Hidden runs show the EFFECT, never which card it is */}
                        {run.showOverall ? sp.title : "???"}
                      </span>
                      <span className="text-sub">{sp.effect.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Button variant="primary" size="lg" full className="max-sm:hidden" onClick={start}>
            {startLabel}
          </Button>
        </div>
      </div>

      {/* Cards strip — fluid cards inside capped cells (mobile fix, v0.7.0):
          a fixed size="sm" card (w-32) overflowed its 3-column mobile track
          and the cards overlapped. This uses the SAME proven fluid + max-width
          wrapper the draft and results screens already use — the card
          internals are untouched, so no other view changes. */}
      <div className="mt-8 grid grid-cols-3 gap-2 max-sm:hidden md:gap-3 lg:grid-cols-6">
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

      {/* Phone: the one action, a direct child of the root so the whole page
          carries it (see `.action-dock`). */}
      <div className="action-dock sm:hidden">
        <Button variant="primary" size="lg" full onClick={start}>
          {startLabel}
        </Button>
      </div>
    </div>
  );
}
