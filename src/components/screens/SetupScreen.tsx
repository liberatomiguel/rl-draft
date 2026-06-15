"use client";

/**
 * Game setup: mode (Classic / Quick), difficulty and overall visibility.
 * Pre-selects whatever the player used last (v0.3). Daily challenges skip
 * this screen entirely — their rules are fixed by the date.
 */

import Link from "next/link";
import { useState } from "react";
import { DIFFICULTY } from "@/config/balance";
import { useCopy } from "@/content/copy";
import type { Difficulty } from "@/engine/types";
import { cx } from "@/lib/util";
import { selectLegacyUnlocked, useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/Toggle";

const ORDER: Difficulty[] = ["easy", "normal", "hard", "legacy"];

export function SetupScreen() {
  const { HOME, SETUP, DIFFICULTY_LABELS } = useCopy();
  const startRun = useRunStore((s) => s.startRun);
  // The mode comes from the menu card the player clicked (Classic / Quick) —
  // no mode switcher here by design.
  const mode = useRunStore((s) => s.setupMode);
  const legacyUnlocked = useProfileStore(selectLegacyUnlocked);
  const settings = useProfileStore((s) => s.settings);

  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    settings.lastDifficulty === "legacy" && !legacyUnlocked
      ? "normal"
      : settings.lastDifficulty,
  );
  const [showOverall, setShowOverall] = useState(settings.lastShowOverall);

  const profile = DIFFICULTY[difficulty];
  const locked = profile.overallLockedHidden;

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle
        kicker={mode === "quick" ? SETUP.modeQuickHint : SETUP.modeClassicHint}
        title={mode === "quick" ? SETUP.modeQuick : SETUP.modeClassic}
        className="mb-2"
      />
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-sub">{SETUP.subtitle}</p>

      <p className="kicker mb-3">{SETUP.difficulty}</p>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={SETUP.difficulty}>
        {ORDER.map((id) => {
          const d = DIFFICULTY[id];
          const isLegacyLocked = Boolean(d.requiresLegacyUnlock) && !legacyUnlocked;
          const active = difficulty === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              disabled={isLegacyLocked}
              onClick={() => setDifficulty(id)}
              className={cx(
                "panel relative p-4 text-left transition-all",
                active && "panel-glow-orange !border-orange/60",
                !active && !isLegacyLocked && "hover:!border-line-strong",
                isLegacyLocked && "cursor-not-allowed opacity-50",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="display text-lg font-bold uppercase tracking-wide text-ink">
                  {DIFFICULTY_LABELS[id].label}
                </span>
                {active ? <Badge tone="orange">{SETUP.selected}</Badge> : null}
              </div>
              <p className="mb-3 text-xs leading-relaxed text-sub">{DIFFICULTY_LABELS[id].tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="blue">{SETUP.rerolls(d.rerolls)}</Badge>
                {d.overallLockedHidden ? (
                  <Badge tone="neutral">{SETUP.ovrHidden}</Badge>
                ) : (
                  <Badge tone="neutral">{SETUP.ovrOptional}</Badge>
                )}
                {id === "legacy" ? <Badge tone="gold">{SETUP.legacyBadge}</Badge> : null}
              </div>
              {isLegacyLocked ? (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-faint">
                  <LockIcon /> {SETUP.legacyLocked}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <Panel className="mb-8 p-4">
        <Toggle
          checked={locked ? false : showOverall}
          onChange={setShowOverall}
          disabled={locked}
          label={SETUP.showOverall}
          hint={locked ? SETUP.overallLocked : SETUP.showOverallHint}
        />
      </Panel>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Button
          variant="primary"
          size="lg"
          onClick={() => startRun({ mode, difficulty, showOverall })}
          className="sm:min-w-56"
        >
          {SETUP.start}
        </Button>
        <Link
          href="/how-to-play"
          className="text-center text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
        >
          {HOME.howToPlay}
        </Link>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
