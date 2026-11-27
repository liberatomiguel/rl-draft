"use client";

/**
 * Sponsor offers open as soon as the decision is active.
 *
 * rc9 ORG-UI (#273, root cause of the "reopens on every navigation" report):
 * closing only flipped a local `open` flag, and `canWait` / `onLater` were
 * never read, so the persisted decision stayed unparked and the next mount
 * (every career route) opened it again. Closing now parks the decision when it
 * can wait (the store's `parkDecision`, persisted); on the deadline day it
 * cannot wait, and the modal stays closed until the next mount, as before.
 */

import { useCareerStore } from "@/store/careerStore";
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
  const decline = useCareerStore((s) => s.declineSponsorOffers);
  const [open, setOpen] = useState(true);
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  const close = () => {
    setOpen(false);
    if (canWait) onLater();
  };
  return (
    <>
      {!open ? <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{C.hub.sponsorSeeOffers}</Button> : null}
      <Modal
        open={open}
        title={C.finances.offerTitle}
        wide
        onClose={close}
        actions={
          <>
            {canWait ? <Button variant="ghost" onClick={close}>{C.hub.later}</Button> : null}
            <Button variant="danger" onClick={decline}>{C.market.decline}</Button>
          </>
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
