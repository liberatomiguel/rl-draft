"use client";

/**
 * v2.2 PROQA polish: the Pro's season-end screen. His season line (team, role,
 * series, average rating, best series), what moved his attributes and why, and
 * the gala (who won each award, and his place). Everything is read from what
 * the save holds: the history line, the match log and the season review the
 * rollover stored. Shown once at the rollover, reachable from the history.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import type { ProSave } from "@/engine/career/pro/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export function ProSeasonReviewPanel({ save, season, onClose }: { save: ProSave; season: number; onClose: () => void }) {
  const C = useCareerCopy();
  const R = C.proWorld.seasonReview;
  const G = C.proCard.gala;
  const copy = useCopy();
  const line = save.history.find((h) => h.seasonIndex === season);
  const review = (save.seasonReviews ?? []).find((r) => r.seasonIndex === season);
  if (!line) return null;
  const growth = [...(review?.growth ?? [])].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return (
    <Panel className="space-y-4 p-4 sm:p-5">
      <div>
        <p className="kicker">{R.title(season + 1)}</p>
        <h3 className="display mt-1 text-lg font-bold uppercase leading-none text-ink">{R.teamLine(line.team ?? "-", R.roles[line.role ?? "none"] ?? "")}</h3>
        <p className="mt-2 text-sm text-sub">{R.overall(Math.floor(line.overallStart), Math.floor(line.overallEnd))}</p>
        <p className="mt-1 text-sm text-ink">
          {line.series > 0 ? R.line(line.series, line.seriesWon, line.games ?? 0, line.avgRating === null ? "-" : line.avgRating.toFixed(1)) : R.noSeries}
        </p>
        {review?.bestSeries != null ? <p className="mt-1 text-sm text-sub">{R.best(review.bestSeries.toFixed(1))}</p> : null}
        {(line.results ?? []).length > 0 ? (
          <p className="mt-1 text-sm text-ink">
            {R.titles}: {(line.results ?? []).join(" · ")}
          </p>
        ) : null}
      </div>

      {growth.length > 0 ? (
        <div>
          <p className="kicker mb-1">{R.growthTitle}</p>
          <ul className="space-y-1 text-sm">
            {growth.map((g) => (
              <li key={g.stat} className={g.delta < 0 ? "text-bad" : "text-ink"}>
                {R.growthLine(copy.STAT_LABELS[g.stat] ?? g.stat, g.delta, g.sources.map((s) => C.proWeek.log.reasons[s] ?? R.sources[s] ?? s).join(", "))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="kicker mb-1">{R.galaTitle}</p>
        {(review?.gala ?? []).length === 0 ? <p className="text-sm text-sub">{R.galaNone}</p> : null}
        <ul className="space-y-1.5 text-sm">
          {(review?.gala ?? []).map((a) => (
            <li key={`${a.scope}:${a.kind}`}>
              <span className="text-ink">{R.award(G.scopes[a.scope] ?? a.scope, G.kinds[a.kind] ?? a.kind, a.winners.join(", "))}</span>
              {a.you === "winner" ? <span className="ml-2 font-semibold text-orange">{R.youWon}</span> : a.you === "nominee" ? <span className="ml-2 text-sub">{R.youNominee}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="primary" size="lg" className="max-sm:w-full" onClick={onClose}>
        {R.close}
      </Button>
    </Panel>
  );
}
