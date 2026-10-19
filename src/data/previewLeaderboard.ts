/**
 * Preview leaderboard fixture (rc.2) — DEV / STAGING ONLY (`FEATURES.previewTools`).
 *
 * When accounts are disabled (staging has no Supabase keys) the boards would be
 * empty, so Miguel could never review how a FULL board looks with different
 * cosmetics and stats. This generates ~60 deterministic fictional profiles in
 * the exact `LeaderboardRow` shape the view consumes, plus the same rows as a
 * SQL seed (`scripts/seed-leaderboard-sql.mjs` → `docs/sql/seed-staging-leaderboard.sql`)
 * for a real staging Supabase project. Never imported by production paths.
 */

import { COSMETICS } from "@/data/cosmetics";

export interface PreviewRow {
  username: string;
  season_xp: number;
  season_mmr: number;
  season_peak_mmr: number;
  season_titles: number;
  season_runs: number;
  lifetime_xp: number;
  championships: number;
  best_legacy: number;
  best_sam: number;
  quiz_solved: number;
  login_streak: number;
  challenge_stars: number;
  equipped_title: string | null;
  equipped_frame: string | null;
  equipped_banner: string | null;
  equipped_badges: string[];
  grants: string[];
  preseason_position: number | null;
  /** Frozen pre-season archive (Hall of Fame). */
  preseason_mmr: number;
  preseason_xp: number;
}

const NAMES = [
  "Furacão", "Pivete", "Skyline", "Nordik", "Zephyr", "Mandrake", "Kaito", "Wallaby", "Baobab", "Sultan",
  "Drifty", "Recoil", "Cobalt", "Tornado", "Mirage", "Quokka", "Mamba", "Ronin", "Pantera", "Vexo",
  "Halfline", "Fjord", "Cacique", "Taipan", "Protea", "Dune", "Kitsune", "Moonshot", "Helix", "Golazo",
  "Boostlord", "Umbra", "Relâmpago", "Larrikin", "Springbok", "Faris", "Sora", "Pylon", "Lumen", "Craque",
  "Netminder", "Wyvern", "Tucano", "Kelpie", "Impala", "Qamar", "Raiden", "Jetline", "Prism", "Gaúcho",
  "Ceiling", "Vanta", "Feiticeiro", "Galah", "Oryx", "Nomad", "Yuki", "Snipes", "Meister", "Condor",
];

/** Tiny deterministic PRNG (mulberry32) — the fixture must never change between builds. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ofKind = (kind: string) => COSMETICS.filter((c) => c.kind === kind);

export function previewLeaderboardRows(): PreviewRow[] {
  const r = rng(20261019);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const maybe = <T,>(p: number, arr: T[]): T | null => (r() < p ? pick(arr) : null);
  const titles = ofKind("title");
  const banners = ofKind("banner");
  const badges = ofKind("badge");
  const rows: PreviewRow[] = NAMES.map((name, i) => {
    // A skewed rating spread: a few elites, a fat middle, a long tail.
    const q = r();
    const mmr = Math.round(400 + Math.pow(q, 1.6) * 1500);
    const runs = Math.round(2 + Math.pow(q, 1.2) * 60);
    const seasonTitles = Math.round(runs * (0.05 + r() * 0.3));
    const xp = Math.round(runs * (120 + r() * 140));
    const decorated = r() < 0.75;
    const badgeCount = decorated ? Math.floor(r() * 4) : 0;
    const badgeSet = new Set<string>();
    while (badgeSet.size < badgeCount) badgeSet.add(pick(badges).id);
    const grants: string[] = [];
    if (r() < 0.06) grants.push("pro");
    if (r() < 0.12) grants.push("supporter");
    if (r() < 0.05) grants.push("contributor");
    return {
      username: i % 9 === 4 ? `${name}${Math.floor(r() * 90 + 10)}` : name,
      season_xp: xp,
      season_mmr: mmr,
      season_peak_mmr: mmr + Math.round(r() * 80),
      season_titles: seasonTitles,
      season_runs: runs,
      lifetime_xp: xp + Math.round(r() * 20000),
      championships: seasonTitles + Math.round(r() * 25),
      best_legacy: Math.round(70 + r() * 20),
      best_sam: Math.round(68 + r() * 18),
      quiz_solved: Math.round(r() * 40),
      login_streak: Math.round(r() * 35),
      challenge_stars: Math.round(r() * 50),
      equipped_title: decorated ? (maybe(0.8, titles)?.id ?? null) : null,
      equipped_frame: null,
      equipped_banner: decorated ? (maybe(0.55, banners)?.id ?? null) : null,
      equipped_badges: [...badgeSet].slice(0, 3),
      grants,
      preseason_position: null,
      preseason_mmr: Math.round(900 + Math.pow(r(), 1.4) * 700),
      preseason_xp: Math.round(r() * 12000),
    };
  });
  // Pre-season positions: rank the frozen archive, top 40 get a position.
  [...rows]
    .sort((a, b) => b.preseason_mmr - a.preseason_mmr)
    .slice(0, 40)
    .forEach((row, i) => {
      row.preseason_position = i + 1;
    });
  return rows;
}
