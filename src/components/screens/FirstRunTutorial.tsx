"use client";

/**
 * First-launch feature tour (v1.3.1) — a short full-screen, multi-step intro to
 * what each part of the game is (draft, collection, ranks, difficulties). Shown
 * once, then dismissed (profile flag `seenTutorial`). Client-only and mounted-
 * gated, so it renders nothing on the server — zero SEO / page-speed impact.
 * Portaled to <body> so it sits above everything and isn't trapped by any
 * transformed ancestor (project pitfall: position:fixed inside an animated box).
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { Button } from "@/components/ui/Button";

export function FirstRunTutorial() {
  const mounted = useMounted();
  const seen = useProfileStore((s) => s.flags.seenTutorial);
  const markFlag = useProfileStore((s) => s.markFlag);
  const { TUTORIAL: T } = useCopy();
  const [step, setStep] = useState(0);

  if (!mounted || seen) return null;

  const steps = T.steps;
  const cur = steps[step];
  const last = step === steps.length - 1;
  const finish = () => markFlag("seenTutorial");

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={T.title}
    >
      <button
        onClick={finish}
        className="absolute right-4 top-4 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sub transition-colors hover:text-ink"
      >
        {T.skip}
      </button>

      <div key={step} className="rise-in w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-orange/30 bg-orange/10 text-orange-bright shadow-[0_0_30px_rgba(249,115,22,0.18)]">
          <TutorialIcon name={cur.icon} />
        </div>
        <p className="kicker text-orange-bright">{T.kicker}</p>
        <h2 className="display mt-2 text-2xl font-bold uppercase tracking-wide text-ink">
          {cur.title}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-sub">{cur.body}</p>

        {/* Progress dots */}
        <div className="mt-7 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cx(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-orange" : "w-1.5 bg-white/20",
              )}
            />
          ))}
        </div>

        <div className="mt-7 flex items-center justify-center gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              {T.back}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => {
              if (last) {
                sfx.start();
                finish();
              } else {
                sfx.click();
                setStep((s) => s + 1);
              }
            }}
          >
            {last ? T.done : T.next}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TutorialIcon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-9 w-9",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "draft": // cards / picking
      return (
        <svg {...common}>
          <rect x="3" y="5" width="11" height="14" rx="2" />
          <path d="M17 7l4 1-2 12-4-1" />
        </svg>
      );
    case "field": // team / pitch
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M12 4v16M3 12h18" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "collection": // album
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M14 3v5h5M8 13h8M8 17h5" />
        </svg>
      );
    case "rank": // medal / ladder
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" />
        </svg>
      );
    case "difficulty": // flame
      return (
        <svg {...common}>
          <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.7-2.5 1.5-3.5C10.5 9 11.5 7 12 3Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
  }
}
