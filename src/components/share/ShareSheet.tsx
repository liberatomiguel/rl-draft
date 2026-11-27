"use client";

/**
 * Share kit (v2.2): the one share sheet every surface opens (a run, the
 * Daily, a duel, a Road to Worlds career, an invitation). The image is drawn
 * on open, in the format picked (Post 1200 × 630 or Story 1080 × 1920), and
 * the sheet offers every way out the browser has: the system share sheet with
 * the image, WhatsApp, X, Reddit, the image or the text on the clipboard, and
 * a download. A sheet with no image (an invitation) is the text and the link.
 *
 * Nothing leaves the device until the player picks a channel; each pick is
 * one `content_shared` event (surface, channel, format).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCopy } from "@/content/copy";
import { trackEvent } from "@/lib/analytics";
import { markShared } from "@/lib/share/shareMarks";
import { useOverlayHold } from "@/store/overlayHoldStore";
import { useSignInDialog } from "@/store/signInDialog";
import { withReferral } from "@/lib/referral";
import { useReferral } from "./useReferral";
import type { ShareFormat } from "@/lib/share/runImage";
import {
  canNativeShare,
  channelHref,
  copyImageToClipboard,
  copyTextToClipboard,
  downloadBlob,
  nativeShare,
  openChannel,
  type ShareChannel,
} from "@/lib/share/shareActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/lib/util";

export type ShareSurface = "run" | "daily" | "duel" | "career" | "invite";

export interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  surface: ShareSurface;
  gameMode: "draft" | "career" | "app";
  /** The post's words, without the link. */
  text: string;
  /** The link (already tagged with its utm). */
  url: string;
  /** One renderer per format offered; absent = a text-and-link sheet. */
  formats?: Partial<Record<ShareFormat, () => Promise<HTMLCanvasElement>>>;
  /** File name without the extension. */
  fileName?: string;
  /** A line under the preview (what the link does). */
  hint?: string;
}

