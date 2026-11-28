"use client";

/**
 * /duel (rc9 duel-ui, DESIGN-DECISIONS #294-#300): the team-against-team duel.
 * The duel lives in the URL hash (`#c=<code>`), read on the client and never
 * sent to a server; the static page is the same file for every link.
 *
 *   no code         the start: the rules and the draft (or a draft to resume)
 *   a challenge     the friend answers it (or, in the challenger's browser, sends it)
 *   a reply         both teams: the series, the same for both friends
 *   a broken link   what happened and what to do
 *
 * Light on purpose: the link is parsed and a broken one explained before any
 * game data loads; the screens that draw cards and play the series are one
 * lazy chunk (`components/duel/DuelStage`).
 */

import { lazy, Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useCopy } from "@/content/copy";
import { parseDuelCode, readDuelHash } from "@/engine/duelLink";
import { DuelLinkError, DuelSkeleton } from "@/components/duel/DuelLinkError";
import { subscribeHash } from "@/components/duel/duelNav";
import { trackDuel } from "@/store/duelStore";

const DuelStage = lazy(() => import("@/components/duel/DuelStage").then((m) => ({ default: m.DuelStage })));

const hashSnapshot = () => window.location.hash;
/** The static HTML has no hash: the skeleton shows until the client reads it. */
const serverHashSnapshot = () => null;

export function DuelView() {
  const { DUEL_MATCH_UI: D } = useCopy();
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, serverHashSnapshot);
  const raw = hash === null ? undefined : readDuelHash(hash);
  const parsed = useMemo(() => (raw === undefined || raw === null ? null : parseDuelCode(raw)), [raw]);

  // One report per broken link.
  useEffect(() => {
    if (parsed && !parsed.ok) trackDuel("invalid", null, { reason: parsed.reason });
  }, [parsed]);

  if (hash === null) return <DuelSkeleton label={D.loading} />;
  if (parsed && !parsed.ok) return <DuelLinkError reason={parsed.reason} />;
  return (
    <Suspense fallback={<DuelSkeleton label={D.loading} />}>
      <DuelStage code={parsed?.ok ? parsed.code : null} />
    </Suspense>
  );
}
