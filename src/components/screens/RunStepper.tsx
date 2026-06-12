"use client";

/**
 * In-run header: back-to-menu (resets the run), phase progress, run badges.
 * v0.2: no resume system — leaving a run abandons it, one click, no modal.
 */

import { useRouter } from "next/navigation";
import { DIFFICULTY } from "@/config/balance";
import { SETUP } from "@/content/copy";
import type { RunPhase, RunState } from "@/engine/types";
import { cx } from "@/lib/util";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";

const PHASES: { id: RunPhase; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "tournament", label: "Tournament" },
  { id: "results", label: "Results" },
];

export function RunStepper({ run }: { run: RunState }) {
  const router = useRouter();
  const clearRun = useRunStore((s) => s.clearRun);
  const currentIndex = PHASES.findIndex((p) => p.id === run.phase);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => {
            clearRun();
            router.push("/");
          }}
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
      </div>
    </div>
  );
}
