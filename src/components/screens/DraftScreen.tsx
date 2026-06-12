"use client";

/**
 * Draft screen v2.
 * Offer laid out as 2 rows of 3: players on top; coach, sub, org below
 * (missing coach/sub render as non-pickable placeholder cards).
 * Interaction: click a card to select it → compatible slots on the field
 * glow → click a slot to place. No confirm button.
 * If nothing is pickable, the player gets a free reroll.
 */

import { useEffect, useMemo, useState } from "react";
import { DRAFT_UI } from "@/content/copy";
import { lineupHeader, resolveOfferCard } from "@/engine/cards";
import { filledCount, neededKinds, slotsForKind } from "@/engine/draft";
import { lineupById } from "@/data";
import type { DraftOfferCard, RosterSlotId, RunState } from "@/engine/types";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { FieldView } from "@/components/cards/FieldView";
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

  const [selected, setSelected] = useState<DraftOfferCard | null>(null);

  const offer = run.draft.offer;
  useEffect(() => {
    setSelected(null);
  }, [offer?.lineupId, run.draft.round]);

  // ESC clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const handleSlotClick = (slot: RosterSlotId) => {
    if (!selected) return;
    pickCard(selected, slot);
    setSelected(null);
  };

  const handleCardClick = (offerCard: DraftOfferCard, isSelected: boolean) => {
    if (isSelected) {
      setSelected(null);
      return;
    }
    // One possible destination (coach/sub/org, or the last open player slot)
    // → assign immediately, no second click needed.
    const openSlots = slotsForKind(offerCard.kind).filter((s) => !run.draft.roster[s]);
    if (openSlots.length === 1) {
      pickCard(offerCard, openSlots[0]);
      setSelected(null);
      return;
    }
    setSelected(offerCard);
  };

  const renderOfferCard = (offerCard: DraftOfferCard) => {
    const resolvedCard = resolveOfferCard(offerCard, offer.lineupId);
    const isSelected =
      selected?.kind === offerCard.kind && selected?.refId === offerCard.refId;
    const unavailable = offerCard.availability !== "available";
    return (
      <GameCard
        key={`${offerCard.kind}-${offerCard.refId}`}
        card={resolvedCard}
        showOverall={run.showOverall}
        specialCollected={
          offerCard.specialId ? Boolean(unlockedSpecials[offerCard.specialId]) : true
        }
        size="md"
        selected={isSelected}
        disabled={unavailable}
        disabledLabel={
          offerCard.availability === "slot_full" ? DRAFT_UI.slotFull : DRAFT_UI.alreadyDrafted
        }
        onClick={() => handleCardClick(offerCard, isSelected)}
      />
    );
  };

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------ Lineup offer */}
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="kicker mb-1">
                {DRAFT_UI.roundLabel(run.draft.round)} · {DRAFT_UI.pickProgress(filled, slotTotal)}
                {run.daily ? <span className="text-orange-bright"> · {run.daily.label}</span> : null}
              </p>
              <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">
                {header.name}
              </h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-sub">
                {header.seasonLabel}
                <Badge tone="neutral">{header.region}</Badge>
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={reroll}
              disabled={run.draft.rerollsLeft <= 0}
              title={DRAFT_UI.reroll}
            >
              <RerollIcon />
              {DRAFT_UI.reroll} ·{" "}
              {run.draft.rerollsLeft > 0
                ? DRAFT_UI.rerollsLeft(run.draft.rerollsLeft)
                : DRAFT_UI.noRerolls}
            </Button>
          </div>

          {/* Row 1: the three players */}
          <div className="mb-3 grid grid-cols-3 justify-items-center gap-2 md:gap-4">
            {playerCards.map(renderOfferCard)}
          </div>
          {/* Row 2: coach · sub · org (classic/daily only) */}
          {run.mode !== "quick" && coachCard && subCard && orgCard ? (
            <div className="grid grid-cols-3 justify-items-center gap-2 md:gap-4">
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
              highlightKind={selected?.kind ?? null}
              onSlotClick={handleSlotClick}
              showBench={run.mode !== "quick"}
              className="mx-auto w-full max-w-md lg:max-w-none"
            />

            <p
              className={cxHint(selected !== null)}
              aria-live="polite"
            >
              {selected ? DRAFT_UI.placeHint : DRAFT_UI.selectHint}
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

function cxHint(active: boolean): string {
  return active
    ? "mt-3 text-center text-xs font-semibold text-orange-bright"
    : "mt-3 text-center text-xs text-faint";
}

function RerollIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.34 6.34" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
