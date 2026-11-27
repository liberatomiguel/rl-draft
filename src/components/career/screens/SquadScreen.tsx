"use client";

/**
 * Road to Worlds — Squad (v0.2 rebuild).
 *
 * FM-style squad management: pitch-styled starters panel (two-tap swap with a
 * visible before→after rating/chemistry readout), a chemistry module that
 * EXPLAINS itself (expandable per-pair breakdown from the engine's
 * ChemistryResult.items), bench + coach chips, a roster-stability meter tied
 * to CAREER_STABILITY, and a contracts table with renew (1/2/3-season length
 * picker previewing the exact engine ask, plus the v0.3 wage-talk
 * counter-offer widget — rejections keep the modal open and harden the odds)
 * and release (severance from the same formula releasePlayerFlow charges).
 *
 * All money math mirrors the flow layer 1:1 — renewalTermsFor/severanceFor/payrollProjection are
 * imported READ-ONLY from the engine so the preview can never drift.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useMemo, useState } from "react";
import { CAREER_STABILITY, FEATURES } from "@/config/balance";
import { RosterSeasonStats } from "@/components/career/RosterSeasonStats";
import { useCopy } from "@/content/copy";
import { useCareerCopy } from "@/content/careerCopy";
import { payrollProjection, severanceFor, weeklyWage } from "@/engine/career/economy";
import type { SquadPlayer } from "@/engine/career/types";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";
import type { ContractOffer } from "@/engine/career/contract";
import { listingPlanFor, renewalTalkFor, transferListOf } from "@/store/careerFlow";
import { ListPlayerSheet } from "@/components/career/ListPlayerSheet";
import { contractClockOf } from "@/store/careerHq";
import { careerNewSummary, contractNewKey, contractWarnsFor } from "@/engine/career/careerNew";
import { NewTag } from "@/components/ui/NewDot";
import { useCareerStore } from "@/store/careerStore";
import { useMounted } from "@/store/useMounted";
import {
  agePhase,
  clockLabel,
  potBandOfSquad,
  prizeShareLabelOf,
  seasonLabelFor,
  squadAge,
  statsOfSquad,
  useCareerSave,
  userTeamPreview,
  wageLabel,
} from "@/components/career/careerUi";
import { CoachEffectLines } from "@/components/career/CoachEffects";
import { playerFocusLabel } from "@/components/career/training/TrainingPackageParts";
import { ErrorBanner } from "@/components/career/hub/hubShared";
import { PlayerCardTile } from "@/components/career/PlayerCardTile";
import { SalaryNegotiator } from "@/components/career/SalaryNegotiator";
import { RenewalReadout, renewalTermsOf } from "@/components/career/RenewalReadout";
import { PlayerSheet, type PlayerSheetData } from "@/components/career/PlayerSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LockerRoomBlock } from "@/components/career/locker/LockerRoomBlock"; // v2.3 UI
import { MoodButton, PlayerFace, TileMood } from "@/components/career/locker/lockerUi"; // v2.3 UI
import { PlayerMoodSheet } from "@/components/career/locker/PlayerMoodSheet"; // rc9 DS

const CHEM_TIER_TONE: Record<string, "good" | "blue" | "neutral" | "bad"> = {
  Perfect: "good",
  Great: "good",
  Good: "blue",
  Okay: "neutral",
  Poor: "bad",
};

const RENEW_LENGTHS = [1, 2, 3] as const;

export function SquadScreen() {
  const mounted = useMounted();
  const save = useCareerSave();
  const t = useCopy();
  const C = useCareerCopy();
  const setStarters = useCareerStore((s) => s.setStarters);
  const releasePlayer = useCareerStore((s) => s.releasePlayer);
  const renewPlayer = useCareerStore((s) => s.renewPlayer);
  const lastError = useCareerStore((s) => s.lastError);
  const clearError = useCareerStore((s) => s.clearError);
  // rc.34 (UX-06): opening a contract (the sheet, the renewal) clears its "New" mark.
  const markCareerSeen = useCareerStore((s) => s.markCareerSeen);

  const [selected, setSelected] = useState<string | null>(null);
  /** Rating/chem snapshot taken right before a swap — powers the after-swap readout. */
  const [swapBefore, setSwapBefore] = useState<{ rating: number; chem: number } | null>(null);
  const [chemOpen, setChemOpen] = useState(false);
  const [sheet, setSheet] = useState<PlayerSheetData | null>(null);
  /** rc9 DS: the player whose mood sheet is open (from his contract row). */
  const [moodOpen, setMoodOpen] = useState<string | null>(null);
  const [release, setRelease] = useState<SquadPlayer | null>(null);
  const [renew, setRenew] = useState<SquadPlayer | null>(null);
  /** R135: the listing sheet for one player. */
  const [listing, setListing] = useState<string | null>(null);
  const [renewLen, setRenewLen] = useState<1 | 2 | 3>(2);
  /** rc.33 (ECO-10/11): the renewal offer on the table — weekly wage + prize share (empty = his ask). */
  const [renewOffer, setRenewOffer] = useState<ContractOffer>({});

  const team = useMemo(() => (save ? userTeamPreview(save) : null), [save]);
  // rc.34 (UX-06): the save's new items (contracts in their final stretch, urgent first).
  const freshKeys = useMemo(() => (save ? careerNewSummary(save).keys : new Set<string>()), [save]);

  if (!mounted || !save || !team) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        <div className="h-[60vh] animate-pulse rounded-2xl bg-white/5" aria-busy />
      </div>
    );
  }

  const clock = clockLabel(save);
  const byId = new Map(save.squad.map((p) => [p.id, p]));
  const starters = save.starterIds.map((id) => byId.get(id)).filter(Boolean) as SquadPlayer[];
  const listedIds = new Set(transferListOf(save).map((l) => l.playerId));
  const bench = save.squad.filter((p) => !save.starterIds.includes(p.id));
  const wageBill =
    save.squad.reduce((s, p) => s + p.salaryPerSplit, 0) + (save.coach?.salaryPerSplit ?? 0);
  const teamRating = Math.round(team.rating.total);
  const chemTierLabel = t.CHEM_TIERS[team.chemistry.tier] ?? team.chemistry.tier;

  // R40 review: an event in progress froze its team at the start (a Major /
  // Worlds pauses overnight) — the lineup is locked until it ends.
  const lineupLocked = save.activeEvent !== null;

  // --- two-tap swap ---------------------------------------------------------
  const onTileClick = (id: string) => {
    if (lineupLocked) return;
    if (selected === null) {
      setSelected(id);
      setSwapBefore(null);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    const next = [...save.starterIds] as [string, string, string];
    const si = next.indexOf(selected);
    const ti = next.indexOf(id);
    if (si < 0 && ti < 0) {
      // bench ↔ bench: nothing to swap — move the selection instead.
      setSelected(id);
      return;
    }
    if (si >= 0 && ti >= 0) [next[si], next[ti]] = [next[ti], next[si]];
    else if (si >= 0) next[si] = id;
    else next[ti] = selected;
    setSwapBefore({ rating: teamRating, chem: team.chemistry.percent });
    setStarters(next);
    setSelected(null);
  };

  const openSheet = (p: SquadPlayer) => {
    markCareerSeen([contractNewKey(p.id, p.contractEndSeason)]);
    openSheetData(p);
  };
  const openSheetData = (p: SquadPlayer) =>
    setSheet({
      name: p.name,
      overall: p.overall,
      age: squadAge(save, p),
      archetype: p.archetype,
      country: p.country,
      region: p.region,
      band: potBandOfSquad(save, p),
      stats: statsOfSquad(p),
      wage: p.salaryPerSplit,
      contractLabel: seasonLabelFor(p.contractEndSeason),
      shareLabel: prizeShareLabelOf(C, p),
      phase: agePhase(save, p),
      // rc.34 (DEV-03): the period's package for him (his tweak, the squad focus or the base).
      focusLabel: playerFocusLabel(save, p.id, C, t.STAT_LABELS),
    });

  // --- renew ask preview (the same renewalTermsFor renewPlayerFlow prices) ---
  // ECO-03 (R47): a reserve renews at his normal value, like a starter.
  // rc.32 (M2, provisional): the raise cap and the market floor, readout below.
  const askFor = (p: SquadPlayer, lengthSeasons: 1 | 2 | 3): number => renewalTermsOf(save, p, lengthSeasons).ask;

  // rc.33 (ECO-10/11): the talk renewPlayerFlow answers with — wage + prize share.
  const renewTalk = renew ? renewalTalkFor(save, renew, renewLen, renewOffer) : null;
  const closeRenew = () => {
    setRenew(null);
    clearError();
  };

  // --- release severance (the engine formula releasePlayerFlow charges) ------
  const severanceOf = (p: SquadPlayer): number => severanceFor(p, save.clock.seasonIndex);
  // ECO-03 (R47): the renewal's payroll projection — today's weekly wage bill
  // vs. the one with the new deal (the Monday funnel's own rounding).
  const renewWageBill = renew
    ? payrollProjection({
        squadSalaries: save.squad.map((p) => ({ id: p.id, amount: p.salaryPerSplit })),
        coachSalary: save.coach?.salaryPerSplit ?? null,
        remove: [renew.id],
        add: [renewTalk?.offered.wagePerSplit ?? renew.salaryPerSplit],
      })
    : null;

  // --- roster stability -----------------------------------------------------
  const maxFaces = save.starterIds.length;
  const faces = save.competition.newFacesThisSplit.length;
  const nextFaces = faces + 1;
  const nextTier =
    nextFaces <= CAREER_STABILITY.freeNewFaces
      ? 0
      : nextFaces === CAREER_STABILITY.freeNewFaces + 1
        ? CAREER_STABILITY.secondFacePenaltyPct
        : CAREER_STABILITY.thirdFacePenaltyPct;
  const nextFacePct = Math.max(0, nextTier - save.competition.stabilityTierApplied);
  const userSeasonPts = save.competition.seasonPoints[save.identity.region]?.["user"] ?? 0;
  const stabilityExempt = CAREER_STABILITY.preseasonExempt && clock.kind === "preseason";
  const showStabilityWarning = nextFacePct > 0 && !stabilityExempt;

  // rc9 DS (#217): contracts in the order the manager acts on them: the ones
  // that end first (this season's at the top), starters before the reserve.
  const contractRows = [...save.squad].sort(
    (a, b) => a.contractEndSeason - b.contractEndSeason || Number(a.role === "sub") - Number(b.role === "sub"),
  );
  const endingCount = save.squad.filter((p) => p.contractEndSeason === save.clock.seasonIndex).length;

  // rc9 DS (#217, #218): the decision on this screen is who plays. The starters
  // board is the focal point (its figure: the team rating); bench and coach are
  // their own boards under it; contracts take the rest of the left column. On
  // the right, the season's stats and, under them, what the locker room asks.
  return (
    <div className="rise-in mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <SectionTitle
        title={C.squad.title}
        className="mb-6"
        right={
          <div className="flex items-center gap-2 text-xs">
            <Badge tone="neutral">{save.squad.length}/4</Badge>
            <span className="text-sub">{wageLabel(C, wageBill)}</span>
          </div>
        }
      />

      <ErrorBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
      <div className="space-y-6 lg:col-span-2 lg:space-y-8">
      {/* ==================== starters: the pitch ==================== */}
      <Panel data-tour="squad-starters" strong className="p-4 sm:p-5">
        <div>
          {/* The team rating is the figure of this board. */}
          <div className="card-head">
            <h2 className="card-title">{C.squad.starters}</h2>
            <span className="flex items-baseline gap-2">
              <span className="display text-3xl font-bold leading-none tabular-nums text-ink">{teamRating}</span>
              <span className="text-xs text-faint">{C.club.stars}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {starters.map((p) => (
              <PlayerCardTile
                rarityFrame
                key={p.id}
                name={p.name}
                overall={p.overall}
                age={squadAge(save, p)}
                band={potBandOfSquad(save, p)}
                archetype={p.archetype}
                country={p.country}
                region={p.region}
                selected={selected === p.id}
                onClick={() => onTileClick(p.id)}
                footer={FEATURES.lockerRoom ? <TileMood save={save} C={C} playerId={p.id} /> : undefined} // v2.3 UI
              />
            ))}
          </div>

          {/* swap affordance / feedback line */}
          <div className="mt-3 min-h-5 text-center text-xs">
            {lineupLocked ? (
              <span className="rounded-sm bg-orange/10 px-2.5 py-0.5 font-semibold text-orange-bright">
                {C.event.lineupLocked}
              </span>
            ) : selected ? (
              <span className="text-orange-bright">
                {C.squad.makeStarter} ↔ {C.squad.makeSub}
              </span>
            ) : swapBefore ? (
              <span className="font-semibold text-cyan">
                {C.squad.swapPreview(swapBefore.rating, teamRating)} ·{" "}
                {C.squad.chemPreview(swapBefore.chem, team.chemistry.percent)}
              </span>
            ) : (
              <span className="text-faint">
                {C.squad.makeStarter} ↔ {C.squad.makeSub}
              </span>
            )}
          </div>

          {/* chemistry module: bar + tier + expandable "why" */}
          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setChemOpen((v) => !v)}
              aria-expanded={chemOpen}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="kicker shrink-0">{C.hub.chemistry}</span>
              <ProgressBar
                value={team.chemistry.percent / 100}
                tone="good"
                className="flex-1"
                label={C.hub.chemistry}
              />
              <span className="shrink-0 text-xs font-semibold text-emerald-300">
                {team.chemistry.percent}%
              </span>
              <Badge tone={CHEM_TIER_TONE[team.chemistry.tier] ?? "neutral"}>{chemTierLabel}</Badge>
              <svg
                viewBox="0 0 24 24"
                className={cx("h-4 w-4 shrink-0 text-sub transition-transform", chemOpen && "rotate-180")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {chemOpen && team.chemistry.items.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-line/60 pt-2">
                {team.chemistry.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[11px] text-sub">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="shrink-0 font-semibold text-emerald-300">
                      +{Math.round(it.points * 10) / 10}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* rc9 DS (#217): roster stability as one quiet line of the starters, orange only when the next new face costs points. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-xs">
            <span className="text-faint">{C.squad.stabilityLine(faces, maxFaces)}</span>
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: maxFaces }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    "h-1.5 w-5 rounded-full",
                    i < faces
                      ? i + 1 <= CAREER_STABILITY.freeNewFaces
                        ? "bg-cyan/70"
                        : "bg-orange"
                      : "bg-white/10",
                  )}
                />
              ))}
            </span>
            {showStabilityWarning ? (
              <span className="basis-full font-semibold text-orange-bright">
                {C.squad.stabilityWarning(nextFacePct, userSeasonPts)}
              </span>
            ) : null}
          </div>

          {/* rc9 (Miguel, 27/11): the bench and the coach stay in the squad's
              board, and the coach is a card like the players, not loose text. */}
          <div data-tour="squad-bench" className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 border-t border-line pt-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col">
              <div className="mb-2.5 flex min-h-5 items-baseline justify-between gap-3">
                <p className="kicker">{C.squad.bench}</p>
                {bench.length === 0 ? (
                  <AppLink href="/career/market" className="text-xs text-blue-bright transition-colors hover:text-ink">
                    {C.nav.market}
                  </AppLink>
                ) : null}
              </div>
              {bench.length > 0 ? (
                <div className="space-y-2">
                  {bench.map((p) => (
                    <PlayerCardTile
                      rarityFrame
                      layout="row"
                      key={p.id}
                      name={p.name}
                      overall={p.overall}
                      age={squadAge(save, p)}
                      band={potBandOfSquad(save, p)}
                      archetype={p.archetype}
                      country={p.country}
                      region={p.region}
                      selected={selected === p.id}
                      onClick={() => onTileClick(p.id)}
                      aside={FEATURES.lockerRoom ? <TileMood save={save} C={C} playerId={p.id} /> : undefined}
                      footer={wageLabel(C, p.salaryPerSplit)}
                    />
                  ))}
                </div>
              ) : (
                // The empty seat keeps the card's place: what it means, in one line.
                <div className="flex flex-1 items-center rounded-xl border border-dashed border-line-strong p-3">
                  <p className="text-xs leading-relaxed text-sub">{C.squad.emptySub}</p>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="mb-2.5 flex min-h-5 items-baseline justify-between gap-3">
                <p className="kicker">{C.squad.coachSlot}</p>
                <AppLink
                  href="/career/market#coaches"
                  className="text-xs text-blue-bright transition-colors hover:text-ink"
                >
                  {C.market.coaches}
                </AppLink>
              </div>
              {save.coach ? (
                <PlayerCardTile
                  rarityFrame
                  layout="row"
                  className="flex-1"
                  name={save.coach.name}
                  overall={save.coach.overall}
                  footer={
                    <span className="block">
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span>{wageLabel(C, save.coach.salaryPerSplit)}</span>
                        {/* His speciality as a quiet line, not a tag: the name leads the card. */}
                        <span className="text-blue-bright">
                          {C.market.coachBonus(t.STAT_LABELS[save.coach.bonusType])} {save.coach.bonusLevel}
                        </span>
                      </span>
                      <CoachEffectLines coach={save.coach} compact className="mt-1.5" />
                    </span>
                  }
                />
              ) : (
                <div className="flex flex-1 items-center rounded-xl border border-dashed border-line-strong p-3">
                  <p className="text-xs leading-relaxed text-sub">{C.squad.emptyCoach}</p>
                </div>
              )}
            </div>
          </div>
          {/* The staff around the coach: the gear ladder, and the psychologist when hired. */}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs">
            <AppLink href="/career/finances" className="text-sub transition-colors hover:text-ink">
              {C.finances.gearLadder}
            </AppLink>
            {save.finances.gear.psychologist ? (
              <Badge tone="good">{C.finances.psychologist}</Badge>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* ==================== contracts ==================== */}
      <Panel data-tour="squad-contracts" className="p-4 sm:p-5">
        <div className="card-head">
          <h2 className="card-title">{C.squad.contracts}</h2>
          <span className={cx("text-xs", endingCount > 0 ? "font-semibold text-orange-bright" : "text-faint")}>
            {endingCount > 0 ? C.squad.contractsEnding(endingCount) : C.squad.contractsSettled}
          </span>
        </div>
        {/* rc9 DS (#217): one row per contract, built around what the manager reads first:
            who (and how he feels), when it ends, what it costs; then what he can do. */}
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_7.5rem] gap-x-4 pb-2 sm:grid">
          <span className="kicker">{C.squad.colPlayer}</span>
          <span className="kicker">{C.squad.colEnds}</span>
          <span className="kicker text-right">{C.squad.colWage}</span>
        </div>
        {/* The column heads exist from `sm`; on a phone the board's head rule is the only rule above the list. */}
        <ul className="border-line sm:border-t">
          {contractRows.map((p) => {
            const expiring = p.contractEndSeason === save.clock.seasonIndex;
            return (
              <li
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0 sm:first:pt-4 sm:grid-cols-[minmax(0,1fr)_10rem_7.5rem]"
              >
                {/* Who: his face, his name (opens his sheet), his state, his mood. */}
                <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                  <PlayerFace overall={p.overall} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => openSheet(p)}
                        title={C.market.viewSheet}
                        className="display min-h-6 truncate text-left text-[15px] font-bold text-ink underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </button>
                      {expiring ? <Badge tone="orange">{C.squad.expiring}</Badge> : null}
                      {p.finalSeasonAnnounced ? <Badge tone="bad">{C.squad.finalSeason}</Badge> : null}
                      {freshKeys.has(contractNewKey(p.id, p.contractEndSeason)) ? <NewTag>{C.toolbox.newTag}</NewTag> : null}
                      {listedIds.has(p.id) ? <Badge tone="blue">{C.market.transferList.listedTag}</Badge> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-faint">
                      <span>{p.role === "sub" ? C.market.sub : C.squad.roleStarter}</span>
                      <span aria-hidden>·</span>
                      <span>{C.player.age(squadAge(save, p))}</span>
                      {FEATURES.lockerRoom ? (
                        <>
                          <span aria-hidden>·</span>
                          <MoodButton save={save} C={C} playerId={p.id} name={p.name} onOpen={setMoodOpen} />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* When it ends, and the time left when it is this season. */}
                <div className="min-w-0">
                  <p className={cx("text-sm", expiring ? "font-semibold text-orange-bright" : "text-ink")}>
                    {C.squad.expires(seasonLabelFor(p.contractEndSeason))}
                  </p>
                  {/* rc.34 (UX-06b): the time left in a final-season contract. */}
                  {expiring && contractWarnsFor(save, p) ? (
                    <p className="text-xs text-orange-bright">{C.squad.weeksLeft(contractClockOf(save, p).weeksLeft ?? 0)}</p>
                  ) : (
                    // rc.33 (ECO-10): the prize share this contract carries.
                    <p className="text-xs text-faint">{prizeShareLabelOf(C, p)}</p>
                  )}
                </div>

                {/* What it costs. */}
                <p className="text-right text-sm tabular-nums text-ink">{wageLabel(C, p.salaryPerSplit)}</p>

                {/* What he can do: renew first, the rest quieter. */}
                <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-3 sm:pl-12">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      markCareerSeen([contractNewKey(p.id, p.contractEndSeason)]);
                      setRenewLen(2);
                      setRenewOffer({});
                      setRenew(p);
                    }}
                  >
                    {C.squad.renew}
                  </Button>
                  {/* R135 (ECO-06): the transfer list. */}
                  {(() => {
                    const listError = listingPlanFor(save, p.id)?.error ?? null;
                    return (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(listError)}
                        title={listError ? ((C.market.errors as Record<string, string>)[listError] ?? C.market.errors.unknown) : undefined}
                        onClick={() => setListing(p.id)}
                      >
                        {C.market.transferList.listForSale}
                      </Button>
                    );
                  })()}
                  {/* rc.30: roster moves wait for the event (its team froze at the start). */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={lineupLocked}
                    title={lineupLocked ? C.market.errors.rosterLocked : undefined}
                    onClick={() => setRelease(p)}
                    className="!text-bad"
                  >
                    {C.squad.release}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      </div>

      {/* ==================== the right column: the season, then the room ==================== */}
      <div className="space-y-6 lg:space-y-8">
        {/* v2.1 Matchday slice 5: the season's box-score stats (staging flag). */}
        {FEATURES.matchdayBoxScore ? <RosterSeasonStats save={save} /> : null}
        <LockerRoomBlock save={save} C={C} /> {/* v2.3 UI */}
      </div>
      </div>

      <PlayerSheet data={sheet} onClose={() => setSheet(null)} />
      {FEATURES.lockerRoom ? <PlayerMoodSheet save={save} C={C} playerId={moodOpen} onClose={() => setMoodOpen(null)} /> : null}
      {listing ? <ListPlayerSheet key={listing} save={save} open playerId={listing} onClose={() => setListing(null)} /> : null}

      {/* ==================== release confirm ==================== */}
      <Modal
        open={Boolean(release)}
        onClose={() => setRelease(null)}
        title={release ? C.squad.releaseConfirm(release.name) : ""}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRelease(null)}>
              {C.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (release) releasePlayer(release.id);
                setRelease(null);
              }}
            >
              {C.squad.release}
            </Button>
          </>
        }
      >
        <p className="text-sm text-sub">{C.squad.releaseBody}</p>
        {release ? (
          <p className="mt-2 text-sm font-semibold text-bad">
            {C.squad.releaseFee(formatMoney(severanceOf(release)))}
          </p>
        ) : null}
      </Modal>

      {/* ============ renew — length picker + ask preview + wage talk ====== */}
      <Modal
        open={Boolean(renew)}
        onClose={closeRenew}
        title={renew ? `${C.squad.renew}: ${renew.name}` : ""}
      >
        {renew ? (
          <div className="space-y-4">
            {/* rc.36 (front S2): a refused offer is answered in the talk itself. */}
            {lastError && lastError !== "negotiationCounter" ? (
              <p className="rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-xs font-semibold text-bad">
                {(C.market.errors as Record<string, string>)[lastError] ??
                  C.market.errors.unknown}
              </p>
            ) : null}
            <RenewalReadout terms={renewalTermsOf(save, renew, renewLen)} C={C} save={save} player={renew} />
            {/* rc.33 (ECO-10/11): the talk. rc.36 (front S2): the length is one of its levers (the offer
                keeps its place when it changes); "Send offer" gets his answer. */}
            {renewTalk ? (
              <SalaryNegotiator
                key={renew.id}
                talk={renewTalk}
                onChange={setRenewOffer}
                length={{
                  value: renewLen,
                  options: RENEW_LENGTHS,
                  onChange: setRenewLen,
                  sub: (len) => formatMoney(weeklyWage(askFor(renew, len)), { compact: true }),
                }}
                onSend={() => {
                  renewPlayer(renew.id, renewLen, renewOffer);
                  const error = useCareerStore.getState().lastError;
                  if (!error) {
                    closeRenew();
                    return "signed";
                  }
                  if (error !== "negotiationCounter") return "error";
                  // rc.36 (front S2): the talk shows his answer itself — no error lingers into other screens.
                  useCareerStore.getState().clearError();
                  return "refused";
                }}
              />
            ) : null}
            <div className="rounded-lg border border-line bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-sub">{C.squad.wage}</span>
                <span className="font-semibold text-ink">
                  {wageLabel(C, renew.salaryPerSplit, false)} →{" "}
                  {wageLabel(C, renewTalk?.offered.wagePerSplit ?? renew.salaryPerSplit, false)}
                </span>
              </div>
              {/* rc.33 (ECO-10): the prize share — today's deal → the renewal's (rc.36: the offer's, before he answers). */}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2">
                <span className="text-sub">{C.player.prizeShare}</span>
                <span className="text-right font-semibold text-ink">
                  {prizeShareLabelOf(C, renew)} →{" "}
                  {renewTalk ? prizeShareLabelOf(C, { prizeSharePct: renewTalk.offered.sharePct }) : "-"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sub">{C.player.contract}</span>
                <span className="font-semibold text-ink">
                  {C.squad.expires(seasonLabelFor(save.clock.seasonIndex + renewLen))}
                </span>
              </div>
              {/* ECO-03 (R47): the payroll projection — new weekly bill vs today. */}
              {renewWageBill ? (
                <p
                  className={cx(
                    "mt-1.5 text-xs font-semibold",
                    renewWageBill.after > renewWageBill.now ? "text-orange-bright" : "text-sub",
                  )}
                >
                  {C.market.payrollWeek(formatMoney(renewWageBill.now), formatMoney(renewWageBill.after))}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
