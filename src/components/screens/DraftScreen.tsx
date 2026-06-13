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
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DRAFT_UI } from "@/content/copy";
import { lineupHeader, resolveOfferCard } from "@/engine/cards";
import { filledCount, neededKinds, slotsForKind } from "@/engine/draft";
import { lineupById, lineups, seasonById } from "@/data";
import type { DraftOfferCard, RunState } from "@/engine/types";
import { cx } from "@/lib/util";
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

const KIND_LABEL: Record<string, string> = {
  player: "Player",
  coach: DRAFT_UI.slotCoach,
  sub: DRAFT_UI.slotSub,
  org: DRAFT_UI.slotOrg,
};

export function DraftScreen({ run }: { run: RunState }) {
  const pickCard = useRunStore((s) => s.pickCard);
  const reroll = useRunStore((s) => s.reroll);
  const freeReroll = useRunStore((s) => s.freeReroll);
  const unlockedSpecials = useProfileStore((s) => s.unlockedSpecials);

  // Slot-machine reel: decoy lineup names spinning onto the drawn one.
  const [reel, setReel] = useState<string[] | null>(null);
  const rolledOnce = useRef(false);

  const offer = run.draft.offer;

  // useLayoutEffect, not useEffect: the reel must be up BEFORE the browser
  // paints the new offer, or the drawn name flashes for a frame (v0.5.1).
  useLayoutEffect(() => {
    if (!offer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const drawn = lineupById.get(offer.lineupId);
    if (!drawn) return;
    // First offer after a refresh resumes silently; rolls play from then on.
    if (!rolledOnce.current) {
      rolledOnce.current = true;
      if (run.draft.round > 1) return;
    }
    const nameOf = (l: (typeof lineups)[number]) =>
      `${l.name} · ${seasonById.get(l.seasonId)?.shortLabel ?? ""}`;
    const decoys: string[] = [];
    for (let i = 0; i < 9; i++) {
      decoys.push(nameOf(lineups[Math.floor(Math.random() * lineups.length)]));
    }
    setReel([...decoys, nameOf(drawn)]);
  }, [offer, run.draft.round]);

  const header = useMemo(() => (offer ? lineupHeader(offer.lineupId) : null), [offer]);
  const lineup = offer ? lineupById.get(offer.lineupId) : null;

  if (!offer || !header || !lineup) return null;

  const filled = filledCount(run.draft.roster);
  const slotTotal = run.mode === "quick" ? 3 : 6;
  const needed = neededKinds(run.draft.roster, run.mode);

  const playerCards = offer.cards.filter((c) => c.kind === "player");
  const coachCard = offer.cards.find((c) => c.kind === "coach") ?? null;
  const subCard = offer.cards.find((c) => c.kind === "sub") ?? null;
  const orgCard = offer.cards.find((c) => c.kind === "org") ?? null;

  // One click drafts the card into the first open compatible slot —
  // player slots are interchangeable, so there is nothing to choose.
  const handleCardClick = (offerCard: DraftOfferCard) => {
    const openSlot = slotsForKind(offerCard.kind).find((s) => !run.draft.roster[s]);
    if (openSlot) pickCard(offerCard, openSlot);
  };

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
          onClick={() => handleCardClick(offerCard)}
        />
      </div>
    );
  };

  const rolling = reel !== null;

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------ Lineup offer */}
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
                  <div
                    className="slot-reel-track"
                    onAnimationEnd={() => setReel(null)}
                  >
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
                {header.seasonLabel}
                {/* Region accent color — where is this team from, at a glance */}
                <Badge className={REGION_BADGE[header.region]}>{header.region}</Badge>
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={reroll}
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
                <Button variant="primary" onClick={freeReroll} className="pulse-soft shrink-0">
                  <RerollIcon />
                  {DRAFT_UI.freeReroll}
                </Button>
              </Panel>
            ) : null}
          </div>
        </div>

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

function RerollIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.34 6.34" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
