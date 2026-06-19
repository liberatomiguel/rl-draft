"use client";

/**
 * Account hub (v1.4) — lives on the Profile. Signed out: an email one-time-code
 * sign-in. Signed in: the email, an editable (unique) display name, sign out, and
 * delete account. Renders nothing when accounts aren't configured, so the guest
 * profile is unchanged.
 */

import { useState } from "react";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { sendEmailCode, verifyEmailCode } from "@/lib/supabase";
import { useAccountStore } from "@/store/accountStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";

export function AccountSection() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  if (!enabled || status === "loading") return null;
  return status === "signedIn" ? <SignedIn L={L} /> : <SignIn L={L} />;
}

type L = ReturnType<typeof useCopy>["LEADERBOARDS_UI"];

function SignIn({ L }: { L: L }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    sfx.click();
    const { error } = await sendEmailCode(email.trim());
    setBusy(false);
    if (error) setError(L.authError);
    else setStep("code");
  };
  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await verifyEmailCode(email.trim(), code.trim());
    setBusy(false);
    if (error) setError(L.authError); // success flips status via the account store
  };

  return (
    <Panel className="mb-6 p-5">
      <h3 className="display mb-1 text-base font-bold uppercase tracking-wide text-ink">{L.signInTitle}</h3>
      <p className="mb-4 text-sm leading-relaxed text-sub">{L.guestNote}</p>
      {step === "email" ? (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={L.emailPlaceholder}
            className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
          />
          <Button variant="primary" onClick={send} disabled={busy || !email}>
            {busy ? L.sending : L.sendCode}
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-2.5 text-xs text-sub">{L.codeSentTo(email)}</p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder={L.codePlaceholder}
              className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm tracking-[0.3em] text-ink outline-none focus:border-orange/60"
            />
            <Button variant="primary" onClick={verify} disabled={busy || code.length < 4}>
              {busy ? L.verifying : L.verify}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="mt-2.5 text-xs text-faint underline-offset-2 hover:text-sub hover:underline"
          >
            {L.useAnotherEmail}
          </button>
        </div>
      )}
      {error ? <p className="mt-3 text-xs font-semibold text-bad">{error}</p> : null}
    </Panel>
  );
}

function SignedIn({ L }: { L: L }) {
  const session = useAccountStore((s) => s.session);
  const username = useAccountStore((s) => s.username);
  const syncing = useAccountStore((s) => s.syncing);
  const setUsername = useAccountStore((s) => s.setUsername);
  const signOut = useAccountStore((s) => s.signOut);
  const deleteAccount = useAccountStore((s) => s.deleteAccount);

  const [edited, setEdited] = useState<string | null>(null);
  const draftName = edited ?? username ?? "";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    setNameError(null);
    const res = await setUsername(draftName);
    setSaving(false);
    if (res.error === "taken") setNameError(L.nameTaken);
    else if (res.error) setNameError(res.error);
    else {
      setEdited(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <Panel className="mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-sub">
          {session?.user.email ? L.signedInEmail(session.user.email) : L.account}
          {syncing ? ` · ${L.syncing}` : ""}
        </span>
        <Button variant="ghost" onClick={signOut}>
          {L.signOut}
        </Button>
      </div>

      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-sub">
        {L.displayNameLabel}
      </label>
      <div className="flex gap-2.5">
        <input
          value={draftName}
          onChange={(e) => {
            setEdited(e.target.value);
            setNameError(null);
          }}
          maxLength={24}
          className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
        />
        <Button
          variant="secondary"
          onClick={save}
          disabled={saving || !draftName.trim() || draftName === username}
        >
          {saved ? L.saved : L.save}
        </Button>
      </div>
      {nameError ? <p className="mt-2 text-xs font-semibold text-bad">{nameError}</p> : null}

      <div className="mt-5 border-t border-line/60 pt-4">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className={cx(
            "text-xs font-semibold text-faint underline-offset-2 transition-colors hover:text-bad hover:underline",
          )}
        >
          {L.deleteAccount}
        </button>
      </div>

      <Modal
        open={confirmDelete}
        title={L.deleteTitle}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {L.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false);
                deleteAccount();
              }}
            >
              {L.deleteConfirm}
            </Button>
          </>
        }
      >
        {L.deleteBody}
      </Modal>
    </Panel>
  );
}
