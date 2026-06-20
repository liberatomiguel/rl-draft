"use client";

/**
 * /leaderboards (v1.4) — PURE global boards, public and viewable signed-out (the
 * `leaderboard` view is anon-readable). Sign-in, personal records and the display
 * name all live on the Profile now. Your row is highlighted when you're signed in.
 * With no Supabase env it shows a "coming soon" note.
 */

import { useEffect, useState } from "react";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { accountsEnabled, fetchLeaderboard, type LeaderboardCategory, type LeaderboardRow } from "@/lib/supabase";
import { useAccountStore } from "@/store/accountStore";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionTitle } from "@/components/ui/Panel";

// v1.4: trimmed to the four Miguel wants (titles first), plus MMR — the cosmetic
// skill rating that replaced the old XP board. The other columns still exist in
// the DB/view; they're just no longer surfaced as tabs.
const CATEGORIES: LeaderboardCategory[] = [
  "championships", // Titles · Total
  "titles_legacy", // Titles · Legacy
  "best_legacy", // Highest overall · Legacy
  "best_sam", // Highest overall · Regional
  "mmr", // Skill rating
];

export function LeaderboardsView() {
  const { LEADERBOARDS_UI: L } = useCopy();
  const username = useAccountStore((s) => s.username);
  const [cat, setCat] = useState<LeaderboardCategory>("championships");
  // Hold the loaded category with its rows; loading = the fetch for the current
  // tab hasn't landed yet. Derived, so no setState-in-effect.
  const [loaded, setLoaded] = useState<{ cat: LeaderboardCategory; rows: LeaderboardRow[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard(cat, 100).then((r) => {
      if (alive) setLoaded({ cat, rows: r });
    });
    return () => {
      alive = false;
    };
  }, [cat]);

  const loading = loaded?.cat !== cat;
  const rows = loaded?.cat === cat ? loaded.rows : [];

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
          <div className="mb-4 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  sfx.click();
                  setCat(c);
                }}
                className={cx(
                  "display rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                  cat === c ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
                )}
              >
                {L.categories[c]}
              </button>
            ))}
          </div>

          <Panel className="divide-y divide-line/60">
            {loading ? (
              <p className="p-4 text-sm text-faint">{L.syncing}</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-faint">{L.empty}</p>
            ) : (
              rows.map((r, i) => {
                const isYou = !!username && r.username === username;
                return (
                  <div
                    key={i}
                    className={cx("flex items-center gap-3 px-4 py-2.5", isYou && "bg-orange/5")}
                  >
                    <span
                      className={cx(
                        "display w-7 text-sm font-bold",
                        i === 0 ? "text-amber-300" : i < 3 ? "text-sub" : "text-faint",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-ink">
                      {r.username}
                      {isYou ? <Badge tone="orange"> {L.you}</Badge> : null}
                    </span>
                    <span className="display text-sm font-bold text-orange-bright">{r.value}</span>
                  </div>
                );
              })
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
