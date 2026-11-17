import { describe, expect, it } from "vitest";
import {
  classifySyncError,
  isRecoverableSyncFailure,
  isTransientSyncFailure,
  type SyncErrorInput,
  type SyncFailReason,
} from "./syncErrors";

describe("classifySyncError", () => {
  const cases: [string, SyncErrorInput, SyncFailReason][] = [
    ["unique violation", { code: "23505" }, "conflict"],
    ["check violation is no name conflict", { code: "23514" }, "other"],
    ["insufficient privilege", { code: "42501" }, "denied"],
    ["row-level security message", { message: 'new row violates row-level security policy for table "profiles"' }, "denied"],
    ["PGRST301", { code: "PGRST301" }, "auth"],
    ["HTTP 401", { status: 401 }, "auth"],
    ["JWT expired message", { message: "JWT expired" }, "auth"],
    ["HTTP 403", { status: 403 }, "denied"],
    ["HTTP 500", { status: 500 }, "server"],
    ["statement timeout (57014), whatever the message says", { code: "57014", message: "upstream timeout" }, "server"],
    ["too many connections (53300)", { code: "53300" }, "server"],
    ["HTTP 503", { status: 503 }, "server"],
    ["HTTP 408", { status: 408 }, "server"],
    ["HTTP 429", { status: 429 }, "rate"],
    ["status 0", { status: 0 }, "network"],
    ["TypeError: Failed to fetch", { message: "TypeError: Failed to fetch" }, "network"],
    ["Load failed (Safari)", { message: "Load failed" }, "network"],
    ["status 0 while offline", { status: 0, online: false }, "offline"],
    ["Failed to fetch while offline", { message: "TypeError: Failed to fetch", online: false }, "offline"],
    ["Failed to fetch while online", { message: "TypeError: Failed to fetch", online: true }, "network"],
    ["unknown message", { message: "something odd" }, "other"],
    ["HTTP 404", { status: 404 }, "other"],
    ["nothing at all", {}, "other"],
    ["nulls", { message: null, code: null, status: null }, "other"],
    ["a database code wins over the message", { code: "23505", message: "Failed to fetch" }, "conflict"],
    ["a database code wins over the status", { code: "42501", status: 500 }, "denied"],
    ["offline does not touch a non-network failure", { status: 500, online: false }, "server"],
  ];

  it.each(cases)("%s", (_name, input, expected) => {
    expect(classifySyncError(input)).toBe(expected);
  });
});

describe("failure predicates", () => {
  const all: SyncFailReason[] = ["offline", "network", "auth", "rate", "denied", "conflict", "server", "unavailable", "other"];

  it("transient = network, server, unavailable (not auth, rate, offline)", () => {
    expect(all.filter((r) => isTransientSyncFailure(r)).sort()).toEqual(["network", "server", "unavailable"]);
    expect(isTransientSyncFailure(undefined)).toBe(false);
  });

  it("recoverable = the transient ones plus offline, rate and auth", () => {
    expect(all.filter((r) => isRecoverableSyncFailure(r)).sort()).toEqual([
      "auth",
      "network",
      "offline",
      "rate",
      "server",
      "unavailable",
    ]);
    expect(isRecoverableSyncFailure(undefined)).toBe(false);
  });
});
