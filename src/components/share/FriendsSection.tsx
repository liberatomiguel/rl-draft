"use client";

/**
 * Share kit (v2.2): the Home's "With friends" section, a pair of boards.
 * The friend duel (rc9 duel-ui: team against team) opens /duel, where the
 * rules are set and the draft starts; the invitation sends the game itself.
 *
 * On the shared path: no dataset and no run store here.
 */

import { Suspense, lazy, useState } from "react";
import { useCopy } from "@/content/copy";
import { sfx } from "@/lib/sfx";
import { cx } from "@/lib/util";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
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
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <h2 className="title-slab mt-12 text-xl md:text-2xl">{S.sectionFriends}</h2>
      <section className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        {/* rc9 duel-ui: team against team; the rules and the draft start on /duel. */}
        <Panel className="flex flex-col justify-between gap-3 p-4 sm:gap-5 sm:p-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="display text-lg uppercase leading-none text-ink">{S.duelTitle}</h3>
              {/* The best of 7 as the series pips the duel fills: four games to win each side. */}
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span key={`a${i}`} className="h-1.5 w-3 rounded-[1px] bg-orange-bright/70" />
                ))}
                <span className="w-1.5" />
                {[0, 1, 2, 3].map((i) => (
                  <span key={`b${i}`} className="h-1.5 w-3 rounded-[1px] bg-blue-bright/70" />
                ))}
              </span>
            </div>
            <p className="mt-2 max-w-md text-sm leading-snug text-sub">{S.duelDesc}</p>
          </div>
          <AppLink href="/duel" onClick={() => sfx.click()} className={cx(buttonClass("secondary"), "self-start max-sm:w-full")}>
            {S.duelStart}
          </AppLink>
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
