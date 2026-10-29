/**
 * DATA-01 (rc.32) — the dataset report, by era and region: counts, overall
 * distributions, chemistry links, anomalies, the card-id aliases, the career
 * entry season of every org and (with a baseline) what changed since
 * production. OPT-IN, it writes `docs/DATA-AUDIT-rc32.md`:
 *
 *   DATA_AUDIT=1 npx vitest run src/data/dataAudit.report.test.ts
 *
 * Optional baseline (production's JSONs, e.g. exported with
 * `git show origin/main:src/data/<file>.json`): DATA_AUDIT_BASE=<dir>.
 * Regenerate, never hand-edit the report. It CHECKS, it never fixes: data
 * changes go through `data-sources/teams.md` + `npm run build:data`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAREER_SEASONS } from "@/config/balance";
import {
  careerByPlayerId,
  cardIdAliases,
  coachById,
  coaches,
  lineups,
  orgById,
  orgs,
  playerById,
  playerCardById,
  playerCards,
  players,
  seasons,
  specialCards,
  subById,
  subs,
} from "@/data";
import { finalOverall } from "@/engine/cards";
import { computeChemistry } from "@/engine/chemistry";
import type { Lineup, Region } from "@/engine/types";

/** The career flow, loaded only when the report runs (validate:data stays lean). */
type Flow = typeof import("@/store/careerFlow");

const ON = process.env.DATA_AUDIT === "1";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs", "DATA-AUDIT-rc32.md");
const REGIONS: Region[] = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"];
/** Reporting thresholds only (not gameplay values). */
const SWING = 8;
const THIN_POOL = 8;

type Kind = "international" | "regionOnly" | "national" | "rare";
const kindOf = (l: Lineup): Kind => (l.national ? "national" : l.rareSpawn ? "rare" : l.samOnly ? "regionOnly" : "international");
const seasonOrder = new Map(seasons.map((s) => [s.id, s.order]));
const seasonsSorted = [...seasons].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
const careerIndex = new Map<string, number>(CAREER_SEASONS.map((s, i) => [s.seasonId, i]));

function stats(values: number[]): { n: number; min: number; p10: number; med: number; mean: number; p90: number; max: number } {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, min: 0, p10: 0, med: 0, mean: 0, p90: 0, max: 0 };
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
  const mean = Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  return { n: v.length, min: v[0], p10: q(0.1), med: q(0.5), mean, p90: q(0.9), max: v[v.length - 1] };
}

