"use client";

/**
 * v2.2 board front: the board's pieces — the pre-season package choice (HQ's
 * decision block and the Board page), the job offers (season review), the
 * confidence meter and its log, this season's objectives. Functional and
 * plain; the UI pass restyles them.
 */

import { useState } from "react";
import { CAREER_BOARD } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { missionProgressOf } from "@/engine/career/board";
import type { BoardState, JobOffer, PackageId } from "@/engine/career/boardTypes";
import { seasonGoalProgressOf } from "@/engine/career/seasonGoals";
import type { CareerSave, SeasonGoalSpec } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useCareerStore } from "@/store/careerStore";
import { pendingJobChoiceOf, pendingPackageOf, wageRoomNow } from "@/store/boardFlow";

const pct = (x: number) => Math.round(x * 100);
const option = (active: boolean) =>
  cx("panel w-full text-left transition-colors", active ? "panel-glow-orange" : "hover:!border-line-strong");

export function goalText(C: CareerCopy, spec: Pick<SeasonGoalSpec, "kind" | "count" | "place">): string {
  return C.goals.season(spec.kind, spec.count, spec.place ?? 0);
}

/** The package choice: Expected preselected, one tap to accept; each row says what it costs and pays. */
export function BoardPackageChoice({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const offers = pendingPackageOf(save);
  const choose = useCareerStore((s) => s.chooseBoardPackage);
  const [pick, setPick] = useState<PackageId>("expected");
  if (!offers) return null;
  const K = C.board.packages;
  return (
    <div>
      <h2 className="display text-xl font-bold uppercase tracking-wide text-ink">{K.title}</h2>
      <p className="mt-1 max-w-xl text-sm text-sub">{K.body}</p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label={K.title}>
        {offers.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={pick === o.id} onClick={() => setPick(o.id)} className={cx(option(pick === o.id), "p-3")}>
            <span className="flex items-center justify-between gap-2">
              <span className="display text-base font-bold uppercase text-ink">{K.name[o.id]}</span>
              <span className="text-xs text-sub">{o.id === "expected" ? K.recommended : ""}</span>
            </span>
            <span className="mt-1 block text-sm text-ink">
              {goalText(C, o.objective)} · {K.chance(pct(o.objective.chance))}
            </span>
            {pick === o.id ? (
              <span className="mt-1 block text-xs text-sub">
                {o.grant > 0 ? K.budget(formatMoney(o.grant)) : K.noBudget} · {K.bonus(formatMoney(o.bonus))} · {K.swing(o.hit, o.miss)}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <Button variant="primary" size="md" className="mt-3 min-h-11" onClick={() => choose(pick)}>
        {K.accept}
      </Button>
    </div>
  );
}

/** HQ's decision block body for kind "board". */
export function BoardDecision({ save, C }: { save: CareerSave; C: CareerCopy }) {
  if (pendingPackageOf(save)) return <BoardPackageChoice save={save} C={C} />;
  if (pendingJobChoiceOf(save)) {
    return (
      <div>
        <h2 className="display text-xl font-bold uppercase tracking-wide text-ink">{C.board.dismissed.title}</h2>
        <AppLink href="/career/season" className="mt-3 flex min-h-11 items-center text-sm text-orange-bright hover:underline">
          {C.board.dismissed.offers}
        </AppLink>
      </div>
    );
  }
  return null;
}

function OfferRow({ o, C, onAccept, label }: { o: JobOffer; C: CareerCopy; onAccept: () => void; label: string }) {
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{o.kind === "found" ? C.board.dismissed.found : o.name}</span>
        <span className="block text-xs text-sub">
          {o.kind === "found" ? C.board.dismissed.foundBody(o.name) : C.board.offerLine(C.board.stature[o.stature], o.region, o.rank ?? 0)}
        </span>
      </span>
      <Button variant="secondary" size="sm" onClick={onAccept}>{label}</Button>
    </li>
  );
}

/** The season review's board panel: the dismissal and its offers, or an approach; nothing otherwise. */
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
        <p className="text-sm text-good">{C.board.dismissed.accepted(manager.accepted.name)}</p>
      </Panel>
    );
  }
  if (!dismissed && offers.length === 0) return null;
  return (
    <Panel glow="orange" className="rise-in p-4 sm:p-5">
      <h3 className="card-title">{dismissed ? C.board.dismissed.title : C.board.approach.title}</h3>
      <p className="mt-1.5 text-sm text-sub">
        {dismissed ? C.board.dismissed.body(save.identity.orgName) : C.board.approach.body(offers[0]?.name ?? "")}
      </p>
      <ul className="mt-3 border-t border-line">
        {offers.map((o) => (
          <OfferRow key={o.id} o={o} C={C} onAccept={() => accept(o.id)} label={dismissed ? C.board.dismissed.accept : C.board.approach.accept} />
        ))}
      </ul>
      {!dismissed ? (
        <Button variant="ghost" size="md" className="mt-3 min-h-11" onClick={decline}>{C.board.approach.decline}</Button>
      ) : null}
    </Panel>
  );
}

