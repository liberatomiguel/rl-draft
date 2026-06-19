"use client";

/**
 * /leaderboards (v1.4). Always shows the player's personal records (from the
 * local profile). When accounts are configured (Supabase env set), it also
 * handles Discord sign-in, merges + syncs the profile to the cloud, and shows
 * the global boards. With no infra it degrades to records-only + a "coming
 * soon" note — the page is useful today and lights up when accounts go live.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { mergeProfiles, toDurable } from "@/lib/profileSync";
import {
  accountsEnabled,
  fetchCloudProfile,
  fetchLeaderboard,
  getSession,
  leaderboardStats,
  onAuthChange,
  pushCloudProfile,
  signInWithDiscord,
  signOut,
  type LeaderboardCategory,
  type LeaderboardRow,
} from "@/lib/supabase";
import { useMounted } from "@/store/useMounted";
import { selectDailyStreak, useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionTitle } from "@/components/ui/Panel";

const CATEGORIES: LeaderboardCategory[] = [
  "best_normal",
  "best_hard",
  "best_legacy",
  "best_worldwide",
  "best_sam",
  "best_easy",
  "championships",
  "challenges_cleared",
  "daily_streak",
  "xp",
];

function discordName(s: Session): string {
  const m = s.user.user_metadata as Record<string, string> | undefined;
  return m?.full_name ?? m?.name ?? m?.preferred_username ?? "Player";
}

export function LeaderboardsView() {
  const mounted = useMounted();
  const { LEADERBOARDS_UI: L } = useCopy();
  const records = useProfileStore((s) => s.records);
  const wins = useProfileStore((s) => s.wins);
  const xp = useProfileStore((s) => s.xp);
  const challengesCompleted = useProfileStore((s) => s.challengesCompleted);
  const dailyStreak = useProfileStore(selectDailyStreak);
  const hydrateDurable = useProfileStore((s) => s.hydrateDurable);

  const personal: Record<string, number> = {
    best_easy: records.bestOverall.easy,
    best_normal: records.bestOverall.normal,
    best_hard: records.bestOverall.hard,
    best_legacy: records.bestOverall.legacy,
    best_worldwide: records.bestOverallWorldwide,
    best_sam: records.bestOverallSam,
    championships: wins.easy + wins.normal + wins.hard + wins.legacy,
    challenges_cleared: Object.keys(challengesCompleted).length,
    daily_streak: dailyStreak,
    xp,
  };

  // --- accounts (no-op when disabled) ------------------------------------
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (s: Session) => {
      setSyncing(true);
      try {
        const local = toDurable(useProfileStore.getState());
        const cloud = await fetchCloudProfile(s.user.id);
        const merged = cloud ? mergeProfiles(local, cloud) : local;
        if (cloud) hydrateDurable(merged); // never loses local progress
        const streak = selectDailyStreak(useProfileStore.getState());
        const meta = s.user.user_metadata as Record<string, string> | undefined;
        await pushCloudProfile(
          s.user.id,
          discordName(s),
          meta?.avatar_url ?? null,
          merged,
          leaderboardStats(merged, streak),
        );
      } finally {
        setSyncing(false);
      }
    },
    [hydrateDurable],
  );

  useEffect(() => {
    if (!accountsEnabled) return;
    getSession().then((s) => {
      setSession(s);
      if (s) sync(s);
    });
    return onAuthChange((s) => {
      setSession(s);
      if (s) sync(s);
    });
  }, [sync]);

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle kicker={L.yourRecords} title={L.title} className="mb-2" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-sub">{L.subtitle}</p>

      {/* Personal records — always available */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <Panel key={cat} className="flex items-center justify-between gap-3 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-sub">
              {L.categories[cat]}
            </span>
            <span className="display text-xl font-bold text-ink">
              {mounted && personal[cat] > 0 ? personal[cat] : L.none}
            </span>
          </Panel>
        ))}
      </div>

      {/* Accounts */}
      <div className="mt-8">
        {!accountsEnabled ? (
          <Panel className="p-4 text-sm leading-relaxed text-sub">
            <p>{L.guestNote}</p>
            <p className="mt-2 text-xs text-faint">{L.comingSoon}</p>
          </Panel>
        ) : !session ? (
          <Panel className="p-5 text-center">
            <p className="mb-4 text-sm leading-relaxed text-sub">{L.guestNote}</p>
            <Button
              variant="primary"
              onClick={() => {
                sfx.click();
                signInWithDiscord(window.location.href);
              }}
            >
              {L.signInDiscord}
            </Button>
          </Panel>
        ) : (
          <GlobalBoards
            L={L}
            session={session}
            syncing={syncing}
            onSignOut={async () => {
              await signOut();
              setSession(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function GlobalBoards({
  L,
  session,
  syncing,
  onSignOut,
}: {
  L: ReturnType<typeof useCopy>["LEADERBOARDS_UI"];
  session: Session;
  syncing: boolean;
  onSignOut: () => void;
}) {
  const [cat, setCat] = useState<LeaderboardCategory>("best_hard");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  useEffect(() => {
    let alive = true;
    fetchLeaderboard(cat).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [cat]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-sub">
          {L.signedInAs(discordName(session))}
          {syncing ? ` · ${L.syncing}` : ""}
        </span>
        <Button variant="ghost" onClick={onSignOut}>
          {L.signOut}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["best_hard", "best_legacy", "best_worldwide", "best_sam", "championships", "xp"] as LeaderboardCategory[]).map(
          (c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cx(
                "display rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                cat === c ? "bg-orange/15 text-orange-bright" : "text-sub hover:text-ink",
              )}
            >
              {L.categories[c]}
            </button>
          ),
        )}
      </div>

      <Panel className="divide-y divide-line/60">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-faint">{L.empty}</p>
        ) : (
          rows.map((r, i) => {
            const isYou = r.username === discordName(session);
            return (
              <div
                key={i}
                className={cx("flex items-center gap-3 px-4 py-2.5", isYou && "bg-orange/5")}
              >
                <span className="display w-6 text-sm font-bold text-faint">{i + 1}</span>
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
  );
}
