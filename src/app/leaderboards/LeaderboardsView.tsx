"use client";

/**
 * /leaderboards v2 (v2.0) — boards that show who people ARE, not just a number:
 * every row carries the player's equipped title, banner (the row background)
 * and badges, straight from the public `leaderboard` view. rc.4 row order:
 * place · name · badges (featured first, a size up) · title on the left; rank
 * and the number on the right. rc.5: taller rows for bigger badges, and the
 * profile peek is a small showcase (identity + place on this board, the three
 * badges with the featured one centred and largest, then the numbers). rc.6:
 * badges carry their rarity effects (holo, sparkles, tilt) here too. Tabs: Season Rating (headline), the frozen pre-season
 * Hall of Fame, titles, Legacy overall, Regional overall. Tap a row for a
 * profile peek. Public and viewable signed out; your row is highlighted.
 */

import { useEffect, useMemo, useState } from "react";
import { FEATURES } from "@/config/balance";
import { previewLeaderboardRows } from "@/data/previewLeaderboard";
import { useCopy } from "@/content/copy";
import { rowCosmetics } from "@/engine/cosmetics";
import { rankForXp } from "@/engine/progression";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import {
  accountsEnabled,
  fetchHallOfFame,
  fetchLeaderboard,
  type HallOfFameRow,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/lib/supabase";
import { useAccountStore } from "@/store/accountStore";
import { useMounted } from "@/store/useMounted";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { BadgeEmblem, BadgeRow, BannerSurface, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import type { CosmeticDef } from "@/data/cosmetics";

/** rc.5 badge boxes (px) — layout, not gameplay. */
const ROW_BADGE_PX = 28;
const ROW_FEATURED_PX = 36;
const PEEK_BADGE_PX = 76;
const PEEK_FEATURED_PX = 108;

type BoardKey = "season" | "hallOfFame" | "titles" | "legacyOverall" | "regional";

const BOARDS: { key: BoardKey; category?: LeaderboardCategory }[] = [
  { key: "season", category: "season_mmr" },
  { key: "hallOfFame" },
  { key: "titles", category: "championships" },
  { key: "legacyOverall", category: "best_legacy" },
  { key: "regional", category: "best_sam" },
];

type Row = {
  username: string;
  value: number;
  rankXp: number;
  seasonMmr: number;
  seasonTitles: number;
  championships: number;
  cosmetics: ReturnType<typeof rowCosmetics>;
  preseasonPosition: number | null;
  grants: string[];
};

function fromBoard(r: LeaderboardRow): Row {
  return {
    username: r.username,
    value: r.value,
    rankXp: r.season_xp,
    seasonMmr: r.season_mmr,
    seasonTitles: r.season_titles,
    championships: r.championships,
    cosmetics: rowCosmetics(r),
    preseasonPosition: r.preseason_position,
    grants: r.grants,
  };
}

function fromHall(r: HallOfFameRow): Row {
  return {
    username: r.username,
    value: r.mmr,
    rankXp: r.xp,
    seasonMmr: r.mmr,
    seasonTitles: 0,
    championships: r.championships,
    cosmetics: rowCosmetics({ ...r, equipped_badges: [] }),
    preseasonPosition: r.position,
    grants: r.grants,
  };
}

/** rc.2: dev/staging builds without Supabase show a fictional full board. */
const previewMode = !accountsEnabled && FEATURES.previewTools;

function previewRows(board: BoardKey): Row[] {
  const all = previewLeaderboardRows();
  if (board === "hallOfFame") {
    return all
      .filter((r) => r.preseason_position !== null)
      .sort((a, b) => (a.preseason_position ?? 0) - (b.preseason_position ?? 0))
      .map((r) =>
        fromHall({
          username: r.username,
          position: r.preseason_position ?? 0,
          mmr: r.preseason_mmr,
          xp: r.preseason_xp,
          championships: r.championships,
          season_xp: r.season_xp,
          season_mmr: r.season_mmr,
          season_titles: r.season_titles,
          equipped_title: r.equipped_title,
          equipped_frame: r.equipped_frame,
          equipped_banner: r.equipped_banner,
          grants: r.grants,
          equipped_badges: [],
          preseason_position: r.preseason_position,
        }),
      );
  }
  const key = BOARDS.find((b) => b.key === board)?.category ?? "season_mmr";
  return all
    .map((r) => fromBoard({ ...r, value: (r as unknown as Record<string, number>)[key] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function LeaderboardsView() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const mounted = useMounted();
  const username = useAccountStore((s) => s.username);
  const [board, setBoard] = useState<BoardKey>("season");
  const [loaded, setLoaded] = useState<{ board: BoardKey; rows: Row[] } | null>(null);
  const [peek, setPeek] = useState<{ row: Row; place: number } | null>(null);

  // Preview rows are derived, never fetched (no effect, no setState) — and only
  // after mount, so the exported HTML stays small.
  const preview = useMemo(() => (previewMode && mounted ? previewRows(board) : null), [board, mounted]);

  useEffect(() => {
    let alive = true;
    if (previewMode) return;
    const def = BOARDS.find((b) => b.key === board)!;
    const p = def.category
      ? fetchLeaderboard(def.category, 100).then((rows) => rows.map(fromBoard))
      : fetchHallOfFame(100).then((rows) => rows.map(fromHall));
    p.then((rows) => {
      if (alive) setLoaded({ board, rows });
    });
    return () => {
      alive = false;
    };
  }, [board]);

  const loading = !preview && loaded?.board !== board;
  const rows = preview ?? (loaded?.board === board ? loaded.rows : []);
  const isHall = board === "hallOfFame";

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle kicker={L.globalTab} title={L.title} className="mb-2" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{L.subtitle}</p>

      {!accountsEnabled && !previewMode ? (
        <Panel className="p-4 text-sm leading-relaxed text-sub">
          <p>{L.comingSoon}</p>
        </Panel>
      ) : (
        <>
          {previewMode ? (
            <p className="mb-3">
              <Badge tone="orange">{L.previewData}</Badge>
            </p>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {BOARDS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => {
                  sfx.click();
                  setBoard(b.key);
                }}
                className={cx(
                  "display rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                  board === b.key ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
                )}
              >
                {L.boards[b.key]}
              </button>
            ))}
          </div>
          <p className="mb-4 text-xs text-faint">{isHall ? L.hallHint : board === "season" ? L.seasonBoardHint : null}</p>

          <Panel className="divide-y divide-line/60 overflow-hidden">
            {loading ? (
              <p className="p-4 text-sm text-faint">{L.syncing}</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-faint">{isHall ? L.hallEmpty : L.empty}</p>
            ) : (
              rows.map((r, i) => {
                const isYou = !!username && r.username === username;
                const place = isHall ? r.preseasonPosition ?? i + 1 : i + 1;
                const rank = rankForXp(r.rankXp);
                return (
                  <BannerSurface
                    displayPx={800}
                    key={`${r.username}-${i}`}
                    banner={r.cosmetics.banner}
                    className={cx("cos-banner-row", isYou && "ring-1 ring-inset ring-orange/50")}
                    plainClassName={cx(isYou && "bg-orange/5")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        sfx.click();
                        setPeek({ row: r, place });
                      }}
                      className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 sm:px-4"
                    >
                      <span className={cx("display w-7 shrink-0 text-sm font-bold", place === 1 ? "text-amber-300" : place <= 3 ? "text-sub" : "text-faint")}>
                        {place}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        {/* Mobile: the title sits under the name (no room beside the
                            badges); sm+: place · name · badges · title in one line. */}
                        <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span className="flex min-w-0 max-w-full items-center gap-2">
                            <span className="truncate text-sm font-semibold text-ink">{r.username}</span>
                            {isYou ? <Badge tone="orange">{L.you}</Badge> : null}
                          </span>
                          {/* Wrapped: .cos-title sets its own display, so the
                              visibility utility lives on the wrapper. */}
                          {r.cosmetics.title ? (
                            <span className="flex max-w-full overflow-hidden sm:hidden">
                              <TitleTag title={r.cosmetics.title} size="sm" />
                            </span>
                          ) : null}
                        </span>
                        <BadgeRow badges={r.cosmetics.badges} size={ROW_BADGE_PX} featuredSize={ROW_FEATURED_PX} className="shrink-0" />
                        {r.cosmetics.title ? (
                          <span className="hidden min-w-0 overflow-hidden sm:flex">
                            <TitleTag title={r.cosmetics.title} size="sm" />
                          </span>
                        ) : null}
                      </span>
                      <span className="hidden w-28 shrink-0 items-center gap-1.5 sm:flex">
                        <RankBadge rank={rank} variant="menu" size="sm" className="!h-7 !w-7" />
                        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-faint">{rank.label}</span>
                      </span>
                      <span className="display w-14 shrink-0 text-right text-sm font-bold text-orange-bright">{r.value}</span>
                    </button>
                  </BannerSurface>
                );
              })
            )}
          </Panel>
        </>
      )}

      <Modal open={!!peek} title={L.peekTitle} onClose={() => setPeek(null)}>
        {peek ? <PeekCard row={peek.row} place={peek.place} boardLabel={L.boards[board]} /> : null}
      </Modal>
    </div>
  );
}

/** The profile peek (rc.5, reworked rc.6): the banner with rank emblem, name,
 *  title and the player's place on THIS board; the badge showcase (featured in
 *  the middle and largest, with effects); then the numbers. */
function PeekCard({ row, place, boardLabel }: { row: Row; place: number; boardLabel: string }) {
  const { LEADERBOARDS_UI: L } = useCopy();
  const copy = useCosmeticCopy();
  const rank = rankForXp(row.rankXp);
  const badges = row.cosmetics.badges;
  // Three badges: the featured one (index 0) stands in the middle, a size up.
  const showcase: { badge: CosmeticDef; featured: boolean }[] =
    badges.length === 3
      ? [
          { badge: badges[1], featured: false },
          { badge: badges[0], featured: true },
          { badge: badges[2], featured: false },
        ]
      : badges.map((badge, i) => ({ badge, featured: i === 0 }));
  return (
    <div className="space-y-3">
      <BannerSurface banner={row.cosmetics.banner} className="overflow-hidden rounded-xl border border-line-strong" plainClassName="panel-strong">
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <RankBadge rank={rank} variant="menu" size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-2xl font-bold uppercase leading-tight tracking-wide text-ink">{row.username}</p>
            {row.cosmetics.title ? (
              <div className="mt-1.5">
                <TitleTag title={row.cosmetics.title} size="sm" />
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className={cx("display text-4xl font-bold leading-none", place === 1 ? "text-amber-300" : place <= 3 ? "text-ink" : "text-sub")}>#{place}</p>
            <p className="mt-1 max-w-[7rem] text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-faint">{boardLabel}</p>
          </div>
        </div>
      </BannerSurface>

      <div className="rounded-xl border border-line bg-white/[0.02] px-2 pb-4 pt-3">
        <p className="kicker mb-2 text-center !text-[10px]">{L.peekBadges}</p>
        {showcase.length === 0 ? (
          <p className="py-2 text-center text-xs text-faint">{L.peekNoBadges}</p>
        ) : (
          <div className="flex items-start justify-center gap-1 sm:gap-3">
            {showcase.map(({ badge, featured }) => (
              <div key={badge.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" style={{ maxWidth: PEEK_FEATURED_PX + 16 }}>
                {/* Same box height for every badge so the names line up. */}
                <span className="flex items-end justify-center" style={{ height: PEEK_FEATURED_PX }}>
                  <BadgeEmblem badge={badge} size={featured ? PEEK_FEATURED_PX : PEEK_BADGE_PX} />
                </span>
                <span className={cx("line-clamp-2 text-[11px] font-semibold leading-tight", featured ? "text-ink" : "text-sub")}>{copy.name(badge.id)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <PeekStat label={L.rating} value={String(row.seasonMmr)} accent />
        <PeekStat label={L.rank} value={rank.label} />
        <PeekStat label={L.titlesShort} value={String(row.championships)} />
      </div>
    </div>
  );
}

function PeekStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel p-3">
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 truncate text-lg font-bold", accent ? "text-orange-bright" : "text-ink")}>{value}</p>
    </div>
  );
}
