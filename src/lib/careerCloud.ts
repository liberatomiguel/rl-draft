/**
 * Road to Worlds cloud save — the reconcile rule (v2.0.26). PURE: no network,
 * no store, no clock. `decideSlot` looks at one save slot from three sides and
 * says what to do; the store (`store/careerCloudStore.ts`) carries it out.
 *
 * The three sides:
 *  - LOCAL: the save in this browser's localStorage. It stays the copy the game
 *    plays from (DESIGN-DECISIONS: player saves live on the device).
 *  - CLOUD: the row in `career_saves` for this account and slot (metadata only;
 *    the payload is downloaded when it is going to be used).
 *  - BASE: what this browser and the account last agreed on for the slot (which
 *    career, which cloud revision, which local stamp). It is what tells "I
 *    played here" from "someone played elsewhere".
 *
 * Careers do not merge. Either one side is simply ahead of the base (then it
 * wins without a question: an upload, or a fast-forward download), or both
 * moved / the careers differ / the account copy vanished, and the player is
 * asked. Dates are shown to the player and mark the newer copy in the notice;
 * they never decide silently, because a device clock can be wrong.
 */

/** The local save, reduced to what the rule needs. */
export interface LocalSlotInfo {
  careerId: string;
  /** `CareerSave.lastPlayedAt`: stamped by the store on every write. */
  stamp: number;
  seq: number;
  saveVersion: number;
}

/** What the saves screen and the conflict notice show without the payload. */
export interface CareerCloudSummary {
  orgName: string;
  abbrev: string;
  region: string;
  difficulty: string;
  seasonIndex: number;
  day: number;
  ended: boolean;
}

/** One `career_saves` row without its payload. */
export interface CloudSlotMeta {
  slot: number;
  careerId: string;
  saveVersion: number;
  seq: number;
  /** Server-owned counter, +1 per write: the optimistic-concurrency check. */
  revision: number;
  /** The writing device's clock at its last career action (ms). */
  savedAt: number;
  /** The server's clock at the last write (ms). */
  updatedAt: number;
  deviceId: string;
  summary: Partial<CareerCloudSummary>;
}

/** What this browser and the account last agreed on for one slot. */
export interface SlotBase {
  careerId: string;
  revision: number;
  /** The local stamp of the copy that was uploaded / downloaded then. */
  stamp: number;
  /** The slot was emptied on this device afterwards: the account copy is to be
   *  deleted too, unless another device has played it since. */
  deleted?: boolean;
}

export type ConflictKind =
  /** Same career, played on both sides since the last sync. */
  | "diverged"
  /** The slot holds two different careers. */
  | "different-career"
  /** The account copy was deleted elsewhere; this device still has the career. */
  | "cloud-deleted";

export type SlotAction =
  /** In sync, or nothing on either side. `base` is what to remember (null = forget). */
  | { type: "idle"; base: SlotBase | null }
  /** Both sides hold the same copy but nothing was recorded: remember it. */
  | { type: "adopt"; base: SlotBase }
  /** This device is ahead: write the account copy. `expectedRevision` is the
   *  revision the write must find (null = no row). */
  | { type: "upload"; expectedRevision: number | null }
  /** The account is ahead, or this slot is empty here: take the account copy. */
  | { type: "download" }
  /** The slot was emptied here: delete the account copy of `careerId`. */
  | { type: "delete-cloud"; careerId: string }
  /** The player decides. */
  | { type: "conflict"; kind: ConflictKind }
  /** The account copy was written by a newer build: leave both sides alone. */
  | { type: "newer-build" };

export interface DecideInput {
  local: LocalSlotInfo | null;
  cloud: CloudSlotMeta | null;
  base: SlotBase | null;
  /** The newest `saveVersion` this build can load. */
  maxSaveVersion: number;
}

const baseOf = (careerId: string, revision: number, stamp: number): SlotBase => ({ careerId, revision, stamp });

