"use client";

/**
 * The v2.0.0 launch announcement ("Rocket Draft 2.0 is here"): what Season 1
 * brings, with real captures of the new screens. Built on the 2.0 teaser that
 * production showed before the launch (v1.4.7), same portal / focus trap.
 *
 * Shown ONCE per player (`flags.seenLaunchNotice`, synced), on the home page,
 * to new and returning players alike, after the first-run tutorial. It comes
 * BEFORE the pre-season recap: a veteran who logs in from here gets the recap
 * with the board places already synced. The primary action opens the inline
 * sign-in dialog (v1.4.8) for a guest; the secondary one goes to the changelog.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { useCopy } from "@/content/copy";
import { LAUNCH_NOTICE_IMAGES, type LaunchNoticeTab } from "@/lib/assets";
import { selectTutorialDue, useProfileStore } from "@/store/profileStore";
import { useAccountStore } from "@/store/accountStore";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { useSignInDialog } from "@/store/signInDialog";
import { useMounted } from "@/store/useMounted";
import styles from "./LaunchNotice.module.css";

const TABS: LaunchNoticeTab[] = ["career", "season", "challenges", "collection"];
const DETAIL_ICONS = ["◎", "✦", "☆", "↗", "＋", "⋯"];

export function LaunchNotice() {
  const { HOME } = useCopy();
  const L = HOME.launch;
  const mounted = useMounted();
  const seen = useProfileStore((s) => Boolean(s.flags.seenLaunchNotice));
  const tutorialDue = useProfileStore(selectTutorialDue);
  const markFlag = useProfileStore((s) => s.markFlag);
  const accountsOn = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  const [tab, setTab] = useState<LaunchNoticeTab>("career");
  const dialog = useRef<HTMLDivElement>(null);
  const open = mounted && !seen && !tutorialDue;
  // The login calendar, the unlock pop-ups and the pre-season recap wait behind it.
  useOverlayHold("intro", open);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useProfileStore.getState().markFlag("seenLaunchNotice");
      if (e.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex='0']");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  const close = () => markFlag("seenLaunchNotice");
  const signedIn = status === "signedIn";
  const askToSignIn = accountsOn && !signedIn;
  const current = L.tabs[tab];

  return createPortal(
    <div className={styles.overlay}>
      <button className={styles.backdrop} onClick={close} aria-label={L.close} tabIndex={-1} />
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="launch-title" className={styles.dialog}>
        <header className={styles.header}>
          <span className={styles.brand}>
            ROCKET<span>DRAFT</span> <span className={styles.release}>/ 2.0</span>
          </span>
          <button className={styles.close} onClick={close} aria-label={L.close}>
            ✕
          </button>
        </header>
        <div className={styles.content}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>
              <span />
              {L.kicker}
            </p>
            <h2 id="launch-title" className="display">
              {L.title}
            </h2>
            <p className={styles.headline}>{L.headline}</p>
            <p className={styles.lead}>{L.intro}</p>
          </div>
          <section className={styles.showcase}>
            <div className={styles.previewTabs}>
              {TABS.map((key) => (
                <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
                  {L.tabs[key].label}
                  {L.tabs[key].tag ? <span>{L.tabs[key].tag}</span> : null}
                </button>
              ))}
            </div>
            <div className={styles.feature}>
              <div className={styles.featureCopy}>
                <p className={styles.featureNumber}>{current.number}</p>
                <h3 className="display">{current.title}</h3>
                <p>{current.body}</p>
              </div>
              {/* Already optimized WebP screenshots, not game-card art. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={tab} src={LAUNCH_NOTICE_IMAGES[tab]} alt={current.alt} width={1120} height={721} className={styles.screenshot} />
            </div>
            <p className={styles.caption}>{L.caption}</p>
          </section>
          <div className={styles.details}>
            {L.details.map((d, i) => (
              <section key={d.title}>
                <span className={styles.detailIcon} aria-hidden="true">
                  {DETAIL_ICONS[i % DETAIL_ICONS.length]}
                </span>
                <div>
                  <h3>{d.title}</h3>
                  <p>{d.body}</p>
                </div>
              </section>
            ))}
          </div>
        </div>
        <footer className={styles.footer}>
          <div>
            <p className={styles.accountTitle}>{L.accountTitle}</p>
            <p>{signedIn || !accountsOn ? L.accountSignedIn : L.account}</p>
          </div>
          <div className={styles.actions}>
            <AppLink href="/changelog" onClick={close} className={styles.secondary}>
              {L.changelog}
            </AppLink>
            {askToSignIn ? (
              <Button
                variant="primary"
                onClick={() => {
                  close();
                  useSignInDialog.getState().show();
                }}
              >
                {L.cta}
              </Button>
            ) : (
              <Button variant="primary" onClick={close}>
                {L.play}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
