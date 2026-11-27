/**
 * v2.3 FEED (F2): generated fan handles from a bank of our own. Built only from
 * common game and scene words and digits ("boostfarmer_88", "ceilingshot7"),
 * never a real player, org or creator; a test checks every bank word and a
 * large seeded sample against the dataset and the career name catalogue.
 * Pure and seeded (`src/lib/rng.ts`).
 */
import type { Rng } from "@/lib/rng";

export const HANDLE_HEADS = [
  "boost", "ceiling", "flip", "kickoff", "demo", "wall", "aerial", "double", "rotate", "backboard",
  "overtime", "zero", "pinch", "fifty", "garage", "lobby", "midfield", "rebound", "offside", "tilt",
  "soft", "hard", "late", "early", "fresh", "quiet", "loud", "cold", "warm", "sunday",
  "saturday", "bracket", "seed", "swiss", "clutch", "reset", "carry", "hotseat", "corner", "open",
] as const;

export const HANDLE_TAILS = [
  "farmer", "enjoyer", "watcher", "buddy", "main", "fan", "gremlin", "critter", "stan", "daily",
  "shift", "talks", "takes", "clips", "vods", "stats", "report", "corner", "club", "crew",
  "kid", "guy", "lad", "chief", "scout", "analyst", "dad", "mom", "coach", "wizard",
  "enjoy", "nerd", "pilot", "tourist", "regular", "veteran", "newcomer", "phantom", "spirit", "hero",
] as const;

/** One handle: a head and a tail in one of four shapes, lowercase ASCII, digits optional. */
export function handleFrom(rng: Rng): string {
  const head = rng.pick(HANDLE_HEADS);
  const tail = rng.pick(HANDLE_TAILS);
  const digits = rng.int(1, 99);
  switch (rng.int(0, 3)) {
    case 0: return `${head}${tail}`;
    case 1: return `${head}_${tail}${digits}`;
    case 2: return `${head}${tail}${digits}`;
    default: return `${head}.${tail}`;
  }
}

/** The handle's key for clash checks: lowercase letters and digits only. */
export const handleKey = (handle: string): string => handle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
