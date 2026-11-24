"use client";

/**
 * v2.1: "Today's best draft" under a finished Daily. Shown only on the results
 * screen, so it never spoils a day still being drafted. The analysis
 * (engine/dailyOptimal) is read-only and runs in short slices after the
 * results have painted, so a phone never stalls on it.
 */

import { useEffect, useMemo, useState } from "react";
import { useCopy } from "@/content/copy";
import { resolvePick } from "@/engine/cards";
import {
  DAILY_INSIGHT,
  DailyDraftStepper,
  createDailySolver,
  distributionValue,
  referenceDraft,
  summarizeDailyInsight,
  type DailyDraftAction,
  type DailyInsight,
  type DailyStart,
} from "@/engine/dailyOptimal";
import type { Roster, RosterSlotId, RunState } from "@/engine/types";
import { trackEvent } from "@/lib/analytics";
import { generateDailyConfig } from "@/lib/daily";
import { cx } from "@/lib/util";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

/** Wall-clock slice per tick, ms: well under a frame budget on a phone. */
const SLICE_MS = 10;
const SLOTS: RosterSlotId[] = ["player1", "player2", "player3", "coach", "sub", "org"];

/** One "shown" event per Daily per page load (remounts do not repeat it). */
const shownDailies = new Set<string>();

type State =
  | { status: "working" }
  | { status: "done"; insight: DailyInsight; ms: number }
  | { status: "failed" };

