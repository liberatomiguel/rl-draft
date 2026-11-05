"use client";

/**
 * Account UI (v1.4) — lives on the Profile.
 *  · <ProfileNickname>  — the display name + a pencil to edit it, shown INSIDE
 *    the rank card (the profile-identity card). Signed-in only.
 *  · <AccountSection>   — the email one-time-code sign-in incentive, shown only
 *    when signed OUT. The signed-in controls (sign out, delete) live in the
 *    profile rank card + danger zone now.
 * Both render nothing when accounts aren't configured, so the guest profile is
 * unchanged.
 */

import { useRef, useState } from "react";
import { useCopy } from "@/content/copy";
import { sfx } from "@/lib/sfx";
import { sendEmailCode, verifyEmailCode } from "@/lib/supabase";
import { useAccountStore } from "@/store/accountStore";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PencilIcon } from "@/components/ui/icons";

type L = ReturnType<typeof useCopy>["LEADERBOARDS_UI"];

// --- Nickname (in the rank card) -----------------------------------------

export function ProfileNickname() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  const username = useAccountStore((s) => s.username);
  const setUsername = useAccountStore((s) => s.setUsername);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled || status !== "signedIn" || !username) return null;

  const start = () => {
    setDraft(username);
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await setUsername(draft);
    setSaving(false);
    if (res.error === "taken") setError(L.nameTaken);
    else if (res.error) setError(res.error);
    else setEditing(false);
  };

  if (editing) {
    return (
      <div className="mb-1">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <input
            value={draft}
            autoFocus
            maxLength={24}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 max-w-[12rem] rounded-lg border border-line bg-bg/60 px-2.5 py-1 text-lg font-bold text-ink outline-none focus:border-orange/60"
          />
          <Button variant="secondary" size="sm" onClick={save} disabled={saving || !draft.trim()}>
            {L.save}
          </Button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-faint transition-colors hover:text-sub"
          >
            {L.cancel}
          </button>
        </div>
        {error ? <p className="mt-1 text-xs font-semibold text-bad">{error}</p> : null}
      </div>
    );
  }
  return (
    <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
      <span className="display truncate text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">
        {username}
      </span>
      <button
        type="button"
        onClick={start}
        aria-label={L.displayNameLabel}
        title={L.displayNameLabel}
        className="shrink-0 text-faint transition-colors hover:text-ink"
      >
        <PencilIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

// --- Account section (below the rank card) -------------------------------

/** Signed-OUT only: the email sign-in incentive. The signed-in controls (name,
 *  sign out, delete) live in the profile card + danger zone now. */
export function AccountSection() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  if (!enabled || status !== "signedOut") return null;
  return <SignInForm L={L} />;
}

export function SignInForm({ L, compact = false }: { L: L; compact?: boolean }) {
  // The in-flight email lives in the account store (survives navigation), so the step
  // is DERIVED from it: returning to /profile after a code was sent lands back on the
  // code step with the email remembered — no dead end.
  const pendingEmail = useAccountStore((s) => s.pendingEmail);
  const setPendingEmail = useAccountStore((s) => s.setPendingEmail);
  const step = pendingEmail ? "code" : "email";

  const [email, setEmail] = useState(pendingEmail ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  /** Send (or resend) a code to `target`. On the send rate-limit we STILL advance to
   *  the code step — a code from a recent request is very likely already valid — so the
   *  player is never blocked from entering one. */
  const send = async (target: string) => {
    const to = target.trim();
    if (!to || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    sfx.click();
    try {
      const { error, code: errCode } = await sendEmailCode(to);
      const rateLimited = errCode === "over_email_send_rate_limit" || /after \d+ second/i.test(error ?? "");
      if (!error || rateLimited) {
        setPendingEmail(to);
        if (rateLimited) setNotice(L.codeRateLimited);
      } else {
        setError(L.sendError);
      }
    } catch {
      setError(L.sendError);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!pendingEmail || code.trim().length < 4 || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error, code: errCode } = await verifyEmailCode(pendingEmail, code.trim());
      if (error) setError(errCode === "otp_expired" ? L.codeExpired : L.authError);
    } catch {
      setError(L.authError);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    // success flips status via the account store (clears pendingEmail), unmounting this.
  };

  const useAnotherEmail = () => {
    setPendingEmail(null);
    setCode("");
    setError(null);
    setNotice(null);
  };

  const content = (
    <>
      {!compact ? <><h3 className="display mb-1 text-lg font-bold uppercase tracking-wide text-ink">{L.signInTitle}</h3>
      <p className="mb-4 text-sm leading-relaxed text-sub">{L.guestNote}</p></> : null}
      {step === "email" ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(email); }} className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="email"
            aria-label={L.emailLabel}
            required
            autoFocus={compact}
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={L.emailPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm text-ink outline-none focus:border-orange/60"
          />
          <Button type="submit" variant="primary" disabled={busy || !email.trim()}>
            {busy ? L.sending : L.sendCode}
          </Button>
        </form>
      ) : (
        <div>
          <p className="mb-2.5 text-xs text-sub">{L.codeSentTo(pendingEmail ?? "")}</p>
          <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              aria-label={L.codeLabel}
              autoFocus={compact}
              required
              minLength={4}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder={L.codePlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm tracking-[0.3em] text-ink outline-none focus:border-orange/60"
            />
            <Button type="submit" variant="primary" disabled={busy || code.length < 4}>
              {busy ? L.verifying : L.verify}
            </Button>
          </form>
          <div className="mt-2.5 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => send(pendingEmail ?? "")}
              disabled={busy}
              className="text-faint underline-offset-2 hover:text-sub hover:underline disabled:opacity-50"
            >
              {L.resendCode}
            </button>
            <span className="text-line">·</span>
            <button
              type="button"
              onClick={useAnotherEmail}
              disabled={busy}
              className="text-faint underline-offset-2 hover:text-sub hover:underline disabled:opacity-50"
            >
              {L.useAnotherEmail}
            </button>
          </div>
        </div>
      )}
      {notice ? <p role="status" className="mt-3 text-xs font-semibold text-sub">{notice}</p> : null}
      {error ? <p role="alert" className="mt-3 text-xs font-semibold text-bad">{error}</p> : null}
    </>
  );
  return compact ? content : <Panel strong glow="blue" className="mb-6 p-5">{content}</Panel>;
}
