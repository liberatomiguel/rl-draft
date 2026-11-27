/**
 * Share kit (v2.2): the ways out of a share sheet. Every channel is a plain
 * link or a browser API: no SDK, no script from a social network, nothing
 * sent anywhere until the player picks a channel.
 */

export type ShareChannel = "native" | "whatsapp" | "x" | "reddit" | "telegram" | "copyImage" | "copyText" | "download";

/** Where a link channel opens. The text already ends with the link where it should. */
export function channelHref(channel: "whatsapp" | "x" | "reddit" | "telegram", text: string, url: string, title: string): string {
  const enc = encodeURIComponent;
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${enc(`${text} ${url}`)}`;
    case "x":
      return `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`;
    case "telegram":
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
  }
}

export function openChannel(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * The system share sheet, with the image when the browser takes files. The
 * link rides at the end of the text (several apps drop `url` when a file is
 * attached, others print it twice).
 */
export async function nativeShare(opts: { text: string; url: string; title: string; file?: File | null }): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canNativeShare()) return "unsupported";
  const message = `${opts.text} ${opts.url}`;
  const data: ShareData = { title: opts.title, text: message };
  if (opts.file && navigator.canShare?.({ files: [opts.file] })) data.files = [opts.file];
  try {
    await navigator.share(data);
    return "shared";
  } catch (err) {
    // A dismissed sheet is an AbortError; anything else: the sheet refused.
    return err instanceof DOMException && err.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

/** The image on the clipboard (Chrome, Edge, Safari): paste into Discord or a chat. */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    const Item = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!Item || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new Item({ [blob.type || "image/png"]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Text on the clipboard, with the old textarea route where the async clipboard is refused. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
