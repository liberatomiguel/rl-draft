"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/util";

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Modal({ open, title, children, actions, onClose, wide }: ModalProps) {
  // Portal target — animated ancestors create transform containing blocks
  // that would re-anchor position:fixed, so the dialog must live on <body>.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !host) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cx(
          "panel-strong pop-in relative z-10 w-full p-6",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-sub transition-colors hover:bg-white/10 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="text-sm leading-relaxed text-sub">{children}</div>
        {actions ? <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div> : null}
      </div>
    </div>,
    host,
  );
}
