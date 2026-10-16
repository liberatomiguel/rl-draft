"use client";

/**
 * Pre-season → Season 1 announcement (v1.4.6). Opens once per browser on the
 * home page, after the first-run tutorial, and nudges signed-out players to
 * create an account (pre-season account holders get Season 1 rewards).
 *
 * The "seen" marker is a plain localStorage key, deliberately OUTSIDE the
 * zustand persist stores (and their frozen contract — persistContract.test.ts):
 * it is disposable UI state, not player progress. Remove this component (and
 * its HOME.season1 copy) once Season 1 ships.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useCopy } from "@/content/copy";
import { useProfileStore } from "@/store/profileStore";
import { useAccountStore } from "@/store/accountStore";
import { useMounted } from "@/store/useMounted";

const SEEN_KEY = "rd-notice:season1:v1";

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: the notice just shows again next visit */
  }
}

export function Season1Notice() {
  const { HOME } = useCopy();
  const S = HOME.season1;
  const router = useRouter();
  const mounted = useMounted();
  const tutorialSeen = useProfileStore((s) => s.flags.seenTutorial);
  const accountsOn = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  const [dismissed, setDismissed] = useState(false);

  // Mount-gated (localStorage is client-only) and never on top of the tutorial.
  if (!mounted || !tutorialSeen || dismissed || readSeen()) return null;

  const close = () => {
    writeSeen();
    setDismissed(true);
  };
  const signedIn = status === "signedIn";
  const askToSignIn = accountsOn && !signedIn;

  return (
    <Modal
      open
      title={S.title}
      onClose={close}
      actions={
        askToSignIn ? (
          <>
            <Button variant="ghost" onClick={close}>
              {S.later}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                close();
                router.push("/profile");
              }}
            >
              {S.cta}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={close}>
            {S.gotIt}
          </Button>
        )
      }
    >
      <p className="kicker mb-3 text-orange-bright">{S.kicker}</p>
      <p className="text-ink">{S.intro}</p>
      <ul className="mt-4 space-y-2">
        {S.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-orange-bright">▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-lg border border-orange/30 bg-orange/10 p-3 text-ink">
        {signedIn ? S.rewardsSignedIn : S.rewards}
      </p>
    </Modal>
  );
}
