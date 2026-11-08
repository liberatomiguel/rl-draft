"use client";

import { useRouter } from "next/navigation";
import { useCopy } from "@/content/copy";
import { StarRow } from "@/app/challenges/ChallengesView";
import { challengeStarLabels } from "@/components/challenges/challengeLabels";
import { countStars, starSatisfied } from "@/engine/challenges";
import { displayTeamOverall } from "@/engine/rating";
import type { Challenge, ChallengeRunState, RunState } from "@/engine/types";
import { useRunStore } from "@/store/runStore";
import { useProfileStore } from "@/store/profileStore";
import { FieldView } from "@/components/cards/FieldView";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { RunStepper } from "./RunStepper";

/** Draft Lab has no opponent, simulated score or match RNG. */
export function DraftChallengeResult({ run, challenge, state }: { run: RunState; challenge: Challenge; state: ChallengeRunState }) {
  const { CHALLENGES_UI: CH } = useCopy();
  const router = useRouter();
  const play = useRunStore(s => s.playChallenge);
  const start = useRunStore(s => s.startChallenge);
  const xp = useProfileStore(s => s.xp);
  const labels = challengeStarLabels(challenge, CH);
  const conditions = [challenge.objective!, ...(challenge.stars ?? [])];
  const checked = !!state.evaluated;
  const ctx = { user: state.user, boss: null, all: [], bossOverall: 0, roster: run.draft.roster, rerollsUsed: state.rerollsUsed ?? 0 };
  return <div className="rise-in mx-auto max-w-3xl">
    <RunStepper run={run} />
    <SectionTitle kicker={CH.formats.draft} title={CH.catalog[challenge.id]?.title ?? challenge.title} />
    <p className="mb-5 text-sm text-sub">{CH.draftOnlyHint}</p>
    <FieldView roster={run.draft.roster} showOverall showBench />
    <Panel className="mt-4 p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="blue">{CH.teamOverall(displayTeamOverall(state.user.rating))}</Badge>
        <Badge tone="neutral">{CH.chemistryValue(state.user.chemistry.percent)}</Badge>
      </div>
      <ul className="space-y-3" aria-live="polite">
        {conditions.map((condition, i) => <li key={i} className="flex items-start gap-2 text-sm text-ink">
          <span aria-hidden className={starSatisfied(condition, ctx) ? "text-good" : "text-faint"}>{starSatisfied(condition, ctx) ? "✓" : "○"}</span>
          <span>{labels[i]}</span>
        </li>)}
      </ul>
      {!checked ? <Button className="mt-5" variant="primary" full onClick={play}>{CH.checkDraft}</Button> : <div className="mt-6 text-center">
        <h1 className="display text-2xl font-bold uppercase text-ink">{state.cleared ? CH.clearedTitle : CH.failedTitle}</h1>
        <p className="mt-2 text-sm text-sub">{state.cleared ? CH.clearedSub : CH.draftFailed}</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <StarRow mask={state.starsEarned ?? 0} total={3} size="md" />
          <Badge tone={state.starsNew ? "gold" : "neutral"}>{state.starsNew ? CH.newStars(countStars(state.starsNew)) : CH.noNewStars}</Badge>
          {xp > (state.xpBefore ?? xp) ? <span className="text-sm text-orange-bright">{CH.rewardXp(xp - state.xpBefore!)}</span> : null}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={() => start(challenge.id)}>{CH.retry}</Button>
          <Button variant="secondary" onClick={() => router.push("/challenges")}>{CH.backToChallenges}</Button>
        </div>
      </div>}
    </Panel>
  </div>;
}
