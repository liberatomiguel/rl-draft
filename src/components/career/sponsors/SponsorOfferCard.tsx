"use client";

/**
 * Road to Worlds — the sponsor deals' comparison (rc.34, ECO-04,
 * SPONSOR-CONTRACT S5; Gate 3a 30/10: decisions 1–5 A, 7-A).
 *
 *  - `SponsorOfferCard`: one offer, five rows in the same order on every
 *    card — Stability · Total return · Length · Risk · Goal — and its Sign
 *    button. No "recommended" badge: the three offers of a decision carry
 *    about the same expected value (s1).
 *  - `SponsorDecision`: a decision on the desk — the deadline, the
 *    comparison's one-line rule, the founding partner's handover when one
 *    runs (rc.32 careers), and the three cards. Reads the flow's
 *    `sponsorDecisionOf`; HQ (front G's queue) and Finances render it.
 *  - `SponsorDealPanel`: the running deal on the Finances desk.
 *
 * Mobile first: one card per row up to `md`, every row stacks its label over
 * its value, so a 360 px phone reads it without a horizontal scroll; the
 * Sign button is 44 px tall. Components only render: every figure comes
 * from `dealView.ts` (the engine's numbers).
 */

import { CAREER_SPONSOR } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { sponsorBrandById } from "@/data/career/sponsors";
import { seasonLabelFor } from "@/engine/career/calendar";
import type { CareerSave, SponsorState } from "@/engine/career/types";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import {
  foundingHandoverOf,
  handoverNetWeeklyOf,
  sponsorDecisionOf,
  type FoundingHandoverView,
} from "@/store/careerFlow";
import { useSettings } from "@/store/settingsStore";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { dealViewOf, finesOwedOf, offerViewOf, type DealRisk, type OfferView } from "./dealView";

const PROFILE_TONE: Record<string, "good" | "blue" | "orange"> = {
  steady: "good",
  balanced: "blue",
  bold: "orange",
};

const WORD_TONE: Record<string, "good" | "blue" | "orange"> = {
  likely: "good",
  even: "blue",
  stretch: "orange",
};

const money = (n: number) => formatMoney(n, { compact: true });

/** One labelled row: the label above its value (stacks at any width). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line/60 py-2 first:border-t-0">
      <p className="kicker text-[9px]">{label}</p>
      <div className="mt-0.5 text-xs text-sub">{children}</div>
    </div>
  );
}

/** The Stability bar: ten cells, the sure share of the most a deal pays. */
function StabilityBar({ tenths, label }: { tenths: number; label: string }) {
  return (
    <span className="mt-1 flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={cx("h-1.5 flex-1 rounded-full", i < tenths ? "bg-good" : "bg-white/10")} />
      ))}
    </span>
  );
}

function RiskText({ risk }: { risk: DealRisk }) {
  const C = useCareerCopy();
  const T = C.finances.deal;
  if (risk.kind === "fine") return <span className="text-orange-bright">{T.riskFine(money(risk.max), risk.mondays)}</span>;
  if (risk.kind === "steady") return <span>{T.riskSteady(risk.misses)}</span>;
  return <span>{T.riskNone}</span>;
}

/** The five rows of a deal (an offer, or the running deal on the desk). */
function DealRows({ view }: { view: OfferView }) {
  const C = useCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const goal = view.goal;
  return (
    <div className="mt-2">
      <Row label={T.rowStability}>
        <p className="font-semibold text-good">{T.weeklySure(money(view.weekly))}</p>
        {view.fixed > 0 ? (
          <p>{view.fixedKind === "milestone" ? T.plusMilestone(money(view.fixed)) : T.plusSigning(money(view.fixed))}</p>
        ) : null}
        <StabilityBar tenths={view.stabilityTenths} label={T.stabilityBar(view.stabilityPct)} />
      </Row>
      <Row label={T.rowTotal}>
        <p className="font-semibold text-ink">{T.total(money(view.sure), money(view.upTo))}</p>
      </Row>
      <Row label={T.rowLength}>
        <p>{T.length(view.lengthSplits, formatDateShort(D, view.endsOn))}</p>
      </Row>
      <Row label={T.rowRisk}>
        <RiskText risk={view.risk} />
      </Row>
      <Row label={T.rowGoal}>
        {goal ? (
          <>
            <p className="font-semibold text-ink">{T.goal(goal.kind, goal.count, goal.place ?? 0, (goal.slot % 3) + 1)}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {view.goalBy ? <span>{T.goalBy(formatDateShort(D, view.goalBy))}</span> : null}
              <Badge tone={WORD_TONE[goal.word] ?? "blue"}>{T.word[goal.word] ?? goal.word}</Badge>
            </p>
            {view.laterGoals ? <p className="mt-0.5 text-[11px] text-faint">{T.laterGoals}</p> : null}
          </>
        ) : null}
      </Row>
    </div>
  );
}

