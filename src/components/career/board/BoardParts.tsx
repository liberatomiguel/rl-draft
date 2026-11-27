"use client";

/**
 * v2.2 board: the board's pieces. rc.6 (ORGMODE UI-B) is the UI pass the
 * board front left them for ("functional and plain").
 *
 *  - BoardPackageChoice: the season plan, the season's opening decision (HQ's
 *    decision block and the Board page). The brief above, three plans as cards
 *    (rows on a phone), the board's proposal marked and preselected, one filled
 *    action.
 *  - BoardSeasonPanel: the season review's board: the verdict and a tier
 *    change, the dismissal with its offers as org rows, an approach.
 *  - The Board page's boards (BoardScreen composes them): the objective (the
 *    focal object), the ultimatum, the other asks, confidence with its meter
 *    and log, the standing track, the manager, the board-funded upgrade and the
 *    season's money.
 *
 * A founded club (board.kind "owners") reads through the same pieces: no
 * brief, no standing, "owners" in the copy. With FEATURES.board off there is
 * no `save.board` and nothing here renders.
 */

import { useState } from "react";
import { CAREER_BOARD } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { chanceBandOf, missionProgressOf, type ChanceBand } from "@/engine/career/board";
import type { BoardPackage, BoardState, JobOffer, PackageId } from "@/engine/career/boardTypes";
import { seasonBudgetOf } from "@/engine/career/budget";
import { weekOfDay } from "@/engine/career/calendar";
import { promoteLineOf, STANDING_TIERS, standingOf } from "@/engine/career/established";
import { seasonGoalProgressOf } from "@/engine/career/seasonGoals";
import type { CareerSave, SeasonGoalSpec } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useCareerStore } from "@/store/careerStore";
import { boardUpgradeOptionsOf, pendingJobChoiceOf, pendingPackageOf, wageRoomNow } from "@/store/boardFlow";
import { briefLinesOf, objectiveText } from "./briefLines";

/** The board's objective as a sentence ("Top 4 in 3 of the 9 regionals"). */
export function goalText(C: CareerCopy, spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">): string {
  return objectiveText(C, spec);
}

