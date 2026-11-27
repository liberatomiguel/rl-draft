"use client";

import { cx } from "@/lib/util";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  // The one filled control on a screen: flat orange, no gradient, no halo.
  // rc9 DS (#219): a disabled primary is a grey slab, not a faded orange (which read as
  // dark brown on a phone and hid the screen's one action, survey 27/11).
  primary:
    "bg-orange text-paper-ink hover:bg-orange-bright active:bg-orange disabled:bg-white/[0.08] disabled:text-faint",
  secondary:
    "border border-line-strong bg-white/[0.04] text-ink hover:border-blue/60 hover:bg-blue/10 active:bg-blue/15 disabled:opacity-40",
  ghost: "text-sub hover:bg-white/5 hover:text-ink disabled:opacity-40",
  danger: "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20 disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-3.5 py-2 text-xs sm:min-h-8",
  md: "min-h-11 px-5 py-2 text-sm sm:min-h-10",
  lg: "min-h-12 px-6 py-2.5 text-base sm:px-7",
};

/** rc.4: the button look for a link (e.g. an AppLink CTA), so a link and a
 *  button side by side read as the same control. */
export function buttonClass(variant: Variant = "secondary", size: Size = "md", full?: boolean): string {
  return cx(
    "display inline-flex max-w-full items-center justify-center gap-2 rounded-lg text-center font-bold uppercase leading-none tracking-[0.04em] transition-[color,background-color,border-color,transform,opacity]",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  full,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass(variant, size, full), className)}
      {...props}
    />
  );
}
