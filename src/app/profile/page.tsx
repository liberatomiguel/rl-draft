"use client";

/**
 * Profile v3 (rc.2): the screen that makes the player want the next reward.
 *  · HERO — the banner is the stage: name + title chip on the left; three
 *    badge slots beside the Season Rating on the right (rc.4: the first is
 *    FEATURED and drawn larger; rc.6 put them beside it), the rank emblem (menu
 *    art), Season Rating and the XP bar. Every cosmetic slot is tappable and
 *    opens the LOCKER MODAL on that kind; a green dot on a slot (and on the
 *    locker button) says something new is waiting there.
 *  · Season — the interactive rank-reward track (rc.20: paid on rank-up),
 *    the season numbers + rating sparkline under it, and the BADGE
 *    SHOWCASE beside it: owned badges, best first, with the rest in the locker.
 *  · Lifetime — three headline numbers, a secondary grid, then the rest as
 *    quiet chips.
 *  · Achievements + run history (as before), the pre-season recap replay,
 *    the dev/staging preview tools, and the danger zone.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useEffect, useRef, useState } from "react";
import { FEATURES, SEASON_RATING } from "@/config/balance";
import { SEASON } from "@/config/season";
import { COUNTS, isNationalSpecialId } from "@/data/counts";
import type { CosmeticKind } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { lockerItems, MAX_BADGES, resolveEquipped, unseenOfKind, unseenOwnedIds } from "@/engine/cosmetics";
import { rankForXp } from "@/engine/progression";
import type { Placement, RunHistoryEntry } from "@/engine/types";
import { cx, formatDate } from "@/lib/util";
import { sfx } from "@/lib/sfx";
import { useMounted } from "@/store/useMounted";
import { useAfterFirstPaint } from "@/lib/useAfterFirstPaint";
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
import { AchievementsGrid, achievementTotals } from "@/components/AchievementsGrid";
import { AccountSection, ConnectProviders, ProfileNickname } from "@/components/AccountSection";
import { BadgeEmblem, BannerSurface, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { CosmeticsLockerModal, NewDot } from "@/components/cosmetics/CosmeticsLocker";
import { SeasonRecap } from "@/components/screens/SeasonRecap";
import { SeasonRankTrack } from "@/components/cosmetics/SeasonRankTrack";

/** rc.5: hero badge boxes (px) — the featured one a step up. Layout, not gameplay. */
const HERO_FEATURED_PX = 56;
const HERO_BADGE_PX = 44;

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
  // v2.0 (P1): the achievements grid (half of this page's nodes, below the fold) mounts after the first paint.
  const gridReady = useAfterFirstPaint();

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />;
  }

  const signedIn = accountStatus === "signedIn";
  const rank = rankForXp(profile.xp);
  const shown = resolveEquipped(profile.cosmetics);
  const unseen = unseenOwnedIds(profile.cosmetics).length;
  const fresh = {
    title: unseenOfKind(profile.cosmetics, "title").length > 0,
    badge: unseenOfKind(profile.cosmetics, "badge").length > 0,
    banner: unseenOfKind(profile.cosmetics, "banner").length > 0,
  };
  // National-team cards (v2.0) have their own album — not in this count.
  const unlockedCount = Object.keys(profile.unlockedSpecials).filter((id) => !isNationalSpecialId(id)).length;
  const earned = profile.achievements;
  // rc.36 (UX-05): the draft set plus Road to Worlds' marks (the list's mode filter).
  const achTotals = achievementTotals(earned, profile.careerMarks);
  const lastDelta = profile.season.ratingHistory[0]?.delta ?? null;
  const openLocker = (kind: CosmeticKind) => {
    sfx.click();
    setLocker(kind);
  };

  // Playtest build: no cosmetics (locker, badges, title, banner) or season extras.
  const extras = !FEATURES.playtest;

  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : P.none);

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={P.career}
        title={P.title}
        right={
          extras ? (
          <button
            type="button"
            onClick={() => openLocker("title")}
            className="display relative inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white/5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-orange/50"
          >
            <LockerGlyph /> {P.openLocker}
            {unseen > 0 ? <NewDot className="absolute -right-1 -top-1 !h-2.5 !w-2.5" label={CC.newItems} /> : null}
          </button>
          ) : undefined
        }
        className="mb-5"
      />

      {/* ---- HERO (the v2 banner, with every cosmetic slot tappable) --------- */}
      <BannerSurface banner={extras ? shown.banner : null} glow className="mb-6 rounded-2xl border border-line-strong" plainClassName="panel-strong panel-glow-blue">
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:gap-6">
          <RankBadge rank={rank} variant="menu" size="lg" />

          <div className="w-full min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
                  {signedIn ? (
                    <ProfileNickname />
                  ) : (
                    <p className="display truncate text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{P.guest}</p>
                  )}
                {/* rc.23: the badges sit by the NAME, on the dark reading
                    zone of the banner (Miguel); the featured one leads. */}
                {extras ? (
                <div className="relative ml-1 flex shrink-0 items-center gap-1">
                  {shown.badges.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openLocker("badge")}
                      title={i === 0 ? `${CC.featured} · ${cosmeticCopy.name(b.id)}` : cosmeticCopy.name(b.id)}
                      className="flex shrink-0 items-center justify-center rounded-md outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange/70"
                    >
                      <BadgeEmblem badge={b} size={i === 0 ? HERO_FEATURED_PX : HERO_BADGE_PX} />
                    </button>
                  ))}
                  {shown.badges.length < MAX_BADGES ? (
                    <button
                      type="button"
                      onClick={() => openLocker("badge")}
                      title={P.addBadge}
                      className="flex items-center justify-center rounded-lg border border-dashed border-line-strong text-faint transition-colors hover:border-orange/50 hover:text-sub"
                      style={{ width: shown.badges.length === 0 ? HERO_FEATURED_PX : HERO_BADGE_PX, height: shown.badges.length === 0 ? HERO_FEATURED_PX : HERO_BADGE_PX }}
                    >
                      <span className="text-base leading-none">+</span>
                    </button>
                  ) : null}
                  {fresh.badge ? <NewDot className="absolute -right-1.5 -top-1" label={CC.newItems} /> : null}
                </div>
                ) : null}
                </div>
                {extras ? (
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="relative inline-flex">
                    {shown.title ? (
                      <button type="button" onClick={() => openLocker("title")} title={P.editTitle} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-orange/70">
                        <TitleTag title={shown.title} size="md" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openLocker("title")}
                        className="display rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint transition-colors hover:border-orange/50 hover:text-sub"
                      >
                        + {P.editTitle}
                      </button>
                    )}
                    {fresh.title ? <NewDot className="absolute -right-1 -top-1" label={CC.newItems} /> : null}
                  </span>
                </div>
                ) : null}
                {signedIn && accountEmail ? <p className="mt-1.5 truncate text-xs text-faint">{accountEmail}</p> : null}
                {!signedIn ? <p className="mt-1.5 text-xs text-faint">{P.guestHint}</p> : null}
              </div>
              <div className="flex shrink-0 items-center justify-center gap-4 sm:gap-5">
                <div className="text-center sm:text-right">
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
            </div>

            <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {signedIn ? (
                  <button
                    type="button"
                    onClick={accountSignOut}
                    className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    {L.signOut}
                  </button>
                ) : null}
                {signedIn ? (
                  <ConnectProviders className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline" />
                ) : null}
                {extras ? (
                <button
                  type="button"
                  onClick={() => openLocker("banner")}
                  className="relative text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {P.editBanner}
                  {fresh.banner ? <NewDot className="absolute -right-2.5 -top-1" label={CC.newItems} /> : null}
                </button>
                ) : null}
              </span>
              <p className="text-xs text-sub">
                {profile.xp} {P.xp}
                {rank.next ? <span className="text-faint"> · {P.toNext(rank.xpToNext)}</span> : <span className="text-faint"> · {P.maxRank}</span>}
              </p>
            </div>
          </div>
        </div>
      </BannerSurface>

      <AccountSection />

      {/* ---- Season ------------------------------------------------------------ */}
      {extras ? (
      <>
      <SectionTitle title={SEASON.name} className="mb-4" />
      <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="kicker !text-[10px]">{P.seasonTrack}</p>
              <p className="text-[11px] text-faint">{P.seasonTrackHint}</p>
            </div>
            <SeasonRankTrack xp={profile.xp} peakRankId={profile.season.peakRankId} />
          </Panel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={P.seasonRating} value={String(profile.mmr)} accent />
            <StatTile label={P.peakRating} value={String(Math.max(profile.season.peakMmr, profile.mmr))} />
            <StatTile label={P.seasonRuns} value={String(profile.season.runs)} />
            <StatTile label={P.seasonTitles} value={String(profile.season.titles)} />
          </div>
          <Panel className="p-3">
            <p className="kicker mb-1 !text-[10px]">{P.ratingHistory}</p>
            {profile.season.ratingHistory.length < 2 ? (
              <p className="text-xs text-faint">{P.ratingHistoryEmpty}</p>
            ) : (
              <RatingSparkline history={profile.season.ratingHistory} />
            )}
          </Panel>
        </div>
        <div className="relative lg:col-span-2">
          <BadgeShowcase owned={profile.cosmetics.owned} onOpen={() => openLocker("badge")} className="h-80 lg:absolute lg:inset-0 lg:h-auto" />
        </div>
      </div>
      </>
      ) : null}

      {/* ---- Lifetime ---------------------------------------------------------- */}
      <SectionTitle title={P.lifetime} className="mb-4" />
      <div className="mb-3 grid grid-cols-3 gap-3">
        <HeroStat label={P.runs} value={String(profile.runsCompleted)} />
        <HeroStat label={P.titles} value={String(titles)} tone="gold" />
        <HeroStat label={P.titleRate} value={pct(titles, profile.runsCompleted)} tone="blue" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={P.bestClear} value={bestClear ? DIFFICULTY_LABELS[bestClear].label : P.none} />
        <StatTile label={P.specials} value={`${unlockedCount}/${COUNTS.specialCards}`} />
        <StatTile label={P.playoffRate} value={pct(profile.playoffAppearances, profile.runsCompleted)} />
        <StatTile label={P.achievements} value={`${achTotals.earned}/${achTotals.total}`} />
      </div>
      <Panel className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <MiniStat label={P.podiums} value={String(profile.podiums)} />
        <MiniStat label={P.swissWins} value={String(profile.swissWinsTotal)} />
        <MiniStat label={P.gamesWon} value={String(profile.gamesWon)} />
        <MiniStat label={P.goals} value={String(profile.goalsScored)} />
        <MiniStat label={P.lifetimeXp} value={String(profile.lifetime.xp)} />
        {extras ? (
          <>
            <MiniStat label={P.quizSolved} value={String(profile.quiz.solved)} />
            <MiniStat label={P.missionsDone} value={String(profile.missions.completedTotal)} />
            <MiniStat label={P.loginBest} value={String(profile.login.best)} />
          </>
        ) : null}
        <MiniStat
          label={P.winsBy}
          value={(["easy", "normal", "hard", "legacy"] as const).map((d) => `${DIFFICULTY_LABELS[d].label.slice(0, 1)} ${profile.wins[d]}`).join(" · ")}
        />
      </Panel>
      {extras && profile.legacy.preseason ? (
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
              {P.viewAll(achTotals.earned, achTotals.total)}
            </Badge>
          </AppLink>
        }
        className="mb-4"
      />
      <div className="mb-8">
        {gridReady ? (
          <AchievementsGrid earned={earned} careerMarks={profile.careerMarks} />
        ) : (
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" aria-busy />
        )}
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

      <CosmeticsLockerModal open={locker !== null} kind={locker ?? "title"} onClose={() => setLocker(null)} />

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
  const h = 80;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => h - 5 - ((v - min) / span) * (h - 10);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div className="flex items-end gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 min-w-0 flex-1" preserveAspectRatio="none" aria-hidden>
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

/** Fit complete rows beside the season/rating column; the locker holds the rest. */
function BadgeShowcase({ owned, onOpen, className }: { owned: Record<string, string>; onOpen: () => void; className?: string }) {
  const { PROFILE_UI: P } = useCopy();
  const copy = useCosmeticCopy();
  const { owned: badges, locked } = lockerItems(owned, "badge");
  const total = badges.length + locked.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(12);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const grid = viewport.firstElementChild;
      if (!grid) return;
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(/\s+/).length;
      const row = parseFloat(style.gridAutoRows);
      const gap = parseFloat(style.rowGap) || 0;
      if (row > 0) setCapacity(Math.max(0, Math.floor((viewport.clientHeight + gap) / (row + gap))) * columns);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [badges.length]);
  const shown = badges.slice(0, capacity);
  const more = badges.length - shown.length;
  return (
    <Panel className={cx("flex min-h-0 flex-col p-4", className)}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <p className="kicker !text-[10px]">{P.showcaseTitle}</p>
        <span className="display text-xs font-bold text-sub">
          {badges.length}
          <span className="text-faint">/{total}</span>
        </span>
      </div>
      {badges.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs leading-relaxed text-faint">{P.showcaseEmpty}</p>
      ) : (
        <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden">
          <div className="grid auto-rows-[64px] grid-cols-3 content-start gap-2 sm:grid-cols-4">
          {shown.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={onOpen}
              title={`${copy.name(b.id)} · ${copy.tier(b.tier)}`}
              className="flex items-center justify-center rounded-lg outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-orange/70"
            >
              <BadgeEmblem badge={b} size={52} sparkles={false} />
            </button>
          ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="mt-3 shrink-0 self-center text-[11px] font-semibold uppercase tracking-wider text-sub underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        {more > 0 ? P.showcaseMore(more) : P.openLocker} →
      </button>
    </Panel>
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
