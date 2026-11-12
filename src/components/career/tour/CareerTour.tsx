"use client";

/**
 * Road to Worlds — the guided tour (T1, v2.0).
 *
 * A chapter opens by itself the first time its screen is visited (the HQ
 * chapter is the mode's introduction: what each tab is for, the clock, the day
 * card, the inbox, the cash, progression) and the floating help button reopens
 * the chapter of the screen you are on.
 *
 * rc.54 (Miguel): only the HQ, Squad, Training and Finances have a chapter.
 * Calendar, Market, Standings, Inbox and Club have none: nothing opens there
 * and the help button is not shown (`careerTourChapters.ts`).
 *
 * "Seen" is once per PLAYER since the Season 1 reset: `profile.tours`
 * (`career.<chapter>` → the season it was seen in, `src/lib/tours.ts`). A
 * second career, or a new one after deleting every save, does not replay it,
 * and a save that carries the older `flags["tour.<chapter>"]` still gets each
 * chapter once. Closing a chapter also keeps writing the save's own flags
 * (`tour.<chapter>`, and `seenHub` for the HQ) for anything that reads them.
 *
 * It never opens over another dialog (a headline, a money notice, the sponsor
 * choice): it waits until the screen is clear.
 */

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCareerSave } from "@/components/career/careerUi";
import { useCareerNavigation } from "@/components/career/careerNavigation";
import { careerTourChapter, careerTourRoute, type CareerTourChapter } from "@/components/career/tour/careerTourChapters";
import { GuidedTour, type TourStep, type TourTone } from "@/components/tour/GuidedTour";
import {
  BankIcon,
  CalendarIcon,
  ClipboardIcon,
  CoachIcon,
  HandshakeIcon,
  HqIcon,
  PeakIcon,
  QuestionIcon,
  ShieldIcon,
  StarIcon,
  TargetIcon,
  TrendUpIcon,
  TrophyIcon,
  WalletIcon,
  HourglassIcon,
  BoltIcon,
  HeartPulseIcon,
} from "@/components/ui/icons";
import { type CareerCopy, useCareerCopy } from "@/content/careerCopy";
import { careerTourId, tourSeen } from "@/lib/tours";
import { useCareerStore } from "@/store/careerStore";
import { useProfileStore } from "@/store/profileStore";

type Chapter = CareerTourChapter;

/** The save's own one-shot flag (kept for older readers; it does not gate the tour). */
const flagOf = (chapter: Chapter): string => `tour.${chapter}`;

const BIG = "h-5 w-5";
const SMALL = "h-3.5 w-3.5";

type Words = { title: string; body: string; points?: { label: string; text: string }[] };

/** A step from its words: the element, the accent, the chip icon and one icon per point. */
function step(id: string, words: Words, target: string | undefined, tone: TourTone, icon: ReactNode, pointIcons: ReactNode[] = []): TourStep {
  return {
    id,
    target,
    tone,
    icon,
    title: words.title,
    body: words.body,
    points: words.points?.map((p, i) => ({ ...p, icon: pointIcons[i] })),
  };
}

function stepsOf(chapter: Chapter, C: CareerCopy): TourStep[] {
  const T = C.tour;
  switch (chapter) {
    case "hub": {
      const tabIcons: Record<string, ReactNode> = {
        hub: <HqIcon className={SMALL} />,
        calendar: <CalendarIcon className={SMALL} />,
        squad: <ShieldIcon className={SMALL} />,
        training: <TrendUpIcon className={SMALL} />,
        market: <HandshakeIcon className={SMALL} />,
        finances: <WalletIcon className={SMALL} />,
        standings: <TargetIcon className={SMALL} />,
        news: <ClipboardIcon className={SMALL} />,
        club: <TrophyIcon className={SMALL} />,
      };
      return [
        step("welcome", T.hub.welcome, undefined, "orange", <TrophyIcon className={BIG} />, [
          <ShieldIcon key="s" className={SMALL} />,
          <WalletIcon key="w" className={SMALL} />,
          <TargetIcon key="t" className={SMALL} />,
        ]),
        {
          id: "tabs",
          target: "career-nav",
          tone: "blue",
          icon: <HqIcon className={BIG} />,
          title: T.hub.tabs.title,
          body: T.hub.tabs.body,
          pointsLayout: "grid",
          points: Object.keys(tabIcons).map((key) => ({
            icon: tabIcons[key],
            label: C.nav[key as keyof typeof C.nav],
            text: T.hub.tabs.items[key],
          })),
        },
        step("advance", T.hub.advance, "career-advance", "orange", <HourglassIcon className={BIG} />, [
          <BoltIcon key="p" className={SMALL} />,
          <CalendarIcon key="s" className={SMALL} />,
        ]),
        step("day", T.hub.day, "hub-day", "orange", <TargetIcon className={BIG} />),
        step("finances", T.hub.finances, "hub-finances", "good", <WalletIcon className={BIG} />),
        step("progress", T.hub.progress, "hub-progress", "cyan", <StarIcon className={BIG} />),
        step("inbox", T.hub.inbox, "hub-inbox", "blue", <ClipboardIcon className={BIG} />),
        step("help", T.hub.help, "career-help", "blue", <QuestionIcon className={BIG} />),
      ];
    }
    case "training":
      return [
        step("cycle", T.training.cycle, "training-cycle", "good", <TrendUpIcon className={BIG} />, [
          <TrendUpIcon key="e" className={SMALL} />,
          <HandshakeIcon key="g" className={SMALL} />,
          <HeartPulseIcon key="r" className={SMALL} />,
        ]),
        step("coach", T.training.coach, "training-coach", "blue", <CoachIcon className={BIG} />),
        step("growth", T.training.growth, "training-growth", "cyan", <PeakIcon className={BIG} />),
      ];
    case "finances":
      return [
        step("overview", T.finances.overview, "finances-overview", "good", <WalletIcon className={BIG} />),
        step("progress", T.finances.progress, "finances-progress", "cyan", <StarIcon className={BIG} />),
        step("loans", T.finances.loans, "finances-loans", "blue", <BankIcon className={BIG} />),
        step("sponsor", T.finances.sponsor, "finances-sponsor", "orange", <HandshakeIcon className={BIG} />),
      ];
    case "squad":
      return [
        step("starters", T.squad.starters, "squad-starters", "blue", <ShieldIcon className={BIG} />),
        step("bench", T.squad.bench, "squad-bench", "cyan", <CoachIcon className={BIG} />),
        step("contracts", T.squad.contracts, "squad-contracts", "orange", <ClipboardIcon className={BIG} />),
      ];
  }
}

