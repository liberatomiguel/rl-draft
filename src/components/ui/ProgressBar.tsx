import { cx } from "@/lib/util";

export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  /** 0..1 */
  value: number;
  /** rc.33: "gold" for the national album. */
  tone?: "blue" | "orange" | "good" | "gold";
  className?: string;
  /** The bar's accessible name. Without one the bar is decoration beside a
   *  visible count ("2/5"), so it is hidden from assistive tech: a progressbar
   *  with no name is an accessibility failure (PageSpeed, v2.0). */
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const toneClass =
    tone === "orange"
      ? "from-orange to-orange-bright"
      : tone === "good"
        ? "from-emerald-500 to-emerald-300"
        : tone === "gold"
          ? "from-yellow-600 to-yellow-200"
          : "from-blue to-cyan";
  return (
    <div
      className={cx("h-2 w-full overflow-hidden rounded-full bg-white/8", className)}
      {...(label
        ? { role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label }
        : { "aria-hidden": true })}
    >
      <div
        className={cx("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", toneClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-sub">{label}</span>
      <ProgressBar value={(value - 60) / 39} tone={value >= 90 ? "orange" : "blue"} className="flex-1" label={label} />
      <span className="display w-8 text-right text-sm font-bold text-ink">{value}</span>
    </div>
  );
}
