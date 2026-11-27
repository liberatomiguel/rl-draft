"use client";

/**
 * Road to Worlds — persistent career chrome: crest · the DATE (v0.2 day
 * clock) · budget · rep · the advance controls. v0.3: the PRIMARY action is
 * the FIFA-style ▶/⏸ autoplay (day by day, pausable any time; the autopilot
 * stops itself at every decision point); "skip ahead" batches to the next
 * stop. When something blocks (matchday, decision, ceremony) the play
 * control becomes the orange routed CONTINUE, exactly as before.
 * v2.0 (R40): a Major / Worlds paused after its Saturday Swiss is its own
 * routed CONTINUE — "Advance — Championship Sunday" moves exactly one day
 * (continueEventToNextDay) and opens the event screen's Sunday card — once
 * the event screen has revealed Saturday's verdict (careerRevealStore).
 * The news tab pill counts unread MAIL (the Inbox).
 */

import { AppLink } from "@/components/ui/AppLink";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { standingOf } from "@/engine/career/established";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { Button } from "@/components/ui/Button";
import { TeamStars } from "@/components/career/TeamStars";
import { UserOrgMark } from "@/components/career/OrgMark";
import { CareerTabBar } from "@/components/career/CareerTabBar";
import { NewDot } from "@/components/ui/NewDot";
import { useNewTab } from "@/store/useNewItems";
import { careerNewSummary } from "@/engine/career/careerNew";
import { formatDateShort } from "@/components/career/dateText";
import {
  clockLabel,
  upcomingStops,
  useCareerSave,
  useRevealHeldEventId,
  userStars,
  visibleContinueKind,
} from "@/components/career/careerUi";

/** Inline glyphs (the design system has no icon set — keep them tiny). */
const PlayGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
    <path d="M2.5 1.5v9l8-4.5z" />
  </svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
    <path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" />
  </svg>
);

// Grouped by what the tab is about: the season's clock, the team, the books and the table, the club's desk.
const TABS: { key: string; href: string; group: number }[] = [
  { key: "hub", href: "/career", group: 0 },
  { key: "calendar", href: "/career/calendar", group: 0 },
  { key: "squad", href: "/career/squad", group: 1 },
  { key: "training", href: "/career/training", group: 1 },
  { key: "market", href: "/career/market", group: 1 },
  { key: "finances", href: "/career/finances", group: 2 },
  { key: "standings", href: "/career/standings", group: 2 },
  { key: "news", href: "/career/news", group: 3 },
  { key: "club", href: "/career/club", group: 3 },
  // v2.0.30: the way back to the three slots (switch career, or pick one the
  // account brought from another device). Before, the picker only showed when
  // no career was active.
  { key: "saves", href: "/career/saves", group: 4 },
];

