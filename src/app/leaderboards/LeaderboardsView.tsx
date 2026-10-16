"use client";

/**
 * /leaderboards v2 (v2.0) — boards that show who people ARE, not just a number:
 * every row carries the player's equipped title, frame (around their rank
 * emblem), banner (the row background) and badges, straight from the public
 * `leaderboard` view. Tabs: Season Rating (headline), the frozen pre-season
 * Hall of Fame, titles, Legacy overall, Regional overall. Tap a row for a
 * profile peek. Public and viewable signed out; your row is highlighted.
 */

import { useEffect, useState } from "react";
import { SEASON } from "@/config/season";
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
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { BadgeRow, BannerSurface, FrameRing, TitleTag } from "@/components/cosmetics/CosmeticViews";

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

export function LeaderboardsView() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const username = useAccountStore((s) => s.username);
  const [board, setBoard] = useState<BoardKey>("season");
  const [loaded, setLoaded] = useState<{ board: BoardKey; rows: Row[] } | null>(null);
  const [peek, setPeek] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
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

  const loading = loaded?.board !== board;
  const rows = loaded?.board === board ? loaded.rows : [];
  const isHall = board === "hallOfFame";

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle kicker={L.globalTab} title={L.title} className="mb-2" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{L.subtitle}</p>

      {!accountsEnabled ? (
        <Panel className="p-4 text-sm leading-relaxed text-sub">
          <p>{L.comingSoon}</p>
        </Panel>
      ) : (
        <>
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
                    className={cx(isYou && "ring-1 ring-inset ring-orange/50")}
                    plainClassName={cx(isYou && "bg-orange/5")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        sfx.click();
                        setPeek(r);
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5 sm:px-4",
                        r.cosmetics.banner && "bg-black/30",
                      )}
                    >
                      <span
                        className={cx(
                          "display w-7 shrink-0 text-sm font-bold",
                          place === 1 ? "text-amber-300" : place <= 3 ? "text-sub" : "text-faint",
                        )}
                      >
                        {place}
                      </span>
                      <FrameRing frame={r.cosmetics.frame} width={2}>
                        <RankBadge rank={rank} variant="menu" size="sm" className="!h-8 !w-8" />
                      </FrameRing>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{r.username}</span>
                          {isYou ? <Badge tone="orange">{L.you}</Badge> : null}
                          <BadgeRow badges={r.cosmetics.badges} size="xs" className="hidden sm:inline-flex" />
                        </span>
                        <TitleTag title={r.cosmetics.title} size="xs" className="block truncate" />
                      </span>
                      <span className="display shrink-0 text-sm font-bold text-orange-bright">{r.value}</span>
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
              <div className={cx("flex items-center gap-4 p-4", peek.cosmetics.banner && "bg-black/35")}>
                <FrameRing frame={peek.cosmetics.frame} width={3}>
                  <RankBadge rank={rankForXp(peek.rankXp)} variant="profile" size="md" />
                </FrameRing>
                <div className="min-w-0">
                  <p className="display truncate text-xl font-bold uppercase tracking-wide text-ink">{peek.username}</p>
                  <TitleTag title={peek.cosmetics.title} size="sm" />
                  <BadgeRow badges={peek.cosmetics.badges} size="sm" className="mt-1" />
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
