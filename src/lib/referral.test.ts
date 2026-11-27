import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deviceHasPlayed, isReferralCode, parseBook, withLanding, withReferral } from "./referral";

const book = () => parseBook(null);
const store = (entries: Record<string, unknown>) => (key: string) => (key in entries ? JSON.stringify(entries[key]) : null);

describe("referral codes", () => {
  it("are eight lowercase letters or digits", () => {
    expect(isReferralCode("ab12cd34")).toBe(true);
    expect(isReferralCode("AB12CD34")).toBe(false);
    expect(isReferralCode("ab12cd3")).toBe(false);
    expect(isReferralCode("ab12cd34x")).toBe(false);
    expect(isReferralCode("ab12-d34")).toBe(false);
    expect(isReferralCode(null)).toBe(false);
  });

  it("ride the share link as ?ref=, next to the utm tags and before a duel's hash", () => {
    const run = new URL(withReferral("https://rocketdraft.app/pt?utm_medium=share&utm_campaign=run", "ab12cd34"));
    expect(run.searchParams.get("ref")).toBe("ab12cd34");
    expect(run.searchParams.get("utm_campaign")).toBe("run");
    const duel = withReferral("https://rocketdraft.app/duel#c=abc", "ab12cd34");
    expect(duel).toBe("https://rocketdraft.app/duel?ref=ab12cd34#c=abc");
    expect(withReferral("https://rocketdraft.app/", null)).toBe("https://rocketdraft.app/");
  });
});

describe("the device's book", () => {
  it("makes a device id once and drops anything malformed", () => {
    const fresh = book();
    expect(fresh.deviceId.length).toBeGreaterThanOrEqual(16);
    expect(fresh).toMatchObject({ pending: null, done: false, own: {}, count: {} });
    const kept = parseBook(JSON.stringify({ deviceId: fresh.deviceId, pending: "BAD", own: { u1: "ab12cd34", u2: "x" }, count: { u1: { n: 3, at: 5 }, u2: { n: -1, at: 1 } } }));
    expect(kept.deviceId).toBe(fresh.deviceId);
    expect(kept.pending).toBeNull();
    expect(kept.own).toEqual({ u1: "ab12cd34" });
    expect(kept.count).toEqual({ u1: { n: 3, at: 5 } });
    expect(parseBook("{not json").deviceId.length).toBeGreaterThanOrEqual(16);
  });

  it("keeps a link's code only on a browser that never played, and only the first one", () => {
    const b = book();
    expect(withLanding(b, "ab12cd34", false).pending).toBe("ab12cd34");
    expect(withLanding(b, "ab12cd34", true)).toBe(b);
    expect(withLanding(b, "nope", false)).toBe(b);
    const first = withLanding(b, "ab12cd34", false);
    expect(withLanding(first, "zz99zz99", false).pending).toBe("ab12cd34");
    expect(withLanding({ ...b, done: true }, "ab12cd34", false).pending).toBeNull();
  });

  it("a browser has played once it finished a run or holds a career", () => {
    expect(deviceHasPlayed(store({}))).toBe(false);
    expect(deviceHasPlayed(store({ "rocket-draft:profile:v1": { state: { runsCompleted: 0 } } }))).toBe(false);
    expect(deviceHasPlayed(store({ "rocket-draft:profile:v1": { state: { runsCompleted: 2 } } }))).toBe(true);
    expect(deviceHasPlayed(store({ "rocket-draft:career:v1": { state: { slots: [null, null, null] } } }))).toBe(false);
    expect(deviceHasPlayed(store({ "rocket-draft:career:v1": { state: { slots: [null, { id: 1 }, null] } } }))).toBe(true);
    expect(deviceHasPlayed(() => "{broken")).toBe(false);
  });
});

describe("the server's rules (docs/sql/v2.2-referrals.sql)", () => {
  const sql = readFileSync(join(process.cwd(), "docs/sql/v2.2-referrals.sql"), "utf8");

  it("counts one claim per device, never the code's own account, at most five a day", () => {
    expect(sql).toMatch(/device_id\s+text\s+primary key/);
    expect(sql).toMatch(/auth\.uid\(\) = owner/);
    expect(sql).toMatch(/if today >= 5 then/);
  });

  it("opens the tables only through the three functions, the claim also to guests", () => {
    expect(sql).toMatch(/revoke all on public\.referrals from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on public\.referral_codes from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.claim_referral\(text, text\) to anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.referral_code\(\) to authenticated/);
    expect(sql).toMatch(/grant execute on function public\.my_referral_count\(\) to authenticated/);
  });
});
