/**
 * v2.0 (P1): formatMoney keeps one Intl.NumberFormat for the session instead
 * of building one per call (toLocaleString). The text must not change.
 */
import { expect, it } from "vitest";
import { formatMoney, formatMoneyDelta } from "./format";

it("formatMoney matches toLocaleString digit for digit", () => {
  for (const n of [0, 1, 999, 1000, 1234, 8500, 12345, 999999, 1000000, 1234567.4, 1234567.5, -4200, -0.4, 85000, 2500000]) {
    const abs = Math.abs(Math.round(n));
    expect(formatMoney(n)).toBe((n < 0 ? "-" : "") + "$" + abs.toLocaleString("en-US"));
  }
  expect(formatMoney(8500)).toBe("$8,500");
  expect(formatMoney(-4200)).toBe("-$4,200");
  expect(formatMoney(85000, { compact: true })).toBe("$85k");
  expect(formatMoney(1200000, { compact: true })).toBe("$1.2M");
  expect(formatMoneyDelta(-400)).toBe("-$400");
  expect(formatMoneyDelta(2500, { compact: true })).toBe("+$2.5k");
});