/** What to do with one slot. Total: every combination returns an action. */
export function decideSlot({ local, cloud, base, maxSaveVersion }: DecideInput): SlotAction {
  if (!local && !cloud) return { type: "idle", base: null };

  if (local && !cloud) {
    // The career was in the account and is gone: another device deleted it.
    if (base && !base.deleted && base.careerId === local.careerId) return { type: "conflict", kind: "cloud-deleted" };
    // Nothing recorded, or the record is about another career: a new career.
    return { type: "upload", expectedRevision: null };
  }

  if (!local && cloud) {
    if (cloud.saveVersion > maxSaveVersion) return { type: "newer-build" };
    // Emptied on this device, and nobody has played the account copy since.
    if (base?.deleted && base.careerId === cloud.careerId && base.revision === cloud.revision) {
      return { type: "delete-cloud", careerId: cloud.careerId };
    }
    return { type: "download" };
  }

  const l = local as LocalSlotInfo;
  const c = cloud as CloudSlotMeta;
  if (c.saveVersion > maxSaveVersion) return { type: "newer-build" };
  const cloudUnchanged = Boolean(base && base.careerId === c.careerId && base.revision === c.revision);

  if (l.careerId !== c.careerId) {
    // The account still holds the career this device last synced, and THIS
    // PLAYER has since emptied or replaced the slot here (the `deleted` mark:
    // deleted and founded a new club, or imported a file): their own, confirmed
    // action. It goes up. Without the mark the slot changed some other way (a
    // second account on this browser took its own copy): that is a question.
    if (cloudUnchanged && base?.deleted) return { type: "upload", expectedRevision: c.revision };
    return { type: "conflict", kind: "different-career" };
  }

  const localUnchanged = Boolean(base && !base.deleted && base.careerId === l.careerId && base.stamp === l.stamp);
  if (localUnchanged && cloudUnchanged) return { type: "idle", base: baseOf(l.careerId, c.revision, l.stamp) };
  if (!localUnchanged && cloudUnchanged) return { type: "upload", expectedRevision: c.revision };
  if (localUnchanged && !cloudUnchanged) return { type: "download" };
  // Both moved, or nothing was recorded. The very same copy on both sides (a
  // cleared browser record, an imported file of the account copy) is no conflict.
  if (l.stamp === c.savedAt && l.seq === c.seq) return { type: "adopt", base: baseOf(l.careerId, c.revision, l.stamp) };
  return { type: "conflict", kind: "diverged" };
}

/** Which side the notice marks as the more recent one (by the clocks: a hint
 *  for the player, never the decision). */
export function newerSide(localStamp: number, cloudSavedAt: number): "local" | "cloud" {
  return cloudSavedAt > localStamp ? "cloud" : "local";
}

// ---------------------------------------------------------------------------
// The browser's record (`rocket-draft:career-cloud:v1`): bookkeeping, not a save
// ---------------------------------------------------------------------------

/** Per account: the base of each of the three slots. */
export interface CareerCloudBook {
  /** A random id for this browser, so a row can say which device wrote it. */
  deviceId: string;
  users: Record<string, { slots: (SlotBase | null)[] }>;
}

export const CAREER_CLOUD_SLOTS = 3;

export function emptyBook(deviceId: string): CareerCloudBook {
  return { deviceId, users: {} };
}

/** Read a stored record defensively: anything malformed is dropped, so a bad
 *  record can only cost a question to the player, never a save. */
export function parseBook(raw: string | null, newDeviceId: () => string): CareerCloudBook {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const src = parsed && typeof parsed === "object" ? (parsed as Partial<CareerCloudBook>) : {};
  const deviceId = typeof src.deviceId === "string" && src.deviceId.length > 0 && src.deviceId.length <= 64 ? src.deviceId : newDeviceId();
  const book = emptyBook(deviceId);
  const users = src.users && typeof src.users === "object" ? src.users : {};
  for (const [userId, entry] of Object.entries(users)) {
    const slots = Array.isArray(entry?.slots) ? entry.slots : [];
    book.users[userId] = {
      slots: Array.from({ length: CAREER_CLOUD_SLOTS }, (_, i) => {
        const b = slots[i] as Partial<SlotBase> | null | undefined;
        if (!b || typeof b.careerId !== "string" || typeof b.revision !== "number" || typeof b.stamp !== "number") return null;
        return { careerId: b.careerId, revision: b.revision, stamp: b.stamp, ...(b.deleted ? { deleted: true } : {}) };
      }),
    };
  }
  return book;
}

export function baseFor(book: CareerCloudBook, userId: string, slot: number): SlotBase | null {
  return book.users[userId]?.slots[slot] ?? null;
}

/** A new record with one slot's base replaced (the input is not mutated). */
export function withBase(book: CareerCloudBook, userId: string, slot: number, base: SlotBase | null): CareerCloudBook {
  const current = book.users[userId]?.slots ?? Array.from({ length: CAREER_CLOUD_SLOTS }, () => null);
  const slots = current.map((b, i) => (i === slot ? base : b));
  return { ...book, users: { ...book.users, [userId]: { slots } } };
}

/**
 * The player emptied `slot` on this device (it held `careerId`), or put another
 * career in it. The account whose copy is to go too is marked:
 *  - `signedIn` given: that account only. Someone else's backup on a shared
 *    browser is never deleted by the person who happens to be signed in;
 *  - nobody signed in: the account of this browser when it has known exactly
 *    one (the usual case: the player signed out, or the session expired). With
 *    two or more accounts on record nothing is marked: the career comes back at
 *    the next sign-in, which is the safe mistake.
 * The input is not mutated.
 */
export function withLocalDelete(
  book: CareerCloudBook,
  slot: number,
  careerId: string,
  signedIn: string | null,
): CareerCloudBook {
  const known = Object.keys(book.users);
  const target = signedIn ?? (known.length === 1 ? known[0] : null);
  if (!target) return book;
  const base = baseFor(book, target, slot);
  if (!base || base.careerId !== careerId || base.deleted) return book;
  return withBase(book, target, slot, { ...base, deleted: true });
}
