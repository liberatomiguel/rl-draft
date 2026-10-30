"use client";

/**
 * Road to Worlds — the sponsor choice in HQ (rc.36, front S2; Miguel on
 * rc.35: "the sponsor choice leaves the calendar block and opens as a
 * pop-up, one card per sponsor; only 'Decide later', without a stroke").
 *
 * The decision block only PROMPTS the choice: an icon, who is offering (one
 * chip per brand in its profile's colour) and until when, "See the offers"
 * and — before the deadline day — "Decide later" (a plain ghost button: it
 * parks the decision, HQ 1-B). The offers open in a pop-up (the shared
 * Modal: a portal on <body>, the focus kept inside, Escape and the close
 * button) with one card per sponsor (`SponsorDecision`, the same cards
 * Finances shows). On the deadline day the block says the clock waits for a
 * pick (CAREER_SPONSOR.deadlineRule "hold"), or that the safest deal is
 * signed for the manager ("signSafest").
 */

import { useState } from "react";
import { CAREER_SPONSOR } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { sponsorBrandById } from "@/data/career/sponsors";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { sponsorDecisionOf } from "@/store/careerFlow";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { Button } from "@/components/ui/Button";
import { CalendarIcon, HandshakeIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { SPONSOR_ACCENT, SponsorDecision } from "./SponsorOfferCard";

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
  const [open, setOpen] = useState(false);
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  const T = C.finances.deal;
  const by = formatDateShort(C.dates, dateOfDay(decision.deadlineOn.seasonIndex, decision.deadlineOn.day));
  const due = canWait
    ? C.hub.sponsorDueBy(by)
    : CAREER_SPONSOR.deadlineRule === "signSafest"
      ? C.hub.sponsorAutoSign(by)
      : C.hub.lastDay;
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan/40 bg-cyan/10 text-cyan">
          <HandshakeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="kicker text-[10px] text-cyan">{C.hub.decisionKind.sponsor}</p>
          <h2 className="display text-lg font-bold uppercase leading-tight tracking-wide text-ink sm:text-xl">
            {C.hub.sponsorPromptTitle(decision.offers.length)}
          </h2>
        </div>
      </div>

      {/* Who is offering: one chip per brand, in its profile's colour. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {decision.offers.map((o) => {
          const profile = o.terms?.profile ?? "balanced";
          const a = SPONSOR_ACCENT[profile] ?? SPONSOR_ACCENT.balanced;
          return (
            <span
              key={o.sponsorId}
              className={cx("inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border bg-white/[0.03] px-2", a.border)}
            >
              <span className={cx("h-2 w-2 shrink-0 rounded-full", a.bar)} aria-hidden />
              <span className="truncate text-[11px] font-semibold text-ink">{sponsorBrandById.get(o.sponsorId)?.name ?? o.sponsorId}</span>
              <span className={cx("shrink-0 text-[10px] font-semibold uppercase", a.text)}>{T.profile[profile] ?? profile}</span>
            </span>
          );
        })}
      </div>

      <p className={cx("mt-2.5 flex items-center gap-1.5 text-xs font-semibold", canWait ? "text-sub" : "text-orange-bright")}>
        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
        {due}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="md" className="min-h-11" onClick={() => setOpen(true)}>
          {C.hub.sponsorSeeOffers}
        </Button>
        {canWait ? (
          <Button variant="ghost" size="md" className="min-h-11" onClick={onLater}>
            {C.hub.sponsorLater}
          </Button>
        ) : null}
      </div>

      <Modal
        open={open}
        title={C.finances.offerTitle}
        wide
        onClose={() => setOpen(false)}
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
    </div>
  );
}
