"use client";

/**
 * v2.2 board: the Board page (/career/board). rc.6 (ORGMODE UI-B): one focal
 * point, not a stack of equal panels.
 *
 * The page's object is this season's objective (a strong board, the large
 * sentence, its progress and its band at the start and now). While the plan
 * is pending, the plan itself is the object and the one filled button. At the
 * season review the board's verdict (or the dismissal and its offers) leads.
 * Around the object, every section has its own shape: the brief is a
 * paragraph, the ultimatum a board on an orange hairline, the other asks a
 * list on the floor, confidence a figure with a meter and its log, the
 * standing a tier strip with a track, the manager a strip of figures, the
 * money a strip that opens Finances.
 *
 * Desktop (lg): the object and what hangs off it on the left; confidence,
 * standing and the manager on the right. A phone reads one column in the
 * order of the decision: the object, the ultimatum, confidence, standing, the
 * other asks, the money, the manager.
 */

import type { CareerCopy } from "@/content/careerCopy";
import { useCareerCopy } from "@/content/careerCopy";
import { CAREER_BOARD } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { seasonLabelFor, useCareerSave } from "@/components/career/careerUi";
import { UserOrgMark } from "@/components/career/OrgMark";
import { AppLink } from "@/components/ui/AppLink";
import { SectionTitle } from "@/components/ui/Panel";
import { useMounted } from "@/store/useMounted";
import { pendingPackageOf } from "@/store/boardFlow";
import {
  AlsoAsked,
  BoardBrief,
  BoardPackageChoice,
  BoardSeasonPanel,
  BoardTerms,
  BoardUpgradePanel,
  boardObjectiveProgressOf,
  BudgetStrip,
  ConfidencePanel,
  ManagerPanel,
  ObjectiveBoard,
  StandingTrack,
  UltimatumBoard,
} from "./BoardParts";

export function BoardScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  if (!mounted || !save) return <div className="mx-auto h-56 max-w-6xl animate-pulse px-3 py-5" aria-busy />;
  const board = save.board;
  const own = board?.kind === "owners";
  const pending = Boolean(pendingPackageOf(save));
  const tier = board && board.stature !== "owners" ? C.board.stature[board.stature] : null;
  const verdictOnly =
    save.phase === "seasonReview" &&
    board?.season?.met !== null &&
    board?.season?.met !== undefined &&
    board.dismissedSeason !== save.clock.seasonIndex &&
    !(save.manager?.offers?.length) &&
    !save.manager?.accepted;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-4">
      <SectionTitle
        title={own ? C.board.ownersTitle : C.board.title}
        kicker={own ? C.board.ownersKicker : C.board.kicker}
        className="rise-in"
        right={
          <div className="flex items-center gap-3 max-sm:hidden">
            <UserOrgMark identity={save.identity} seasonIndex={save.clock.seasonIndex} size="md" />
            <div className="min-w-0 leading-tight">
              <p className="display truncate text-lg font-bold uppercase leading-none text-ink">{save.identity.orgName}</p>
              <p className="mt-1 text-xs text-sub">{[tier, seasonLabelFor(save.clock.seasonIndex)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        }
      />

      {!board ? <p className="text-sm text-sub">{C.board.logEmpty}</p> : null}

      {board ? (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* The object and what hangs off it. */}
          <div className="contents lg:block lg:space-y-5">
            <div className="order-1 space-y-5">
              {pending ? (
                <div className="panel-strong p-4 sm:p-6">
                  <BoardPackageChoice save={save} C={C} />
                </div>
              ) : (
                <>
                  <BoardSeasonPanel save={save} C={C} />
                  <BoardBrief save={save} C={C} />
                  {/* At the review the verdict states the objective and its result; the object would repeat it. */}
                  {verdictOnly ? null : <ObjectiveBoard save={save} C={C} />}
                </>
              )}
              <UltimatumBoard save={save} C={C} />
            </div>
            <div className="order-4 space-y-5">
              <AlsoAsked save={save} C={C} />
              <BudgetStrip save={save} C={C} />
              <BoardTerms save={save} C={C} />
            </div>
          </div>
          {/* The relationship: confidence, the org's standing, the manager. */}
          <div className="contents lg:block lg:space-y-5">
            <div className="order-2 space-y-5">
              <BoardUpgradePanel save={save} C={C} />
              <ConfidencePanel board={board} C={C} />
            </div>
            <div className="order-3">
              <StandingTrack save={save} C={C} />
            </div>
            <div className="order-5">
              <ManagerPanel save={save} C={C} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function confidenceTone(c: number): string {
  const L = CAREER_BOARD.confidence;
  return c >= L.warn ? "text-ink" : c >= L.ultimatum ? "text-orange-bright" : "text-bad";
}

/** What the HQ says about the board in one line: the plan to choose, an ultimatum, the objective's progress. */
export function boardGlanceNoteOf(save: CareerSave, C: CareerCopy): { text: string; tone: "sub" | "warn" | "good" | "bad" } {
  const G = C.board.glance;
  if (pendingPackageOf(save)) return { text: G.pending, tone: "warn" };
  const u = save.board?.ultimatum;
  if (u && u.issuedSeason === save.clock.seasonIndex && u.status === "open") return { text: G.ultimatum, tone: "warn" };
  const p = boardObjectiveProgressOf(save);
  if (!p) return { text: C.board.band(Math.round(save.board?.confidence ?? 0)), tone: "sub" };
  if (p.met === true) return { text: G.met, tone: "good" };
  if (p.met === false) return { text: G.missed, tone: "bad" };
  return { text: G.progress(p.done, p.target), tone: p.out ? "bad" : "sub" };
}

/**
 * HQ's board block (desktop, under the season goal): confidence as a figure
 * with its state and a small meter, the objective's line, opening the Board
 * page. A phone reads the same figure from HubGlance.
 */
export function BoardLink({ save, C }: { save: CareerSave; C: CareerCopy }) {
  if (!save.board) return null;
  const c = Math.round(save.board.confidence);
  const L = CAREER_BOARD.confidence;
  const note = boardGlanceNoteOf(save, C);
  const own = save.board.kind === "owners";
  return (
    <AppLink href="/career/board" className="group mt-3 block border-t border-line pt-3 max-sm:hidden">
      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-xs text-sub">{own ? C.board.glance.ownersTitle : C.board.confidence}</span>
          <span className="display mt-1 block text-3xl font-bold leading-none tabular-nums text-ink">
            {c}
            <span className="ml-1 text-sm text-faint">{C.board.outOf}</span>
          </span>
        </span>
        <span className={cx("display pb-0.5 text-sm font-bold uppercase leading-none", confidenceTone(c))}>{C.board.band(c)}</span>
      </span>
      <span className="relative mt-2.5 block h-1.5 rounded-sm bg-white/10" aria-hidden>
        <span className={cx("block h-1.5 rounded-sm", c >= L.warn ? "bg-ink" : c >= L.ultimatum ? "bg-orange-bright" : "bg-bad")} style={{ width: `${Math.max(0, Math.min(100, c))}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-orange-bright" style={{ left: `${L.warn}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-bad" style={{ left: `${L.ultimatum}%` }} />
      </span>
      <span className="mt-2.5 flex min-h-8 items-center justify-between gap-3 text-xs">
        <span className={cx(note.tone === "warn" ? "font-semibold text-orange-bright" : note.tone === "good" ? "text-good" : note.tone === "bad" ? "text-bad" : "text-sub")}>{note.text}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-blue-bright group-hover:underline">{C.board.openBoard}</span>
      </span>
    </AppLink>
  );
}
