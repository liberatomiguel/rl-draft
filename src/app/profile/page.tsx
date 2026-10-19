"use client";

/**
 * Profile v3 (rc.2): the screen that makes the player want the next reward.
 *  · HERO — the banner is the stage: avatar in its frame, name + title chip,
 *    three badge slots, the rank emblem (menu art), Season Rating and the XP
 *    bar. Every cosmetic slot is tappable and opens the LOCKER MODAL on that
 *    kind; a "new items" counter nags until the player has looked.
 *  · Season — the track is a horizontal progress bar with the reward art at
 *    every rank; the rating history is a small sparkline beside it.
 *  · Lifetime — three headline numbers, a secondary grid, then the rest as
 *    quiet chips.
 *  · Achievements + run history (as before), the pre-season recap replay,
 *    the dev/staging preview tools, and the danger zone.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useState } from "react";
import { FEATURES, RANKS, SEASON_RATING } from "@/config/balance";
import { SEASON } from "@/config/season";
import { achievements as achievementDefs, specialCards } from "@/data";
import { COSMETICS, type CosmeticKind } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { MAX_BADGES, resolveEquipped, unseenOwnedIds } from "@/engine/cosmetics";
import { rankForXp } from "@/engine/progression";
import type { Placement, RunHistoryEntry } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { sfx } from "@/lib/sfx";
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
import { Toggle } from "@/components/ui/Toggle";
import { FieldView } from "@/components/cards/FieldView";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AccountSection, ProfileNickname } from "@/components/AccountSection";
import { AvatarMark, BadgeEmblem, BannerSurface, CosmeticIcon, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { CosmeticsLockerModal } from "@/components/cosmetics/CosmeticsLocker";
import { SeasonRecap } from "@/components/screens/SeasonRecap";

export default function ProfilePage() {
  const { PROFILE_UI: P, DIFFICULTY_LABELS, LEADERBOARDS_UI: L, SEASON_RECAP: R, COSMETICS: CC } = useCopy();
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
  const [locker, setLocker] = useState<CosmeticKind | null>(null);
  const cosmeticCopy = useCosmeticCopy();

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />;
  }

  const signedIn = accountStatus === "signedIn";
  const rank = rankForXp(profile.xp);
  const shown = resolveEquipped(profile.cosmetics);
  const unseen = unseenOwnedIds(profile.cosmetics).length;
  const unlockedCount = Object.keys(profile.unlockedSpecials).length;
  const earned = profile.achievements;
  const lastDelta = profile.season.ratingHistory[0]?.delta ?? null;
  const openLocker = (kind: CosmeticKind) => {
    sfx.click();
    setLocker(kind);
  };

  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : P.none);

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={P.career}
        title={P.title}
        right={
          <button
            type="button"
            onClick={() => openLocker("avatar")}
            className="display relative inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white/5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-orange/50"
          >
            <LockerGlyph /> {P.openLocker}
            {unseen > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-good px-1.5 text-[10px] font-bold text-[#05140c]">{unseen}</span>
            ) : null}
          </button>
        }
        className="mb-5"
      />

      {/* ---- HERO ------------------------------------------------------------ */}
      <BannerSurface
        banner={shown.banner}
        className="mb-6 overflow-hidden rounded-2xl border border-line-strong"
        plainClassName="panel-strong panel-glow-blue"
      >
        <div className={cx("relative p-5 sm:p-6", shown.banner && "bg-gradient-to-r from-black/55 via-black/35 to-black/55")}>
          <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:gap-7">
            {/* avatar + frame */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => openLocker(shown.frame ? "frame" : "avatar")}
                className="group relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-orange/70"
                title={P.editAvatar}
              >
                <AvatarMark avatar={shown.avatar} frame={shown.frame} size="xl" />
                <span className="absolute -bottom-1 -right-1 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-raised text-sub shadow-lg transition-colors group-hover:border-orange/60 group-hover:text-orange-bright">
                  <PencilGlyph />
                </span>
              </button>
              <div className="flex gap-1.5">
                <SlotLink onClick={() => openLocker("avatar")}>{CC.kinds.avatar}</SlotLink>
                <span className="text-faint">·</span>
                <SlotLink onClick={() => openLocker("frame")}>{CC.kinds.frame}</SlotLink>
              </div>
            </div>

            {/* identity */}
            <div className="min-w-0 flex-1 text-center md:text-left">
              {signedIn ? (
                <ProfileNickname />
              ) : (
                <p className="display truncate text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{P.guest}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                {shown.title ? (
                  <button type="button" onClick={() => openLocker("title")} title={P.editTitle} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-orange/70">
                    <TitleTag title={shown.title} size="md" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openLocker("title")}
                    className="display rounded-md border border-dashed border-line-strong px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-faint transition-colors hover:border-orange/50 hover:text-sub"
                  >
                    + {P.editTitle}
                  </button>
                )}
              </div>
              {/* badge slots */}
              <div className="mt-4 flex items-center justify-center gap-3 md:justify-start">
                {Array.from({ length: MAX_BADGES }).map((_, i) => {
                  const b = shown.badges[i];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openLocker("badge")}
                      title={b ? cosmeticCopy.name(b.id) : P.addBadge}
                      className={cx(
                        "flex h-16 w-16 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange/70",
                        b ? "bg-black/25 hover:bg-black/40" : "border border-dashed border-line-strong text-faint hover:border-orange/50 hover:text-sub",
                      )}
                    >
                      {b ? <BadgeEmblem badge={b} size="md" /> : <span className="text-xl leading-none">+</span>}
                    </button>
                  );
                })}
              </div>
              {signedIn && accountEmail ? <p className="mt-3 truncate text-xs text-faint">{accountEmail}</p> : null}
              {!signedIn ? <p className="mt-3 text-xs text-faint">{P.guestHint}</p> : null}
            </div>

            {/* rank + rating */}
            <div className="flex shrink-0 flex-col items-center gap-1 md:items-end">
              <RankBadge rank={rank} variant="menu" size="md" />
              <p className="display text-sm font-bold uppercase tracking-wide text-ink">{rank.label}</p>
              <p className="kicker mt-2 !text-[10px]">{P.seasonRating}</p>
              <p className="display whitespace-nowrap text-[2.1rem] font-bold leading-none text-orange-bright">
                {profile.mmr}
                {lastDelta !== null && lastDelta !== 0 ? (
                  <span className={cx("ml-2 text-sm font-bold", lastDelta > 0 ? "text-good" : "text-bad")}>
                    {lastDelta > 0 ? "+" : ""}
                    {lastDelta}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {/* XP bar + hero actions */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
              <p className="mt-1.5 text-[11px] text-sub">
                {profile.xp} {P.xp}
                {rank.next ? <span className="text-faint"> · {P.toNext(rank.xpToNext)}</span> : <span className="text-faint"> · {P.maxRank}</span>}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              {signedIn ? (
                <button
                  type="button"
                  onClick={accountSignOut}
                  className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {L.signOut}
                </button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => openLocker("banner")}>
                {P.editBanner}
              </Button>
            </div>
          </div>
        </div>
      </BannerSurface>

      <AccountSection />

      {/* ---- Season ------------------------------------------------------------ */}
      <SectionTitle title={SEASON.name} className="mb-4" />
      <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Panel className="p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="kicker !text-[10px]">{P.seasonTrack}</p>
            <p className="text-[11px] text-faint">{P.seasonTrackHint}</p>
          </div>
          <SeasonTrackBar peakRankId={profile.season.peakRankId} owned={profile.cosmetics.owned} />
        </Panel>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <StatTile label={P.seasonRating} value={String(profile.mmr)} accent />
          <StatTile label={P.peakRating} value={String(Math.max(profile.season.peakMmr, profile.mmr))} />
          <StatTile label={P.seasonRuns} value={String(profile.season.runs)} />
          <StatTile label={P.seasonTitles} value={String(profile.season.titles)} />
          <Panel className="col-span-2 p-3">
            <p className="kicker mb-1 !text-[10px]">{P.ratingHistory}</p>
            {profile.season.ratingHistory.length < 2 ? (
              <p className="text-xs text-faint">{P.ratingHistoryEmpty}</p>
            ) : (
              <RatingSparkline history={profile.season.ratingHistory} />
            )}
          </Panel>
        </div>
      </div>

      {/* ---- Lifetime ---------------------------------------------------------- */}
      <SectionTitle title={P.lifetime} className="mb-4" />
      <div className="mb-3 grid grid-cols-3 gap-3">
        <HeroStat label={P.runs} value={String(profile.runsCompleted)} />
        <HeroStat label={P.titles} value={String(titles)} tone="gold" />
        <HeroStat label={P.titleRate} value={pct(titles, profile.runsCompleted)} tone="blue" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.bestClear} value={bestClear ? DIFFICULTY_LABELS[bestClear].label : P.none} />
        <StatTile label={P.specials} value={`${unlockedCount}/${specialCards.length}`} />
        <StatTile label={P.playoffRate} value={pct(profile.playoffAppearances, profile.runsCompleted)} />
        <StatTile label={P.achievements} value={`${Object.keys(earned).length}/${achievementDefs.length}`} />
      </div>
      <Panel className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <MiniStat label={P.podiums} value={String(profile.podiums)} />
        <MiniStat label={P.swissWins} value={String(profile.swissWinsTotal)} />
        <MiniStat label={P.gamesWon} value={String(profile.gamesWon)} />
        <MiniStat label={P.goals} value={String(profile.goalsScored)} />
        <MiniStat label={P.lifetimeXp} value={String(profile.lifetime.xp)} />
        <MiniStat label={P.quizSolved} value={String(profile.quiz.solved)} />
        <MiniStat label={P.missionsDone} value={String(profile.missions.completedTotal)} />
        <MiniStat label={P.loginBest} value={String(profile.login.best)} />
        <MiniStat
          label={P.winsBy}
          value={(["easy", "normal", "hard", "legacy"] as const).map((d) => `${DIFFICULTY_LABELS[d].label.slice(0, 1)} ${profile.wins[d]}`).join(" · ")}
        />
      </Panel>
      {profile.legacy.preseason ? (
        <div className="mb-8 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setReplayRecap(true)}>
            {R.replay}
          </Button>
        </div>
      ) : (
        <div className="mb-8" />
      )}

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

      {/* ---- Preview tools (dev / staging only) ---------------------------------- */}
      {FEATURES.previewTools ? (
        <Panel className="mt-10 border-dashed p-4">
          <p className="kicker mb-2 !text-[10px]">{CC.previewTitle}</p>
          <Toggle checked={profile.previewUnlockAll} onChange={(on) => profile.setPreviewUnlockAll(on)} label={CC.previewUnlockAll} hint={CC.previewHint} />
        </Panel>
      ) : null}

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

      <CosmeticsLockerModal open={locker !== null} kind={locker ?? "avatar"} onClose={() => setLocker(null)} />

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

function SlotLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint transition-colors hover:text-orange-bright">
      {children}
    </button>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Panel className="p-3.5 text-center">
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 truncate text-2xl font-bold", accent ? "text-orange-bright" : "text-ink")}>{value}</p>
    </Panel>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone?: "gold" | "blue" }) {
  return (
    <Panel
      strong
      className={cx(
        "relative overflow-hidden p-4 text-center sm:p-5",
        tone === "gold" && "!border-amber-300/40",
        tone === "blue" && "!border-blue/40",
      )}
    >
      <div
        className={cx(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl",
          tone === "gold" ? "bg-amber-300/15" : tone === "blue" ? "bg-blue/15" : "bg-orange/15",
        )}
        aria-hidden
      />
      <p className="kicker !text-[10px]">{label}</p>
      <p className={cx("display mt-1 truncate text-4xl font-bold leading-none sm:text-5xl", tone === "gold" ? "text-amber-300" : tone === "blue" ? "text-blue-bright" : "text-orange-bright")}>
        {value}
      </p>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs">
      <span className="text-faint">{label}</span>
      <span className="display font-bold text-ink">{value}</span>
    </span>
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
  const h = 44;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => h - 5 - ((v - min) / span) * (h - 10);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div className="flex items-end gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-11 min-w-0 flex-1" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="1" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#rating-fill)" />
        <path d={d} fill="none" stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="shrink-0 text-right text-[10px] leading-tight text-faint">
        <p>
          {min}–{max}
        </p>
        {last ? (
          <p className={cx("font-semibold", last.delta > 0 ? "text-good" : last.delta < 0 ? "text-bad" : "text-sub")}>
            {last.delta > 0 ? "+" : ""}
            {last.delta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The Season 1 rank track as a horizontal progress bar: one node per rank with
 *  the reward art above it, lit once the rank is reached this season. */
function SeasonTrackBar({ peakRankId, owned }: { peakRankId: string; owned: Record<string, string> }) {
  const { PROFILE_UI: P } = useCopy();
  const copy = useCosmeticCopy();
  const track = COSMETICS.filter((c) => c.source.type === "season-rank" && c.source.seasonId === SEASON.id);
  const ranks = RANKS.filter((r) => r.id !== "unranked");
  const peakIdx = ranks.findIndex((r) => r.id === peakRankId);
  const progress = peakIdx < 0 ? 0 : (peakIdx + 0.5) / ranks.length;
  const next = ranks[peakIdx + 1] ?? null;
  return (
    <div>
      <div className="relative">
        <div className="absolute left-[6%] right-[6%] top-[4.5rem] h-1.5 rounded-full bg-white/8" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-orange to-amber-300 transition-[width] duration-700" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${ranks.length}, minmax(0, 1fr))` }}>
          {ranks.map((rank, i) => {
            const reached = i <= peakIdx;
            const rewards = track.filter((c) => c.source.type === "season-rank" && c.source.rankId === rank.id);
            return (
              <li key={rank.id} className={cx("flex flex-col items-center", !reached && "opacity-55")}>
                <div className="flex h-14 flex-wrap items-end justify-center gap-0.5" title={rewards.map((c) => `${copy.kind(c.kind)} · ${copy.name(c.id)}`).join("\n")}>
                  {rewards.map((c) => (
                    <span key={c.id} className={cx("flex items-center justify-center", owned[c.id] ? "" : "saturate-50")}>
                      <CosmeticIcon def={c} />
                    </span>
                  ))}
                </div>
                <span
                  className={cx(
                    "relative z-10 mt-2 flex h-5 w-5 items-center justify-center rounded-full border-2",
                    reached ? "border-amber-300 bg-amber-300 text-[#1a0d02]" : "border-line-strong bg-raised",
                  )}
                  aria-hidden
                >
                  {reached ? <span className="text-[10px] font-bold">✓</span> : null}
                </span>
                <RankBadge rank={rank} variant="menu" size="sm" className="mt-1 !h-8 !w-8" />
                <span className="hidden text-center text-[9px] font-semibold uppercase tracking-wider text-faint sm:block">{rank.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-2 text-center text-[11px] text-sub">{next ? P.seasonTrackNext(next.label) : P.seasonTrackDone}</p>
    </div>
  );
}

function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  );
}

function LockerGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 3v18M8 8h1M15 8h1M8 12h1M15 12h1" />
    </svg>
  );
}
