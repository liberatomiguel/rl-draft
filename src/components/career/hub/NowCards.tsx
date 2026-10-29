"use client";

/**
 * Road to Worlds hub — the "Needs you" cards (v2.0 hub rebuild, R26). Each
 * card is one decision or one stop the clock cannot pass on its own: a
 * season stop, an event today, an incoming bid, sponsor offers, a Community
 * Cup invite. Extracted from HubScreen so the hub itself reads as layout.
 */

import { useRouter } from "next/navigation";
import { CAREER_SALARY, CAREER_TRANSFER } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { sponsorBrandById } from "@/data/career/sponsors";
import { breachOutcomeFor, insertMoneyFor, loanBreachesOf, weeklyOf } from "@/engine/career/economy";
import type {
  CareerEventDef,
  CareerSave,
  SponsorObjectiveKind,
  SponsorState,
  TransferOffer,
} from "@/engine/career/types";
import { insertById, type InsertEffects } from "@/data/career/inserts";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";
import { REGION_BADGE } from "@/components/regionStyle";
import { dateOfDay, nameOfRef, squadAge } from "@/components/career/careerUi";
import { formatDateShort, formatDaysAway } from "@/components/career/dateText";
import { OrgMark } from "@/components/career/OrgMark";
import { TeamStars } from "@/components/career/TeamStars";
import { TierChip, maxPointsOf, prizePoolOf } from "@/components/career/hub/hubShared";
import { formatLineOf } from "@/components/career/event/WeekendPlan";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type DatesCopy = CareerCopy["dates"];

/** v2.0 (R33): the mid-week insert — one question, two clear options. rc.2:
 *  every consequence is an ICON row (cash · reputation · chemistry · training)
 *  with a signed value, so the trade-off reads at a glance. */
