"use client";

import { useState } from "react";

/**
 * v2.3 UI (wave 2): the locker room's small parts, shared by the Squad block,
 * the mood sheet, the talk and the HQ card.
 *
 * - The mood is a face drawn in the house icon style (24 grid, 1.8 stroke) and
 *   a word. Only the two extremes carry colour (angry: --bad, delighted:
 *   --good); the three middle moods are the text's own greys (#220).
 * - A player's "face" is his overall in the Draft's rarity frame, as the HQ
 *   reserve row draws it: the game has no portraits, and the card is the
 *   reference object (DESIGN.md).
 */

import type { CareerCopy } from "@/content/careerCopy";
import { moodOf, moraleOf, type LockerDate, type LockerTalk, type MoodId } from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { baseRarityOf } from "@/engine/cards";
import { cx } from "@/lib/util";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort, formatDateTiny } from "@/components/career/dateText";

export const MOOD_TONE: Record<MoodId, string> = {
  angry: "text-bad",
  unhappy: "text-sub",
  neutral: "text-sub",
  content: "text-sub",
  delighted: "text-good",
};

/** The mouth (and, for anger, the brows) of each mood; the head is shared. */
const FACE: Record<MoodId, string[]> = {
  angry: ["M8.5 16.5c1.9-1.6 5.1-1.6 7 0", "M7.5 8.6l2.6 1.2", "M16.5 8.6l-2.6 1.2"],
  unhappy: ["M8.8 16.2c1.8-1.2 4.6-1.2 6.4 0"],
  neutral: ["M9 15.2h6"],
  content: ["M8.8 14.4c1.8 1.4 4.6 1.4 6.4 0"],
  delighted: ["M8 13.6h8c-.4 2.4-2 3.8-4 3.8s-3.6-1.4-4-3.8Z"],
};

export function MoodGlyph({ mood, className = "h-4 w-4" }: { mood: MoodId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9.3" cy="10.6" r=".4" fill="currentColor" />
      <circle cx="14.7" cy="10.6" r=".4" fill="currentColor" />
      {FACE[mood].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The mood as a glyph and a word (U1). `size="lg"` is the sheet's figure. */
export function MoodMark({ mood, C, size = "sm", className }: { mood: MoodId; C: CareerCopy; size?: "sm" | "lg"; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5", MOOD_TONE[mood], className)}>
      <MoodGlyph mood={mood} className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
      <span
        className={cx(
          "display font-semibold uppercase",
          size === "lg" ? "text-2xl font-bold leading-none tracking-[0.03em]" : "text-[11px] tracking-[0.05em]",
          mood === "angry" || mood === "delighted" ? "" : size === "lg" ? "text-ink" : "text-sub",
        )}
      >
        {C.locker.moods[mood]}
      </span>
    </span>
  );
}

/** A player's face: his overall in the Draft's rarity frame. */
export function PlayerFace({ overall, size = "md" }: { overall: number; size?: "sm" | "md" }) {
  const ovr = Math.round(overall);
  return (
    <span
      className={cx(
        "card-frame flex shrink-0 items-center justify-center !rounded-lg",
        `card-${baseRarityOf(ovr)}`,
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
      )}
    >
      <span className={cx("display relative font-bold leading-none text-ink", size === "sm" ? "text-base" : "text-lg")}>{ovr}</span>
    </span>
  );
}

/** "Mon, Oct 12" for a locker-room date. */
export function lockerDateText(C: CareerCopy, d: LockerDate): string {
  return formatDateShort(C.dates, dateOfDay(d.seasonIndex, d.day));
}

/** "Oct 12" for a locker-room date (log rows). */
export function lockerDateTiny(C: CareerCopy, d: LockerDate): string {
  return formatDateTiny(C.dates, dateOfDay(d.seasonIndex, d.day));
}

/** A reason fragment ("he keeps sitting out events") as a sentence. */
export function reasonSentence(C: CareerCopy, reason: string): string {
  const raw = C.locker.reasons[reason] ?? reason;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** A signed morale change, set as a number ("+4", "−3"). */
export function signedDelta(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** U1: the mood on a squad card's footer (the Squad screen's starters). */
export function TileMood({ save, C, playerId }: { save: CareerSave; C: CareerCopy; playerId: string }) {
  return <MoodMark mood={moodOf(moraleOf(save.lockerRoom, playerId))} C={C} />;
}

/**
 * The talks a surface shows: the open ones, plus any answered here, so the
 * outcome stays on screen after the tap (the talk leaves the open list).
 */
export function useShownTalks(save: CareerSave, filter: (t: LockerTalk) => boolean = () => true): { talks: LockerTalk[]; keep: (id: string) => void } {
  const [kept, setKept] = useState<string[]>([]);
  const all = save.lockerRoom?.talks ?? [];
  const inSquad = new Set(save.squad.map((p) => p.id));
  // Oldest first (the earliest deadline), by the id's counter: answering one does not reorder the rest.
  const seqOf = (t: LockerTalk) => Number(t.id.split(":")[1]) || 0;
  const talks = all
    .filter((t) => inSquad.has(t.playerId) && (t.answer === undefined || kept.includes(t.id)) && filter(t))
    .sort((a, b) => seqOf(a) - seqOf(b));
  return { talks, keep: (id) => setKept((k) => (k.includes(id) ? k : [...k, id])) };
}
