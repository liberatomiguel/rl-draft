"use client";

/**
 * The draft's first-run tour (T1, v2.0): four steps on the draft screen (the
 * lineup on offer, your team, the reroll, what comes next), in the same
 * `GuidedTour` as Road to Worlds. It replaces the "How to play" text modal.
 *
 * rc.54 (Miguel): it runs BEFORE the draw, over a fixed static board that
 * `DraftScreen` renders for it (`draftTourDemo`), so it opens at once: there is
 * no reel to wait for. The real offer rolls in when it is done or skipped.
 * Shown once per player since the Season 1 reset (`profile.tours.draft`,
 * `src/lib/tours.ts`), to veterans of the old modal and the old flags too.
 */

import { GuidedTour, type TourStep } from "@/components/tour/GuidedTour";
import { BoltIcon, ShieldIcon, StarIcon, TargetIcon, TrendUpIcon, TrophyIcon } from "@/components/ui/icons";
import { useCopy } from "@/content/copy";

const BIG = "h-5 w-5";
const SMALL = "h-3.5 w-3.5";

export function DraftTour({ onClose }: { onClose: () => void }) {
  const { ONBOARDING } = useCopy();
  const T = ONBOARDING.tour;

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
