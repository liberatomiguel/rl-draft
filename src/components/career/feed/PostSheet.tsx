"use client";

/**
 * rc9 STORIES (#290, #291): the post, shown as it will look, with what it
 * does. Miguel on rc.8: "o post pode ser mais completo, mostrar de maneira
 * mais bonita como vai ficar o post, e quais são suas implicações".
 *
 * One decision in the sheet: which tone goes out. The three tones are a row
 * of cards (each with its followers move); the picked one drives the preview
 * (the feed's own manager post: crest, name, text, the moment strip) and the
 * figures under it. The figures are `postEffectsOf`: the action itself run on
 * the save and read back, so the sheet never shows an effect the game does
 * not apply (morale only with the locker room, confidence only with a board).
 * Publish posts and opens the fan feed, where the replies are.
 */

import { useMemo, useState } from "react";
import type { CareerCopy } from "@/content/careerCopy";
import { managerPostForOffer } from "@/engine/career/fanFeed";
import { feedTextOf } from "@/engine/career/fanFeedText";
import type { FanTone, FeedOffer } from "@/engine/career/fanFeedTypes";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { postEffectsOf, type PostEffects } from "@/store/fanFeedFlow";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ManagerPostBody } from "./FeedPostParts";

const TONES: FanTone[] = ["humble", "confident", "provocative"];

const pct = (p: number): string => `${p > 0 ? "+" : "−"}${Math.round(Math.abs(p) * 1000) / 10}%`;
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const toneClass = (n: number): string => (n > 0 ? "text-good" : n < 0 ? "text-bad" : "text-sub");

export function PostSheet({
  save,
  C,
  offer,
  open,
  onClose,
  onPublish,
}: {
  save: CareerSave;
  C: CareerCopy;
  offer: FeedOffer;
  open: boolean;
  onClose: () => void;
  onPublish: (tone: FanTone) => void;
}) {
  const F = C.feed;
  const U = F.ui;
  const [tone, setTone] = useState<FanTone>("humble");
  const effects = useMemo(
    () => Object.fromEntries(TONES.map((t) => [t, postEffectsOf(save, t)])) as Record<FanTone, PostEffects | null>,
    [save],
  );
  const text = feedTextOf(managerPostForOffer(save, offer, tone), F);
  const fx = effects[tone];

  return (
    <Modal
      open={open}
      wide
      title={U.sheetTitle}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {U.cancel}
          </Button>
          <Button variant="primary" onClick={() => onPublish(tone)} disabled={!fx}>
            {U.publish}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <p className="kicker mb-2.5">{U.tone}</p>
          {/* Three cards side by side; under 360 px the names do not fit a third, so they stack as one-line cards. */}
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3" role="group" aria-label={U.tone}>
            {TONES.map((t) => {
              const e = effects[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tone === t}
                  onClick={() => setTone(t)}
                  className={cx(
                    "flex min-h-14 min-w-0 flex-col items-start justify-between rounded-[7px] border px-3 py-2.5 text-left transition-colors max-sm:px-2 max-[359px]:min-h-11 max-[359px]:flex-row max-[359px]:items-center max-[359px]:px-3 max-[359px]:py-2",
                    tone === t ? "border-orange bg-orange/[0.06]" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="display truncate text-[13px] font-semibold uppercase tracking-[0.05em] text-ink max-sm:text-[11px] max-sm:tracking-[0.04em]">
                    {F.tones[t].label}
                  </span>
                  {e ? <span className={cx("mt-1 text-xs tabular-nums", toneClass(e.followers))}>{pct(e.followersPct)}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-sm text-sub">{F.tones[tone].hint}</p>
        </section>

        <section>
          <p className="kicker mb-2.5">{U.preview}</p>
          <div className="rounded-xl border border-line bg-bg p-4">
            <ManagerPostBody
              save={save}
              C={C}
              text={text}
              time={U.justNow}
              moment={{ moment: offer.moment, event: offer.event, opponentRef: offer.opponentRef, opponentName: offer.opponentName, us: offer.us, them: offer.them, won: offer.won }}
            />
          </div>
        </section>

        {fx ? (
          <section>
            <p className="kicker mb-2.5">{U.effects}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Figure value={signed(fx.followers)} tone={toneClass(fx.followers)} label={U.fx.followers} note={pct(fx.followersPct)} />
              {fx.morale !== 0 ? <Figure value={signed(fx.morale)} tone={toneClass(fx.morale)} label={U.fx.morale} /> : null}
              {fx.board !== 0 ? <Figure value={signed(fx.board)} tone={toneClass(fx.board)} label={U.fx.board} /> : null}
            </dl>
            {fx.receiptPct !== null && fx.backedUpPct !== null ? (
              <div className="mt-4 border-t border-line pt-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Figure value={pct(fx.receiptPct)} tone="text-bad" label={U.fx.receipt(offer.opponentName)} note={U.fx.followers} small />
                  <Figure value={pct(fx.backedUpPct)} tone="text-good" label={U.fx.backedUp(offer.opponentName)} note={U.fx.followers} small />
                </dl>
                <p className="mt-3 max-w-prose text-xs leading-relaxed text-faint">{U.receiptNote}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

/** A figure with its label under it (and an optional quiet note beside the figure). */
function Figure({ value, tone, label, note, small }: { value: string; tone: string; label: string; note?: string; small?: boolean }) {
  return (
    // The label is first for a screen reader (dt before dd) and sits under the figure on screen.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="mt-1.5 text-xs leading-snug text-sub">{label}</dt>
      <dd className="flex items-baseline gap-2">
        <span className={cx("display font-bold leading-none tabular-nums", small ? "text-xl" : "text-[1.75rem]", tone)}>{value}</span>
        {note ? <span className="text-xs text-faint">{note}</span> : null}
      </dd>
    </div>
  );
}
