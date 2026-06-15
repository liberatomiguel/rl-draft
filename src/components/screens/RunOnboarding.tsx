"use client";

/**
 * First-run onboarding (v1.0). Two one-time modals, gated by persisted flags:
 *  - How to play: the very first time the player enters a draft.
 *  - Legacy intro: the first time they draft on Legacy difficulty.
 * They chain naturally — dismissing one flips its flag and the next (if due)
 * appears on the re-render.
 */

import { useCopy } from "@/content/copy";
import type { Difficulty } from "@/engine/types";
import { useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

function Steps({ intro, steps }: { intro: string; steps: readonly string[] }) {
  return (
    <div className="space-y-3">
      <p>{intro}</p>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="display flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange/15 text-[11px] font-bold text-orange-bright">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-sub">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RunOnboarding({ difficulty }: { difficulty: Difficulty }) {
  const { ONBOARDING } = useCopy();
  const seenHowTo = useProfileStore((s) => s.flags.seenHowToPlay);
  const seenLegacy = useProfileStore((s) => s.flags.seenLegacyIntro);
  const markFlag = useProfileStore((s) => s.markFlag);

  if (!seenHowTo) {
    return (
      <Modal
        open
        title={ONBOARDING.howToTitle}
        onClose={() => markFlag("seenHowToPlay")}
        actions={
          <Button variant="primary" onClick={() => markFlag("seenHowToPlay")}>
            {ONBOARDING.howToCta}
          </Button>
        }
      >
        <Steps intro={ONBOARDING.howToIntro} steps={ONBOARDING.howToSteps} />
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
        <Steps intro={ONBOARDING.legacyIntro} steps={ONBOARDING.legacySteps} />
      </Modal>
    );
  }

  return null;
}
