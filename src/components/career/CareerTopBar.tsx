"use client";

/**
 * Road to Worlds — persistent career chrome: crest · the DATE (v0.2 day
 * clock) · budget · rep · the advance controls. v0.3: the PRIMARY action is
 * the FIFA-style ▶/⏸ autoplay (day by day, pausable any time; the autopilot
 * stops itself at every decision point); "skip ahead" batches to the next
 * stop. When something blocks (matchday, decision, ceremony) the play
 * control becomes the orange routed CONTINUE, exactly as before.
 * The news tab pill counts unread MAIL (the Inbox).
 */

import { AppLink } from "@/components/ui/AppLink";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { Button } from "@/components/ui/Button";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
import { formatDateShort } from "@/components/career/dateText";
import {
  clockLabel,
  continueKind,
  upcomingStops,
  useCareerSave,
  userStars,
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

const TABS: { key: string; href: string }[] = [
  { key: "hub", href: "/career" },
  { key: "calendar", href: "/career/calendar" },
  { key: "squad", href: "/career/squad" },
  { key: "training", href: "/career/training" },
  { key: "market", href: "/career/market" },
  { key: "finances", href: "/career/finances" },
  { key: "standings", href: "/career/standings" },
  { key: "news", href: "/career/news" },
  { key: "club", href: "/career/club" },
];

export function CareerTopBar() {
  const save = useCareerSave();
  const copy = useCareerCopy();
  const router = useRouter();
  const pathname = usePathname();
  const advanceToNextStop = useCareerStore((s) => s.advanceToNextStop);
  const autoAdvance = useCareerStore((s) => s.autoAdvance);
  const setAutoAdvance = useCareerStore((s) => s.setAutoAdvance);

  // The star read runs world-percentile math — memo on the save snapshot so
  // it recomputes per store write, not on every navigation re-render.
  const stars = useMemo(() => (save ? userStars(save) : 0), [save]);

  if (!save) return null;

  const clock = clockLabel(save);
  const kind = continueKind(save);
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
    if (kind === "event") {
      return copy.hub.continueTo(save.pendingEventDef?.name ?? save.activeEvent?.def.name ?? "");
    }
    if (kind === "seasonReview") return copy.ceremonies.seasonReview;
    if (kind === "ended") return copy.ceremonies.legacyTitle;
    if (kind === "decision") return copy.hub.nowDecision;
    return nextStopLabel ? copy.hub.continueTo(nextStopLabel) : copy.hub.continue;
  })();

  const onContinue = () => {
    if (kind === "event") {
      router.push("/career/event");
      return;
    }
    if (kind === "seasonReview" || kind === "ended") {
      router.push("/career/season");
      return;
    }
    if (kind === "decision") {
      router.push("/career");
      return;
    }
    advanceToNextStop();
  };

  // v0.3: plain-advance state exposes the autoplay pair (▶/⏸ + skip);
  // any blocked state falls back to the routed CONTINUE.
  const canAutoplay = kind === "advance" && save.phase === "running";

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-[color:var(--bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <AppLink href="/career/club" className="flex shrink-0 items-center gap-2">
          <UserCrest
            crestId={save.identity.crestId}
            colors={save.identity.colors}
            abbrev={save.identity.abbrev}
            size="sm"
          />
          <span className="hidden flex-col items-start gap-0.5 sm:flex">
            <span className="text-sm font-semibold leading-none text-ink">
              {save.identity.abbrev}
            </span>
            <TeamStars stars={stars} size="xs" />
          </span>
        </AppLink>

        {/* Center clock — the date is the game's heartbeat now. */}
        <div className="min-w-0 flex-1 text-center">
          <div className="kicker text-[9px] leading-none text-faint">{clock.season}</div>
          <div className="display truncate text-sm font-bold uppercase leading-tight tracking-wide text-ink">
            {formatDateShort(copy.dates, clock.date)}
          </div>
          {clock.split ? (
            <div className="truncate text-[10px] leading-none text-faint">
              {copy.calendar.split(clock.split)} · {copy.hub.week(clock.week)}
            </div>
          ) : null}
        </div>

        <div className="hidden shrink-0 items-center gap-3 text-right md:flex">
          <div>
            <div className="kicker text-[10px] leading-none text-faint">{copy.hub.budget}</div>
            <div
              className={cx(
                "text-sm font-semibold",
                save.finances.balance < 0 ? "text-bad" : "text-ink",
              )}
            >
              {formatMoney(save.finances.balance, { compact: true })}
            </div>
          </div>
          <div>
            <div className="kicker text-[10px] leading-none text-faint">{copy.common.rep}</div>
            <div className="text-sm font-semibold text-cyan">{Math.round(save.reputation)}</div>
          </div>
        </div>

        {canAutoplay ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => setAutoAdvance(!autoAdvance)}
              aria-pressed={autoAdvance}
              title={autoAdvance ? copy.hub.pause : nextStopLabel ? copy.hub.playHint(nextStopLabel) : copy.hub.play}
              className="max-w-[38vw] sm:max-w-none"
            >
              <span className="flex items-center gap-1.5">
                {autoAdvance ? <PauseGlyph /> : <PlayGlyph />}
                <span className="truncate">
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
              title={copy.hub.skipToNext}
              aria-label={copy.hub.skipToNext}
            >
              <span className="hidden sm:inline">{copy.hub.skipToNext}</span>
              <span className="sm:hidden">»</span>
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onContinue} className="max-w-[42vw] shrink-0 sm:max-w-none">
            <span className="truncate">{continueLabel}</span>
          </Button>
        )}
      </div>

      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 pb-1.5 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active =
            tab.href === "/career" ? pathname === "/career" : pathname.startsWith(tab.href);
          return (
            <AppLink
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-blue/15 text-blue-bright shadow-[inset_0_-2px_0_var(--blue)]"
                  : "text-sub hover:bg-white/5 hover:text-ink",
              )}
            >
              {copy.nav[tab.key as keyof typeof copy.nav]}
              {tab.key === "news" && unreadMail > 0 ? (
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-orange/20 px-1 font-mono text-[10px] leading-4 text-orange-bright">
                  {unreadMail}
                </span>
              ) : null}
            </AppLink>
          );
        })}
      </nav>
    </div>
  );
}
