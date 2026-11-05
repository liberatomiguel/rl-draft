"use client";

import { useEffect, useRef } from "react";
import { SignInForm } from "@/components/AccountSection";
import { Modal } from "@/components/ui/Modal";
import { useCopy } from "@/content/copy";
import { useAccountStore } from "@/store/accountStore";
import { useSignInDialog } from "@/store/signInDialog";

export default function SignInDialog() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const close = useSignInDialog((s) => s.close);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!useAccountStore.getState().enabled || useAccountStore.getState().status === "signedIn") close();
    const unsubscribe = useAccountStore.subscribe((s) => {
      if (!s.enabled || s.status === "signedIn") close();
    });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const root = content.current?.closest('[role="dialog"]');
      // The overlay's backdrop is intentionally outside the keyboard loop.
      const controls = root?.querySelectorAll<HTMLElement>("button:not(.absolute):not([disabled]), input:not([disabled]), a[href]");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      unsubscribe();
      document.removeEventListener("keydown", trapFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [close]);

  return (
    <Modal open title={L.loginDialogTitle} onClose={close}>
      <div ref={content}>
        <p className="mb-4 text-sm text-sub">{L.loginDialogNote}</p>
        <SignInForm L={L} compact />
      </div>
    </Modal>
  );
}
