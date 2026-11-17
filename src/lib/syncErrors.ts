/**
 * Cloud sync failures, named (v2.0.25) — pure, no network, no React.
 *
 * Until 2.0.24 a failed sync reported only its stage (read / push), so the 12 %
 * of accounts with a failure (POSTLAUNCH-2.0-REPORT item 6) could not be told
 * apart. Every failure now carries a REASON: it goes out with the
 * `account_sync_failed` event and decides whether the sync tries again.
 */

export type SyncFailReason =
  /** The browser says it is offline: wait for the connection, do not hammer. */
  | "offline"
  /** The request never got an answer (dropped connection, DNS, blocked). */
  | "network"
  /** No valid session token: expired and not refreshed yet, or signed out elsewhere. */
  | "auth"
  /** The database refused the row (row-level security / permission). */
  | "denied"
  /** A constraint refused the row: in practice the unique display name. */
  | "conflict"
  /** The server answered with an error (5xx, timeout). */
  | "server"
  /** The server asked for fewer requests (429): wait, never retry at once. */
  | "rate"
  /** supabase-js could not be downloaded, or accounts are off in this build. */
  | "unavailable"
  | "other";

/** What a failed cloud call reports. `code` is the short database / PostgREST code. */
export interface SyncFailure {
  error: string;
  reason: SyncFailReason;
  code?: string;
}

export interface SyncErrorInput {
  message?: string | null;
  /** Postgres SQLSTATE ("23505") or PostgREST code ("PGRST301"). */
  code?: string | null;
  /** HTTP status; 0 when the request never completed. */
  status?: number | null;
  /** `navigator.onLine` at the time of the failure, when known. */
  online?: boolean;
}

const NETWORK_TEXT = /failed to fetch|load failed|networkerror|network request failed|fetch failed|aborted|timed? ?out/i;

/** Name a failure from what supabase-js / fetch reported. Order matters: the
 *  database code is the most specific fact, the message text the least. */
export function classifySyncError(input: SyncErrorInput): SyncFailReason {
  const code = input.code ?? "";
  const status = input.status ?? null;
  const message = input.message ?? "";
  // 23505 = unique violation: on `profiles` that is the display name index.
  if (code === "23505") return "conflict";
  if (code === "42501" || /row-level security/i.test(message)) return "denied";
  if (/^PGRST30[123]$/.test(code) || status === 401 || /jwt/i.test(message)) return "auth";
  if (status === 403) return "denied";
  if (status === 429) return "rate";
  // Postgres classes 08 (connection), 53 (out of resources), 57 (cancelled /
  // statement timeout): the server could not finish, whatever the HTTP status.
  if (/^(08|53|57)/.test(code)) return "server";
  if (status !== null && (status >= 500 || status === 408)) return "server";
  if (status === 0 || NETWORK_TEXT.test(message)) return input.online === false ? "offline" : "network";
  return "other";
}

/** Worth trying again at once, within the same sync: the next attempt may simply
 *  work. Not `offline` (it waits for the `online` event), not `rate` (the server
 *  asked for less), not `auth` (auth-js remembers a failed token refresh for a
 *  minute, so an immediate retry gets the same answer without a request);
 *  `denied` / `conflict` / `other` are answers, not accidents. */
export function isTransientSyncFailure(reason: SyncFailReason | undefined): boolean {
  return reason === "network" || reason === "server" || reason === "unavailable";
}

/** Worth a later, spaced-out attempt: the sync stays owed. */
export function isRecoverableSyncFailure(reason: SyncFailReason | undefined): boolean {
  return reason === "offline" || reason === "rate" || reason === "auth" || isTransientSyncFailure(reason);
}
