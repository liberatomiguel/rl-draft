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
        strong ? "panel-strong" : "panel",
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
    <div className={cx("flex items-end justify-between gap-4", className)}>
      <div>
        {kicker ? <p className="kicker mb-1">{kicker}</p> : null}
        <h2 className="display text-xl font-bold uppercase tracking-wide text-ink md:text-2xl">
          <span className="mr-2 inline-block h-4 w-1 -skew-x-12 bg-orange align-baseline" aria-hidden />
          {title}
        </h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
