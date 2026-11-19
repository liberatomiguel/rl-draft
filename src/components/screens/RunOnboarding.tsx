"use client";

/**
 * First-run onboarding. One-time modals, gated by persisted flags:
 *  - (The first draft's guided tour is not here any more: rc.54 moved it to
 *    `DraftScreen`, which shows it over a static board before the draw and
 *    mounts this component only once the tour is out of the way.)
 *  - Regional draft: the first time they start a region-locked run.
 *  - Legacy intro: the first time they draft on Legacy difficulty. On a Daily
 *    "Legacy Day" it says so instead of "you unlocked" (rc.29, DRAFT-14): the
 *    Daily opens Legacy to everyone for the day.
 * They chain naturally — dismissing one flips its flag and the next (if due)
 * appears on the re-render.
 * Job: tell the player what is different about this run, once. One action.
 */

import { useCopy } from "@/content/copy";
import type { Difficulty, Region } from "@/engine/types";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// A short numbered list: the lead sentence, then one row per point, the
// number set as a figure and the rows divided by hairlines. Content stays
// plain strings from copy (EN/PT). No box per step, no accent colour, no
// stagger: the modal is read once and closed.
function Steps({ intro, steps }: { intro: string; steps: readonly string[] }) {
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink">{intro}</p>
      <ol className="mt-4 border-t border-line">
        {steps.map((s, i) => (
          <li key={i} className="flex items-baseline gap-4 border-b border-line py-3">
            <span className="display w-5 shrink-0 text-xl font-bold leading-none text-faint" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0 text-sm leading-relaxed text-sub">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RunOnboarding({
  difficulty,
  regionLock,
}: {
  difficulty: Difficulty;
  regionLock?: Region | null;
}) {
  const { ONBOARDING } = useCopy();
  const seenRegional = useProfileStore((s) => s.flags.seenRegionalIntro);
  const seenLegacy = useProfileStore((s) => s.flags.seenLegacyIntro);
  const markFlag = useProfileStore((s) => s.markFlag);
  const daily = useRunStore((s) => Boolean(s.run?.daily));

  if (regionLock && !seenRegional) {
    return (
      <Modal
        open
        title={ONBOARDING.regionalTitle}
        onClose={() => markFlag("seenRegionalIntro")}
        actions={
          <Button variant="primary" onClick={() => markFlag("seenRegionalIntro")}>
            {ONBOARDING.regionalCta}
          </Button>
        }
      >
        <Steps intro={ONBOARDING.regionalIntro} steps={ONBOARDING.regionalSteps} />
      </Modal>
    );
  }

  if (difficulty === "legacy" && !seenLegacy) {
    return (
      <Modal
        open
        title={ONBOARDING.legacyTitle}
        onClose={() => markFlag("seenLegacyIntro")}
        actions={
          <Button variant="primary" onClick={() => markFlag("seenLegacyIntro")}>
            {ONBOARDING.legacyCta}
          </Button>
        }
      >
        <Steps intro={daily ? ONBOARDING.legacyDailyIntro : ONBOARDING.legacyIntro} steps={ONBOARDING.legacySteps} />
      </Modal>
    );
  }

  return null;
}
