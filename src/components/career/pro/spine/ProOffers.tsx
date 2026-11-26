"use client";

/**
 * v2.2 Pro spine (PROSPINE): the offers. Each one is fixed when it arrives
 * (re-opening shows the same terms) and closes on its date. An org offer
 * takes one counter, with the risk of the org walking away shown first.
 */

import { CAREER_PRO_ORG } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { weekOfDay } from "@/engine/career/calendar";
import type { ProOffer } from "@/engine/career/pro/spineTypes";
import type { ProSave } from "@/engine/career/pro/types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { acceptProOfferFlow, counterProOfferFlow, declineProOfferFlow, openProOffersOf, proOfferBlockOf } from "@/store/proFlow";
import { useProStore } from "@/store/proStore";

export function ProOffers({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const O = C.proWorld.offers;
  const open = openProOffersOf(save);
  const past = save.offers.filter((o) => o.status !== "open").slice(-6).reverse();

  return (
    <div className="space-y-4">
      {open.length === 0 ? <p className="text-sm leading-snug text-sub">{O.none}</p> : null}
      {open.map((o) => (
        <OfferCard key={o.id} save={save} offer={o} />
      ))}
      {past.length > 0 ? (
        <div>
          <p className="kicker mb-2">{O.history}</p>
          <ul className="divide-y divide-line border-y border-line text-sm">
            {past.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-2">
                <span className="text-ink">{o.name}</span>
                <span className="text-xs text-sub">{O.status[o.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OfferCard({ save, offer: o }: { save: ProSave; offer: ProOffer }) {
  const C = useCareerCopy();
  const O = C.proWorld.offers;
  const apply = useProStore((s) => s.apply);
  const block = proOfferBlockOf(save, o.id);
  const kindLabel = o.kind === "amateur" ? O.amateur : o.kind === "renewal" ? O.renewal : O.org;
  const reason = O.reason[o.reason.key]?.(o.reason.params) ?? "";

  return (
    <Panel className="p-4 sm:p-5">
      <p className="kicker">{kindLabel}</p>
      <h3 className="display mt-1 text-lg font-bold uppercase leading-none text-ink">{o.name}</h3>
      {o.kind === "amateur" ? (
        <>
          <p className="mt-2 text-sm leading-snug text-sub">{O.sideBody(Math.floor(o.level))}</p>
          {save.stage === "amateur" && save.amateur ? <p className="mt-1 text-sm leading-snug text-sub">{O.leavesSide(save.amateur.name)}</p> : null}
        </>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-sub">{O.role[o.role]}</dt>
            <dd className="text-right text-ink">{O.seasons(o.lengthSeasons)}</dd>
            <dt className="text-sub">{O.level(Math.floor(o.level))}</dt>
            <dd className="text-right font-semibold text-ink">{O.salary(formatMoney(o.salaryPerSplit))}</dd>
          </dl>
          <p className="mt-3 text-sm leading-snug text-sub">{reason}</p>
          {o.counter === "improved" ? <p className="mt-2 text-sm text-good">{O.improved}</p> : null}
        </>
      )}
      <p className="mt-2 text-xs text-faint">{O.expires(o.expiresSeason + 1, weekOfDay(o.expiresDay))}</p>
      {block ? <p className="mt-2 text-xs text-bad">{O.blocked[block] ?? ""}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={Boolean(block)} onClick={() => apply((s) => acceptProOfferFlow(s, o.id))}>
          {O.accept}
        </Button>
        {o.kind !== "amateur" && !o.counter ? (
          <Button variant="secondary" disabled={Boolean(block)} onClick={() => apply((s) => counterProOfferFlow(s, o.id))}>
            {O.counter}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => apply((s) => declineProOfferFlow(s, o.id))}>
          {O.decline}
        </Button>
      </div>
      {o.kind !== "amateur" && !o.counter ? <p className="mt-2 text-xs text-faint">{O.counterRisk(Math.round(o.counterRisk * 100))}</p> : null}
      {o.kind !== "amateur" ? <p className="mt-2 text-xs leading-snug text-sub">{o.role === "rotation" ? O.rotationMeans(CAREER_PRO_ORG.rotationEvery) : O.starterMeans}</p> : null}
      {o.uncertain ? <p className="mt-2 text-xs leading-snug text-bad">{O.uncertain}</p> : null}
    </Panel>
  );
}
