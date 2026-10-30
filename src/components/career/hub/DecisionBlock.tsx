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

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CAREER_PAYROLL } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave, TransferOffer } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { canSkipShortSquadEvent, runwayWeeksOf, squadHoldFor, weeklyStatementOf } from "@/store/careerFlow";
import { pendingDecisionsOf, type PendingDecision } from "@/store/careerDecisions";
import { followCardOf, sundayAheadOf, sundayWithoutYouOf } from "@/store/careerSunday";
import { trainingDecisionOf } from "@/store/careerTraining";
import { TrainingProposalCard } from "@/components/career/training/TrainingPackageParts";
import { SponsorDecision } from "@/components/career/sponsors/SponsorOfferCard";
import { contractWarnsFor } from "@/engine/career/careerNew";
import {
  dateOfDay,
  eventDayPhaseOf,
  nameOfRef,
  useRevealHeldEventId,
} from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { ContinueToSundayLabel } from "@/components/career/event/WeekendPlan";
import { weekendRoleOf } from "@/components/career/event/weekendView";
import { DayCard } from "@/components/career/hub/DayCard";
import { NowFollow, NowSunday } from "@/components/career/hub/SundayCard";
import {
  NowBacker,
  NowBid,
  NowEvent,
  NowInsert,
  NowInvite,
  NowSeason,
  NowSquadShort,
} from "@/components/career/hub/NowCards";
import { SaleConsequences } from "@/components/career/SaleConsequences";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** The decision's short name for the "Also" line. */
function decisionLabelOf(C: CareerCopy, save: CareerSave, d: PendingDecision): string {
  if (d.kind === "bid") {
    const offer = save.pendingOffers.find((o) => o.id === d.id);
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

export function DecisionBlock({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const router = useRouter();
  const acceptBid = useCareerStore((s) => s.acceptBid);
  const declineBid = useCareerStore((s) => s.declineBid);
  const acceptUnofficial = useCareerStore((s) => s.acceptUnofficial);
  const passUnofficial = useCareerStore((s) => s.passUnofficial);
  const resolveInsert = useCareerStore((s) => s.resolveInsert);
  const chooseSponsor = useCareerStore((s) => s.chooseSponsor);
  const declineSponsorOffers = useCareerStore((s) => s.declineSponsorOffers);
  const parkDecision = useCareerStore((s) => s.parkDecision);
  const skipShortSquadEvent = useCareerStore((s) => s.skipShortSquadEvent);
  const approveTrainingProposal = useCareerStore((s) => s.approveTrainingProposal);
  const keepBaseTraining = useCareerStore((s) => s.keepBaseTraining);
  const continueEventToNextDay = useCareerStore((s) => s.continueEventToNextDay);
  const revealHeld = useRevealHeldEventId(save);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmBid, setConfirmBid] = useState<TransferOffer | null>(null);

  const queue = useMemo(() => pendingDecisionsOf(save), [save]);
  const focused = focusId ? (queue.find((d) => d.id === focusId) ?? null) : null;
  const top = focused ?? queue.find((d) => !d.parked) ?? null;
  const others = queue.filter((d) => d !== top);

  const D = C.dates;
  const today = save.clock.day;

  const later = (d: PendingDecision) => {
    parkDecision(d.id);
    setFocusId(null);
  };

  const body = (d: PendingDecision): React.ReactNode => {
    switch (d.kind) {
      case "event": {
        const ev = save.activeEvent?.def ?? save.pendingEventDef;
        if (!ev) return null;
        // R40 / rc.29 (CAR-02): a Saturday the playback has not finished revealing reads as the Swiss stage.
        const rawPhase = eventDayPhaseOf(save);
        const phase = rawPhase === "paused" && revealHeld !== null && revealHeld === save.activeEvent?.def.id ? "swiss" : rawPhase;
        const role = weekendRoleOf(ev, today);
        const stage =
          phase === "paused"
            ? { label: C.event.swissComplete, tone: "good" as const }
            : role === "championshipSunday"
              ? { label: C.event.championshipSunday, tone: "gold" as const, live: true }
              : role === "swissDay"
                ? { label: C.event.swissStage, tone: "orange" as const, live: true }
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
              primaryLabel={phase === "paused" ? <ContinueToSundayLabel /> : C.hub.continue}
              onPrimary={() => {
                // R40: the paused Saturday moves exactly one day, to Championship Sunday.
                if (phase === "paused") continueEventToNextDay();
                router.push("/career/event");
              }}
            />
            {cupLobby ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="ghost" size="md" className="min-h-11" onClick={passUnofficial}>
                  {C.hub.invitePass}
                </Button>
                <span className="text-xs text-faint">{C.calendar.skipHint}</span>
              </div>
            ) : null}
          </>
        );
      }
      case "sunday": {
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
              stage={{ label: C.event.swissStage, tone: "orange", live: true }}
              primaryLabel={C.hub.continue}
              onPrimary={() => router.push("/career/event")}
            />
          );
        }
        return <NowSunday key={ahead.def.id} save={save} C={C} ahead={ahead} />;
      }
      case "follow":
        // rc.36 (SUN-03): an event the user is out of — never holds, shown above the clock.
        return <NowFollow save={save} C={C} out={sundayWithoutYouOf(save)} follow={followCardOf(save)} />;
      case "seasonReview":
        return <NowSeason save={save} C={C} onGo={() => router.push("/career/season")} />;
      case "notice":
        return (
          <div>
            <p className="kicker mb-1 text-[10px] text-orange-bright">{C.hub.decisionKind.notice}</p>
            <h2 className="display text-xl font-bold uppercase tracking-wide text-ink">{C.hub.noticeTitle}</h2>
            <p className="mt-2 max-w-xl text-sm text-sub">{C.hub.noticeBody}</p>
          </div>
        );
      case "contractReview":
        return (
          <div>
            <h2 className="display text-xl font-bold uppercase tracking-wide text-ink">{C.squad.reviewTitle}</h2>
            <Button variant="primary" size="md" className="mt-4 min-h-11" onClick={() => router.push("/career/season")}>
              {C.hub.continue}
            </Button>
          </div>
        );
      case "squadShort": {
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
      }
      case "insert":
        return save.pendingInsert ? (
          <NowInsert C={C} id={save.pendingInsert.id} onChoose={resolveInsert} seasonIndex={save.clock.seasonIndex} />
        ) : null;
      case "invite":
        return save.unofficialOffer ? (
          <NowInvite save={save} C={C} D={D} def={save.unofficialOffer} onAccept={acceptUnofficial} onPass={passUnofficial} />
        ) : null;
      case "training": {
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
      }
      case "bid": {
        const offer = save.pendingOffers.find((o) => o.id === d.id);
        if (!offer) return null;
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
      }
      case "sponsor": {
        const offers = save.sponsorOffers ?? [];
        if (offers.length === 0) return null;
        return (
          <>
            {/* ECO-04 (front F): the three profiles in one comparison, signed from here. */}
            <SponsorDecision save={save} onSign={(id) => chooseSponsor(id)} bare />
            {/* rc.35 (front S): "Decide later" sits beside "Decline", not under it. */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" className="min-h-11" onClick={declineSponsorOffers}>
                {C.hub.sponsorDecline}
              </Button>
              {d.canWait ? (
                <Button variant="ghost" size="md" className="min-h-11 border border-line" onClick={() => later(d)}>
                  {C.hub.sponsorLater}
                </Button>
              ) : (
                <span className="flex min-h-11 items-center text-xs font-semibold text-orange-bright">{C.hub.lastDay}</span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-faint">
              {C.hub.sponsorDeclineHint}
              {d.canWait && d.deadline
                ? ` · ${C.hub.standsUntil(formatDateShort(C.dates, dateOfDay(d.deadline.seasonIndex, d.deadline.day)))}`
                : ""}
            </p>
          </>
        );
      }
    }
  };

  const topBody = top ? body(top) : null;
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
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="kicker mr-1 text-[9px]">{C.hub.alsoDue}</span>
        {others.map((d) => {
          const due = deadlineTextOf(C, save, d);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setFocusId(d.id)}
              className={cx(
                "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-left text-[11px] transition-colors",
                d.parked ? "border-line text-faint hover:text-sub" : "border-blue/40 bg-blue/10 text-blue-bright hover:bg-blue/15",
              )}
            >
              <span className="font-semibold">{decisionLabelOf(C, save, d)}</span>
              {due ? <span className="text-faint">· {due}</span> : null}
              {d.parked ? <span className="text-faint">· {C.hub.parked}</span> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="space-y-2">
      <DayCard
        save={save}
        C={C}
        decision={
          topBody
            ? {
                body: topBody,
                count: queue.length > 1 ? C.hub.decisionCount(index + 1, queue.length) : undefined,
                // rc.34 review (Gate 3b): a fresh invite holds nothing — it sits above the clock's controls.
                // rc.36 (SUN-03): so does an event the user is out of.
                inline: (top?.kind === "invite" || top?.kind === "follow") && !top.holds,
              }
            : null
        }
        footer={footer}
      />

      {expiring > 0 ? (
        <AppLink href="/career/squad" className="flex min-h-11 items-center rounded-lg border border-orange/30 bg-white/[0.02] px-3.5 text-sm text-ink transition-colors hover:border-orange/60">
          {C.hub.contractsExpiring(expiring)} →
        </AppLink>
      ) : null}
      {cashTight ? (
        <AppLink href="/career/finances" className="flex min-h-11 items-center rounded-lg border border-bad/40 bg-white/[0.02] px-3.5 text-sm text-bad transition-colors hover:border-bad/70">
          {C.hub.cashWarningCard(runway ?? 0)} →
        </AppLink>
      ) : null}
      {backerOwed ? (
        <AppLink href="/career/finances" className="block rounded-lg border border-orange/30 bg-white/[0.02] px-3.5 py-2.5 text-sm text-sub transition-colors hover:border-orange/60">
          {/* rc.32 (M4): the debt and what the next breach means. */}
          <NowBacker save={save} C={C} owed={formatMoney(backerOwed.remaining)} />
        </AppLink>
      ) : null}
      {!top && !others.length && !expiring && !cashTight && !backerOwed ? (
        <p className="px-1 text-xs text-faint">{C.hub.nothingNeeded}</p>
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
              {C.market.bidFrom(confirmBid.otherRef ? nameOfRef(save, confirmBid.otherRef) : "?")} — {confirmBid.playerName}
            </p>
            {/* ECO-02 (R46) / ECO-03 (R47): the Market's own sale block — the Backer's share and the weekly bill. */}
            <SaleConsequences save={save} offer={confirmBid} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
