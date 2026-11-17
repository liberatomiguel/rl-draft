"use client";
import { challengeById } from "@/data/catalog";
import { useCopy } from "@/content/copy";
import { StarIcon } from "@/components/ui/icons";
import { challengeStarLabels } from "./challengeLabels";

/** Keep the rules visible during the decisions that determine the stars. */
export function ChallengeGoals({ challengeId }: { challengeId?: string }) {
  const { CHALLENGES_UI: CH } = useCopy();
  const challenge = challengeId ? challengeById.get(challengeId) : undefined;
  if (!challenge) return null;
  // A plain strip between two hairlines: the challenge's name and its three
  // star conditions stay in view without a tinted box competing with the draft.
  return (
    <aside className="mb-6 border-y border-line py-3">
      <h3 className="display text-base uppercase leading-none text-ink">{CH.catalog[challenge.id]?.title ?? challenge.title}</h3>
      <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm leading-relaxed text-sub">
        {challengeStarLabels(challenge, CH).map((label, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <StarIcon className="h-4 w-4 shrink-0 text-faint" filled={false} />
            {label}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-xs leading-relaxed text-faint">
        {CH.fixedSeedHint}
        {challenge.draftScript ? ` · ${CH.scriptedHint}` : ""}
      </p>
    </aside>
  );
}
