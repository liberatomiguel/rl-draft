import { describe, expect, it, vi } from "vitest";
import { retrying } from "./retry";

describe("retrying", () => {
  it("does not retry or sleep when the first result is fine", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(retrying(attempt, (r) => r !== "ok", [10, 20], sleep)).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries up to delays.length extra attempts and returns the last result", async () => {
    let n = 0;
    const attempt = vi.fn(async () => `fail-${++n}`);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await retrying(attempt, () => true, [10, 20, 30], sleep);
    expect(attempt).toHaveBeenCalledTimes(4);
    expect(result).toBe("fail-4");
  });

  it("stops as soon as shouldRetry is false", async () => {
    const results = ["bad", "bad", "good", "never"];
    const attempt = vi.fn(async () => results.shift()!);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await retrying(attempt, (r) => r === "bad", [1, 2, 3, 4], sleep);
    expect(result).toBe("good");
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("passes each delay to sleep, in order", async () => {
    const attempt = vi.fn().mockResolvedValue("bad");
    const sleep = vi.fn().mockResolvedValue(undefined);
    await retrying(attempt, () => true, [1200, 4000, 9000], sleep);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1200, 4000, 9000]);
  });

  it("with no delays, runs once", async () => {
    const attempt = vi.fn().mockResolvedValue("bad");
    await expect(retrying(attempt, () => true, [])).resolves.toBe("bad");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("uses a real timer by default", async () => {
    vi.useFakeTimers();
    try {
      const attempt = vi.fn().mockResolvedValueOnce("bad").mockResolvedValue("good");
      const done = retrying(attempt, (r) => r === "bad", [500]);
      await vi.advanceTimersByTimeAsync(499);
      expect(attempt).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(done).resolves.toBe("good");
    } finally {
      vi.useRealTimers();
    }
  });
});
