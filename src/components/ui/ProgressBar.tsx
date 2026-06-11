import { cx } from "@/lib/util";

export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  /** 0..1 */
  value: number;
  tone?: "blue" | "orange" | "good";
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const toneClass =
    tone === "orange"
      ? "from-orange to-orange-bright"
      : tone === "good"
        ? "from-emerald-500 to-emerald-300"
        : "from-blue to-cyan";
  return (
    <div
      className={cx("h-2 w-full overflow-hidden rounded-full bg-white/8", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
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
      <ProgressBar value={(value - 60) / 39} tone={value >= 90 ? "orange" : "blue"} className="flex-1" />
      <span className="display w-8 text-right text-sm font-bold text-ink">{value}</span>
    </div>
  );
}
