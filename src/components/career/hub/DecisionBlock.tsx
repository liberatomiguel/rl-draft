"use client";

/**
 * Road to Worlds hub — THE DECISION BLOCK (rc.34, ROADMAP UX-01a;
 * HQ-CONTRACT H1, Gate 3a decision 1-B). HQ's top block shows exactly one
 * thing: the next needed decision, or the clock when none is due. It reads
 * ONE queue (store/careerDecisions.pendingDecisionsOf — the list the clock
 * itself obeys), shows the first decision not parked, lists the others with
 * their deadlines on one line (a tap brings one into the block), and offers
 * "Later" only where 1-B allows it (a bid, the sponsor offers) until their
 * deadline day. Warnings that are not decisions (cash, the Backer, contracts
 * running out) sit under the block as one line each, linking to their screen.
 *
 * Each decision kind renders its own card: the cards of other fronts (DEV-03's
 * training proposal, ECO-04's SponsorOfferCard, H's money notice, which H
 * shows as a modal at the career shell) are PLACED here, never restyled.
 */

import { BoardDecision } from "@/components/career/board/BoardParts";
import { beginCareerNavigation } from "../careerNavigation";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CAREER_PAYROLL } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave, TradeProposal, TransferOffer } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { canSkipShortSquadEvent, runwayWeeksOf, squadHoldFor, tradeAcceptPlanFor, tradeCashOf, tradeProposalsOf, weeklyStatementOf } from "@/store/careerFlow";
import { pendingDecisionsOf, type PendingDecision } from "@/store/careerDecisions";
import { followCardOf, sundayAheadOf, sundayWithoutYouOf } from "@/store/careerSunday";
import { trainingDecisionOf } from "@/store/careerTraining";
import { TrainingProposalCard } from "@/components/career/training/TrainingPackageParts";
import { SponsorDecisionPrompt } from "@/components/career/sponsors/SponsorDecisionPrompt";
import { contractWarnsFor } from "@/engine/career/careerNew";
import {
  dateOfDay,
  eventDayPhaseOf,
  nameOfRef,
  prizeShareLabelOf,
  wageLabel,
  useRevealHeldEventId,
} from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { ContinueToSundayLabel } from "@/components/career/event/WeekendPlan";
import { weekendRoleOf } from "@/components/career/event/weekendView";
import { DayCard } from "@/components/career/hub/DayCard";
import { SeasonPlanChoice } from "@/components/career/hub/SeasonPlanChoice";
import { DECISION_TITLE } from "@/components/career/hub/hubShared";
import { pendingMandateOf, pendingPackageOf } from "@/store/boardFlow";
import { NowFollow, NowSunday } from "@/components/career/hub/SundayCard";
import {
  NowBacker,
  NowBid,
  NowEvent,
  NowInsert,
  NowInvite,
  NowSeason,
  NowSquadShort,
  NowTrade,
} from "@/components/career/hub/NowCards";
import { SaleConsequences } from "@/components/career/SaleConsequences";
import { PostDecision } from "@/components/career/feed/PostDecision"; // rc9 STORIES
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** The decision's short name for the "Also" line. */
function decisionLabelOf(C: CareerCopy, save: CareerSave, d: PendingDecision): string {
  if (d.kind === "bid") {
    const offer = save.pendingOffers.find((o) => o.id === d.id);
    if (!offer) {
      // R135: an agreed or countered trade rides the same decision kind.
      const trade = tradeProposalsOf(save).find((p) => p.id === d.id);
      if (trade) return C.hub.decisionKind.trade(trade.takeName);
    }
    return C.hub.decisionKind.bid(offer?.playerName ?? "?");
  }
  return C.hub.decisionKind[d.kind];
}

function deadlineTextOf(C: CareerCopy, save: CareerSave, d: PendingDecision): string | null {
  if (!d.deadline) return null;
  if (d.deadline.seasonIndex === save.clock.seasonIndex && d.deadline.day <= save.clock.day) return C.hub.dueToday;
  return C.hub.dueBy(formatDateShort(C.dates, dateOfDay(d.deadline.seasonIndex, d.deadline.day)));
}

