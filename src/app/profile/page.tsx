"use client";

/**
 * Profile v2 (v2.0): the screen that makes the player want the next reward.
 *  · Identity card — banner, framed rank emblem, name + title + badges, Season
 *    Rating and the XP bar.
 *  · Season panel — week / days left, peak rating, season runs + titles, the
 *    rating history sparkline, the Season track (rank milestones → cosmetics).
 *  · Lifetime stats — never reset.
 *  · Locker — equip titles / badges / frames / banners; locked items say how.
 *  · Achievements + run history (as before), the pre-season recap replay, and
 *    the danger zone.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useState } from "react";
import { RANKS, SEASON_RATING } from "@/config/balance";
import { SEASON, seasonDaysLeft, seasonWeek } from "@/config/season";
import { achievements as achievementDefs, specialCards } from "@/data";
import { COSMETICS } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { resolveEquipped } from "@/engine/cosmetics";
import { rankForXp } from "@/engine/progression";
import type { Placement, RunHistoryEntry } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { selectBestClear, selectChampionships, useProfileStore } from "@/store/profileStore";
import { useAccountStore } from "@/store/accountStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { Modal } from "@/components/ui/Modal";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RankBadge } from "@/components/ui/RankBadge";
import { FieldView } from "@/components/cards/FieldView";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AccountSection, ProfileNickname } from "@/components/AccountSection";
import { BadgeRow, BannerSurface, FrameRing, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { CosmeticsLocker } from "@/components/cosmetics/CosmeticsLocker";
import { SeasonRecap } from "@/components/screens/SeasonRecap";

export default function ProfilePage() {
  const { PROFILE_UI: P, DIFFICULTY_LABELS, LEADERBOARDS_UI: L, SEASON_RECAP: R } = useCopy();
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
  const [recapRun, setRecapRun] = useState<RunHistoryEntry | null>(null);
  const [replayRecap, setReplayRecap] = useState(false);

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />;
  }

  const signedIn = accountStatus === "signedIn";
  const rank = rankForXp(profile.xp);
  const shown = resolveEquipped(profile.cosmetics);
  const unlockedCount = Object.keys(profile.unlockedSpecials).length;
  const earned = profile.achievements;
  const lastDelta = profile.season.ratingHistory[0]?.delta ?? null;
  const daysLeft = seasonDaysLeft();

  const xpText = (
    <>
      {profile.xp} {P.xp}
      {rank.next ? <span className="text-faint"> · {P.toNext(rank.xpToNext)}</span> : <span className="text-faint"> · {P.maxRank}</span>}
    </>
  );

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle kicker={P.career} title={P.title} className="mb-6" />

      {/* ---- Identity card ------------------------------------------------- */}
      <BannerSurface
        banner={shown.banner}
        className="mb-6 rounded-2xl border border-line-strong"
        plainClassName="panel-strong panel-glow-blue"
      >
        <div className={cx("flex flex-col items-center gap-6 p-6 sm:flex-row", shown.banner && "bg-black/35")}>
          <FrameRing frame={shown.frame} width={4}>
            <RankBadge rank={rank} variant="profile" size="lg" />
          </FrameRing>

          <div className="w-full min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                {signedIn ? (
                  <ProfileNickname />
                ) : (
                  <p className="display truncate text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{P.guest}</p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <TitleTag title={shown.title} size="sm" />
                  <BadgeRow badges={shown.badges} size="sm" />
                </div>
                {signedIn && accountEmail ? <p className="mt-1 truncate text-xs text-faint">{accountEmail}</p> : null}
                {!signedIn ? <p className="mt-1 text-xs text-faint">{P.guestHint}</p> : null}
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="kicker mb-0.5">{P.seasonRating}</p>
                <p className="display whitespace-nowrap text-[1.9rem] font-bold leading-none text-orange-bright">
                  {profile.mmr}
                  {lastDelta !== null && lastDelta !== 0 ? (
                    <span className={cx("ml-2 text-sm font-bold", lastDelta > 0 ? "text-good" : "text-bad")}>
                      {lastDelta > 0 ? "+" : ""}
                      {lastDelta}
                    </span>
                  ) : null}
                </p>
                <p className="display mt-1 whitespace-nowrap text-sm font-bold uppercase tracking-wide text-ink">{rank.label}</p>
              </div>
            </div>

            <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              {signedIn ? (
                <button
                  type="button"
                  onClick={accountSignOut}
                  className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {L.signOut}
                </button>
              ) : (
                <span />
              )}
              <p className="text-xs text-sub">{xpText}</p>
            </div>
          </div>
        </div>
      </BannerSurface>

      <AccountSection />

      {/* ---- Season panel ---------------------------------------------------- */}
      <SectionTitle
        title={SEASON.name}
        right={
          <Badge tone={daysLeft > 0 ? "blue" : "neutral"}>
            {daysLeft > 0 ? P.seasonLabel(SEASON.name, seasonWeek(), SEASON.weeks) : P.seasonOver}
            {daysLeft > 0 ? <span className="ml-1 text-faint">· {P.daysLeft(daysLeft)}</span> : null}
          </Badge>
        }
        className="mb-4"
      />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.seasonRating} value={String(profile.mmr)} accent />
        <StatTile label={P.peakRating} value={String(Math.max(profile.season.peakMmr, profile.mmr))} />
        <StatTile label={P.seasonRuns} value={String(profile.season.runs)} />
        <StatTile label={P.seasonTitles} value={String(profile.season.titles)} />
      </div>
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-5">
        <Panel className="p-4 md:col-span-3">
          <p className="kicker mb-2 !text-[10px]">{P.ratingHistory}</p>
          {profile.season.ratingHistory.length < 2 ? (
            <p className="text-xs text-faint">{P.ratingHistoryEmpty}</p>
          ) : (
            <RatingSparkline history={profile.season.ratingHistory} />
          )}
        </Panel>
        <Panel className="p-4 md:col-span-2">
          <p className="kicker mb-1 !text-[10px]">{P.seasonTrack}</p>
          <p className="mb-3 text-[11px] text-faint">{P.seasonTrackHint}</p>
          <SeasonTrack peakRankId={profile.season.peakRankId} owned={profile.cosmetics.owned} />
        </Panel>
      </div>

      {/* ---- Lifetime stats -------------------------------------------------- */}
      <SectionTitle title={P.lifetime} className="mb-4" />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.runs} value={String(profile.runsCompleted)} />
        <StatTile label={P.titles} value={String(titles)} />
        <StatTile label={P.bestClear} value={bestClear ? DIFFICULTY_LABELS[bestClear].label : P.none} />
        <StatTile label={P.specials} value={`${unlockedCount}/${specialCards.length}`} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.titleRate} value={profile.runsCompleted > 0 ? `${Math.round((titles / profile.runsCompleted) * 100)}%` : P.none} />
        <StatTile
          label={P.playoffRate}
          value={profile.runsCompleted > 0 ? `${Math.round((profile.playoffAppearances / profile.runsCompleted) * 100)}%` : P.none}
        />
        <StatTile label={P.podiums} value={String(profile.podiums)} />
        <StatTile label={P.swissWins} value={String(profile.swissWinsTotal)} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.gamesWon} value={String(profile.gamesWon)} />
        <StatTile label={P.goals} value={String(profile.goalsScored)} />
        <StatTile label={P.lifetimeXp} value={String(profile.lifetime.xp)} />
        <StatTile label={P.achievements} value={`${Object.keys(earned).length}/${achievementDefs.length}`} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.quizSolved} value={String(profile.quiz.solved)} />
        <StatTile label={P.missionsDone} value={String(profile.missions.completedTotal)} />
        <StatTile label={P.loginBest} value={String(profile.login.best)} />
        <Panel className="p-4 text-center">
          <p className="kicker !text-[10px]">{P.winsBy}</p>
          <p className="display mt-1 flex items-center justify-center gap-2 text-sm font-bold text-ink">
            {(["easy", "normal", "hard", "legacy"] as const).map((d) => (
              <span key={d} title={DIFFICULTY_LABELS[d].label}>
                <span className="text-faint">{DIFFICULTY_LABELS[d].label.slice(0, 1)}</span> {profile.wins[d]}
              </span>
            ))}
          </p>
        </Panel>
      </div>
      {profile.legacy.preseason ? (
        <div className="mb-8 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setReplayRecap(true)}>
            {R.replay}
          </Button>
        </div>
      ) : (
        <div className="mb-8" />
      )}

      {/* ---- Locker ------------------------------------------------------------ */}
      <SectionTitle title={P.locker} className="mb-1" />
      <p className="mb-4 text-xs text-sub">{P.lockerHint}</p>
      <div className="mb-8">
        <CosmeticsLocker />
      </div>

      {/* ---- Achievements ------------------------------------------------------ */}
      <SectionTitle
        title={P.achievements}
        right={
          <AppLink href="/achievements">
            <Badge tone="blue" className="cursor-pointer hover:bg-blue/20">
              {P.viewAll(Object.keys(earned).length, achievementDefs.length)}
            </Badge>
          </AppLink>
        }
        className="mb-4"
      />
      <div className="mb-8">
        <AchievementsGrid earned={earned} />
      </div>

      {/* ---- Run history ------------------------------------------------------ */}
      <SectionTitle title={P.history} className="mb-4" />
      {profile.runHistory.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-sub">{P.emptyHistory}</Panel>
      ) : (
        <div className="space-y-2">
          {profile.runHistory.slice(0, 10).map((run) => (
            <button
              key={run.runId}
              type="button"
              onClick={() => setRecapRun(run)}
              aria-label={P.viewRun}
              className="panel flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-3.5 text-left text-sm transition-colors hover:!border-line-strong"
            >
              <Badge tone={run.placement === "champion" ? "gold" : "neutral"} className="w-20 justify-center">
                {P.placement[run.placement as Placement] ?? run.placement}
              </Badge>
              <span className="display font-bold text-ink">
                {run.swissRecord.wins}–{run.swissRecord.losses}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-sub">{run.rosterNames.join(" · ")}</span>
              <Badge tone="blue">{DIFFICULTY_LABELS[run.difficulty].label}</Badge>
              {run.hiddenOverall ? <Badge tone="neutral">{P.hidden}</Badge> : null}
              <span className="display text-xs font-bold text-orange-bright">+{run.xpGained} XP</span>
              <span className="text-[11px] text-faint">{formatDate(run.date)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---- Danger zone --------------------------------------------------------- */}
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

      <Modal open={!!recapRun} title={P.runDetailTitle} onClose={() => setRecapRun(null)}>
        {recapRun ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={recapRun.placement === "champion" ? "gold" : "neutral"}>
                {P.placement[recapRun.placement as Placement] ?? recapRun.placement}
              </Badge>
              <Badge tone="blue">{DIFFICULTY_LABELS[recapRun.difficulty].label}</Badge>
              {recapRun.region ? <Badge tone="neutral">{recapRun.region}</Badge> : null}
              {recapRun.hiddenOverall ? <Badge tone="neutral">{P.hidden}</Badge> : null}
              <span className="ml-auto text-[11px] text-faint">{formatDate(recapRun.date)}</span>
            </div>
            {recapRun.recap?.championName && recapRun.placement !== "champion" ? (
              <p className="text-xs text-sub">{P.wonBy(recapRun.recap.championName)}</p>
            ) : null}
            {recapRun.recap ? <FieldView roster={recapRun.recap.roster} showOverall showBench /> : <p className="text-xs text-faint">{P.olderRun}</p>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label={P.teamOverallLabel} value={String(recapRun.teamOverall)} />
              <StatTile label={P.swissWins} value={`${recapRun.swissRecord.wins}–${recapRun.swissRecord.losses}`} />
              {recapRun.recap ? <StatTile label={P.chemistry} value={recapRun.recap.chemistryTier} /> : null}
              {recapRun.recap ? <StatTile label={P.conceded} value={String(recapRun.recap.goalsConceded)} /> : null}
              <StatTile label={P.xp} value={`+${recapRun.xpGained}`} />
            </div>
            {!recapRun.recap ? <p className="text-xs text-sub">{recapRun.rosterNames.join(" · ")}</p> : null}
          </div>
        ) : null}
      </Modal>

      {replayRecap ? <SeasonRecap force onClose={() => setReplayRecap(false)} /> : null}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Panel className="p-4 text-center">
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 truncate text-2xl font-bold", accent ? "text-orange-bright" : "text-ink")}>{value}</p>
    </Panel>
  );
}

/** Inline SVG sparkline of the season's rating movements (oldest → newest). */
function RatingSparkline({ history }: { history: { mmr: number; delta: number; t: string }[] }) {
  const points = [...history].reverse().slice(-30);
  const values = [SEASON_RATING.start, ...points.map((p) => p.mmr)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const w = 300;
  const h = 64;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 12);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#rating-fill)" />
        <path d={d} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-faint">
        <span>{min}</span>
        {last ? (
          <span className={cx("font-semibold", last.delta > 0 ? "text-good" : last.delta < 0 ? "text-bad" : "text-sub")}>
            {last.delta > 0 ? "+" : ""}
            {last.delta} · {formatDate(last.t)}
          </span>
        ) : null}
        <span>{max}</span>
      </div>
    </div>
  );
}

/** The Season 1 rank track: one reward per rank, lit when reached this season. */
function SeasonTrack({ peakRankId, owned }: { peakRankId: string; owned: Record<string, string> }) {
  const copy = useCosmeticCopy();
  const track = COSMETICS.filter((c) => c.source.type === "season-rank" && c.source.seasonId === SEASON.id);
  const peakIdx = Math.max(0, RANKS.findIndex((r) => r.id === peakRankId));
  const rows = RANKS.filter((r) => r.id !== "unranked").map((r) => ({
    rank: r,
    reached: RANKS.findIndex((x) => x.id === r.id) <= peakIdx,
    rewards: track.filter((c) => c.source.type === "season-rank" && c.source.rankId === r.id),
  }));
  return (
    <ol className="space-y-1.5">
      {rows.map(({ rank, reached, rewards }) => (
        <li key={rank.id} className={cx("flex items-center gap-2", !reached && "opacity-50")}>
          <RankBadge rank={rank} variant="menu" size="sm" className="!h-7 !w-7" />
          <span className="display w-24 shrink-0 truncate text-[11px] font-bold uppercase tracking-wide text-ink">{rank.label}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {rewards.map((c) => (
              <span
                key={c.id}
                className={cx(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  owned[c.id] ? "border-orange/40 bg-orange/10 text-orange-bright" : "border-line text-sub",
                )}
                title={copy.desc(c.id)}
              >
                {copy.kind(c.kind)} · {copy.name(c.id)}
              </span>
            ))}
          </span>
          {reached ? <span className="text-good">✓</span> : null}
        </li>
      ))}
    </ol>
  );
}
