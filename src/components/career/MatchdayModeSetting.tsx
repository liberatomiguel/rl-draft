"use client";

/**
 * Road to Worlds v2.1 Matchday slice 5: the career's matchday mode. Quick (the
 * default, every existing career) never stops: the coach makes the plan and
 * the calls. Custom stops before the user's series (by default in the
 * playoffs and at LAN events; "every series" is the opt-in). Switching back
 * to quick with a series paused lets the coach play it out (careerFlow).
 */

import { CAREER_MATCHDAY } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave, MatchdayMode, MatchdayStopAt } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { matchdayModeOf } from "@/store/careerFlow";
import { useCareerStore } from "@/store/careerStore";

export function MatchdayModeSetting({ save }: { save: CareerSave }) {
  const M = useCareerCopy().club.matchdayMode;
  const setMode = useCareerStore((s) => s.setMatchdayMode);
  const mode = matchdayModeOf(save);
  const stopAt: MatchdayStopAt = save.prefs.matchdayStopAt ?? CAREER_MATCHDAY.customStopDefault;
  const modes: { id: MatchdayMode; label: string; hint: string }[] = [
    { id: "quick", label: M.quick, hint: M.quickHint },
    { id: "custom", label: M.custom, hint: M.customHint },
  ];

  return (
    <fieldset className="w-full">
      <legend className="kicker mb-2">{M.label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cx(
              "flex min-h-11 flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
              mode === m.id ? "border-orange" : "border-line-strong hover:border-blue/60",
            )}
          >
            <span className="display text-sm font-semibold uppercase tracking-wide text-ink">{m.label}</span>
            <span className="mt-0.5 text-xs text-sub">{m.hint}</span>
          </button>
        ))}
      </div>
      {mode === "custom" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-sub">{M.stopAt}</span>
          {(["playoffs", "every"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stopAt === s}
              onClick={() => setMode("custom", s)}
              className={cx(
                "display min-h-11 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide sm:min-h-8",
                stopAt === s ? "border-orange text-ink" : "border-line-strong text-sub hover:text-ink",
              )}
            >
              {s === "every" ? M.stopEvery : M.stopPlayoffs}
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
