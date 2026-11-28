"use client";
import { NowFollow } from "../hub/SundayCard";
import { followCardOf } from "@/store/careerSunday";
import { CareerHonorsTable } from "../CareerHonorsTable";
import { NowLocker } from "@/components/career/locker/NowLocker"; // v2.3 UI

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
 *
 * Hierarchy (DESIGN.md): three weights, not ten equal boards.
 *   1. the day card: the one strong board, the largest type, the one filled
 *      button of the screen;
 *   2. the team board (squad and training, one board, a hairline between)
 *      and the wire under it;
 *   3. the side rail: sections with no box, a hairline between them (the
 *      race, finances, progression, the season goal, the inbox, transfers).
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { useCopy } from "@/content/copy";
import type { CareerCopy } from "@/content/careerCopy";
import { SavesNotice } from "@/components/career/hub/SavesNotice";
import type { CareerSave } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
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
import { HubGlance } from "@/components/career/hub/HubGlance";
import { FinanceBlock } from "@/components/career/hub/FinanceBlock";
import { SquadBlock } from "@/components/career/hub/SquadBlock";
import { TrainingBlock } from "@/components/career/hub/TrainingBlock";
import { RaceBlock } from "@/components/career/hub/RaceBlock";
import { ToolboxBlock } from "@/components/career/hub/ToolboxBlock";
import { OperationsBlock } from "@/components/career/hub/OperationsBlock";
import { useActiveCareerCopy } from "@/components/career/orgCopy";
import { establishedOf } from "@/engine/career/established";
import { SeasonGoalBlock } from "@/components/career/hub/SeasonGoalBlock";
import { HubPlayerStats } from "@/components/career/hub/HubPlayerStats";
import { WeeklyScrimLine } from "@/components/career/hub/WeeklyScrimLine";
import { ICON_TONE, MailKindIcon } from "../news/MailKindIcon";
import { resolveMail } from "@/components/career/news/newsText";
import { NewsFeed } from "@/components/career/news/NewsFeed";
import { OrgMark } from "@/components/career/OrgMark";
import { OrgSheet } from "@/components/career/OrgSheet";
import { BLOCK_LINK, ErrorBanner, RAIL_HEAD, RAIL_SECTION, RAIL_TITLE, withMoneyParams } from "@/components/career/hub/hubShared";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

// rc.36 (UX-03): the wire — its filters, type icons and rows — lives in news/NewsFeed.tsx.

type DatesCopy = CareerCopy["dates"];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

