"use client";

/**
 * Tiny synthesized sound layer (v1.0). No audio assets — short Web Audio
 * tones, deliberately subtle ("depth, not noise" per direction). Every cue
 * reads the live settings, so muting / volume / disabling is instant.
 *
 * AudioContext is created lazily and resumed on first use (it only unlocks
 * after a user gesture, which every cue here follows).
 */

import { useSettings } from "@/store/settingsStore";

type Note = { f: number; d: number; t?: OscillatorType; delay?: number; g?: number };

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

function play(notes: Note[], gain = 1): void {
  const s = useSettings.getState();
  if (!s.soundEnabled || s.soundVolume <= 0) return;
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();

  const master = ac.createGain();
  // Keep it quiet: the settings volume is the ceiling, scaled well below 1.
  master.gain.value = Math.min(1, s.soundVolume) * 0.18 * gain;
  master.connect(ac.destination);

  const now = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = n.t ?? "triangle";
    osc.frequency.value = n.f;
    const start = now + (n.delay ?? 0);
    const peak = n.g ?? 1;
    // Quick attack, smooth decay — a soft blip, never a sustained beep.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + n.d + 0.02);
  }
}

export const sfx = {
  /** Light menu/navigation click. */
  click: () => play([{ f: 660, d: 0.045, t: "square", g: 0.5 }], 0.7),
  /** Drafting a card onto the team. */
  pick: () => play([{ f: 523.25, d: 0.09 }, { f: 783.99, d: 0.12, delay: 0.05 }]),
  /** A user series resolved in the sim — won (light, distinct from results win). */
  matchWin: () => play([{ f: 587.33, d: 0.08 }, { f: 880, d: 0.11, delay: 0.06 }], 0.8),
  /** A user series resolved in the sim — lost (light). */
  matchLose: () => play([{ f: 392, d: 0.1, g: 0.7 }, { f: 293.66, d: 0.13, delay: 0.06, g: 0.6 }], 0.8),
  /** Rerolling the lineup. */
  reroll: () => play([{ f: 320, d: 0.1, t: "sawtooth", g: 0.6 }, { f: 240, d: 0.12, delay: 0.05, t: "sawtooth", g: 0.5 }]),
  /** Locking the roster / starting the tournament. */
  start: () => play([{ f: 392, d: 0.12 }, { f: 587.33, d: 0.16, delay: 0.08 }]),
  /** Unlocking a special card (bright arpeggio). */
  unlock: () =>
    play([
      { f: 523.25, d: 0.12 },
      { f: 659.25, d: 0.12, delay: 0.1 },
      { f: 783.99, d: 0.18, delay: 0.2 },
    ]),
  /** Ranking up (a touch grander). */
  rankUp: () =>
    play([
      { f: 392, d: 0.12 },
      { f: 523.25, d: 0.12, delay: 0.1 },
      { f: 659.25, d: 0.12, delay: 0.2 },
      { f: 880, d: 0.22, delay: 0.3 },
    ]),
  /** Winning the title. */
  win: () =>
    play([
      { f: 523.25, d: 0.14 },
      { f: 659.25, d: 0.14, delay: 0.12 },
      { f: 783.99, d: 0.28, delay: 0.24 },
    ]),
  /** Losing / elimination (soft descending). */
  lose: () => play([{ f: 392, d: 0.16, g: 0.7 }, { f: 311.13, d: 0.24, delay: 0.12, g: 0.6 }]),
} as const;
