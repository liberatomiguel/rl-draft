/**
 * Save text ⇄ transport payload (v2.0.26) — how a career save travels to the
 * account. A save is 230 to 350 KB of JSON and gzips to 30 to 50 KB, so it goes
 * gzip-compressed, base64-encoded (`encoding: "gzip"`). A browser without
 * `CompressionStream` sends the JSON text itself (`encoding: "json"`), still
 * base64 so both travel the same way.
 *
 * No React, no store, no Supabase: only the platform's streams and base64.
 */

export type SaveEncoding = "gzip" | "json";

export interface SavePayload {
  encoding: SaveEncoding;
  /** base64 of the gzip bytes, or of the UTF-8 JSON text. */
  payload: string;
}

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Not awaited: the readable side must be drained for the write to settle.
  void writer.write(bytes as unknown as BufferSource).then(() => writer.close()).catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** True when this browser can gzip (Chrome 80, Safari 16.4, Firefox 113). */
export function canGzip(): boolean {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

/** Encode a save's JSON text for the account. Never throws on a missing
 *  `CompressionStream`: it falls back to the plain text. */
export async function encodeSaveText(text: string): Promise<SavePayload> {
  const utf8 = new TextEncoder().encode(text);
  if (canGzip()) {
    try {
      return { encoding: "gzip", payload: bytesToBase64(await pipe(utf8, new CompressionStream("gzip"))) };
    } catch {
      /* fall through to the plain text */
    }
  }
  return { encoding: "json", payload: bytesToBase64(utf8) };
}

/** Decode a payload back to the save's JSON text. Throws when the payload is
 *  not what its encoding says (the caller reports a corrupt copy). */
export async function decodeSaveText({ encoding, payload }: SavePayload): Promise<string> {
  const bytes = base64ToBytes(payload);
  if (encoding === "json") return new TextDecoder().decode(bytes);
  if (!canGzip()) throw new Error("gzip unsupported");
  return new TextDecoder().decode(await pipe(bytes, new DecompressionStream("gzip")));
}
