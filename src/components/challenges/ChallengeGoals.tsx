"use client";
import { challengeById } from "@/data/catalog";
import { useCopy } from "@/content/copy";
import { challengeStarLabels } from "./challengeLabels";

/** Keep the rules visible during the decisions that determine the stars. */
export function ChallengeGoals({ challengeId }: { challengeId?: string }) {
  const { CHALLENGES_UI: CH } = useCopy();
  const challenge = challengeId ? challengeById.get(challengeId) : undefined;
  if (!challenge) return null;
  return <aside className="mb-5 rounded-xl border border-blue-400/25 bg-blue-400/5 p-4">
    <p className="display text-sm font-bold uppercase text-ink">{CH.catalog[challenge.id]?.title ?? challenge.title}</p>
    <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs leading-relaxed text-sub">
      {challengeStarLabels(challenge, CH).map((label,i) => <li key={i}><span aria-hidden>★ </span>{label}</li>)}
    </ol>
    <p className="mt-2 text-[11px] text-faint">{CH.fixedSeedHint}{challenge.draftScript ? ` · ${CH.scriptedHint}` : ""}</p>
  </aside>;
}
