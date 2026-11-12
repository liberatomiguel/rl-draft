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
        {kicker ? <p className="kicker mb-1">{kicker}</p> : null}
        <h2 className="display text-xl font-bold uppercase tracking-wide text-ink md:text-2xl">
          <span className="mr-2 inline-block h-4 w-1 -skew-x-12 bg-orange align-baseline" aria-hidden />
          {title}
        </h2>
      </div>
      {right ? <div className="max-w-full sm:shrink-0">{right}</div> : null}
    </div>
  );
}
