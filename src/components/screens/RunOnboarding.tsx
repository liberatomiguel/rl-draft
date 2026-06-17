"use client";

/**
 * First-run onboarding. One-time modals, gated by persisted flags:
 *  - How to play: the very first time the player enters a draft.
 *  - Regional draft: the first time they start a region-locked run.
 *  - Legacy intro: the first time they draft on Legacy difficulty.
 * They chain naturally — dismissing one flips its flag and the next (if due)
 * appears on the re-render. Each tutorial carries an accent color so the steps
 * read as a themed, scannable card stack (v1.2.0 visual pass).
 */

import { useCopy } from "@/content/copy";
import type { Difficulty, Region } from "@/engine/types";
import { cx } from "@/lib/util";
import { useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";

type Accent = "orange" | "emerald" | "cyan";

const BADGE_ACCENT: Record<Accent, string> = {
  orange: "from-orange/30 to-orange/5 text-orange-bright ring-orange/30 shadow-[0_0_14px_rgba(249,115,22,0.25)]",
  emerald: "from-emerald-400/30 to-emerald-400/5 text-emerald-200 ring-emerald-400/30 shadow-[0_0_14px_rgba(52,211,153,0.22)]",
  cyan: "from-cyan/30 to-cyan/5 text-cyan ring-cyan/30 shadow-[0_0_14px_rgba(56,189,248,0.22)]",
};

// Coloured "spine" on each step card — a thin accent edge that gives the stack a
// guided-sequence feel without a cross-card rail (which would break over the gaps).
const STEP_ACCENT: Record<Accent, string> = {
  orange: "border-l-2 !border-l-orange/55",
  emerald: "border-l-2 !border-l-emerald-400/55",
  cyan: "border-l-2 !border-l-cyan/55",
};

const LEAD_ACCENT: Record<Accent, string> = {
  orange: "border-orange/40",
  emerald: "border-emerald-400/40",
  cyan: "border-cyan/40",
};

// Each numbered point is its own card so the steps read as distinct, scannable
// beats. Content stays plain strings from copy (EN/PT); the accent themes the
// numbered badges to the tutorial's context (how-to orange · regional emerald ·
// legacy cyan). The cards cascade in (staggered `rise-in`) and carry a coloured
// spine so the eye is drawn down the sequence — encouraging the read.
function Steps({
  intro,
  steps,
  accent = "orange",
}: {
  intro: string;
  steps: readonly string[];
  accent?: Accent;
}) {
  return (
    <div className="space-y-4">
      <p
        className={cx(
          "rise-in border-l-2 pl-3 text-[15px] leading-relaxed text-ink/90",
          LEAD_ACCENT[accent],
        )}
      >
        {intro}
      </p>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="rise-in" style={{ animationDelay: `${80 + i * 70}ms` }}>
            <Panel className={cx("flex items-start gap-3.5 p-4", STEP_ACCENT[accent])}>
              <span
                className={cx(
                  "display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-bold ring-1",
                  BADGE_ACCENT[accent],
                )}
              >
                {i + 1}
              </span>
              <span className="self-center text-sm leading-relaxed text-sub">{s}</span>
            </Panel>
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
  const seenHowTo = useProfileStore((s) => s.flags.seenHowToPlay);
  const seenRegional = useProfileStore((s) => s.flags.seenRegionalIntro);
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
        <Steps intro={ONBOARDING.howToIntro} steps={ONBOARDING.howToSteps} accent="orange" />
      </Modal>
    );
  }

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
        <Steps intro={ONBOARDING.regionalIntro} steps={ONBOARDING.regionalSteps} accent="emerald" />
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
        <Steps intro={ONBOARDING.legacyIntro} steps={ONBOARDING.legacySteps} accent="cyan" />
      </Modal>
    );
  }

  return null;
}