function table(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

function ownChemistry(l: Lineup) {
  const people = l.playerCardIds.map((id) => {
    const card = playerCardById.get(id)!;
    const p = playerById.get(card.playerId)!;
    const career = careerByPlayerId.get(card.playerId);
    return {
      name: p.nickname,
      lineupId: card.lineupId,
      orgId: card.orgId,
      country: p.country || undefined,
      region: p.region,
      careerLineupIds: career ? [...career.lineupIds] : undefined,
      careerOrgIds: career ? [...career.orgIds] : undefined,
    };
  });
  const staff = (c: { name: string; lineupId: string; orgId: string; country?: string; region?: string } | undefined) =>
    c ? { name: c.name, lineupId: c.lineupId, orgId: c.orgId, country: c.country || undefined, region: c.region } : undefined;
  return computeChemistry({
    players: people,
    coach: staff(l.coachId ? coachById.get(l.coachId) : undefined),
    sub: staff(l.subId ? subById.get(l.subId) : undefined),
    orgId: l.orgId,
    orgName: orgById.get(l.orgId)?.name,
  });
}

function groupRows(label: (key: string) => string, keys: string[], pick: (l: Lineup) => string): (string | number)[][] {
  return keys.map((key) => {
    const ls = lineups.filter((l) => pick(l) === key);
    const cards = ls.flatMap((l) => l.playerCardIds.map((id) => playerCardById.get(id)!));
    const o = stats(cards.map(finalOverall));
    const kinds = (k: Kind) => ls.filter((l) => kindOf(l) === k).length;
    return [
      label(key),
      ls.length,
      kinds("international"),
      kinds("regionOnly"),
      kinds("national"),
      cards.length,
      new Set(cards.map((c) => c.playerId)).size,
      new Set(ls.map((l) => l.orgId)).size,
      ls.filter((l) => l.coachId).length,
      ls.filter((l) => l.subId).length,
      o.n ? `${o.min} / ${o.med} / ${o.mean} / ${o.max}` : "—",
    ];
  });
}

const GROUP_HEADERS = ["", "Lineups", "Intl", "Region-only", "National", "Cards", "Players", "Orgs", "w/ coach", "w/ sub", "Card OVR min / med / mean / max"];

function buildReport({ createCareerSave, rolloverToNextSeason }: Flow): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    "# Data audit — rc.32 (DATA-01)",
    "",
    "> GENERATED by `DATA_AUDIT=1 npx vitest run src/data/dataAudit.report.test.ts`",
    "> (baseline section: `DATA_AUDIT_BASE=<dir with production's src/data JSONs>`).",
    "> Regenerate, never hand-edit. A check, not a redo: data fixes go through",
    "> `data-sources/teams.md` + `npm run build:data` + `npm run validate:data`.",
    "> The gates it sits beside: `npm run validate:data` (schemas, unique ids,",
    "> every cross-reference), `src/engine/cardAliases.test.ts`,",
    "> `src/engine/chemistry.test.ts`, the era-entry tests",
    "> (`worldSim.test.ts` RTW-01, `store/careerOrgEntry.test.ts`).",
    "",
  );

  // --- Totals -------------------------------------------------------------
  const national = specialCards.filter((s) => s.rarity === "national").length;
  push(
    "## Totals",
    "",
    table(
      ["Seasons", "Orgs", "Players", "Player cards", "Lineups", "Coaches", "Subs", "Specials (curated + national)", "Card-id aliases"],
      [[seasons.length, orgs.length, players.length, playerCards.length, lineups.length, coaches.length, subs.length, `${specialCards.length - national} + ${national}`, Object.keys(cardIdAliases).length]],
    ),
    "",
  );

  // --- By era -------------------------------------------------------------
  push("## By era", "", table(GROUP_HEADERS, groupRows((id) => `${seasons.find((s) => s.id === id)!.label}${careerIndex.has(id) ? " (career)" : ""}`, seasonsSorted.map((s) => s.id), (l) => l.seasonId)), "");

  // --- By region ----------------------------------------------------------
  push("## By region", "", table(GROUP_HEADERS, groupRows((r) => r, REGIONS, (l) => l.region)), "");

  // --- Era × region -------------------------------------------------------
  const playable = (l: Lineup) => kindOf(l) === "international" || kindOf(l) === "regionOnly";
  push(
    "## Era × region (playable lineups: international + region-only)",
    "",
    `Cells below ${THIN_POOL} are a thin pool for a region's own event field (fillers complete a career field).`,
    "",
    table(
      ["Season", ...REGIONS],
      seasonsSorted
        .filter((s) => lineups.some((l) => l.seasonId === s.id && playable(l)))
        .map((s) => [
          s.label,
          ...REGIONS.map((r) => {
            const n = lineups.filter((l) => l.seasonId === s.id && l.region === r && playable(l)).length;
            return n > 0 && n < THIN_POOL ? `${n} ⚠` : n;
          }),
        ]),
    ),
    "",
  );

  // --- Overall distribution -------------------------------------------------
  const buckets = [60, 65, 70, 75, 80, 85, 90, 95];
  push(
    "## Overall distribution (player cards, final overall)",
    "",
    table(
      ["Season", ...buckets.map((b) => `${b}-${b + 4}`), "p10 / p90"],
      seasonsSorted.map((s) => {
        const vals = playerCards.filter((c) => c.seasonId === s.id).map(finalOverall);
        const st = stats(vals);
        return [s.label, ...buckets.map((b) => vals.filter((v) => v >= b && v <= b + 4).length), `${st.p10} / ${st.p90}`];
      }),
    ),
    "",
  );

  // --- Chemistry links ----------------------------------------------------
  const real = lineups.filter((l) => kindOf(l) !== "national");
  const chem = real.map((l) => ({ l, c: ownChemistry(l) }));
  const tiers = ["Perfect", "Great", "Good", "Okay", "Poor"] as const;
  const pairs = new Set<string>();
  for (const l of lineups) {
    if (l.national) continue;
    const ids = l.playerCardIds.map((id) => playerCardById.get(id)!.playerId).sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.add(`${ids[i]}|${ids[j]}`);
  }
  const multiOrg = [...careerByPlayerId.values()].filter((c) => c.orgIds.size >= 2).length;
  const multiLineup = [...careerByPlayerId.values()].filter((c) => c.lineupIds.size >= 2).length;
  const noCountry = players.filter((p) => !p.country).length;
  const noBirthday = players.filter((p) => !p.birthday).length;
  push(
    "## Chemistry links",
    "",
    "Every real lineup with its own coach, sub and org (`computeChemistry`, the engine's own scoring):",
    "",
    table(
      ["Season", "Lineups", ...tiers, "min %"],
      seasonsSorted
        .filter((s) => chem.some((x) => x.l.seasonId === s.id))
        .map((s) => {
          const xs = chem.filter((x) => x.l.seasonId === s.id);
          return [s.label, xs.length, ...tiers.map((t) => xs.filter((x) => x.c.tier === t).length), Math.min(...xs.map((x) => x.c.percent))];
        }),
    ),
    "",
    table(
      ["Teammate pairs (shared a club lineup)", "Players on ≥ 2 club lineups (ex-teammate links)", "Players with ≥ 2 orgs (shared-org links)", "Players without a country (no same-country link)", "Players without a birthday (career age inferred)"],
      [[pairs.size, multiLineup, multiOrg, noCountry, noBirthday]],
    ),
    "",
  );
  const notPerfect = chem.filter((x) => x.c.tier !== "Perfect");
  if (notPerfect.length) {
    push(
      `Real lineups below Perfect with their own staff (${notPerfect.length}; usually a missing coach / sub card):`,
      "",
      table(
        ["Lineup", "Season", "Region", "Tier", "%", "Coach", "Sub"],
        notPerfect
          .sort((a, b) => a.c.percent - b.c.percent || a.l.id.localeCompare(b.l.id))
          .slice(0, 25)
          .map((x) => [x.l.id, x.l.seasonId, x.l.region, x.c.tier, x.c.percent, x.l.coachId ? "yes" : "no", x.l.subId ? "yes" : "no"]),
      ),
      notPerfect.length > 25 ? `\n… and ${notPerfect.length - 25} more.` : "",
      "",
    );
  }

  // --- Anomalies ------------------------------------------------------------
  const cardsByPlayer = new Map<string, typeof playerCards>();
  for (const c of playerCards) cardsByPlayer.set(c.playerId, [...(cardsByPlayer.get(c.playerId) ?? []), c]);
  const swings: (string | number)[][] = [];
  const twice: (string | number)[][] = [];
  for (const [pid, cs] of cardsByPlayer) {
    const sorted = [...cs].sort((a, b) => (seasonOrder.get(a.seasonId) ?? 0) - (seasonOrder.get(b.seasonId) ?? 0));
    const perSeason = new Map<string, number>();
    for (const c of sorted) perSeason.set(c.seasonId, (perSeason.get(c.seasonId) ?? 0) + 1);
    for (const [sid, n] of perSeason) {
      const kinds = new Set(sorted.filter((c) => c.seasonId === sid).map((c) => kindOf(lineupsById.get(c.lineupId)!)));
      if (n > 1 && !kinds.has("national")) twice.push([pid, sid, n]);
    }
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const gap = (seasonOrder.get(b.seasonId) ?? 0) - (seasonOrder.get(a.seasonId) ?? 0);
      const delta = finalOverall(b) - finalOverall(a);
      if (gap === 1 && Math.abs(delta) > SWING) swings.push([pid, `${a.seasonId} → ${b.seasonId}`, `${finalOverall(a)} → ${finalOverall(b)}`, delta > 0 ? `+${delta}` : delta]);
    }
  }
  const regionMoves = lineups.filter((l) => !l.national && orgById.get(l.orgId)?.region !== l.region);
  const orphanCoaches = coaches.filter((c) => !lineups.some((l) => l.coachId === c.id));
  const orphanSubs = subs.filter((s) => !lineups.some((l) => l.subId === s.id));
  push(
    "## Anomalies (flagged for curation, none blocks the build)",
    "",
    `- **Overall swings over ${SWING} between consecutive seasons** (same player; curation candidates): ${swings.length}.`,
    `- **A player on two club rosters in one season** (a mid-season move or a "recorte"; informational — the draft never offers one person twice and the career keeps one roster per player, R42): ${twice.length}.`,
    `- **A lineup in a region other than its org's home region** (an era move; informational — the career seats the org in the lineup's region): ${regionMoves.length}.`,
    `- **Coach / sub cards on no lineup**: ${orphanCoaches.length} / ${orphanSubs.length}.`,
    "",
  );
  if (swings.length) {
    push(
      table(["Player", "Seasons", "OVR", "Δ"], swings.sort((a, b) => Math.abs(Number(b[3])) - Math.abs(Number(a[3])) || String(a[0]).localeCompare(String(b[0]))).slice(0, 30)),
      swings.length > 30 ? `\n… and ${swings.length - 30} more.` : "",
      "",
    );
  }
  if (twice.length) {
    push(
      table(["Player", "Season", "Rosters"], twice.sort((a, b) => Number(b[2]) - Number(a[2]) || String(a[0]).localeCompare(String(b[0]))).slice(0, 10)),
      twice.length > 10 ? `\n… and ${twice.length - 10} more.` : "",
      "",
    );
  }
  if (regionMoves.length) {
    push(
      table(
        ["Lineup", "Season", "Lineup region", "Org home region"],
        regionMoves.sort((a, b) => a.id.localeCompare(b.id)).slice(0, 30).map((l) => [l.id, l.seasonId, l.region, orgById.get(l.orgId)?.region ?? "?"]),
      ),
      regionMoves.length > 30 ? `\n… and ${regionMoves.length - 30} more.` : "",
      "",
    );
  }

  // --- Aliases ----------------------------------------------------------------
  push(
    "## Retired card ids (`cardIdAliases.json`)",
    "",
    table(
      ["Old id", "Resolves to", "Same player", "Old id still a live card"],
      Object.entries(cardIdAliases).map(([oldId, newId]) => {
        const live = playerCardById.get(newId);
        const viaOld = playerCardById.get(oldId);
        return [oldId, newId, viaOld?.playerId === live?.playerId ? "yes" : "NO", playerCards.some((c) => c.id === oldId) ? "YES (bad)" : "no"];
      }),
    ),
    "",
  );

  // --- Career entry by org ------------------------------------------------------
  const entry = new Map<string, { index: number; region: Region }>();
  CAREER_SEASONS.forEach((s, i) => {
    for (const l of lineups) {
      if (l.seasonId !== s.seasonId || l.rareSpawn || l.national) continue;
      if (!entry.has(l.orgId)) entry.set(l.orgId, { index: i, region: l.region });
    }
  });
  const firstDataset = new Map<string, number>();
  for (const l of lineups) {
    if (l.national || l.rareSpawn) continue;
    const o = seasonOrder.get(l.seasonId) ?? 0;
    if (!firstDataset.has(l.orgId) || o < firstDataset.get(l.orgId)!) firstDataset.set(l.orgId, o);
  }
  const preCareerOnly = [...firstDataset.keys()].filter((org) => !entry.has(org));
  push(
    "## Career entry season by org (Road to Worlds)",
    "",
    "An org enters in the first career season where it has a playable lineup (any region-only roster",
    "included; national and easter-egg rosters never), in that lineup's region, when the region still",
    "has a filler seat. Season X orgs are there at creation. `store/careerOrgEntry.test.ts` proves it",
    "through the real rollover; RTW-01's `worldSim.test.ts` proves the intake function.",
    "",
    table(
      ["Career season", "Orgs entering", "By region"],
      CAREER_SEASONS.map((s, i) => {
        const here = [...entry].filter(([, e]) => e.index === i);
        return [
          `${s.label}${i === 0 ? " (creation)" : ""}`,
          here.length,
          REGIONS.map((r) => [r, here.filter(([, e]) => e.region === r).length] as const)
            .filter(([, n]) => n > 0)
            .map(([r, n]) => `${r} ${n}`)
            .join(" · "),
        ];
      }),
    ),
    "",
    `Orgs whose lineups are all before Season X (never in a career): ${preCareerOnly.length}.`,
    "",
  );

  // Who actually finds a seat: the real flow (creation + five rollovers). R31
  // keeps 16 orgs a region and an entrant takes a filler's seat, so a region
  // with no filler left keeps its field. Which org takes the last seats follows
  // the dataset's file order (not strength); the outcome does not depend on
  // the career seed.
  let career = createCareerSave(
    {
      identity: { orgName: "Audit", abbrev: "AUD", managerName: "Audit", country: "BR", region: "SAM", crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" },
      difficulty: "normal",
      style: "balanced",
      rosterKey: "balanced",
    },
    11,
  );
  const atCreation = new Set(Object.keys(career.world.orgs).filter((r) => !r.startsWith("fill:")));
  const fillersAtCreation = (r: Region) => Object.keys(career.world.orgs).filter((ref) => ref.startsWith(`fill:${r}:`)).length;
  const seats = Object.fromEntries(REGIONS.map((r) => [r, fillersAtCreation(r)])) as Record<Region, number>;
  for (let s = 1; s < CAREER_SEASONS.length; s++) career = rolloverToNextSeason(career);
  const inWorld = new Set(Object.keys(career.world.orgs));
  const due = [...entry].filter(([, e]) => e.index > 0);
  push(
    "### Who finds a seat (the real flow, seed-independent)",
    "",
    table(
      ["Region", "Season X real orgs", "Filler seats at creation", "Due after Season X", "Entered", "Never enter (no seat)"],
      REGIONS.map((r) => {
        const mine = due.filter(([, e]) => e.region === r);
        const never = mine.filter(([org]) => !inWorld.has(org)).map(([org]) => org).sort();
        return [
          r,
          [...atCreation].filter((ref) => career.world.orgs[ref]?.region === r).length,
          seats[r],
          mine.length,
          mine.length - never.length,
          never.length ? `**${never.length}**: ${never.join(", ")}` : "0",
        ];
      }),
    ),
    "",
    "(An org whose first career lineup's region is full can still enter later with a lineup in",
    "another region that has a seat, as Elevate does: SAM 2021-22 → APAC 2022-23.)",
    "",
    "<details><summary>Every entering org (after Season X), by season</summary>",
    "",
    ...CAREER_SEASONS.slice(1).map((s, k) => {
      const ids = [...entry].filter(([, e]) => e.index === k + 1).map(([org, e]) => `${org} (${e.region})`).sort();
      return `- **${s.label}:** ${ids.join(", ") || "—"}`;
    }),
    "",
    "</details>",
    "",
  );

  // --- Since production (optional baseline) ---------------------------------------
  const base = process.env.DATA_AUDIT_BASE;
  push("## Since production (`main`, v1.4.6)", "");
  if (!base || !existsSync(join(base, "playerCards.json"))) {
    push("Not generated: run with `DATA_AUDIT_BASE=<dir>` holding production's `src/data/*.json`.", "");
  } else {
    const load = (f: string) => JSON.parse(readFileSync(join(base, `${f}.json`), "utf8")) as { id: string; overall?: number; manualAdjustment?: number }[];
    const current: Record<string, { id: string }[]> = { playerCards, players, lineups, orgs, specialCards: specialCards.filter((s) => s.rarity !== "national"), coaches, subs, seasons };
    const rows = Object.entries(current).map(([f, now]) => {
      const before = load(f);
      const ids = new Set(now.map((x) => x.id));
      const gone = before.filter((x) => !ids.has(x.id)).map((x) => x.id);
      const unaliased = gone.filter((id) => !(f === "playerCards" && cardIdAliases[id]));
      const known = new Set(before.map((x) => x.id));
      const added = now.filter((x) => !known.has(x.id)).length;
      return [f, before.length, now.length, added, gone.length, unaliased.length ? `**${unaliased.length}**: ${unaliased.slice(0, 5).join(", ")}` : "0"];
    });
    const before = new Map(load("playerCards").map((c) => [c.id, (c.overall ?? 0) + (c.manualAdjustment ?? 0)]));
    const shared = playerCards.filter((c) => before.has(c.id)).map((c) => ({ id: c.id, from: before.get(c.id)!, to: finalOverall(c) }));
    const moved = shared.filter((x) => x.to !== x.from).map((x) => ({ ...x, d: x.to - x.from }));
    push(
      table(["File", "Production", "rc.31", "New ids", "Ids gone", "Gone without an alias"], rows),
      "",
      `Shared player cards: ${shared.length}; overall changed on ${moved.length}` +
        (moved.length ? ` (min ${Math.min(...moved.map((x) => x.d))}, max +${Math.max(...moved.map((x) => x.d))}). The largest:` : "."),
      "",
    );
    if (moved.length) {
      push(
        table(
          ["Card", "Production", "rc.31", "Δ"],
          moved
            .sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.id.localeCompare(b.id))
            .slice(0, 10)
            .map((x) => [x.id, x.from, x.to, x.d > 0 ? `+${x.d}` : x.d]),
        ),
        "",
      );
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const lineupsById = new Map(lineups.map((l) => [l.id, l]));

describe.skipIf(!ON)("DATA-01 report (opt-in: DATA_AUDIT=1)", () => {
  it("writes docs/DATA-AUDIT-rc32.md", async () => {
    const md = buildReport(await import("@/store/careerFlow"));
    writeFileSync(OUT, md);
    expect(md).toContain("## By era");
  });
});
