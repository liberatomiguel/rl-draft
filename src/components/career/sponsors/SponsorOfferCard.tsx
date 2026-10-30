"use client";

/**
 * Road to Worlds — the sponsor deals' comparison (rc.34, ECO-04,
 * SPONSOR-CONTRACT S5; rc.35 front S: made visual, Miguel's rc.34 playtest).
 *
 *  - `SponsorDecision`: a decision on the desk — the deadline, a one-line
 *    rule and ONE comparison: a column per offer (brand, profile, a bar of
 *    the most it pays), then one band per row, each led by its icon —
 *    weekly pay, the up-front money (signing or first-goal milestone), the
 *    bonus per goal, the goal with its difficulty meter, the fine, the
 *    length — and a Sign button per column. HQ and Finances render it.
 *  - `SponsorOfferCard`: one offer on its own (the same bands, one column).
 *  - `SponsorDealPanel`: the running deal on the Finances desk — three stat
 *    tiles (weekly pay, next payment, fines owed), the goal with its
 *    progress, the deal's run and its record.
 *
 * Mobile first: at 360 px each band is a full-width caption over N narrow
 * cells (compact money), so nothing scrolls sideways; buttons are 44 px.
 * Components only render: every figure comes from `dealView.ts`.
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
import {
  CalendarIcon,
  CoinsIcon,
  FineIcon,
  FlagIcon,
  GlobeIcon,
  ShieldIcon,
  SignIcon,
  TargetIcon,
  TrophyIcon,
} from "@/components/ui/icons";
import { dealViewOf, finesOwedOf, offerViewOf, type OfferView } from "./dealView";

const PROFILE_TONE: Record<string, "good" | "blue" | "orange"> = {
  steady: "good",
  balanced: "blue",
  bold: "orange",
};

/** The profile's accent: text, bar and border. */
const ACCENT: Record<string, { text: string; bar: string; border: string }> = {
  steady: { text: "text-good", bar: "bg-good", border: "border-good/40" },
  balanced: { text: "text-blue-bright", bar: "bg-blue", border: "border-blue/40" },
  bold: { text: "text-orange-bright", bar: "bg-orange", border: "border-orange/50" },
};

const money = (n: number) => formatMoney(n, { compact: true });

/** The goal's difficulty: three rising bars, lit to its level (1 Likely, 2 Even, 3 Stretch). */
function DifficultyMeter({ level, label }: { level: 1 | 2 | 3; label: string }) {
  const tone = level === 3 ? "bg-orange" : level === 2 ? "bg-blue" : "bg-good";
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={label} title={label}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cx("w-1.5 rounded-sm", i <= level ? tone : "bg-white/10")}
          style={{ height: `${4 + i * 3}px` }}
        />
      ))}
    </span>
  );
}

/** A band's caption: its icon and label, full width. */
function BandHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="col-span-full flex items-center gap-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
      <span className="h-3.5 w-3.5 shrink-0 text-sub">{icon}</span>
      {label}
    </p>
  );
}

/** One cell of a band. */
function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("min-w-0 rounded-md bg-white/[0.03] px-1.5 py-1.5 text-center", className)}>{children}</div>;
}

