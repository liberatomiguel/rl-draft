"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useCareerCopy } from "@/content/careerCopy";
import { useCareerCloudStore } from "@/store/careerCloudStore";
import { useMounted } from "@/store/useMounted";

const NOTICE_MS = 6000;

/** The one-time line about a career that was brought from the account. Quiet; leaves by itself. */
export function CareerCloudToast() {
  const C = useCareerCopy();
  const mounted = useMounted();
  const notice = useCareerCloudStore((s) => s.notice);
  const dismiss = useCareerCloudStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  if (!mounted || !notice) return null;
  const text = notice.kind === "updated" ? C.cloud.toast.updated(notice.orgName) : C.cloud.toast.restored(notice.orgName);
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 z-[80] w-[min(22rem,calc(100vw-1.5rem))] sm:bottom-4"
      aria-live="polite"
    >
      <div className="panel-strong pointer-events-auto flex items-start gap-2 p-3 text-xs text-sub">
        <p className="min-w-0 flex-1 pt-0.5">{text}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={C.common.close}
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-sub hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
