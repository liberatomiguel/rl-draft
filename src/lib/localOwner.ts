/**
 * Which account the device's local saves belong to (v2.0.29, DESIGN-DECISIONS
 * #170). The profile (accountStore) and the Road to Worlds slots (this file)
 * belong to ONE account at a time:
 *  - a guest's saves are claimed by the first account that signs in;
 *  - signing out moves that account's career slots aside under its id
 *    (`rocket-draft:career-stash:v1:<id>`) and the device goes back to a guest
 *    with no careers; the next sign-in of that account moves them back;
 *  - another account never sees, and never uploads, them.
 *
 * Works on raw localStorage only: it must not import the career store (the
 * shared path stays light). A career store that is loaded in this tab follows
 * through `onLocalCareerReplaced`, and the career cloud store ignores the slot
 * changes that causes (`localCareerSwitching`), so moving a career aside is
 * never read as the player deleting it.
 *
 * Plain keys next to the persisted stores, not zustand stores, so not part of
 * the persist contract. Each step falls back to memory when storage is missing
 * or blocked.
 */

export const LOCAL_OWNER_KEY = "rocket-draft:profile-owner:v1";
/** The career store's persist key (frozen by persistContract.test.ts). */
export const CAREER_PERSIST_KEY = "rocket-draft:career:v1";
export const CAREER_STASH_PREFIX = "rocket-draft:career-stash:v1:";

type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let ownerMem: string | null = null;
let testStorage: KeyStore | null | undefined;

function storage(): KeyStore | null {
  if (testStorage !== undefined) return testStorage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Tests only: a stand-in storage (null = none), or undefined for the real one. */
export function setLocalOwnerStorageForTests(s: KeyStore | null | undefined): void {
  testStorage = s;
}

export function readLocalOwner(): string | null {
  try {
    const ls = storage();
    if (ls) return ls.getItem(LOCAL_OWNER_KEY);
  } catch {
    // fall through to memory
  }
  return ownerMem;
}

export function writeLocalOwner(userId: string | null): void {
  ownerMem = userId;
  try {
    const ls = storage();
    if (!ls) return;
    if (userId) ls.setItem(LOCAL_OWNER_KEY, userId);
    else ls.removeItem(LOCAL_OWNER_KEY);
  } catch {
    // memory still holds it for this tab
  }
}

/** Tests only: no owner. */
export function forgetLocalOwnerForTests(): void {
  ownerMem = null;
  try {
    storage()?.removeItem(LOCAL_OWNER_KEY);
  } catch {
    // nothing stored
  }
}

// --- career slots ------------------------------------------------------------

interface CareerPersisted {
  state: {
    slots: unknown[];
    activeSlot: number | null;
    achievements?: { unlocked?: Record<string, unknown>; worldsWonOn?: Record<string, unknown> };
    [k: string]: unknown;
  };
  version?: number;
}

function parseCareer(raw: string | null): CareerPersisted | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CareerPersisted;
    return v && typeof v === "object" && v.state && Array.isArray(v.state.slots) ? v : null;
  } catch {
    return null;
  }
}

const hasCareers = (v: CareerPersisted | null): boolean => Boolean(v?.state.slots.some((s) => s));

const hasMemory = (v: CareerPersisted | null): boolean =>
  Object.keys(v?.state.achievements?.unlocked ?? {}).length > 0 ||
  Object.keys(v?.state.achievements?.worldsWonOn ?? {}).length > 0;

/** `incoming` keeps its slots; `base`'s careers fill the empty ones. Returns the
 *  merge and what did not fit (null when everything did). */
