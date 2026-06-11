"use client";

/**
 * /play — the run flow router. Renders the screen for the current phase:
 * no run → Setup · draft → Draft · review → Review ·
 * tournament → Tournament · results → Results.
 * The active run is persisted, so reloading resumes in place.
 */

import { useMounted } from "@/store/useMounted";
import { useRunStore } from "@/store/runStore";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { DraftScreen } from "@/components/screens/DraftScreen";
import { ReviewScreen } from "@/components/screens/ReviewScreen";
import { TournamentScreen } from "@/components/screens/TournamentScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";

export default function PlayPage() {
  const mounted = useMounted();
  const run = useRunStore((s) => s.run);

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
