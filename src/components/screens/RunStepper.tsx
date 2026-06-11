"use client";

/** In-run header: phase progress, run badges and the abandon action. */

import { useState } from "react";
import { DIFFICULTY } from "@/config/balance";
import { SETUP } from "@/content/copy";
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
  const abandonRun = useRunStore((s) => s.abandonRun);
  const [confirming, setConfirming] = useState(false);
  const currentIndex = PHASES.findIndex((p) => p.id === run.phase);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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

      <div className="flex items-center gap-2">
        <Badge tone="blue">{DIFFICULTY[run.difficulty].label}</Badge>
        {!run.showOverall ? <Badge tone="neutral">Hidden OVR</Badge> : null}
        {run.phase !== "results" ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            {SETUP.abandon}
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirming}
        title={SETUP.abandonConfirmTitle}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {SETUP.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                abandonRun();
                setConfirming(false);
              }}
            >
              {SETUP.abandonConfirm}
            </Button>
          </>
        }
      >
        {SETUP.abandonConfirmBody}
      </Modal>
    </div>
  );
}