const noSubscribe = () => () => {};
/** The link as a reader sees it: host and path, without the utm tags. */
function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}${u.hash ? "/…" : ""}`;
  } catch {
    return url;
  }
}
// Local, so the sheet (on the Home's shared path) does not pull the drawing kit in.
const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));

export function ShareSheet({ open, onClose, title, surface, gameMode, text, url: baseUrl, formats, fileName = "rocket-draft", hint }: ShareSheetProps) {
  const { SHARE_UI: S } = useCopy();
  // v2.2: a signed-in player's links carry their code (friends who play count for them).
  const referral = useReferral(open);
  const url = withReferral(baseUrl, referral.code);
  const showSignIn = useSignInDialog((s) => s.show);
  const offered = (["post", "story"] as const).filter((f) => formats?.[f]);
  const [format, setFormat] = useState<ShareFormat>(offered[0] ?? "post");
  const [previews, setPreviews] = useState<Partial<Record<ShareFormat, string>>>({});
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvases = useRef<Partial<Record<ShareFormat, HTMLCanvasElement>>>({});
  const blobs = useRef<Partial<Record<ShareFormat, Blob>>>({});
  // The share sheet exists only in the browser: read after mount.
  const native = useSyncExternalStore(noSubscribe, canNativeShare, () => false);
  const hasImage = offered.length > 0;
  // Unlock pop-ups (the Ambassador title on a first share) wait until the sheet closes.
  useOverlayHold("ceremony", open);

  // A new subject (another run, another career) draws again.
  const formatsRef = useRef(formats);
  useEffect(() => {
    if (formatsRef.current === formats) return;
    formatsRef.current = formats;
    canvases.current = {};
    blobs.current = {};
    setPreviews({});
  }, [formats]);

  // Draw the picked format the first time it is shown.
  useEffect(() => {
    if (!open || !hasImage || previews[format] || canvases.current[format]) return;
    const render = formats?.[format];
    if (!render) return;
    let live = true;
    render()
      .then((canvas) => {
        if (!live) return;
        canvases.current[format] = canvas;
        setPreviews((p) => ({ ...p, [format]: canvas.toDataURL("image/png") }));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [open, format, formats, hasImage, previews]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [notice]);

  const track = useCallback(
    (channel: ShareChannel) => {
      trackEvent("content_shared", { surface, channel, format: hasImage ? format : null, gameMode });
      // The Ambassador title (v2.2): any channel counts, once, forever.
      markShared();
    },
    [surface, format, hasImage, gameMode],
  );

  const blobFor = useCallback(async (): Promise<Blob | null> => {
    if (!hasImage) return null;
    const cached = blobs.current[format];
    if (cached) return cached;
    let canvas = canvases.current[format];
    if (!canvas) {
      const render = formats?.[format];
      if (!render) return null;
      canvas = await render();
      canvases.current[format] = canvas;
    }
    const blob = await canvasToBlob(canvas);
    if (blob) blobs.current[format] = blob;
    return blob;
  }, [format, formats, hasImage]);

  const fullName = `${fileName}-${format}.png`;

  const onNative = async () => {
    setBusy(true);
    try {
      const blob = await blobFor();
      const file = blob ? new File([blob], fullName, { type: "image/png" }) : null;
      const outcome = await nativeShare({ text, url, title, file });
      if (outcome === "shared") track("native");
      else if (outcome === "unsupported" && blob) {
        downloadBlob(blob, fullName);
        track("download");
        setNotice(S.downloaded);
      }
    } finally {
      setBusy(false);
    }
  };

  const onLink = (channel: "whatsapp" | "x" | "reddit" | "telegram") => {
    openChannel(channelHref(channel, text, url, title));
    track(channel);
  };

  const onCopyImage = async () => {
    const blob = await blobFor();
    const ok = blob ? await copyImageToClipboard(blob) : false;
    if (ok) track("copyImage");
    setNotice(ok ? S.imageCopied : S.copyImageFailed);
  };

  const onCopyText = async () => {
    const ok = await copyTextToClipboard(`${text} ${url}`);
    if (ok) track("copyText");
    setNotice(ok ? S.textCopied : S.copyFailed);
  };

  const onDownload = async () => {
    const blob = await blobFor();
    if (!blob) return;
    downloadBlob(blob, fullName);
    track("download");
    setNotice(S.downloaded);
  };

  const preview = previews[format];
  const story = format === "story";

  return (
    <Modal open={open} title={title} onClose={onClose} wide>
      <div className="space-y-4">
        {offered.length > 1 ? (
          <div role="tablist" aria-label={S.formatLabel} className="grid grid-cols-2 border-b border-line">
            {offered.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={format === f}
                onClick={() => setFormat(f)}
                className={cx(
                  "-mb-px flex min-h-11 flex-col justify-start border-b-2 px-2 pb-2 pt-1 text-left transition-colors",
                  format === f ? "border-orange text-ink" : "border-transparent text-sub hover:text-ink",
                )}
              >
                <span className="display block text-sm font-semibold uppercase tracking-[0.04em]">{f === "post" ? S.formatPost : S.formatStory}</span>
                <span className="block text-xs text-faint">{f === "post" ? S.formatPostHint : S.formatStoryHint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {hasImage ? (
          <div className={cx("flex justify-center", story && "rounded-lg bg-black/30 py-3")}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a canvas data URL
              <img
                src={preview}
                alt={S.previewAlt}
                className={cx(
                  "rounded-lg border border-line",
                  story ? "h-[min(58vh,560px)] w-auto" : "w-full",
                )}
              />
            ) : (
              <div
                aria-busy
                aria-label={S.rendering}
                className={cx(
                  "flex items-center justify-center rounded-lg border border-line bg-white/[0.03] text-sm text-faint",
                  story ? "aspect-[9/16] h-[min(58vh,560px)]" : "aspect-[1200/630] w-full",
                )}
              >
                {failed ? S.renderFailed : S.rendering}
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <Button variant="primary" full size="lg" disabled={busy || (hasImage && !preview && !failed)} onClick={() => void (native ? onNative() : hasImage ? onDownload() : onCopyText())}>
            {native ? S.share : hasImage ? S.download : S.copyText}
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="secondary" onClick={() => onLink("whatsapp")}>{S.whatsapp}</Button>
            <Button variant="secondary" onClick={() => onLink("x")}>{S.x}</Button>
            <Button variant="secondary" onClick={() => onLink("reddit")}>{S.reddit}</Button>
            <Button variant="secondary" onClick={() => onLink("telegram")}>{S.telegram}</Button>
            {hasImage ? <Button variant="ghost" onClick={() => void onCopyImage()}>{S.copyImage}</Button> : null}
            {/* The primary is already "Copy text" on a text-only sheet without a share sheet. */}
            {native || hasImage ? <Button variant="ghost" onClick={() => void onCopyText()}>{S.copyText}</Button> : null}
            {hasImage && native ? <Button variant="ghost" onClick={() => void onDownload()}>{S.download}</Button> : null}
          </div>
        </div>

        <p role="status" aria-live="polite" className="-mt-1 min-h-5 text-center text-sm text-sub">
          {notice ?? (story ? S.storyTip : "")}
        </p>

        {/* What goes with the post, after the actions (a phone sees the actions first). */}
        <div className="rounded-lg border border-line bg-white/[0.02] px-3 py-2.5">
          <p className="display text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{S.caption}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-snug text-ink">{text}</p>
          <p className="mt-1 break-all text-xs text-blue-bright">{displayUrl(url)}</p>
        </div>
        {hint ? <p className="text-sm leading-snug text-sub">{hint}</p> : null}
        {referral.enabled && !referral.signedIn ? (
          <p className="text-sm leading-snug text-sub">
            {S.referralSignedOut}{" "}
            <button
              type="button"
              className="font-semibold text-blue-bright underline-offset-4 hover:underline"
              onClick={() => {
                onClose();
                showSignIn();
              }}
            >
              {S.referralSignIn}
            </button>
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
