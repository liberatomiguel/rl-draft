/**
 * The public RLCS database (v2.0, WEB-01): the dataset as plain, serializable
 * records for the /rlcs pages — every season, team and player with the rosters
 * and overalls the game uses. SERVER ONLY: it reads the dataset JSON directly
 * (not the `@/data` barrel, which also builds the special cards) and is
 * imported only by Server Components and `generateStaticParams`, so none of it
 * reaches a client bundle. The pages receive what they show as props.
 *
 * What stays out, on purpose:
 *  - national teams (their cards are the national album's collectibles) and
 *    the rare-spawn easter egg: finding them is part of the game;
 *  - special cards, for the same reason (the collection keeps them as ???).
 * Region-only rosters are in: they are real lineups, and the regional depth is
 * what the site is about.
 */
import lineupsJson from "@/data/lineups.json";
import orgsJson from "@/data/orgs.json";
import playerCardsJson from "@/data/playerCards.json";
import playersJson from "@/data/players.json";
import seasonsJson from "@/data/seasons.json";
import coachesJson from "@/data/coaches.json";
import subsJson from "@/data/subs.json";

type RawLineup = {
  id: string;
  name: string;
  seasonId: string;
  orgId: string;
  region: string;
  playerCardIds: string[];
  coachId?: string;
  subId?: string;
  samOnly?: boolean;
  national?: boolean;
  rareSpawn?: boolean;
};
type RawCard = { id: string; playerId: string; orgId: string; lineupId: string; seasonId: string; overall: number };
type RawPlayer = { id: string; nickname: string; country: string; region: string };
type RawOrg = { id: string; name: string; region: string };
type RawSeason = { id: string; label: string; shortLabel: string; year: string; order: number };
type RawStaff = { id: string; name: string; lineupId: string; overall: number };

export type DbPlayerRef = { id: string; nickname: string; country: string; overall: number };
export type DbLineup = {
  id: string;
  name: string;
  region: string;
  season: { slug: string; label: string };
  team: { id: string; name: string };
  players: DbPlayerRef[];
  /** Mean overall of the three players, rounded. */
  average: number;
  coach: string | null;
  sub: string | null;
  /** A roster that plays only in its region's Region-Locked Draft. */
  regionOnly: boolean;
};
export type DbSeason = { slug: string; id: string; label: string; year: string; order: number; lineups: DbLineup[] };
export type DbTeam = { id: string; name: string; region: string; lineups: DbLineup[]; best: number };
export type DbPlayerEntry = { season: { slug: string; label: string }; team: { id: string; name: string }; overall: number };
export type DbPlayer = {
  id: string;
  nickname: string;
  country: string;
  region: string;
  entries: DbPlayerEntry[];
  peak: number;
};

/** "rlcs-2021-22" → "2021-22", "rlcs-s1" → "s1": the season's URL segment. */
const seasonSlug = (id: string): string => id.replace(/^rlcs-/, "");

const rawSeasons = [...(seasonsJson as RawSeason[])].sort((a, b) => a.order - b.order);
const seasonRaw = new Map(rawSeasons.map((s) => [s.id, s]));
const orgRaw = new Map((orgsJson as RawOrg[]).map((o) => [o.id, o]));
const playerRaw = new Map((playersJson as RawPlayer[]).map((p) => [p.id, p]));
const cardRaw = new Map((playerCardsJson as RawCard[]).map((c) => [c.id, c]));
const coachByLineup = new Map((coachesJson as RawStaff[]).map((c) => [c.lineupId, c.name]));
const subByLineup = new Map((subsJson as RawStaff[]).map((s) => [s.lineupId, s.name]));

function toLineup(l: RawLineup): DbLineup | null {
  const season = seasonRaw.get(l.seasonId);
  if (!season) return null;
  const players: DbPlayerRef[] = [];
  for (const cardId of l.playerCardIds) {
    const card = cardRaw.get(cardId);
    const player = card ? playerRaw.get(card.playerId) : undefined;
    if (!card || !player) return null; // an incomplete roster is not shown
    players.push({ id: player.id, nickname: player.nickname, country: player.country, overall: card.overall });
  }
  if (players.length === 0) return null;
  return {
    id: l.id,
    name: l.name,
    region: l.region,
    season: { slug: seasonSlug(season.id), label: season.label },
    team: { id: l.orgId, name: orgRaw.get(l.orgId)?.name ?? l.name },
    players,
    average: Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length),
    coach: coachByLineup.get(l.id) ?? null,
    sub: subByLineup.get(l.id) ?? null,
    regionOnly: Boolean(l.samOnly),
  };
}

