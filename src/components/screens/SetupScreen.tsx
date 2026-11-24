"use client";

/**
 * Game setup: mode (Classic / Quick), difficulty and overall visibility.
 * Pre-selects whatever the player used last (v0.3). Daily challenges skip
 * this screen entirely — their rules are fixed by the date.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useState } from "react";
import { DIFFICULTY, REGION_LOCK } from "@/config/balance";
import { freshDuel } from "@/engine/duel";
import { randomSeed } from "@/lib/rng";
import { lineupById, lineupPoolForRegion } from "@/data";
import { useCopy } from "@/content/copy";
import type { Difficulty, Region } from "@/engine/types";
import { cx } from "@/lib/util";
import { selectHardUnlocked, selectLegacyUnlocked, useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlobeIcon, LegacyEmblem, LockIcon } from "@/components/ui/icons";
import { SectionTitle } from "@/components/ui/Panel";
import { Toggle } from "@/components/ui/Toggle";

const ORDER: Difficulty[] = ["easy", "normal", "hard", "legacy"];

/** A region option: a 44px key with the code on a phone, a named tile from 640px. */
const REGION_KEY =
  "panel flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors sm:min-h-[4.25rem] sm:items-stretch sm:px-3 sm:py-2.5 sm:text-left";

/**
 * Region-lock options (v1.2.0: SAM only; v2.0: every region in
 * REGION_LOCK.regions). The rest read "Coming soon" and sort last. `rosters`
 * = the draftable depth of the region pool (national teams and easter eggs
 * are separate draws, so they are not counted).
 */
const REGIONS: { id: Region; available: boolean; rosters: number }[] = (
  ["SAM", "NA", "EU", "OCE", "MENA", "APAC", "SSA"] as Region[]
)
  .map((id) => ({
    id,
    available: REGION_LOCK.regions.includes(id),
    rosters: lineupPoolForRegion(id).filter((lid) => {
      const l = lineupById.get(lid);
      return l && !l.national && !l.rareSpawn;
    }).length,
  }))
  .sort((a, b) => Number(b.available) - Number(a.available));

