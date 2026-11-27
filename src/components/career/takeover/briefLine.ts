/**
 * v2.2 rc.6 (ORGMODE UI-A): the board's brief (the ENGINE front's optional
 * `board.season.brief`) as a line of copy, when the copy carries one for its
 * kind under `C.board.brief` (a string, or a function of the brief's facts).
 * Absent brief or absent copy: null, and the screens show the plan alone.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { TakeoverPreview } from "@/store/takeoverPreview";

export function briefLineOf(C: CareerCopy, brief: TakeoverPreview["brief"]): string | null {
  if (!brief) return null;
  const group = (C.board as unknown as { brief?: Record<string, unknown> }).brief;
  const line = group?.[brief.kind];
  if (typeof line === "function") return String((line as (b: unknown) => unknown)(brief));
  return typeof line === "string" ? line : null;
}