/** The brand column head: name, profile badge, tag and a bar of the most it pays. */
function ColumnHead({ view, topCeiling }: { view: OfferView; topCeiling: number }) {
  const C = useCareerCopy();
  const T = C.finances.deal;
  const brand = sponsorBrandById.get(view.sponsorId);
  const a = ACCENT[view.profile] ?? ACCENT.balanced;
  const pct = topCeiling > 0 ? Math.max(8, Math.round((view.upTo / topCeiling) * 100)) : 100;
  return (
    <div className={cx("flex min-w-0 flex-col rounded-md border bg-white/[0.02] p-1.5", a.border)}>
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-ink" title={brand?.name ?? view.sponsorId}>
        {brand?.name ?? view.sponsorId}
      </p>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <Badge tone={PROFILE_TONE[view.profile] ?? "blue"}>{T.profile[view.profile] ?? view.profile}</Badge>
        {view.global ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase text-cyan">
            <GlobeIcon className="h-3 w-3" />
            {T.globalSponsor}
          </span>
        ) : null}
      </span>
      <p className={cx("mt-1 text-[10px] font-semibold", a.text)}>{T.profileTag[view.profile]}</p>
      <p className="mt-1.5 text-sm font-bold text-ink">{T.upTo(money(view.upTo))}</p>
      <span className="mt-1 h-1.5 w-full rounded-full bg-white/10" aria-hidden>
        <span className={cx("block h-full rounded-full", a.bar)} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** The comparison: one column per offer, one icon-led band per row. */
function Comparison({
  views,
  onSign,
  disabled,
  footer,
}: {
  views: OfferView[];
  onSign?: (sponsorId: string) => void;
  disabled?: boolean;
  footer?: (view: OfferView) => React.ReactNode;
}) {
  const C = useCareerCopy();
  const D = C.dates;
  const T = C.finances.deal;
  const top = Math.max(...views.map((v) => v.upTo));
  const cols = views.length === 1 ? "grid-cols-1" : views.length === 2 ? "grid-cols-2" : "grid-cols-3";
  const grid = cx("grid gap-1.5", cols);
  return (
    <div className="min-w-0">
      <div className={grid}>
        {views.map((v) => (
          <ColumnHead key={v.sponsorId} view={v} topCeiling={top} />
        ))}
      </div>

      <div className={grid}>
        <BandHead icon={<CoinsIcon className="h-full w-full" />} label={T.rowWeekly} />
        {views.map((v) => (
          <Cell key={v.sponsorId}>
            <p className="text-sm font-bold text-good">{money(v.weekly)}</p>
          </Cell>
        ))}

        <BandHead icon={<SignIcon className="h-full w-full" />} label={T.rowUpfront} />
        {views.map((v) => (
          <Cell key={v.sponsorId}>
            <p className="text-sm font-bold text-ink">{v.fixed > 0 ? money(v.fixed) : "—"}</p>
            {v.fixed > 0 ? (
              <p className="flex items-center justify-center gap-0.5 text-[9px] text-faint">
                {v.fixedKind === "milestone" ? <FlagIcon className="h-2.5 w-2.5" /> : null}
                {v.fixedKind === "milestone" ? T.upfrontMilestone : T.upfrontSigning}
              </p>
            ) : null}
          </Cell>
        ))}

        <BandHead icon={<TrophyIcon className="h-full w-full" />} label={T.rowBonus} />
        {views.map((v) => (
          <Cell key={v.sponsorId}>
            <p className="text-sm font-bold text-ink">{money(v.bonus)}</p>
          </Cell>
        ))}

        <BandHead icon={<TargetIcon className="h-full w-full" />} label={T.rowGoal} />
        {views.map((v) => (
          <Cell key={v.sponsorId} className="text-left">
            {v.goal ? (
              <>
                <span className="flex items-center justify-between gap-1">
                  <DifficultyMeter level={v.difficulty} label={T.difficultyMeter(T.word[v.goal.word] ?? v.goal.word)} />
                  <span className="truncate text-[9px] font-semibold uppercase text-faint">{T.word[v.goal.word] ?? v.goal.word}</span>
                </span>
                <p className="mt-1 text-[10px] leading-tight text-ink">
                  {T.goal(v.goal.kind, v.goal.count, v.goal.place ?? 0, (v.goal.slot % 3) + 1)}
                </p>
                {v.goalBy ? <p className="mt-0.5 text-[9px] text-faint">{T.goalBy(formatDateShort(D, v.goalBy))}</p> : null}
              </>
            ) : (
              "—"
            )}
          </Cell>
        ))}

        <BandHead icon={<FineIcon className="h-full w-full" />} label={T.rowFine} />
        {views.map((v) => (
          <Cell key={v.sponsorId}>
            {v.fineMax > 0 ? (
              <p className="text-sm font-bold text-orange-bright">−{money(v.fineMax)}</p>
            ) : (
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-good">
                <ShieldIcon className="h-3.5 w-3.5" />
                {T.noFine}
              </p>
            )}
          </Cell>
        ))}

        <BandHead icon={<CalendarIcon className="h-full w-full" />} label={T.rowLength} />
        {views.map((v) => (
          <Cell key={v.sponsorId}>
            <span className="flex justify-center gap-0.5" aria-hidden>
              {Array.from({ length: Math.min(6, v.lengthSplits) }).map((_, i) => (
                <span key={i} className={cx("h-1.5 w-2 rounded-sm", (ACCENT[v.profile] ?? ACCENT.balanced).bar)} />
              ))}
            </span>
            <p className="mt-1 text-[10px] font-semibold text-ink">{T.lengthShort(v.lengthSplits)}</p>
            <p className="text-[9px] text-faint">{T.endsOn(formatDateShort(D, v.endsOn))}</p>
          </Cell>
        ))}
      </div>

      {footer || onSign ? (
        <div className={cx(grid, "mt-2")}>
          {views.map((v) => (
            <div key={v.sponsorId} className="flex min-w-0 flex-col gap-1">
              {footer?.(v)}
              {onSign ? (
                <Button
                  variant="primary"
                  size="md"
                  full
                  className="mt-auto min-h-11"
                  disabled={disabled}
                  onClick={() => onSign(v.sponsorId)}
                >
                  {T.sign}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The founding partner's net weekly change for one offer (an rc.32 career still running one). */
function HandoverNet({ handover, offer }: { handover: FoundingHandoverView; offer: SponsorState }) {
  const C = useCareerCopy();
  const net = handoverNetWeeklyOf(handover, offer);
  return (
    <p className={cx("text-center text-[10px] font-semibold", net < 0 ? "text-orange-bright" : "text-sub")}>
      {C.finances.deal.handoverNet(
        formatMoneyDelta(net, { compact: true }),
        formatDateShort(C.dates, dateOfDay(handover.startsOn.seasonIndex, handover.startsOn.day)),
      )}
    </p>
  );
}

/** One offer on its own (the comparison's bands in one column) and its Sign button. */
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
    <Comparison
      views={[view]}
      onSign={onSign}
      disabled={disabled}
      footer={handover ? () => <HandoverNet handover={handover} offer={offer} /> : undefined}
    />
  );
}

/**
 * A sponsor decision: its deadline, the comparison's rule, the founding
 * partner's handover (an rc.32 career still running one) and one
 * comparison of the offers. Null when nothing is pending. `bare` drops the
 * title (a host that titles it itself).
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
  const offers = decision.offers.filter((o) => o.terms);
  const views = offers.map((o) => offerViewOf(o, today)).filter((v): v is OfferView => v !== null);
  const levelShare = offers[0]?.terms?.levelShare;
  const handover = foundingHandoverOf(save);
  const boldMissing = views.length > 0 && !views.some((v) => v.profile === "bold");
  return (
    <div>
      {bare ? null : (
        <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink">{C.finances.offerTitle}</h2>
      )}
      <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1", !bare && "mt-1")}>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-bright">
          <CalendarIcon className="h-3.5 w-3.5" />
          {T.decideBy(formatDateShort(D, dateOfDay(decision.deadlineOn.seasonIndex, decision.deadlineOn.day)))}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-sub">
        <span className="inline-flex items-end gap-0.5" aria-hidden>
          <span className="h-1.5 w-1 rounded-sm bg-good" />
          <span className="h-2.5 w-1 rounded-sm bg-blue" />
          <span className="h-3.5 w-1 rounded-sm bg-orange" />
        </span>
        {T.compareRule}
      </p>
      {levelShare !== undefined && levelShare < 1 ? (
        <p className="mt-1 text-[11px] text-faint">{T.levelScaled(offers[0].tier, Math.round(levelShare * 100))}</p>
      ) : null}
      {handover ? (
        <p className="mt-1 text-[11px] text-faint">
          {handover.onSigning
            ? T.handover(handover.first, handover.second)
            : T.handoverLater(seasonLabelFor(handover.throughSeason), handover.first, handover.second)}
        </p>
      ) : null}
      <div className="mt-3">
        <Comparison
          views={views}
          onSign={onSign}
          footer={
            handover
              ? (v) => {
                  const o = offers.find((x) => x.sponsorId === v.sponsorId);
                  return o ? <HandoverNet handover={handover} offer={o} /> : null;
                }
              : undefined
          }
        />
      </div>
      {boldMissing ? <p className="mt-2 text-[11px] text-faint">{T.boldLocked}</p> : null}
    </div>
  );
}

/** A stat tile: icon, label, value and an optional sub-line. */
function Tile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-white/[0.03] p-2">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-faint">
        <span className="h-3.5 w-3.5 shrink-0 text-sub">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className={cx("mt-1 truncate text-sm font-bold", tone ?? "text-ink")}>{value}</p>
      {sub ? <p className="truncate text-[10px] text-faint">{sub}</p> : null}
    </div>
  );
}

/** The running rc.34 deal on the Finances desk: stat tiles, the goal and its progress, the run, fines and patience. */
export function SponsorDealPanel({ save, perks }: { save: CareerSave; perks?: React.ReactNode }) {
  const C = useCareerCopy();
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
    <div className={cx("rounded-lg border bg-white/[0.02] p-3", a.border)}>
      <p className="kicker mb-1.5 text-[9px]">{T.activeTitle}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="display min-w-0 truncate text-base font-bold uppercase tracking-wide text-ink">{brand?.name ?? view.sponsorId}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {view.global ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-cyan">
              <GlobeIcon className="h-3.5 w-3.5" />
              {T.globalSponsor}
            </span>
          ) : null}
          <Badge tone={PROFILE_TONE[view.profile] ?? "blue"}>{T.profile[view.profile] ?? view.profile}</Badge>
          <Badge tone="neutral">{C.finances.sponsorTier(view.tier)}</Badge>
        </span>
      </div>
      {brand ? <p className="mt-0.5 text-[11px] italic text-faint">{lang === "pt" ? brand.flavorPt : brand.flavorEn}</p> : null}

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <Tile icon={<CoinsIcon className="h-full w-full" />} label={T.rowWeekly} value={money(view.weekly)} tone="text-good" />
        <Tile
          icon={<CalendarIcon className="h-full w-full" />}
          label={T.nextPay}
          value={view.nextPayOn ? formatDateShort(D, view.nextPayOn) : T.noNextPay}
        />
        {fines.total > 0 ? (
          <Tile
            icon={<FineIcon className="h-full w-full" />}
            label={T.rowFine}
            value={`−${money(fines.total)}`}
            sub={T.finesShort(fines.mondays)}
            tone="text-orange-bright"
          />
        ) : (
          <Tile icon={<ShieldIcon className="h-full w-full" />} label={T.rowFine} value={T.noFine} sub={T.finesNone} tone="text-good" />
        )}
      </div>

      {cur ? (
        <div className="mt-2.5 rounded-md bg-white/[0.03] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
              <TargetIcon className="h-3.5 w-3.5 text-sub" />
              {T.thisGoal}
            </p>
            <span className="flex items-center gap-2">
              <DifficultyMeter
                level={cur.goal.word === "stretch" ? 3 : cur.goal.word === "even" ? 2 : 1}
                label={T.difficultyMeter(T.word[cur.goal.word] ?? cur.goal.word)}
              />
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">
            {T.goal(cur.goal.kind, cur.goal.count, cur.goal.place ?? 0, (cur.goal.slot % 3) + 1)}
          </p>
          <div className="mt-2 flex items-center gap-1" role="img" aria-label={T.progress(cur.progress.done, cur.progress.target)}>
            {Array.from({ length: cur.progress.target }).map((_, i) => (
              <span
                key={i}
                className={cx("h-2 flex-1 rounded-full", i < cur.progress.done ? (cur.goal.missed !== undefined ? "bg-bad/70" : "bg-good") : "bg-white/10")}
              />
            ))}
            <span className="ml-1.5 shrink-0 text-[11px] font-semibold text-ink">
              {cur.progress.done}/{cur.progress.target}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1 text-good">
              <TrophyIcon className="h-3.5 w-3.5" />+{money(save.sponsor!.bonus)}
            </span>
            {view.risk.kind === "fine" ? (
              <span className="inline-flex items-center gap-1 text-orange-bright">
                <FineIcon className="h-3.5 w-3.5" />−{money(view.risk.max)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-faint">
              <CalendarIcon className="h-3.5 w-3.5" />
              {T.goalBy(formatDateShort(D, cur.by))}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-faint">
          <span>{T.dealRun(paid, view.mondaysTotal)}</span>
          <span>{T.endsOn(formatDateShort(D, view.endsOn))}</span>
        </div>
        <span className="mt-1 block h-1.5 w-full rounded-full bg-white/10" aria-hidden>
          <span className={cx("block h-full rounded-full", a.bar)} style={{ width: `${runPct}%` }} />
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {view.hits + view.misses > 0 ? (
          <span className="flex items-center gap-1" role="img" aria-label={T.record(view.hits, view.misses)}>
            {Array.from({ length: view.hits }).map((_, i) => (
              <TrophyIcon key={`h${i}`} className="h-3.5 w-3.5 text-good" />
            ))}
            {Array.from({ length: view.misses }).map((_, i) => (
              <FineIcon key={`m${i}`} className="h-3.5 w-3.5 text-bad/80" />
            ))}
          </span>
        ) : null}
        {view.fixedKind === "milestone" && view.fixed > 0 ? (
          <span className={cx("inline-flex items-center gap-1 text-[11px]", view.fixedPaid ? "text-good" : "text-faint")}>
            <FlagIcon className="h-3.5 w-3.5" />
            {view.fixedPaid ? T.milestonePaid(money(view.fixed)) : T.milestonePending(money(view.fixed))}
          </span>
        ) : null}
        {view.nextGoalOn ? (
          <span className="text-[11px] text-faint">{T.nextGoal(formatDateShort(D, view.nextGoalOn))}</span>
        ) : null}
      </div>

      {view.risk.kind === "fine" ? (
        <p className="mt-1.5 text-[10px] text-faint">
          {T.seasonFineCap(money(seasonCap))} · {T.fineFloorNote}
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
