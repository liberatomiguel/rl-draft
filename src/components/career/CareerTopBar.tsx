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
import { useCareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { Button } from "@/components/ui/Button";
import { TeamStars } from "@/components/career/TeamStars";
import { UserCrest } from "@/components/career/UserCrest";
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

  return (
    <div className="sticky top-14 z-30 border-b border-line bg-[color:var(--bg)]/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-3 py-1 sm:gap-3 sm:px-4">
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
        <div data-tour="career-clock" className="min-w-0 flex-1 text-center">
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
          <div data-tour="career-advance" className="flex shrink-0 items-center gap-1.5">
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

      <div data-tour="career-nav" className="px-3 pb-2 sm:hidden">
        <select
          aria-label={copy.meta.title}
          value={TABS.find(tab => tab.href === "/career" ? pathname === tab.href : pathname.startsWith(tab.href))?.href ?? "/career"}
          onChange={event => router.push(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-sm font-semibold text-ink"
        >
          {TABS.map(tab => (
            <option key={tab.key} value={tab.href}>
              {copy.nav[tab.key as keyof typeof copy.nav]}{tabHasNew(tab.key) ? ` · ${copy.toolbox.newTag}` : ""}{tab.key === "news" && unreadMail > 0 ? ` (${unreadMail})` : ""}
            </option>
          ))}
        </select>
      </div>
      <nav data-tour="career-nav" className="mx-auto hidden max-w-6xl flex-wrap items-center gap-1 px-3 pb-1.5 sm:flex sm:px-4">
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
              {tabHasNew(tab.key) ? (
                <NewDot className="ml-1 inline-block align-middle" label={copy.toolbox.newTag} />
              ) : null}
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
