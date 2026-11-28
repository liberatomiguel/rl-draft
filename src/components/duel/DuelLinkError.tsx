"use client";

/**
 * rc9 duel-ui: a duel link that does not open (malformed, edited, the old
 * duel's format, cards or a region this version lacks). Light: no dataset, so
 * it shows at once. What happened, what to do, and two ways on.
 */

import { useCopy } from "@/content/copy";
import { duelErrorText } from "@/engine/duelViews";
import type { DuelParseError } from "@/engine/duelLink";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { clearDuelHash } from "./duelNav";
import { AlertIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";

export function DuelLinkError({ reason }: { reason: DuelParseError | "unknownCards" | "region" }) {
  const { DUEL_MATCH_UI: D } = useCopy();
  return (
    <div className="mx-auto max-w-xl pb-8 rise-in">
      <Panel strong className="p-5 sm:p-8" role="alert">
        <span className="text-bad" aria-hidden>
          <AlertIcon className="h-6 w-6" />
        </span>
        <h1 className="display mt-4 text-2xl font-bold uppercase leading-tight tracking-[0.03em] text-ink sm:text-3xl">{D.errorTitle}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{duelErrorText(reason, D)}</p>
        <p className="mt-1 text-sm leading-relaxed text-sub">{D.errorWhat}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Dropping the hash opens /duel on its own start (DuelView listens to it). */}
          <Button variant="primary" size="lg" onClick={() => clearDuelHash()}>
            {D.startOwn}
          </Button>
          <AppLink href="/" className={buttonClass("ghost", "lg")}>
            {D.backHome}
          </AppLink>
        </div>
      </Panel>
    </div>
  );
}

export function DuelSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label={label}>
      <div className="h-10 w-64 animate-pulse rounded-sm bg-white/5" />
      <div className="h-64 animate-pulse rounded-xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
