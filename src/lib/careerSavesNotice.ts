/**
 * v2.0.34 (player survey, 18/11): players asked for "more than one career"
 * and "the same career on PC and phone" — both exist since v2.0.26/v2.0.30,
 * nobody had told them. A one-off card on the career HQ says so.
 *
 * Who: a career already under way (past its opening weeks), so a brand-new
 * player's first HQ keeps the guided tour alone. Once: the answer lives in its
 * own plain localStorage key per device (not a zustand store, so the frozen
 * persist contract does not move; not in the save, so the account copy and the
 * local one never differ over it). Storage blocked or missing: memory only.
 */
import { CAREER_SAVES_NOTICE } from "@/config/balance";

export const CAREER_SAVES_NOTICE_KEY = "rocket-draft:career-saves-notice:v1";

let memory: string | null = null;

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(CAREER_SAVES_NOTICE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

/** Whether the card may open on this device for a career at this point of its calendar. */
export function careerSavesNoticeDue(clock: { seasonIndex: number; day: number }, startSeasonIndex = 0): boolean {
  if (read() !== null) return false;
  // v2.2 ORGMODE-2027: the career's own first season, whatever era it started at.
  return clock.seasonIndex - startSeasonIndex > 0 || clock.day >= CAREER_SAVES_NOTICE.minDay;
}

/** The player answered (opened the list or dismissed): never again on this device. */
export function settleCareerSavesNotice(outcome: "opened" | "dismissed"): void {
  memory = outcome;
  try {
    globalThis.localStorage?.setItem(CAREER_SAVES_NOTICE_KEY, outcome);
  } catch {
    /* memory only */
  }
}

/** Tests only. */
export function resetCareerSavesNoticeForTests(): void {
  memory = null;
  try {
    globalThis.localStorage?.removeItem(CAREER_SAVES_NOTICE_KEY);
  } catch {
    /* none */
  }
}
