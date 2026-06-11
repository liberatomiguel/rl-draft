import { cx } from "@/lib/util";

type Tone = "neutral" | "blue" | "orange" | "good" | "bad" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-white/5 text-sub",
  blue: "border-blue/40 bg-blue/10 text-blue-bright",
  orange: "border-orange/40 bg-orange/10 text-orange-bright",
  good: "border-good/40 bg-good/10 text-good",
  bad: "border-bad/40 bg-bad/10 text-bad",
  gold: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "display inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tiny country-code chip (placeholder for flags in the MVP). */
export function CountryChip({ code, className }: { code: string; className?: string }) {
  return (
    <span
      title={code}
      className={cx(
        "inline-flex items-center justify-center rounded border border-line-strong bg-white/5 px-1.5 py-px font-mono text-[10px] font-semibold tracking-widest text-sub",
        className,
      )}
    >
      {code}
    </span>
  );
}
