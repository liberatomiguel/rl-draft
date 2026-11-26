"use client";

/** v2.2 Pro spine (PROSPINE): his team, the lineup, the coach's trust and the contract. */

import { CAREER_PRO_ORG } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import type { ProSave } from "@/engine/career/pro/types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { canRequestProTransfer, proRosterOf, proTeamNameOf, requestProTransferFlow } from "@/store/proFlow";
import { rotationCountdownOf, rotationEveryFor } from "@/store/proMatch";
import { useProStore } from "@/store/proStore";

export function ProTeam({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const T = C.proWorld.team;
  const apply = useProStore((s) => s.apply);
  const name = proTeamNameOf(save);
  const roster = proRosterOf(save);
  if (!name || roster.length === 0) return <p className="text-sm text-sub">{T.none}</p>;
  const trust = Math.round(save.coachTrust ?? CAREER_PRO_ORG.trustStart);
  const c = save.contract;

  return (
    <div className="space-y-5">
      <div>
        <p className="kicker">{T.title}</p>
        <h3 className="display mt-1 text-xl font-bold uppercase leading-none text-ink">{name}</h3>
        {save.stage === "amateur" && save.amateur ? <p className="mt-1 text-xs text-sub">{T.sideLevel(Math.floor(save.amateur.level))}</p> : null}
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className={p.isPro ? "font-semibold text-ink" : "text-ink"}>
              {p.name}
              {p.isPro ? <span className="ml-2 text-xs text-orange">{T.you}</span> : null}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-sub">{p.starter ? T.starter : T.bench}</span>
              <span className="display w-8 text-right font-bold text-ink">{Math.floor(p.overall)}</span>
            </span>
          </li>
        ))}
      </ul>

      {save.stage === "org" && c ? (
        <>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-sub">{T.trust}</span>
              <span className="display font-bold text-ink">{trust}</span>
            </div>
            <ProgressBar value={trust / 100} tone="blue" className="mt-1.5" label={T.trust} />
            <p className="mt-1.5 text-xs leading-snug text-faint">{T.trustHint}</p>
          </div>
          <div className="text-sm text-sub">
            <p>{T.contract(formatMoney(c.salaryPerSplit), c.endSeason + 1)}</p>
            <p className="mt-1">{T.promised(C.proWorld.offers.role[c.role])}</p>
            {rotationCountdownOf(save) !== null ? (
              <p className="mt-1">
                {T.rotationShare(rotationEveryFor(save.difficulty))} {T.nextRotation(rotationCountdownOf(save)!)}
              </p>
            ) : null}
            {c.role === "rotation" ? <p className="mt-1">{T.review(save.roleReview?.left ?? CAREER_PRO_ORG.reviewAfter)}</p> : null}
          </div>
          {c.transferRequested ? (
            <p className="text-sm text-sub">{T.requested}</p>
          ) : canRequestProTransfer(save) ? (
            <div>
              <Button variant="secondary" onClick={() => apply(requestProTransferFlow)}>
                {T.requestTransfer}
              </Button>
              <p className="mt-1.5 text-xs leading-snug text-faint">{T.requestHint}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
