"use client";

/**
 * The draft's first-run tour (T1, v2.0): four steps on the real draft screen
 * (the lineup on offer, your team, the reroll, what comes next), in the same
 * `GuidedTour` as Road to Worlds. It replaces the "How to play" text modal and
 * keeps its one-shot flag (`seenHowToPlay`), so nothing new is persisted.
 *
 * It waits for the lineup reel to land before it opens: the first step points
 * at the cards, which are invisible while the reel spins.
 */

import { useEffect, useState } from "react";
import { GuidedTour, type TourStep } from "@/components/tour/GuidedTour";
import { BoltIcon, ShieldIcon, StarIcon, TargetIcon, TrendUpIcon, TrophyIcon } from "@/components/ui/icons";
import { useCopy } from "@/content/copy";

const BIG = "h-5 w-5";
const SMALL = "h-3.5 w-3.5";
/** The lineup reel (name roll + card fade-in) is done by then. */
const REEL_MS = 1600;

export function DraftTour({ onClose }: { onClose: () => void }) {
  const { ONBOARDING } = useCopy();
  const T = ONBOARDING.tour;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), REEL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  const steps: TourStep[] = [
    {
      id: "offer",
      target: "draft-offer",
      tone: "orange",
      icon: <TargetIcon className={BIG} />,
      title: T.offer.title,
      body: T.offer.body,
    },
    {
      id: "roster",
      target: "draft-roster",
      tone: "blue",
      icon: <ShieldIcon className={BIG} />,
      title: T.roster.title,
      body: T.roster.body,
      points: [
        { icon: <StarIcon className={SMALL} />, ...T.roster.points[0] },
        { icon: <TrendUpIcon className={SMALL} />, ...T.roster.points[1] },
      ],
    },
    {
      id: "reroll",
      target: "draft-reroll",
      tone: "cyan",
      icon: <BoltIcon className={BIG} />,
      title: T.reroll.title,
      body: T.reroll.body,
    },
    {
      id: "finish",
      tone: "orange",
      icon: <TrophyIcon className={BIG} />,
      title: T.finish.title,
      body: T.finish.body,
    },
  ];

  return (
    <GuidedTour
      steps={steps}
      kicker={T.kicker}
      topInset={72}
      labels={{ next: T.next, back: T.back, skip: T.skip, done: T.done, progress: T.progress }}
      onClose={onClose}
    />
  );
}
