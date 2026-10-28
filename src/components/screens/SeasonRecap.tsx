"use client";

/**
 * Pre-season → Season 1 recap (v2.0): "Your Legacy Lives On". A three-step
 * full-screen presentation shown ONCE to every profile that carries a
 * `legacy.preseason` snapshot (guests included), then dismissed through the
 * profile flag `seenSeasonRecap`. The profile keeps a "View pre-season recap"
 * entry to replay it. Client-only + mount-gated (nothing on the server), portaled
 * to <body> like the tutorial.
 *
 * Step 1 — the numbers (peak rank, final rating, titles, runs, board position).
 * Step 2 — the legacy rewards (what the catalog derived from the snapshot).
 * Step 3 — what the reset means + what is new, then "Start Season 1".
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { RANKS, SEASON_RATING } from "@/config/balance";
import { useCopy } from "@/content/copy";
import { cosmeticById } from "@/data/cosmetics";
import { isLegacyReward } from "@/engine/cosmetics";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { selectTutorialDue, useProfileStore } from "@/store/profileStore";
import { useAccountStore } from "@/store/accountStore";
import { Button } from "@/components/ui/Button";
import { RankBadge } from "@/components/ui/RankBadge";
import { BadgeEmblem, CosmeticPreview } from "@/components/cosmetics/CosmeticViews";

export function SeasonRecap({ force, onClose }: { force?: boolean; onClose?: () => void } = {}) {
  const mounted = useMounted();
  const seen = useProfileStore((s) => s.flags.seenSeasonRecap);
  const tutorialDue = useProfileStore(selectTutorialDue);
  const preseason = useProfileStore((s) => s.legacy.preseason);
  const owned = useProfileStore((s) => s.cosmetics.owned);
  const markFlag = useProfileStore((s) => s.markFlag);
  const accountStatus = useAccountStore((s) => s.status);
  const accountsOn = useAccountStore((s) => s.enabled);
  const { SEASON_RECAP: R } = useCopy();
  const [step, setStep] = useState(0);

  // Automatic showing: once, never on top of the tutorial, only for pre-season profiles.
  // rc.29: "after the tutorial" = once it is no longer due (a veteran skips it).
  const auto = !seen && !!preseason && !tutorialDue;
  const show = mounted && (force || auto);
  // The login calendar and the unlock pop-ups wait behind it (DRAFT-13).
  useOverlayHold("intro", show);
  if (!show) return null;

  const finish = () => {
    if (!seen) markFlag("seenSeasonRecap");
    onClose?.();
  };
  // rc.4: by source, not id prefix — the approved badges have their own ids.
  const legacyIds = Object.keys(owned).filter((id) => {
    const def = cosmeticById.get(id);
    return !!def && isLegacyReward(def);
  });
  const rank = RANKS.find((r) => r.id === preseason?.rankId) ?? RANKS[0];
  const rankBadge = legacyIds
    .map((id) => cosmeticById.get(id))
    .filter((d) => d?.kind === "badge" && d.source.type === "legacy-rank")
    .sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0))[0];

  const positionLine = (() => {
    if (preseason?.position) return R.positionValue(preseason.position);
    if (!accountsOn) return R.positionOutside;
    if (accountStatus === "signedIn") return R.positionPendingSignedIn;
    return R.positionSignedOut;
  })();

  const steps = 3;
  const last = step === steps - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={R.title}>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          <div key={step} className="rise-in w-full max-w-lg text-center">
            {step === 0 ? (
              <>
                <p className="kicker text-orange-bright">{R.kicker}</p>
                <h2 className="display mt-2 text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{R.title}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-sub">{R.subtitle}</p>
                <div className="mt-7 flex items-center justify-center gap-4">
                  <RankBadge rank={rank} variant="menu" size="lg" />
                  {rankBadge ? <BadgeEmblem badge={rankBadge} size="lg" /> : null}
                </div>
                <p className="display mt-3 text-xl font-bold uppercase tracking-wide text-ink">{rank.label}</p>
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label={R.finalRating} value={String(preseason?.mmr ?? SEASON_RATING.start)} accent />
                  <Stat label={R.titles} value={String(preseason?.titles ?? 0)} />
                  <Stat label={R.runs} value={String(preseason?.runsCompleted ?? 0)} />
                  <Stat label={R.challenges} value={String(preseason?.challengesCleared ?? 0)} />
                </div>
                <div className="panel mt-3 p-3 text-xs text-sub">
                  <span className="kicker !text-[10px]">{R.position}</span>
                  <p className={cx("mt-1", preseason?.position ? "display text-lg font-bold text-orange-bright" : "")}>{positionLine}</p>
                </div>
              </>
            ) : step === 1 ? (
              <>
                <p className="kicker text-orange-bright">{R.rewardsKicker}</p>
                <h2 className="display mt-2 text-3xl font-bold uppercase tracking-wide text-ink">{R.rewardsTitle}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-sub">{R.rewardsIntro}</p>
                {legacyIds.length === 0 ? (
                  <p className="panel mt-6 p-4 text-sm text-sub">{R.rewardsNone}</p>
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
                    {legacyIds.map((id) => (
                      <div key={id} className="panel p-2.5">
                        <CosmeticPreview id={id} />
                      </div>
                    ))}
                  </div>
                )}
                {!preseason?.position && accountsOn ? (
                  <p className="mt-4 text-xs text-faint">{accountStatus === "signedIn" ? R.positionPendingSignedIn : R.positionSignedOut}</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="kicker text-orange-bright">{R.seasonKicker}</p>
                <h2 className="display mt-2 text-3xl font-bold uppercase tracking-wide text-ink">{R.seasonTitle}</h2>
                <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm leading-relaxed text-sub">
                  {R.seasonBullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="kicker mt-6 text-cyan">{R.newKicker}</p>
                <ul className="mx-auto mt-2 max-w-md space-y-1.5 text-left text-sm leading-relaxed text-sub">
                  {R.newBullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-7 flex items-center justify-center gap-1.5">
              {Array.from({ length: steps }).map((_, i) => (
                <span key={i} className={cx("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-orange" : "w-1.5 bg-white/20")} />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  {R.back}
                </Button>
              ) : null}
              <Button
                variant="primary"
                onClick={() => {
                  if (last) {
                    sfx.start();
                    finish();
                  } else {
                    sfx.click();
                    setStep((s) => s + 1);
                  }
                }}
              >
                {last ? R.start : R.next}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel p-3">
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 text-2xl font-bold", accent ? "text-orange-bright" : "text-ink")}>{value}</p>
    </div>
  );
}
