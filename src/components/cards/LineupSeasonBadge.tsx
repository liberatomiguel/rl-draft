import { useCopy } from "@/content/copy";

/** Full edition identity; keep early seasons distinct even when they share a year. */
export function LineupSeasonBadge({ seasonLabel, year }: { seasonLabel: string; year?: string }) {
  const { DRAFT_UI } = useCopy();

  return (
    <span className="inline-flex max-w-full flex-col rounded-lg border border-orange-bright/60 bg-orange-bright/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className="display text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-orange-bright">
        {DRAFT_UI.lineupSeason}
      </span>
      <span className="display mt-1 text-lg font-extrabold uppercase leading-tight tracking-wide text-ink sm:text-xl">
        {seasonLabel}
        {year && !seasonLabel.includes(year) ? (
          <span className="ml-2 whitespace-nowrap text-base font-semibold text-sub">· {year}</span>
        ) : null}
      </span>
    </span>
  );
}
