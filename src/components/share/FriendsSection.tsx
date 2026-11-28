"use client";

/**
 * Share kit (v2.2): the Home's "With friends" section, a pair of boards.
 * The friend duel starts from the Home in one click (a Classic draft on the
 * player's last difficulty and overall setting, a fresh seed; the link goes
 * out from the results), and the invitation sends the game itself.
 *
 * On the shared path: no dataset, no run store until the duel is clicked
 * (`lazyRunStore`), and the duel rules are the pure `engine/duel`.
 */

import { useRouter } from "next/navigation";
import { Suspense, lazy, useState } from "react";
import { useCopy } from "@/content/copy";
import { freshDuel } from "@/engine/duel";
import type { Difficulty } from "@/engine/types";
import { randomSeed } from "@/lib/rng";
import { sfx } from "@/lib/sfx";
import { loadRunStore } from "@/store/lazyRunStore";
import { selectHardUnlocked, selectLegacyUnlocked, useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { InviteSheet } from "./InviteSheet";
import { useReferral } from "./useReferral";
import { cosmeticById } from "@/data/cosmetics";
import { FRIENDS_GOAL, PARTY_LEADER_ID } from "@/lib/referral";

// rc9 SHARE: the dev server's share preview bench (window.__rdShare). The
// branch is constant-folded away in a production build, the chunk with it.
const SharePreviewDev =
  process.env.NODE_ENV === "development" ? lazy(() => import("./SharePreviewDev").then((m) => ({ default: m.SharePreviewDev }))) : null;

export function FriendsSection() {
  const { SHARE_UI: S, COSMETICS } = useCopy();
  // Friends who came through the player's links (signed in, production build).
  const referral = useReferral(true);
  const bannerName = cosmeticById.has(PARTY_LEADER_ID)
    ? ((COSMETICS.items as Record<string, { name: string } | undefined>)[PARTY_LEADER_ID]?.name ?? null)
    : null;
  const router = useRouter();
  const settings = useProfileStore((s) => s.settings);
  const hardUnlocked = useProfileStore(selectHardUnlocked);
  const legacyUnlocked = useProfileStore(selectLegacyUnlocked);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const startDuel = () => {
    if (starting) return;
    sfx.click();
    setStarting(true);
    const last = settings.lastDifficulty;
    const difficulty: Difficulty =
      (last === "legacy" && !legacyUnlocked) || (last === "hard" && !hardUnlocked) ? "normal" : last;
    void loadRunStore()
      .then(({ useRunStore }) =>
        useRunStore
          .getState()
          .startDuel(freshDuel({ mode: "classic", difficulty, region: null, showOverall: settings.lastShowOverall }, randomSeed())),
      )
      .catch(() => {})
      .then(() => router.push("/play"));
  };

  return (
    <>
      <h2 className="title-slab mt-12 text-xl md:text-2xl">{S.sectionFriends}</h2>
      <section className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <Panel className="flex flex-col justify-between gap-3 p-4 sm:gap-5 sm:p-6">
          <div>
            <h3 className="display text-lg uppercase leading-none text-ink">{S.duelTitle}</h3>
            <p className="mt-2 max-w-md text-sm leading-snug text-sub">{S.duelDesc}</p>
          </div>
          <Button variant="secondary" className="self-start max-sm:w-full" disabled={starting} onClick={startDuel}>
            {S.duelStart}
          </Button>
        </Panel>
        <Panel className="flex flex-col justify-between gap-3 p-4 sm:gap-5 sm:p-6">
          <div>
            <h3 className="display text-lg uppercase leading-none text-ink">{S.inviteRowTitle}</h3>
            <p className="mt-2 max-w-md text-sm leading-snug text-sub">{S.inviteRowDesc}</p>
            {referral.signedIn && referral.count !== null ? (
              <p className="mt-2 text-sm leading-snug text-ink">
                {bannerName ? S.referralGoal(referral.count, FRIENDS_GOAL, bannerName) : S.referralCount(referral.count)}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" className="self-start max-sm:w-full" onClick={() => setInviteOpen(true)}>
            {S.inviteButton}
          </Button>
        </Panel>
      </section>
      {/* rc9 SHARE (#255): the invitation is a message and the link, no image. */}
      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {SharePreviewDev ? (
        <Suspense fallback={null}>
          <SharePreviewDev />
        </Suspense>
      ) : null}
    </>
  );
}