const seasonOrder = new Map(rawSeasons.map((s) => [seasonSlug(s.id), s.order]));
const bySeasonThenName = (a: DbLineup, b: DbLineup): number =>
  (seasonOrder.get(a.season.slug) ?? 0) - (seasonOrder.get(b.season.slug) ?? 0) || a.name.localeCompare(b.name, "en");

/** Every roster the public pages show, oldest season first. */
export const DB_LINEUPS: DbLineup[] = (lineupsJson as RawLineup[])
  .filter((l) => !l.national && !l.rareSpawn)
  .map(toLineup)
  .filter((l): l is DbLineup => l !== null)
  .sort(bySeasonThenName);

/** Seasons that have at least one public roster, oldest first. */
export const DB_SEASONS: DbSeason[] = rawSeasons
  .map((s) => ({
    slug: seasonSlug(s.id),
    id: s.id,
    label: s.label,
    year: s.year,
    order: s.order,
    lineups: DB_LINEUPS.filter((l) => l.season.slug === seasonSlug(s.id)).sort(
      (a, b) => b.average - a.average || a.name.localeCompare(b.name, "en"),
    ),
  }))
  .filter((s) => s.lineups.length > 0);

/** Teams (organizations) with at least one public roster, by name. */
export const DB_TEAMS: DbTeam[] = [...new Set(DB_LINEUPS.map((l) => l.team.id))]
  .map((id) => {
    const lineups = DB_LINEUPS.filter((l) => l.team.id === id);
    // An organization can field rosters in several regions over the years
    // (Dignitas in EU and NA): it is listed under the one it played most in,
    // the latest on a tie. Each roster card still shows its own region.
    const count = new Map<string, number>();
    for (const l of lineups) count.set(l.region, (count.get(l.region) ?? 0) + 1);
    const top = Math.max(...count.values());
    const region = [...lineups].reverse().find((l) => count.get(l.region) === top)!.region;
    return {
      id,
      name: lineups[lineups.length - 1].team.name,
      region,
      lineups,
      best: Math.max(...lineups.map((l) => l.average)),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

/** Players with at least one public roster, by nickname. */
export const DB_PLAYERS: DbPlayer[] = (() => {
  const entries = new Map<string, DbPlayerEntry[]>();
  for (const l of DB_LINEUPS) {
    for (const p of l.players) {
      const list = entries.get(p.id) ?? [];
      list.push({ season: l.season, team: l.team, overall: p.overall });
      entries.set(p.id, list);
    }
  }
  return [...entries.entries()]
    .map(([id, list]) => {
      const raw = playerRaw.get(id)!;
      return {
        id,
        nickname: raw.nickname,
        country: raw.country,
        region: raw.region,
        entries: list,
        peak: Math.max(...list.map((e) => e.overall)),
      };
    })
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "en", { sensitivity: "base" }));
})();

export const dbSeason = (slug: string): DbSeason | undefined => DB_SEASONS.find((s) => s.slug === slug);
export const dbTeam = (id: string): DbTeam | undefined => DB_TEAMS.find((t) => t.id === id);
export const dbPlayer = (id: string): DbPlayer | undefined => DB_PLAYERS.find((p) => p.id === id);

/** The regions, largest scene first (the order the hub and the indexes use). */
export const DB_REGIONS: string[] = [...new Set(DB_LINEUPS.map((l) => l.region))].sort(
  (a, b) => DB_LINEUPS.filter((l) => l.region === b).length - DB_LINEUPS.filter((l) => l.region === a).length,
);

/** One region's numbers, for the regional content pages (`{NA.lineups}` …). */
export function regionFacts(region: string): Record<string, string> {
  const lineups = DB_LINEUPS.filter((l) => l.region === region);
  const perTeam = new Map<string, number>();
  for (const l of lineups) perTeam.set(l.team.name, (perTeam.get(l.team.name) ?? 0) + 1);
  const topOrgs = [...perTeam.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
    .slice(0, 6)
    .map(([name]) => name);
  const seasons = DB_SEASONS.filter((s) => s.lineups.some((l) => l.region === region));
  return {
    lineups: String(lineups.length),
    orgs: String(perTeam.size),
    players: String(new Set(lineups.flatMap((l) => l.players.map((p) => p.id))).size),
    seasons: String(seasons.length),
    firstSeason: seasons[0]?.label ?? "",
    lastSeason: seasons[seasons.length - 1]?.label ?? "",
    topOrgs: topOrgs.join(", "),
  };
}

/** Totals for the hub page and the metadata. */
export const DB_TOTALS = {
  lineups: DB_LINEUPS.length,
  teams: DB_TEAMS.length,
  players: DB_PLAYERS.length,
  seasons: DB_SEASONS.length,
};
