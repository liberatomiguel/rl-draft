"use client";

/**
 * Friend duel (v2.1): the invitation under a finished Classic / Quick run —
 * start a duel on the same settings (a new seed), play it, then send the link.
 * A normal run cannot be shared as it is: its offers depend on the player's
 * rank and the day's event cards, which a friend would not have.
 */

import { useCopy } from "@/content/copy";
import { freshDuel } from "@/engine/duel";
import type { RunState } from "@/engine/types";
import { randomSeed } from "@/lib/rng";
import { useRunStore } from "@/store/runStore";
import { Button } from "@/components/ui/Button";

export function DuelInvite({ run }: { run: RunState }) {
  const { DUEL_UI: D } = useCopy();
  const startDuel = useRunStore((s) => s.startDuel);
  if (run.duel || run.daily || (run.mode !== "classic" && run.mode !== "quick")) return null;
  const mode = run.mode;
  return (
    <div className="mt-8 flex flex-col gap-3 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="kicker mb-1">{D.inviteTitle}</p>
        <p className="max-w-xl text-sm text-sub">{D.inviteBody}</p>
      </div>
      <Button
        variant="secondary"
        className="shrink-0"
        onClick={() =>
          startDuel(
            freshDuel(
              { mode, difficulty: run.difficulty, region: run.regionLock ?? null, showOverall: run.showOverall },
              randomSeed(),
            ),
          )
        }
      >
        {D.inviteStart}
      </Button>
    </div>
  );
}
