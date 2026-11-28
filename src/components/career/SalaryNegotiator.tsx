"use client";

/**
 * Road to Worlds — the contract talk (sign + renew). rc.33 (ECO-10 +
 * ECO-11), made visual in rc.35 (front N).
 *
 * rc.36 (front S2, Miguel on rc.35: "he answers only after you send the
 * offer, and a refusal raises his requirements; every lever counts, the
 * signing bonus included; the block more discreet and organised"): three
 * quiet groups —
 *  - YOUR OFFER: the length, the weekly wage, the prize share and the
 *    signing bonus, plain sliders with ± (reducing share/bonus keeps
 *    the wage; increases above his full ask can trade against the wage);
 *  - HIS POSITION: one gauge of the offer's worth to him against what he
 *    needs for sure and his ask, his chance, his asking terms and what each
 *    lever is worth to him (the reason his answer moves);
 *  - SEND: "Send offer" gets his answer. A refusal (counted by the flow, it
 *    raises what he needs this window) names what he now needs, and "Meet
 *    his price" sets it. Nothing on the sheet gives the answer away first.
 * Every number is the engine's answer (`contract.negotiationAnswerFor`,
 * through `careerFlow.signingTalkFor` / `renewalTalkFor`); every move is the
 * engine's (`talkSetFor` for a slider, `talkPressFor` for a ± press).
 */

import { useState, type ReactNode } from "react";
import {
  talkPressFor,
  talkSetFor,
  type ContractOffer,
  type NegotiationAnswer,
  type TalkLever,
} from "@/engine/career/contract";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import { AlertIcon, CalendarIcon, CoinsIcon, GiftIcon, PercentIcon } from "@/components/ui/icons";
import { Button, buttonClass } from "@/components/ui/Button";
import { formatMoney, formatMoneyDelta } from "@/lib/format";
import { cx } from "@/lib/util";

type Talk = CareerCopy["market"]["negotiation"];

/** The − / + of a lever: the shared outline button, cut square (44px, a touch target). */
const STEP_BTN = "!min-h-11 w-11 shrink-0 !px-0 !text-lg";

const money = (w: number) => formatMoney(w);

/** A group's quiet heading: a caps label, read as a column head. */
function GroupHead({ title }: { title: string }) {
  return <p className="kicker">{title}</p>;
}

/** One lever: its label and his ask on one line, then − / value + plain track / +, and why a closed way is closed. */
function LeverSlider({
  label,
  icon,
  side,
  value,
  display,
  min,
  max,
  step,
  tick,
  onSet,
  down,
  up,
  go,
  labels,
  why,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  side?: ReactNode;
  value: number;
  display: ReactNode;
  min: number;
  max: number;
  step: number;
  /** His ask on the track. */
  tick?: number;
  onSet: (v: number) => void;
  down: ContractOffer | null;
  up: ContractOffer | null;
  go: (o: ContractOffer) => void;
  labels: { down: string; up: string };
  /** Why a way is closed (null = open). */
  why: { down: string | null; up: string | null };
  disabled?: boolean;
}) {
  const span = Math.max(1, max - min);
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-sub">
          <span className="h-4 w-4 shrink-0 text-faint">{icon}</span>
          <span className="truncate">{label}</span>
        </span>
        {side ? <span className="shrink-0 text-xs text-faint">{side}</span> : null}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={labels.down}
          title={why.down ?? undefined}
          className={STEP_BTN}
          onClick={() => down && go(down)}
          disabled={disabled || !down}
        >
          −
        </Button>
        <div className="min-w-0 flex-1">
          <p className="display text-center text-xl font-bold leading-tight tabular-nums text-ink">{display}</p>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/8">
              <div className="absolute inset-y-0 left-0 rounded-full bg-orange/45" style={{ width: `${pct(value)}%` }} />
            </div>
            {tick !== undefined ? (
              <div
                className="absolute top-1 h-4 w-0.5 rounded bg-white/45"
                style={{ left: `calc(${pct(tick)}% - 1px)` }}
                aria-hidden
              />
            ) : null}
            <input
              type="range"
              aria-label={label}
              min={min}
              max={Math.max(min + step, max)}
              step={step}
              value={value}
              disabled={disabled || max <= min}
              onChange={(e) => onSet(Number(e.target.value))}
              className="talk-range absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent accent-orange disabled:cursor-default [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-orange [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-orange"
            />
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          aria-label={labels.up}
          title={why.up ?? undefined}
          className={STEP_BTN}
          onClick={() => up && go(up)}
          disabled={disabled || !up}
        >
          +
        </Button>
      </div>
      {why.down || why.up ? (
        <div className="flex justify-between gap-2 px-[3.25rem] text-xs text-faint">
          <span>{why.down ? `▼ ${why.down}` : ""}</span>
          <span className="text-right">{why.up ? `▲ ${why.up}` : ""}</span>
        </div>
      ) : null}
    </div>
  );
}

