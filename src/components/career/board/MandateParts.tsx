"use client";

/**
 * v2.2 ORGMODE 2027 stage 2 (front MANDATE): the board's mandate on screen.
 *
 *  - MandatePrompt: the season's pop-up (portal on <body>, the Modal's
 *    backdrop, scroll lock and focus contract). Three goals, what each gives
 *    and costs, one button. No close: it is the season's first decision, as
 *    the plan choice was, and the sponsor desk opens once it is read.
 *  - MandateSheet: the same content inline (the Board page and HQ's decision
 *    block while it is unread).
 *  - MandateGoals: the Board page during the season: the money and squad
 *    goals with their progress (the classification goal is ObjectiveBoard).
 *  - MandateIssues: the house's problems, a list on the floor.
 *  - MandateHqRows: HQ's season-goal block, the money and squad goals in one
 *    line each.
 *  - MandateVerdict: the season review, the three goals settled.
 *  - MandateDossier: the takeover pick, the demand level, the problems and the
 *    three goals before the player accepts.
 *
 * The card is the material (panel-strong, its hairline, its corner); the
 * header band carries the card's diagonal texture because the mandate is one
 * object. Colour is function only: good and bad on gains and costs.
 */

import { useRef } from "react";
import { createPortal } from "react-dom";
import type { CareerCopy } from "@/content/careerCopy";
import { useCareerCopy } from "@/content/careerCopy";
import { chanceBandOf } from "@/engine/career/board";
import type { BoardMandate, DemandLevel, MandateTerms, MoneyGoal, OrgIssue, SquadGoal } from "@/engine/career/boardTypes";
import { moneyProgressOf, squadProgressOf } from "@/engine/career/mandate";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { seasonLabelFor } from "@/components/career/careerUi";
import { UserOrgMark } from "@/components/career/OrgMark";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDialogFocus, usePageScrollLock } from "@/components/ui/dialog";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { mandateOf, pendingMandateOf } from "@/store/boardFlow";
import { useMounted } from "@/store/useMounted";
import { objectiveText } from "./briefLines";

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function moneyGoalText(C: CareerCopy, g: MoneyGoal): string {
  return C.board.mandate.money(g.kind, formatMoney(g.amount), g.week ?? 0);
}

export function squadGoalText(C: CareerCopy, g: SquadGoal): string {
  return C.board.mandate.squad(g.kind, g.value, g.playerNames ?? []);
}

function becauseOf(C: CareerCopy, kind: string | undefined): string | null {
  if (!kind) return null;
  const title = C.board.mandate.issue[kind];
  return title ? C.board.mandate.because(title) : null;
}

const DEMAND_STEPS: DemandLevel[] = ["low", "medium", "high"];