const BAND_ORDER: ChanceBand[] = ["longShot", "stretch", "reach", "expected"];
const owners = (board: BoardState | undefined | null) => board?.kind === "owners";

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("h-4 w-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A figure with its quiet label under it (DESIGN.md: numbers are set as numbers). */
function Figure({ value, label, tone = "text-ink", size = "text-xl", note }: { value: string; label: string; tone?: string; size?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className={cx("display font-bold leading-none tabular-nums", size, tone)}>{value}</p>
      <p className="mt-1.5 text-xs text-sub">{label}</p>
      {note ? <p className="mt-0.5 text-xs text-faint">{note}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

/** The board's brief: why it asks what it asks this season (established orgs only). */
export function BoardBrief({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  const lines = briefLinesOf(C, save.board?.season?.brief, save.identity.orgName);
  if (!lines) return null;
  return (
    <div className={className}>
      <p className="text-xs text-sub">{C.board.brief.heading}</p>
      <p className="mt-1 max-w-2xl text-[15px] leading-snug text-ink">{lines.reason}</p>
      {lines.facts.length ? <p className="mt-1 text-sm text-sub">{lines.facts.join(" ")}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The season plan
// ---------------------------------------------------------------------------

function PlanOption({ o, active, proposedLabel, onPick, C }: { o: BoardPackage; active: boolean; proposedLabel: string; onPick: () => void; C: CareerCopy }) {
  const K = C.board.packages;
  const band = chanceBandOf(o.objective.chance ?? 0);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={cx(
        "panel flex w-full flex-col p-4 text-left max-sm:py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-bright",
        active ? "panel-glow-orange" : "hover:!border-line-strong",
      )}
    >
      <span className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="display text-lg font-bold uppercase leading-none text-ink">{K.name[o.id]}</span>
        {o.id === "expected" ? <Badge tone="orange">{proposedLabel}</Badge> : null}
      </span>
      <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink">{goalText(C, o.objective)}</span>
      <span className="mt-1 block text-sm text-sub">{K.band(band)}</span>
      {/* A phone row carries the terms as one line; the card sets them as figures. */}
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-sub sm:hidden">
        <span><span className="display text-sm font-bold tabular-nums text-ink">{o.grant > 0 ? formatMoney(o.grant, { compact: true }) : "–"}</span> <span className="lowercase">{K.budgetLabel}</span></span>
        <span><span className="display text-sm font-bold tabular-nums text-ink">{o.bonus > 0 ? formatMoney(o.bonus, { compact: true }) : "–"}</span> <span className="lowercase">{K.bonusLabel}</span></span>
        <span>
          <span className="display text-sm font-bold tabular-nums text-good">+{o.hit}</span>
          <span className="text-faint"> / </span>
          <span className="display text-sm font-bold tabular-nums text-bad">−{Math.abs(o.miss)}</span> <span className="lowercase">{K.confidenceLabel}</span>
        </span>
      </span>
      <span className="mt-4 grid w-full grid-cols-2 gap-x-4 border-t border-line pt-3 max-sm:hidden sm:mt-auto">
        <span className="min-w-0">
          <span className="display block truncate text-lg font-bold leading-none tabular-nums text-ink">{o.grant > 0 ? formatMoney(o.grant, { compact: true }) : "–"}</span>
          <span className="mt-1 block text-xs text-sub">{K.budgetLabel}</span>
        </span>
        <span className="min-w-0">
          <span className="display block truncate text-lg font-bold leading-none tabular-nums text-ink">{o.bonus > 0 ? formatMoney(o.bonus, { compact: true }) : "–"}</span>
          <span className="mt-1 block text-xs text-sub">{K.bonusLabel}</span>
        </span>
      </span>
      <span className="mt-3 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5 max-sm:hidden">
        <span className="text-xs text-sub">{K.confidenceLabel}</span>
        <span className="text-xs text-sub">
          <span className="display text-base font-bold tabular-nums text-good">+{o.hit}</span> {K.hitLabel}
          <span className="mx-1.5 text-faint">·</span>
          <span className="display text-base font-bold tabular-nums text-bad">−{Math.abs(o.miss)}</span> {K.missLabel}
        </span>
      </span>
    </button>
  );
}

/** The season plan: the brief, the three plans (the board's proposal preselected), one filled action. */
export function BoardPackageChoice({ save, C, titleAs = "h2" }: { save: CareerSave; C: CareerCopy; titleAs?: "h1" | "h2" }) {
  const offers = pendingPackageOf(save);
  const choose = useCareerStore((s) => s.chooseBoardPackage);
  const [pick, setPick] = useState<PackageId>("expected");
  if (!offers) return null;
  const K = C.board.packages;
  const own = owners(save.board);
  const Title = titleAs;
  const chosen = offers.some((o) => o.id === pick) ? pick : offers[0].id;
  return (
    <div>
      <Title className="display text-2xl uppercase leading-none text-ink sm:text-3xl">{K.title}</Title>
      <p className="mt-2 max-w-2xl text-sm leading-snug text-sub">{own ? K.ownersBody : K.body}</p>
      <BoardBrief save={save} C={C} className="mt-4" />
      <div role="radiogroup" aria-label={K.title} className="phone-rows mt-4 sm:grid sm:grid-cols-3 sm:gap-3">
        {offers.map((o) => (
          <PlanOption key={o.id} o={o} C={C} active={chosen === o.id} proposedLabel={own ? K.ownersRecommended : K.recommended} onPick={() => setPick(o.id)} />
        ))}
      </div>
      {/* On a phone the action stays on the bottom edge while the three plans scroll by (sticky inside its board). */}
      <div className="mt-4 max-sm:sticky max-sm:bottom-[calc(57px+env(safe-area-inset-bottom))] max-sm:z-20 max-sm:-mx-4 max-sm:border-t max-sm:border-line max-sm:bg-surface-strong max-sm:px-4 max-sm:py-2.5">
        <Button variant="primary" size="lg" className="max-sm:w-full" onClick={() => choose(chosen)}>
          {K.acceptPlan(K.name[chosen])}
        </Button>
      </div>
    </div>
  );
}

/** HQ's decision block body for kind "board". */
export function BoardDecision({ save, C }: { save: CareerSave; C: CareerCopy }) {
  if (pendingPackageOf(save)) return <BoardPackageChoice save={save} C={C} />;
  if (pendingJobChoiceOf(save)) {
    return (
      <div>
        <h2 className="display text-2xl uppercase leading-none text-ink sm:text-3xl">{C.board.dismissed.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-snug text-sub">{C.board.dismissed.body(save.identity.orgName)}</p>
        <AppLink href="/career/season" className={cx(buttonClass("primary", "lg"), "mt-4 max-sm:w-full")}>
          {C.board.dismissed.offers}
        </AppLink>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// The season review
// ---------------------------------------------------------------------------

function OfferRow({ save, o, C, onAccept, label }: { save: CareerSave; o: JobOffer; C: CareerCopy; onAccept: () => void; label: string }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      {o.ref ? <OrgMark save={save} orgRef={o.ref} size="md" /> : null}
      <span className="min-w-0 flex-1">
        {/* rc.6 (UI-C phone pass): two lines on a phone; one truncated line left "TEAM V..." at 375 px. */}
        <span className="display break-words text-base font-bold uppercase leading-tight text-ink line-clamp-2 sm:block sm:truncate sm:text-lg sm:leading-none">{o.name}</span>
        <span className="mt-1 block text-xs text-sub">
          <span className="font-semibold text-ink">{C.board.stature[o.stature] ?? o.stature}</span> · {o.region}
          {o.rank ? <> · {C.board.dismissed.rankLine(o.rank)}</> : null}
        </span>
      </span>
      {o.rating ? (
        <span className="shrink-0 text-right leading-none max-[359px]:hidden">
          <span className="display block text-xl font-bold tabular-nums text-ink">{Math.round(o.rating)}</span>
          <span className="mt-1 block text-[11px] text-faint">{C.common.ovr}</span>
        </span>
      ) : null}
      <Button variant="secondary" size="sm" className="shrink-0" onClick={onAccept}>{label}</Button>
    </li>
  );
}

function TierChangeRow({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const t = save.board?.tierChange;
  if (!t || t.seasonIndex !== save.clock.seasonIndex) return null;
  const up = STANDING_TIERS.indexOf(t.to) > STANDING_TIERS.indexOf(t.from);
  const T = C.board.standing.tier;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone={up ? "good" : "bad"}>{up ? C.board.verdict.tierUp : C.board.verdict.tierDown}</Badge>
        <p className="display text-xl font-bold uppercase leading-none text-ink">
          <span className="text-faint">{T[t.from] ?? t.from}</span>
          <Chevron className="mx-1.5 inline h-4 w-4 align-[-2px] text-faint" />
          {T[t.to] ?? t.to}
        </p>
      </div>
      <p className="mt-1.5 text-sm text-sub">{C.board.verdict.tierNote(up)}</p>
    </div>
  );
}

/** The season review's board: the verdict (and a tier change), the dismissal and its offers, or an approach. */
export function BoardSeasonPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const accept = useCareerStore((s) => s.acceptJobOffer);
  const decline = useCareerStore((s) => s.declineJobOffer);
  const board = save.board;
  const manager = save.manager;
  if (!board || !manager || save.phase !== "seasonReview") return null;
  const dismissed = board.dismissedSeason === save.clock.seasonIndex;
  const offers = manager.offers ?? [];
  if (manager.accepted) {
    return (
      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {manager.accepted.ref ? <OrgMark save={save} orgRef={manager.accepted.ref} size="md" /> : null}
          <p className="text-[15px] font-semibold text-ink">{C.board.dismissed.accepted(manager.accepted.name)}</p>
        </div>
      </Panel>
    );
  }
  if (!dismissed && offers.length === 0) {
    const pkg = board.season?.choice ? board.season.offers.find((o) => o.id === board.season?.choice) : null;
    if (!pkg || board.season?.met === null || board.season?.met === undefined) return null;
    const V = C.board.verdict;
    const met = board.season.met;
    return (
      <Panel className="p-4 sm:p-5">
        <div className="card-head">
          <h3 className="card-title">{owners(board) ? C.board.ownersTitle : V.title}</h3>
          <Badge tone={met ? "good" : "bad"}>{met ? C.goals.status.met : C.goals.status.missed}</Badge>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-xs text-sub">{C.board.sporting} · {C.board.packages.plan(C.board.packages.name[pkg.id])}</p>
            <p className="display mt-1.5 text-2xl uppercase leading-tight text-ink">{goalText(C, pkg.objective)}</p>
          </div>
          <Figure value={String(Math.round(board.confidence))} label={V.confidenceLabel} size="text-4xl" note={C.board.band(board.confidence)} />
        </div>
        <TierChangeRow save={save} C={C} />
        <AppLink href="/career/board" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-blue-bright hover:underline">
          {V.open}
          <Chevron />
        </AppLink>
      </Panel>
    );
  }
  const D = C.board.dismissed;
  const orgOffers = offers.filter((o) => o.kind === "org");
  const found = offers.find((o) => o.kind === "found");
  return (
    <Panel className={cx("rise-in p-4 sm:p-5", dismissed ? "panel-glow-orange" : "panel-glow-blue")}>
      <h3 className="display text-2xl uppercase leading-none text-ink">{dismissed ? D.title : C.board.approach.title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-snug text-sub">
        {dismissed ? D.body(save.identity.orgName) : C.board.approach.body(offers[0]?.name ?? "")}
      </p>
      {orgOffers.length ? (
        <>
          {dismissed ? <p className="mt-4 text-xs text-sub">{D.orgsLabel}</p> : null}
          <ul className={cx("border-t border-line", dismissed ? "mt-1.5" : "mt-4")}>
            {orgOffers.map((o) => (
              <OfferRow key={o.id} save={save} o={o} C={C} onAccept={() => accept(o.id)} label={dismissed ? D.accept : C.board.approach.accept} />
            ))}
          </ul>
        </>
      ) : null}
      {found ? (
        <>
          <p className="mt-4 text-xs text-sub">{D.orLabel}</p>
          <div className="mt-1.5 flex min-h-16 items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="display block text-lg font-bold uppercase leading-none text-ink">{D.found}</span>
              <span className="mt-1 block text-xs leading-snug text-sub">{D.foundBody(found.name)}</span>
            </span>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={() => accept(found.id)}>{D.accept}</Button>
          </div>
        </>
      ) : null}
      {!dismissed ? (
        <Button variant="ghost" size="md" className="mt-3" onClick={decline}>{C.board.approach.decline}</Button>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// The Board page
// ---------------------------------------------------------------------------

function goalCtx(save: CareerSave) {
  return {
    seasonIndex: save.clock.seasonIndex,
    today: { seasonIndex: save.clock.seasonIndex, day: save.clock.day },
    results: save.eventResults,
    majorFieldRefs: save.competition.majorFieldRefs,
    worldsFieldRefs: save.competition.worldsFieldRefs,
    over: save.phase !== "running",
  };
}

/** This season's chosen plan, when the season on the board is the save's. */
export function chosenPlanOf(save: CareerSave): BoardPackage | null {
  const season = save.board?.season;
  if (!season || season.seasonIndex !== save.clock.seasonIndex || !season.choice) return null;
  return season.offers.find((o) => o.id === season.choice) ?? null;
}

/** The objective's progress for the HQ figure and the Board page. */
export function boardObjectiveProgressOf(save: CareerSave): { done: number; target: number; met: boolean | null; out: boolean; left: number } | null {
  const pkg = chosenPlanOf(save);
  if (!pkg) return null;
  const p = seasonGoalProgressOf(pkg.objective, goalCtx(save));
  return { done: Math.min(p.done, p.target), target: p.target, met: save.board?.season?.met ?? null, out: p.out, left: p.left };
}

/** The focal object: the chosen objective, its progress, its band at the start and now. */
export function ObjectiveBoard({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const season = save.board?.season;
  const pkg = chosenPlanOf(save);
  const p = boardObjectiveProgressOf(save);
  if (!season || !pkg || !p) return null;
  const K = C.board.packages;
  const start = chanceBandOf(season.startChance ?? pkg.objective.chance ?? 0);
  const now = (season.bandNow as ChanceBand | undefined) ?? start;
  const drift = BAND_ORDER.indexOf(now) - BAND_ORDER.indexOf(start);
  const status =
    p.met === true ? { text: C.goals.status.met, tone: "good" as const }
    : p.met === false ? { text: C.goals.status.missed, tone: "bad" as const }
    : p.out ? { text: C.goals.status.out, tone: "bad" as const }
    : p.done >= p.target ? { text: C.goals.status.done, tone: "good" as const }
    : null;
  return (
    <Panel strong className="p-5 sm:p-7">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sub">
        <span>{C.board.sporting}</span>
        <span aria-hidden>·</span>
        <span className="font-semibold text-ink">{K.plan(K.name[pkg.id])}</span>
      </p>
      <h2 className="display mt-3 max-w-3xl text-3xl uppercase leading-[0.95] text-ink [overflow-wrap:break-word] sm:text-[2.5rem]">{goalText(C, pkg.objective)}</h2>

      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <p className="display text-5xl font-bold leading-none tabular-nums text-ink">
          {p.done}
          <span className="ml-1.5 text-2xl text-faint">/ {p.target}</span>
        </p>
        <div className="min-w-0 flex-1 basis-40 pb-1">
          <ProgressBar value={p.done / p.target} tone={p.met === false || p.out ? "orange" : "blue"} label={C.board.progressOf(p.done, p.target)} />
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-sub">
            {status ? <Badge tone={status.tone}>{status.text}</Badge> : <span>{C.goals.left(p.left, pkg.objective.kind)}</span>}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 border-t border-line pt-4">
        <div className="min-w-0">
          <dt className="text-xs text-sub">{C.board.bandStart}</dt>
          <dd className="display mt-1 text-lg font-bold uppercase leading-tight text-ink">{K.band(start)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-sub">{C.board.bandNowLabel}</dt>
          <dd className={cx("display mt-1 text-lg font-bold uppercase leading-tight", drift > 0 ? "text-good" : drift < 0 ? "text-bad" : "text-ink")}>{K.band(now)}</dd>
          {drift === 0 ? <dd className="mt-0.5 text-xs text-faint">{C.board.bandSame}</dd> : null}
        </div>
      </dl>
      <p className="mt-4 text-sm leading-snug text-sub">{C.board.planTerms(formatMoney(pkg.bonus), pkg.hit, pkg.miss)}</p>
    </Panel>
  );
}

/** An active ultimatum: its own board on an orange hairline. */
export function UltimatumBoard({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const u = save.board?.ultimatum;
  if (!u || u.issuedSeason !== save.clock.seasonIndex) return null;
  const U = C.board.ultimatum;
  const m = missionProgressOf(u, save.eventResults);
  const done = Math.min(m.done, m.target);
  return (
    <Panel className={cx("p-4 sm:p-5", u.status === "met" ? "panel-glow-blue" : "panel-glow-orange")}>
      <div className="card-head">
        <h3 className="card-title">{U.title}</h3>
        {u.status === "met" ? <Badge tone="good">{C.goals.status.met}</Badge> : <Badge tone="orange">{C.goals.status.open}</Badge>}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p className="display min-w-0 flex-1 basis-56 text-2xl uppercase leading-tight text-ink">{goalText(C, u.objective)}</p>
        <p className="display text-4xl font-bold leading-none tabular-nums text-ink">
          {done}
          <span className="ml-1 text-xl text-faint">/ {m.target}</span>
        </p>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-snug text-sub">{u.status === "met" ? U.met : `${U.body} ${U.chance(chanceBandOf(u.objective.chance ?? 0))}`}</p>
    </Panel>
  );
}

/** The secondary and legacy asks: a list on the floor, not boxes. */
export function AlsoAsked({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const board = save.board;
  const season = board?.season;
  if (!board || !season || season.seasonIndex !== save.clock.seasonIndex || !season.choice) return null;
  const rows: { key: string; label: string; text: string; note?: string; met: boolean | null }[] = [];
  if (season.secondary) {
    const s = season.secondary;
    rows.push({ key: "secondary", label: C.board.secondary, text: C.board.secondaryLabel(s.kind, s.kind === "wages" ? formatMoney(wageRoomNow(board, save.clock.seasonIndex)) : String(s.value)), met: s.met });
  }
  if (season.legacy) rows.push({ key: "legacy", label: C.board.legacy, text: goalText(C, season.legacy.objective), note: C.board.legacyNote, met: season.legacy.met });
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="card-title">{C.board.alsoAsked}</h3>
      <p className="mt-1 text-xs text-sub">{C.board.alsoNote}</p>
      <ul className="mt-2 border-t border-line">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-14 items-center gap-3 border-b border-line py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-sub">{r.label}</span>
              <span className="mt-0.5 block text-sm font-semibold leading-snug text-ink">{r.text}</span>
              {r.note ? <span className="block text-xs text-faint">{r.note}</span> : null}
            </span>
            <Badge tone={r.met === true ? "good" : r.met === false ? "bad" : "neutral"} className="shrink-0">
              {r.met === true ? C.goals.status.met : r.met === false ? C.goals.status.missed : C.goals.status.open}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Confidence: the large figure, the meter with its two labelled lines, the state sentence, the log. */
export function ConfidencePanel({ board, C }: { board: BoardState; C: CareerCopy }) {
  const L = CAREER_BOARD.confidence;
  const c = Math.round(board.confidence);
  const fill = c >= L.warn ? "bg-ink" : c >= L.ultimatum ? "bg-orange-bright" : "bg-bad";
  const state = c >= L.warn ? "text-ink" : c >= L.ultimatum ? "text-orange-bright" : "text-bad";
  return (
    <Panel className="p-4 sm:p-5">
      <h3 className="card-title">{board.kind === "owners" ? C.board.ownersConfidence : C.board.confidence}</h3>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="display text-6xl font-bold leading-[0.85] tabular-nums text-ink">
          {c}
          <span className="ml-1.5 text-xl text-faint">{C.board.outOf}</span>
        </p>
        <p className={cx("display pb-1 text-lg font-bold uppercase leading-none", state)}>{C.board.band(c)}</p>
      </div>
      <div className="mt-5">
        <div className="relative h-2 rounded-sm bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c} aria-label={C.board.confidence}>
          <div className={cx("h-2 rounded-sm", fill)} style={{ width: `${Math.max(0, Math.min(100, c))}%` }} />
          <span className="absolute -top-1 h-4 w-px bg-orange-bright" style={{ left: `${L.warn}%` }} aria-hidden />
          <span className="absolute -top-1 h-4 w-px bg-bad" style={{ left: `${L.ultimatum}%` }} aria-hidden />
        </div>
        {/* The two lines, named where they sit: the ultimatum's label ends at its line, the warning's starts at its own. */}
        <div className="relative mt-1.5 h-4 text-xs" aria-hidden>
          <span className="absolute -translate-x-full whitespace-nowrap pr-1.5 text-bad" style={{ left: `${L.ultimatum}%` }}>{C.board.ultimatumLine(L.ultimatum)}</span>
          <span className="absolute whitespace-nowrap pl-1.5 text-orange-bright" style={{ left: `${L.warn}%` }}>{C.board.warnLine(L.warn)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug text-sub">{C.board.lines(L.warn, L.ultimatum)}</p>

      <h4 className="kicker mt-5">{C.board.log}</h4>
      {board.log.length === 0 ? <p className="mt-1.5 text-sm text-sub">{C.board.logEmpty}</p> : null}
      <ul className="mt-1.5 border-t border-line">
        {board.log.slice(0, 10).map((e, i) => (
          <li key={`${e.seasonIndex}:${e.day}:${i}`} className="flex min-h-10 items-center gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
            <span className={cx("display w-9 shrink-0 text-base font-bold tabular-nums", e.delta > 0 ? "text-good" : e.delta < 0 ? "text-bad" : "text-sub")}>
              {e.delta > 0 ? `+${e.delta}` : e.delta < 0 ? `−${Math.abs(e.delta)}` : "0"}
            </span>
            <span className="min-w-0 flex-1 leading-snug text-ink">{C.board.reasons[e.reason] ?? e.reason}</span>
            <span className="shrink-0 text-xs tabular-nums text-faint">{C.board.logWhen(e.seasonIndex + 1, weekOfDay(e.day))}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** An established org's standing: the four tiers, the marker, the next tier's line, the relegation line. */
export function StandingTrack({ save, C, note, className }: { save: CareerSave; C: CareerCopy; note?: string; className?: string }) {
  const st = standingOf(save);
  if (!st) return null;
  const S = C.board.standing;
  const pos = (n: number) => `${Math.max(0, Math.min(100, n))}%`;
  return (
    <section className={cx("panel p-4 sm:p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="card-title">{S.title}</h3>
        <p className="display text-3xl font-bold leading-none tabular-nums text-ink">{st.value}</p>
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label={S.title}>
        {STANDING_TIERS.map((t) => (
          <li
            key={t}
            aria-current={t === st.tier ? "true" : undefined}
            className={cx(
              "display flex min-h-11 items-center justify-center rounded-md border px-1 text-center text-xs font-semibold uppercase leading-tight",
              t === st.tier ? "border-orange/70 text-ink" : "border-line text-faint",
            )}
          >
            {S.tier[t] ?? t}
          </li>
        ))}
      </ol>
      <div className="relative mt-5 h-1.5 rounded-sm bg-white/10" aria-hidden>
        <div className="h-1.5 rounded-sm bg-blue-bright/70" style={{ width: pos(st.value) }} />
        {st.relegationLine !== null ? <span className="absolute -top-1 h-3.5 w-px bg-bad" style={{ left: pos(st.relegationLine) }} /> : null}
        {st.next ? <span className="absolute -top-1 h-3.5 w-px bg-good" style={{ left: pos(st.next.line) }} /> : null}
        <span className="absolute -top-[5px] h-4 w-1 -translate-x-1/2 rounded-sm bg-ink" style={{ left: pos(st.value) }} />
      </div>
      <ul className="mt-4 space-y-1 text-sm leading-snug">
        <li className="text-ink">{st.next ? S.next(S.tier[st.next.tier] ?? st.next.tier, promoteLineOf(st.next.tier)) : S.top}</li>
        {st.relegationLine !== null ? <li className="text-sub">{S.relegation(st.relegationLine)}</li> : null}
      </ul>
      {/* rc.6 (ORGMODE UI-C): the Club page says what a promotion changes. */}
      {note ? <p className="mt-3 border-t border-line pt-3 text-sm leading-snug text-sub">{note}</p> : null}
    </section>
  );
}

/** The manager: contract, reputation, clubs managed, then the record. */
export function ManagerPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const m = save.manager;
  if (!m) return null;
  const clubs = new Set(m.spells.map((s) => s.ref ?? s.orgName)).size || 1;
  return (
    <section>
      <h3 className="card-title">{C.board.managerTitle}</h3>
      <p className="mt-1 text-sm text-sub">{save.identity.managerName}</p>
      <div className="stat-trio mt-3 grid grid-cols-3 gap-4 border-t border-line pt-3">
        {[
          { label: C.board.contractLabel, value: C.board.contractValue(m.contractUntil + 1) },
          { label: C.board.reputationLabel, value: String(Math.round(m.reputation)) },
          { label: C.board.clubsLabel, value: String(clubs) },
        ].map((f) => (
          <div key={f.label} className="border-line sm:flex sm:flex-col">
            <p className="text-xs text-sub sm:order-2 sm:mt-1.5">{f.label}</p>
            <p className="display text-xl font-bold leading-none tabular-nums text-ink sm:order-1">{f.value}</p>
          </div>
        ))}
      </div>
      {m.spells.length ? (
        <ul className="mt-3 border-t border-line">
          {m.spells.map((s, i) => (
            <li key={i} className="flex min-h-10 items-center border-b border-line py-1.5 text-sm text-ink last:border-b-0">
              {C.board.spell(s.orgName, s.fromSeason, s.toSeason !== undefined ? String(s.toSeason + 1) : C.board.now)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The season's money as one strip: the board's budget, the wage bill against the ceiling, the projected end. Opens Finances. */
export function BudgetStrip({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const b = seasonBudgetOf(save);
  if (!b) return null;
  const M = C.board.money;
  const pending = pendingPackageOf(save);
  // Before the choice the allocation is not in the balance yet: add the proposed plan's grant.
  const pendingGrant = pending ? (pending.find((o) => o.id === "expected") ?? pending[0])?.grant ?? 0 : 0;
  const projected = b.projectedEnd + pendingGrant;
  const own = owners(save.board);
  return (
    <section className="panel overflow-hidden">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
        <h3 className="card-title min-w-0">{M.title}</h3>
        <AppLink href="/career/finances" className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-blue-bright hover:underline">
          {M.open}
          <Chevron />
        </AppLink>
      </div>
      <div className="stat-trio grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
        <div className="border-line sm:flex sm:flex-col">
          <p className="text-xs text-sub sm:order-2 sm:mt-1.5">{own ? M.ownersAllocation : M.allocation}</p>
          <p className="display text-2xl font-bold leading-none tabular-nums text-ink sm:order-1">{pending ? "–" : formatMoney(b.allocation, { compact: true })}</p>
          {pending ? <p className="hidden text-xs text-faint sm:order-3 sm:block">{M.notYet}</p> : null}
        </div>
        <div className="border-line sm:flex sm:flex-col">
          <p className="text-xs text-sub sm:order-2 sm:mt-1.5">{M.wages}</p>
          <p className={cx("display text-2xl font-bold leading-none tabular-nums sm:order-1", b.overCeiling ? "text-orange-bright" : "text-ink")}>{formatMoney(b.wageBill, { compact: true })}</p>
          {b.wageCeiling ? (
            <div className="hidden sm:order-3 sm:mt-2 sm:block">
              <p className="mb-1.5 text-xs text-faint">{M.ceiling(formatMoney(b.wageCeiling, { compact: true }))}</p>
              <ProgressBar value={b.wageBill / b.wageCeiling} tone={b.overCeiling ? "orange" : "blue"} className="h-1.5" label={M.wages} />
              {b.overCeiling ? <p className="mt-1 text-xs text-orange-bright">{M.over}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="border-line sm:flex sm:flex-col">
          <p className="text-xs text-sub sm:order-2 sm:mt-1.5">{M.projected}</p>
          <p className={cx("display text-2xl font-bold leading-none tabular-nums sm:order-1", projected < 0 ? "text-bad" : "text-ink")}>{formatMoney(projected, { compact: true })}</p>
          {b.bonusAtStake > 0 ? <p className="hidden text-xs text-faint sm:order-3 sm:block">{M.projectedNote(formatMoney(b.projectedEndIfMet, { compact: true }))}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** The one-time board-funded upgrade (top confidence): the next installation or a staff role, as the toolbox sells them. */
export function BoardUpgradePanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const choose = useCareerStore((s) => s.chooseBoardUpgrade);
  const up = save.board?.upgrade;
  if (!up) return null;
  const rung = C.ladder.rung as Record<string, string>;
  if (up.taken) return <p className="text-sm text-good">{C.board.upgrade.taken(rung[up.taken] ?? up.taken)}</p>;
  const options = boardUpgradeOptionsOf(save);
  if (options.length === 0) return null;
  return (
    <Panel glow="blue" className="p-4 sm:p-5">
      <h3 className="card-title">{C.board.upgrade.title}</h3>
      <p className="mt-1.5 text-sm leading-snug text-sub">{C.board.upgrade.body}</p>
      <ul className="mt-3 border-t border-line">
        {options.map((o) => (
          <li key={o.id} className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{rung[o.item ?? o.id] ?? o.id}</span>
            <span className="display text-base font-bold tabular-nums text-sub">{formatMoney(o.cost, { compact: true })}</span>
            <Button variant="secondary" size="sm" onClick={() => choose(o.id)}>{C.board.upgrade.pick}</Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Freeze, title protection, next season's budget: the board's standing terms, one line each. */
export function BoardTerms({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const board = save.board;
  if (!board) return null;
  const lines: { text: string; tone?: string }[] = [];
  if (board.freeze && board.freeze.seasonIndex === save.clock.seasonIndex) lines.push({ text: C.board.freeze, tone: "text-orange-bright" });
  if (board.protectedUntil !== null && board.protectedUntil >= save.clock.seasonIndex) lines.push({ text: C.board.protectedUntil(board.protectedUntil + 1) });
  if (Math.abs(board.budgetMult - 1) > 0.005) lines.push({ text: C.board.budgetLine(board.budgetMult) });
  if (!lines.length) return null;
  return (
    <ul className="space-y-1 text-sm leading-snug">
      {lines.map((l) => (
        <li key={l.text} className={l.tone ?? "text-sub"}>{l.text}</li>
      ))}
    </ul>
  );
}
