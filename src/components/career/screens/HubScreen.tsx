"use client";

/**
 * v2.0 hub rebuild (R26), re-cut in rc.2 and rc.34 (ROADMAP UX-01, HQ-CONTRACT
 * H1–H7): HQ around the next decision.
 *   main column — the DECISION block (hub/DecisionBlock: the next needed
 *                 decision from the one queue, or the clock — date, week
 *                 strip, play/pause · skip · +1 day) → the SQUAD as Draft
 *                 cards → the TRAINING block (DEV-03's) → the wire(s)
 *   side column — the race (+ the seeding line), finances, the toolbox,
 *                 season goal, inbox, next unlock.
 * On a phone the two columns interleave in the contract's H7 order. The
 * decision cards live in hub/NowCards.tsx, the clock in hub/DayCard.tsx — this
 * file is layout.
 */

/**
 * Road to Worlds — HQ (v0.2 rebuild): the game's living room. A NOW hero
 * (next stop / blocking decision, always dated), the week strip for the new
 * day clock, contextual quick actions, and THE WIRE — the full news feed with
 * body text — surrounded by tap-through consequence tiles (goal, race, squad,
 * budget, inbox, next unlock).
 *
 * Desktop: 2-col grid (main 2fr / side 1fr). Mobile: single column.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { useCopy } from "@/content/copy";
import { useCareerCopy, type CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { useSettings } from "@/store/settingsStore";
import { useMounted } from "@/store/useMounted";
import { REGION_BADGE } from "@/components/regionStyle";
import {
  dateOfDay,
  isWindowWeek,
  nameOfRef,
  useCareerSave,
  userTeamPreview,
  weekOfDay,
} from "@/components/career/careerUi";
import { formatDateTiny } from "@/components/career/dateText";
import { DecisionBlock } from "@/components/career/hub/DecisionBlock";
import { FinanceBlock } from "@/components/career/hub/FinanceBlock";
import { SquadBlock } from "@/components/career/hub/SquadBlock";
import { TrainingBlock } from "@/components/career/hub/TrainingBlock";
import { RaceBlock } from "@/components/career/hub/RaceBlock";
import { ToolboxBlock } from "@/components/career/hub/ToolboxBlock";
import { SeasonGoalBlock } from "@/components/career/hub/SeasonGoalBlock";
import { resolveMail } from "@/components/career/news/newsText";
import { NewsFeed } from "@/components/career/news/NewsFeed";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { ErrorBanner, withMoneyParams } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";

// rc.36 (UX-03): the wire — its filters, type icons and rows — lives in news/NewsFeed.tsx.

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function HubScreen() {
  const copy = useCopy();
  const C = useCareerCopy();
  const CHEM = copy.CHEM_TIERS;
  const D = C.dates;
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const save = useCareerSave();

  const markFlag = useCareerStore((s) => s.markFlag);

  const team = useMemo(() => (save ? userTeamPreview(save) : null), [save]);

  if (!mounted || !save || !team) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy>
          <div className="space-y-4 lg:col-span-2">
            <div className="h-60 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // --- inbox teaser -----------------------------------------------------------
  const unreadMail = save.mail.filter((m) => !m.read).length;
  const latestMail = save.mail.slice(0, 2);


  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <ErrorBanner />

      {/*
        rc.34 (HQ-CONTRACT H7): one column on a phone in the contract's order —
        decision → squad → training → race → finances → toolbox → goal → inbox →
        the wire → the transfer wire → next unlock (the two column wrappers are
        `display: contents` there, so `order` interleaves them); two columns on
        desktop: main (decision, squad, training, the wires) and side.
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
        {/* ============ main column (2fr) ============ */}
        <div className="contents lg:col-span-2 lg:block lg:space-y-4">
          {/* 1 — THE DECISION BLOCK: the next needed decision, or the clock (UX-01a) */}
          <div className="order-1">
            <DecisionBlock save={save} C={C} />
          </div>

          {/* 2 — THE SQUAD as Draft cards (UX-01b) + 3 — TRAINING (DEV-03's block) */}
          <div className="order-2">
            <SquadBlock save={save} C={C} team={team} chemTiers={CHEM} />
          </div>
          <div className="order-3">
            <TrainingBlock save={save} C={C} statLabels={copy.STAT_LABELS} />
          </div>

          {/* 9 — THE WIRE (rc.36, UX-03: the visual feed — lead story, crests, subject, action) */}
          <div className="order-9">
            <NewsFeed save={save} C={C} lang={lang} />
          </div>

          {/* 10 — v0.3 THE TRANSFER WIRE (window panel, region-filterable) */}
          <div className="order-10">
            <TransferWirePanel save={save} C={C} D={D} />
          </div>
        </div>

        {/* ============ side column (1fr) ============ */}
        <div className="contents lg:block lg:space-y-4">
          {/* 4 — RTW-01 (R49, UX-01d): the Major / Worlds race toggle + the seeding line (6-A) */}
          <div className="order-4">
            <RaceBlock save={save} C={C} />
          </div>

          {/* 5 — finances (UX-01e, decision 4-A) */}
          <div className="order-5">
            <FinanceBlock save={save} C={C} />
          </div>

          {/* 6 — progression + toolbox in one card (rc.35; UX-01f, 5-A, 7-A; UX-06a's unlock modal) */}
          <div className="order-6">
            <ToolboxBlock save={save} C={C} />
          </div>

          {/* 7 — season goal (rc.36, UX-02: progress, deadline and the board's reasons) */}
          {save.seasonGoals ? (
            <div className="order-7">
              <SeasonGoalBlock save={save} C={C} />
            </div>
          ) : null}

          {/* 8 — inbox teaser */}
          <div className="order-8">
            <AppLink href="/career/news" className="block">
              <Panel className="rise-in p-4 transition-colors hover:border-line-strong" style={{ animationDelay: "180ms" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="kicker text-[10px]">{C.hub.inboxTeaser}</p>
                  {unreadMail > 0 ? <Badge tone="orange">{C.mail.unread(unreadMail)}</Badge> : null}
                </div>
                {latestMail.length === 0 ? (
                  <p className="text-xs text-faint">{C.mail.empty}</p>
                ) : (
                  <ul>
                    {latestMail.map((m) => {
                      const r = resolveMail(withMoneyParams(m), C);
                      return (
                        <li key={m.id} className="flex items-start gap-2 border-b border-line py-1.5 last:border-0">
                          <span
                            className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", m.read ? "bg-white/15" : "bg-orange")}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cx("truncate text-xs", m.read ? "text-sub" : "font-semibold text-ink")}>{r.title}</p>
                            <p className="text-[10px] text-faint">
                              {r.from} · {formatDateTiny(D, dateOfDay(m.seasonIndex, m.day))}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 text-right text-xs font-semibold text-blue-bright">{C.hub.inboxAll}</p>
              </Panel>
            </AppLink>
          </div>

        </div>
      </div>

      {/* First-visit explainer (one-shot). */}
      <Modal
        open={!save.flags["seenHub"]}
        title={C.explainers.hub.title}
        onClose={() => markFlag("seenHub")}
        actions={
          <Button variant="primary" onClick={() => markFlag("seenHub")}>
            {C.explainers.gotIt}
          </Button>
        }
      >
        {C.explainers.hub.body}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// v0.3 — THE TRANSFER WIRE (window panel: every move, all regions, filterable)
// ---------------------------------------------------------------------------

const TRANSFER_PREVIEW = 6;
/** Keep the wire visible this many days past the last logged move. */
const TRANSFER_LINGER_DAYS = 14;

function TransferWirePanel({
  save,
  C,
  D,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
}) {
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  const seasonMoves = save.transferLog.filter(
    (t) => t.seasonIndex === save.clock.seasonIndex,
  );
  const windowOpen = isWindowWeek(weekOfDay(save.clock.day));
  const recent = seasonMoves.some((t) => save.clock.day - t.day <= TRANSFER_LINGER_DAYS);
  if (!windowOpen && !recent) return null;

  const filtered =
    regionFilter === "all"
      ? seasonMoves
      : seasonMoves.filter((t) => t.region === regionFilter);
  const shownMoves = expanded ? filtered : filtered.slice(0, TRANSFER_PREVIEW);

  const orgCell = (ref: string | null) => {
    if (!ref) {
      return (
        <span className="display text-[10px] font-bold uppercase tracking-[0.1em] text-good">
          {C.hub.transfersFa}
        </span>
      );
    }
    const tappable = ref !== "user" && Boolean(save.world.orgs[ref]);
    const body = (
      <>
        <OrgMark save={save} orgRef={ref} size="xs" />
        <span className="max-w-24 truncate">{nameOfRef(save, ref)}</span>
      </>
    );
    if (!tappable) {
      return <span className="flex min-w-0 items-center gap-1 text-sub">{body}</span>;
    }
    return (
      <button
        type="button"
        title={C.orgSheet.viewTeam}
        onClick={() => setSheetRef(ref)}
        className="flex min-w-0 items-center gap-1 text-sub transition-colors hover:text-ink"
      >
        {body}
      </button>
    );
  };

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "140ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker text-[10px]">
          {C.hub.transfersTitle}
          <span className="ml-2 font-normal normal-case tracking-normal text-faint">
            {C.hub.transfersWire}
          </span>
        </p>
        {windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", ...Object.keys(REGION_BADGE)].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegionFilter(r)}
            aria-pressed={regionFilter === r}
            className={cx(
              "display inline-flex min-h-9 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
              regionFilter === r
                ? r === "all"
                  ? "border-blue/50 bg-blue/15 text-blue-bright"
                  : REGION_BADGE[r as keyof typeof REGION_BADGE]
                : "border-line-strong bg-white/5 text-sub hover:text-ink",
            )}
          >
            {r === "all" ? C.hub.transfersAll : r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-faint">{C.hub.transfersEmpty}</p>
      ) : (
        <ul className="space-y-1.5">
          {shownMoves.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-xs"
            >
              <span className="w-12 shrink-0 text-[10px] text-faint">
                {formatDateTiny(D, dateOfDay(t.seasonIndex, t.day))}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                {t.playerName}
              </span>
              <span className="flex min-w-0 items-center gap-1">
                {orgCell(t.fromRef)}
                <span className="text-faint" aria-hidden>
                  →
                </span>
                {orgCell(t.toRef)}
              </span>
              {t.kind === "userIn" || t.kind === "userOut" ? (
                <Badge tone="orange">{C.hub.transfersUser}</Badge>
              ) : null}
              {t.fee > 0 ? (
                <span className="shrink-0 font-semibold text-orange-bright">
                  {formatMoney(t.fee, { compact: true })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!expanded && filtered.length > TRANSFER_PREVIEW ? (
        <div className="mt-2 text-center">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>
            {C.hub.transfersShowAll(filtered.length)}
          </Button>
        </div>
      ) : null}

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// NOW card variants
// ---------------------------------------------------------------------------
