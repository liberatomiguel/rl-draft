/**
 * Who gets the Road to Worlds cloud save (v2.0.26). A rollout switch, not a
 * gameplay value, so it lives here and not in balance.ts.
 *
 * The first release is limited to the `creator` grant (Miguel's account only,
 * his call on 17/11: the 50/50 Staff grant is held by other people) so the account path can be
 * checked in production (staging runs with accounts off). To open it to every
 * signed-in player, set `CAREER_CLOUD_AUDIENCE` to "all" and deploy.
 *
 * The file export / import on the saves screen is NOT behind this: it works for
 * everyone, guests included.
 */

export type CareerCloudAudience = "off" | "staff" | "all";

export const CAREER_CLOUD_AUDIENCE: CareerCloudAudience = "staff";

/** Manual grants (`profile_grants`) that count as Staff for the rollout. */
export const CAREER_CLOUD_STAFF_GRANTS: readonly string[] = ["creator"];

/** True when a signed-in player with these grants gets the account copy. */
export function careerCloudAllowed(
  grants: readonly string[] | null | undefined,
  audience: CareerCloudAudience = CAREER_CLOUD_AUDIENCE,
): boolean {
  if (audience === "all") return true;
  if (audience === "off") return false;
  return (grants ?? []).some((g) => CAREER_CLOUD_STAFF_GRANTS.includes(g));
}
