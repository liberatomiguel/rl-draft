"use client";

/**
 * Share kit (v2.2): the signed-in player's referral code and how many friends
 * came through it (`lib/referral.ts`, docs/sql/v2.2-referrals.sql). Reads
 * nothing until `active` (an open share sheet, the Home's friends board) and
 * nothing at all for a guest or a build without accounts. At the goal the
 * profile gets the `share-friends-5` mark (the Party Leader banner reads it).
 */

import { useEffect, useState } from "react";
import { useAccountStore } from "@/store/accountStore";
import { useProfileStore } from "@/store/profileStore";
import { FRIENDS_GOAL, FRIENDS_MARK, ensureReferralCode, referralCount } from "@/lib/referral";

export interface ReferralState {
  /** Accounts exist in this build (production). */
  enabled: boolean;
  signedIn: boolean;
  code: string | null;
  /** Friends counted (null = not read yet or unknown). */
  count: number | null;
}

export function useReferral(active: boolean): ReferralState {
  const enabled = useAccountStore((s) => s.enabled);
  const signedIn = useAccountStore((s) => s.status === "signedIn");
  const userId = useAccountStore((s) => s.session?.user.id ?? null);
  const [found, setFound] = useState<{ userId: string; code: string | null; count: number | null } | null>(null);

  useEffect(() => {
    if (!active || !enabled || !signedIn || !userId) return;
    let live = true;
    void Promise.all([ensureReferralCode(userId), referralCount(userId)]).then(([code, count]) => {
      if (!live) return;
      setFound({ userId, code, count });
      if (count !== null && count >= FRIENDS_GOAL) {
        const profile = useProfileStore.getState();
        if (!(profile.careerMarks ?? []).includes(FRIENDS_MARK)) profile.addCareerMarks([FRIENDS_MARK]);
      }
    });
    return () => {
      live = false;
    };
  }, [active, enabled, signedIn, userId]);

  // What was read belongs to the account that read it (a sign-out drops it).
  const mine = found && signedIn && found.userId === userId ? found : null;
  return { enabled, signedIn, code: mine?.code ?? null, count: mine?.count ?? null };
}
