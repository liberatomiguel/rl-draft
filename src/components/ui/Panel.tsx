import { cx } from "@/lib/util";
import type { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  glow?: "blue" | "orange";
}

export function Panel({ strong, glow, className, ...props }: PanelProps) {
  return (
    <div
      className={cx(
        strong ? "panel-strong min-w-0" : "panel min-w-0",
        glow === "blue" && "panel-glow-blue",
        glow === "orange" && "panel-glow-orange",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  kicker,
  title,
  right,
  className,
}: {
  kicker?: string;
  title: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 flex-1 basis-40">
        {/* The title on its paper slab. The line that used to sit above it
            as a caps eyebrow reads under it, as a sentence (DESIGN.md). */}
        <h2 className="title-slab text-xl md:text-2xl">{title}</h2>
        {kicker ? <p className="mt-1.5 text-sm leading-snug text-sub">{kicker}</p> : null}
      </div>
      {right ? <div className="max-w-full sm:shrink-0">{right}</div> : null}
    </div>
  );
}
