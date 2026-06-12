"use client";

/**
 * Pointer-tracked 3D tilt wrapper. Sets --mx/--my for cursor-reactive
 * glare/holo layers. Inert on touch-only devices and under
 * prefers-reduced-motion.
 *
 * Intensity tiers: light (base cards) · strong (special cards) ·
 * max (collection detail view).
 */

import { useRef, useState } from "react";
import { cx } from "@/lib/util";

const TIERS = {
  light: { tilt: 5, scale: 1.015, glare: 0.5 },
  strong: { tilt: 10, scale: 1.035, glare: 1 },
  max: { tilt: 15, scale: 1.06, glare: 1 },
} as const;

export type TiltIntensity = keyof typeof TIERS;

export function TiltCard({
  children,
  intensity = "strong",
  className,
}: {
  children: React.ReactNode;
  intensity?: TiltIntensity;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [active, setActive] = useState(false);
  const tier = TIERS[intensity];

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setActive(true);
    setStyle({
      transform: `perspective(800px) rotateY(${(px - 0.5) * tier.tilt * 2}deg) rotateX(${(0.5 - py) * tier.tilt * 2}deg) scale(${tier.scale})`,
      ["--mx" as string]: `${Math.round(px * 100)}%`,
      ["--my" as string]: `${Math.round(py * 100)}%`,
    });
  };

  const onLeave = () => {
    setActive(false);
    setStyle({});
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ ...style, transition: active ? "transform 60ms linear" : "transform 300ms ease" }}
      className={cx("relative will-change-transform", className)}
    >
      {children}
      <div
        aria-hidden
        className={cx(
          "tilt-glare pointer-events-none absolute inset-0 rounded-[14px] transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        style={{ opacity: active ? tier.glare : 0 }}
      />
    </div>
  );
}
