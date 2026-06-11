/**
 * Seedable deterministic RNG (mulberry32).
 *
 * Every run stores its seed + the current cursor (`state`), so a page reload
 * resumes with identical randomness and future features (daily challenge with
 * a shared seed, replays) come for free.
 */

export interface Rng {
  /** Float in [0, 1). Advances the state. */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Triangular-ish roll in [min, max] (sum of two halves → fewer extremes). */
  roll(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** Weighted pick; weights must be >= 0 and not all zero. */
  weightedPick<T>(arr: readonly T[], weightOf: (item: T) => number): T;
  /** Fisher-Yates shuffle (returns a new array). */
  shuffle<T>(arr: readonly T[]): T[];
  /** Current internal state — persist this to resume deterministically. */
  readonly state: number;
}

export function createRng(seedOrState: number): Rng {
  let a = seedOrState >>> 0;

  function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const rng: Rng = {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    range(min, max) {
      return next() * (max - min) + min;
    },
    roll(min, max) {
      // Average of two uniforms → triangular distribution centered mid-range.
      const u = (next() + next()) / 2;
      return u * (max - min) + min;
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (arr.length === 0) throw new Error("rng.pick on empty array");
      return arr[Math.floor(next() * arr.length)];
    },
    weightedPick(arr, weightOf) {
      if (arr.length === 0) throw new Error("rng.weightedPick on empty array");
      let total = 0;
      for (const item of arr) total += Math.max(0, weightOf(item));
      if (total <= 0) return rng.pick(arr);
      let target = next() * total;
      for (const item of arr) {
        target -= Math.max(0, weightOf(item));
        if (target <= 0) return item;
      }
      return arr[arr.length - 1];
    },
    shuffle(arr) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    get state() {
      return a;
    },
  };

  return rng;
}

/** Non-deterministic seed for new runs. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