export function CareerTopBar() {
  const save = useCareerSave();
  const copy = useActiveCareerCopy();
  const standingTier = save ? (standingOf(save)?.tier ?? null) : null;
  const router = useRouter();
  const pathname = usePathname();
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const scrimPlaying = useCareerStore((s) => Boolean(s.scrimPlayback));
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);
  // R40 review / rc.29 (CAR-02): the playback's hold — live, or from its session cursor.
  const revealHeldEventId = useRevealHeldEventId(save);

  // The star read runs world-percentile math — memo on the save snapshot so
  // it recomputes per store write, not on every navigation re-render.
  const stars = useMemo(() => (save ? userStars(save) : 0), [save]);
  // rc.34 (UX-06): the tabs' "New" dots — contracts (urgent) on Squad, the toolbox on Finances.
  const arrivals = useMemo(() => save ? [...careerNewSummary(save).keys] : [], [save]);
  const scope = `career:${save?.careerId ?? save?.careerSeed ?? "none"}`;
  const toolKeys = arrivals.filter(k => k.startsWith("tb:"));
  const financeKeys = [...toolKeys, ...(save?.mail.filter(m => !m.read && (m.kind === "sponsor" || (m.kind === "unlock" && String(m.params?.name).startsWith("sponsors")))).map(m => `mail:${m.id}`) ?? [])];
  const marketKeys = save?.mail.filter(m => !m.read && m.kind === "unlock" && ["coach", "exProCoach"].includes(String(m.params?.name))).map(m => `mail:${m.id}`) ?? [];
  const squadDot = useNewTab(`${scope}:squad`, arrivals.filter(k => k.startsWith("ct:")), pathname === "/career/squad");
  const financesDot = useNewTab(`${scope}:finances`, financeKeys, pathname === "/career/finances");
  const marketDot = useNewTab(`${scope}:market`, marketKeys, pathname === "/career/market");
  const hubDot = useNewTab(`${scope}:hub`, toolKeys, pathname === "/career");

  if (!save) return null;

  const clock = clockLabel(save);
  // R40 review: no spoiler while the event screen still reveals Saturday.
  const kind = visibleContinueKind(save, revealHeldEventId);
  const unreadMail = save.mail.filter((m) => !m.read).length;

  // Plain advance names its destination: the next stop ahead of the clock.
  const nextStop = kind === "advance" ? (upcomingStops(save, 1)[0] ?? null) : null;
  const nextStopLabel = nextStop
    ? nextStop.kind === "event" && nextStop.event
      ? nextStop.event.name
      : nextStop.kind === "window"
        ? copy.calendar.window
        : nextStop.kind === "payday"
          ? copy.calendar.payday
          : copy.calendar.seasonEnd
    : null;

  const continueLabel = (() => {
    if (kind === "eventPaused") return copy.hub.continueTo(copy.event.championshipSunday);
    // rc.36 (SUN-01): Saturday evening — Sunday is started from HQ.
    if (kind === "sunday") return copy.sunday.start;
    if (kind === "event") {
      return copy.hub.continueTo(save.pendingEventDef?.name ?? save.activeEvent?.def.name ?? "");
    }
    if (kind === "seasonReview") return copy.ceremonies.seasonReview;
    if (kind === "ended") return copy.ceremonies.legacyTitle;
    if (kind === "decision") return copy.hub.nowDecision;
    return nextStopLabel ? copy.hub.continueTo(nextStopLabel) : copy.hub.continue;
  })();
  // rc.29 (CAR-07): below sm the routed button shows a SHORT label — the full
  // one ("Advance — Championship Sunday") truncated to "ADVANCE — CHAMPIONS…"
  // at 390 px: Sunday's own short label, the event's name, the next stop.
  const continueShort = (() => {
    if (kind === "eventPaused") return copy.event.continueToSundayShort;
    if (kind === "event") return save.pendingEventDef?.name ?? save.activeEvent?.def.name ?? continueLabel;
    if (kind === "advance" && nextStopLabel) return nextStopLabel;
    return continueLabel;
  })();

  const onContinue = () => {
    if (kind === "eventPaused") {
      continueEventToNextDay();
      router.push("/career/event");
      return;
    }
    if (kind === "event") {
      router.push("/career/event");
      return;
    }
    if (kind === "seasonReview" || kind === "ended") {
      router.push("/career/season");
      return;
    }
    if (kind === "decision" || kind === "sunday") {
      router.push("/career");
      return;
    }
    advanceToNextStop();
  };

  // v0.3: plain-advance state exposes the autoplay pair (▶/⏸ + skip);
  // any blocked state falls back to the routed CONTINUE.
  const canAutoplay = kind === "advance" && save.phase === "running";
  const tabHasNew = (key: string) =>
    (key === "squad" && squadDot) || (key === "finances" && financesDot) ||
    (key === "market" && marketDot) || (key === "hub" && hubDot);

  // Phone (mobile redesign, stage 3): this bar is the ONE bar on top (the site
  // header is not pinned inside the career, see `html[data-career]` in
  // globals.css, so it sticks at 0) and the tabs are the bar on the bottom edge
  // (CareerTabBar), in place of the `<select>` that used to sit under it.
  return (
    <>
    <div className="sticky top-0 z-30 border-b border-line bg-bg sm:top-14">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-3 py-1 sm:gap-3 sm:px-4">
        {/* Phone: the way back to the main menu, always on screen (Miguel, 24/11:
            the site header scrolls away in the career and its nav is hidden, so
            the exit was three taps deep, in More). Desktop keeps the site header. */}
        <AppLink
          href="/"
          aria-label={copy.nav.exit}
          title={copy.nav.exit}
          className="-ml-2 -mr-1 flex h-11 w-9 shrink-0 items-center justify-center text-sub transition-colors hover:text-ink sm:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AppLink>
        {/* Under 360px the crest gives its room to the date (the club is in More). */}
        <AppLink href="/career/club" className="flex shrink-0 items-center gap-2 max-[359px]:hidden">
          <UserOrgMark identity={save.identity} seasonIndex={save.clock.seasonIndex} size="sm" />
          {/* rc9 DS: the club is a name (mixed case, Demi); the date is the bar's one figure. */}
          <span className="hidden flex-col items-start gap-1 sm:flex">
            <span className="display max-w-44 truncate text-[15px] font-bold leading-none text-ink">
              <span className="lg:hidden">{save.identity.abbrev}</span>
              <span className="hidden lg:inline">{save.identity.orgName}</span>
            </span>
            <TeamStars stars={stars} size="xs" />
          </span>
        </AppLink>

        {/* Center clock — the date is the game's heartbeat now. */}
        <div data-tour="career-clock" className="min-w-0 flex-1 text-center">
          <div className="kicker truncate leading-none">{clock.season}</div>
          <div className="display mt-1 truncate text-[17px] font-bold leading-tight text-ink">
            {formatDateShort(copy.dates, clock.date)}
          </div>
          {clock.split ? (
            <div className="mt-0.5 truncate text-[11px] leading-none text-faint">
              {copy.calendar.split(clock.split)} · {copy.hub.week(clock.week)}
            </div>
          ) : null}
        </div>

        {/* Two quiet figures: Medium, the label above in the faint step. */}
        <div className="hidden shrink-0 items-center gap-5 text-right md:flex">
          <div>
            <div className="kicker leading-none">{copy.hub.budget}</div>
            <div
              className={cx(
                "display mt-1 text-[15px] font-semibold leading-tight tabular-nums",
                save.finances.balance < 0 ? "text-bad" : "text-ink",
              )}
            >
              {formatMoney(save.finances.balance, { compact: true })}
            </div>
          </div>
          <div>
            <div className="kicker leading-none">{copy.common.rep}</div>
            <div className="display mt-1 text-[15px] font-semibold leading-tight tabular-nums text-ink">
              {Math.round(save.reputation)}
              {/* rc.6 (ORGMODE UI-C): an established org's number is its Standing, read with its tier. */}
              {standingTier ? <span className="ml-1.5 text-xs text-sub">{copy.board.standing.tier[standingTier] ?? standingTier}</span> : null}
            </div>
          </div>
        </div>

        {canAutoplay ? (
          <div data-tour="career-advance" className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => setAutoAdvance(!autoAdvance)}
              aria-pressed={autoAdvance}
              title={autoAdvance ? copy.hub.pause : nextStopLabel ? copy.hub.playHint(nextStopLabel) : copy.hub.play}
              aria-label={autoAdvance ? copy.hub.pause : copy.hub.play}
              className="max-w-[38vw] sm:max-w-none"
            >
              <span className="flex items-center gap-1.5">
                {autoAdvance ? <PauseGlyph /> : <PlayGlyph />}
                {/* Under 360px the glyph says it: the word took the date's room. */}
                <span className="truncate max-[359px]:hidden">
                  {autoAdvance ? copy.hub.pause : copy.hub.play}
                  {!autoAdvance && nextStopLabel ? (
                    <span className="hidden sm:inline"> · {nextStopLabel}</span>
                  ) : null}
                </span>
              </span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onContinue}
              disabled={scrimPlaying}
              title={copy.hub.skipToNext}
              aria-label={copy.hub.skipToNext}
            >
              <span className="hidden sm:inline">{copy.hub.skipToNext}</span>
              <span className="sm:hidden">»</span>
            </Button>
          </div>
        ) : (
          <Button data-tour="career-advance" size="sm" onClick={onContinue} className="max-w-[48vw] shrink-0 sm:max-w-none">
            <span className="truncate sm:hidden">{continueShort}</span>
            <span className="hidden truncate sm:inline">{continueLabel}</span>
          </Button>
        )}
      </div>

      <nav data-tour="career-nav" className="mx-auto hidden max-w-6xl flex-wrap items-stretch px-3 sm:flex sm:px-4">
        {TABS.map((tab, i) => {
          const active =
            tab.href === "/career" ? pathname === "/career" : pathname.startsWith(tab.href);
          const startsGroup = i > 0 && TABS[i - 1].group !== tab.group;
          return (
            <AppLink
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                // The current tab is marked by weight and the orange rule, not by colour alone.
                // rc9 DS: tabs are caps in Medium; the current one is Demi in ink over the orange rule.
                "display relative flex min-h-11 items-center whitespace-nowrap px-2 text-[13px] uppercase transition-colors xl:px-3",
                startsGroup && tab.group < 4 && "ml-3 before:absolute before:-left-1.5 before:top-1/2 before:h-3.5 before:w-px before:-translate-y-1/2 before:bg-line-strong",
                tab.group === 4 && "ml-auto",
                active
                  ? "font-bold text-ink shadow-[inset_0_-2px_0_var(--orange)]"
                  : "font-semibold text-sub hover:text-ink hover:shadow-[inset_0_-2px_0_var(--line-strong)]",
              )}
            >
              {copy.nav[tab.key as keyof typeof copy.nav]}
              {tabHasNew(tab.key) ? (
                <NewDot className="ml-1 inline-block align-middle" label={copy.toolbox.newTag} />
              ) : null}
              {tab.key === "news" && unreadMail > 0 ? (
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-sm bg-orange/20 px-1 tabular-nums text-[11px] leading-4 text-orange-bright">
                  {unreadMail}
                </span>
              ) : null}
            </AppLink>
          );
        })}
      </nav>
    </div>
    <CareerTabBar pathname={pathname} hasNew={(key) => Boolean(tabHasNew(key))} unreadMail={unreadMail} />
    </>
  );
}
