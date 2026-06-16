"use client";

/**
 * /play — the run flow router. Renders the screen for the current phase:
 * no run → Setup · draft → Draft · review → Review ·
 * tournament → Tournament · results → Results.
 * The active run is persisted, so reloading resumes in place.
 */

import { useEffect } from "react";
import { useMounted } from "@/store/useMounted";
import { useRunStore } from "@/store/runStore";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { DraftScreen } from "@/components/screens/DraftScreen";
import { ReviewScreen } from "@/components/screens/ReviewScreen";
import { TournamentScreen } from "@/components/screens/TournamentScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";

export function PlayView() {
  const mounted = useMounted();
  const run = useRunStore((s) => s.run);

  // Reset the scroll to the top of the page on every phase/step change (mobile
  // fix, v0.7.0): tapping a button at the bottom of one step (e.g. draft a card
  // or "Start tournament") used to land the next step still scrolled down.
  // Route changes already scroll to top; this covers in-page step transitions.
  const phase = run?.phase;
  const draftRound = run?.draft.round;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [phase, draftRound]);

  if (!mounted) return <PageSkeleton />;
  if (!run) return <SetupScreen />;

  switch (run.phase) {
    case "draft":
      return <DraftScreen run={run} />;
    case "review":
      return <ReviewScreen run={run} />;
    case "tournament":
      return <TournamentScreen run={run} />;
    case "results":
      return <ResultsScreen run={run} />;
  }
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-white/5" />
      <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}