/** HIS POSITION: the offer's worth to him on one line — red to amber up to what he needs for sure, green to his ask. */
function WorthGauge({ talk, N }: { talk: NegotiationAnswer; N: Talk }) {
  const { zone } = talk;
  const left = Math.max(0, zone.zeroWorth);
  const right = Math.max(left + 1, zone.askWorth);
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - left) / (right - left)) * 100));
  const needPct = pct(zone.needWorth);
  const sure = talk.odds >= 1;
  const oddsPct = Math.round(talk.odds * 100);
  const tone = sure ? "text-good" : talk.odds >= 0.5 ? "text-orange-bright" : "text-sub";
  return (
    <div className="mt-3">
      {/* Two figures, each with its quiet label under it: what the offer is
          worth to him, and his chance of signing it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-2xl font-bold leading-none tabular-nums text-ink">
            {money(talk.worth)}
            <span className="ml-1 text-[11px] font-medium text-sub">{N.perWeek}</span>
          </p>
          <p className="mt-1 text-xs text-sub">{N.worthTitle}</p>
        </div>
        <div
          className="shrink-0 text-right"
          role="meter"
          aria-label={N.odds}
          aria-valuenow={oddsPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <p className={cx("display text-2xl font-bold leading-none tabular-nums", tone)}>{sure ? N.oddsSure : `${oddsPct}%`}</p>
          <p className="mt-1 text-xs text-sub">{N.odds}</p>
        </div>
      </div>
      <div className="relative mt-2.5 h-4" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-orange/40 transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${pct(talk.worth)}%` }}
          />
          <div className="absolute inset-y-0 w-px bg-white/35" style={{ left: `${needPct}%` }} />
        </div>
        <div
          className="absolute top-0 h-4 w-1 rounded-full bg-white outline outline-2 outline-black/45 transition-[left] duration-200 motion-reduce:transition-none"
          style={{ left: `calc(${pct(talk.worth)}% - 2px)` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-faint">
        <span className="inline-flex items-center gap-1.5">
          {/* The key of the mark on the track above (a line, like the mark). */}
          <span className="inline-block h-3 w-px bg-white/45" />
          {N.sureFrom(money(zone.needWorth))}
        </span>
        <span>{N.askMark(money(zone.askWorth))}</span>
      </div>
    </div>
  );
}

/** What one lever is worth to him (weekly money): + helps the offer, − costs it. */
function Effect({ icon, label, amount, N }: { icon: ReactNode; label: string; amount: number; N: Talk }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1.5 text-xs">
      <span className="h-4 w-4 shrink-0 text-faint">{icon}</span>
      <span className="text-sub">{label}</span>
      <span className={cx("font-semibold tabular-nums", amount > 0 ? "text-good" : amount < 0 ? "text-orange-bright" : "text-sub")}>
        {N.effectWeekly(formatMoneyDelta(amount))}
      </span>
    </span>
  );
}

/** What a send came back with: signed (the host closes the sheet), refused, or not sent (the host shows why). */
export type TalkSendResult = "signed" | "refused" | "error";

