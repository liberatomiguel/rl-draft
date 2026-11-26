/**
 * v2.2 Pro (PRO-SPEC §8, R150): scene nicknames earned by milestones the save
 * can verify. About a dozen, none that could read as an insult, at most one
 * active. The ids are the contract: the copy (proCard.nicknames) names them in
 * EN and PT, the card carries the id and the page translates it.
 */

import { CAREER_PRO_NICKNAMES as N } from "@/config/balance";

export type NicknameId = (typeof N)[number]["id"];
export type NicknameFact = (typeof N)[number]["fact"];

/** The career totals the spine keeps (every one a count it can prove from results and box scores). */
export type NicknameFacts = Partial<Record<NicknameFact, number>>;

export const NICKNAME_IDS: readonly NicknameId[] = N.map((n) => n.id);

/** Every nickname the facts earn, best-ranked first. */
export function earnedNicknames(facts: NicknameFacts): NicknameId[] {
  return N.filter((n) => (facts[n.fact] ?? 0) >= n.min).map((n) => n.id);
}

/**
 * The one active nickname. A nickname already worn stays while it is still
 * earned unless a better-ranked one has been earned since; with none earned,
 * null (a nickname is never taken once the facts hold).
 */
export function activeNickname(facts: NicknameFacts, current?: string | null): NicknameId | null {
  const earned = earnedNicknames(facts);
  if (earned.length === 0) return null;
  const best = earned[0];
  if (current && (earned as string[]).includes(current)) {
    return NICKNAME_IDS.indexOf(best) < NICKNAME_IDS.indexOf(current as NicknameId) ? best : (current as NicknameId);
  }
  return best;
}

/** What a nickname still asks for (the card's and the profile's hint). */
export function nicknameProgress(id: NicknameId, facts: NicknameFacts): { have: number; need: number } {
  const n = N.find((x) => x.id === id)!;
  return { have: facts[n.fact] ?? 0, need: n.min };
}
