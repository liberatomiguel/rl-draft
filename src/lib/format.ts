/**
 * Shared display formatters (Road to Worlds, v1.5).
 *
 * Money convention (design doc §9): in-game USD, `$` in BOTH locales (the
 * telegraphed fiction — no R$), compact form for headlines ("$85k" / "$1.2M"),
 * full form for ledgers and confirm dialogs ("$8,500"), negatives in the
 * caller's danger color ("-$4,200"), never cents.
 */

export function formatMoney(amount: number, opts: { compact?: boolean } = {}): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  if (opts.compact) {
    if (abs >= 1_000_000) {
      const m = abs / 1_000_000;
      return `${sign}$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
    }
    if (abs >= 1_000) {
      const k = abs / 1_000;
      return `${sign}$${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
    }
    return `${sign}$${abs}`;
  }
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

/** Signed variant for deltas: "+$2.5k" / "-$400". */
export function formatMoneyDelta(amount: number, opts: { compact?: boolean } = {}): string {
  const base = formatMoney(Math.abs(amount), opts);
  return amount >= 0 ? `+${base}` : `-${base}`;
}
