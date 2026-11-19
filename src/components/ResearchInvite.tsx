"use client";

/**
 * The player-research invitation (v2.0.31): a one-off card with a link to the
 * form, at a natural pause (draft results, the career's season review) and only
 * for returning players. Who and how often: `lib/researchInvite.ts`; numbers:
 * `config/research.ts`. Copy comes in as props so the career passes its own
 * group (career copy is read only inside the career folders).
 *
 * It waits for the screen to settle: the caller's own `ready` (ceremonies, the
 * XP count-up, its own dialogs), then every overlay hold, the login calendar
 * and the cosmetic unlock pop-up, then `delayMs`.
 */

import { useEffect, useState } from "react";
import { RESEARCH_INVITE } from "@/config/research";
import { trackEvent } from "@/lib/analytics";
import {
  claimResearchInvite,
  settleResearchInvite,
  type ResearchSignals,
  type ResearchSurface,
} from "@/lib/researchInvite";
import { useCosmeticUnlocks } from "@/store/cosmeticUnlockStore";
import { selectHeld, useOverlayHolds } from "@/store/overlayHoldStore";
import { useRewardToasts } from "@/store/rewardToastStore";
import { Modal } from "@/components/ui/Modal";
import { Button, buttonClass } from "@/components/ui/Button";

export interface ResearchInviteText {
  title: string;
  body: string;
  note: string;
  open: string;
  dismiss: string;
}

interface Props {
  surface: ResearchSurface;
  /** The caller's screen has nothing in front (its ceremonies and dialogs are done). */
  ready: boolean;
  signals: ResearchSignals;
  text: ResearchInviteText;
}

export function ResearchInvite({ surface, ready, signals, text }: Props) {
  const [open, setOpen] = useState(false);
  const held = useOverlayHolds(selectHeld);
  const unlockPending = useCosmeticUnlocks((s) => s.queue.length > 0);
  const loginPending = useRewardToasts((s) => !!s.loginModal);
  const settled = ready && !held && !unlockPending && !loginPending;
  const { activeDays, runsCompleted, careerSeasons } = signals;

  const track = (action: "shown" | "opened" | "dismissed") =>
    trackEvent("research_invite", {
      gameMode: surface,
      action,
      surface,
      campaign: RESEARCH_INVITE.campaign,
      activeDays,
      runsCompleted,
      careerSeasons,
    });

  useEffect(() => {
    if (!settled || open) return;
    const id = setTimeout(() => {
      if (!claimResearchInvite({ activeDays, runsCompleted, careerSeasons })) return;
      setOpen(true);
      track("shown");
    }, RESEARCH_INVITE.delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, open, activeDays, runsCompleted, careerSeasons]);

  const answer = (outcome: "opened" | "dismissed") => {
    settleResearchInvite(outcome);
    track(outcome);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title={text.title}
      onClose={() => answer("dismissed")}
      actions={
        <>
          <Button variant="ghost" onClick={() => answer("dismissed")}>
            {text.dismiss}
          </Button>
          <a
            href={RESEARCH_INVITE.formUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary")}
            onClick={() => answer("opened")}
          >
            {text.open}
          </a>
        </>
      }
    >
      <p>{text.body}</p>
      <p className="mt-3 text-xs text-faint">{text.note}</p>
    </Modal>
  );
}