/** The confidence meter, its two lines, and why it moved. */
export function ConfidencePanel({ board, C }: { board: BoardState; C: CareerCopy }) {
  const L = CAREER_BOARD.confidence;
  const c = board.confidence;
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="card-title">{C.board.confidence}</h3>
        <span className="display text-2xl font-bold text-ink">{C.board.confidenceOf(c)}</span>
      </div>
      <div className="relative mt-3 h-2 rounded-sm bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c} aria-label={C.board.confidence}>
        <div className={cx("h-2 rounded-sm", c >= L.warn ? "bg-ink" : c >= L.ultimatum ? "bg-orange-bright" : "bg-bad")} style={{ width: `${c}%` }} />
        <span className="absolute top-0 h-2 w-px bg-orange-bright" style={{ left: `${L.warn}%` }} aria-hidden />
        <span className="absolute top-0 h-2 w-px bg-bad" style={{ left: `${L.ultimatum}%` }} aria-hidden />
      </div>
      <p className="mt-2 text-sm text-ink">{C.board.band(c)}</p>
      <p className="mt-1 text-xs text-sub">{C.board.lines(L.warn, L.ultimatum)}</p>
      <h4 className="kicker mt-4">{C.board.log}</h4>
      {board.log.length === 0 ? <p className="mt-1 text-sm text-sub">{C.board.logEmpty}</p> : null}
      <ul className="mt-1 border-t border-line">
        {board.log.slice(0, 12).map((e, i) => (
          <li key={`${e.seasonIndex}:${e.day}:${i}`} className="flex min-h-9 items-center gap-3 border-b border-line py-1.5 text-sm">
            <span className={cx("display w-10 shrink-0 font-bold", e.delta > 0 ? "text-good" : e.delta < 0 ? "text-bad" : "text-sub")}>
              {e.delta > 0 ? `+${e.delta}` : e.delta}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{C.board.reasons[e.reason] ?? e.reason}</span>
            <span className="text-xs text-faint">S{e.seasonIndex + 1}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** This season's objectives with their progress and likelihood, the ultimatum, the money terms. */
export function ObjectivesPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const board = save.board;
  const season = board?.season;
  if (!board || !season || season.seasonIndex !== save.clock.seasonIndex) return null;
  const ctx = {
    seasonIndex: save.clock.seasonIndex,
    today: { seasonIndex: save.clock.seasonIndex, day: save.clock.day },
    results: save.eventResults,
    majorFieldRefs: save.competition.majorFieldRefs,
    worldsFieldRefs: save.competition.worldsFieldRefs,
    over: save.phase !== "running",
  };
  const pkg = season.choice ? season.offers.find((o) => o.id === season.choice) : null;
  const u = board.ultimatum?.issuedSeason === save.clock.seasonIndex ? board.ultimatum : null;
  const row = (title: string, text: string, sub: string, right: string) => (
    <li className="border-b border-line py-2">
      <p className="kicker">{title}</p>
      <p className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-ink">
        <span className="min-w-0">{text}</span>
        <span className="shrink-0 font-semibold">{right}</span>
      </p>
      {sub ? <p className="text-xs text-sub">{sub}</p> : null}
    </li>
  );
  const status = (met: boolean | null, hit?: boolean) => (met === true || hit ? C.goals.status.met : met === false ? C.goals.status.missed : C.goals.status.open);
  return (
    <Panel className="p-4 sm:p-5">
      <h3 className="card-title">{C.board.objectives}</h3>
      {!pkg ? <p className="mt-2 text-sm text-sub">{C.board.notChosen}</p> : null}
      <ul className="mt-2 border-t border-line">
        {pkg
          ? (() => {
              const p = seasonGoalProgressOf(pkg.objective, ctx);
              return row(
                `${C.board.sporting} · ${C.board.packages.name[pkg.id]}`,
                goalText(C, pkg.objective),
                C.board.likely(pct(pkg.objective.chance)),
                season.met !== null ? status(season.met) : `${p.done}/${p.target}`,
              );
            })()
          : null}
        {season.secondary
          ? row(
              C.board.secondary,
              C.board.secondaryLabel(season.secondary.kind, season.secondary.kind === "wages" ? formatMoney(wageRoomNow(board, save.clock.seasonIndex)) : String(season.secondary.value)),
              "",
              status(season.secondary.met),
            )
          : null}
        {season.legacy ? row(C.board.legacy, goalText(C, season.legacy.objective), C.board.legacyNote, status(season.legacy.met)) : null}
        {u
          ? (() => {
              const m = missionProgressOf(u, save.eventResults);
              return row(C.board.ultimatum.title, goalText(C, u.objective), `${C.board.ultimatum.body} ${C.board.ultimatum.chance(pct(u.objective.chance))}`, u.status === "met" ? C.board.ultimatum.met : C.board.ultimatum.progress(m.done, m.target));
            })()
          : null}
      </ul>
      <div className="mt-3 grid gap-1 text-xs text-sub">
        <p>{C.board.budgetLine(board.budgetMult)}</p>
        {board.protectedUntil !== null && board.protectedUntil >= save.clock.seasonIndex ? <p>{C.board.protectedUntil(board.protectedUntil + 1)}</p> : null}
        {board.freeze && board.freeze.seasonIndex === save.clock.seasonIndex ? <p className="text-orange-bright">{C.board.freeze}</p> : null}
        {save.manager ? <p>{C.board.contract(save.manager.contractUntil + 1)}</p> : null}
      </div>
    </Panel>
  );
}

export function ManagerPanel({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const m = save.manager;
  if (!m) return null;
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="card-title">{C.board.managerRep}</h3>
        <span className="display text-2xl font-bold text-ink">{m.reputation}</span>
      </div>
      <h4 className="kicker mt-3">{C.board.spells}</h4>
      <ul className="mt-1 border-t border-line">
        {m.spells.map((s, i) => (
          <li key={i} className="border-b border-line py-1.5 text-sm text-ink">
            {C.board.spell(s.orgName, s.fromSeason, s.toSeason !== undefined ? String(s.toSeason + 1) : C.board.now)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
