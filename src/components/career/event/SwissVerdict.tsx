"use client";

/**
 * Road to Worlds v2.0 (R40) — the user's Swiss verdict, live in the playback,
 * where the Swiss decides more than "the next round":
 *   qualifier        Qualified for Sunday · Eliminated in the Swiss
 *   Major / Worlds   Through to Championship Sunday · Eliminated in the Swiss
 * It lands with the decisive series' banner (the record it reads is the
 * playback's REVEALED record) and stays up for the rest of the stage. The
 * wrapper is a polite live region, mounted before the verdict exists, so a
 * screen reader announces the moment it appears.
 */

import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import type { SwissVerdict as Verdict } from "./weekendView";

export function SwissVerdict({
  verdict,
  context,
  regionalName,
}: {
  verdict: Verdict | null;
  context: "qualifier" | "twoDay";
  /** The regional a qualifier feeds (its Sunday). */
  regionalName: string;
}) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;
  const through = verdict?.outcome === "advanced";
  const title = !verdict
    ? ""
    : through
      ? context === "qualifier"
        ? C.event.qualifiedForSunday
        : C.event.throughToSunday
      : C.event.eliminatedInSwiss;
  const sub = !verdict
    ? ""
    : context === "qualifier"
      ? through
        ? C.event.qualifiedFor(regionalName)
        : C.event.regionalWithoutYou(regionalName)
      : through
        ? C.event.seedLocks
        : C.event.sundayWithoutYou;

  return (
    <div role="status">
      {verdict ? (
        <div
          className={cx(
            "pop-in flex items-center gap-3 rounded-xl border px-4 py-3",
            through
              ? "border-good/50 bg-good/10 shadow-[0_0_22px_rgba(52,211,153,0.12)]"
              : "border-bad/40 bg-bad/10",
          )}
        >
          <span
            aria-hidden
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              through ? "bg-good/20 text-good" : "bg-bad/20 text-bad",
            )}
          >
            {through ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m4.5 4.5 7 7m0-7-7 7" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cx(
                "display text-sm font-bold uppercase tracking-wide sm:text-base",
                through ? "text-good" : "text-bad",
              )}
            >
              {title}
            </p>
            <p className="text-xs text-sub">{sub}</p>
          </div>
          <span className="display shrink-0 text-sm font-bold text-ink">
            {T.record(verdict.wins, verdict.losses)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
