"use client";

/**
 * rc9 SHARE: the invitation sheet (words and a link, #255) and the two share
 * prompts (#256 the invite, once ever; #257 the share image after a title,
 * sparse). Who and when: `lib/share/sharePrompts.ts`; numbers:
 * `SHARE_PROMPTS` in balance.
 *
 * A prompt waits for the screen to settle: the caller's own `ready`, then no
 * overlay hold (ceremonies, a share sheet, the first-run tour), no cosmetic
 * unlock and no login calendar waiting, then `delayMs`; at that moment no
 * other dialog may be open, or the moment passes. While a prompt is up it
 * holds the quieter pop-ups back, so two dialogs never stack.
 */

import { useEffect, useState } from "react";
import { SHARE_PROMPTS } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { trackEvent } from "@/lib/analytics";
import { claimImagePrompt, claimInvitePrompt, optOutImagePrompt, type InviteSignals } from "@/lib/share/sharePrompts";
import { useCosmeticUnlocks } from "@/store/cosmeticUnlockStore";
import { selectHeld, useOverlayHold, useOverlayHolds } from "@/store/overlayHoldStore";
import { useRewardToasts } from "@/store/rewardToastStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InviteSheet } from "./InviteSheet";

/** Nothing else on screen: no hold, no unlock or login pop-up waiting, no open dialog. */
function useScreenClear(ready: boolean): boolean {
  const held = useOverlayHolds(selectHeld);
  const unlockPending = useCosmeticUnlocks((s) => s.queue.length > 0);
  const loginPending = useRewardToasts((s) => !!s.loginModal);
  return ready && !held && !unlockPending && !loginPending;
}

function dialogOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

export interface SharePromptsProps {
  gameMode: "draft" | "career";
  /** The caller's screen has nothing of its own in front. */
  ready: boolean;
  /** A title just won (a run's or an event's key), or null: no share-image prompt. */
  titleKey: string | null;
  /** The pause as an invite moment, or null: no invite prompt here. */
  invite: InviteSignals | null;
  /** Draws the post the share-image prompt previews. */
  preview?: () => Promise<HTMLCanvasElement>;
  /** "Share" on the image prompt: open the caller's share sheet. */
  onShareImage?: () => void;
  /** The dev bench only: open this prompt now, without the rules or the record. */
  forceShow?: "image" | "invite" | null;
  /** The dev bench only: a forced prompt was closed. */
  onForcedClose?: () => void;
}

export function SharePrompts({ gameMode, ready, titleKey, invite, preview, onShareImage, forceShow = null, onForcedClose }: SharePromptsProps) {
  const { SHARE_UI: S } = useCopy();
  const clear = useScreenClear(ready);
  const [claimed, setShown] = useState<"image" | "invite" | null>(null);
  const shown = forceShow ?? claimed;
  const [inviteSheet, setInviteSheet] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // While a prompt is up, the quieter pop-ups (and the research card) wait.
  useOverlayHold("ceremony", shown !== null);

  const inviteKey = invite ? `${invite.moment}:${invite.placement ?? ""}:${invite.careerSeasons}` : null;
  useEffect(() => {
    if (!clear || shown) return;
    const id = window.setTimeout(() => {
      if (dialogOpen()) return; // another dialog took the moment
      if (titleKey && preview && claimImagePrompt(titleKey)) {
        setShown("image");
        trackEvent("share_prompt", { kind: "image", action: "shown", gameMode });
        return;
      }
      if (invite && claimInvitePrompt(invite)) {
        setShown("invite");
        trackEvent("share_prompt", { kind: "invite", action: "shown", gameMode });
      }
    }, SHARE_PROMPTS.delayMs);
    return () => window.clearTimeout(id);
    // `invite` is read through its key: a new object with the same facts is the same moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clear, shown, titleKey, inviteKey, gameMode]);

  // The preview is drawn when the image prompt opens, never before.
  useEffect(() => {
    if (shown !== "image" || !preview) return;
    let live = true;
    preview()
      .then((c) => live && setPreviewUrl(c.toDataURL("image/png")))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [shown, preview]);

  const close = (kind: "image" | "invite", action: "accepted" | "dismissed" | "optedOut") => {
    trackEvent("share_prompt", { kind, action, gameMode });
    setShown(null);
    if (forceShow) onForcedClose?.();
  };

  return (
    <>
      <Modal
        open={shown === "invite"}
        title={S.promptInviteTitle}
        onClose={() => close("invite", "dismissed")}
        actions={
          <>
            <Button variant="ghost" onClick={() => close("invite", "dismissed")}>
              {S.promptLater}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                close("invite", "accepted");
                setInviteSheet(true);
              }}
            >
              {S.promptInviteGo}
            </Button>
          </>
        }
      >
        <p>{S.promptInviteBody}</p>
      </Modal>

      <Modal
        open={shown === "image"}
        title={S.promptImageTitle}
        onClose={() => close("image", "dismissed")}
        actions={
          <>
            <Button variant="ghost" onClick={() => close("image", "dismissed")}>
              {S.promptLater}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                close("image", "accepted");
                onShareImage?.();
              }}
            >
              {S.promptImageGo}
            </Button>
          </>
        }
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a canvas data URL
          <img src={previewUrl} alt={S.previewAlt} width={1200} height={630} className="h-auto w-full rounded-lg border border-line" />
        ) : (
          <div aria-busy aria-label={S.rendering} className="flex aspect-[1200/630] w-full items-center justify-center rounded-lg border border-line text-sm text-faint">
            {S.rendering}
          </div>
        )}
        {/* The opt-out is a quiet line under the preview, so the actions stay two. */}
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center text-sm text-faint underline-offset-4 transition-colors hover:text-sub hover:underline"
          onClick={() => {
            optOutImagePrompt();
            close("image", "optedOut");
          }}
        >
          {S.promptImageNever}
        </button>
      </Modal>

      <InviteSheet open={inviteSheet} onClose={() => setInviteSheet(false)} justWon={titleKey !== null} gameMode={gameMode} />
    </>
  );
}
