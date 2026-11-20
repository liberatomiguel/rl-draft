/**
 * Road to Worlds — deterministic seed derivation (design doc §13).
 *
 * A career persists ONE root seed; every random stream derives its own 32-bit
 * seed from `deriveSeed(careerSeed, streamId)` (FNV-1a over the stream id,
 * finished with the murmur3 fmix32 avalanche). Streams are independent, so a
 * feature change can add NEW streams without reshuffling any existing career —
 * unlike a single linear cursor.
 *
 * STREAM-ID GRAMMAR (a compatibility surface — never rename a shipped id,
 * never reorder consumption within a shipped stream):
 *   evt:{seasonIndex}:{split}:{kind}{ordinal}:{region}  one tournament (field build + sim)
 *   evt:{seasonIndex}:worlds                            the Worlds event
 *   dev:{seasonIndex}:{week}                            weekly development tick
 *   mkt:{seasonIndex}:{windowIdx}:{week}                market resolution tick
 *   world:{seasonIndex}:rollover                        season-boundary world pass
 *   rand:{seasonIndex}:{week}                           random-event roll
 *   news:{seasonIndex}:{week}                           news template/flavor picks
 *   gen:{what}:{key}                                    entity generation (fillers, rookies, offers)
 *   create                                              career-creation draws
 *   ser:{eventStream}:{roundKey}:{teamAId}:{teamBId}    the user's own series (Matchday, v2.1)
 *
 * Only the user's ACTIVE event ever persists a mid-stream RNG cursor
 * (ActiveEventState.rngState — the runStore resume trick); every other stream
 * is consumed atomically inside one store action.
 */

export function deriveSeed(careerSeed: number, streamId: string): number {
  // FNV-1a, seeded by the career seed xor a golden-ratio constant.
  let h = ((careerSeed >>> 0) ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < streamId.length; i++) {
    h ^= streamId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // murmur3 fmix32 avalanche — prevents correlated seeds from similar ids.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Convenience builders for the documented stream ids (typo-proof call sites). */
export const streams = {
  event: (seasonIndex: number, split: number, kind: string, ordinal: number, region?: string) =>
    `evt:${seasonIndex}:${split}:${kind}${ordinal}${region ? `:${region}` : ""}`,
  worlds: (seasonIndex: number) => `evt:${seasonIndex}:worlds`,
  dev: (seasonIndex: number, week: number) => `dev:${seasonIndex}:${week}`,
  market: (seasonIndex: number, windowIdx: number, week: number) =>
    `mkt:${seasonIndex}:${windowIdx}:${week}`,
  rollover: (seasonIndex: number) => `world:${seasonIndex}:rollover`,
  random: (seasonIndex: number, week: number) => `rand:${seasonIndex}:${week}`,
  news: (seasonIndex: number, week: number) => `news:${seasonIndex}:${week}`,
  gen: (what: string, key: string) => `gen:${what}:${key}`,
  create: () => "create",
  series: (eventStream: string, roundKey: string, teamAId: string, teamBId: string) =>
    `ser:${eventStream}:${roundKey}:${teamAId}:${teamBId}`,
} as const;

/**
 * Seed of the user's OWN series RNG (Matchday, docs/MATCHDAY-SPEC.md §3 B).
 *
 * `eventStream` is the event's stream id (`streams.event(...)` /
 * `streams.worlds(...)`), `roundKey` the round's position in it
 * (eventPlayback's RoundRef.key, e.g. "sw:2" / "po:0"), as `matchTimeline`
 * uses. A team plays once per round, so round + both teams pin the series.
 * Team order matters (the engine draws side A first): pass them in the same
 * order as `startSeries`.
 *
 * Its own stream means the user's series can stop between games while the
 * rest of the round is simulated at once on the round's RNG. NOT wired in yet
 * (slice 1): taking the user's series off the round RNG would reshuffle every
 * other series of that round, so it lands with the slice that moves results.
 */
export function seriesSeed(
  careerSeed: number,
  eventStream: string,
  roundKey: string,
  teamAId: string,
  teamBId: string,
): number {
  return deriveSeed(careerSeed, streams.series(eventStream, roundKey, teamAId, teamBId));
}

/**
 * Deterministic 0..1 float from a stream id — for per-entity derived values
 * (potential jitter, archetype pick, debut age) that must be stable per
 * career+entity without consuming any RNG cursor.
 */
export function derivedFloat(careerSeed: number, streamId: string): number {
  return deriveSeed(careerSeed, streamId) / 4294967296;
}
