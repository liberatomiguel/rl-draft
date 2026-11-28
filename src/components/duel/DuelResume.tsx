"use client";

/**
 * rc9 duel-ui: a duel's draft left half-way. The picks made are the figure,
 * the slots as a bar under it; Resume goes back to the draft, Drop clears it
 * (or, on a challenge link, Start over drafts that challenge again).
 */

import { useRouter } from "next/navigation";
import { useCopy } from "@/content/copy";
import { filledCount } from "@/engine/draft";
import { parseDuelCode } from "@/engine/duelLink";
import type { RunState } from "@/engine/types";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { cx } from "@/lib/util";

export function DuelResume({ run, onStartOver, className }: { run: RunState; onStartOver?: () => void; className?: string }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const router = useRouter();
  const clearRun = useRunStore((s) => s.clearRun);
  const dm = run.duelMatch!;
  const total = dm.rules.mode === "quick" ? 3 : 6;
  const picked = Math.min(total, filledCount(run.draft.roster));
  const parsed = dm.challenge ? parseDuelCode(dm.challenge) : null;
  const challenger = parsed?.ok ? parsed.code.challenger.name || D.aFriend : D.aFriend;
  const whose = dm.role === "challenger" ? D.resumeOwn : D.resumeAnswer(challenger);

  return (
    <Panel strong className={cx("p-4 sm:p-5", className)} aria-label={D.resumeTitle}>
      <div className="card-head">
        <h2 className="card-title">{D.resumeTitle}</h2>
        <span className="text-sm text-sub">{whose}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="display text-3xl font-bold leading-none tabular-nums text-ink">
            {picked}
            <span className="text-faint">/{total}</span>
          </p>
          <p className="kicker mt-1.5 text-faint">{D.resumePicked(picked, total)}</p>
          <div className="mt-3 flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cx("h-1.5 w-7 rounded-[1px]", i < picked ? "bg-orange-bright" : "bg-line-strong")} />
            ))}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="primary" className="max-sm:flex-1" onClick={() => router.push("/play")}>
            {D.resume}
          </Button>
          <Button variant="ghost" className="max-sm:flex-1" onClick={() => (onStartOver ? onStartOver() : clearRun())}>
            {onStartOver ? D.startOver : D.drop}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
