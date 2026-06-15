/** Roster → ordered, labeled, resolved slots for rails/review/results. */

import { DRAFT_UI } from "@/content/copy.en";
import { resolvePick, type ResolvedCard } from "@/engine/cards";
import type { Roster, RosterSlotId } from "@/engine/types";

export interface RosterSlotView {
  slot: RosterSlotId;
  label: string;
  card: ResolvedCard | null;
}

export function rosterSlots(roster: Roster): RosterSlotView[] {
  const order: { slot: RosterSlotId; label: string }[] = [
    { slot: "player1", label: DRAFT_UI.slotPlayer(1) },
    { slot: "player2", label: DRAFT_UI.slotPlayer(2) },
    { slot: "player3", label: DRAFT_UI.slotPlayer(3) },
    { slot: "coach", label: DRAFT_UI.slotCoach },
    { slot: "sub", label: DRAFT_UI.slotSub },
    { slot: "org", label: DRAFT_UI.slotOrg },
  ];
  return order.map(({ slot, label }) => ({
    slot,
    label,
    card: roster[slot] ? resolvePick(roster[slot]!) : null,
  }));
}
