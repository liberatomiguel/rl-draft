"use client";

/**
 * The route error boundary — also catches dataset validation errors in dev.
 *
 * v2.0.14: an error that re-rendering cannot fix (a chunk that failed to load, a DOM
 * tree something outside React rearranged) offers "Reload the page" first, because
 * "Try again" only showed this screen again. A failed chunk reloads by itself, once.
 * v2.0.32: either reload fetches the failed chunk again first (lib/assetHeal).
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { useCopy } from "@/content/copy";
import { reportScreenError } from "@/lib/analytics";
import { refetchThenReload } from "@/lib/assetHeal";
import { chunkUrlOf, isDomMismatchError, recoveryFor, shouldAutoReload } from "@/lib/errorRecovery";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { NAV_UI: N } = useCopy();
  useEffect(() => {
    // Health analytics (`quality_error`): what this boundary caught never reaches window.onerror.
    reportScreenError("boundary", error);
    // v2.0.32 (#171): the failed chunk is fetched again first — a 404 the browser
    // cached for a year (version skew during a deploy) would otherwise come right back.
    if (shouldAutoReload(error, sessionStore(), Date.now())) refetchThenReload(chunkUrlOf(error));
  }, [error]);

  const isDataError = error.message.includes("[data]");
  const reloadFirst = !isDataError && recoveryFor(error) === "reload";
  const reload = () => refetchThenReload(chunkUrlOf(error));
  return (
    <div className="mx-auto mt-16 max-w-xl">
      <Panel strong className="p-8 text-center">
        <p className="kicker mb-2">{N.errorKicker}</p>
        <h1 className="display text-2xl font-bold uppercase tracking-wide text-ink">
          {isDataError ? N.errorDataTitle : N.errorTitle}
        </h1>
        <p className="mt-3 break-words text-sm leading-relaxed text-sub">
          {isDataError ? error.message : reloadFirst ? N.errorReloadBody : N.errorBody}
        </p>
        {reloadFirst && isDomMismatchError(error) ? (
          <p className="mt-2 text-xs leading-relaxed text-sub">{N.errorTranslateHint}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {reloadFirst ? (
            <Button variant="primary" onClick={reload}>
              {N.errorReload}
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={reset}>
                {N.errorRetry}
              </Button>
              <Button variant="ghost" onClick={reload}>
                {N.errorReload}
              </Button>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