/** The brand line: name, profile and tier. */
function BrandHead({ sponsorId, tier, profile }: { sponsorId: string; tier: number; profile: string }) {
  const C = useCareerCopy();
  const lang = useSettings((s) => s.lang);
  const brand = sponsorBrandById.get(sponsorId);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="display min-w-0 truncate text-base font-bold uppercase tracking-wide text-ink">
          {brand?.name ?? sponsorId}
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge tone={PROFILE_TONE[profile] ?? "blue"}>{C.finances.deal.profile[profile] ?? profile}</Badge>
          <Badge tone="neutral">{C.finances.sponsorTier(tier)}</Badge>
        </span>
      </div>
      {brand ? <p className="mt-1 text-xs italic text-faint">{lang === "pt" ? brand.flavorPt : brand.flavorEn}</p> : null}
    </>
  );
}

/**
 * One offer of a decision (decision 3-A: one per profile): the brand, the
 * profile's one-line idea, the five rows and the Sign button. Exported for
 * HQ's decision queue (UX-01).
 */
export function SponsorOfferCard({
  offer,
  today,
  onSign,
  disabled,
  handover,
}: {
  offer: SponsorState;
  today: { seasonIndex: number; day: number };
  onSign: (sponsorId: string) => void;
  disabled?: boolean;
  /** rc.34 review (S6): the founding partner's handover, when one is ahead — the card shows its net weekly change. */
  handover?: FoundingHandoverView | null;
}) {
  const C = useCareerCopy();
  const view = offerViewOf(offer, today);
  if (!view) return null;
  const net = handover ? handoverNetWeeklyOf(handover, offer) : null;
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-white/[0.03] p-3">
      <BrandHead sponsorId={view.sponsorId} tier={view.tier} profile={view.profile} />
      <p className="mt-1.5 text-[11px] text-sub">{C.finances.deal.profileHint[view.profile]}</p>
      <DealRows view={view} />
      {handover && net !== null ? (
        <p className={cx("mb-2 text-[11px] font-semibold", net < 0 ? "text-orange-bright" : "text-sub")}>
          {C.finances.deal.handoverNet(
            formatMoneyDelta(net, { compact: true }),
            formatDateShort(C.dates, dateOfDay(handover.startsOn.seasonIndex, handover.startsOn.day)),
          )}
        </p>
      ) : null}
      <Button
        variant="primary"
        size="md"
        full
        className="mt-auto min-h-11"
        disabled={disabled}
        onClick={() => onSign(view.sponsorId)}
      >
        {C.finances.deal.sign}
      </Button>
    </div>
  );
}

/**
 * A sponsor decision: its deadline, the comparison's rule, the founding
 * partner's handover (an rc.32 career still running one) and the three
 * offers. Null when nothing is pending. `bare` drops the title (a host that
 * titles it itself).
 */
