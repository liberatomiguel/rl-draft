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
import { DIFFICULTY } from "@/config/balance";
import { RUN_UI, SETUP } from "@/content/copy";
import type { RunPhase, RunState } from "@/engine/types";
import { cx } from "@/lib/util";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const PHASES: { id: RunPhase; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "tournament", label: "Tournament" },
  { id: "results", label: "Results" },
];

export function RunStepper({ run }: { run: RunState }) {
  const router = useRouter();
  const restartRun = useRunStore((s) => s.restartRun);
  const [confirmReset, setConfirmReset] = useState(false);
  const currentIndex = PHASES.findIndex((p) => p.id === run.phase);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          // Just navigate — AppShell resets the run when it sees we left /play
          // (clearing here first would flash the setup screen mid-transition).
          onClick={() => router.push("/")}
          title={SETUP.back}
          aria-label={SETUP.back}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-sub transition-colors hover:border-line-strong hover:bg-white/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <ol className="flex items-center gap-1.5 md:gap-2" aria-label="Run progress">
          {PHASES.map((phase, i) => (
            <li key={phase.id} className="flex items-center gap-1.5 md:gap-2">
              {i > 0 ? <span className="h-px w-3 bg-line-strong md:w-5" aria-hidden /> : null}
              <span
                className={cx(
                  "display rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] md:text-xs",
                  i === currentIndex
                    ? "bg-orange/15 text-orange-bright"
                    : i < currentIndex
                      ? "text-sub"
                      : "text-faint",
                )}
                aria-current={i === currentIndex ? "step" : undefined}
              >
                {phase.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone="blue">{DIFFICULTY[run.difficulty].label}</Badge>
        {!run.showOverall ? <Badge tone="neutral">Hidden OVR</Badge> : null}
        {/* Reset run — deliberate restart (the run is over on results). */}
        {run.phase !== "results" ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            title={RUN_UI.reset}
            aria-label={RUN_UI.reset}
            className="flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-sub transition-colors hover:border-bad/50 hover:bg-bad/10 hover:text-bad"
          >
            <ResetIcon />
            <span className="hidden sm:inline">{RUN_UI.reset}</span>
          </button>
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
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.34 6.34" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
