"use client";

/**
 * Road to Worlds hub, phone only (mobile redesign, 24/11): HQ at a glance.
 *
 * Under 640px HQ shows what matters today (the day card, the inbox, the
 * season goal, the wire's headline) and this board: the four subjects that
 * have a tab of their own as one figure each, two to a row, and the
 * progression as its closing row. Each cell opens its tab, where the whole
 * block lives. The full blocks stay on HQ from 640px up (`max-sm:hidden` in
 * HubScreen); nothing here is computed twice: the figures come from the same
 * view-models the blocks read.
 */

import { useMemo } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import type { TournamentTeam } from "@/engine/types";
import { ladderOf } from "@/engine/career/ladder";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { hqFinanceOf, toolboxOf, toolboxRefusalOf } from "@/store/careerHq";
import { trainingBlockOf } from "@/store/careerTraining";
import { raceLineOf, raceTableOf } from "@/components/career/careerUi";
import { defaultRaceKind } from "@/components/career/hub/RaceBlock";
import { toolboxNameOf } from "@/components/career/hub/ToolboxBlock";
import { AppLink } from "@/components/ui/AppLink";

type Tone = "ink" | "good" | "bad" | "warn" | "sub";

const TONE: Record<Tone, string> = {
  ink: "text-ink",
  good: "text-good",
  bad: "text-bad",
  warn: "text-orange-bright",
  sub: "text-sub",
};

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cell({
  href,
  title,
  figure,
  unit,
  note,
  figureTone = "ink",
  noteTone = "sub",
  wordy = false,
  tour,
  className,
}: {
  href: string;
  title: string;
  figure: string;
  unit?: string;
  note: string;
  figureTone?: Tone;
  noteTone?: Tone;
  /** The figure is words (a training plan's name), not a number: set smaller, on two lines at most. */
  wordy?: boolean;
  tour?: string;
  className?: string;
}) {
  return (
    <AppLink href={href} data-tour={tour} className={cx("flex min-h-[5.5rem] min-w-0 flex-col justify-between gap-2 p-3", className)}>
      <span className="flex items-center justify-between gap-2">
        {/* Tighter than `.kicker`: "Road to Worlds" has to fit half a phone. */}
        <span className="display truncate text-xs font-semibold uppercase tracking-[0.06em] text-sub">{title}</span>
        <span className="max-[359px]:hidden"><Chevron /></span>
      </span>
      <span className="min-w-0">
        <span className={cx("display block font-bold tabular-nums", wordy ? "line-clamp-2 text-base leading-tight" : "truncate text-xl leading-none", TONE[figureTone])}>
          {figure}
          {unit ? <span className="ml-1 text-xs font-semibold text-faint">{unit}</span> : null}
        </span>
        <span className={cx("mt-1.5 block truncate text-xs", TONE[noteTone], noteTone !== "sub" && "font-semibold")}>{note}</span>
      </span>
    </AppLink>
  );
}

export function HubGlance({
  save,
  C,
  team,
  chemTiers,
  className,
}: {
  save: CareerSave;
  C: CareerCopy;
  team: TournamentTeam;
  chemTiers: Record<string, string>;
  className?: string;
}) {
  const ended = save.phase === "ended";
  const Y = C.training.cycle;
  const L = C.ladder;

  // Training: what runs, and how long it has left (or the decision it waits on).
  const tb = useMemo(() => trainingBlockOf(save), [save]);
  const objective = tb.package?.objective ?? null;
  const plan = tb.running && objective ? Y.objectives[objective] : Y.by.base;
  const trainingNote = tb.decision ? C.hub.nowDecision : tb.cycle ? Y.daysLeft(tb.cycle.daysLeft) : Y.cycleOf(tb.period.index + 1, tb.period.count);

  // The race the season is in now (the block's own default tab).
  const table = useMemo(() => raceTableOf(save, save.identity.region, defaultRaceKind(save)), [save]);
  const line = raceLineOf(table);
  const user = table.userRow;
  const raceNote =
    line === "clinched" ? C.race.status.clinched
    : line === "out" ? C.race.status.out
    : line === "inside" ? C.hub.pointsSafe
    : line === "level" ? C.hub.pointsLevel
    : line === "behind" ? C.hub.pointsGap(table.userGap)
    : C.hub.pointsNone;
  const raceTone: Tone = line === "clinched" || line === "inside" ? "good" : line === "out" || line === "behind" ? "bad" : "sub";

  const f = useMemo(() => hqFinanceOf(save), [save]);

  // Progression: what can be bought now, else the next unlock.
  const available = useMemo(
    () => (ended ? [] : toolboxOf(save).filter((i) => i.status === "buyable" && !toolboxRefusalOf(save, i.id))),
    [save, ended],
  );
  const next = useMemo(() => ladderOf(save).find((r) => r.status === "locked") ?? null, [save]);
  const rep = Math.round(save.reputation);

  return (
    <div className={cx("panel overflow-hidden sm:hidden", className)}>
      <div className="grid grid-cols-2">
        <Cell
          href="/career/squad"
          title={C.hub.squadTitle}
          figure={String(Math.round(team.rating.total))}
          unit={C.common.ovr}
          note={`${C.hub.chemistry} ${team.chemistry.percent}% · ${chemTiers[team.chemistry.tier] ?? team.chemistry.tier}`}
          className="border-b border-r border-line"
        />
        <Cell
          href="/career/training"
          tour="hub-training"
          title={C.hub.trainingTitle}
          figure={plan}
          wordy
          note={trainingNote}
          noteTone={tb.decision ? "warn" : "sub"}
          className="border-b border-line"
        />
        <Cell
          href="/career/standings"
          title={C.hub.pointsRace}
          figure={user && line !== "unscored" ? C.hub.pointsRank(user.rank, user.points) : "–"}
          note={raceNote}
          noteTone={raceTone}
          className="border-b border-r border-line"
        />
        <Cell
          href="/career/finances"
          tour="hub-finances"
          title={C.hub.financesTitle}
          figure={formatMoney(f.balance, { compact: true })}
          figureTone={f.balance < 0 ? "bad" : "ink"}
          note={ended ? C.hub.budget : C.hub.financePerWeek(formatMoneyDelta(f.net, { compact: true }))}
          noteTone={ended ? "sub" : f.net >= 0 ? "good" : "bad"}
          className="border-b border-line"
        />
      </div>
      <AppLink href="/career/finances#career-ladder" data-tour="hub-progress" className="flex min-h-12 items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="kicker block">{L.title} · {L.rep(rep)}</span>
          <span className={cx("mt-1 block truncate text-xs", available.length > 0 ? "font-semibold text-orange-bright" : "text-sub")}>
            {available.length > 0
              ? `${C.toolbox.available}: ${available.map((i) => toolboxNameOf(C, i.id)).join(", ")}`
              : next
                ? `${L.next}: ${L.rung[next.id]} · ${L.progress(rep, next.gate)}`
                : L.top}
          </span>
        </span>
        <Chevron />
      </AppLink>
    </div>
  );
}