export function SetupScreen() {
  const { HOME, SETUP, DIFFICULTY_LABELS, DUEL_UI } = useCopy();
  const startRun = useRunStore((s) => s.startRun);
  const startDuel = useRunStore((s) => s.startDuel);
  // The mode comes from the menu card the player clicked (Classic / Quick) —
  // no mode switcher here by design.
  const mode = useRunStore((s) => s.setupMode);
  const legacyUnlocked = useProfileStore(selectLegacyUnlocked);
  const hardUnlocked = useProfileStore(selectHardUnlocked);
  const settings = useProfileStore((s) => s.settings);

  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const last = settings.lastDifficulty;
    if (last === "legacy" && !legacyUnlocked) return "normal";
    if (last === "hard" && !hardUnlocked) return "normal";
    return last;
  });
  const [showOverall, setShowOverall] = useState(settings.lastShowOverall);
  // A remembered region that is no longer offered falls back to worldwide.
  const [regionLock, setRegionLock] = useState<Region | null>(() => {
    const last = settings.lastRegionLock ?? null;
    return last && REGION_LOCK.regions.includes(last) ? last : null;
  });

  const profile = DIFFICULTY[difficulty];
  const locked = profile.overallLockedHidden;

  // Job: set the run's rules, then start. The one decision is the difficulty,
  // so it comes first as a list (name, what it means, what it costs); the
  // region and the overall switch are secondary. The chosen option is marked
  // by its hairline alone, and Start Draft is the only filled button.
  //
  // Phone (mobile redesign, stage 2): the whole setup is one screen. The four
  // difficulties are rows of one board (`.phone-rows`) and only the chosen one
  // spells out its tagline; the regions are eight 44px keys in a 4 x 2 grid,
  // described by the line under them; the two section intros are desktop only.
  // Start Draft sits on ground (`.action-dock`), in flow when the screen fits.
  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle
        kicker={mode === "quick" ? SETUP.modeQuickHint : SETUP.modeClassicHint}
        title={mode === "quick" ? SETUP.modeQuick : SETUP.modeClassic}
        className="mb-4 sm:mb-8"
      />

      <h3 className="display text-lg uppercase leading-none text-ink max-sm:mb-2.5">{SETUP.difficulty}</h3>
      <p className="mb-4 mt-1.5 max-w-xl text-sm leading-relaxed text-sub max-sm:hidden">{SETUP.subtitle}</p>
      <div className="phone-rows mb-5 sm:mb-10 sm:space-y-2" role="radiogroup" aria-label={SETUP.difficulty}>
        {ORDER.map((id) => {
          const d = DIFFICULTY[id];
          const isLegacyLocked = Boolean(d.requiresLegacyUnlock) && !legacyUnlocked;
          const isHardLocked = id === "hard" && !hardUnlocked;
          const isLocked = isLegacyLocked || isHardLocked;
          const active = difficulty === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              disabled={isLocked}
              onClick={() => {
                // Switching from a hidden-locked difficulty (Hard/Legacy) back
                // to an open one re-enables overalls automatically (v1.2.0 fix).
                if (profile.overallLockedHidden && !d.overallLockedHidden) {
                  setShowOverall(true);
                }
                setDifficulty(id);
              }}
              className={cx(
                "panel flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors sm:justify-between sm:gap-6 sm:p-4",
                active && "panel-glow-orange",
                !active && !isLocked && "sm:hover:!border-line-strong",
                isLocked && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="display flex items-center gap-2 text-lg font-bold uppercase leading-none text-ink">
                  {id === "legacy" ? (
                    <LegacyEmblem className="h-5 w-5 shrink-0" gradientId="legacyGradSetup" />
                  ) : null}
                  {DIFFICULTY_LABELS[id].label}
                </span>
                {/* Phone: the tagline is spelled out for the chosen row only. */}
                <span className={cx("mt-1.5 block text-sm leading-snug text-sub", !active && "max-sm:hidden")}>
                  {DIFFICULTY_LABELS[id].tagline}
                </span>
                {isLocked ? (
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-sub">
                    <LockIcon className="h-4 w-4 shrink-0" /> {isHardLocked ? SETUP.hardLocked : SETUP.legacyLocked}
                  </span>
                ) : null}
              </span>
              {/* What the difficulty costs, as two quiet facts (was three tags). */}
              <span className="shrink-0 text-right text-xs leading-snug text-sub sm:leading-relaxed">
                <span className="block">{SETUP.rerolls(d.rerolls)}</span>
                <span className="block">{d.overallLockedHidden ? SETUP.ovrHidden : SETUP.ovrOptional}</span>
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="display text-lg uppercase leading-none text-ink max-sm:mb-2.5">{SETUP.region}</h3>
      <p className="mb-4 mt-1.5 max-w-xl text-sm leading-relaxed text-sub max-sm:hidden">{SETUP.regionHint}</p>
      {/* One set of eight options: Worldwide first, then the seven regions.
          The line under the grid describes whichever one is chosen. */}
      <div className="mb-4 sm:mb-10" role="radiogroup" aria-label={SETUP.region}>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={regionLock === null}
            onClick={() => setRegionLock(null)}
            className={cx(
              REGION_KEY,
              regionLock === null ? "panel-glow-orange max-sm:bg-orange/10" : "sm:hover:!border-line-strong",
            )}
          >
            <span className="display flex items-center gap-1.5 text-sm font-bold uppercase leading-none text-ink sm:text-base">
              <GlobeIcon className="h-4 w-4 shrink-0 text-sub max-sm:hidden" />
              {SETUP.regionWorldwide}
            </span>
          </button>
          {REGIONS.map(({ id, available }) => {
            const active = regionLock === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!available}
                onClick={() => available && setRegionLock(id)}
                className={cx(
                  REGION_KEY,
                  active && "panel-glow-orange max-sm:bg-orange/10",
                  !available && "cursor-not-allowed opacity-50",
                  available && !active && "sm:hover:!border-line-strong",
                )}
              >
                <span className={cx("display text-sm font-bold uppercase leading-none sm:text-base", available ? "text-ink" : "text-faint")}>
                  {id}
                </span>
                {/* "Coming soon" is a real state, so it keeps its tag. On a phone
                    the key is the code alone: the line under the grid names the
                    chosen region, and a region not open yet is dimmed. */}
                {available ? (
                  <span className="truncate text-xs leading-tight text-sub max-sm:hidden">{SETUP.regionNames[id]}</span>
                ) : (
                  <Badge tone="neutral" className="w-fit max-sm:hidden">{SETUP.regionComingSoon}</Badge>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 max-w-xl text-sm leading-snug text-sub sm:mt-3 sm:leading-relaxed">
          {regionLock
            ? SETUP.regionDescLocked(
                SETUP.regionNames[regionLock],
                REGIONS.find((r) => r.id === regionLock)?.rosters ?? 0,
              )
            : SETUP.regionWorldwideHint}
        </p>
      </div>

      {/* A switch is one row, not a board. */}
      <div className="border-t border-line py-3.5 sm:mb-8 sm:border-b sm:py-4">
        <Toggle
          checked={locked ? false : showOverall}
          onChange={setShowOverall}
          disabled={locked}
          label={SETUP.showOverall}
          hint={locked ? SETUP.overallLocked : SETUP.showOverallHint}
        />
      </div>

      {/* Friend duel (v2.1): this setup as a duel, with a seed to send. */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-sub">{DUEL_UI.setupDuelHint}</p>
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={() =>
            startDuel(freshDuel({ mode: mode === "quick" ? "quick" : "classic", difficulty, region: regionLock, showOverall }, randomSeed()))
          }
        >
          {DUEL_UI.setupDuel}
        </Button>
      </div>

      <div className="action-dock flex items-center gap-3 sm:flex-row">
        <Button
          variant="primary"
          size="lg"
          onClick={() => startRun({ mode, difficulty, showOverall, regionLock })}
          className="flex-1 sm:min-w-56 sm:flex-none"
        >
          {SETUP.start}
        </Button>
        <AppLink
          href="/how-to-play"
          className="text-center text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
        >
          {HOME.howToPlay}
        </AppLink>
      </div>
    </div>
  );
}
