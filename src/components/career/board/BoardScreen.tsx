"use client";

/** v2.2 board front: the Board page (/career/board): confidence and its log, the season's objectives, the manager. */

import type { CareerCopy } from "@/content/careerCopy";
import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { useCareerSave } from "@/components/career/careerUi";
import { AppLink } from "@/components/ui/AppLink";
import { useMounted } from "@/store/useMounted";
import { BoardPackageChoice, BoardSeasonPanel, ConfidencePanel, ManagerPanel, ObjectivesPanel } from "./BoardParts";

export function BoardScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  if (!mounted || !save) return <div className="mx-auto h-56 max-w-3xl animate-pulse px-3 py-5" aria-busy />;
  const board = save.board;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-5 sm:px-4">
      <header>
        <h1 className="display text-2xl font-bold uppercase tracking-wide text-ink">{C.board.title}</h1>
        <p className="mt-1 text-sm text-sub">{C.board.kicker}</p>
      </header>
      {!board ? <p className="text-sm text-sub">{C.board.logEmpty}</p> : null}
      <BoardPackageChoice save={save} C={C} />
      <BoardSeasonPanel save={save} C={C} />
      {board ? <ConfidencePanel board={board} C={C} /> : null}
      <ObjectivesPanel save={save} C={C} />
      <ManagerPanel save={save} C={C} />
    </div>
  );
}

/** A one-line link to the Board page with the confidence figure (HQ's season goal block). */
export function BoardLink({ save, C }: { save: CareerSave; C: CareerCopy }) {
  if (!save.board) return null;
  return (
    <AppLink href="/career/board" className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm text-ink hover:underline">
      <span>{C.board.confidence}</span>
      <span className="font-semibold">{C.board.confidenceOf(save.board.confidence)} · {C.board.openBoard}</span>
    </AppLink>
  );
}
