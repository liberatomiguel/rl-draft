/**
 * Rarity calibration sim (v1.4). Measures how often each special-card rarity
 * appears in a draft, under the CURRENT model (flat appearance chance + a
 * within-pool weighted pick) vs. a PROPOSED model (absolute per-rarity chance,
 * rolled rarest-first). Goal: keep the overall special-appearance rate ~the same
 * while making legendaries genuinely rare AND decoupled from how many cards a
 * player has of that rarity (the kronovi / monkey_moon "lone legendary" bug).
 *
 * Run: node scripts/calibrate-rarity.mjs
 * This is a measurement tool — Math.random is fine (no determinism needed).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(root, "src/data", p), "utf8"));

const specialCards = read("specialCards.json");
const lineups = read("lineups.json");
const playerCards = read("playerCards.json");

// playerId -> [rarities] for PLAYER specials (coach specials excluded).
const poolByPlayer = new Map();
for (const sp of specialCards) {
  if (sp.kind === "coach") continue;
  if (!poolByPlayer.has(sp.playerId)) poolByPlayer.set(sp.playerId, []);
  poolByPlayer.get(sp.playerId).push(sp.rarity);
}
const cardToPlayer = new Map(playerCards.map((c) => [c.id, c.playerId]));

// Draw population: one entry per (draftable lineup, player-card slot) — this is
// the distribution of player cards a drafter actually sees over many runs.
const draftable = lineups.filter((l) => !l.samOnly);
const population = [];
for (const l of draftable) {
  for (const cid of l.playerCardIds) {
    const pid = cardToPlayer.get(cid);
    if (pid) population.push(pid);
  }
}

// --- CURRENT model -------------------------------------------------------
const OLD_WEIGHTS = { rare: 100, epic: 55, mythic: 28, legendary: 12, creator: 12 };
const OLD_CHANCE = 0.04; // diamond+ effective: appearanceChance(0.05) * mult(0.8)
function rollOld(pool, rng) {
  if (Math.random() >= OLD_CHANCE) return null;
  const total = pool.reduce((s, r) => s + (OLD_WEIGHTS[r] ?? 1), 0);
  let x = Math.random() * total;
  for (const r of pool) {
    x -= OLD_WEIGHTS[r] ?? 1;
    if (x <= 0) return r;
  }
  return pool[pool.length - 1];
}

// --- PROPOSED model ------------------------------------------------------
// Absolute per-card chance a special of each rarity appears, at the baseline
// (all-rarities) rank. Rolled rarest-first; first hit wins; uniform within tier.
const NEW_CHANCE = JSON.parse(process.env.RATES ?? "null") ?? {
  rare: 0.04,
  epic: 0.03,
  mythic: 0.018,
  legendary: 0.006,
  creator: 0.004,
};
const ORDER = ["creator", "legendary", "mythic", "epic", "rare"]; // rarest first
function rollNew(pool) {
  for (const r of ORDER) {
    if (!pool.includes(r)) continue;
    if (Math.random() < NEW_CHANCE[r]) return r;
  }
  return null;
}

// --- simulate ------------------------------------------------------------
const N = 400_000;
const tally = (fn) => {
  const c = { rare: 0, epic: 0, mythic: 0, legendary: 0, creator: 0, none: 0 };
  for (let i = 0; i < N; i++) {
    const pool = poolByPlayer.get(population[i % population.length]);
    if (!pool || pool.length === 0) { c.none++; continue; }
    const r = fn(pool);
    if (r) c[r]++; else c.none++;
  }
  return c;
};
const pct = (n) => ((100 * n) / N).toFixed(3) + "%";
const show = (label, c) => {
  const any = N - c.none;
  console.log(`\n${label}`);
  console.log(`  ANY special : ${pct(any)}`);
  for (const r of ["rare", "epic", "mythic", "legendary", "creator"]) console.log(`  ${r.padEnd(11)}: ${pct(c[r])}`);
};

show("CURRENT (flat 0.04 + within-pool weighted pick)", tally(rollOld));
show(`PROPOSED (per-rarity ${JSON.stringify(NEW_CHANCE)})`, tally(rollNew));

// --- lone-legendary spotlight (the reported bug) -------------------------
console.log("\nLONE-LEGENDARY players (only special is a legendary):");
const loners = [...poolByPlayer.entries()].filter(([, rs]) => rs.every((r) => r === "legendary"));
const TRIALS = 200_000;
for (const [pid, rs] of loners) {
  let oldHit = 0, newHit = 0;
  for (let i = 0; i < TRIALS; i++) {
    if (rollOld(rs) === "legendary") oldHit++;
    if (rollNew(rs) === "legendary") newHit++;
  }
  console.log(
    `  ${pid.padEnd(16)} legendary shows  CURRENT ${pct2(oldHit, TRIALS)}  →  PROPOSED ${pct2(newHit, TRIALS)}  (${(oldHit / Math.max(1, newHit)).toFixed(1)}x rarer)`,
  );
}
function pct2(n, d) { return ((100 * n) / d).toFixed(3) + "%"; }

console.log(`\npopulation: ${population.length} player-card slots across ${draftable.length} draftable lineups · ${poolByPlayer.size} players with specials`);