export function SponsorDecision({
  save,
  onSign,
  bare,
}: {
  save: CareerSave;
  onSign: (sponsorId: string) => void;
  bare?: boolean;
}) {
  const C = useCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  const today = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  const levelShare = decision.offers[0]?.terms?.levelShare;
  // rc.34 review (S6): signing starts the handover only past season index 1 — before it, the partner pays its term in full.
  const handover = foundingHandoverOf(save);
  return (
    <div>
      {bare ? null : (
        <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink">{C.finances.offerTitle}</h2>
      )}
      <p className={cx("text-xs font-semibold text-orange-bright", !bare && "mt-1")}>
        {T.decideBy(formatDateShort(D, dateOfDay(decision.deadlineOn.seasonIndex, decision.deadlineOn.day)))}
      </p>
      <p className="mt-1 text-xs text-sub">{T.compareHint}</p>
      {levelShare !== undefined && levelShare < 1 ? (
        <p className="mt-1 text-[11px] text-faint">
          {T.levelScaled(decision.offers[0].tier, Math.round(levelShare * 100))}
        </p>
      ) : null}
      {handover ? (
        <p className="mt-1 text-[11px] text-faint">
          {handover.onSigning
            ? T.handover(handover.first, handover.second)
            : T.handoverLater(seasonLabelFor(handover.throughSeason), handover.first, handover.second)}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {decision.offers.map((o) =>
          o.terms ? (
            <SponsorOfferCard key={o.sponsorId} offer={o} today={today} onSign={onSign} handover={handover} />
          ) : null,
        )}
      </div>
    </div>
  );
}

/** The running rc.34 deal on the Finances desk: its five rows, this split's goal, the record, fines owed, patience. */
export function SponsorDealPanel({ save, perks }: { save: CareerSave; perks?: React.ReactNode }) {
  const C = useCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const view = dealViewOf(save);
  if (!view) return null;
  const fines = finesOwedOf(save.finances.sponsorFines);
  const patienceMax = CAREER_SPONSOR.patienceMisses;
  const cur = view.current;
  const status = cur
    ? cur.goal.hitOn
      ? { label: T.goalReached, tone: "good" as const }
      : cur.goal.missed !== undefined
        ? { label: T.goalMissed, tone: "bad" as const }
        : { label: T.goalOpen, tone: "neutral" as const }
    : null;
  return (
    <div className="rounded-lg border border-line-strong bg-white/[0.02] p-3">
      <p className="kicker mb-1.5 text-[9px]">{T.activeTitle}</p>
      <BrandHead sponsorId={view.sponsorId} tier={view.tier} profile={view.profile} />
      <DealRows view={view} />

      {cur ? (
        <div className="mt-2 border-t border-line pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="kicker text-[9px]">{T.thisGoal}</p>
            {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          </div>
          <p className="mt-1 text-xs font-semibold text-ink">
            {T.goal(cur.goal.kind, cur.goal.count, cur.goal.place ?? 0, (cur.goal.slot % 3) + 1)}
          </p>
          <p className="mt-0.5 text-[11px] text-sub">
            {T.goalBy(formatDateShort(D, cur.by))} · {T.progress(cur.progress.done, cur.progress.target)} ·{" "}
            {T.bonusIfHit(money(save.sponsor!.bonus))}
            {view.risk.kind === "fine" ? ` · ${T.fineIfMissed(money(view.risk.max))}` : ""}
          </p>
          {!cur.goal.hitOn && cur.goal.missed === undefined ? (
            <ProgressBar
              value={cur.progress.target > 0 ? cur.progress.done / cur.progress.target : 0}
              tone="blue"
              className="mt-2"
              label={T.thisGoal}
            />
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-faint">{T.record(view.hits, view.misses)}</p>
      {view.nextGoalOn ? (
        <p className="text-[11px] text-faint">{T.nextGoal(formatDateShort(D, view.nextGoalOn))}</p>
      ) : null}
      {view.fixedKind === "milestone" && view.fixed > 0 ? (
        <p className="text-[11px] text-faint">
          {view.fixedPaid ? T.milestonePaid(money(view.fixed)) : T.milestonePending(money(view.fixed))}
        </p>
      ) : null}
      {fines.total > 0 ? (
        <p className="mt-1.5 text-[11px] font-semibold text-orange-bright">
          {T.finesOwed(money(fines.total), fines.mondays)} {T.fineFloorNote}
        </p>
      ) : null}

      {view.patienceMisses !== null ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: patienceMax }).map((_, i) => (
              <span
                key={i}
                className={cx("h-1.5 w-4 rounded-full", i < patienceMax - view.patienceMisses! ? "bg-good" : "bg-bad/60")}
              />
            ))}
          </span>
          <span className="text-[10px] text-faint">{C.finances.patience(view.patienceMisses, patienceMax)}</span>
        </div>
      ) : null}
      {perks}
    </div>
  );
}
