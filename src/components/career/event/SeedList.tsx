"use client";

/**
 * Road to Worlds v2.0 (R40) — the teams through a Swiss stage, in seed
 * order: "The playoff eight" on a Major / Worlds Saturday, "Qualified for
 * Sunday" in a qualifier digest. Records only (no bracket, no results ahead).
 */

import { useCopy } from "@/content/copy";
import type { CareerSave } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Panel } from "@/components/ui/Panel";
import type { SeedRow } from "./weekendView";

export function SeedList({
  save,
  t,
  rows,
  title,
  className,
  style,
}: {
  save: CareerSave;
  t: TournamentState;
  rows: SeedRow[];
  title: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const T = useCopy().TOURNAMENT_UI;
  if (rows.length === 0) return null;
  return (
    <Panel className={cx("rise-in p-4", className)} style={style}>
      <p className="kicker mb-2.5 text-[10px]">{title}</p>
      <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map((r) => {
          const isUser = r.id === "user";
          return (
            <li
              key={r.id}
              className={cx(
                "flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-1.5",
                isUser ? "border-orange/60 bg-orange/10" : "border-line bg-white/[0.03]",
              )}
            >
              <span className="display w-6 shrink-0 text-center text-[11px] font-bold text-faint">
                #{r.seed}
              </span>
              <OrgMark save={save} orgRef={r.id} size="xs" className="shrink-0" />
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-xs",
                  isUser ? "font-bold text-orange-bright" : "font-semibold text-ink",
                )}
              >
                {t.teams[r.id]?.name ?? r.id}
              </span>
              <span className="display shrink-0 text-xs font-bold text-sub">{T.record(r.wins, r.losses)}</span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