export function SalaryNegotiator({
  talk,
  onChange,
  onSend,
  length,
  blocked,
  sendLabel,
  disabled,
}: {
  /** The engine's answer to the current offer (`signingTalkFor` / `renewalTalkFor`). */
  talk: NegotiationAnswer;
  /** The next offer (an empty offer = his ask). */
  onChange: (next: ContractOffer) => void;
  /** rc.36: send the offer — the host runs the flow and says how it went. Omitted = no send row. */
  onSend?: () => TalkSendResult;
  /** rc.36: the contract length, a lever of the offer (the host owns it: it reprices his ask). */
  length?: {
    value: 1 | 2 | 3;
    options: readonly (1 | 2 | 3)[];
    onChange: (l: 1 | 2 | 3) => void;
    /** A line under each option (the renewal's ask by length). */
    sub?: (l: 1 | 2 | 3) => string;
    /** A note under the row (a final-season deal). */
    note?: ReactNode;
  };
  /** rc.36: why the offer cannot be sent (the money checks) — the send is disabled and says so. */
  blocked?: string | null;
  sendLabel?: string;
  disabled?: boolean;
}) {
  const C = useCareerCopy();
  const N = C.market.negotiation;
  const { zone, offer, ask, limits, effects } = talk;
  /** rc.36: his answer to the last offer sent, when he refused it (the refusal is the save's; this is only the sheet's line). */
  const [refused, setRefused] = useState<number | null>(null);
  const atAsk = offer.sharePct === ask.sharePct && offer.bonus === ask.bonus && offer.weekly >= zone.topWeekly;
  const press = (lever: TalkLever, dir: 1 | -1) => talkPressFor(talk, lever, dir);
  const set = (lever: TalkLever) => (v: number) => onChange(talkSetFor(talk, lever, v));
  const why = N.why;

  // The wage track: from the league minimum to his ask at this share and bonus.
  const wageMin = zone.minWeekly;
  const wageMax = Math.max(zone.minWeekly, zone.topWeekly);
  const wageStep = Math.max(1, Math.min(zone.stepWeekly, 10));

  const send = () => {
    if (!onSend) return;
    const sent = offer.weekly;
    const result = onSend();
    setRefused(result === "refused" ? sent : null);
  };

  const shareDelta = offer.sharePct - ask.sharePct;
  const bonusDelta = offer.bonus - ask.bonus;

  return (
    // The talk is a section of the sheet it sits in, not a box inside it: a
    // title, then three groups divided by hairlines (offer, position, send).
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="card-title">{N.title}</h3>
        <Button variant="ghost" size="sm" onClick={() => onChange({})} disabled={disabled || atAsk}>
          {N.fullAsk}
        </Button>
      </div>

      {/* 1 — YOUR OFFER: the four levers */}
      <div className="mt-3">
        <GroupHead title={N.groupOffer} />
        {length ? (
          <div className="mt-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sub">
              <CalendarIcon className="h-4 w-4 shrink-0 text-faint" />
              {N.length}
            </span>
            <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${length.options.length}, minmax(0, 1fr))` }}>
              {length.options.map((l) => (
                // The picked length is marked by its hairline (blue: a choice, not the action).
                <button
                  key={l}
                  type="button"
                  aria-pressed={length.value === l}
                  disabled={disabled}
                  onClick={() => length.onChange(l)}
                  className={cx(
                    buttonClass("secondary", "sm"),
                    "!min-h-11 flex-col !gap-1 !px-1.5",
                    length.value === l ? "!border-blue-bright/70 !bg-blue/10" : "!bg-transparent",
                  )}
                >
                  <span>{C.market.seasons(l)}</span>
                  {length.sub ? <span className="text-[11px] font-medium text-sub">{length.sub(l)}</span> : null}
                </button>
              ))}
            </div>
            {length.note ? <div className="mt-1.5 text-xs text-orange-bright">{length.note}</div> : null}
          </div>
        ) : null}

        <LeverSlider
          label={N.wage}
          icon={<CoinsIcon className="h-full w-full" />}
          value={offer.weekly}
          display={
            <>
              {money(offer.weekly)}
              <span className="ml-1 text-[11px] font-medium text-sub">{N.perWeek}</span>
            </>
          }
          min={wageMin}
          max={wageMax}
          step={wageStep}
          onSet={set("wage")}
          down={press("wage", -1)}
          up={press("wage", 1)}
          go={onChange}
          labels={{ down: N.wageDown, up: N.wageUp }}
          why={{ down: limits.wageDown ? why.minimum : null, up: limits.wageUp ? why.ask : null }}
          disabled={disabled}
        />

        {/* The prize share (ECO-10): every player has it (rc.35), his ask is the tick */}
        {zone.shareLever ? (
          <LeverSlider
            label={N.share}
            icon={<PercentIcon className="h-full w-full" />}
            side={ask.sharePct > 0 ? N.shareAsk(ask.sharePct) : N.shareAskNone}
            value={offer.sharePct}
            display={`${offer.sharePct}%`}
            min={zone.shareMin}
            max={zone.shareMax}
            step={1}
            tick={ask.sharePct}
            onSet={set("share")}
            down={press("share", -1)}
            up={press("share", 1)}
            go={onChange}
            labels={{ down: N.shareDown, up: N.shareUp }}
            why={{
              down: limits.shareDown === "none" ? why.noShare : limits.shareDown ? why.shareLeast : null,
              up: limits.shareUp === "most" ? why.shareMost : limits.shareUp ? why.shareMinimum : null,
            }}
            disabled={disabled}
          />
        ) : null}

        {/* The signing bonus (rc.35): a lever like the others (rc.36: its worth moves his answer) */}
        {zone.bonusMax > 0 ? (
          <LeverSlider
            label={N.bonus}
            icon={<GiftIcon className="h-full w-full" />}
            side={N.bonusAsk(formatMoney(ask.bonus, { compact: true }))}
            value={offer.bonus}
            display={money(offer.bonus)}
            min={0}
            max={zone.bonusMax}
            step={zone.bonusStep}
            tick={ask.bonus}
            onSet={set("bonus")}
            down={press("bonus", -1)}
            up={press("bonus", 1)}
            go={onChange}
            labels={{ down: N.bonusDown, up: N.bonusUp }}
            why={{
              down: limits.bonusDown ? why.noBonus : null,
              up: limits.bonusUp === "most" ? why.bonusMost : limits.bonusUp ? why.shareMinimum : null,
            }}
            disabled={disabled}
          />
        ) : null}
      </div>

      {/* 2 — HIS POSITION: the worth gauge, his ask, what each lever is worth to him */}
      <div className="mt-5 border-t border-line pt-4">
        <GroupHead title={N.groupPosition} />
        <WorthGauge talk={talk} N={N} />
        {shareDelta !== 0 || bonusDelta !== 0 || effects.length > 0 || talk.refusals > 0 ? (
          <details className="mt-3" aria-label={N.effectsTitle}>
            <summary className="cursor-pointer text-xs text-sub hover:text-ink">{N.effectsTitle}</summary>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {shareDelta !== 0 ? (
                <Effect icon={<PercentIcon className="h-full w-full" />} label={N.effectShare(shareDelta)} amount={effects.share} N={N} />
              ) : null}
              {bonusDelta !== 0 ? (
                <Effect
                  icon={<GiftIcon className="h-full w-full" />}
                  label={N.effectBonus(formatMoneyDelta(bonusDelta, { compact: true }))}
                  amount={effects.bonus}
                  N={N}
                />
              ) : null}
              {effects.length > 0 ? (
                <Effect icon={<CalendarIcon className="h-full w-full" />} label={N.effectLength(talk.lengthSeasons)} amount={effects.length} N={N} />
              ) : null}
              {talk.refusals > 0 ? (
                <Effect icon={<AlertIcon className="h-full w-full" />} label={N.effectRefusals(talk.refusals)} amount={effects.refusals} N={N} />
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      {/* 3 — SEND: his answer only once the offer is sent */}
      {onSend ? (
        <div className="mt-5 border-t border-line pt-4">
          {/* His refusal is a state of the talk: an orange hairline, no fill. */}
          {refused !== null ? (
            <div role="status" className="mb-3 rounded-lg border border-orange/50 p-3">
              <div className="flex items-start gap-2">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-bright" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{N.refused(money(refused))}</p>
                  <p className="mt-0.5 text-xs text-sub">{N.nowWants(money(zone.floorWeekly))}</p>
                </div>
              </div>
              {offer.weekly < zone.floorWeekly ? (
                <Button
                  variant="secondary"
                  size="sm"
                  full
                  className="mt-3 !min-h-11"
                  onClick={() => onChange({ ...offer, weekly: zone.floorWeekly })}
                  disabled={disabled}
                >
                  {N.meetPrice}
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button variant="primary" size="md" full className="min-h-11" disabled={disabled || Boolean(blocked)} onClick={send}>
            {sendLabel ?? N.send}
          </Button>
          <p className={cx("mt-2 text-xs", blocked ? "text-orange-bright" : "text-faint")}>
            {blocked ?? N.sendHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