/** The demand as a figure: the level in display type and a three-step meter under it. */
function DemandFigure({ demand, C, align = "right" }: { demand: DemandLevel; C: CareerCopy; align?: "left" | "right" }) {
  const K = C.board.mandate;
  const n = DEMAND_STEPS.indexOf(demand) + 1;
  return (
    <div className={cx("shrink-0", align === "right" ? "text-right" : "text-left")}>
      <p className="display text-2xl font-bold uppercase leading-none text-ink sm:text-[1.75rem]">{K.demand[demand]}</p>
      <div className={cx("mt-2 flex gap-1", align === "right" ? "justify-end" : "justify-start")} aria-hidden>
        {DEMAND_STEPS.map((_, i) => (
          <span key={i} className={cx("h-1.5 w-6 rounded-sm", i < n ? "bg-ink" : "bg-white/10")} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-sub">{K.demandLabel}</p>
    </div>
  );
}

/** What a goal gives or costs: each term as a figure with its unit, one per line. */
function Terms({ t, tone, C, compact }: { t: MandateTerms; tone: "good" | "bad"; C: CareerCopy; compact?: boolean }) {
  const K = C.board.mandate;
  const color = tone === "good" ? "text-good" : "text-bad";
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
  const items: { value: string; unit: string }[] = [];
  if (t.confidence) items.push({ value: `${sign(t.confidence)}${Math.abs(t.confidence)}`, unit: K.confidenceUnit });
  if (t.budget) items.push({ value: `${sign(t.budget)}${Math.round(Math.abs(t.budget) * 100)}%`, unit: K.budgetUnit });
  if (t.bonus > 0) items.push({ value: formatMoney(t.bonus, { compact: true }), unit: K.bonusUnit });
  if (!items.length) return <span className="text-faint">{K.noChange}</span>;
  return (
    <span className={cx(compact ? "flex flex-wrap gap-x-3 gap-y-0.5" : "flex flex-col gap-0.5")}>
      {items.map((i) => (
        <span key={i.unit} className="leading-snug">
          <span className={cx("display text-[15px] font-bold tabular-nums", color)}>{i.value}</span> <span className="text-sub">{i.unit}</span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The mandate as a sheet (the pop-up's body, and inline while unread)
// ---------------------------------------------------------------------------

interface GoalView {
  key: "classification" | "money" | "squad";
  text: string;
  note: string | null;
  gain: MandateTerms;
  loss: MandateTerms;
}

function goalViewsOf(C: CareerCopy, m: BoardMandate): GoalView[] {
  return [
    {
      key: "classification",
      text: objectiveText(C, m.classification.objective),
      note: C.board.likely(chanceBandOf(m.classification.objective.chance ?? 0)),
      gain: m.classification.gain,
      loss: m.classification.loss,
    },
    { key: "money", text: moneyGoalText(C, m.money), note: becauseOf(C, m.money.issue), gain: m.money.gain, loss: m.money.loss },
    { key: "squad", text: squadGoalText(C, m.squad), note: becauseOf(C, m.squad.issue), gain: m.squad.gain, loss: m.squad.loss },
  ];
}

function GoalRow({ g, i, C }: { g: GoalView; i: number; C: CareerCopy }) {
  const K = C.board.mandate;
  return (
    <li className="grid gap-x-6 gap-y-3 border-b border-line py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_12.5rem] sm:py-5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="display text-sm font-bold tabular-nums text-faint">{i + 1}</span>
          <span className="display text-sm font-semibold uppercase tracking-[0.04em] text-ink">{K.area[g.key]}</span>
          {g.key === "classification" ? <Badge>{K.weighsMost}</Badge> : null}
        </p>
        <p className="display mt-1.5 text-xl uppercase leading-[1.05] text-ink [overflow-wrap:break-word] sm:text-[1.6rem]">{g.text}</p>
        {g.note ? <p className="mt-1.5 text-sm leading-snug text-sub">{g.note}</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-1 sm:content-start sm:gap-y-3 sm:border-l sm:border-line sm:pl-5">
        <div className="min-w-0">
          <dt className="text-sub">{K.gainLabel}</dt>
          <dd className="mt-1">
            <Terms t={g.gain} tone="good" C={C} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sub">{K.lossLabel}</dt>
          <dd className="mt-1">
            <Terms t={g.loss} tone="bad" C={C} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

/** Last season in brief: the three verdicts and a demand change, when the board set one before. */
function LastSeason({ m, C }: { m: BoardMandate; C: CareerCopy }) {
  const last = m.last;
  if (!last) return null;
  const K = C.board.mandate;
  const up = DEMAND_STEPS.indexOf(m.demand) - DEMAND_STEPS.indexOf(last.demand);
  return (
    <div className="border-t border-line py-4">
      <p className="text-xs text-sub">{K.lastTitle}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {(["classification", "money", "squad"] as const).map((a) => (
          <li key={a} className="flex items-center gap-2 text-sm text-ink">
            <span>{K.area[a]}</span>
            {last.met[a] === null ? (
              <Badge>{C.goals.status.open}</Badge>
            ) : (
              <Badge tone={last.met[a] ? "good" : "bad"}>{last.met[a] ? C.goals.status.met : C.goals.status.missed}</Badge>
            )}
          </li>
        ))}
      </ul>
      {up !== 0 ? <p className="mt-2 text-sm text-sub">{up > 0 ? K.demandUp : K.demandDown}</p> : null}
    </div>
  );
}

export function MandateSheet({
  save,
  m,
  C,
  onAccept,
  titleId,
  inline,
}: {
  save: CareerSave;
  m: BoardMandate;
  C: CareerCopy;
  onAccept?: () => void;
  titleId?: string;
  /** On a page (no dialog chrome): the header without the texture band, the action at the end. */
  inline?: boolean;
}) {
  const K = C.board.mandate;
  const views = goalViewsOf(C, m);
  const header = (
    <div className={cx(inline ? "" : "card-texture border-b border-line px-4 pb-4 pt-4 sm:px-7 sm:pb-5 sm:pt-6")}>
      <div className="flex items-center gap-3">
        <UserOrgMark identity={save.identity} seasonIndex={save.clock.seasonIndex} size="md" loading="eager" />
        <p className="min-w-0 text-xs leading-snug text-sub">
          <span className="block truncate font-semibold text-ink">{save.identity.orgName}</span>
          {K.season(seasonLabelFor(m.seasonIndex))}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 id={titleId} className="display text-3xl uppercase leading-[0.95] text-ink sm:text-[2.6rem]">
          {K.title}
        </h2>
        <DemandFigure demand={m.demand} C={C} />
      </div>
      <p className="mt-3 max-w-xl text-sm leading-snug text-sub">
        {K.body} <span className="text-ink">{K.demandNote[m.demand]}</span>
      </p>
    </div>
  );
  const goals = (
    <>
      <ol className={cx(inline ? "mt-2" : "")}>
        {views.map((g, i) => (
          <GoalRow key={g.key} g={g} i={i} C={C} />
        ))}
      </ol>
      <LastSeason m={m} C={C} />
    </>
  );
  const action = onAccept ? (
    <Button variant="primary" size="lg" onClick={onAccept} className="max-sm:w-full sm:px-8">
      {K.accept}
    </Button>
  ) : null;

  if (inline) {
    return (
      <div>
        {header}
        {goals}
        {action ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 max-sm:sticky max-sm:bottom-[calc(57px+env(safe-area-inset-bottom))] max-sm:z-20 max-sm:-mx-4 max-sm:bg-surface-strong max-sm:px-4 max-sm:py-2.5">
            <p className="text-xs text-faint max-sm:hidden">{K.keptNote}</p>
            {action}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <>
      <div className="shrink-0">{header}</div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-7">{goals}</div>
      {action ? (
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-4 py-3 sm:px-7 sm:py-4">
          <p className="text-xs leading-snug text-faint max-sm:hidden">{K.keptNote}</p>
          {action}
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// The pop-up
// ---------------------------------------------------------------------------

/**
 * The season's mandate, on every career screen while it is unread (CareerShell
 * mounts it). The only way out is its one action: the clock holds on it as it
 * held on the plan choice.
 */
export function MandatePrompt() {
  const save = useCareerStore(selectActiveSave);
  const acknowledge = useCareerStore((s) => s.acknowledgeMandate);
  const C = useCareerCopy();
  const host = useMounted() ? document.body : null;
  const m = save ? pendingMandateOf(save) : null;
  const shown = host !== null && m !== null && save !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  usePageScrollLock(shown);
  useDialogFocus(panelRef, shown, {});
  if (!shown || !m || !save) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="mandate-title">
      {/* The Modal's backdrop classes (the lite-fx fallback matches them); it does not dismiss. */}
      <div aria-hidden className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ outline: "none" }}
        className="panel-strong pop-in relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
      >
        <MandateSheet save={save} m={m} C={C} onAccept={acknowledge} titleId="mandate-title" />
      </div>
    </div>,
    host,
  );
}

// ---------------------------------------------------------------------------
// During the season
// ---------------------------------------------------------------------------

interface ProgressView {
  key: "money" | "squad";
  text: string;
  now: string;
  /** 0-1 toward the goal, when a bar reads. */
  bar: number | null;
  met: boolean | null;
  onTrack: boolean;
  lost: boolean;
  gain: MandateTerms;
  loss: MandateTerms;
  note: string | null;
}

function progressViewsOf(save: CareerSave, m: BoardMandate, C: CareerCopy): ProgressView[] {
  const K = C.board.mandate;
  const mp = moneyProgressOf(save, m.money);
  const sp = squadProgressOf(save, m.squad);
  const ratio = (now: number, target: number, sense: "under" | "over") =>
    target <= 0 ? null : sense === "over" ? Math.max(0, Math.min(1, now / target)) : null;
  return [
    {
      key: "money",
      text: moneyGoalText(C, m.money),
      now: K.moneyNow(m.money.kind, formatMoney(mp.now, { compact: true })),
      bar: ratio(mp.now, mp.target, mp.sense),
      met: m.money.met,
      onTrack: mp.onTrack,
      lost: Boolean(mp.settled && !mp.onTrack),
      gain: m.money.gain,
      loss: m.money.loss,
      note: becauseOf(C, m.money.issue),
    },
    {
      key: "squad",
      text: squadGoalText(C, m.squad),
      now: K.squadNow(m.squad.kind, sp.now, sp.target),
      bar: m.squad.kind === "youthEvents" || m.squad.kind === "keepCore" ? ratio(sp.now, sp.target, "over") : null,
      met: m.squad.met,
      onTrack: sp.onTrack,
      lost: Boolean(sp.settled && !sp.onTrack),
      gain: m.squad.gain,
      loss: m.squad.loss,
      note: becauseOf(C, m.squad.issue),
    },
  ];
}

function StatusTag({ v, C }: { v: Pick<ProgressView, "met" | "onTrack" | "lost">; C: CareerCopy }) {
  if (v.met === true) return <Badge tone="good">{C.goals.status.met}</Badge>;
  if (v.met === false) return <Badge tone="bad">{C.goals.status.missed}</Badge>;
  if (v.lost) return <Badge tone="bad">{C.goals.status.out}</Badge>;
  return v.onTrack ? <Badge tone="good">{C.board.mandate.onTrack}</Badge> : <Badge tone="orange">{C.board.mandate.behind}</Badge>;
}

/** The Board page: the mandate's money and squad goals with today's figures (the classification goal is the object above). */
export function MandateGoals({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const m = mandateOf(save);
  if (!m || !m.acknowledged) return null;
  const K = C.board.mandate;
  const views = progressViewsOf(save, m, C);
  return (
    <section className="panel p-4 sm:p-5">
      <div className="card-head">
        <h3 className="card-title">{K.title}</h3>
        <span className="text-xs font-semibold text-sub">{K.demandLine(m.demand)}</span>
      </div>
      <ul>
        {views.map((v) => (
          <li key={v.key} className="border-b border-line py-3.5 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="display text-sm font-semibold uppercase tracking-[0.04em] text-sub">{K.area[v.key]}</span>
              <StatusTag v={v} C={C} />
            </div>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{v.text}</p>
            <p className="mt-1 text-sm text-sub">{v.now}</p>
            {v.bar !== null ? (
              <div className="mt-2 h-1.5 rounded-sm bg-white/10" aria-hidden>
                <div className={cx("h-1.5 rounded-sm", v.lost ? "bg-bad" : "bg-blue-bright/80")} style={{ width: `${Math.round(v.bar * 100)}%` }} />
              </div>
            ) : null}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sub">{K.gainLabel}</span>
                <Terms t={v.gain} tone="good" C={C} compact />
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sub">{K.lossLabel}</span>
                <Terms t={v.loss} tone="bad" C={C} compact />
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The house's problems: one row each, the problem's name and the sentence that proves it. */
export function MandateIssues({ issues, C, title, note, className }: { issues: readonly OrgIssue[]; C: CareerCopy; title?: string; note?: string; className?: string }) {
  const K = C.board.mandate;
  return (
    <section className={className}>
      <h3 className="card-title">{title ?? K.issuesTitle}</h3>
      {note ? <p className="mt-1 text-xs leading-snug text-sub">{note}</p> : null}
      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-sub">{K.noIssues}</p>
      ) : (
        <ul className="mt-2 border-t border-line">
          {issues.map((i) => (
            <li key={i.kind} className="flex min-h-12 items-baseline gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="w-[42%] shrink-0 text-sm font-semibold leading-snug text-ink sm:w-44">{K.issue[i.kind] ?? i.kind}</span>
              <span className="min-w-0 flex-1 text-sm leading-snug text-sub">{K.issueLine(i.kind, i.value, i.playerName)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** HQ's season-goal block: the mandate's money and squad goals under the classification rows, one line each. */
export function MandateHqRows({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const m = mandateOf(save);
  if (!m || !m.acknowledged) return null;
  const K = C.board.mandate;
  const views = progressViewsOf(save, m, C);
  return (
    <ul className="mt-3 border-t border-line">
      {views.map((v) => (
        <li key={v.key} className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-b-0">
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-sub">{K.area[v.key]}</span>
            <span className="block text-sm font-semibold leading-snug text-ink">{v.text}</span>
            <span className="block text-xs text-faint">{v.now}</span>
          </span>
          <StatusTag v={v} C={C} />
        </li>
      ))}
    </ul>
  );
}

/** HQ's line while the mandate is unread (the pop-up is on screen; this is what sits under it). */
export function MandatePendingLine({ C }: { C: CareerCopy }) {
  return (
    <>
      <p className="text-sm leading-snug text-sub">{C.board.mandate.pending}</p>
      <AppLink href="/career/board" className="mt-1.5 inline-flex min-h-11 items-center text-sm font-semibold text-blue-bright hover:underline">
        {C.board.mandate.reread}
      </AppLink>
    </>
  );
}

/** The season review: the money and squad goals settled, with what each changed (the classification is the verdict's objective). */
export function MandateVerdict({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const m = mandateOf(save);
  if (!m || m.money.met === null || m.squad.met === null) return null;
  const K = C.board.mandate;
  const rows = [
    { key: "money" as const, text: moneyGoalText(C, m.money), met: m.money.met, t: m.money.met ? m.money.gain : m.money.loss },
    { key: "squad" as const, text: squadGoalText(C, m.squad), met: m.squad.met, t: m.squad.met ? m.squad.gain : m.squad.loss },
  ];
  return (
    <ul className="mt-4 border-t border-line">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-3 last:border-b-0">
          <span className="min-w-0 flex-1 basis-56">
            <span className="block text-xs text-sub">{K.area[r.key]}</span>
            <span className="block text-[15px] font-semibold leading-snug text-ink">{r.text}</span>
            <span className="mt-1 block text-xs">
              <Terms t={r.t} tone={r.met ? "good" : "bad"} C={C} compact />
            </span>
          </span>
          <Badge tone={r.met ? "good" : "bad"}>{r.met ? C.goals.status.met : C.goals.status.missed}</Badge>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The takeover pick
// ---------------------------------------------------------------------------

/** The dossier's board section: the demand, the problems and the three goals, before the player accepts. */
export function MandateDossier({ m, C }: { m: BoardMandate; C: CareerCopy }) {
  const K = C.board.mandate;
  const views = goalViewsOf(C, m);
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h4 className="card-title">{K.dossierTitle}</h4>
          <p className="mt-1 text-xs leading-snug text-sub">{K.dossierNote}</p>
        </div>
        <DemandFigure demand={m.demand} C={C} />
      </div>
      <p className="mt-3 text-sm text-ink">{K.demandNote[m.demand]}</p>
      <MandateIssues issues={m.issues} C={C} className="mt-5" />
      <ol className="mt-5 border-t border-line">
        {views.map((g, i) => (
          <li key={g.key} className="border-b border-line py-3 last:border-b-0">
            <p className="flex items-center gap-2 text-xs">
              <span className="display text-sm font-bold tabular-nums text-faint">{i + 1}</span>
              <span className="display text-sm font-semibold uppercase tracking-[0.04em] text-sub">{K.area[g.key]}</span>
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">{g.text}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sub">{K.gainLabel}</span>
                <Terms t={g.gain} tone="good" C={C} compact />
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sub">{K.lossLabel}</span>
                <Terms t={g.loss} tone="bad" C={C} compact />
              </span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
