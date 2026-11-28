"use client";

/**
 * rc9 SHARE (#255): the invitation is words and a link, no image. A
 * first-person message picked by context (`lib/share/inviteText.ts`) and the
 * game's link with its utm tags (and the referral code when signed in, added
 * by the share sheet). On the Home's shared path: light imports only.
 */

import { useMemo } from "react";
import { SITE } from "@/config/site";
import { useCopy, useUiLocale } from "@/content/copy";
import { shareLinkOf } from "@/lib/share/links";
import { hasCareerStoreOnDevice, inviteContextOf, inviteMessage, playsCareer, type InviteContext } from "@/lib/share/inviteText";
import { useProfileStore } from "@/store/profileStore";
import { ShareSheet } from "./ShareSheet";

export function InviteSheet({
  open,
  onClose,
  justWon = false,
  gameMode = "app",
}: {
  open: boolean;
  onClose: () => void;
  justWon?: boolean;
  gameMode?: "draft" | "career" | "app";
}) {
  const { SHARE_UI: S } = useCopy();
  const locale = useUiLocale();
  const marks = useProfileStore((s) => s.careerMarks);
  // The career store is read only while the sheet is open (never on the Home's first paint).
  const context: InviteContext = useMemo(
    () => (open ? inviteContextOf({ justWon, playsCareer: playsCareer(marks, hasCareerStoreOnDevice()) }) : "draft"),
    [open, justWon, marks],
  );
  return (
    <ShareSheet
      open={open}
      onClose={onClose}
      title={S.titleInvite}
      surface="invite"
      gameMode={gameMode}
      text={inviteMessage(context, S)}
      url={shareLinkOf(SITE.url, locale === "pt" ? "/pt" : "/", "invite")}
      fileName="rocket-draft-invite"
      hint={S.inviteHint}
    />
  );
}
