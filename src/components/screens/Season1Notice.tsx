"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCopy } from "@/content/copy";
import { SEASON_NOTICE_IMAGES } from "@/lib/assets";
import { useProfileStore } from "@/store/profileStore";
import { useAccountStore } from "@/store/accountStore";
import { useMounted } from "@/store/useMounted";
import styles from "./Season1Notice.module.css";

// Once per document load, including returns home. Reopening/refreshing shows it
// again, independent of the old localStorage marker. No player data is changed.
let dismissedThisLoad = false;

export function Season1Notice() {
  const { HOME } = useCopy();
  const S = HOME.season1;
  const router = useRouter();
  const mounted = useMounted();
  const tutorialSeen = useProfileStore((s) => s.flags.seenTutorial);
  const accountsOn = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  const [dismissed, setDismissed] = useState(dismissedThisLoad);
  const [preview, setPreview] = useState<"career" | "update">("career");
  const dialog = useRef<HTMLDivElement>(null);
  const open = mounted && tutorialSeen && !dismissed;
  const close = () => { dismissedThisLoad = true; setDismissed(true); };

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { dismissedThisLoad = true; setDismissed(true); }
      if (e.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex='0']");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);

  if (!open) return null;
  const signedIn = status === "signedIn";
  const askToSignIn = accountsOn && !signedIn;

  return createPortal(
    <div className={styles.overlay}>
      <button className={styles.backdrop} onClick={close} aria-label={S.close} tabIndex={-1} />
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="season2-title" className={styles.dialog}>
        <header className={styles.header}>
          <span className={styles.brand}>ROCKET<span>DRAFT</span> <span className={styles.release}>/ 2.0</span></span>
          <button className={styles.close} onClick={close} aria-label={S.close}>✕</button>
        </header>
        <div className={styles.content}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span />{S.kicker}</p>
            <h2 id="season2-title" className="display">{S.title}</h2>
            <p className={styles.headline}>{S.headline}</p>
            <p className={styles.lead}>{S.intro}</p>
          </div>
          <section className={styles.showcase}>
            <div className={styles.previewTabs}>
              <button aria-pressed={preview === "career"} onClick={() => setPreview("career")}>{S.careerTitle}<span>{S.careerTag}</span></button>
              <button aria-pressed={preview === "update"} onClick={() => setPreview("update")}>{S.updateTitle}</button>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureCopy}>
                <p className={styles.featureNumber}>{preview === "career" ? "01 / ROAD TO WORLDS" : "02 / ROCKET DRAFT 2.0"}</p>
                <h3 className="display">{preview === "career" ? S.careerTitle : S.updateTitle}</h3>
                <p>{preview === "career" ? S.careerBody : S.updateBody}</p>
              </div>
              {/* Already optimized WebP screenshots, not game-card art. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={preview} src={SEASON_NOTICE_IMAGES[preview]} alt={preview === "career" ? S.careerAlt : S.updateAlt} width={1120} height={920} className={styles.screenshot} />
            </div>
            <p className={styles.caption}>{S.preview}</p>
          </section>
          <div className={styles.details}>
            <section><span className={styles.detailIcon} aria-hidden="true">＋</span><div><h3>{S.databaseTitle}</h3><p>{S.databaseBody}</p></div></section>
            <section><span className={styles.detailIcon} aria-hidden="true">◎</span><div><h3>{S.regionsTitle}</h3><p>{S.regionsBody}</p></div></section>
            <section><span className={styles.detailIcon} aria-hidden="true">☆</span><div><h3>{S.challengesTitle}</h3><p>{S.challengesBody}</p></div></section>
            <section><span className={styles.detailIcon} aria-hidden="true">↗</span><div><h3>{S.resetTitle}</h3><p>{S.resetBody}</p></div></section>
            <section><span className={styles.detailIcon} aria-hidden="true">✦</span><div><h3>{S.rewardsTitle}</h3><p>{S.rewardsBody}</p></div></section>
            <section><span className={styles.detailIcon} aria-hidden="true">⋯</span><div><h3>{S.moreTitle}</h3><p>{S.moreBody}</p></div></section>
          </div>
        </div>
        <footer className={styles.footer}>
          <div><p className={styles.accountTitle}>{S.accountTitle}</p><p>{signedIn ? S.rewardsSignedIn : S.rewards}</p></div>
          <div className={styles.actions}>
            {askToSignIn ? <><Button variant="ghost" onClick={close}>{S.later}</Button><Button variant="primary" onClick={() => { close(); router.push("/profile"); }}>{S.cta}<span aria-hidden="true">↗</span></Button></> : <Button variant="primary" onClick={close}>{S.gotIt}</Button>}
          </div>
        </footer>
      </div>
    </div>, document.body,
  );
}
