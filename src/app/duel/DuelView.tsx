"use client";

/**
 * /duel — where a friend-duel link lands (v2.1, `engine/duel.ts`). The code is
 * in the hash (`#c=…`): parsed on the client, never sent to the server. A good
 * link shows the duel (its settings and the runs to beat) and an Accept that
 * starts the same draft on /play. A broken or edited link never breaks the
 * page: it falls back to /play's normal setup with a notice.
 *
 * Light on purpose: the run store (dataset + engine) loads in the background
 * and only starts the draft on Accept.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useCopy } from "@/content/copy";
import { duelCodeFromHash, parseDuel } from "@/engine/duel";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { DuelStandings } from "@/components/duel/DuelStandings";
import { isStaleDuel, trackDuelInvalid, trackDuelOpened, useDuelNotice } from "@/store/duelStore";
import { loadRunStore } from "@/store/lazyRunStore";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const hashSnapshot = () => window.location.hash;
/** The static HTML has no hash: render the skeleton until the client reads it. */
const serverHashSnapshot = () => null;

export function DuelView() {
  const router = useRouter();
  const { DUEL_UI: D, RESULTS_UI: R, SETUP, DIFFICULTY_LABELS } = useCopy();
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, serverHashSnapshot);
  const parsed = useMemo(() => (hash === null ? null : parseDuel(duelCodeFromHash(hash))), [hash]);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  // One report per link, and the fall-back for a bad one.
  useEffect(() => {
    if (!parsed) return;
    if (parsed.ok) {
      trackDuelOpened(parsed.link);
      return;
    }
    useDuelNotice.getState().setNotice(parsed.reason);
    trackDuelInvalid(parsed.reason);
    router.replace("/play");
  }, [parsed, router]);

  // Load the run store meanwhile. AppShell clears an old run when a page that is
  // not /play opens (through the same lazy load), so Accept waits one more turn:
  // the clear lands first and can never wipe the duel's new run.
  useEffect(() => {
    let alive = true;
    loadRunStore()
      .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        // Offline, or a deploy replaced the chunk: Accept stays disabled.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!parsed || !parsed.ok) return <DuelSkeleton />;
  const { link } = parsed;
  const { setup } = link;

  const accept = async () => {
    setStarting(true);
    try {
      const { useRunStore } = await loadRunStore();
      if (!useRunStore.getState().startDuel(link)) {
        useDuelNotice.getState().setNotice("region");
        trackDuelInvalid("region");
        router.replace("/play");
        return;
      }
      router.push("/play");
    } catch {
      setStarting(false);
    }
  };

  const tags = [
    setup.mode === "quick" ? R.shareModeQuick : R.shareModeClassic,
    DIFFICULTY_LABELS[setup.difficulty]?.label ?? setup.difficulty,
    setup.region ? SETUP.regionNames[setup.region] : SETUP.regionWorldwide,
    setup.showOverall ? D.overallShown : D.overallHidden,
  ];

  return (
    <div className="mobile-action-space mx-auto max-w-2xl rise-in pb-8">
      <Panel strong glow="orange" className="mb-6 p-5 sm:p-8">
        <p className="kicker mb-2">{D.kicker}</p>
        <h1 className="display text-4xl font-bold uppercase leading-none text-ink sm:text-5xl">{D.introTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">{D.introBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
        {isStaleDuel(link) ? <p className="mt-3 text-xs text-amber-300">{D.staleVersion}</p> : null}
      </Panel>

      <p className="kicker mb-2">{D.standingsTitle}</p>
      {link.entries.length > 0 ? (
        <DuelStandings entries={link.entries} mode={setup.mode} />
      ) : (
        <p className="border-y border-line py-3 text-sm text-sub">{D.introFirst}</p>
      )}
      <p className="mt-3 text-xs text-faint">{D.exhibition}</p>

      <div className="mobile-action-bar mt-8 flex items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          className="flex-1 sm:min-w-56 sm:flex-none"
          disabled={!ready || starting}
          onClick={() => void accept()}
        >
          {ready ? D.accept : D.loading}
        </Button>
        <AppLink
          href="/"
          className="text-center text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
        >
          {D.decline}
        </AppLink>
      </div>
    </div>
  );
}

function DuelSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy>
      <div className="h-48 animate-pulse rounded-xl bg-white/5" />
      <div className="h-32 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
