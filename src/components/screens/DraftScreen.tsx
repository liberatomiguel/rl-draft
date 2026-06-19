"use client";

/**
 * Draft screen v4.
 * Offer laid out as 2 rows of 3: players on top; coach, sub, org below
 * (missing coach/sub render as non-pickable placeholder cards).
 * Interaction (v0.5.1, by direction): ONE click drafts the card straight
 * into the first open compatible slot — player slots are functionally
 * identical, so there is no select-then-place step anymore.
 * If nothing is pickable, the player gets a free reroll.
 * v0.5: the drawn lineup lands via a slot-machine reel (the instant swap
 * read as nothing happening), and the region badge is color-coded.
 * v0.7.0: the reel reveal is a CHILD component remounted per offer (keyed by
 * draft round) so it computes its spinning names in a lazy useState init —
 * the drawn team is therefore never painted for a frame before the reel
 * (the old effect-based approach leaked that frame). React-Compiler safe.
 */

import { useMemo, useState } from "react";
import { useCopy } from "@/content/copy";
import { lineupHeader, resolveOfferCard } from "@/engine/cards";
import { filledCount, neededKinds, slotsForKind } from "@/engine/draft";
import { draftableLineups, lineupById, seasonById } from "@/data";
import type { DraftOffer, DraftOfferCard, Lineup, RunState } from "@/engine/types";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { FieldView } from "@/components/cards/FieldView";
import { REGION_BADGE } from "@/components/regionStyle";
import { RunStepper } from "./RunStepper";
import { RunOnboarding } from "./RunOnboarding";

const REEL_LENGTH = 10; // 9 decoys + the drawn lineup

function lineupReelName(l: Lineup): string {
  return `${l.name} · ${seasonById.get(l.seasonId)?.shortLabel ?? ""}`;
}