export function DailyOptimalPanel({ run }: { run: RunState }) {
  const { DAILY_INSIGHT_UI: D, DRAFT_UI } = useCopy();
  const daily = run.daily;
  const roster = run.draft.roster;
  const [state, setState] = useState<State>({ status: "working" });
  const [showLine, setShowLine] = useState(false);
  const [copied, setCopied] = useState(false);
  const rosterKey = JSON.stringify(roster);

  useEffect(() => {
    if (!daily) return;
    const date = daily.date;
    const start: DailyStart = { rules: generateDailyConfig(date), date, seed: run.seed };
    const finishedRoster = JSON.parse(rosterKey) as Roster;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const t0 = performance.now();
    let stepper: DailyDraftStepper | undefined;
    let solver: ReturnType<typeof createDailySolver> | undefined;
    const ratings: number[] = [];
    let policy = 1;

    const tick = () => {
      if (cancelled) return;
      try {
        stepper ??= new DailyDraftStepper(start);
        solver ??= createDailySolver(start, undefined, stepper);
        const sliceEnd = performance.now() + SLICE_MS;
        while (performance.now() < sliceEnd) {
          if (!solver.done) {
            solver.step(150);
            continue;
          }
          if (policy <= DAILY_INSIGHT.referenceDrafts) {
            ratings.push(distributionValue(referenceDraft(start, policy, stepper).score));
            policy++;
            continue;
          }
          ratings.sort((a, b) => a - b);
          const insight = summarizeDailyInsight(solver.result(), finishedRoster, start.rules, {
            source: "simulated",
            ratings,
          });
          const ms = Math.round(performance.now() - t0);
          setState({ status: "done", insight, ms });
          if (!shownDailies.has(date)) {
            shownDailies.add(date);
            trackEvent("daily_insight", insightEvent("shown", daily.n, daily.templateId ?? "unknown", insight, ms));
          }
          return;
        }
        timer = setTimeout(tick, 0);
      } catch {
        setState({ status: "failed" });
      }
    };
    // Let the results screen paint first.
    timer = setTimeout(tick, 250);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [daily, run.seed, rosterKey]);

  const slotLabel = (slot: RosterSlotId) =>
    slot === "coach" ? DRAFT_UI.slotCoach
      : slot === "sub" ? DRAFT_UI.slotSub
        : slot === "org" ? DRAFT_UI.slotOrg
          : DRAFT_UI.slotPlayer(Number(slot.slice(-1)));

  const bestCards = useMemo(
    () => (state.status === "done" ? resolveRoster(state.insight.optimal.roster) : null),
    [state],
  );
  const yourCards = useMemo(() => resolveRoster(roster), [roster]);

  if (!daily) return null;
  const cap = daily.objective?.type === "team_overall_under" ? daily.objective.value : undefined;

  if (state.status === "failed") {
    return (
      <Panel className="mb-8 p-5">
        <p className="kicker mb-1">{D.kicker}</p>
        <p className="text-sm text-sub">{D.error}</p>
      </Panel>
    );
  }

  if (state.status === "working" || !bestCards) {
    return (
      <Panel className="mb-8 p-5" aria-busy="true">
        <p className="kicker mb-1">{D.kicker}</p>
        <h2 className="display text-lg font-bold uppercase tracking-wide text-ink">{D.title}</h2>
        <p className="mt-2 animate-pulse text-sm text-sub">{D.working}</p>
      </Panel>
    );
  }

  const { insight } = state;
  const gapText = insight.gap.toFixed(1);
  const players = insight.distribution.source === "players";
  const shareText = insight.matched
    ? D.shareTextMatched(daily.n)
    : D.shareText(daily.n, insight.percentile, gapText);

  const onShare = async () => {
    trackEvent("daily_insight", insightEvent("shared", daily.n, daily.templateId ?? "unknown", insight, null));
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Cancelled share sheet or no clipboard access: nothing to do.
    }
  };

  return (
    <Panel glow={insight.matched ? "orange" : undefined} className="mb-8 p-4 sm:p-5" data-testid="daily-optimal">
      <p className="kicker mb-1">{D.kicker}</p>
      <h2 className="display text-lg font-bold uppercase tracking-wide text-ink">{D.title}</h2>
      <p className="mt-1 text-xs text-sub">{cap !== undefined ? D.introCapped(cap) : D.intro}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-4">
        <RosterColumn
          title={D.yours}
          cards={yourCards}
          score={insight.yours}
          slotLabel={slotLabel}
          diffAgainst={bestCards}
          copy={D}
        />
        <RosterColumn
          title={D.best}
          cards={bestCards}
          score={insight.optimal.score}
          slotLabel={slotLabel}
          diffAgainst={yourCards}
          highlight
          copy={D}
        />
      </div>

      <div className="mt-4 space-y-1 text-sm">
        {!insight.yours.eligible && cap !== undefined ? (
          <p className="font-semibold text-amber-300">{D.overCap(cap)}</p>
        ) : insight.matched ? (
          <p className="font-semibold text-orange-bright">{D.matched}</p>
        ) : (
          <p className="font-semibold text-ink">{D.gap(gapText)}</p>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="display font-bold uppercase tracking-wide text-ink">
            {players ? D.percentilePlayers(insight.percentile) : D.percentile(insight.percentile)}
          </span>
        </div>
        <ProgressBar value={insight.percentile / 100} tone="orange" label={D.percentile(insight.percentile)} />
        <p className="mt-2 text-[11px] leading-snug text-faint">
          {players ? D.percentileNotePlayers : D.percentileNote(insight.distribution.ratings.length)}
        </p>
      </div>

      {insight.optimal.actions.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            className="text-xs font-semibold text-blue-bright underline-offset-2 hover:underline"
            aria-expanded={showLine}
            onClick={() => setShowLine((v) => !v)}
          >
            {showLine ? D.hideLine : D.showLine}
          </button>
          {showLine ? (
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-sub">
              {insight.optimal.actions.map((a, i) => (
                <li key={i}>{stepLabel(a, bestCards, slotLabel, D)}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void onShare()}>
          {copied ? D.copied : D.share}
        </Button>
      </div>
    </Panel>
  );
}

type Copy = ReturnType<typeof useCopy>["DAILY_INSIGHT_UI"];
type Resolved = Partial<Record<RosterSlotId, { key: string; name: string; overall?: number; special: boolean; season?: string }>>;

function resolveRoster(roster: Roster): Resolved {
  const out: Resolved = {};
  for (const slot of SLOTS) {
    const pick = roster[slot];
    if (!pick) continue;
    const card = resolvePick(pick);
    out[slot] = {
      key: `${pick.refId}|${pick.specialId ?? ""}`,
      name: card.kind === "org" ? (card.orgName ?? card.name) : card.name,
      overall: card.special?.overall ?? card.overall,
      special: Boolean(card.special),
      // Same player, different card (another season) must read as different.
      season: card.seasonShort,
    };
  }
  return out;
}

function stepLabel(a: DailyDraftAction, cards: Resolved, slotLabel: (s: RosterSlotId) => string, D: Copy): string {
  if (a.kind === "reroll") return D.stepReroll;
  if (a.kind === "freeReroll") return D.stepFreeReroll;
  return D.stepPick(cards[a.slot]?.name ?? a.refId, slotLabel(a.slot));
}

function RosterColumn({
  title,
  cards,
  score,
  slotLabel,
  diffAgainst,
  highlight,
  copy: D,
}: {
  title: string;
  cards: Resolved;
  score: DailyInsight["yours"];
  slotLabel: (s: RosterSlotId) => string;
  diffAgainst: Resolved;
  highlight?: boolean;
  copy: Copy;
}) {
  // Player slots are interchangeable: a player counts as shared when the
  // other roster has the same card in any player slot.
  const otherPlayers = new Set(["player1", "player2", "player3"].map((s) => diffAgainst[s as RosterSlotId]?.key));
  return (
    <div className={cx("min-w-0 rounded-lg border p-2 sm:p-3", highlight ? "border-orange/40 bg-orange/5" : "border-white/10 bg-white/[0.02]")}>
      <p className={cx("display text-xs font-bold uppercase tracking-wider", highlight ? "text-orange-bright" : "text-ink")}>{title}</p>
      <p className="mt-0.5 text-[11px] text-sub">
        {D.overall(score.overall)} · {D.chemistry(score.chemistry)}
      </p>
      <p className="text-[11px] text-faint">
        {D.rating} {score.rating.toFixed(1)}
      </p>
      <ul className="mt-2 space-y-1">
        {SLOTS.map((slot) => {
          const c = cards[slot];
          const isPlayer = slot.startsWith("player");
          const same = c && (isPlayer ? otherPlayers.has(c.key) : diffAgainst[slot]?.key === c.key);
          return (
            <li key={slot} className="min-w-0">
              <span className="block truncate text-[9px] uppercase tracking-wider text-faint">
                {slotLabel(slot)}
                {c?.season ? ` · ${c.season}` : ""}
              </span>
              <span className="flex min-w-0 items-baseline justify-between gap-1">
                <span
                  className={cx("truncate text-xs", same ? "text-sub" : "font-semibold text-ink")}
                  title={c?.name}
                >
                  {c?.special ? "★ " : ""}
                  {c?.name ?? "—"}
                </span>
                {c?.overall !== undefined ? <span className="shrink-0 text-[11px] tabular-nums text-faint">{c.overall}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function insightEvent(action: "shown" | "shared", n: number, template: string, insight: DailyInsight, ms: number | null) {
  return {
    action,
    dailyNumber: n,
    dailyTemplate: template,
    percentile: insight.percentile,
    percentileSource: insight.distribution.source,
    gap: insight.gap,
    matched: insight.matched,
    teamOverall: insight.yours.overall,
    bestOverall: insight.optimal.score.overall,
    computeMs: ms,
  };
}
