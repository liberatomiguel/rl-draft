"use client";

/**
 * Road to Worlds wizard — the founding ceremony splash.
 *
 * Full-screen overlay (portal on <body> — never position:fixed inside the
 * animated wizard tree): crest reveal, org name, "EST. 2020" plate, one
 * flavor line, then hands control back after ~2s. Nothing critical hides
 * behind the animation — the overlay auto-resolves regardless of motion prefs.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerColors } from "@/engine/career/types";
import { UserCrest } from "@/components/career/UserCrest";

const SPLASH_MS = 2200;

export function FoundingSplash({
  orgName,
  abbrev,
  crestId,
  colors,
  establishedLabel,
  tagline,
  onDone,
}: {
  orgName: string;
  abbrev: string;
  crestId: string;
  colors: CareerColors;
  /** "EST. 2020" plate (copy). */
  establishedLabel: string;
  /** One broadcast-voice line under the name (copy). */
  tagline: string;
  onDone: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Portal host resolves after mount (SSR-safe); deferred a tick so the set
  // never runs synchronously inside the effect body (React Compiler rule).
  useEffect(() => {
    const t = window.setTimeout(() => setHost(document.body), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(onDone, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (!host) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-bg/95 backdrop-blur-sm"
      role="status"
      aria-label={`${orgName} — ${establishedLabel}`}
    >
      {/* Org-colored glow behind the crest */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${colors.primary}, transparent 65%)` }}
      />
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="pop-in">
          <UserCrest crestId={crestId} colors={colors} abbrev={abbrev} size="xl" />
        </div>
        <h1
          className="display rise-in mt-6 text-3xl font-bold uppercase tracking-wide text-ink sm:text-4xl"
          style={{ animationDelay: "0.25s" }}
        >
          {orgName}
        </h1>
        <p
          className="rise-in mt-3 inline-flex items-center gap-2 rounded-md border border-line-strong bg-white/5 px-3 py-1"
          style={{ animationDelay: "0.5s" }}
        >
          <span className="display text-xs font-semibold uppercase tracking-[0.3em] text-orange-bright">
            {establishedLabel}
          </span>
        </p>
        <p className="rise-in mt-4 text-sm text-sub" style={{ animationDelay: "0.75s" }}>
          {tagline}
        </p>
      </div>
    </div>,
    host,
  );
}
