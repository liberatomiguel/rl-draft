"use client";

/**
 * Road to Worlds — Market rows (rc9 TRAIN-MARKET).
 *
 * What the player decides on the Market: who to sign, for how much, and who
 * to sell. A candidate is one row of a board with the three things that decide
 * it (rating and potential, what he costs, what he would change in the team);
 * the rest opens on the row (the player sheet). A deal (a bid, a listing, a
 * trade) is the same kind of row: who and what, the figure, then its actions.
 */

import type { ReactNode } from "react";
import { PlayerFace } from "@/components/career/locker/lockerUi";
import { LockIcon } from "@/components/ui/icons";
import { cx } from "@/lib/util";

export interface CandidateRowProps {
  name: string;
  overall: number;
  /** "NA · Age 18 · Playmaker": the quiet line under the name. */
  detail: string;
  /** His org (a contracted player), else null. */
  org: ReactNode | null;
  /** "POT 79-81". */
  potential: string;
  /** His phase on his arc ("Developing", "Phase ?"). */
  phase: string;
  /** "$840 / week". */
  wage: string;
  /** The transfer fee (contracted) or the free agent tag. */
  feeLine: string;
  /** What he would change in the team, and whether it is a gain. */
  team: string;
  teamGain: boolean;
  /** The gate that locks him, as a sentence (null = open). */
  lock: string | null;
  lockTitle?: string;
  onOpen: () => void;
  opensLabel: string;
}

export const CANDIDATE_GRID =
  "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_8rem_9.5rem_11rem] lg:gap-x-6";

/** One candidate: a whole row is the button that opens his sheet. */
export function CandidateRow(p: CandidateRowProps) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={p.onOpen}
        aria-label={`${p.opensLabel}: ${p.name}`}
        className={cx(
          "grid w-full items-center gap-x-3 gap-y-1 px-0 py-3 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 sm:gap-x-5",
          CANDIDATE_GRID,
          p.lock && "opacity-70",
        )}
      >
        <PlayerFace overall={p.overall} size="sm" />
        <span className="min-w-0">
          <span className="display block truncate text-[15px] font-semibold text-ink">{p.name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-faint">
            {p.org}
            <span className="truncate">{p.detail}</span>
          </span>
        </span>
        {/* Potential: the band in ink, his phase under it (from `sm`; the phone folds it into one line). */}
        <span className="hidden sm:block">
          <span className="block text-sm tabular-nums text-ink">{p.potential}</span>
          <span className="block text-xs text-faint">{p.phase}</span>
        </span>
        {/* Cost: the weekly wage first, then the fee or the free agent tag. */}
        <span className="text-right sm:text-left">
          <span className="block text-sm tabular-nums text-ink">{p.wage}</span>
          <span className="block text-xs text-faint">{p.feeLine}</span>
        </span>
        <span className={cx("hidden text-[13px] sm:block", p.teamGain ? "text-good" : "text-sub")}>{p.team}</span>
        <span className="col-start-2 col-end-4 flex flex-wrap gap-x-2 text-xs text-sub sm:hidden">
          <span className="tabular-nums">{p.potential}</span>
          <span aria-hidden>·</span>
          <span className={p.teamGain ? "text-good" : undefined}>{p.team}</span>
        </span>
        {p.lock ? (
          <span className="col-span-full flex items-center gap-1.5 text-xs text-orange-bright sm:col-start-2" title={p.lockTitle}>
            <LockIcon className="h-3.5 w-3.5 shrink-0" />
            {p.lock}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** The column heads of the candidate board (from `sm`; a phone reads the rows). */
export function CandidateHead({ labels }: { labels: { player: string; potential: string; cost: string; team: string } }) {
  return (
    <div className={cx("hidden gap-x-5 border-b border-line pb-2 sm:grid lg:gap-x-6", CANDIDATE_GRID)}>
      <span className="w-9" aria-hidden />
      <span className="kicker">{labels.player}</span>
      <span className="kicker">{labels.potential}</span>
      <span className="kicker">{labels.cost}</span>
      <span className="kicker">{labels.team}</span>
    </div>
  );
}

/** One fact of an offer (the fee, the balance after): the label in the faint step on the left, the value on the right. */
export function OfferFact({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-3">
      <dt className="text-[13px] text-faint">{label}</dt>
      <dd className={cx("text-right text-sm tabular-nums", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink")}>{value}</dd>
    </div>
  );
}

/** A deal: who and what on the left, its figure on the right, then its actions. */
export function DealRow({
  title,
  tags,
  lines,
  figure,
  actions,
}: {
  title: ReactNode;
  tags?: ReactNode;
  lines?: ReactNode[];
  figure?: { value: string; label: string; tone?: "ink" | "good" | "bad" } | null;
  actions?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="display text-[15px] font-semibold leading-snug text-ink">{title}</span>
          {tags}
        </div>
        {(lines ?? []).filter(Boolean).map((line, i) => (
          <p key={i} className={cx("text-[13px] leading-snug", i === 0 ? "mt-1 text-sub" : "mt-0.5 text-faint")}>
            {line}
          </p>
        ))}
      </div>
      {figure ? (
        <div className="text-right">
          <p className={cx("display text-xl font-bold leading-none tabular-nums", figure.tone === "good" ? "text-good" : figure.tone === "bad" ? "text-bad" : "text-ink")}>{figure.value}</p>
          <p className="kicker mt-1">{figure.label}</p>
        </div>
      ) : null}
      {actions ? <div className="col-span-2 flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}
