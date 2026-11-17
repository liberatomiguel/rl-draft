"use client";

import { useCareerCopy } from "@/content/careerCopy";
import type { SlotCloud } from "@/store/careerCloudStore";
import { useCareerCloudStore } from "@/store/careerCloudStore";
import { cx } from "@/lib/util";
import { useCloudNoticeUi } from "./cloudNoticeUi";

type GlyphKind = "cloud" | "check" | "alert";

function Glyph({ kind }: { kind: GlyphKind }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {kind === "check" ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : kind === "alert" ? (
        <path d="M12 7v6M12 17h.01" strokeLinecap="round" />
      ) : (
        <path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.2A3.4 3.4 0 0117 18H7z" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const when = (ms: number): string => {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** One quiet line about a slot's copy in the account. `occupied` is the local state of the slot. */
export function CloudStatusLine({ cloud, occupied }: { cloud: SlotCloud | undefined; occupied: boolean }) {
  const C = useCareerCopy();
  const syncNow = useCareerCloudStore((s) => s.syncNow);
  const openFor = useCloudNoticeUi((s) => s.openFor);
  if (!cloud) return null;
  const { status } = cloud;
  let text: string | null = null;
  let glyph: GlyphKind = "cloud";
  let action: { label: string; run: () => void } | null = null;
  let tone = "text-sub";

  if (!occupied) {
    if (status === "newer") text = C.cloud.newer;
    else if (status === "syncing") text = C.cloud.restoring;
  } else if (status === "synced") {
    text = C.cloud.synced(cloud.cloud ? when(cloud.cloud.updatedAt) : "-");
    glyph = "check";
  } else if (status === "pending") text = C.cloud.pending;
  else if (status === "syncing") text = C.cloud.syncing;
  else if (status === "conflict") {
    text = C.cloud.conflict;
    glyph = "alert";
    tone = "text-ink";
    action = { label: C.cloud.choose, run: openFor };
  } else if (status === "newer") {
    text = C.cloud.newer;
    glyph = "alert";
  } else if (status === "error") {
    text = C.cloud.error;
    glyph = "alert";
    action = { label: C.cloud.tryNow, run: () => void syncNow() };
  }
  if (!text) return null;

  return (
    <p className={cx("relative mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", tone)} aria-live="polite">
      <span className="flex min-w-0 items-center gap-1.5">
        <Glyph kind={glyph} />
        <span className="min-w-0">{text}</span>
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="min-h-8 rounded px-1 text-xs font-semibold text-blue-bright underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60"
        >
          {action.label}
        </button>
      ) : null}
    </p>
  );
}
