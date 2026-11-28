"use client";

/**
 * /play — the run flow router. Renders the screen for the current phase:
 * no run → Setup · draft → Draft · review → Review ·
 * tournament → Tournament · results → Results.
 * The active run is persisted, so reloading resumes in place.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMounted } from "@/store/useMounted";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { useRunStore } from "@/store/runStore";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { DraftScreen } from "@/components/screens/DraftScreen";
import { ReviewScreen } from "@/components/screens/ReviewScreen";
import { TournamentScreen } from "@/components/screens/TournamentScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";
import { ChallengeScreen } from "@/components/screens/ChallengeScreen";

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

  // rc.29 (DRAFT-02): cosmetic unlocks earned while the tournament plays (live
  // feats crossing a rank) wait for the results — the ceremonies there hold
  // them in turn, so they open once those are done, never over the playback.
  useOverlayHold("live", phase === "tournament");

  // Mobile (design/mobile-redesign): while the run is in play (draft, review,
  // tournament) the phone's bottom nav is off. Any destination on it leaves
  // /play, which resets the run, and the bar took 57px of a screen that needs
  // them for the cards. Setup, results and the challenge result keep the nav.
  // The stepper's back arrow and the header logo are the ways out.
  const immersive = phase === "draft" || phase === "review" || phase === "tournament";
  useEffect(() => {
    if (!immersive) return;
    document.documentElement.dataset.immersive = "run";
    return () => {
      delete document.documentElement.dataset.immersive;
    };
  }, [immersive]);

  // rc9 duel-ui: a finished duel draft goes on to /duel (the challenge or the
  // match); a stored run of the v2.1 duel (gone) is dropped, it grants nothing.
  const router = useRouter();
  const duelDone = run?.duelMatch?.done ?? null;
  const legacyDuel = Boolean(run?.duel);
  useEffect(() => {
    if (duelDone) router.replace(duelDone);
    else if (legacyDuel) useRunStore.getState().clearRun();
  }, [duelDone, legacyDuel, router]);

  if (!mounted || duelDone || legacyDuel) return <PageSkeleton />;
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
    case "challenge":
      return <ChallengeScreen run={run} />;
  }
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-8 w-64 animate-pulse rounded-sm bg-white/5" />
      <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      <div className="h-72 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
