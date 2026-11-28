/**
 * rc9 ORG-UI: the takeover's creation input and the manager's name rule, out
 * of the pick screen so a test can build the same input the button does.
 *
 * The name travels in `identity.managerName` through `careerStore.createCareer`
 * -> `careerFlow.createCareerSave`, which every reader uses (the arrival splash,
 * the board's welcome and owner mails via `boardFlow`, the share image). No
 * store change: the input always carried it; the screen now lets the player
 * type it (Miguel, 27/11: "não dá para adicionar seu nome").
 */

import { abbrevFor, type RealOrgChoice } from "@/engine/career/orgProfile";
import type { CareerDifficulty } from "@/engine/career/types";
import type { CreateCareerInput } from "@/store/careerFlow";
import { proceduralCrestFor } from "@/components/career/OrgMark";

/** The founded wizard's rule (WizardScreen): up to 24 characters, at least 2 once trimmed. */
export const MANAGER_NAME_MAX = 24;
export const MANAGER_NAME_MIN = 2;

/** The name the save gets: what the player typed when it is long enough, otherwise the generated fallback. */
export function managerNameFor(typed: string, fallback: string): string {
  const t = typed.trim().slice(0, MANAGER_NAME_MAX);
  return t.length >= MANAGER_NAME_MIN ? t : fallback;
}

/** The takeover's input: the button and the file build the SAME one (the manager's name aside, which no rule reads). */
export function takeoverInputOf(c: RealOrgChoice, difficulty: CareerDifficulty, managerName: string, startSeasonIndex?: number): CreateCareerInput {
  const crest = proceduralCrestFor(c.ref, c.name);
  return {
    identity: {
      orgName: c.name,
      abbrev: abbrevFor(c.name),
      managerName,
      // The roster's nationality; the org's procedural crest is kept for old readers (UserOrgMark shows the real logo).
      country: c.country,
      region: c.region,
      crestId: crest.crestId,
      colors: crest.colors,
      buffType: "offense",
    },
    difficulty,
    rosterKey: "balanced",
    realOrgRef: c.ref,
    ...(startSeasonIndex ? { startSeasonIndex } : {}),
  };
}
