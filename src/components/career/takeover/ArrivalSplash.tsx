"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-A): the takeover's arrival, the founding splash's
 * twin. A full-screen sheet (portal on <body>, never position:fixed inside the
 * animated wizard tree): the org's real logo, "{manager}, manager of {org}",
 * the board's first ask (its brief when the save carries one), the starters
 * as the game's own squad cards, and one action to HQ. It waits for the
 * player: the takeover's first day has a choice waiting (the board's plan).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCareerCopy } from "@/content/careerCopy";
import { goalText } from "@/components/career/board/BoardParts";
import { SquadCard } from "@/components/career/hub/SquadBlock";
import { UserOrgMark } from "@/components/career/OrgMark";
import { Button } from "@/components/ui/Button";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { takeoverViewOf } from "@/store/takeoverPreview";
import { briefLinesOf } from "@/components/career/board/briefLines";

export function ArrivalSplash({ onDone }: { onDone: () => void }) {
  const C = useCareerCopy();
  const S = C.takeover.splash;
  const save = useCareerStore(selectActiveSave);
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Portal host resolves after mount (SSR-safe); deferred a tick (React Compiler rule).
  useEffect(() => {
    const t = window.setTimeout(() => setHost(document.body), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!host || !save) return null;

  const view = takeoverViewOf(save);
  const plan = view.proposed;
  const brief = briefLinesOf(C, view.brief, save.identity.orgName);
  const id = save.identity;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="arrival-title">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-8 pt-10 text-center sm:justify-center sm:pt-12">
        <div className="pop-in">
          <UserOrgMark identity={id} seasonIndex={save.clock.seasonIndex} size="xl" loading="eager" />
        </div>
        <p className="display rise-in mt-5 text-sm font-semibold uppercase tracking-[0.06em] text-sub" style={{ animationDelay: "0.2s" }}>
          {S.kicker}
        </p>
        <h1
          id="arrival-title"
          className="display rise-in mt-2 text-3xl uppercase leading-[0.95] text-ink [overflow-wrap:anywhere] sm:text-5xl"
          style={{ animationDelay: "0.3s" }}
        >
          {S.title(id.managerName, id.orgName)}
        </h1>

        {plan || brief ? (
          <div className="rise-in mt-6 max-w-xl" style={{ animationDelay: "0.45s" }}>
            <p className="text-xs text-sub">{S.ask}</p>
            {brief ? <p className="mt-1.5 text-[15px] leading-snug text-ink">{brief.reason}</p> : null}
            {plan ? (
              // rc.6 (UI-B pass): the ask is the splash's second figure, set as the objective itself with its band under it.
              <>
                <p className="display mt-3 text-2xl uppercase leading-tight text-ink sm:text-3xl">{goalText(C, plan.objective)}</p>
                <p className="mt-1 text-sm text-sub">{C.takeover.dossier.chance(C.board.bandWord(plan.band))}</p>
              </>
            ) : null}
          </div>
        ) : null}

        {view.starters.length ? (
          <div className="rise-in mt-7 w-full" style={{ animationDelay: "0.6s" }}>
            <p className="mb-2.5 text-left text-xs text-sub sm:text-center">{S.squad}</p>
            <div className="grid gap-2.5 text-left sm:grid-cols-3">
              {view.starters.map((p) => (
                <SquadCard key={p.id} save={save} p={p} C={C} className="sm:min-h-56" />
              ))}
            </div>
          </div>
        ) : null}

        <div className="rise-in mt-8 w-full max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:border-t max-sm:border-line max-sm:bg-bg max-sm:px-4 max-sm:py-2.5 sm:w-auto" style={{ animationDelay: "0.75s" }}>
          <Button variant="primary" size="lg" full onClick={onDone} className="sm:px-10">
            {S.action}
          </Button>
        </div>
      </div>
    </div>,
    host,
  );
}
