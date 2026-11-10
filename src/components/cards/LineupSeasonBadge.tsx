/** Stable edition colors; full text keeps the season identifiable without color. */
const SEASON_COLORS: Record<string, string> = {
  "RLCS Season 1": "#93c5fd",
  "RLCS Season 2": "#6ee7b7",
  "RLCS Season 3": "#c4b5fd",
  "RLCS Season 4": "#fda4af",
  "RLCS Season 5": "#67e8f9",
  "RLCS Season 6": "#fdba74",
  "RLCS Season 7": "#a5b4fc",
  "RLCS Season 8": "#bef264",
  "RLCS Season 9": "#f0abfc",
  "RLCS X": "#5eead4",
  "RLCS 2021-22": "#fca5a5",
  "RLCS 2022-23": "#d8b4fe",
  "RLCS 2024": "#7dd3fc",
  "FIFAe 2024": "#cbd5e1",
  "RLCS 2025": "#86efac",
  "FIFAe 2025": "#e2e8f0",
  "RLCS 2026": "#f9a8d4",
  "RLCS 2027": "#fcd34d",
};

export function LineupSeasonBadge({ seasonLabel, year, newLabel }: { seasonLabel: string; year?: string; newLabel: string }) {
  const color = SEASON_COLORS[seasonLabel] ?? "#cbd5e1";
  return (
    <span className="relative inline-flex max-w-full shrink-0">
      {seasonLabel === "RLCS 2027" ? (
        <span className="display absolute -right-1 -top-1.5 z-10 rotate-[10deg] rounded-sm border border-emerald-300/40 bg-emerald-950 px-1 py-px text-[8px] font-bold leading-none tracking-wider text-emerald-300">{newLabel}</span>
      ) : null}
      <span
        className="display inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-md border px-2.5 py-0.5 text-sm font-semibold tracking-wide md:text-base"
        style={{ color, borderColor: color + "40", backgroundColor: color + "0f" }}
      >
        {seasonLabel}
        {year && !seasonLabel.includes(year) ? <span className="whitespace-nowrap opacity-80">· {year}</span> : null}
      </span>
    </span>
  );
}
