"use client";

/**
 * v2.2 Pro (PRO-SPEC §7.1): the ranked panel. The rank emblem (the Draft's own
 * art), the MMR, the distance to the next rank, the last sessions, and whether
 * the community cups have opened.
 */

import { CAREER_PRO_RANKED } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { weekOfDay } from "@/engine/career/calendar";
import { cupsUnlocked, rankOf } from "@/engine/career/pro/ranked";
import type { ProPlayer } from "@/engine/career/pro/types";
import { RankBadge } from "@/components/ui/RankBadge";

export function ProRankedPanel({ player }: { player: ProPlayer }) {
  const C = useCareerCopy().proWeek;
  const rank = rankOf(player.mmr);
  const next = CAREER_PRO_RANKED.tiers[rank.index + 1];
  const nextLabel = next ? rankOf(next.min).label : null;
  const log = [...(player.rankedLog ?? [])].reverse();
  const cupsRank = rankOf(CAREER_PRO_RANKED.tiers.find((t) => t.id === CAREER_PRO_RANKED.cupsRankId)?.min ?? 0).label;

  return (
    <section aria-label={C.ranked.title}>
      <p className="kicker mb-3">{C.ranked.title}</p>
      <div className="flex items-center gap-4">
        <RankBadge rank={{ id: rank.id, label: rank.label }} variant="menu" size="md" />
        <div className="min-w-0">
          <p className="display text-2xl font-bold uppercase leading-none text-ink">{C.ranked.division(rank.label, rank.division)}</p>
          <p className="mt-1 text-sm text-sub">
            {Math.round(player.mmr)} {C.ranked.mmr}
            {next ? ` · ${C.ranked.toNext(Math.max(0, next.min - Math.round(player.mmr)), nextLabel ?? "")}` : ` · ${C.ranked.top}`}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug text-sub">{cupsUnlocked(player) ? C.ranked.cupsOpen : C.ranked.cupsLocked(cupsRank)}</p>

      <p className="kicker mb-2 mt-5">{C.ranked.sessions}</p>
      {log.length === 0 ? (
        <p className="text-sm text-sub">{C.ranked.noSessions}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {log.map((s, i) => (
            <li key={`${s.seasonIndex}:${s.day}:${i}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
              <span className="text-ink">{C.ranked.session(s.wins, s.games, s.mmrDelta)}</span>
              <span className="shrink-0 text-xs text-faint">{C.log.day(s.seasonIndex, weekOfDay(s.day))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
