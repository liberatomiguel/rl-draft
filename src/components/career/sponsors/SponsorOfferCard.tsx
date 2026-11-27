"use client";

/**
 * Road to Worlds: the sponsor deals (rc.34 ECO-04; rc.35 front S; rc.36 front
 * S2; rc9 ORG-UI #273 rebuilt both views).
 *
 *  - `SponsorDecision`: a decision's offers as ONE comparison a person reads
 *    across: a column per offer (the brand at its head), a row per term
 *    (what it pays a week, the signing money, the most it pays, the goal, the
 *    bonus, the fine, the length) and each offer's Sign button at the foot.
 *    From `sm` the terms' names sit in a column on the left; on a phone each
 *    term's name is a line across the board above its values, so the offers
 *    keep their columns at 320 px and nothing is clipped. The deal the deadline
 *    would sign for the player ("signSafest") is marked by an orange hairline
 *    around its column; under "hold" no offer is marked (the engine names none).
 *    rc.35/36 drew one card per sponsor: three cramped columns at 1280, values
 *    clipped at the card edge.
 *  - `SponsorOfferCard`: one offer on its own (the same table, one column).
 *  - `SponsorDealPanel`: the deal in force as one block: the brand, what it
 *    pays (figures), what it asks (the goal and its progress), how it is going
 *    (the run, the record, fines), when it ends.
 *
 * Components only render: every figure comes from `dealView.ts`.
 */

import { goalDeadlineOf, goalSplitLabelOf, isContractGoal, safestSponsorOfferOf, slotsOfDeal, settleDayOf, slotSeason, slotSplit } from "@/engine/career/sponsorDeals";
import { CAREER_SPONSOR } from "@/config/balance";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
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
import { CalendarIcon, FineIcon, GlobeIcon, TrophyIcon } from "@/components/ui/icons";
import { dealViewOf, finesOwedOf, offerViewOf, type OfferView } from "./dealView";

const PROFILE_TONE: Record<string, "good" | "blue" | "orange"> = {
  steady: "good",
  balanced: "blue",
  bold: "orange",
};

/** The profile's accent: text, bar and border. */
export const SPONSOR_ACCENT: Record<string, { text: string; bar: string; border: string }> = {
  steady: { text: "text-good", bar: "bg-good", border: "border-good/40" },
  balanced: { text: "text-blue-bright", bar: "bg-blue", border: "border-blue/40" },
  bold: { text: "text-orange-bright", bar: "bg-orange", border: "border-orange/50" },
};
const ACCENT = SPONSOR_ACCENT;

const money = (n: number) => formatMoney(n, { compact: true });

/**
 * The goal's difficulty: three horizontal bars side by side, lit to its
 * level (1 Likely, 2 Even, 3 Stretch).
 */