/** Another overlay owns the screen (Modal, ceremony, sponsor prompt…). */
const dialogOpen = (): boolean => document.querySelector('[role="dialog"]') !== null;

export function CareerTour() {
  const C = useCareerCopy();
  const pathname = usePathname();
  const save = useCareerSave();
  const markFlag = useCareerStore((s) => s.markFlag);
  const markTourSeen = useProfileStore((s) => s.markTourSeen);
  const navigating = useCareerNavigation((s) => s.destination !== null);
  // The open chapter is tied to the route it was opened on: leaving the screen
  // closes it (the element it pointed at is gone) without an effect.
  const [opened, setOpened] = useState<{ chapter: Chapter; route: string } | null>(null);

  const route = careerTourRoute(pathname);
  // null on Calendar, Market, Standings, Inbox and Club: no tour, no help button.
  const chapter: Chapter | null = careerTourChapter(pathname);
  const running = save?.phase === "running";
  // Once per player since the season reset (the save's older flags do not count).
  const seen = useProfileStore((s) => (chapter ? tourSeen(s.tours, careerTourId(chapter)) : true));

  const open = opened && opened.route === route ? opened.chapter : null;

  // First visit: open once the screen has rendered its first element and no
  // other dialog is up. Polls, because the screens and their pop-ups mount late.
  useEffect(() => {
    if (!chapter || seen || open || !running || navigating) return;
    let timer = 0;
    const attempt = () => {
      const first = stepsOf(chapter, C).find((s) => s.target)?.target;
      const ready = !first || document.querySelector(`[data-tour~="${first}"]`) !== null;
      if (ready && !dialogOpen()) setOpened({ chapter, route });
      else timer = window.setTimeout(attempt, 500);
    };
    timer = window.setTimeout(attempt, 500);
    return () => window.clearTimeout(timer);
  }, [chapter, route, seen, open, running, navigating, C]);

  const steps = useMemo(() => (open ? stepsOf(open, C) : []), [open, C]);

  const close = () => {
    // Done or Skip, the automatic opening or the help button: seen for good.
    if (open) markTourSeen(careerTourId(open));
    if (open && save) {
      if (!save.flags[flagOf(open)]) markFlag(flagOf(open));
      // The explainer this chapter replaced: keeps its analytics event and its flag.
      if (open === "hub" && !save.flags["seenHub"]) markFlag("seenHub");
    }
    setOpened(null);
  };

  if (!save || !chapter) return null;

  return (
    <>
      {/* The help button: reopens this screen's chapter. Above the phone's bottom nav. */}
      <button
        type="button"
        data-tour="career-help"
        onClick={() => setOpened({ chapter, route })}
        aria-label={C.tour.help}
        title={C.tour.help}
        className="fixed bottom-[4.5rem] right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-raised/95 text-sub shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition-colors hover:border-blue/60 hover:text-blue-bright md:bottom-5 md:right-5"
      >
        <QuestionIcon className="h-5 w-5" />
      </button>

      {open && steps.length > 0 ? (
        <GuidedTour
          key={open}
          steps={steps}
          kicker={open === "hub" ? C.tour.kicker : C.nav[open]}
          labels={{ next: C.tour.next, back: C.tour.back, skip: C.tour.skip, done: C.tour.done, progress: C.tour.progress }}
          onClose={close}
        />
      ) : null}
    </>
  );
}
