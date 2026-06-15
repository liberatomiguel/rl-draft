/**
 * Custom game-event analytics — a thin, typed wrapper over Vercel Web Analytics
 * custom events (the same `<Analytics/>` already mounted in the root layout
 * collects them; no extra dependency).
 *
 * Rules:
 *  - track() is a NO-OP in dev and whenever Web Analytics isn't enabled, so
 *    calling these is always safe and never blocks gameplay.
 *  - Event property values MUST be scalars (string | number | boolean | null);
 *    Vercel rejects nested objects, so payloads are pre-flattened here.
 *  - UI/store layer only. NEVER import this from `src/engine` — the engine must
 *    stay pure/deterministic (AGENTS.md hard rule).
 *  - All values are aggregate and non-PII, consistent with the privacy policy.
 *
 * Inspect the data in Vercel → Analytics → Events (run_started / run_completed /
 * tournament_started), filterable by the properties below.
 */
import { track } from "@vercel/analytics";

/** The full custom-event catalogue. Add a new event by adding a key here. */
export interface GameEvents {
  /** A run was created (classic / quick / daily), with its chosen settings. */
  run_started: {
    mode: string;
    difficulty: string;
    hiddenOverall: boolean;
  };
  /** The draft was confirmed and the tournament bracket began. */
  tournament_started: {
    mode: string;
    difficulty: string;
  };
  /** A run reached its results screen — the key outcome/win-rate event. */
  run_completed: {
    mode: string;
    difficulty: string;
    placement: string;
    won: boolean;
    hiddenOverall: boolean;
    teamOverall: number;
    swissWins: number;
    swissLosses: number;
    xpGained: number;
  };
}

export function trackEvent<K extends keyof GameEvents>(
  name: K,
  props: GameEvents[K],
): void {
  try {
    track(name, props as Record<string, string | number | boolean | null>);
  } catch {
    // Analytics must never break the game.
  }
}
