"use client";

/**
 * v2.2 Pro (PRO-SPEC §6): the decision of one game, as a presentational card.
 * The match flow (the spine) owns when it shows and what happens with the
 * answer: this only lists the calls, with their hint word, and returns the pick
 * ("instinct" for the neutral shortcut).
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import type { ProDecision } from "@/engine/career/pro/moments";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { cx } from "@/lib/util";

export function ProDecisionCard({ decision, onChoose }: { decision: ProDecision; onChoose: (choice: string | "instinct") => void }) {
  const M = useCareerCopy().proMoments;
  const copy = useCopy();
  return (
    <Panel className="p-4">
      <p className="kicker">{M.title}</p>
      <h3 className="display mt-1 text-lg font-bold uppercase leading-none text-ink">{M.moment[decision.momentType] ?? decision.momentType}</h3>
      <p className="mt-2 text-xs leading-snug text-sub">{M.kicker}</p>
      <ul className="mt-3 grid gap-2">
        {decision.options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              disabled={o.locked}
              onClick={() => onChoose(o.id)}
              className={cx(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                o.locked ? "cursor-not-allowed border-line opacity-50" : "border-line-strong hover:border-blue/60 hover:bg-blue/10",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{M.calls[o.id] ?? o.id}</span>
                <span className="block text-xs text-sub">{copy.STAT_LABELS[o.attr]}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-blue-bright">
                {o.locked ? M.locked(M.calls[o.requires ?? ""] ?? "") : o.hint ? M.hints[o.hint] : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={() => onChoose("instinct")}>
          {M.instinct}
        </Button>
        <p className="mt-1 text-xs text-sub">{M.instinctHint}</p>
      </div>
    </Panel>
  );
}
