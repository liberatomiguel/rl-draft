"use client";

/**
 * Pointer-tracked 3D tilt wrapper (collection cards). Adds a cursor-following
 * glare via the --mx/--my CSS variables. Inert on touch-only devices and
 * under prefers-reduced-motion.
 */

import { useRef, useState } from "react";
import { cx } from "@/lib/util";

const MAX_TILT_DEG = 10;

export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [active, setActive] = useState(false);

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
      transform: `perspective(800px) rotateY(${(px - 0.5) * MAX_TILT_DEG * 2}deg) rotateX(${(0.5 - py) * MAX_TILT_DEG * 2}deg) scale(1.03)`,
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
      />
    </div>
  );
}
