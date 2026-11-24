"use client";

/**
 * In-run header: back-to-menu, phase progress, run badges, reset.
 * v0.7.0: leaving the run resets it automatically (no confirmation modal) —
 * the back arrow and nav links just navigate, and AppShell clears the run on
 * any page that isn't /play. A dedicated "Reset run" button sits next to the
 * difficulty tag for a deliberate restart (kept behind one confirm, since it
 * throws away an in-progress draft/tournament).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCopy } from "@/content/copy";
import type { RunPhase, RunState } from "@/engine/types";
import { challengeById } from "@/data/catalog";
import { cx } from "@/lib/util";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LegacyEmblem } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";

const PHASE_IDS: RunPhase[] = ["draft", "review", "tournament", "results"];
// A challenge is a constrained draft → review → single Bo7 (the "challenge"
// phase) — no Swiss/playoffs, so its stepper is shorter (v1.4).
const PHASE_IDS_CHALLENGE: RunPhase[] = ["draft", "review", "challenge"];

export function RunStepper({ run }: { run: RunState }) {
  const router = useRouter();
  const { RUN_UI, SETUP, DIFFICULTY_LABELS, DUEL_UI } = useCopy();
  const restartRun = useRunStore((s) => s.restartRun);
  const [confirmReset, setConfirmReset] = useState(false);
  const phaseLabel: Record<RunPhase, string> = {
    draft: RUN_UI.phaseDraft,
    review: RUN_UI.phaseReview,
    tournament: RUN_UI.phaseTournament,
    results: RUN_UI.phaseResults,
    challenge: run.challengeId && challengeById.get(run.challengeId)?.kind === "draft" ? RUN_UI.phaseResults : RUN_UI.phaseChallenge,
  };
  const phaseIds = run.mode === "challenge" ? PHASE_IDS_CHALLENGE : PHASE_IDS;
  const currentIndex = phaseIds.findIndex((p) => p === run.phase);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 max-w-full items-center gap-2 md:gap-3">
        <Button
          variant="secondary"
          size="sm"
          // Just navigate — AppShell resets the run when it sees we left /play
          // (clearing here first would flash the setup screen mid-transition).
          onClick={() => router.push("/")}
          title={SETUP.back}
          aria-label={SETUP.back}
          className="h-8 !min-h-8 w-8 shrink-0 !px-0"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>

        {/* The run's steps as a quiet rundown: done steps in grey, the current
            one in ink on a flat tag, the ones to come faint. */}
        <ol className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2" aria-label="Run progress">
          {phaseIds.map((phase, i) => (
            <li key={phase} className="flex items-center gap-1.5 md:gap-2">
              {i > 0 ? <span className="h-px w-3 bg-line-strong md:w-5" aria-hidden /> : null}
              <span
                className={cx(
                  "display rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.05em] md:text-xs",
                  i === currentIndex
                    ? "bg-white/[0.08] font-bold text-ink"
                    : i < currentIndex
                      ? "text-sub"
                      : "text-faint",
                )}
                aria-current={i === currentIndex ? "step" : undefined}
              >
                {phaseLabel[phase]}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center gap-2">
        {run.difficulty === "legacy" ? (
          // "You're in Legacy": the same prismatic emblem as the setup option
          // and the unlock ceremony, on the plain difficulty tag (the emblem
          // carries the colour, the tag stays flat). Shows on every phase.
          <Badge tone="blue">
            <LegacyEmblem className="h-3.5 w-3.5 shrink-0" gradientId="legacyGradStepper" />
            {DIFFICULTY_LABELS.legacy.label}
          </Badge>
        ) : (
          <Badge tone="blue">{DIFFICULTY_LABELS[run.difficulty].label}</Badge>
        )}
        {!run.showOverall ? <Badge tone="neutral">{RUN_UI.hiddenOvr}</Badge> : null}
        {run.duel ? <Badge tone="orange">{DUEL_UI.stepperTag}</Badge> : null}
        {/* Reset run — deliberate restart (the run is over on results). */}
        {run.phase !== "results" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
            title={RUN_UI.reset}
            aria-label={RUN_UI.reset}
            className="h-8 !min-h-8 !gap-1.5 !px-2 hover:!bg-bad/10 hover:!text-bad"
          >
            <ResetIcon />
            <span className="hidden sm:inline">{RUN_UI.reset}</span>
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirmReset}
        title={RUN_UI.resetTitle}
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              {RUN_UI.resetCancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReset(false);
                // Restart on the SAME difficulty — straight into a fresh draft
                // (does not bounce through the setup screen).
                restartRun();
              }}
            >
              {RUN_UI.resetConfirm}
            </Button>
          </>
        }
      >
        {RUN_UI.resetBody}
      </Modal>
    </div>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.34 6.34" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
