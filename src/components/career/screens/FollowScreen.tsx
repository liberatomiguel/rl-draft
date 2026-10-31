"use client";

/**
 * Road to Worlds rc.36 (SUN-03, R88) — /career/follow: the rest of an event
 * the user is OUT of (their regional after a lost Saturday qualifier, or a
 * Major / Worlds they are not in), from the compact copy the flow keeps when
 * it resolves (`save.followEvent`, engine/career/follow.ts).
 *
 *   Watch    the rounds revealed one at a time (a Swiss round, then each
 *            playoff round) every CAREER_SUNDAY.followRoundMs × the
 *            animation-speed scale; pause, next round or skip to the results.
 *            Reduced motion: no timer, a "Next round" button.
 *   Results  everything at once: the champion, the Swiss table, the bracket
 *            rounds and the final standings (placement, points, prize).
 *
 * Who is in (the field, the "Q" of Saturday's qualifier) heads both. Nothing
 * here touches a result: it was banked when the event resolved.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CAREER_SUNDAY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { followRoundsOf, followWinnerOf } from "@/engine/career/follow";
import { prizeFor } from "@/engine/career/economy";
import type { CareerSave, FollowEventState, FollowSeries } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { ANIM_SCALE, useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { playoffsDayFor } from "@/engine/career/calendar";
import { dateOfDay, useCareerSave } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { EventTierIcon, TIER_ICON_TONE } from "@/components/career/event/EventTierIcon";
import { placementRankOf } from "@/components/career/event/eventPlayback";
import { placementLabelOf } from "@/components/career/event/weekendView";
import { TierChip, maxPointsOf } from "@/components/career/hub/hubShared";
import { OrgMark } from "@/components/career/OrgMark";
import { REGION_BADGE } from "@/components/regionStyle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TrophyIcon } from "@/components/ui/icons";
import { CareerBracket } from "@/components/career/event/CareerBracket";
import { CareerSwissStandings } from "@/components/career/event/CareerSwissStandings";
import { followBoardOf } from "@/components/career/event/followView";
import { Panel, SectionTitle } from "@/components/ui/Panel";

export function FollowScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const C = useCareerCopy();
  const router = useRouter();
  const f = save?.followEvent ?? null;

  if (!mounted || !save) return <div className="min-h-[60vh]" aria-busy />;
  if (!f) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-10 sm:px-4">
        <Panel className="rise-in p-8 text-center">
          <p className="kicker">{C.follow.kicker}</p>
          <p className="mt-2 text-sm text-sub">{C.follow.nothing}</p>
          <Button variant="primary" className="mt-5" onClick={() => router.push("/career")}>
            {C.follow.backToHq}
          </Button>
        </Panel>
      </div>
    );
  }
  // Keyed on the event: a new followed event starts its own playback.
  return <FollowView key={f.def.id} save={save} f={f} />;
}

function FollowView({ save, f }: { save: CareerSave; f: FollowEventState }) {
  const C = useCareerCopy();
  const T = useCopy().TOURNAMENT_UI;
  const router = useRouter();
  const dismissFollow = useCareerStore((s) => s.dismissFollow);
  const reduced = useOsReducedMotion();
  const animSpeed = useSettings((s) => s.animSpeed);

  const rounds = useMemo(() => followRoundsOf(f), [f]);
  const total = rounds.length;
  const mode = f.view ?? "watch";
  const [shown, setShown] = useState(mode === "results" ? total : 0);
  const [playing, setPlaying] = useState(!reduced);
  const revealed = mode === "results" ? total : shown;
  const done = revealed >= total;

  // Watch: one round every followRoundMs (× the animation-speed scale); never under reduced motion.
  useEffect(() => {
    if (mode !== "watch" || !playing || reduced || shown >= total) return;
    const ms = Math.round(CAREER_SUNDAY.followRoundMs * ANIM_SCALE[animSpeed]);
    const timer = window.setTimeout(() => setShown((n) => Math.min(total, n + 1)), ms);
    return () => window.clearTimeout(timer);
  }, [mode, playing, reduced, shown, total, animSpeed]);

  const board = followBoardOf(f, revealed);
  const showPlayoffs = board.swissShown >= f.swiss.length && f.playoffs.length > 0;
  const current = revealed > 0 ? rounds[revealed - 1] : null;
  const qualified = new Set(f.qualifiedIds);
  const nameOf = (id: string) => f.teams.find((t) => t.id === id)?.name ?? id;
  const result = save.eventResults.find((r) => r.eventId === f.def.id) ?? null;
  const labels = { placement: C.common.placement, qualifierOutcome: C.common.qualifierOutcome };
  const showPoints = maxPointsOf(f.def.tier) !== null;
  const roundTitle = (label: number | string) =>
    typeof label === "number" ? C.follow.swissRound(label) : (T.roundNames[label] ?? label);

  // who is in
  const fieldPanel = (
    <Panel className="rise-in p-4" style={{ animationDelay: "40ms" }}>
      <p className="kicker mb-2.5 text-[10px]">{C.follow.field}</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {f.teams.map((t) => (
          <li key={t.id} className="flex min-w-0 items-center gap-1.5 text-xs">
            <OrgMark save={save} orgRef={t.id} size="xs" className="shrink-0" />
            <span className="min-w-0 truncate text-ink" title={t.name}>
              {t.name}
            </span>
            {qualified.has(t.id) ? (
              <span title={C.event.qualifiedTagHint} className="display shrink-0 rounded bg-cyan/20 px-1 text-[9px] font-bold text-cyan">
                {C.event.qualifiedTag}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
  // the round just revealed (watch)
  const roundPanel =
    mode === "watch" && current?.stage === "swiss" && !done ? (
      <Panel key={current.key} className="pop-in p-4">
        <p className="kicker mb-2.5 text-[10px] text-cyan">{roundTitle(current.label)}</p>
        <SeriesList save={save} f={f} series={current.series} />
      </Panel>
    ) : null;
  // The same standings and bracket used in a played event, with reveal-safe records.
  const boards = (
    <div className={cx("grid items-start gap-4", f.swiss.length > 0 && showPlayoffs && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
      {showPlayoffs ? <div className="min-w-0"><CareerBracket save={save} t={board.tournament} revealed={board.revealed} liveKey={null} showUpcoming={false} layout="wide" /></div> : null}
      {f.swiss.length > 0 ? <div className="min-w-0"><CareerSwissStandings title={C.follow.swissStandings} save={save} t={board.tournament} records={board.records} throughRound={board.swissShown} /></div> : null}
    </div>
  );
  // the readable results: placement, points, prize
  const resultsPanel =
    done && result ? (
      <Panel className="rise-in p-4">
        <p className="kicker mb-2.5 text-[10px]">{C.follow.results}</p>
        <table className="w-full table-fixed text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-faint">
              <th className="hidden w-32 pb-1.5 font-semibold sm:table-cell" scope="col">{C.event.digestPlacement}</th>
              <th className="pb-1.5 font-semibold" scope="col">{T.team}</th>
              {showPoints ? (
                <th className="w-12 pb-1.5 text-right font-semibold" scope="col">{C.standings.ptsShort}</th>
              ) : null}
              <th className="w-16 pb-1.5 text-right font-semibold" scope="col">{C.common.prize}</th>
            </tr>
          </thead>
          <tbody>
            {[...result.rows]
              .sort((a, b) => placementRankOf(a.placement) - placementRankOf(b.placement))
              .map((row) => {
                const label = placementLabelOf(labels, f.def.tier, row.placement);
                const prize = row.prize || prizeFor(f.def.tier, row.placement, f.def.format, save.difficulty, f.def.seasonIndex);
                return (
                  <tr key={row.ref} className={cx("border-t border-line", row.placement === "champion" && "bg-amber-400/5")}>
                    <td className="hidden truncate py-1.5 pr-2 text-sub sm:table-cell" title={label}>
                      {label}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <OrgMark save={save} orgRef={row.ref} size="xs" className="shrink-0" />
                        <span className="min-w-0 truncate text-ink">{row.name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-tight text-sub sm:hidden">{label}</span>
                    </td>
                    {showPoints ? (
                      <td className="display py-1.5 text-right font-bold text-cyan">{row.points > 0 ? row.points : "—"}</td>
                    ) : null}
                    <td className="display py-1.5 text-right font-bold text-ink">
                      {prize > 0 ? formatMoney(prize, { compact: true }) : "—"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Panel>
    ) : null;

  const back = () => {
    dismissFollow();
    router.push("/career");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-5 sm:px-4">
      <SectionTitle kicker={C.follow.kicker} title={f.def.name} />

      {/* header: the event, why the user follows from outside, the champion once revealed */}
      <Panel className="rise-in p-4 sm:p-5">
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/[0.04]">
            <EventTierIcon tier={f.def.tier} className={cx("h-5 w-5", TIER_ICON_TONE[f.def.tier])} />
          </span>
          <TierChip tier={f.def.tier} />
          {f.def.region ? <Badge className={REGION_BADGE[f.def.region]}>{f.def.region}</Badge> : null}
          <Badge tone="blue">{f.reason === "eliminated" ? C.follow.reasonEliminated : C.follow.reasonNotQualified}</Badge>
          <span className="text-[11px] text-faint">
            {formatDateShort(C.dates, dateOfDay(f.def.seasonIndex, playoffsDayFor(f.def)))} · {C.follow.teams(f.teams.length)}
          </span>
        </div>
        {done && f.champion ? (
          <div className="pop-in relative mt-4 flex items-center gap-4 rounded-xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-4">
            <TrophyIcon className="h-6 w-6 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="kicker !text-[9px] text-amber-300">{C.follow.champion}</p>
              <p className="flex min-w-0 items-center gap-2">
                <OrgMark save={save} orgRef={f.champion} size="sm" className="shrink-0" />
                <span className="display min-w-0 truncate text-2xl font-bold uppercase tracking-wide text-ink">
                  {nameOf(f.champion)}
                </span>
              </p>
            </div>
          </div>
        ) : null}

        {mode === "watch" ? (
          <div className="relative mt-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-sub">{C.follow.progress(revealed, total)}</span>
              {current ? <span className="text-faint">{roundTitle(current.label)}</span> : null}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full origin-left rounded-full bg-white/30 transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `scaleX(${total ? revealed / total : 0})` }}
              />
            </div>
            {!done ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {reduced ? (
                  <Button variant="secondary" size="md" className="min-h-11" onClick={() => setShown((n) => Math.min(total, n + 1))}>
                    {C.follow.nextRound}
                  </Button>
                ) : (
                  <Button variant="secondary" size="md" className="min-h-11" onClick={() => setPlaying((p) => !p)}>
                    {playing ? C.follow.pause : C.follow.play}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-faint" onClick={() => setShown(total)}>
                  {C.follow.skipToResults}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {boards}
      {roundPanel}
      {resultsPanel}
      {fieldPanel}

      <div className="flex justify-center pb-2">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={back}>
          {C.follow.backToHq}
        </Button>
      </div>
    </div>
  );
}

/** One round's series: the two sides with crests and the score; the winner reads bold. */
function SeriesList({ save, f, series }: { save: CareerSave; f: FollowEventState; series: FollowSeries[] }) {
  const nameOf = (id: string) => f.teams.find((t) => t.id === id)?.name ?? id;
  return (
    <ul className="space-y-1.5">
      {series.map((s) => {
        const winner = followWinnerOf(s);
        return (
          <li key={`${s.a}-${s.b}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <OrgMark save={save} orgRef={s.a} size="xs" className="shrink-0" />
              <span className={cx("min-w-0 truncate", winner === s.a ? "font-bold text-ink" : "text-sub")}>{nameOf(s.a)}</span>
            </span>
            <span className="display shrink-0 rounded bg-black/30 px-2 py-0.5 text-sm font-bold tabular-nums text-ink">
              {s.sa}–{s.sb}
            </span>
            <span className="flex min-w-0 items-center justify-end gap-1.5">
              <span className={cx("min-w-0 truncate text-right", winner === s.b ? "font-bold text-ink" : "text-sub")}>{nameOf(s.b)}</span>
              <OrgMark save={save} orgRef={s.b} size="xs" className="shrink-0" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
