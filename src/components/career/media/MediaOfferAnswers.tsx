"use client";

/**
 * v2.3 MEDIA (wave 2): the answers under a media day offer in the inbox
 * reader: accept and decline while it is open, the outcome once it is closed.
 * The same minimum as the locker room's `LockerTalkAnswers` (the inbox mail
 * has no actions). Not seen in a browser. It is NOT mounted yet: the reader
 * (`screens/NewsScreen.tsx`, MailReader) needs one line,
 * `<MediaOfferAnswers item={item} C={C} />`, next to `<LockerTalkAnswers />`.
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { MailItem } from "@/engine/career/types";
import { Button } from "@/components/ui/Button";
import { useCareerSave } from "@/components/career/careerUi";
import { useCareerStore } from "@/store/careerStore";
import { FEATURES } from "@/config/balance";
import { formatMoney } from "@/lib/format";

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
  if (offer.status !== "open") return <p className="mt-5 text-sm text-sub">{M.closed[offer.status]?.(params) ?? ""}</p>;
  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" onClick={() => answer(offer.id, true)}>
          {label("accept")}
        </Button>
        <Button variant="secondary" onClick={() => answer(offer.id, false)}>
          {label("decline")}
        </Button>
      </div>
      <p className="text-xs text-sub">{M.hint}</p>
    </div>
  );
}
