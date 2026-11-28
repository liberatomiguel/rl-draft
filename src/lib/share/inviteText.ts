/**
 * rc9 SHARE: the invitation is words and a link (DESIGN-DECISIONS #255). The
 * message is picked by context, first person, as a player would text a friend:
 *
 *  · "won"    the player just won a title (the invite prompt after a podium)
 *  · "career" the player has a Road to Worlds career
 *  · "draft"  everyone else
 *
 * Light on purpose: the Home imports it (shared path), so no store and no
 * dataset; the caller passes what it knows.
 */

export type InviteContext = "won" | "career" | "draft";

/** Marks on the profile that are not a career's (the draft's run marks, the share marks). */
const NON_CAREER_MARK = /^(run-|share-)/;

/**
 * Whether this player plays the career: a career achievement mirrored on the
 * profile, or a career store on this device.
 */
export function playsCareer(careerMarks: readonly string[] | null | undefined, hasCareerStore: boolean): boolean {
  return hasCareerStore || (careerMarks ?? []).some((m) => !NON_CAREER_MARK.test(m));
}

export function inviteContextOf(opts: { justWon?: boolean; playsCareer: boolean }): InviteContext {
  if (opts.justWon) return "won";
  return opts.playsCareer ? "career" : "draft";
}

export interface InviteTextCopy {
  inviteTextDraft: string;
  inviteTextCareer: string;
  inviteTextWon: string;
}

export function inviteMessage(context: InviteContext, S: InviteTextCopy): string {
  return context === "won" ? S.inviteTextWon : context === "career" ? S.inviteTextCareer : S.inviteTextDraft;
}

/** The career store's key on this device (read only to pick the message). */
export const CAREER_STORE_KEY = "rocket-draft:career:v1";

export function hasCareerStoreOnDevice(): boolean {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CAREER_STORE_KEY) : null;
    if (!raw) return false;
    const slots = (JSON.parse(raw) as { state?: { slots?: unknown[] } })?.state?.slots;
    return Array.isArray(slots) && slots.some(Boolean);
  } catch {
    return false;
  }
}