/** 1-B: "Later" (until the deadline) or, on the deadline day, the note that the clock waits. */
function LaterRow({ C, d, onLater }: { C: CareerCopy; d: PendingDecision; onLater: () => void }) {
  const until = d.deadline ? formatDateShort(C.dates, dateOfDay(d.deadline.seasonIndex, d.deadline.day)) : "";
  if (!d.canWait) {
    return <p className="mt-3 text-xs font-semibold text-orange-bright">{C.hub.lastDay}</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="ghost" size="md" className="min-h-11" onClick={onLater}>
        {C.hub.later}
      </Button>
      <span className="text-xs text-faint">{C.hub.standsUntil(until)}</span>
    </div>
  );
}

/** rc9 HQ (#243): one warning that is not a decision, as a row that opens its tab. */
function WarnRow({ href, tone, tab, children }: { href: string; tone: "orange" | "bad"; tab: string; children: React.ReactNode }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <AppLink href={href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03] sm:px-5">
        <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-full", tone === "bad" ? "bg-bad" : "bg-orange")} />
        <div className="min-w-0 flex-1 text-sm leading-snug text-ink">{children}</div>
        <span className="shrink-0 text-xs font-semibold text-blue-bright">{tab}</span>
      </AppLink>
    </li>
  );
}

export function DecisionBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const router = useRouter();
  const enterEvent = useCareerStore(s => s.enterEvent);
  const acceptBid = useCareerStore((s) => s.acceptBid);
  const declineBid = useCareerStore((s) => s.declineBid);
  const acceptUnofficial = useCareerStore((s) => s.acceptUnofficial);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  const resolveInsert = useCareerStore((s) => s.resolveInsert);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);
  const parkDecision = useCareerStore((s) => s.parkDecision);
  const skipShortSquadEvent = useCareerStore((s) => s.skipShortSquadEvent);
  const approveTrainingProposal = useCareerStore((s) => s.approveTrainingProposal);
  const keepBaseTraining = useCareerStore((s) => s.keepBaseTraining);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const revealHeld = useRevealHeldEventId(save);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmBid, setConfirmBid] = useState<TransferOffer | null>(null);
  const [confirmTrade, setConfirmTrade] = useState<TradeProposal | null>(null);

  const queue = useMemo(() => {
    const pending = pendingDecisionsOf(save);
    const needsManager = pending.some(d => d.holds || d.kind === "bid" || d.kind === "sponsor");
    return needsManager ? pending.filter(d => d.kind !== "follow") : pending;
  }, [save]);
  const focused = focusId ? (queue.find((d) => d.id === focusId) ?? null) : null;
  const top = queue.find(d => d.kind === "sponsor" && !d.parked) ?? focused ?? queue.find((d) => !d.parked) ?? null;
  const others = queue.filter((d) => d !== top && d.kind !== "follow");

  const D = C.dates;
  const today = save.clock.day;

  const later = (d: PendingDecision) => {
    parkDecision(d.id);
    setFocusId(null);
  };

  // rc9 HQ (#242): one table of decision kinds. `Record` over the queue's kind
  // makes TypeScript ask for a row when a kind is added, so a new decision is
  // added here and in its copy (`C.hub.decisionKind`), nowhere else.
  const VIEWS: Record<PendingDecision["kind"], (d: PendingDecision) => React.ReactNode> = {
    event: () => {
        const ev = save.activeEvent?.def ?? save.pendingEventDef;
        if (!ev) return null;
        // R40 / rc.29 (CAR-02): a Saturday the playback has not finished revealing reads as the Swiss stage.
        const rawPhase = eventDayPhaseOf(save);
        const phase = rawPhase === "paused" && revealHeld !== null && revealHeld === save.activeEvent?.def.id ? "swiss" : rawPhase;
        const role = weekendRoleOf(ev, today);
        const stage =
          phase === "paused"
            ? { label: ev.layout ? C.event.formats.stageComplete[ev.layout.stage] : C.event.swissComplete, tone: "good" as const }
            : role === "championshipSunday"
              ? { label: C.event.championshipSunday, tone: "gold" as const, live: true }
              : role === "swissDay"
                ? { label: ev.layout ? C.event.formats.stage[ev.layout.stage] : C.event.swissStage, tone: "orange" as const, live: true }
                : undefined;
        // rc.34: a Community Cup's matchday holds the clock — Play, or Pass explicitly (no silent walk past).
        const cupLobby = !save.activeEvent && (ev.tier === "t2" || ev.tier === "t3");
        return (
          <>
            <NowEvent
              save={save}
              C={C}
              D={D}
              def={ev}
              daysAway={0}
              day={today}
              stage={stage}
              onPass={cupLobby ? passUnofficial : undefined}
              primaryLabel={phase === "paused" ? <ContinueToSundayLabel /> : ev.teamSize ? C.event.watch : C.hub.continue}
              onPrimary={() => {
                beginCareerNavigation("/career/event");
                if (ev.teamSize && !save.activeEvent) enterEvent(true);
                // R40: the paused Saturday moves exactly one day, to Championship Sunday.
                if (phase === "paused") continueEventToNextDay();
                router.push("/career/event");
              }}
            />
          </>
        );
    },
    sunday: () => {
        // rc.36 (SUN-01): Saturday evening — the briefing and "Start Sunday". While the event
        // screen still reveals Saturday (CAR-02), the card would spoil it: the event's own Continue.
        const ahead = sundayAheadOf(save);
        if (!ahead) return null;
        if (revealHeld !== null && revealHeld === save.activeEvent?.def.id) {
          return (
            <NowEvent
              save={save}
              C={C}
              D={D}
              def={ahead.def}
              daysAway={0}
              day={today}
              stage={{ label: ahead.def.layout ? C.event.formats.stage[ahead.def.layout.stage] : C.event.swissStage, tone: "orange", live: true }}
              primaryLabel={C.hub.continue}
              onPrimary={() => router.push("/career/event")}
            />
          );
        }
        return <NowSunday key={ahead.def.id} save={save} C={C} ahead={ahead} />;
    },
    // rc.36 (SUN-03): an event the user is out of — never holds, shown above the clock.
    follow: () => <NowFollow save={save} C={C} out={sundayWithoutYouOf(save)} follow={followCardOf(save)} />,
    seasonReview: () => <NowSeason save={save} C={C} onGo={() => router.push("/career/season")} />,
    // rc9 HQ: the title says what is due; the button under it says the rest (the old blurb restated both).
    notice: () => <h2 className={DECISION_TITLE}>{C.hub.noticeTitle}</h2>,
    contractReview: () => (
          <div>
            <h2 className={DECISION_TITLE}>{C.squad.reviewTitle}</h2>
            <Button variant="primary" size="lg" className="mt-5 max-sm:w-full" onClick={() => router.push("/career/season")}>
              {C.hub.continue}
            </Button>
          </div>
    ),
    squadShort: () => {
        const def = squadHoldFor(save);
        if (!def) return null;
        return (
          <NowSquadShort
            save={save}
            C={C}
            def={def}
            onPass={passUnofficial}
            onSkip={canSkipShortSquadEvent(save) ? skipShortSquadEvent : undefined}
          />
        );
    },
    insert: () =>
      save.pendingInsert ? (
        <NowInsert C={C} id={save.pendingInsert.id} onChoose={resolveInsert} seasonIndex={save.clock.seasonIndex} />
      ) : null,
    invite: () =>
      save.unofficialOffer ? (
        <NowInvite save={save} C={C} D={D} def={save.unofficialOffer} onAccept={acceptUnofficial} onPass={passUnofficial} />
      ) : null,
    training: () => {
        // DEV-03 (front E): the coach's plan for the period — approve, adjust on Training, or keep the base.
        const decision = trainingDecisionOf(save);
        return decision ? (
          <TrainingProposalCard
            save={save}
            decision={decision}
            C={C}
            onApprove={approveTrainingProposal}
            onAdjust={() => router.push("/career/training")}
            onKeepBase={keepBaseTraining}
          />
        ) : null;
    },
    bid: (d) => {
        const offer = save.pendingOffers.find((o) => o.id === d.id);
        if (!offer) {
          // R135 (ECO-06): no bid by this id, so it is a trade the org agreed to or countered.
          const trade = tradeProposalsOf(save).find((p) => p.id === d.id);
          if (!trade) return null;
          return (
            <>
              <NowTrade
                save={save}
                C={C}
                proposal={trade}
                onAccept={() => setConfirmTrade(trade)}
                onDecline={() => {
                  declineBid(trade.id);
                  setFocusId(null);
                }}
              />
              <LaterRow C={C} d={d} onLater={() => later(d)} />
            </>
          );
        }
        return (
          <>
            <NowBid
              save={save}
              C={C}
              offer={offer}
              onAccept={() => setConfirmBid(offer)}
              onDecline={() => {
                declineBid(offer.id);
                setFocusId(null);
              }}
            />
            <LaterRow C={C} d={d} onLater={() => later(d)} />
          </>
        );
    },
    // rc9 HQ (#241): the season plan is HQ's own one-choice table; the mandate and a dismissal keep the board's pieces.
    board: () =>
      !pendingMandateOf(save) && pendingPackageOf(save) ? <SeasonPlanChoice save={save} C={C} /> : <BoardDecision save={save} C={C} />,
    sponsor: (d) => {
        if (!d.parked) return null; // The shell owns the priority popup globally.
        const offers = save.sponsorOffers ?? [];
        if (offers.length === 0) return null;
        // The active sponsor decision opens directly; deferral keeps its persisted deadline.
        return (
          <SponsorDecisionPrompt
            key={d.id}
            save={save}
            C={C}
            canWait={d.canWait}
            onSign={(id) => chooseSponsor(id)}
            onLater={() => later(d)}
          />
        );
    },
    // rc9 STORIES (R254): the post after a big moment; it never holds, so it sits above the clock (inline).
    post: () => <PostDecision save={save} C={C} />,
  };
  const body = (d: PendingDecision): React.ReactNode => VIEWS[d.kind](d);

  const topBody = top && top.kind !== "sponsor" ? body(top) : null;
  const index = top ? queue.indexOf(top) : -1;

  // Warnings that are not decisions: one line each, under the block (not once the career ended).
  const ended = save.phase === "ended";
  const statement = weeklyStatementOf(save);
  const runway = ended ? null : runwayWeeksOf(save, statement.net);
  const cashTight = runway !== null && runway <= CAREER_PAYROLL.runwayWarnWeeks;
  const backerOwed = ended ? null : save.finances.loan;
  const expiring = ended ? 0 : save.squad.filter((p) => contractWarnsFor(save, p)).length;

  const footer =
    others.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker mr-1">{C.hub.alsoDue}</span>
        {/* rc9 HQ: quiet outlines (a tinted blue chip read as a second action); the name in ink, the deadline faint. */}
        {others.map((d) => {
          const due = deadlineTextOf(C, save, d);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setFocusId(d.id)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 text-left text-xs transition-colors hover:border-line-strong"
            >
              <span className={cx("display font-semibold", d.parked ? "text-sub" : "text-ink")}>{decisionLabelOf(C, save, d)}</span>
              {due ? <span className="text-faint">{due}</span> : null}
              {d.parked ? <span className="text-faint">· {C.hub.parked}</span> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="space-y-2">
      {top?.kind === "sponsor" ? body(top) : null}
      <DayCard
        save={save}
        C={C}
        decision={
          topBody
            ? {
                body: topBody,
                count: queue.length > 1 ? C.hub.decisionCount(index + 1, queue.length) : undefined,
                // rc.34 review (Gate 3b): a fresh invite holds nothing — it sits above the clock's controls.
                // Nonblocking sponsor prompts, invites and followed events keep the clock controls.
                inline: top?.kind === "follow" || top?.kind === "post" /* rc9 STORIES */ || (top?.kind === "sunday" && sundayAheadOf(save)?.playing === false && revealHeld === null) || ((top?.kind === "invite" || top?.kind === "sponsor") && !top.holds),
              }
            : null
        }
        footer={footer}
      />

      {/* rc9 HQ (#243): the warnings that are not decisions are rows of one board, each a link to its tab:
          a dot for the state (orange to watch, red for money running out), the fact in ink, the tab's name on the right. */}
      {expiring > 0 || cashTight || backerOwed ? (
        <ul className="panel overflow-hidden !p-0">
          {expiring > 0 ? (
            <WarnRow href="/career/squad" tone="orange" tab={C.nav.squad}>{C.hub.contractsExpiring(expiring)}</WarnRow>
          ) : null}
          {cashTight ? (
            <WarnRow href="/career/finances" tone="bad" tab={C.nav.finances}>{C.hub.cashWarningCard(runway ?? 0)}</WarnRow>
          ) : null}
          {backerOwed ? (
            <WarnRow href="/career/finances" tone="orange" tab={C.nav.finances}>
              {/* rc.32 (M4): the debt and what the next breach means. */}
              <NowBacker save={save} C={C} owed={formatMoney(backerOwed.remaining)} />
            </WarnRow>
          ) : null}
        </ul>
      ) : null}

      {/* Accept-bid confirm: cost + balance-after BEFORE commit (principle 4). */}
      <Modal
        open={Boolean(confirmBid)}
        title={C.market.incomingBid}
        onClose={() => setConfirmBid(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmBid(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirmBid) acceptBid(confirmBid.id);
                setConfirmBid(null);
                setFocusId(null);
              }}
            >
              {C.common.confirm}
            </Button>
          </>
        }
      >
        {confirmBid ? (
          <div className="space-y-2">
            <p className="text-ink">
              {C.market.bidFrom(confirmBid.otherRef ? nameOfRef(save, confirmBid.otherRef) : "?")}: {confirmBid.playerName}
            </p>
            {/* ECO-02 (R46) / ECO-03 (R47): the Market's own sale block — the Backer's share and the weekly bill. */}
            <SaleConsequences save={save} offer={confirmBid} />
          </div>
        ) : null}
      </Modal>

      {/* R135 (ECO-06): accept-trade confirm, the Market's own wording. */}
      {(() => {
        const p = confirmTrade;
        const res = p ? tradeAcceptPlanFor(save, p.id) : null;
        const tplan = res && "plan" in res ? res.plan : null;
        const terr = res && "error" in res ? res.error : null;
        const tcash = p ? tradeCashOf(p) : 0;
        return (
          <Modal
            open={Boolean(p)}
            title={C.market.trade.confirmTitle}
            onClose={() => setConfirmTrade(null)}
            actions={
              <>
                <Button variant="ghost" onClick={() => setConfirmTrade(null)}>
                  {C.common.cancel}
                </Button>
                {tplan && p ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      acceptBid(p.id);
                      setConfirmTrade(null);
                      setFocusId(null);
                    }}
                  >
                    {C.common.confirm}
                  </Button>
                ) : null}
              </>
            }
          >
            {p ? (
              <div className="space-y-2 text-sm">
                <p className="text-ink">{C.market.trade.row(p.giveName, p.takeName, nameOfRef(save, p.orgRef))}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3"><span className="text-sub">{C.market.trade.leaves}</span><span className="display font-bold text-ink">{p.giveName}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-sub">{C.market.trade.arrives}</span><span className="display font-bold text-ink">{p.takeName}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-sub">{C.market.trade.cash}</span><span className="display font-bold text-ink">{tcash > 0 ? formatMoney(tcash) : C.market.trade.noCash}</span></div>
                  {tplan ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sub">{C.squad.wage}</span>
                      <span className="text-right font-bold text-ink">
                        {C.market.trade.wageLine(wageLabel(C, tplan.signing.talk.offered.wagePerSplit), prizeShareLabelOf(C, { prizeSharePct: tplan.signing.talk.offered.sharePct }))}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3"><span className="text-sub">{C.market.trade.length}</span><span className="font-bold text-ink">{C.market.trade.lengthLine(p.lengthSeasons)}</span></div>
                </div>
                {terr ? (
                  <p className="rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-xs font-semibold text-bad">
                    {(C.market.errors as Record<string, string>)[terr] ?? C.market.errors.unknown}
                  </p>
                ) : null}
                <p className="text-xs text-faint">{C.market.trade.irreversible}</p>
              </div>
            ) : null}
          </Modal>
        );
      })()}
    </div>
  );
}
