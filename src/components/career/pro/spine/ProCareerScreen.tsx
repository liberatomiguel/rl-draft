"use client";

/**
 * v2.2 Pro spine (PROSPINE): the Pro's career hub. Four tabs, phone first:
 * Today (the day, the next matchday, the match report, the week, Continue),
 * Team (lineup, coach trust, contract), Offers (accept / counter / decline)
 * and Inbox (his news and the scene's). Every button calls one proFlow step
 * through the store; a refused step writes nothing and the screen says why.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { weekOfDay, dayOfWeekOf } from "@/engine/career/calendar";
import { RANKS } from "@/config/balance";
import { proOverall } from "@/engine/career/pro/attrs";
import { rankOf } from "@/engine/career/pro/ranked";
import { retirementOutlookOf } from "@/engine/career/pro/retire";
import { firstCallOf } from "@/engine/career/pro/team";
import { isBurnedOut } from "@/engine/career/pro/week";
import type { ProSave } from "@/engine/career/pro/types";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import {
  advanceProDayFlow,
  advanceProToNextStopFlow,
  canRetireProNow,
  keepPlayingFlow,
  retireProFlow,
  continueProSeasonFlow,
  dismissProSeasonReviewFlow,
  markProNewsReadFlow,
  openProOffersOf,
  playProEventFlow,
  proNextEventOf,
  proStartsOf,
  proStopOf,
  proTeamNameOf,
  weekPlanOf,
} from "@/store/proFlow";
import { activeProSave, useProStore } from "@/store/proStore";
import { useMounted } from "@/store/useMounted";
import { ProInbox } from "./ProInbox";
import { ProGoodbye } from "./ProGoodbye";
import { ProLive } from "./ProLive";
import { ProSeasonReviewPanel } from "./ProSeasonReview";
import { ProLastWeek, ProWeekGate } from "./ProWeekGate";
import { ProOffers } from "./ProOffers";
import { ProReport } from "./ProReport";
import { ProTeam } from "./ProTeam";

type Tab = "today" | "team" | "offers" | "inbox";

export function ProCareerScreen() {
  const C = useCareerCopy();
  const P = C.proWorld;
  const router = useRouter();
  const mounted = useMounted();
  const save = useProStore((s) => activeProSave(s));
  const apply = useProStore((s) => s.apply);
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    if (mounted && !save) router.replace("/career/pro");
  }, [mounted, save, router]);

  if (!mounted || !save) return <div className="min-h-[60vh]" aria-busy />;

  const offers = openProOffersOf(save).length;
  const unread = save.news.filter((n) => !n.read).length;
  const tabs: { id: Tab; badge: number }[] = [
    { id: "today", badge: 0 },
    { id: "team", badge: 0 },
    { id: "offers", badge: offers },
    { id: "inbox", badge: unread },
  ];

  return (
    <div className="rise-in mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        title={save.player.name}
        kicker={P.date(save.clock.seasonIndex + 1, weekOfDay(save.clock.day), P.days[dayOfWeekOf(save.clock.day)] ?? "")}
        right={
          <AppLink href="/career/pro/player" className="flex min-h-11 flex-col items-end justify-center text-blue-bright hover:underline">
            <span className="display text-xl font-bold leading-none">{Math.floor(proOverall(save.player.attrs))}</span>
            <span className="mt-0.5 text-xs font-semibold">{C.pro.player.overall}</span>
          </AppLink>
        }
      />

      <nav className="mt-4 flex gap-1 border-b border-line" aria-label={P.title}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "inbox" && unread > 0) apply(markProNewsReadFlow);
            }}
            className={`relative -mb-px min-h-11 flex-1 border-b-2 px-2 text-sm font-semibold ${tab === t.id ? "border-orange text-ink" : "border-transparent text-sub hover:text-ink"}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {P.tabs[t.id]}
            {t.badge > 0 ? <span className="ml-1.5 rounded-full bg-blue-bright/20 px-1.5 text-xs text-blue-bright">{t.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "today" ? <Today save={save} onTab={setTab} /> : null}
        {tab === "team" ? <ProTeam save={save} /> : null}
        {tab === "offers" ? <ProOffers save={save} /> : null}
        {tab === "inbox" ? <ProInbox save={save} /> : null}
      </div>
    </div>
  );
}

function Today({ save, onTab }: { save: ProSave; onTab: (t: Tab) => void }) {
  const C = useCareerCopy();
  const P = C.proWorld;
  const apply = useProStore((s) => s.apply);
  const stop = proStopOf(save);
  const team = proTeamNameOf(save);
  const starts = proStartsOf(save);
  const next = proNextEventOf(save);
  const plan = weekPlanOf(save);
  const offers = openProOffersOf(save);

  const outlook = save.stage === "retired" ? null : retirementOutlookOf(save.player, save.clock.seasonIndex);
  const callInfo = save.stage === "ranked" ? firstCallOf(save.player) : null;
  const rk = rankOf(save.player.mmr);
  const first = callInfo
    ? {
        cups: RANKS.find((r) => r.id === callInfo.cupsRankId)?.label ?? callInfo.cupsRankId,
        rank: `${rk.label}${rk.division ? ` ${"I".repeat(rk.division)}` : ""}`,
        overall: callInfo.overall,
        need: callInfo.needOverall,
      }
    : null;
  const status =
    save.stage === "amateur" && team
      ? P.amateurTeam(team)
      : save.stage === "org" && team
        ? P.orgTeam(team, starts === true)
        : save.stage === "freeAgent"
          ? P.freeAgent
          : first
            ? P.prologue(first.cups, first.rank, first.overall, first.need)
            : P.noTeam;

  if (save.stage === "retired") return <Retired save={save} />;

  // Polish: the season just closed gets its own screen first, once.
  if (save.pendingReview != null && (save.seasonReviews ?? []).some((r) => r.seasonIndex === save.pendingReview)) {
    return (
      <div className="space-y-5">
        <ProSeasonReviewPanel save={save} season={save.pendingReview} onClose={() => apply(dismissProSeasonReviewFlow)} />
      </div>
    );
  }

  // Mid-series the screen is the series and nothing else: no week strip, no Continue bar over the options.
  if (save.live && (stop?.kind === "matchday" || stop?.kind === "event")) return <ProLive save={save} eventName={stop.eventName} />;

  return (
    <div className="space-y-5">
      {save.stage === "ranked" && offers.length > 0 ? null : <p className="text-sm leading-snug text-sub">{status}</p>}

      <ProLastWeek save={save} />

      {outlook?.lastSeason ? <p className="text-sm font-semibold text-orange-bright">{P.retire.lastSeason(outlook.age)}</p> : outlook?.mayEnd ? <p className="text-sm text-sub">{P.retire.mayEnd}</p> : null}

      {save.retireOffer ? <RetireOffer /> : null}

      {stop?.kind === "weekPlan" ? <ProWeekGate save={save} /> : null}

      {stop?.kind === "seasonEnd" ? (
        <Panel className="p-5">
          <h3 className="display text-lg font-bold uppercase leading-none text-ink">{P.seasonEnd}</h3>
          <p className="mt-2 text-sm leading-snug text-sub">{P.seasonEndBody}</p>
          <Button variant="primary" size="lg" className="mt-4" onClick={() => apply(continueProSeasonFlow)}>
            {P.startSeason}
          </Button>
        </Panel>
      ) : null}

      {(stop?.kind === "matchday" || stop?.kind === "event") && save.live ? <ProLive save={save} eventName={stop.eventName} /> : null}

      {(stop?.kind === "matchday" || stop?.kind === "event") && !save.live ? (
        <Panel className="p-5">
          <p className="kicker mb-2">{P.next}</p>
          <h3 className="display text-lg font-bold uppercase leading-none text-ink">{stop.eventName}</h3>
          <Button variant="primary" size="lg" className="mt-4" onClick={() => apply(playProEventFlow)}>
            {stop.kind === "matchday" ? P.playMatchday(stop.eventName) : P.continueEvent(stop.eventName)}
          </Button>
        </Panel>
      ) : null}

      {save.report ? <ProReport save={save} /> : null}

      {offers.length > 0 ? (
        <button type="button" onClick={() => onTab("offers")} className="block w-full text-left">
          <Panel className="p-4 hover:border-line-strong">
            <p className="text-sm font-semibold text-ink">{C.proWorld.offers.title}: {offers.length}</p>
            <p className="mt-1 text-xs text-sub">{offers.map((o) => o.name).join(", ")}</p>
          </Panel>
        </button>
      ) : null}

      {!stop && !save.report ? (
        <div>
          <p className="kicker mb-1">{P.next}</p>
          <p className="text-sm text-ink">
            {next
              ? P.nextEvent(next.name, P.days[dayOfWeekOf(next.day)] ?? "")
              : save.stage === "org"
                ? P.nextOrg
                : P.nextNone}
          </p>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="kicker">{P.weekPlan}</p>
          <AppLink href="/career/pro/week" className="text-sm font-semibold text-blue-bright hover:underline">
            {P.openWeek}
          </AppLink>
        </div>
        <ol className="mt-2 grid grid-cols-3 gap-2">
          {plan.map((a, i) => (
            <li key={i} className="rounded-md border border-line px-2 py-2 text-center">
              <span className="block text-[11px] uppercase tracking-wider text-faint">{P.block[i]}</span>
              <span className="mt-0.5 block text-sm font-semibold text-ink">{P.activity[a.kind]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-faint">{save.thisWeek?.source === "fallback" ? P.notices.planFellBack(Math.round(save.player.energy)) : save.thisWeek?.source === "own" || save.thisWeek?.source === "repeat" ? P.yourPlan : P.coachPlan}</p>
        <p className={isBurnedOut(save.player) ? "mt-2 text-sm text-orange-bright" : "mt-2 text-sm text-sub"}>
          {isBurnedOut(save.player) ? C.proWeek.warn.burnedOut : `${C.proWeek.energy}: ${Math.round(save.player.energy)}`}
        </p>
      </div>

      {stop?.kind === "weekPlan" || stop?.kind === "seasonEnd" ? null : (
        <>
        <div className="action-dock flex items-center gap-2 sm:border-t sm:border-line sm:pt-5">
          <Button variant="primary" size="lg" className="max-sm:flex-1" onClick={() => apply(advanceProToNextStopFlow)}>
            {P.advance}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => apply(advanceProDayFlow)}>
            {P.oneDay}
          </Button>
        </div>
        <div>
          <p className="text-xs leading-snug text-faint">{P.advanceHint}</p>
          {offers.length > 0 ? <p className="mt-2 text-xs leading-snug text-orange-bright">{P.offerOpenHint}</p> : null}
        </div>
        </>
      )}

      {canRetireProNow(save) && !save.retireOffer ? <RetireChoice /> : null}

      <History save={save} />
    </div>
  );
}

function History({ save }: { save: ProSave }) {
  const P = useCareerCopy().proWorld;
  const [shown, setShown] = useState<number | null>(null);
  if (save.history.length === 0) return null;
  return (
    <div>
      <p className="kicker mb-2">{P.history.title}</p>
      <ul className="space-y-1.5 text-sm">
        {[...save.history].reverse().map((h) => (
          <li key={h.seasonIndex} className="border-b border-line pb-1.5">
            <div className="flex flex-wrap justify-between gap-x-3">
              <span className="text-ink">{P.history.line(h.age, Math.floor(h.overallStart), Math.floor(h.overallEnd))}</span>
              <span className="text-sub">{P.history.series(h.series, h.seriesWon, h.avgRating === null ? "-" : h.avgRating.toFixed(1))}</span>
            </div>
            {h.role ? (
              <p className="mt-0.5 text-xs text-faint">
                {[h.team, P.roles[h.role], h.games ? P.history.games(h.games) : null, ...(h.results ?? [])].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {(save.seasonReviews ?? []).some((r) => r.seasonIndex === h.seasonIndex) ? (
              <button type="button" className="mt-1 min-h-11 text-sm font-semibold text-blue-bright hover:underline" onClick={() => setShown(shown === h.seasonIndex ? null : h.seasonIndex)}>
                {P.seasonReview.open}
              </button>
            ) : null}
            {shown === h.seasonIndex ? <ProSeasonReviewPanel save={save} season={h.seasonIndex} onClose={() => setShown(null)} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Retired({ save }: { save: ProSave }) {
  const apply = useProStore((s) => s.apply);
  return (
    <div className="space-y-5">
      {save.pendingReview != null ? <ProSeasonReviewPanel save={save} season={save.pendingReview} onClose={() => apply(dismissProSeasonReviewFlow)} /> : null}
      <ProGoodbye save={save} />
      <History save={save} />
    </div>
  );
}

/** Retiring by choice goes through a confirm: the same end, the same goodbye screen. */
function RetireChoice() {
  const P = useCareerCopy().proWorld;
  const apply = useProStore((s) => s.apply);
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <Panel className="p-5">
        <h3 className="display text-lg font-bold uppercase leading-none text-ink">{P.retire.confirmTitle}</h3>
        <p className="mt-2 text-sm leading-snug text-sub">{P.retire.confirmBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => apply(retireProFlow)}>
            {P.retire.confirm}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {P.retire.cancel}
          </Button>
        </div>
      </Panel>
    );
  }
  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {P.retire.retire}
      </Button>
      <p className="mt-1 text-xs text-faint">{P.retire.retireHint}</p>
    </div>
  );
}

function RetireOffer() {
  const P = useCareerCopy().proWorld;
  const apply = useProStore((s) => s.apply);
  return (
    <Panel className="p-5">
      <h3 className="display text-lg font-bold uppercase leading-none text-ink">{P.retire.offerTitle}</h3>
      <p className="mt-2 text-sm leading-snug text-sub">{P.retire.offerBody}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => apply(keepPlayingFlow)}>
          {P.retire.keepGoing}
        </Button>
        <Button variant="secondary" onClick={() => apply(retireProFlow)}>
          {P.retire.retire}
        </Button>
      </div>
    </Panel>
  );
}
