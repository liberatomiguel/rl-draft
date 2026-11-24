"use client";

/**
 * Friend duel (v2.1): the note /play shows above the setup when a duel link
 * could not be opened (broken, edited, from a newer build, or a region this
 * build cannot draft). The player lands on a normal draft instead.
 */

import { useCopy } from "@/content/copy";
import { useDuelNotice } from "@/store/duelStore";
import { Button } from "@/components/ui/Button";

export function DuelLinkNotice() {
  const { DUEL_UI: D } = useCopy();
  const notice = useDuelNotice((s) => s.notice);
  const setNotice = useDuelNotice((s) => s.setNotice);
  if (!notice) return null;
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-2 rounded-sm border border-orange/40 bg-orange/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">{D.noticeTitle}</p>
        <p className="text-sub">
          {D.noticeReason[notice] ?? D.noticeReason.malformed} {D.noticeFallback}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setNotice(null)}>
        {D.dismiss}
      </Button>
    </div>
  );
}
