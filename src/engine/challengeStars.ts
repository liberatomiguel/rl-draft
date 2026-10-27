/**
 * Challenge stars (v2.0): the bit masks a profile stores per challenge and the
 * counts read from them. No dataset import, so the cloud-sync row builder
 * (`lib/supabase.ts`, on every page through the account store) can count stars
 * without loading the challenges engine (rc.26, #60). `./challenges` re-exports
 * all of it.
 */

/** Bit masks for the three stars (v2.0). */
export const STAR_CLEAR = 1;
export const STAR_2 = 2;
export const STAR_3 = 4;
export const ALL_STARS = STAR_CLEAR | STAR_2 | STAR_3;

export function countStars(mask: number): number {
  let n = 0;
  for (let m = mask | 0; m; m >>>= 1) n += m & 1;
  return n;
}

/** Total stars across a profile's `challengeStars` map. */
export function totalStars(stars: Record<string, number>): number {
  return Object.values(stars).reduce((n, m) => n + countStars(m), 0);
}
