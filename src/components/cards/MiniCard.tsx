"use client";

/** Compact roster-slot row used in the draft sidebar / mobile roster sheet. */

import type { ResolvedCard } from "@/engine/cards";
import { cx } from "@/lib/util";
import { DRAFT_UI } from "@/content/copy";

export function MiniCard({
  slotLabel,
  card,
  showOverall,
  justFilled,
}: {
  slotLabel: string;
  card: ResolvedCard | null;
  showOverall: boolean;
  justFilled?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
        card ? "border-line-strong bg-white/5" : "border-dashed border-line bg-transparent",
        justFilled && "pop-in border-orange/60",
      )}
    >
      <span className="kicker w-16 shrink-0 truncate !text-[9px]" title={slotLabel}>
        {slotLabel}
      </span>
      {card ? (
        <>
          <span className="display min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-ink">
            {card.name}
            {card.special ? <span className="ml-1.5 text-orange-bright">★</span> : null}
          </span>
          <span
            className={cx(
              "display shrink-0 text-sm font-bold",
              card.kind === "org" ? "text-orange-bright" : showOverall ? "text-cyan" : "text-faint",
            )}
          >
            {card.kind === "org" ? card.buffLevel : showOverall ? card.overall : "??"}
          </span>
        </>
      ) : (
        <span className="flex-1 text-xs italic text-faint">{DRAFT_UI.empty}</span>
      )}
    </div>
  );
}