function placeCareers(
  incoming: CareerPersisted,
  base: CareerPersisted,
): { merged: CareerPersisted; leftover: CareerPersisted | null } {
  if (incoming.version !== base.version) return { merged: incoming, leftover: hasCareers(base) ? base : null };
  const slots = [...incoming.state.slots];
  const left: unknown[] = base.state.slots.map(() => null);
  base.state.slots.forEach((career, i) => {
    if (!career) return;
    if (!slots[i]) slots[i] = career;
    else left[i] = career;
  });
  const a = incoming.state.achievements ?? {};
  const b = base.state.achievements ?? {};
  const activeSlot =
    incoming.state.activeSlot !== null && slots[incoming.state.activeSlot] ? incoming.state.activeSlot : base.state.activeSlot;
  const merged: CareerPersisted = {
    ...incoming,
    state: {
      ...incoming.state,
      slots,
      activeSlot: activeSlot !== null && slots[activeSlot] ? activeSlot : null,
      achievements: {
        unlocked: { ...(b.unlocked ?? {}), ...(a.unlocked ?? {}) },
        worldsWonOn: { ...(b.worldsWonOn ?? {}), ...(a.worldsWonOn ?? {}) },
      },
    },
  };
  const leftover = left.some((s) => s)
    ? { ...base, state: { ...base.state, slots: left, activeSlot: null, achievements: {} } }
    : null;
  return { merged, leftover };
}

const careerListeners = new Set<() => void>();
let switching = 0;

/** A career store loaded in this tab re-reads its slots when they were moved. */
export function onLocalCareerReplaced(cb: () => void): () => void {
  careerListeners.add(cb);
  return () => careerListeners.delete(cb);
}

/** True while the slots are being swapped for another owner's: not the player's doing. */
export function localCareerSwitching(): boolean {
  return switching > 0;
}

/** Run `fn` (the career store re-reading its slots) as part of an owner switch. */
export function asCareerSwitch(fn: () => unknown): void {
  switching += 1;
  let out: unknown;
  try {
    out = fn();
  } catch {
    switching -= 1;
    return;
  }
  if (out && typeof (out as Promise<unknown>).then === "function") {
    void Promise.resolve(out)
      .catch(() => {})
      .finally(() => (switching -= 1));
  } else {
    switching -= 1;
  }
}

function notifyCareer(): void {
  for (const cb of [...careerListeners]) {
    try {
      cb();
    } catch {
      // one listener never blocks the others
    }
  }
}

/** Move this device's career slots aside for `userId` (signing out, or another
 *  account taking the device). False when they could not be moved (no storage,
 *  or no room): the slots are then left in place, nothing is lost. */
export function stashCareersFor(userId: string): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    const raw = ls.getItem(CAREER_PERSIST_KEY);
    const live = parseCareer(raw);
    if (!raw || !live || (!hasCareers(live) && !hasMemory(live))) {
      if (raw && live) {
        ls.removeItem(CAREER_PERSIST_KEY);
        notifyCareer();
      }
      return true;
    }
    const key = CAREER_STASH_PREFIX + userId;
    const prev = parseCareer(ls.getItem(key));
    const next = prev ? placeCareers(live, prev).merged : live;
    // Free the live copy first: a save can be over 1 MB, and two copies of it
    // may not fit. A failed write puts it back.
    ls.removeItem(CAREER_PERSIST_KEY);
    try {
      ls.setItem(key, JSON.stringify(next));
    } catch {
      ls.setItem(CAREER_PERSIST_KEY, raw);
      return false;
    }
    notifyCareer();
    return true;
  } catch {
    return false;
  }
}

/** Bring back what `userId` left on this device. A guest's careers already in
 *  the slots stay where they are; the account's fill the empty ones, and any
 *  that do not fit stay aside for later. */
export function restoreCareersFor(userId: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    const key = CAREER_STASH_PREFIX + userId;
    const stash = parseCareer(ls.getItem(key));
    if (!stash) {
      ls.removeItem(key);
      return;
    }
    const live = parseCareer(ls.getItem(CAREER_PERSIST_KEY));
    const { merged, leftover } = live ? placeCareers(live, stash) : { merged: stash, leftover: null };
    ls.removeItem(key);
    try {
      ls.setItem(CAREER_PERSIST_KEY, JSON.stringify(merged));
    } catch {
      ls.setItem(key, JSON.stringify(stash)); // no room: keep it aside, untouched
      return;
    }
    if (leftover) {
      try {
        ls.setItem(key, JSON.stringify(leftover));
      } catch {
        // the careers that did not fit are still in the account copy
      }
    }
    notifyCareer();
  } catch {
    // storage blocked: nothing moved
  }
}

/** The account was deleted: what it left aside goes too. */
export function dropCareerStash(userId: string): void {
  try {
    storage()?.removeItem(CAREER_STASH_PREFIX + userId);
  } catch {
    // nothing stored
  }
}
