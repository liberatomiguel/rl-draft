"use client";

/**
 * Tiny synthesized sound layer (v1.0). No audio assets — short Web Audio
 * tones, deliberately subtle ("depth, not noise" per direction). Every cue
 * reads the live settings, so muting / volume / disabling is instant.
 *
 * AudioContext is created lazily and resumed on first use (it only unlocks
 * after a user gesture, which every cue here follows).
 *
 * v2.0 (P1): never created INSIDE a click. Building an AudioContext blocks the
 * main thread (40 ms on a desktop, far more on a phone), and the first cue of
 * a session used to build it in its own click handler: the first button of
 * every visit answered late (opening the locker measured 360 ms to the next
 * paint with a 4x slower CPU). It is now built once, in idle time shortly
 * after the session's first touch or key press. A cue that arrives before it
 * is ready is skipped: at most the first blip of a visit is silent.
 */

import { useSettings } from "@/store/settingsStore";

type Note = { f: number; d: number; t?: OscillatorType; delay?: number; g?: number };

let ctx: AudioContext | null = null;
let warming = false;

/** How long after the first gesture the context is built (its own interaction has painted by then). */
const WARM_DELAY_MS = 350;

function build(): void {
  warming = false;
  if (ctx || typeof window === "undefined") return;
  const s = useSettings.getState();
  // Sound off: nothing to build. A later cue (sound switched on) asks again.
  if (!s.soundEnabled || s.soundVolume <= 0) return;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
}

/** Build the context away from any input: after a short delay, in an idle slot. */
function warm(): void {
  if (ctx || warming || typeof window === "undefined") return;
  warming = true;
  const idle: (fn: () => void) => void =
    typeof window.requestIdleCallback === "function"
      ? (fn) => window.requestIdleCallback(fn, { timeout: 1500 })
      : (fn) => window.setTimeout(fn, 1);
  window.setTimeout(() => idle(build), WARM_DELAY_MS);
}

if (typeof window !== "undefined") {
  // The first touch or key press of the visit (a gesture, so the context may start).
  for (const type of ["pointerdown", "keydown"] as const) {
    window.addEventListener(type, warm, { once: true, capture: true, passive: true });
  }
}

function play(notes: Note[], gain = 1): void {
  const s = useSettings.getState();
  if (!s.soundEnabled || s.soundVolume <= 0) return;
  const ac = ctx;
  if (!ac) {
    warm();
    return;
  }
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