// HQ's job: show where the season stands today. The one decision made here: play or advance the day (the day card).
export function HubScreen() {
  const copy = useCopy();
  const C = useActiveCareerCopy();
  const CHEM = copy.CHEM_TIERS;
  const D = C.dates;
  const lang = useSettings((s) => s.lang);
  const mounted = useMounted();
  const save = useCareerSave();


  const team = useMemo(() => (save ? userTeamPreview(save) : null), [save]);

  if (!mounted || !save || !team) {
    // Loading: the shapes of the day card, the team board and three rail sections.
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-x-8" aria-busy>
          <div className="space-y-4 lg:col-span-2">
            <div className="h-72 animate-pulse rounded-xl bg-white/5" />
            <div className="h-96 animate-pulse rounded-xl bg-white/5" />
          </div>
          <div className="space-y-5">
            <div className="h-44 animate-pulse rounded-xl bg-white/5" />
            <div className="h-36 animate-pulse rounded-xl bg-white/5" />
            <div className="h-40 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // --- inbox teaser -----------------------------------------------------------
  const unreadMail = save.mail.filter((m) => !m.read).length;
  const latestMail = save.mail.slice(0, 2);
  const follow = save.phase === "seasonReview" ? followCardOf(save) : null;


  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
      <ErrorBanner />
      <SavesNotice clock={save.clock} startSeasonIndex={save.startSeasonIndex ?? 0} />

      {/*
        rc.34 (HQ-CONTRACT H7): one column on a phone in the contract's order —
        decision → squad → training → race → finances → toolbox → goal → inbox →
        the wire → the transfer wire → next unlock (the two column wrappers are
        `display: contents` there, so `order` interleaves them); two columns on
        desktop: main (decision, squad, training, the wires) and side.

        Mobile redesign (24/11, after Miguel played stage 3's folded sections):
        under 640px HQ holds only what matters today, every block open: the day
        card, the inbox, the glance board (`HubGlance`: squad, training, race and
        finances as one figure each, two to a row, plus the progression line;
        each cell opens its tab), the season goal and the wire's headline. The
        full squad, training, race, finance and toolbox blocks, the transfer
        wire and the honours are `max-sm:hidden` here: each lives whole in its
        own tab, which is where a phone reads it.
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
        {/* ============ main column (2fr) ============ */}
        <div className="contents lg:col-span-2 lg:block lg:space-y-4">
          {/* 1 — THE DECISION BLOCK: the next needed decision, or the clock (UX-01a).
              The screen's focal point: the only strong board and the only filled button. */}
          <div data-tour="hub-day" className="order-1">
            {follow ? <Panel className="mb-4 p-4 sm:p-5"><NowFollow save={save} C={C} out={null} follow={follow} /></Panel> : null}
            <DecisionBlock save={save} C={C} />
            {/* v2.3 UI: the locker room, only when it needs him (empty: no box, no gap). rc9 STORIES: the manager's post moved into the decision block. */}
            <div className="mt-4 space-y-4 empty:hidden"><NowLocker save={save} C={C} /></div>
          </div>

          {/* 2 — THE SQUAD as Draft cards (UX-01b) + 3 — TRAINING (DEV-03's block):
              one team board, a hairline between the two (they are one subject). */}
          <HubGlance save={save} C={C} team={team} chemTiers={CHEM} className="order-3" />
          <Panel className="order-2 max-sm:hidden">
            <SquadBlock save={save} C={C} team={team} chemTiers={CHEM} />
            <div data-tour="hub-training" className="border-t border-line">
              <TrainingBlock save={save} C={C} statLabels={copy.STAT_LABELS} />
              {/* rc9 HQ (#240): the cycle's growth and the week's scrims, under the plan they come from. */}
              <WeeklyScrimLine save={save} C={C} className="border-t border-line px-4 py-4 sm:px-5" />
            </div>
          </Panel>

          {/* rc9 HQ (#244): the season's player stats, on a phone too (Miguel: "no HQ também devemos ver as estatísticas"):
              there it follows the season goal (order 7) and comes before the wire (9). */}
          <HubPlayerStats save={save} C={C} className="order-8" />

          {/* 9 — THE WIRE (rc.36, UX-03: the visual feed — lead story, crests, subject, action) */}
          <div className="hq-wire order-9">
            <NewsFeed save={save} C={C} lang={lang} />
          </div>


        </div>

        {/* ============ side rail (1fr): sections on the floor, a hairline between them ============ */}
        <div className="contents lg:block lg:space-y-4">
          {/* 4 — RTW-01 (R49, UX-01d): the Major / Worlds race toggle + the seeding line (6-A) */}
          <div className={cx("order-4 max-sm:hidden", RAIL_SECTION)}>
            <RaceBlock save={save} C={C} />
          </div>

          {/* 5 — finances (UX-01e, decision 4-A) */}
          <div data-tour="hub-finances" className={cx("order-5 max-sm:hidden", RAIL_SECTION)}>
            <FinanceBlock save={save} C={C} />
          </div>

          {/* 6 — progression + toolbox in one section (rc.35; UX-01f, 5-A, 7-A; UX-06a's unlock modal) */}
          <div data-tour="hub-progress" className={cx("order-6 max-sm:hidden", RAIL_SECTION)}>
            {/* rc.6 (ORGMODE UI-C): an established org runs operations; a founded club climbs the ladder. */}
            {establishedOf(save) ? <OperationsBlock save={save} C={C} /> : <ToolboxBlock save={save} C={C} />}
          </div>

          {/* 7 — season goal (rc.36, UX-02: progress, deadline and the board's reasons) */}
          {save.seasonGoals ? (
            <div className={cx("order-7 empty:hidden", RAIL_SECTION)}>
              <SeasonGoalBlock save={save} C={C} />
            </div>
          ) : null}

          {/* 8 — inbox teaser: the two latest, the whole section opens the inbox */}
          <div data-tour="hub-inbox" className={cx("order-8 max-sm:order-2", RAIL_SECTION)}>
            <AppLink href="/career/news" className="group block">
              <div className={RAIL_HEAD}>
                <h3 className={RAIL_TITLE}>{C.hub.inboxTeaser}</h3>
                {unreadMail > 0 ? <Badge tone="orange">{C.mail.unread(unreadMail)}</Badge> : null}
              </div>
              {latestMail.length === 0 ? (
                <p className="mt-2 text-sm leading-snug text-sub">{C.mail.empty}</p>
              ) : (
                <ul className="mt-1">
                  {latestMail.map((m) => {
                    const r = resolveMail(withMoneyParams(m), C);
                    return (
                      <li key={m.id} className="flex items-start gap-2.5 border-b border-line py-2.5">
                        <span className={cx("relative mt-0.5 shrink-0", ICON_TONE[m.kind])}><MailKindIcon kind={m.kind} className="h-4 w-4" />{!m.read ? <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-orange" /> : null}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cx("line-clamp-2 text-sm leading-snug", m.read ? "text-sub" : "font-semibold text-ink")}>{r.title}</p>
                          <p className="mt-0.5 text-xs text-faint">
                            {r.from} · {formatDateTiny(D, dateOfDay(m.seasonIndex, m.day))}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className={cx(BLOCK_LINK, "mt-2.5 group-hover:underline")}>{C.hub.inboxAll}</p>
            </AppLink>
          </div>

          {/* 10 — v0.3 THE TRANSFER WIRE (window section, region-filterable; draws its own rail wrapper) */}
          <TransferWirePanel save={save} C={C} D={D} />

          {/* The one board of the rail, so it closes it (a phone keeps the contract's order). */}
          <div className="order-9 max-sm:hidden"><CareerHonorsTable save={save} C={C} compact /></div>
        </div>
      </div>

      {/* T1 (v2.0): the first-visit explainer is the guided tour now (CareerTour, in the shell). */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// v0.3 — THE TRANSFER WIRE (window panel: every move, all regions, filterable)
// ---------------------------------------------------------------------------

const TRANSFER_PREVIEW = 3;
/** Keep the wire visible this many days past the last logged move. */
const TRANSFER_LINGER_DAYS = 14;

/** `full`: every move of the season (the desk's Transfers view); otherwise the HQ's three latest, which link there. */
export function TransferWirePanel({
  save,
  C,
  D,
  full = false,
}: {
  save: CareerSave;
  C: CareerCopy;
  D: DatesCopy;
  full?: boolean;
}) {
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [sheetRef, setSheetRef] = useState<string | null>(null);

  const seasonMoves = save.transferLog.filter(
    (t) => t.seasonIndex === save.clock.seasonIndex,
  );
  const windowOpen = isWindowWeek(weekOfDay(save.clock.day));
  const recent = seasonMoves.some((t) => save.clock.day - t.day <= TRANSFER_LINGER_DAYS);
  if (!full && !windowOpen && !recent) return null;

  const filtered =
    regionFilter === "all"
      ? seasonMoves
      : seasonMoves.filter((t) => t.region === regionFilter);
  const shownMoves = full ? filtered : filtered.slice(0, TRANSFER_PREVIEW);

  const orgCell = (ref: string | null) => {
    if (!ref) {
      return (
        <span className="display text-[11px] font-semibold uppercase tracking-[0.05em] text-good">
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

  // A rail section like its neighbours: a title, the region filter, one row per move.
  return (
    <WireRoot full={full}>
      <div className={RAIL_HEAD}>
        <h3 className={RAIL_TITLE}>{C.hub.transfersTitle}</h3>
        {windowOpen ? <Badge tone="blue">{C.calendar.windowOpen}</Badge> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {["all", ...Object.keys(REGION_BADGE)].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegionFilter(r)}
            aria-pressed={regionFilter === r}
            className={cx(
              // The picked region is the outlined one (a blue hairline); the rest are plain text.
              buttonClass(regionFilter === r ? "secondary" : "ghost", "sm"),
              regionFilter === r ? "!border-blue-bright/60" : "border border-transparent",
            )}
          >
            {r === "all" ? C.hub.transfersAll : r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm leading-snug text-sub">{C.hub.transfersEmpty}</p>
      ) : (
        <ul className="mt-2 border-t border-line">
          {shownMoves.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-2 text-xs"
            >
              <span className="w-12 shrink-0 text-faint">
                {formatDateTiny(D, dateOfDay(t.seasonIndex, t.day))}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {t.playerName}
              </span>
              <span className="flex min-w-0 items-center gap-1">
                {orgCell(t.fromRef)}
                {/* The direction of the move, not an ornament. */}
                <span className="text-faint" aria-hidden>
                  →
                </span>
                {orgCell(t.toRef)}
              </span>
              {t.kind === "userIn" || t.kind === "userOut" ? (
                <Badge tone="orange">{C.hub.transfersUser}</Badge>
              ) : null}
              {t.fee > 0 ? (
                <span className="display shrink-0 text-sm font-bold text-ink">
                  {formatMoney(t.fee, { compact: true })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!full && filtered.length > TRANSFER_PREVIEW ? (
        <div className="mt-3">
          <AppLink href="/career/news#transfers" className={buttonClass("secondary", "sm")}>
            {C.hub.transfersShowAll(filtered.length)}
          </AppLink>
        </div>
      ) : null}

      <OrgSheet save={save} orgRef={sheetRef} onClose={() => setSheetRef(null)} />
    </WireRoot>
  );
}

/** The transfer wire's board. On HQ a phone leaves it to the desk's Transfers view (News). */
function WireRoot({ full, children }: { full: boolean; children: React.ReactNode }) {
  return <div className={cx(RAIL_SECTION, !full && "order-10 max-sm:hidden")}>{children}</div>;
}

// ---------------------------------------------------------------------------
// NOW card variants
// ---------------------------------------------------------------------------
