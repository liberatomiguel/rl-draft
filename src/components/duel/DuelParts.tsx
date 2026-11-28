"use client";

/**
 * rc9 duel-ui: the pieces the duel's screens share. The draft card is the
 * reference object: a team is shown as the game's own cards, a sealed team as
 * the cards' backs, the rules as a strip of figures, the series as pips.
 */

import type { ReactNode } from "react";
import { DUEL_MATCH } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { DuelRules } from "@/engine/duelRules";
import type { Region } from "@/engine/types";
import { GameCard } from "@/components/cards/GameCard";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { LockIcon } from "@/components/ui/icons";
import { cx, initials } from "@/lib/util";
import type { DuelTeamView } from "./duelTeam";

export type DuelTone = "orange" | "blue";

/** Wins a side needs: 4 in a best of 7. */
export const DUEL_TARGET = Math.ceil(DUEL_MATCH.bestOf / 2);

/** The region's name, or Worldwide. */
export function useRegionName(): (region: Region | null) => string {
  const { SETUP } = useCopy();
  return (region) => (region ? ((SETUP.regionNames as Record<string, string>)[region] ?? region) : SETUP.regionWorldwide);
}

/** A side's mark: the drafted org's logo (Classic), else the name's initials on a card-stock square. */
export function DuelMark({ view, name, size = "lg" }: { view: DuelTeamView | null; name: string; size?: "md" | "lg" }) {
  if (view?.mark) return <TeamLogo orgId={view.mark.orgId} seasonId={view.mark.seasonId} size={size} loading="eager" />;
  return (
    <span
      className={cx(
        "panel-strong card-texture display inline-flex shrink-0 items-center justify-center rounded-[10px] font-bold uppercase text-ink",
        size === "lg" ? "h-[4.5rem] w-[4.5rem] text-2xl" : "h-11 w-11 text-sm",
      )}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

/** A team as the game's cards: the three players, then the bench and the org a step smaller. */
export function DuelRoster({ view, showOverall, className }: { view: DuelTeamView; showOverall: boolean; className?: string }) {
  const bench = [view.coach, view.sub, view.org].filter((c): c is NonNullable<typeof c> => Boolean(c));
  return (
    <div className={cx("space-y-2", className)}>
      <div className="grid grid-cols-3 gap-2">
        {view.players.map((card) => (
          <div key={card.refId} className="mx-auto w-full max-w-32">
            <GameCard card={card} showOverall={showOverall} size="sm" fluid lite tilt="off" />
          </div>
        ))}
      </div>
      {bench.length > 0 ? (
        <div className="mx-auto grid max-w-[80%] grid-cols-3 gap-2">
          {bench.map((card) => (
            <div key={`${card.kind}-${card.refId}`} className="mx-auto w-full max-w-24">
              <GameCard card={card} showOverall={showOverall} size="sm" fluid lite tilt="off" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A sealed team: the backs of its cards, in the card's stock with a lock. */
export function SealedRoster({ count, label }: { count: number; label: string }) {
  const players = Math.min(3, count);
  const bench = Math.max(0, count - 3);
  const back = (key: string, small?: boolean) => (
    <div key={key} className={cx("mx-auto w-full", small ? "max-w-24" : "max-w-32")}>
      <div className="panel-strong card-texture flex aspect-[5/7] items-center justify-center rounded-[14px] text-faint">
        <LockIcon className={small ? "h-4 w-4" : "h-5 w-5"} />
      </div>
    </div>
  );
  return (
    <div className="space-y-2" role="img" aria-label={label}>
      <div className="grid grid-cols-3 gap-2">{Array.from({ length: players }, (_, i) => back(`p${i}`))}</div>
      {bench > 0 ? <div className="mx-auto grid max-w-[80%] grid-cols-3 gap-2">{Array.from({ length: bench }, (_, i) => back(`b${i}`, true))}</div> : null}
    </div>
  );
}

/** The rules as a strip of figures: rerolls, overalls, draft, region. */
export function RulesStrip({ rules, className }: { rules: DuelRules; className?: string }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  const regionName = useRegionName();
  const cells: { value: string; label: string; big?: boolean }[] = [
    { value: String(rules.rerolls), label: D.rerollsLabel, big: true },
    { value: rules.showOverall ? D.overallVisible : D.overallSecret, label: D.overallLabel },
    { value: rules.mode === "quick" ? D.modeQuickShort : D.modeClassicShort, label: D.modeLabel },
    { value: regionName(rules.region), label: D.regionLabel },
  ];
  return (
    <dl className={cx("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4", className)}>
      {cells.map((c) => (
        <div key={c.label} className="flex min-w-0 flex-col justify-end bg-surface px-4 py-3">
          <dd className={cx("display truncate font-bold leading-none text-ink tabular-nums", c.big ? "text-3xl" : "text-lg")}>{c.value}</dd>
          <dt className="kicker mt-1.5 text-faint">{c.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** The series as pips: each side's wins filled in its colour, the score between. */
export function SeriesPips({
  a,
  b,
  toneA,
  toneB,
  label,
  size = "md",
}: {
  a: number;
  b: number;
  toneA: DuelTone;
  toneB: DuelTone;
  label: string;
  size?: "md" | "lg";
}) {
  const fill = (t: DuelTone) => (t === "orange" ? "bg-orange-bright" : "bg-blue-bright");
  const row = (wins: number, tone: DuelTone, reverse?: boolean) => (
    <span className={cx("flex gap-1", reverse && "flex-row-reverse")}>
      {Array.from({ length: DUEL_TARGET }, (_, i) => (
        <span key={i} className={cx("rounded-[1px]", size === "lg" ? "h-2.5 w-6" : "h-2 w-4", i < wins ? fill(tone) : "bg-line-strong")} />
      ))}
    </span>
  );
  return (
    <span className="flex items-center gap-3" role="img" aria-label={label}>
      {row(a, toneA, true)}
      <span className={cx("display font-bold tabular-nums text-ink", size === "lg" ? "text-xl" : "text-sm")} aria-hidden>
        {a}-{b}
      </span>
      {row(b, toneB)}
    </span>
  );
}

/** One option of a rule: a small card that is pressed or not (state is the orange hairline). */
export function OptionCard({
  pressed,
  onClick,
  figure,
  label,
  hint,
  name,
}: {
  pressed: boolean;
  onClick: () => void;
  figure: ReactNode;
  label?: string;
  hint?: string;
  /** The option in words, for a screen reader (the figure alone is "7" or "??"). */
  name: string;
}) {
  return (
    <button
      type="button"
      aria-label={hint ? `${name}. ${hint}` : name}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "flex min-h-11 min-w-0 flex-col items-start justify-end rounded-xl border px-4 py-3 text-left transition-colors",
        pressed ? "border-orange bg-orange/[0.06]" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span className={cx("display font-bold leading-none tabular-nums", pressed ? "text-ink" : "text-sub")}>{figure}</span>
      {label ? <span className="kicker mt-1.5 text-faint">{label}</span> : null}
      {hint ? <span className="mt-1 text-xs leading-snug text-sub">{hint}</span> : null}
    </button>
  );
}

/** A side's name as it shows: large, mixed case, the colour tick under it. */
export function SideName({ name, tone, className }: { name: string; tone: DuelTone; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="display break-words text-xl font-semibold leading-tight text-ink sm:text-2xl">{name}</p>
      <span className={cx("mt-1.5 inline-block h-1 w-8 rounded-[1px]", tone === "orange" ? "bg-orange-bright" : "bg-blue-bright")} aria-hidden />
    </div>
  );
}
