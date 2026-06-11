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
  primary:
    "bg-gradient-to-b from-orange-bright to-orange text-[#1a0d02] shadow-[0_0_24px_rgba(249,115,22,0.3)] hover:brightness-110 active:brightness-95 disabled:shadow-none",
  secondary:
    "border border-blue/50 bg-blue/10 text-blue-bright hover:bg-blue/20 active:bg-blue/15",
  ghost: "text-sub hover:bg-white/5 hover:text-ink",
  danger: "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

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
      className={cx(
        "display inline-flex items-center justify-center gap-2 rounded-lg font-bold uppercase tracking-[0.12em] transition-all",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
}