export function DraftScreen({ run }: { run: RunState }) {
  const { DRAFT_UI } = useCopy();
  const pickCard = useRunStore((s) => s.pickCard);
  const reroll = useRunStore((s) => s.reroll);
  const freeReroll = useRunStore((s) => s.freeReroll);
  const unlockedSpecials = useProfileStore((s) => s.unlockedSpecials);
  const KIND_LABEL: Record<string, string> = {
    player: DRAFT_UI.player,
    coach: DRAFT_UI.slotCoach,
    sub: DRAFT_UI.slotSub,
    org: DRAFT_UI.slotOrg,
  };

  // The reel plays for offers the player REACHED (any pick/reroll this mount)
  // and for the very first lineup of a fresh run, but not when resuming a
  // mid-draft refresh (round > 1 on first paint). `acted` flips on the first
  // action and never resets, so every offer from then on rolls.
  const [acted, setActed] = useState(false);

  const offer = run.draft.offer;
  const header = useMemo(() => (offer ? lineupHeader(offer.lineupId) : null), [offer]);
  const lineup = offer ? lineupById.get(offer.lineupId) : null;

  if (!offer || !header || !lineup) return null;

  const filled = filledCount(run.draft.roster);
  const slotTotal = run.mode === "quick" ? 3 : 6;
  const needed = neededKinds(run.draft.roster, run.mode);
  const playReel = run.draft.round === 1 || acted;

  const handlePick = (offerCard: DraftOfferCard) => {
    const openSlot = slotsForKind(offerCard.kind).find((s) => !run.draft.roster[s]);
    if (openSlot) {
      setActed(true);
      sfx.pick();
      pickCard(offerCard, openSlot);
    }
  };
  const handleReroll = () => {
    setActed(true);
    sfx.reroll();
    reroll();
  };
  const handleFreeReroll = () => {
    setActed(true);
    sfx.reroll();
    freeReroll();
  };

  return (
    <div className="rise-in">
      <RunOnboarding difficulty={run.difficulty} regionLock={run.regionLock} />
      <RunStepper run={run} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ----------------------------------------------- Lineup offer.
            Keyed by runId + draft round → a new offer (or a fresh run after
            "Reset run", which mints a new runId at round 1) REMOUNTS it, so the
            reel state is rebuilt fresh in its lazy initializer (no flash of the
            name, and the slot machine replays on reset — v1.4 fix). */}
        <OfferReveal
          key={`${run.runId}-${run.draft.round}`}
          run={run}
          offer={offer}
          header={header}
          lineup={lineup}
          filled={filled}
          slotTotal={slotTotal}
          play={playReel}
          unlockedSpecials={unlockedSpecials}
          onPick={handlePick}
          onReroll={handleReroll}
          onFreeReroll={handleFreeReroll}
        />

        {/* ------------------------------------------------ Your team (field) */}
        <aside aria-label={DRAFT_UI.yourRoster}>
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
                {DRAFT_UI.yourRoster}
              </h3>
              <span className="display text-sm font-bold text-orange-bright">
                {filled}/{slotTotal}
              </span>
            </div>
            <ProgressBar value={filled / slotTotal} tone="orange" className="mb-4" label={DRAFT_UI.yourRoster} />

            <FieldView
              roster={run.draft.roster}
              showOverall={run.showOverall}
              showBench={run.mode !== "quick"}
              className="mx-auto w-full max-w-md lg:max-w-none"
            />

            <p className="mt-3 text-center text-xs text-faint" aria-live="polite">
              {DRAFT_UI.selectHint}
            </p>

            {needed.length > 0 ? (
              <p className="mt-2 text-[11px] uppercase tracking-wider text-faint">
                {DRAFT_UI.stillNeeded}:{" "}
                <span className="text-sub">{needed.map((k) => KIND_LABEL[k]).join(" · ")}</span>
              </p>
            ) : null}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

interface OfferRevealProps {
  run: RunState;
  offer: DraftOffer;
  header: ReturnType<typeof lineupHeader>;
  lineup: Lineup;
  filled: number;
  slotTotal: number;
  /** Whether this offer should spin the slot-machine reel on mount. */
  play: boolean;
  unlockedSpecials: Record<string, string>;
  onPick: (card: DraftOfferCard) => void;
  onReroll: () => void;
  onFreeReroll: () => void;
}

function OfferReveal({
  run,
  offer,
  header,
  lineup,
  filled,
  slotTotal,
  play,
  unlockedSpecials,
  onPick,
  onReroll,
  onFreeReroll,
}: OfferRevealProps) {
  const { DRAFT_UI } = useCopy();
  // Lazy init: the reel names are built ONCE on mount (this component is keyed
  // by round, so each offer gets a fresh mount). When the reel is non-null we
  // render it instead of the drawn name, so the team only appears once the
  // animation lands. Decoys are deterministic (offer + index) — no render-time
  // randomness, which keeps it SSR/React-Compiler safe.
  const [reel, setReel] = useState<string[] | null>(() => {
    if (!play) return null;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // CSS disables the reel animation under reduced motion, so onAnimationEnd
      // would never fire — skip the reel entirely and reveal immediately.
      return null;
    }
    const drawn = lineupById.get(offer.lineupId);
    if (!drawn) return null;
    // Decoy names come from the SAME pool this run draws from — regional / daily
    // restrict it via poolLineupIds; worldwide uses the full Worlds set. The
    // easter-egg lineup is excluded so it stays a surprise.
    const reelPool = (
      run.draft.poolLineupIds
        ? run.draft.poolLineupIds.map((id) => lineupById.get(id)!)
        : draftableLineups
    ).filter((l) => l && !l.rareSpawn);
    const names: string[] = [];
    for (let i = 0; i < REEL_LENGTH - 1; i++) {
      const idx = (offer.lineupId.length * 7 + run.draft.round * 13 + i * 29) % reelPool.length;
      names.push(lineupReelName(reelPool[idx]));
    }
    names.push(lineupReelName(drawn));
    return names;
  });

  const rolling = reel !== null;

  const playerCards = offer.cards.filter((c) => c.kind === "player");
  const coachCard = offer.cards.find((c) => c.kind === "coach") ?? null;
  const subCard = offer.cards.find((c) => c.kind === "sub") ?? null;
  const orgCard = offer.cards.find((c) => c.kind === "org") ?? null;

  const renderOfferCard = (offerCard: DraftOfferCard) => {
    const resolvedCard = resolveOfferCard(offerCard, offer.lineupId);
    const unavailable = offerCard.availability !== "available";
    return (
      // Wrapper caps the card at its normal size and centers it; the card
      // itself is fluid so small grid cells shrink it instead of overlapping.
      <div
        key={`${offerCard.kind}-${offerCard.refId}`}
        className="mx-auto w-full max-w-36 md:max-w-44"
      >
        <GameCard
          card={resolvedCard}
          showOverall={run.showOverall}
          specialCollected={
            offerCard.specialId ? Boolean(unlockedSpecials[offerCard.specialId]) : true
          }
          maskOrgId={lineup.orgId}
          maskSeasonId={lineup.seasonId}
          size="md"
          fluid
          disabled={unavailable}
          disabledLabel={
            offerCard.availability === "vacant"
              ? DRAFT_UI.notFielded
              : offerCard.availability === "slot_full"
                ? DRAFT_UI.slotFull
                : DRAFT_UI.alreadyDrafted
          }
          onClick={() => onPick(offerCard)}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker mb-1">
            {DRAFT_UI.roundLabel(run.draft.round)} · {DRAFT_UI.pickProgress(filled, slotTotal)}
            {run.daily ? <span className="text-orange-bright"> · {run.daily.label}</span> : null}
          </p>
          {rolling ? (
            <div
              className="slot-reel h-8 md:h-9"
              style={{ "--slot-item-h": "2.25rem" } as React.CSSProperties}
              aria-hidden
            >
              <div className="slot-reel-track" onAnimationEnd={() => setReel(null)}>
                {reel!.map((name, i) => (
                  <p
                    key={i}
                    className="display flex h-8 items-center truncate text-2xl font-bold uppercase tracking-wide text-ink md:h-9 md:text-3xl"
                  >
                    {name}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <h2 className="display pop-in truncate text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">
              {header.name}
            </h2>
          )}
          <p
            className={cx(
              "mt-1 flex items-center gap-2 text-sm text-sub transition-opacity duration-200",
              rolling && "opacity-0",
            )}
          >
            {/* Season + the year it took place — but only append the year when
                the label doesn't already carry it (e.g. "RLCS Season 6" → 2018,
                while "RLCS 2022-23" already has it). */}
            <span>
              {header.seasonLabel}
              {header.year && !header.seasonLabel.includes(header.year) ? (
                <span className="text-faint"> · {header.year}</span>
              ) : null}
            </span>
            {/* Region accent color — where is this team from, at a glance */}
            <Badge className={REGION_BADGE[header.region]}>{header.region}</Badge>
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onReroll}
          disabled={run.draft.rerollsLeft <= 0 || rolling}
          title={DRAFT_UI.reroll}
        >
          <RerollIcon />
          {DRAFT_UI.reroll} ·{" "}
          {run.draft.rerollsLeft > 0
            ? DRAFT_UI.rerollsLeft(run.draft.rerollsLeft)
            : DRAFT_UI.noRerolls}
        </Button>
      </div>

      {/* The offer fades in once the reel lands */}
      <div className={cx(rolling && "pointer-events-none opacity-0", "transition-opacity duration-300")}>
        {/* Row 1: the three players (cells stretch; cards cap at max-w) */}
        <div className="mb-3 grid grid-cols-3 gap-2 md:gap-4">
          {playerCards.map(renderOfferCard)}
        </div>
        {/* Row 2: coach · sub · org (classic/daily only) */}
        {run.mode !== "quick" && coachCard && subCard && orgCard ? (
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {renderOfferCard(coachCard)}
            {renderOfferCard(subCard)}
            {renderOfferCard(orgCard)}
          </div>
        ) : null}

        {!offer.hasPickableCard ? (
          <Panel className="mt-6 flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm text-sub">{DRAFT_UI.freeRerollHint}</p>
            <Button variant="primary" onClick={onFreeReroll} className="pulse-soft shrink-0">
              <RerollIcon />
              {DRAFT_UI.freeReroll}
            </Button>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function RerollIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.34 6.34" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
