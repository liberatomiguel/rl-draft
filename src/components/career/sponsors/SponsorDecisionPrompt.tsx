"use client";

/** Sponsor offers open as soon as the decision is active. Closing before
 * the deadline parks the existing persisted decision; deadline holds remain. */

import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { sponsorDecisionOf } from "@/store/careerFlow";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SponsorDecision } from "./SponsorOfferCard";

export function SponsorDecisionPrompt({
  save,
  C,
  canWait,
  onSign,
  onLater,
}: {
  save: CareerSave;
  C: CareerCopy;
  /** HQ 1-B: "Decide later" is offered (before the deadline day). */
  canWait: boolean;
  onSign: (sponsorId: string) => void;
  /** Park the decision until its deadline day. */
  onLater: () => void;
}) {
  const [open, setOpen] = useState(true);
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  return (
    <>
      {!open ? <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{C.hub.sponsorSeeOffers}</Button> : null}
      <Modal
        open={open}
        title={C.finances.offerTitle}
        wide
        onClose={() => {
          setOpen(false);
          if (canWait) onLater();
        }}
        actions={
          canWait ? (
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onLater();
              }}
            >
              {C.hub.sponsorLater}
            </Button>
          ) : undefined
        }
      >
        <SponsorDecision
          save={save}
          bare
          onSign={(id) => {
            setOpen(false);
            onSign(id);
          }}
        />
      </Modal>
    </>
  );
}