export function NowInsert({
  C,
  id,
  onChoose,
  seasonIndex = 0,
}: {
  C: CareerCopy;
  id: string;
  onChoose: (key: "a" | "b") => void;
  /** rc.32 (M1): the catalogue's money is season-0 money — shown on the money index, as booked. */
  seasonIndex?: number;
}) {
  const def = insertById.get(id);
  const item = C.inserts.items[id];
  if (!def || !item) return null;
  return (
    <div>
      <p className="kicker mb-1 text-[10px] text-cyan">{C.inserts.kinds[def.kind]}</p>
      <h2 className="display text-xl font-bold uppercase tracking-wide text-ink sm:text-2xl">{item.title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-sub">{item.body}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {def.options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChoose(o.key)}
            className={cx(
              "flex min-h-24 flex-col rounded-xl border px-4 py-3 text-left transition-colors",
              o.key === "a" ? "border-orange/50 bg-orange/10 hover:bg-orange/15" : "border-line bg-white/[0.03] hover:border-line-strong",
            )}
          >
            <span className="display text-sm font-bold uppercase tracking-[0.1em] text-ink">{o.key === "a" ? item.a : item.b}</span>
            <InsertEffectRows fx={o.effects} C={C} seasonIndex={seasonIndex} />
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-faint">{C.inserts.expires}</p>
    </div>
  );
}

function InsertEffectRows({ fx, C, seasonIndex }: { fx: InsertEffects; C: CareerCopy; seasonIndex: number }) {
  const rows: { key: string; icon: React.ReactNode; label: string; value: string; good: boolean }[] = [];
  const money = fx.money ? insertMoneyFor(fx.money, seasonIndex) : 0;
  if (money) rows.push({ key: "money", icon: <CoinGlyph />, label: C.inserts.fx.money, value: formatMoneyDelta(money, { compact: true }), good: money > 0 });
  if (fx.rep) rows.push({ key: "rep", icon: <RepGlyph />, label: C.inserts.fx.repLabel, value: `${fx.rep > 0 ? "+" : ""}${fx.rep}`, good: fx.rep > 0 });
  if (fx.chemistry) rows.push({ key: "chem", icon: <ChemGlyph />, label: C.inserts.fx.chemLabel, value: `${fx.chemistry > 0 ? "+" : "−"}`, good: fx.chemistry > 0 });
  if (fx.trainingWeeks)
    rows.push({
      key: "train",
      icon: <TrainGlyph />,
      label: C.inserts.fx.trainingLabel,
      value: C.inserts.fx.trainingWeeks(fx.trainingWeeks),
      good: fx.trainingWeeks > 0,
    });
  if (rows.length === 0) {
    return <span className="mt-2 text-[11px] text-faint">{C.inserts.fx.none}</span>;
  }
  return (
    <ul className="mt-2 space-y-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-[11px]">
          <span className={cx("flex h-5 w-5 items-center justify-center rounded-md", r.good ? "bg-good/15 text-good" : "bg-bad/15 text-bad")}>{r.icon}</span>
          <span className="text-sub">{r.label}</span>
          <span className={cx("display ml-auto font-bold", r.good ? "text-good" : "text-bad")}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

const glyphProps = { viewBox: "0 0 24 24", className: "h-3.5 w-3.5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const CoinGlyph = () => (
  <svg {...glyphProps}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.5c0 2.2-5 1.4-5 3.6 0 .9 1 1.5 2.5 1.5s2.5-.6 2.5-1.6" />
  </svg>
);
const RepGlyph = () => (
  <svg {...glyphProps}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z" />
  </svg>
);
const ChemGlyph = () => (
  <svg {...glyphProps}>
    <path d="M10 14a4 4 0 0 1 0-5.6l2.3-2.3a4 4 0 0 1 5.6 5.6L16.5 13" />
    <path d="M14 10a4 4 0 0 1 0 5.6l-2.3 2.3a4 4 0 0 1-5.6-5.6L7.5 11" />
  </svg>
);
const TrainGlyph = () => (
  <svg {...glyphProps}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);

/** v2.0: a pending Community Cup / Invitational invite the player has not committed to. */
export function NowInvite({
  save,
  C,
  D,
  def,
  onAccept,
  onPass,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  def: CareerEventDef;
  onAccept: () => void;
  onPass: () => void;
}) {
  const router = useRouter();
  const daysAway = def.day - save.clock.day;
  return (
    <div>
      <h2 className="display text-xl font-bold uppercase tracking-wide text-ink sm:text-2xl">
        {C.hub.inviteTitle(def.name)}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TierChip tier={def.tier} />
        <Badge>{formatDateShort(D, dateOfDay(save.clock.seasonIndex, def.day))}</Badge>
        <Badge tone="blue">{formatDaysAway(D, daysAway)}</Badge>
        <Badge tone="orange">{formatMoney(prizePoolOf(def, save.difficulty), { compact: true })}</Badge>
      </div>
      <p className="mt-3 max-w-md text-sm text-sub">
        {C.hub.inviteBody(formatDateShort(D, dateOfDay(save.clock.seasonIndex, def.day)))}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" size="md" onClick={onAccept}>
          {C.hub.inviteAccept}
        </Button>
        <Button variant="ghost" size="md" onClick={onPass}>
          {C.hub.invitePass}
        </Button>
        <Button variant="secondary" size="md" onClick={() => router.push("/career/event")}>
          {C.calendar.field}
        </Button>
      </div>
    </div>
  );
}

export function NowSeason({ save, C, onGo }: { save: CareerSave; C: CareerCopy; onGo: () => void }) {
  const ended = save.phase === "ended";
  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
        {ended ? C.ceremonies.legacyTitle : C.ceremonies.seasonReview}
      </h2>
      <Button variant="primary" size="lg" className="mt-5 w-full sm:w-auto" onClick={onGo}>
        {C.hub.continue}
      </Button>
    </div>
  );
}

export function NowEvent({
  save,
  C,
  D,
  def,
  daysAway,
  primaryLabel,
  onPrimary,
  onAdvanceDay,
  stage,
  day,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  def: CareerEventDef;
  daysAway: number;
  primaryLabel: React.ReactNode;
  onPrimary: () => void;
  onAdvanceDay?: () => void;
  /**
   * v2.0 (R40): the weekend phase, in place of the matchday badge — "Swiss
   * stage" / "Swiss stage complete" (Saturday) / "Championship Sunday".
   */
  stage?: { label: string; tone: "orange" | "good" | "gold"; live?: boolean };
  /** The day the card is about (Sunday of a two-day event); defaults to `def.day`. */
  day?: number;
}) {
  const fieldRegion =
    def.region ?? (def.tier === "t2" || def.tier === "t3" ? save.identity.region : null);
  const fieldOrgs = Object.values(save.world.orgs).filter(
    (o) => !fieldRegion || o.region === fieldRegion,
  );
  const fieldStars = fieldOrgs.length
    ? fieldOrgs.reduce((s, o) => s + o.stars, 0) / fieldOrgs.length
    : 0;
  const points = maxPointsOf(def.tier);
  const unavailable =
    daysAway === 0 && save.pendingUnavailability && save.pendingUnavailability.eventId === def.id
      ? save.squad.find((p) => p.id === save.pendingUnavailability?.playerId)
      : null;

  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">
        {def.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stage ? (
          <Badge tone={stage.tone} className={cx(stage.live && "animate-pulse")}>
            {stage.label}
          </Badge>
        ) : (
          <Badge tone="orange" className={cx(daysAway === 0 && "animate-pulse")}>
            {C.hub.matchdayIn(daysAway)}
          </Badge>
        )}
        <TierChip tier={def.tier} />
        {def.region ? <Badge className={REGION_BADGE[def.region]}>{def.region}</Badge> : null}
        <Badge>{formatDateShort(D, dateOfDay(save.clock.seasonIndex, day ?? def.day))}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.calendar.prizePool}</p>
          <p className="display text-lg font-bold text-orange-bright">
            {formatMoney(prizePoolOf(def, save.difficulty), { compact: true })}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.common.seasonPoints}</p>
          <p className="display text-lg font-bold text-ink">
            {points !== null ? `${points} ${C.standings.ptsShort}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.03] p-2.5">
          <p className="kicker text-[9px]">{C.calendar.fieldQuality}</p>
          <TeamStars stars={Math.round(fieldStars)} size="md" className="mt-1" />
        </div>
      </div>
      <p className="mt-2 text-xs text-faint">{formatLineOf(C, def)}</p>

      {unavailable ? (
        <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {C.event.unavailableNotice(unavailable.name)}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={onPrimary}>
          {primaryLabel}
        </Button>
        {onAdvanceDay ? (
          <Button variant="ghost" size="md" className="min-h-11" onClick={onAdvanceDay}>
            {C.hub.advanceDay}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NowBid({
  save,
  C,
  offer,
  onAccept,
  onDecline,
}: {
  save: CareerSave;
  C: CareerCopy;
  offer: TransferOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const orgName = offer.otherRef ? nameOfRef(save, offer.otherRef) : "?";
  const orgStars = offer.otherRef ? (save.world.orgs[offer.otherRef]?.stars ?? 0) : 0;
  const player = save.squad.find((p) => p.id === offer.playerId);

  return (
    <div>
      {offer.blockbuster ? (
        <>
          <Badge tone="gold" className="mb-2">
            {C.market.blockbuster}
          </Badge>
          {/* rc.32 (Miguel, 30/10): what a Blockbuster is, its price, the cost of refusing. */}
          <p className="mb-3 max-w-xl text-xs leading-relaxed text-sub">
            {blockbusterWhatOf(C, orgName)}
          </p>
        </>
      ) : offer.listing ? (
        <Badge tone="blue" className="mb-2">
          {C.market.listingTag}
        </Badge>
      ) : null}
      <div className="flex items-center gap-3">
        {offer.otherRef ? <OrgMark save={save} orgRef={offer.otherRef} size="lg" /> : null}
        <div className="min-w-0">
          <p className="display truncate text-lg font-bold uppercase tracking-wide text-ink">
            {orgName} <TeamStars stars={orgStars} size="sm" className="ml-1 align-middle" />
          </p>
          <p className="text-xs text-sub">{C.market.bidFrom(orgName)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-line bg-white/[0.03] p-3">
        <div className="min-w-0">
          <p className="display truncate text-xl font-bold text-ink">{offer.playerName}</p>
          {player ? (
            <p className="text-xs text-sub">
              {C.common.ovrShort(Math.round(player.overall))} · {C.player.age(squadAge(save, player))}{" "}
              · {C.player.archetype[player.archetype]}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="kicker text-[9px]">{C.market.fee}</p>
          <p className="display text-2xl font-bold text-orange-bright">
            {formatMoney(offer.fee, { compact: true })}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-faint">{C.market.declineHint(refusalPct())}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={onAccept}>
          {C.market.accept}
        </Button>
        <Button variant="danger" size="lg" onClick={onDecline}>
          {C.market.decline}
        </Button>
      </div>
    </div>
  );
}

/** rc.32: the renewal surcharge a refused Blockbuster carries, in percent (balance.ts). */
export function refusalPct(): number {
  return Math.round((CAREER_SALARY.blockbusterRefusalRenewalMult - 1) * 100);
}

/** rc.32 (Miguel, 30/10): the Blockbuster explainer, numbers from balance.ts — the HQ card and the Market's deals share it. */
export function blockbusterWhatOf(C: CareerCopy, orgName: string): string {
  return C.market.blockbusterWhat(orgName, String(CAREER_TRANSFER.blockbusterFeeMult), refusalPct());
}

/**
 * rc.32 (ECONOMY-CONTRACT M4 — provisional): the HQ's Backer line — the debt
 * still owed and what the next Monday below the floor would mean
 * (economy.breachOutcomeFor), plus the restructurings so far.
 */
export function NowBacker({ save, C, owed }: { save: CareerSave; C: CareerCopy; owed: string }) {
  const breaches = loanBreachesOf(save.finances);
  const next = breachOutcomeFor(breaches + 1, save.difficulty);
  return (
    <div className="space-y-1">
      <p>{C.hub.backerOpen(owed)}</p>
      {breaches >= 2 ? <p className="text-xs text-faint">{C.hub.restructuredLine(breaches)}</p> : null}
      <p className={cx("text-xs font-semibold", next === "insolvent" ? "text-bad" : "text-orange-bright")}>
        {C.hub.backerNextBreach(next)}
      </p>
    </div>
  );
}

export function NowSponsorChoice({
  C,
  lang,
  offers,
  objectiveText,
  onChoose,
}: {
  C: CareerCopy;
  lang: "en" | "pt";
  offers: SponsorState[];
  objectiveText: (kind: SponsorObjectiveKind) => string;
  onChoose: (sponsorId: string) => void;
}) {
  return (
    <div>
      <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink">
        {C.finances.offerTitle}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {offers.map((o) => {
          const brand = sponsorBrandById.get(o.sponsorId);
          return (
            <div
              key={o.sponsorId}
              className="flex flex-col rounded-lg border border-line bg-white/[0.03] p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="display truncate text-base font-bold uppercase tracking-wide text-ink">
                  {brand?.name ?? o.sponsorId}
                </p>
                <Badge tone="blue">{C.finances.sponsorTier(o.tier)}</Badge>
              </div>
              {brand ? (
                <p className="mt-1 text-xs italic text-faint">
                  {lang === "pt" ? brand.flavorPt : brand.flavorEn}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold text-good">
                {C.finances.perWeekBase(formatMoney(weeklyOf(o.basePerSplit), { compact: true }))}
              </p>
              <p className="text-xs text-sub">
                {C.finances.bonusFor(formatMoney(o.bonus, { compact: true }))}
              </p>
              <p className="mt-1.5 text-xs text-sub">
                {C.finances.sponsorObjective}: {objectiveText(o.objectiveKind)}
              </p>
              <Button
                variant="primary"
                size="md"
                full
                className="mt-3"
                onClick={() => onChoose(o.sponsorId)}
              >
                {C.market.accept}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

