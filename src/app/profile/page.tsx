"use client";

/** Profile: rank (profile art set), XP, lifetime stats, achievements, run history. */

import Link from "next/link";
import { useState } from "react";
import { achievements as achievementDefs, specialCards } from "@/data";
import { useCopy } from "@/content/copy";
import { rankForXp } from "@/engine/progression";
import type { Placement } from "@/engine/types";
import { formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import {
  selectBestClear,
  selectChampionships,
  useProfileStore,
} from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RankBadge } from "@/components/ui/RankBadge";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AccountSection, ProfileNickname } from "@/components/AccountSection";
import { useAccountStore } from "@/store/accountStore";

export default function ProfilePage() {
  const { PROFILE_UI: P, DIFFICULTY_LABELS, LEADERBOARDS_UI: L } = useCopy();
  const mounted = useMounted();
  const profile = useProfileStore();
  const titles = useProfileStore(selectChampionships);
  const bestClear = useProfileStore(selectBestClear);
  const accountStatus = useAccountStore((s) => s.status);
  const accountEmail = useAccountStore((s) => s.session?.user.email ?? null);
  const accountSignOut = useAccountStore((s) => s.signOut);
  const accountDelete = useAccountStore((s) => s.deleteAccount);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />;
  }

  const signedIn = accountStatus === "signedIn";

  const rank = rankForXp(profile.xp);
  const unlockedCount = Object.keys(profile.unlockedSpecials).length;
  const earned = profile.achievements;

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle kicker={P.career} title={P.title} className="mb-6" />

      {/* Rank panel doubles as the profile-identity card (v1.4): when signed in,
          the display name is the hero (left) and the rank / XP are right-aligned,
          with sign out inside the card. Signed out, it's the rank on its own. */}
      <Panel strong glow="blue" className="mb-6 flex flex-col items-center gap-6 p-6 sm:flex-row">
        <RankBadge rank={rank} variant="profile" size="lg" />

        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          {signedIn ? (
            // Name is the hero (left); the rank text moves to the right, one line.
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <ProfileNickname />
                <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
                  {accountEmail ? (
                    <span className="truncate text-xs text-faint">{accountEmail}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={accountSignOut}
                    className="shrink-0 text-xs font-semibold text-sub underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    {L.signOut}
                  </button>
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="kicker mb-0.5">{P.rank}</p>
                <p className="display whitespace-nowrap text-2xl font-bold uppercase tracking-wide text-ink">
                  {rank.label}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <p className="kicker mb-1">{P.rank}</p>
              <p className="display text-3xl font-bold uppercase tracking-wide text-ink">{rank.label}</p>
            </div>
          )}

          {/* XP bar — full card width, where it always was. */}
          <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
          <p className="mt-1.5 text-xs text-sub">
            {profile.xp} {P.xp}
            {rank.next ? (
              <span className="text-faint"> · {P.toNext(rank.xpToNext)}</span>
            ) : (
              <span className="text-faint"> · {P.maxRank}</span>
            )}
          </p>
        </div>
      </Panel>

      {/* Sign-in incentive — signed out only (renders nothing otherwise). */}
      <AccountSection />

      {/* Stats */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.runs} value={String(profile.runsCompleted)} />
        <StatTile label={P.titles} value={String(titles)} />
        <StatTile label={P.bestClear} value={bestClear ? DIFFICULTY_LABELS[bestClear].label : P.none} />
        <StatTile label={P.specials} value={`${unlockedCount}/${specialCards.length}`} />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={P.titleRate}
          value={profile.runsCompleted > 0 ? `${Math.round((titles / profile.runsCompleted) * 100)}%` : P.none}
        />
        <StatTile
          label={P.playoffRate}
          value={
            profile.runsCompleted > 0
              ? `${Math.round((profile.playoffAppearances / profile.runsCompleted) * 100)}%`
              : P.none
          }
        />
        <StatTile label={P.podiums} value={String(profile.podiums)} />
        <StatTile label={P.swissWins} value={String(profile.swissWinsTotal)} />
      </div>

      {/* Achievements */}
      <SectionTitle
        title={P.achievements}
        right={
          <Link href="/achievements">
            <Badge tone="blue" className="cursor-pointer hover:bg-blue/20">
              {P.viewAll(Object.keys(earned).length, achievementDefs.length)}
            </Badge>
          </Link>
        }
        className="mb-4"
      />
      <div className="mb-8">
        <AchievementsGrid earned={earned} />
      </div>

      {/* Run history */}
      <SectionTitle title={P.history} className="mb-4" />
      {profile.runHistory.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-sub">{P.emptyHistory}</Panel>
      ) : (
        <div className="space-y-2">
          {profile.runHistory.slice(0, 10).map((run) => (
            <Panel key={run.runId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5 text-sm">
              <Badge tone={run.placement === "champion" ? "gold" : "neutral"} className="w-20 justify-center">
                {P.placement[run.placement as Placement] ?? run.placement}
              </Badge>
              <span className="display font-bold text-ink">
                {run.swissRecord.wins}–{run.swissRecord.losses}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-sub">
                {run.rosterNames.join(" · ")}
              </span>
              <Badge tone="blue">{DIFFICULTY_LABELS[run.difficulty].label}</Badge>
              {run.hiddenOverall ? <Badge tone="neutral">{P.hidden}</Badge> : null}
              <span className="display text-xs font-bold text-orange-bright">+{run.xpGained} XP</span>
              <span className="text-[11px] text-faint">{formatDate(run.date)}</span>
            </Panel>
          ))}
        </div>
      )}

      {/* Danger zone — reset local progress + (signed in) delete account, same pill style. */}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          {P.reset}
        </Button>
        {signedIn ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            {L.deleteAccount}
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirmDelete}
        title={L.deleteTitle}
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {L.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false);
                accountDelete();
              }}
            >
              {L.deleteConfirm}
            </Button>
          </>
        }
      >
        {L.deleteBody}
      </Modal>

      <Modal
        open={confirmReset}
        title={P.resetConfirmTitle}
        onClose={() => setConfirmReset(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {P.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                profile.resetAll();
                setConfirmReset(false);
              }}
            >
              {P.resetConfirm}
            </Button>
          </>
        }
      >
        {P.resetConfirmBody}
      </Modal>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4 text-center">
      <p className="kicker !text-[10px]">{label}</p>
      <p className="display mt-1 truncate text-2xl font-bold text-ink">{value}</p>
    </Panel>
  );
}
