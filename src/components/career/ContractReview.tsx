"use client";

/**
 * Road to Worlds — the explicit contract review before the rollover (rc.34,
 * ROADMAP UX-06b). On the season screen, above the "next season" action: who
 * leaves when the season turns (careerDecisions.leavingAtRolloverOf), the way
 * to renew them (Squad), and the answer that lets them go
 * (reviewContractsFlow). The rollover stays refused until it is given
 * (continueToNextSeasonFlow — the decision queue's "contractReview"), and a
 * decision still holding at HQ (a bid on its last day) says so here.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { useCareerStore } from "@/store/careerStore";
import { contractReviewFlagFor, leavingAtRolloverOf, rolloverHoldOf } from "@/store/careerDecisions";
import { squadAge, wageLabel } from "@/components/career/careerUi";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

/** True while the season's continue is refused (the review, or another decision at HQ). */
export function rolloverBlocked(save: CareerSave): boolean {
  return rolloverHoldOf(save) !== null;
}

export function ContractReview({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const reviewContracts = useCareerStore((s) => s.reviewContracts);
  if (save.phase !== "seasonReview") return null;
  const leaving = leavingAtRolloverOf(save);
  const reviewed = Boolean(save.flags[contractReviewFlagFor(save.clock.seasonIndex)]);
  const hold = rolloverHoldOf(save);
  const otherHold = hold && hold.kind !== "contractReview" ? hold : null;
  if (leaving.length === 0 && !otherHold) return null;

  return (
    <Panel glow={reviewed ? undefined : "orange"} className="rise-in p-4 sm:p-5">
      {leaving.length > 0 ? (
        <>
          <p className="kicker mb-1 text-[10px] text-orange-bright">{C.squad.reviewTitle}</p>
          <p className="text-sm text-sub">{C.squad.reviewBody(leaving.length)}</p>
          <ul className="mt-3 space-y-1.5">
            {leaving.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.name}</span>
                <span className="text-sub">
                  {Math.round(p.overall)} {C.common.ovr} · {C.player.age(squadAge(save, p))}
                </span>
                <span className="text-faint">{wageLabel(C, p.salaryPerSplit)}</span>
              </li>
            ))}
          </ul>
          {reviewed ? (
            <p className="mt-3 text-xs font-semibold text-good">{C.squad.reviewDone}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <AppLink href="/career/squad" className={buttonClass("secondary", "md") + " min-h-11"}>
                {C.squad.reviewRenew}
              </AppLink>
              <Button variant="danger" size="md" className="min-h-11" onClick={reviewContracts}>
                {C.squad.reviewConfirm(leaving.length)}
              </Button>
            </div>
          )}
        </>
      ) : null}
      {otherHold ? (
        <AppLink href="/career" className="mt-3 flex min-h-11 items-center text-xs font-semibold text-orange-bright hover:underline">
          {C.squad.reviewHeld} →
        </AppLink>
      ) : null}
    </Panel>
  );
}
