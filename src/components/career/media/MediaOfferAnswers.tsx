"use client";

/**
 * v2.3 MEDIA (wave 2): the answers under a media day offer in the inbox
 * reader: accept and decline while it is open, the outcome once it is closed.
 * Mounted in `screens/NewsScreen.tsx` (MailReader) next to `LockerTalkAnswers`
 * and dressed the same: the rule above, full-width option rows, the hint in
 * the faint line, the outcome in ink (v2.3 FIX, seen in a browser).
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { MailItem } from "@/engine/career/types";
import { useCareerSave } from "@/components/career/careerUi";
import { useCareerStore } from "@/store/careerStore";
import { FEATURES } from "@/config/balance";
import { formatMoney } from "@/lib/format";
import { cx } from "@/lib/util";

export function MediaOfferAnswers({ item, C }: { item: MailItem; C: CareerCopy }) {
  const save = useCareerSave();
  const answer = useCareerStore((s) => s.answerMediaOffer);
  const offerId = item.params?.offerId;
  if (!FEATURES.mediaDays || item.titleKey !== "mediaOffer" || typeof offerId !== "string") return null;
  const offer = save?.mediaDays?.offers.find((o) => o.id === offerId);
  if (!offer) return null;
  const M = C.media;
  const params = (item.params ?? {}) as Record<string, string | number>;
  const label = (key: "accept" | "decline") => M.answers[key]({ ...params, cash: formatMoney(offer.cash) });
  if (offer.status !== "open") {
    return (
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm text-ink">{M.closed[offer.status]?.(params) ?? ""}</p>
      </div>
    );
  }
  const rowClass = cx(
    "flex min-h-11 w-full flex-col items-start rounded-[7px] border border-line bg-white/[0.03] px-3.5 py-3 text-left transition-colors",
    "hover:border-blue/60 hover:bg-blue/10",
  );
  return (
    <div className="mt-5 border-t border-line pt-4">
      <ul className="grid grid-cols-1 gap-2">
        <li>
          <button type="button" className={rowClass} onClick={() => answer(offer.id, true)}>
            <span className="text-sm font-semibold text-ink">{label("accept")}</span>
          </button>
        </li>
        <li>
          <button type="button" className={rowClass} onClick={() => answer(offer.id, false)}>
            <span className="text-sm font-semibold text-ink">{label("decline")}</span>
          </button>
        </li>
      </ul>
      <p className="mt-2 text-xs text-faint">{M.hint}</p>
    </div>
  );
}
