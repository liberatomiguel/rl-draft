/**
 * "New" markers (rc.33, COL-02c) — a pure, reusable model of what a player has
 * not looked at yet, for one SCOPE: the profile today, a career save in phase 2
 * (UX-06). No dataset, no React: a scope adapter supplies its keys.
 *
 * - An ITEM is a string key `<kind>:<id>` (`itemKey`), unique inside its scope.
 * - The scope derives the keys it can show right now — its AVAILABLE keys
 *   (owned cards, discovered teams, unlocked challenges…) — from its own state.
 * - The persisted `SeenState` lists the keys the player has OPENED. NEW =
 *   available and not seen. Visiting a tab marks nothing; opening the content
 *   does (`markSeen`), so the dot outside and the tag inside clear together.
 * - Seeding (never "everything is new"): a scope with NO state yet — a save from
 *   before the feature, a fresh profile — has seen everything it can show. Its
 *   state is first written when something ARRIVES in the available set, seeded
 *   from the set BEFORE that arrival (`seedOnChange`), so exactly it is new.
 * - Quiet arrivals: content that comes in through a merge (the cloud, another
 *   tab) is not news on this device — `withQuietArrivals` marks it seen.
 *
 * Seen keys are never pruned: an item that leaves the available set (a challenge
 * locked again by a season reset) does not come back as new.
 */

/** A scope's persisted "New" state. */
export interface SeenState {
  /** Sorted keys the player has opened, or could already see when the scope was seeded. */
  seen: string[];
}

/** An item identity: `<kind>:<id>`, unique inside its scope. */
export function itemKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** The kind part of a key (`"sp:abc"` → `"sp"`). */
export function keyKind(key: string): string {
  const i = key.indexOf(":");
  return i < 0 ? "" : key.slice(0, i);
}

/** The id part of a key (`"sp:abc"` → `"abc"`). */
export function keyId(key: string): string {
  const i = key.indexOf(":");
  return i < 0 ? key : key.slice(i + 1);
}

/** A seeded state: everything in `available` counts as seen. */
export function seedSeen(available: Iterable<string>): SeenState {
  return { seen: [...new Set(available)].sort() };
}

/** The new keys, in `available` order (deduplicated). An unseeded scope has none. */
export function newKeys(state: SeenState | undefined, available: Iterable<string>): string[] {
  if (!state) return [];
  const seen = new Set(state.seen);
  const out = new Set<string>();
  for (const key of available) if (!seen.has(key)) out.add(key);
  return [...out];
}

/**
 * Mark keys as opened. An unseeded scope is seeded from `available` first (so
 * opening one item never turns the rest into news). Returns `state` itself when
 * nothing changed, so a store can skip the write.
 */
export function markSeen(
  state: SeenState | undefined,
  keys: Iterable<string>,
  available: Iterable<string>,
): SeenState {
  const base = state ?? seedSeen(available);
  const seen = new Set(base.seen);
  let changed = !state;
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      changed = true;
    }
  }
  return changed ? { seen: [...seen].sort() } : base;
}

/**
 * The first write of an unseeded scope: when something ARRIVED (a key in
 * `after` that `before` lacks), seed it from `before`, so exactly the arrival is
 * new. Returns undefined when there is nothing to write: already seeded, or no
 * arrival (no change, or only removals — a reset, a challenge locked again).
 */
export function seedOnChange(
  state: SeenState | undefined,
  before: readonly string[],
  after: readonly string[],
): SeenState | undefined {
  if (state) return undefined;
  const had = new Set(before);
  if (!after.some((key) => !had.has(key))) return undefined;
  return seedSeen(before);
}

/**
 * A merge brought content in (`before` → `after`): it is not news on this
 * device, so the arrivals are marked seen. An unseeded scope stays unseeded (it
 * has seen everything it can show anyway). Returns `state` itself when nothing
 * arrived.
 */
export function withQuietArrivals(
  state: SeenState | undefined,
  before: readonly string[],
  after: readonly string[],
): SeenState | undefined {
  if (!state) return undefined;
  const had = new Set(before);
  const arrivals = after.filter((key) => !had.has(key));
  return arrivals.length ? markSeen(state, arrivals, after) : state;
}

/** Same set of keys, order and duplicates aside. */
export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const key of sa) if (!sb.has(key)) return false;
  return true;
}
