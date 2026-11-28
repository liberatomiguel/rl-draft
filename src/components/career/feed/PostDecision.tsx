"use client";

/**
 * rc9 STORIES (#288, R254): the post after a big moment, as one of HQ's
 * decisions (DecisionBlock's "post" kind). Miguel on rc.8: "ser uma decisão
 * dedicada junto com as decisões principais, e não um card a mais".
 *
 * The moment leads: its tag, the headline (the title, the final, the exit),
 * and the series as the block's figure between the two crests. Then one line
 * of ask and the answers: write the post (the sheet with the preview and the
 * effects) or let it pass. It never holds the clock: unanswered, it lapses on
 * the day the line names, with no effect beyond the post not made.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { offerLastDay } from "@/engine/career/fanFeedMoments";
import type { FanTone, FeedOffer } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { pendingFeedPostOf } from "@/store/fanFeedFlow";
import { dateOfDay } from "@/components/career/careerUi";
import { formatDateShort } from "@/components/career/dateText";
import { DECISION_TITLE } from "@/components/career/hub/hubShared";
import { OrgMark } from "@/components/career/OrgMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostSheet } from "./PostSheet";

/** The decision's headline: the event for a title, a final or an exit; the opponent for an upset; the length for a streak. */
export function postHeadlineOf(C: CareerCopy, o: FeedOffer): string {
  const H = C.feed.ui.headline;
  if (o.moment === "streak") return H.streak(o.streak ?? 0);
  if (o.moment === "upsetWin" || o.moment === "upsetLoss") return H[o.moment](o.opponentName);
  return H[o.moment](o.event);
}

export function PostDecision({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const router = useRouter();
  const post = useCareerStore((s) => s.postToFeed);
  const [open, setOpen] = useState(false);
  const offer = pendingFeedPostOf(save);
  if (!offer) return null;
  const U = C.feed.ui;
  const until = formatDateShort(C.dates, dateOfDay(offer.seasonIndex, offerLastDay(offer.day)));
  const tagTone = offer.moment === "title" ? "gold" : offer.won ? "good" : "bad";

  const publish = (tone: FanTone) => {
    setOpen(false);
    post(tone);
    router.push("/career/news#fans");
    // The News screen picks its view from the hash on mount or on "hashchange"; a client push fires neither
    // once the screen is up, so it is told when the new page is there.
    let tries = 0;
    const nudge = () => {
      if (window.location.pathname.startsWith("/career/news")) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else if (++tries < 20) window.setTimeout(nudge, 50);
    };
    window.setTimeout(nudge, 50);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-60">
          <Badge tone={tagTone}>{U.tag[offer.moment]}</Badge>
          <h2 className={cx(DECISION_TITLE, "mt-2.5")}>{postHeadlineOf(C, offer)}</h2>
          {/* The event is in the headline for a title, a final or an exit; the line under it says the series. */}
          <p className="mt-2 text-sm text-sub">
            {U.result(offer.won, `${Math.max(offer.us, offer.them)}-${Math.min(offer.us, offer.them)}`, offer.opponentName)}
            {offer.moment === "upsetWin" || offer.moment === "upsetLoss" || offer.moment === "streak" ? ` · ${offer.event}` : ""}
          </p>
        </div>
        {/* The series as the block's figure: our crest, the score (ours first), theirs. */}
        <div className="flex shrink-0 items-center gap-3" aria-label={U.result(offer.won, `${offer.us}-${offer.them}`, offer.opponentName)}>
          <OrgMark save={save} orgRef="user" size="md" />
          <span className="display text-4xl font-bold leading-none tabular-nums" aria-hidden>
            <span className={offer.won ? "text-ink" : "text-sub"}>{offer.us}</span>
            <span className="px-1.5 text-faint">-</span>
            <span className={offer.won ? "text-sub" : "text-ink"}>{offer.them}</span>
          </span>
          <OrgMark save={save} orgRef={offer.opponentRef} size="md" />
        </div>
      </div>

      <p className="mt-4 max-w-md text-sm text-sub">{U.ask}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="secondary" size="md" className="min-h-11" onClick={() => setOpen(true)}>
          {U.write}
        </Button>
        <Button variant="ghost" size="md" className="min-h-11" onClick={() => post("skip")}>
          {U.pass}
        </Button>
        <span className="text-xs text-faint">{U.openUntil(until)}</span>
      </div>

      <PostSheet save={save} C={C} offer={offer} open={open} onClose={() => setOpen(false)} onPublish={publish} />
    </div>
  );
}
