"use client";

import { cx } from "@/lib/util";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cx(
        "flex items-start justify-between gap-4",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-sub">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-orange/60 bg-orange/80" : "border-line-strong bg-white/10",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
