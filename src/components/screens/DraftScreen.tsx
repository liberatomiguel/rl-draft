"use client";

/**
 * Draft screen: one random historical lineup per round, pick one card.
 * Desktop: lineup left, roster rail right. Mobile: stacked, sticky confirm bar.
 */

import { useEffect, useMemo, useState } from "react";
import { DRAFT_UI } from "@/content/copy";
import { lineupHeader, resolveOfferCard } from "@/engine/cards";
import { filledCount, neededKinds, openPlayerSlot } from "@/engine/draft";
import type { DraftOfferCard, RunState } from "@/engine/types";
import { useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GameCard } from "@/components/cards/GameCard";
import { MiniCard } from "@/components/cards/MiniCard";
import { rosterSlots } from "@/components/cards/rosterView";
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
  const skipLineup = useRunStore((s) => s.skipLineup);
  const unlockedSpecials = useProfileStore((s) => s.unlockedSpecials);

  const [selected, setSelected] = useState<DraftOfferCard | null>(null);

  const offer = run.draft.offer;
  useEffect(() => {
    setSelected(null);
  }, [offer?.lineupId, run.draft.round]);

  const header = useMemo(
    () => (offer ? lineupHeader(offer.lineupId) : null),
    [offer],
  );

  if (!offer || !header) return null;

  const filled = filledCount(run.draft.roster);
  const needed = neededKinds(run.draft.roster);
  const slots = rosterSlots(run.draft.roster);

  const targetSlotLabel = (card: DraftOfferCard): string => {
    if (card.kind === "player") {
      if (card.availability === "as_sub") return DRAFT_UI.slotSub;
      const open = openPlayerSlot(run.draft.roster);
      const n = open === "player1" ? 1 : open === "player2" ? 2 : 3;
      return DRAFT_UI.slotPlayer(n);
    }
    return KIND_LABEL[card.kind];
  };

  return (
    <div className="rise-in">
      <RunStepper run={run} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* ------------------------------------------------ Lineup offer */}
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="kicker mb-1">
                {DRAFT_UI.roundLabel(run.draft.round)} · {DRAFT_UI.pickProgress(filled, 6)}
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

          <div className="flex flex-wrap justify-center gap-3 md:justify-start md:gap-4">
            {offer.cards.map((offerCard) => {
              const resolved = resolveOfferCard(offerCard);
              const isSelected =
                selected?.kind === offerCard.kind && selected?.refId === offerCard.refId;
              const unavailable =
                offerCard.availability === "slot_full" ||
                offerCard.availability === "already_drafted";
              return (
                <GameCard
                  key={`${offerCard.kind}-${offerCard.refId}`}
                  card={resolved}
                  showOverall={run.showOverall}
                  specialCollected={
                    offerCard.specialId ? Boolean(unlockedSpecials[offerCard.specialId]) : true
                  }
                  size="md"
                  selected={isSelected}
                  disabled={unavailable}
                  disabledLabel={
                    offerCard.availability === "slot_full"
                      ? DRAFT_UI.slotFull
                      : DRAFT_UI.alreadyDrafted
                  }
                  asSubHint={
                    offerCard.availability === "as_sub" ? DRAFT_UI.asSubLabel : undefined
                  }
                  onClick={() => setSelected(isSelected ? null : offerCard)}
                />
              );
            })}
          </div>

          {!offer.hasPickableCard ? (
            <Panel className="mt-6 flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-sm text-sub">{DRAFT_UI.skipHint}</p>
              <Button variant="primary" onClick={skipLineup} className="pulse-soft shrink-0">
                {DRAFT_UI.skip}
              </Button>
            </Panel>
          ) : null}
        </div>

        {/* ------------------------------------------------ Roster rail */}
        <aside aria-label={DRAFT_UI.yourRoster}>
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="display text-sm font-bold uppercase tracking-[0.16em] text-ink">
                {DRAFT_UI.yourRoster}
              </h3>
              <span className="display text-sm font-bold text-orange-bright">{filled}/6</span>
            </div>
            <ProgressBar value={filled / 6} tone="orange" className="mb-4" label={DRAFT_UI.yourRoster} />
            <div className="space-y-2">
              {slots.map((s) => (
                <MiniCard
                  key={s.slot}
                  slotLabel={s.label}
                  card={s.card}
                  showOverall={run.showOverall}
                />
              ))}
            </div>
            {needed.length > 0 ? (
              <p className="mt-4 text-[11px] uppercase tracking-wider text-faint">
                {DRAFT_UI.stillNeeded}:{" "}
                <span className="text-sub">
                  {needed.map((k) => KIND_LABEL[k]).join(" · ")}
                </span>
              </p>
            ) : null}
          </Panel>
        </aside>
      </div>

      {/* ------------------------------------------------ Confirm bar */}
      {selected ? (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-6">
          <div className="panel-strong pop-in mx-auto flex max-w-xl items-center justify-between gap-4 p-3 pl-5 shadow-2xl">
            <p className="min-w-0 text-sm text-sub">
              <span className="display block truncate text-base font-bold uppercase tracking-wide text-ink">
                {resolveOfferCard(selected).name}
              </span>
              fills <span className="font-semibold text-orange-bright">{targetSlotLabel(selected)}</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                {DRAFT_UI.cancelPick}
              </Button>
              <Button variant="primary" onClick={() => pickCard(selected)}>
                {DRAFT_UI.confirmPick}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
