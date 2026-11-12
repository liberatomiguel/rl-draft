"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChooseNameForm, SignInForm } from "@/components/AccountSection";
import { Modal } from "@/components/ui/Modal";
import { useCopy } from "@/content/copy";
import { useAccountStore } from "@/store/accountStore";
import { useSignInDialog } from "@/store/signInDialog";

export default function SignInDialog() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const closeDialog = useSignInDialog((s) => s.close);
  const signedIn = useAccountStore((s) => s.status === "signedIn");
  const needsName = useAccountStore((s) => s.needsName);
  const syncing = useAccountStore((s) => s.syncing);
  const content = useRef<HTMLDivElement>(null);
  // Closing by hand during the name step keeps the automatic name.
  const close = useCallback(() => {
    if (useAccountStore.getState().needsName) useAccountStore.getState().setNeedsName(false);
    closeDialog();
  }, [closeDialog]);
  // v2.0.4: email -> code -> and only for an account that did not exist, the name.
  // After the code is accepted the dialog waits for the first sync (it tells
  // whether the account is new) instead of closing and opening again.
  const done = (s: { enabled: boolean; status: string; needsName: boolean; syncing: boolean }) =>
    !s.enabled || (s.status === "signedIn" && !s.needsName && !s.syncing);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (done(useAccountStore.getState())) closeDialog();
    const unsubscribe = useAccountStore.subscribe((s) => {
      if (done(s)) closeDialog();
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
  }, [closeDialog]);

  if (signedIn && needsName) {
    return (
      <Modal open title={L.chooseNameTitle} onClose={close}>
        <div ref={content}>
          <ChooseNameForm L={L} onDone={close} />
        </div>
      </Modal>
    );
  }
  return (
    <Modal open title={L.loginDialogTitle} onClose={close}>
      <div ref={content}>
        {signedIn && syncing ? (
          <p className="text-sm text-sub">{L.signingIn}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-sub">{L.loginDialogNote}</p>
            <SignInForm L={L} compact />
          </>
        )}
      </div>
    </Modal>
  );
}