export function DifficultyMeter({ level, label }: { level: 1 | 2 | 3; label: string }) {
  const tone = level === 3 ? "bg-orange" : level === 2 ? "bg-blue" : "bg-good";
  return (
    <span className="inline-flex w-12 shrink-0 items-center gap-0.5" role="img" aria-label={label} title={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= level ? tone : "bg-white/10")} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

/** One term across the offers: its name (a column from sm, a line across on a phone) and a cell per offer. */
function TermRow({
  label,
  views,
  marked,
  cell,
}: {
  label: string;
  views: OfferView[];
  marked: string | null;
  cell: (v: OfferView) => React.ReactNode;
}) {
  return (
    <>
      <div className="col-span-full border-t border-line pt-3 sm:col-span-1 sm:py-3">
        <span className="kicker">{label}</span>
      </div>
      {views.map((v) => (
        <div
          key={v.sponsorId}
          className={cx(
            "min-w-0 break-words pb-3 pt-1.5 sm:border-t sm:border-line sm:py-3",
            v.sponsorId === marked && "sm:border-x sm:border-x-orange sm:px-2.5",
          )}
        >
          {cell(v)}
        </div>
      ))}
    </>
  );
}

/**
 * The offers as one table. `notes` adds a line under an offer's head (the
 * founding partner's handover); `onSign` puts a Sign button at each column's foot.
 */
function OfferTable({
  views,
  onSign,
  disabled,
  marked,
  notes,
}: {
  views: OfferView[];
  onSign?: (sponsorId: string) => void;
  disabled?: boolean;
  marked: string | null;
  notes?: (v: OfferView) => React.ReactNode;
}) {
  const C = useActiveCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const markedCol = (v: OfferView) => v.sponsorId === marked;
  return (
    <div
      className="grid gap-x-3 [grid-template-columns:repeat(var(--n),minmax(0,1fr))] sm:gap-x-4 sm:[grid-template-columns:8.5rem_repeat(var(--n),minmax(0,1fr))]"
      style={{ "--n": views.length } as React.CSSProperties}
    >
      {/* The heads: the brand, its profile, the global mark. */}
      <div className="hidden sm:block" aria-hidden />
      {views.map((v) => {
        const brand = sponsorBrandById.get(v.sponsorId);
        return (
          <div
            key={v.sponsorId}
            className={cx(
              "min-w-0 break-words pb-3",
              markedCol(v) && "rounded-t-[7px] border border-orange px-2 pt-2 sm:border-b-0 sm:px-2.5",
            )}
          >
            <p className="display text-[15px] font-bold leading-tight text-ink">{brand?.name ?? v.sponsorId}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={PROFILE_TONE[v.profile] ?? "blue"}>{T.profile[v.profile] ?? v.profile}</Badge>
              {v.global ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-sub">
                  <GlobeIcon className="h-3 w-3" aria-hidden />
                  {T.globalSponsor}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-faint">{T.profileTag[v.profile]}</p>
            {markedCol(v) ? <p className="mt-1 text-xs text-orange-bright">{T.signedForYou}</p> : null}
            {notes?.(v)}
          </div>
        );
      })}

      <TermRow label={T.rowWeekly} views={views} marked={marked} cell={(v) => (
        <p className="display text-xl font-bold leading-none tabular-nums text-ink">{money(v.weekly)}</p>
      )} />
      <TermRow label={T.rowUpfront} views={views} marked={marked} cell={(v) =>
        v.fixed > 0 ? (
          <>
            <p className="display text-[15px] font-bold tabular-nums text-ink">{money(v.fixed)}</p>
            <p className="text-xs text-faint">{v.fixedKind === "milestone" ? T.upfrontMilestone : T.upfrontSigning}</p>
          </>
        ) : (
          <p className="text-sm text-faint">-</p>
        )
      } />
      <TermRow label={T.rowMost} views={views} marked={marked} cell={(v) => (
        <>
          <p className="display text-[15px] font-bold tabular-nums text-ink">{money(v.upTo)}</p>
          <p className="text-xs text-faint">{T.upToWeekly(money(v.upToPerWeek))}</p>
        </>
      )} />
      <TermRow label={T.rowGoal} views={views} marked={marked} cell={(v) =>
        v.goal ? (
          <>
            <span className="flex flex-wrap items-center gap-1.5">
              <DifficultyMeter level={v.difficulty} label={T.difficultyMeter(T.word[v.goal.word] ?? v.goal.word)} />
              <span className="text-xs text-sub">{T.word[v.goal.word] ?? v.goal.word}</span>
            </span>
            <p className="mt-1 text-[13px] leading-snug text-ink">{T.goal(v.goal.kind, v.goal.count, v.goal.place ?? 0, goalSplitLabelOf(v.goal))}</p>
            {v.goalBy ? <p className="text-xs text-faint">{T.goalBy(formatDateShort(D, v.goalBy))}</p> : null}
          </>
        ) : (
          <p className="text-sm text-faint">-</p>
        )
      } />
      <TermRow label={T.rowBonus} views={views} marked={marked} cell={(v) => (
        <p className="display text-[15px] font-bold tabular-nums text-good">+{money(v.bonus)}</p>
      )} />
      <TermRow label={T.rowFine} views={views} marked={marked} cell={(v) =>
        v.fineMax > 0 ? (
          <p className="display text-[15px] font-bold tabular-nums text-bad">−{money(v.fineMax)}</p>
        ) : (
          <p className="text-sm text-sub">{T.noFine}</p>
        )
      } />
      <TermRow label={T.rowLength} views={views} marked={marked} cell={(v) => (
        <>
          <p className="text-sm text-ink">{T.lengthShort(v.lengthSplits)}</p>
          <p className="text-xs text-faint">{T.endsOn(formatDateShort(D, v.endsOn))}</p>
        </>
      )} />
      {views.some((v) => v.freeBootcamps > 0) ? (
        <TermRow label={C.finances.sponsorPerks} views={views} marked={marked} cell={(v) =>
          v.freeBootcamps > 0 ? <p className="text-xs leading-snug text-good">{C.launch.automaticCamp}</p> : <p className="text-sm text-faint">-</p>
        } />
      ) : null}

      {onSign ? (
        <>
          <div className="hidden sm:block" aria-hidden />
          {views.map((v) => {
            const brand = sponsorBrandById.get(v.sponsorId);
            return (
              <div
                key={v.sponsorId}
                className={cx("min-w-0 border-t border-line pt-3", markedCol(v) && "rounded-b-[7px] border-x border-b border-orange px-2 pb-2 sm:px-2.5")}
              >
                <Button
                  variant="secondary"
                  size="md"
                  full
                  className="min-h-11"
                  disabled={disabled}
                  aria-label={`${T.sign}: ${brand?.name ?? v.sponsorId}`}
                  onClick={() => onSign(v.sponsorId)}
                >
                  {T.sign}
                </Button>
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

/** The founding partner's net weekly change for one offer (an rc.32 career still running one). */
function HandoverNet({ handover, offer }: { handover: FoundingHandoverView; offer: SponsorState }) {
  const C = useActiveCareerCopy();
  const net = handoverNetWeeklyOf(handover, offer);
  return (
    <p className={cx("mt-1 text-xs", net < 0 ? "text-orange-bright" : "text-sub")}>
      {C.finances.deal.handoverNet(
        formatMoneyDelta(net, { compact: true }),
        formatDateShort(C.dates, dateOfDay(handover.startsOn.seasonIndex, handover.startsOn.day)),
      )}
    </p>
  );
}

/** One offer on its own, with its Sign button. */
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
  handover?: FoundingHandoverView | null;
}) {
  const view = offerViewOf(offer, today);
  if (!view) return null;
  return (
    <OfferTable
      views={[view]}
      onSign={onSign}
      disabled={disabled}
      marked={null}
      notes={handover ? () => <HandoverNet handover={handover} offer={offer} /> : undefined}
    />
  );
}

/**
 * A sponsor decision: its deadline, the founding partner's handover (an rc.32
 * career still running one) and the comparison. Null when nothing is pending.
 * `bare` drops the title (a host that titles it).
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
  const C = useActiveCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  const today = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  const offers = decision.offers.filter((o) => o.terms);
  const views = offers.map((o) => offerViewOf(o, today)).filter((v): v is OfferView => v !== null);
  const levelShare = offers[0]?.terms?.levelShare;
  const handover = foundingHandoverOf(save);
  const boldMissing = views.length > 0 && !views.some((v) => v.profile === "bold");
  const signsSafest = CAREER_SPONSOR.deadlineRule === "signSafest";
  const marked = signsSafest ? (safestSponsorOfferOf(offers)?.sponsorId ?? null) : null;
  const by = formatDateShort(D, dateOfDay(decision.deadlineOn.seasonIndex, decision.deadlineOn.day));
  return (
    <div>
      {bare ? null : <h2 className="card-title">{C.finances.offerTitle}</h2>}
      <p className={cx("flex items-center gap-1.5 text-sm text-ink", !bare && "mt-1")}>
        <CalendarIcon className="h-4 w-4 shrink-0 text-sub" aria-hidden />
        {signsSafest ? T.decideBySafest(by) : T.decideBy(by)}
      </p>
      <p className="mt-1 text-xs text-sub">{T.compareHint}</p>
      {levelShare !== undefined && levelShare < 1 ? (
        <p className="mt-1 text-xs text-faint">{T.levelScaled(offers[0].tier, Math.round(levelShare * 100))}</p>
      ) : null}
      {handover ? (
        <p className="mt-1 text-xs text-faint">
          {handover.onSigning
            ? T.handover(handover.first, handover.second)
            : T.handoverLater(seasonLabelFor(handover.throughSeason), handover.first, handover.second)}
        </p>
      ) : null}
      <div className="mt-4">
        <OfferTable
          views={views}
          onSign={onSign}
          marked={marked}
          notes={
            handover
              ? (v) => {
                  const o = offers.find((x) => x.sponsorId === v.sponsorId);
                  return o ? <HandoverNet handover={handover} offer={o} /> : null;
                }
              : undefined
          }
        />
      </div>
      {boldMissing ? <p className="mt-3 text-xs text-faint">{T.boldLocked}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The deal in force
// ---------------------------------------------------------------------------

/** The contract's goals across its splits (a deal with a goal per split). */
function ContractGoals({ view }: { view: OfferView }) {
  const C = useActiveCareerCopy();
  const T = C.finances.deal;
  return (
    <ol className="mt-2 border-t border-line">
      {slotsOfDeal(view).map((slot) => {
        const goal = view.goals.find((g) => g.slot === slot);
        const by = goal ? goalDeadlineOf(goal) : settleDayOf(slot);
        const state = goal ? (goal.hitOn ? T.goalReached : goal.missed !== undefined ? T.goalMissed : T.goalOpen) : null;
        return (
          <li key={slot} className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="min-w-0">
              <span className="block text-sm text-ink">{goal ? T.goal(goal.kind, goal.count, goal.place ?? 0, slotSplit(slot)) : C.launch.futureGoal}</span>
              <span className="block text-xs text-faint">
                {seasonLabelFor(slotSeason(slot))} · {C.calendar.split(slotSplit(slot))} · {T.goalBy(formatDateShort(C.dates, dateOfDay(by.seasonIndex, by.day)))}
              </span>
            </span>
            {state && goal ? <Badge tone={goal.hitOn ? "good" : goal.missed !== undefined ? "bad" : "neutral"}>{state}</Badge> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** A figure: the value large, its label quiet under it. */
function DealFigure({ value, label, tone = "text-ink" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className={cx("display text-xl font-bold leading-none tabular-nums sm:text-2xl", tone)}>{value}</p>
      <p className="mt-1.5 text-xs text-faint">{label}</p>
    </div>
  );
}

/** The deal in force as one block: brand, what it pays, what it asks, how it is going, when it ends. */
export function SponsorDealPanel({ save, perks }: { save: CareerSave; perks?: React.ReactNode }) {
  const C = useActiveCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const lang = useSettings((s) => s.lang);
  const view = dealViewOf(save);
  if (!view) return null;
  const brand = sponsorBrandById.get(view.sponsorId);
  const a = ACCENT[view.profile] ?? ACCENT.balanced;
  const fines = finesOwedOf(save.finances.sponsorFines);
  const patienceMax = CAREER_SPONSOR.patienceMisses;
  const cur = view.current;
  const whole = view.goals.some((g) => isContractGoal(g));
  const status = cur
    ? cur.goal.hitOn
      ? { label: T.goalReached, tone: "good" as const }
      : cur.goal.missed !== undefined
        ? { label: T.goalMissed, tone: "bad" as const }
        : { label: T.goalOpen, tone: "neutral" as const }
    : null;
  const paid = Math.max(0, view.mondaysTotal - view.mondaysLeft);
  const runPct = view.mondaysTotal > 0 ? Math.round((paid / view.mondaysTotal) * 100) : 0;
  const seasonCap = save.sponsor ? Math.round(CAREER_SPONSOR.fines.seasonCapWeeks * view.weekly) : 0;
  return (
    <div>
      {/* The brand: its name, its profile; the brand's own line under it. */}
      <p className="kicker">{T.activeTitle}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="display min-w-0 text-lg font-bold leading-tight text-ink">{brand?.name ?? view.sponsorId}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {view.global ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-sub">
              <GlobeIcon className="h-3.5 w-3.5" aria-hidden />
              {T.globalSponsor}
            </span>
          ) : null}
          <Badge tone={PROFILE_TONE[view.profile] ?? "blue"}>{T.profile[view.profile] ?? view.profile}</Badge>
        </span>
      </div>
      {brand ? <p className="mt-0.5 text-xs text-faint">{lang === "pt" ? brand.flavorPt : brand.flavorEn}</p> : null}

      {/* What it pays and when: three figures. */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <DealFigure value={money(view.weekly)} label={T.dealPays} tone="text-good" />
        <DealFigure value={view.nextPayOn ? formatDateShort(D, view.nextPayOn) : T.noNextPay} label={T.nextPay} />
        <DealFigure value={formatDateShort(D, view.endsOn)} label={T.dealEnds} />
      </div>

      {/* What it asks: the goal, its progress, what it pays and costs, by when. */}
      {cur ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="kicker">{whole ? C.launch.sponsorSchedule : T.thisGoal}</p>
            <span className="flex items-center gap-2">
              <DifficultyMeter
                level={cur.goal.word === "stretch" ? 3 : cur.goal.word === "even" ? 2 : 1}
                label={T.difficultyMeter(T.word[cur.goal.word] ?? cur.goal.word)}
              />
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            </span>
          </div>
          <p className="display mt-1.5 text-[15px] font-bold leading-snug text-ink">
            {T.goal(cur.goal.kind, cur.goal.count, cur.goal.place ?? 0, goalSplitLabelOf(cur.goal))}
          </p>
          <div className="mt-2 flex items-center gap-1" role="img" aria-label={T.progress(cur.progress.done, cur.progress.target)}>
            {Array.from({ length: cur.progress.target }).map((_, i) => (
              <span
                key={i}
                className={cx("h-1.5 flex-1 rounded-sm", i < cur.progress.done ? (cur.goal.missed !== undefined ? "bg-bad/70" : "bg-good") : "bg-white/10")}
              />
            ))}
            <span className="ml-1.5 shrink-0 text-xs tabular-nums text-ink">
              {cur.progress.done}/{cur.progress.target}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-good">
              <TrophyIcon className="h-3.5 w-3.5" aria-hidden />+{money(save.sponsor!.bonus)}
            </span>
            {view.risk.kind === "fine" ? (
              <span className="inline-flex items-center gap-1 text-bad">
                <FineIcon className="h-3.5 w-3.5" aria-hidden />−{money(view.risk.max)}
              </span>
            ) : null}
            <span className="text-faint">{T.goalBy(formatDateShort(D, cur.by))}</span>
          </p>
          {!whole && view.goals.length > 1 ? <ContractGoals view={view} /> : null}
        </div>
      ) : null}

      {/* How it is going: the run, the record, fines and patience. */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="kicker">{T.dealGoing}</p>
          <span className="text-xs tabular-nums text-sub">{T.dealRun(paid, view.mondaysTotal)}</span>
        </div>
        <span className="mt-2 block h-1.5 w-full rounded-sm bg-white/10" aria-hidden>
          <span className={cx("block h-full rounded-sm", a.bar)} style={{ width: `${runPct}%` }} />
        </span>
        <ul className="mt-2 space-y-1 text-xs text-sub">
          {view.hits + view.misses > 0 ? <li>{T.record(view.hits, view.misses)}</li> : null}
          {view.fixedKind === "milestone" && view.fixed > 0 ? (
            <li className={view.fixedPaid ? "text-good" : undefined}>{view.fixedPaid ? T.milestonePaid(money(view.fixed)) : T.milestonePending(money(view.fixed))}</li>
          ) : null}
          {view.nextGoalOn ? <li>{T.nextGoal(formatDateShort(D, view.nextGoalOn))}</li> : null}
          {fines.total > 0 ? <li className="text-bad">{T.finesOwed(money(fines.total), fines.mondays)}</li> : null}
          {view.risk.kind === "fine" ? <li className="text-faint">{T.seasonFineCap(money(seasonCap))} · {T.fineFloorNote}</li> : null}
          {view.patienceMisses !== null ? <li>{C.finances.patience(view.patienceMisses, patienceMax)}</li> : null}
        </ul>
      </div>

      {view.freeBootcamps > 0 ? <p className="mt-4 text-xs leading-relaxed text-good">{C.launch.automaticCamp}</p> : null}
      {perks ? (
        <details className="mt-3 text-xs text-sub">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">{C.finances.sponsorPerks}</summary>
          {perks}
        </details>
      ) : null}
    </div>
  );
}
