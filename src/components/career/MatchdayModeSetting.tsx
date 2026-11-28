"use client";

/**
 * rc9 MATCHDAY (R245, DESIGN-DECISIONS #236): the one matchday setting, on the
 * Training screen (it used to sit at the foot of Club). Three levels:
 * result only (events go to the result), watch (your series play live, the
 * coach plans), manage (a plan before every series, then it plays live).
 * BETA is a real status: the matchday flags are staging-only.
 *
 * The lobby's main button follows it; each event can still be played the
 * other way from the lobby.
 */

import { FEATURES } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { matchdayLevelOf, type MatchdayLevel } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";
import { Badge } from "@/components/ui/Badge";

const LEVELS: readonly MatchdayLevel[] = ["result", "watch", "manage"];

export function MatchdayModeSetting({ save, className }: { save: CareerSave; className?: string }) {
  const M = useCareerCopy().club.matchdayMode;
  const setLevel = useCareerStore((s) => s.setMatchdayLevel);
  if (!FEATURES.matchdayDecisions) return null;
  const level = matchdayLevelOf(save);

  return (
    <section className={cx("panel p-5", className)} aria-labelledby="matchday-setting-title">
      <div className="card-head">
        <h2 id="matchday-setting-title" className="card-title">
          {M.label}
        </h2>
        <Badge tone="blue">{M.beta}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby="matchday-setting-title">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => setLevel(l)}
            className={cx(
              "display min-h-11 rounded-[7px] border px-2 text-sm font-semibold transition-colors",
              level === l ? "border-orange text-ink" : "border-line-strong text-sub hover:border-blue/60 hover:text-ink",
            )}
          >
            {M.levels[l]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-sub">{M.notes[level]}</p>
      <p className="mt-1 text-xs text-faint">{M.betaNote}</p>
    </section>
  );
}
