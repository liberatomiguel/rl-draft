"use client";

/**
 * Road to Worlds rc.33 (ECO-10 + ECO-11) — the contract talk (sign + renew).
 *
 * Renders the engine's ONE answer (`contract.negotiationAnswerFor`, through
 * `careerFlow.signingTalkFor` / `renewalTalkFor`). Every number comes from
 * the answer; every move is the engine's (`talkSetFor` for a slider,
 * `talkPressFor` for a ± press).
 *
 * rc.35 (front N, Miguel on rc.34: "make it visual"): three sliders — the
 * weekly wage (its zone drawn on the track: green where he signs for sure,
 * fading amber below where his odds fall), the prize share and the signing
 * bonus (his ask marked) — and an odds meter. Moving the share or the bonus
 * moves the wage zone with it. Minimal text: the levers carry icons, the
 * answer is one line.
 */

import { type ReactNode } from "react";
import {
  talkPressFor,
  talkSetFor,
  type ContractOffer,
  type NegotiationAnswer,
  type TalkLever,
} from "@/engine/career/contract";
import { useCareerCopy } from "@/content/careerCopy";
import { CoinsIcon, GiftIcon, HandshakeIcon, PercentIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";

const STEP_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-lg font-bold text-sub hover:bg-white/6 disabled:opacity-40";

/** A slider on [min, max] with the zone painted under the thumb. */
function TalkSlider({
  label,
  icon,
  value,
  display,
  min,
  max,
  step,
  marks,
  onSet,
  onPress,
  pressLabels,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  display: ReactNode;
  min: number;
  max: number;
  step: number;
  /** Painted bands [from, to, class] and an ask tick. */
  marks: { bands: [number, number, string][]; tick?: number; side?: ReactNode };
  onSet: (v: number) => void;
  onPress: { down: ContractOffer | null; up: ContractOffer | null; go: (o: ContractOffer) => void };
  pressLabels: { down: string; up: string };
  disabled?: boolean;
}) {
  const span = Math.max(1, max - min);
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
          <span className="text-cyan">{icon}</span>
          {label}
        </span>
        <span className="text-[10px] text-faint">{marks.side}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={pressLabels.down}
          className={STEP_BTN}
          onClick={() => onPress.down && onPress.go(onPress.down)}
          disabled={disabled || !onPress.down}
        >
          −
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-center text-base font-bold tabular-nums">{display}</p>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/8">
              {marks.bands.map(([a, b, cls], i) => (
                <div
                  key={i}
                  className={cx("absolute inset-y-0", cls)}
                  style={{ left: `${pct(Math.min(a, b))}%`, width: `${pct(Math.max(a, b)) - pct(Math.min(a, b))}%` }}
                />
              ))}
            </div>
            {marks.tick !== undefined ? (
              <div
                className="absolute top-0 h-6 w-0.5 rounded bg-white/50"
                style={{ left: `calc(${pct(marks.tick)}% - 1px)` }}
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
              className="talk-range absolute inset-0 h-6 w-full cursor-pointer appearance-none bg-transparent accent-cyan disabled:cursor-default"
            />
          </div>
        </div>
        <button
          type="button"
          aria-label={pressLabels.up}
          className={STEP_BTN}
          onClick={() => onPress.up && onPress.go(onPress.up)}
          disabled={disabled || !onPress.up}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SalaryNegotiator({
  talk,
  onChange,
  disabled,
}: {
  /** The engine's answer to the current offer (`signingTalkFor` / `renewalTalkFor`). */
  talk: NegotiationAnswer;
  /** The next offer (an empty offer = his ask). */
  onChange: (next: ContractOffer) => void;
  disabled?: boolean;
}) {
  const N = useCareerCopy().market.negotiation;
  const { zone, offer, ask } = talk;
  const atAsk = offer.sharePct === ask.sharePct && offer.bonus === ask.bonus && offer.weekly >= zone.topWeekly;
  const press = (lever: TalkLever, dir: 1 | -1) => talkPressFor(talk, lever, dir);
  const set = (lever: TalkLever) => (v: number) => onChange(talkSetFor(talk, lever, v));
  const money = (w: number) => formatMoney(w);
  const oddsPct = Math.round(talk.odds * 100);
  const sure = talk.odds >= 1;

  // The wage track: from the league minimum to his ask at this share and bonus.
  const wageMin = zone.minWeekly;
  const wageMax = Math.max(zone.minWeekly, zone.topWeekly);
  const wageStep = Math.max(1, Math.min(zone.stepWeekly, 10));

  return (
    <div className="rounded-lg border border-line bg-white/3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker flex items-center gap-1.5 text-[10px]">
          <HandshakeIcon className="h-3.5 w-3.5 text-cyan" />
          {N.title}
        </p>
        <button
          type="button"
          className="min-h-11 px-1 text-[11px] font-semibold text-cyan hover:underline disabled:opacity-40"
          onClick={() => onChange({})}
          disabled={disabled || atAsk}
        >
          {N.fullAsk}
        </button>
      </div>

      {/* The odds meter — the one thing to watch */}
      <div className="mt-1 flex items-center gap-2" role="meter" aria-label={N.odds} aria-valuenow={oddsPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            className={cx(
              "absolute inset-y-0 left-0 rounded-full transition-[width]",
              sure ? "bg-emerald-400" : oddsPct >= 50 ? "bg-amber-400" : "bg-rose-500",
            )}
            style={{ width: `${Math.max(2, oddsPct)}%` }}
          />
        </div>
        <span
          className={cx(
            "w-12 shrink-0 text-right text-sm font-bold tabular-nums",
            sure ? "text-emerald-400" : oddsPct >= 50 ? "text-amber-400" : "text-rose-400",
          )}
        >
          {sure ? N.oddsSure : `${oddsPct}%`}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-faint">{N.odds}</p>

      {/* Lever 1 — the weekly wage, its zone drawn on the track */}
      <TalkSlider
        label={N.wage}
        icon={<CoinsIcon className="h-3.5 w-3.5" />}
        value={offer.weekly}
        display={
          <>
            {money(offer.weekly)}
            <span className="ml-1 text-[10px] font-semibold text-faint">{N.perWeek}</span>
          </>
        }
        min={wageMin}
        max={wageMax}
        step={wageStep}
        marks={{
          bands: [
            [Math.max(wageMin, zone.zeroWeekly), zone.floorWeekly, "bg-gradient-to-r from-rose-500/25 to-amber-400/40"],
            [zone.floorWeekly, wageMax, "bg-emerald-400/40"],
          ],
          side: (
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/70" aria-hidden />
              {N.zoneLegend}
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400/60" aria-hidden />
              {N.riskLegend}
            </span>
          ),
        }}
        onSet={set("wage")}
        onPress={{ down: press("wage", -1), up: press("wage", 1), go: onChange }}
        pressLabels={{ down: N.wageDown, up: N.wageUp }}
        disabled={disabled}
      />

      {/* Lever 2 — the prize share (ECO-10): every player has it (rc.35), his ask is the tick */}
      {zone.shareLever ? (
        <TalkSlider
          label={N.share}
          icon={<PercentIcon className="h-3.5 w-3.5" />}
          value={offer.sharePct}
          display={`${offer.sharePct}%`}
          min={zone.shareMin}
          max={zone.shareMax}
          step={1}
          marks={{
            bands: [[zone.shareMin, offer.sharePct, "bg-cyan/40"]],
            tick: ask.sharePct,
            side: ask.sharePct > 0 ? N.shareAsk(ask.sharePct) : N.shareAskNone,
          }}
          onSet={set("share")}
          onPress={{ down: press("share", -1), up: press("share", 1), go: onChange }}
          pressLabels={{ down: N.shareDown, up: N.shareUp }}
          disabled={disabled}
        />
      ) : null}

      {/* Lever 3 — the signing bonus (rc.35) */}
      {zone.bonusMax > 0 ? (
        <TalkSlider
          label={N.bonus}
          icon={<GiftIcon className="h-3.5 w-3.5" />}
          value={offer.bonus}
          display={money(offer.bonus)}
          min={0}
          max={zone.bonusMax}
          step={zone.bonusStep}
          marks={{
            bands: [[0, offer.bonus, "bg-cyan/40"]],
            tick: ask.bonus,
            side: N.bonusAsk(money(ask.bonus)),
          }}
          onSet={set("bonus")}
          onPress={{ down: press("bonus", -1), up: press("bonus", 1), go: onChange }}
          pressLabels={{ down: N.bonusDown, up: N.bonusUp }}
          disabled={disabled}
        />
      ) : null}

      {zone.lengthReliefWeekly > 0 ? (
        <p className="mt-2 text-[10px] text-emerald-400/90">{N.lengthRelief(money(zone.lengthReliefWeekly), talk.lengthSeasons)}</p>
      ) : null}

      {/* The answer — readable before any confirm */}
      <div className="mt-3 border-t border-line pt-2 text-[11px]">
        {talk.accepted ? (
          <>
            <p className="font-bold text-emerald-400">
              ✓{" "}
              {talk.terms.sharePct > 0
                ? N.signs(money(talk.terms.weekly), talk.terms.sharePct)
                : N.signsNoShare(money(talk.terms.weekly))}
              {talk.terms.bonus > 0 ? ` ${N.upfront(money(talk.terms.bonus))}` : null}
            </p>
            {talk.savingWeekly !== 0 ? (
              <p className={cx("mt-0.5 font-semibold", talk.savingWeekly > 0 ? "text-emerald-400" : "text-amber-400")}>
                {talk.savingWeekly > 0 ? N.saves(money(talk.savingWeekly)) : N.costs(money(-talk.savingWeekly))}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-amber-400">↺ {N.refuses(money(talk.terms.weekly))}</p>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-amber-400/50 px-3 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
              onClick={() => onChange({ ...talk.offer, weekly: talk.terms.weekly })}
              disabled={disabled}
            >
              {N.takeCounter}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
