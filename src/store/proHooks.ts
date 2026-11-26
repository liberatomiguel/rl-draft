/**
 * v2.2 Pro spine (PROSPINE, R-PROSPINE-1): the one place careerFlow lets the
 * player career look inside a day. `careerFlow.resolveAiEvent` hands every
 * AI event it simulates to `onAiEvent`, which is null except while
 * `proFlow` runs the Pro's hidden host day (so it can show a signed Pro his
 * org's series). An observer only reads: the manager's save is the same
 * with or without one (proSpine.managerIdentity.test.ts).
 */

import type { CareerEventDef } from "@/engine/career/types";
import type { TournamentState } from "@/engine/types";

export const proHooks: {
  onAiEvent: ((def: CareerEventDef, state: TournamentState) => void) | null;
} = { onAiEvent: null };
