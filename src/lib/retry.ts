/**
 * Try again after a pause (v2.0.25) — for calls that report failure in their
 * RESULT instead of throwing (the cloud read / push). Pure apart from the timer.
 */

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `attempt`; while `shouldRetry(result)` holds and pauses remain, wait the
 * next pause and run it again. Returns the last result. `delaysMs` is the list
 * of pauses, so its length is the number of extra attempts.
 */
export async function retrying<T>(
  attempt: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void> = wait,
): Promise<T> {
  let result = await attempt();
  for (const delay of delaysMs) {
    if (!shouldRetry(result)) break;
    await sleep(delay);
    result = await attempt();
  }
  return result;
}
