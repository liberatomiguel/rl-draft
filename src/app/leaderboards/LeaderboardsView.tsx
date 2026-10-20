"use client";

/**
 * /leaderboards v2 (v2.0) — boards that show who people ARE, not just a number:
 * every row carries the player's equipped title, banner (the row background)
 * and badges, straight from the public `leaderboard` view. rc.4 row order:
 * place · name · badges (featured first, a size up) · title on the left; rank
 * and the number on the right. Tabs: Season Rating (headline), the frozen pre-season
 * Hall of Fame, titles, Legacy overall, Regional overall. Tap a row for a
 * profile peek. Public and viewable signed out; your row is highlighted.
 */

import { useEffect, useMemo, useState } from "react";
import { FEATURES } from "@/config/balance";
import { SEASON } from "@/config/season";
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
import { BadgeRow, BannerSurface, TitleTag } from "@/components/cosmetics/CosmeticViews";

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
  const [peek, setPeek] = useState<Row | null>(null);

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
                    key={`${r.username}-${i}`}
                    banner={r.cosmetics.banner}
                    className={cx("cos-banner-row", isYou && "ring-1 ring-inset ring-orange/50")}
                    plainClassName={cx(isYou && "bg-orange/5")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        sfx.click();
                        setPeek(r);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5 sm:px-4"
                    >
                      <span className={cx("display w-7 shrink-0 text-sm font-bold", place === 1 ? "text-amber-300" : place <= 3 ? "text-sub" : "text-faint")}>
                        {place}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-[4.5rem] truncate text-sm font-semibold text-ink">{r.username}</span>
                        {isYou ? <Badge tone="orange">{L.you}</Badge> : null}
                        <BadgeRow badges={r.cosmetics.badges} size="xs" featuredSize="sm" className="shrink-0" />
                        <TitleTag title={r.cosmetics.title} size="xs" className="min-w-0 overflow-hidden" />
                      </span>
                      <span className="hidden w-28 shrink-0 items-center gap-1.5 sm:flex">
                        <RankBadge rank={rank} variant="menu" size="sm" className="!h-6 !w-6" />
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
        {peek ? (
          <div>
            <BannerSurface banner={peek.cosmetics.banner} className="-mx-2 rounded-xl border border-line-strong" plainClassName="panel">
              <div className="flex items-center gap-4 p-4">
                <RankBadge rank={rankForXp(peek.rankXp)} variant="menu" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-xl font-bold uppercase tracking-wide text-ink">{peek.username}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TitleTag title={peek.cosmetics.title} size="sm" />
                    <BadgeRow badges={peek.cosmetics.badges} size="md" featuredSize="lg" />
                  </div>
                </div>
              </div>
            </BannerSurface>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <PeekStat label={L.rating} value={String(peek.seasonMmr)} />
              <PeekStat label={L.rank} value={rankForXp(peek.rankXp).label} />
              <PeekStat label={L.titlesShort} value={String(peek.championships)} />
            </div>
            {peek.preseasonPosition ? (
              <p className="mt-3 text-center text-xs text-sub">
                <Badge tone="gold">{L.preseasonPlace(peek.preseasonPosition)}</Badge>
              </p>
            ) : null}
            <p className="mt-3 text-center text-[10px] text-faint">{SEASON.name}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function PeekStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <p className="kicker !text-[10px]">{label}</p>
      <p className="display mt-1 truncate text-lg font-bold text-ink">{value}</p>
    </div>
  );
}
