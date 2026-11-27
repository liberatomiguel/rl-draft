"use client";

/**
 * v2.2 rc.6 (ORGMODE UI-A): the takeover's arrival, the founding splash's
 * twin. rc9 ORG-UI (#271): one moment. The org's real logo, "{manager},
 * manager of {org}", the owner's sentence (the board's brief) and one action.
 * The goals, the roster and the money were already read in the dossier and
 * come again in the mandate on the next screen: the splash does not repeat them.
 * A full-screen sheet (portal on <body>, never position:fixed inside the
 * animated wizard tree); the button takes focus, Enter goes on.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCareerCopy } from "@/content/careerCopy";
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
  const actionRef = useRef<HTMLDivElement>(null);
  // Portal host resolves after mount (SSR-safe); deferred a tick (React Compiler rule).
  useEffect(() => {
    const t = window.setTimeout(() => setHost(document.body), 0);
    return () => window.clearTimeout(t);
  }, []);
  // The one action takes focus once the sheet is up.
  useEffect(() => {
    if (host) actionRef.current?.querySelector("button")?.focus();
  }, [host]);
  if (!host || !save) return null;

  const view = takeoverViewOf(save);
  const brief = briefLinesOf(C, view.brief, save.identity.orgName);
  const id = save.identity;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-labelledby="arrival-title">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
        <div className="pop-in">
          <UserOrgMark identity={id} seasonIndex={save.clock.seasonIndex} size="xl" loading="eager" />
        </div>
        <p className="kicker rise-in mt-6" style={{ animationDelay: "0.2s" }}>
          {S.kicker}
        </p>
        <h1
          id="arrival-title"
          className="display rise-in mt-3 text-3xl font-bold uppercase leading-[1.05] text-ink [overflow-wrap:anywhere] sm:text-5xl"
          style={{ animationDelay: "0.3s" }}
        >
          {S.title(id.managerName, id.orgName)}
        </h1>
        {brief ? (
          <p className="rise-in mt-5 max-w-lg text-base leading-relaxed text-sub" style={{ animationDelay: "0.45s" }}>
            {brief.reason}
          </p>
        ) : null}
        <div ref={actionRef} className="rise-in mt-9 w-full sm:w-auto" style={{ animationDelay: "0.6s" }}>
          <Button variant="primary" size="lg" full onClick={onDone} className="min-h-12 sm:px-10">
            {S.action}
          </Button>
        </div>
      </div>
    </div>,
    host,
  );
}
