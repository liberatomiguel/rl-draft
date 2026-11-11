"use client";
import { TrophyIcon, StarIcon } from "@/components/ui/icons";
import { useOsReducedMotion } from "@/lib/useOsReducedMotion";

/** One-shot emphasis: every animated property is transform or opacity. */
export function MilestoneMoment({ title, kind }: { title: string; kind: "major" | "worlds" | "sunday" }) {
  const reduced = useOsReducedMotion();
  return <div className="moment relative isolate mx-auto mb-5 overflow-hidden rounded-2xl border border-amber-300/35 bg-amber-300/[0.06] px-4 py-6 text-center" data-motion={reduced ? "still" : "animate"} data-milestone={kind} role="status">
    <span aria-hidden className="halo pointer-events-none absolute inset-0 rounded-2xl border-2 border-amber-300/50" />
    <span aria-hidden className="flare pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(251,191,36,0.2),transparent_65%)]" />
    <span aria-hidden className="emblem relative mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/50 bg-amber-300/10 text-amber-300">{kind === "sunday" ? <StarIcon className="h-10 w-10" /> : <TrophyIcon className="h-12 w-12" />}</span>
    <p className="headline relative display text-2xl font-bold uppercase leading-tight tracking-wide text-amber-300 sm:text-4xl">{title}</p>
    <style jsx>{`
      [data-motion="animate"] .emblem { animation: trophy-arrive 900ms cubic-bezier(.16,1,.3,1) both; }
      [data-motion="animate"] .headline { animation: title-arrive 800ms 180ms cubic-bezier(.16,1,.3,1) both; }
      [data-motion="animate"] .halo { animation: ring-burst 1200ms ease-out both; }
      [data-motion="animate"] .flare { animation: light-burst 1400ms ease-out both; }
      @keyframes trophy-arrive { 0% { opacity: 0; transform: translateY(24px) scale(.35) rotate(-15deg); } 60% { opacity: 1; transform: translateY(-5px) scale(1.12) rotate(3deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); } }
      @keyframes title-arrive { from { opacity: 0; transform: translateY(18px) scale(.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes ring-burst { from { opacity: .9; transform: scale(.65); } to { opacity: 0; transform: scale(1.12); } }
      @keyframes light-burst { 0% { opacity: 0; transform: scale(.6); } 40% { opacity: 1; transform: scale(1); } 100% { opacity: .25; transform: scale(1.2); } }
      @media (prefers-reduced-motion: reduce) { .moment .emblem, .moment .headline, .moment .halo, .moment .flare { animation: none; } }
      :global(html.reduce-fx) .moment .emblem, :global(html.reduce-fx) .moment .headline, :global(html.reduce-fx) .moment .halo, :global(html.reduce-fx) .moment .flare { animation: none; }
    `}</style>
  </div>;
}
