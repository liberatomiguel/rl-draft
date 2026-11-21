/**
 * The line of a key moment (engine/career/boxScore.ts) in the player's language.
 * The engine stores the structured event; the wording lives in copy.career.*.
 */
import type { KeyMoment } from "@/engine/career/boxScore";
import type { CareerCopy } from "./copy.career.en";

function clockText(m: Pick<KeyMoment, "period" | "clock">): string {
  const s = Math.max(0, Math.round(m.clock));
  const t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return m.period === "overtime" ? `+${t}` : t;
}

/** `playerName` = the roster name at `moment.playerIdx` (undefined → a neutral noun). */
export function momentText(copy: CareerCopy, moment: KeyMoment, playerName: string | undefined): string {
  const who = playerName ?? copy.moments.unknownPlayer;
  return copy.moments[moment.type][moment.variant](who, clockText(moment), moment.n);
}
