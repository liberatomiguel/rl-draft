"use client";

/**
 * Profile v3 (rc.2): the screen that makes the player want the next reward.
 *  · HERO — the banner is the stage: name + title chip on the left; three
 *    badge slots beside the Season Rating on the right (rc.4: the first is
 *    FEATURED and drawn larger; rc.6 put them beside it), the rank emblem (menu
 *    art), Season Rating and the XP bar. Every cosmetic slot is tappable and
 *    opens the LOCKER MODAL on that kind; a green dot on a slot (and on the
 *    locker button) says something new is waiting there.
 *  · Season — the rank track (rank rewards only come at the season's turnover,
 *    rc.6), the season numbers + rating sparkline under it, and the BADGE
 *    SHOWCASE beside it: every badge the player owns, best first.
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
import type { CosmeticKind } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { lockerItems, MAX_BADGES, resolveEquipped, unseenOfKind, unseenOwnedIds } from "@/engine/cosmetics";
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
import { BadgeEmblem, BannerSurface, TitleTag, useCosmeticCopy } from "@/components/cosmetics/CosmeticViews";
import { CosmeticsLockerModal, NewDot } from "@/components/cosmetics/CosmeticsLocker";
import { SeasonRecap } from "@/components/screens/SeasonRecap";

/** rc.5: hero badge boxes (px) — the featured one a step up. Layout, not gameplay. */
const HERO_FEATURED_PX = 72;
const HERO_BADGE_PX = 56;

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
  const fresh = {
    title: unseenOfKind(profile.cosmetics, "title").length > 0,
    badge: unseenOfKind(profile.cosmetics, "badge").length > 0,
    banner: unseenOfKind(profile.cosmetics, "banner").length > 0,
  };
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
            onClick={() => openLocker("title")}
            className="display relative inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white/5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-orange/50"
          >
            <LockerGlyph /> {P.openLocker}
            {unseen > 0 ? <NewDot className="absolute -right-1 -top-1 !h-2.5 !w-2.5" label={CC.newItems} /> : null}
          </button>
        }
        className="mb-5"
      />

      {/* ---- HERO (the v2 banner, with every cosmetic slot tappable) --------- */}
      <BannerSurface banner={shown.banner} glow className="mb-6 rounded-2xl border border-line-strong" plainClassName="panel-strong panel-glow-blue">
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:gap-6">
          <RankBadge rank={rank} variant="menu" size="lg" />

          <div className="w-full min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {signedIn ? (
                  <ProfileNickname />
                ) : (
                  <p className="display truncate text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{P.guest}</p>
                )}
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
                {signedIn && accountEmail ? <p className="mt-1.5 truncate text-xs text-faint">{accountEmail}</p> : null}
                {!signedIn ? <p className="mt-1.5 text-xs text-faint">{P.guestHint}</p> : null}
              </div>
              <div className="flex shrink-0 items-center justify-center gap-4 sm:gap-5">
                {/* rc.6: the badges sit beside the rating (rc.5 had them above,
                    which left a gap over the name) — the featured one leads
                    and is the largest; an open slot invites the next. */}
                <div className="relative flex items-end gap-1.5">
                  {shown.badges.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openLocker("badge")}
                      title={i === 0 ? `${CC.featured} · ${cosmeticCopy.name(b.id)}` : cosmeticCopy.name(b.id)}
                      className="rounded-md outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-orange/70"
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
              <span className="flex items-center gap-3">
                {signedIn ? (
                  <button
                    type="button"
                    onClick={accountSignOut}
                    className="text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    {L.signOut}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openLocker("banner")}
                  className="relative text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {P.editBanner}
                  {fresh.banner ? <NewDot className="absolute -right-2.5 -top-1" label={CC.newItems} /> : null}
                </button>
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
      <SectionTitle title={SEASON.name} className="mb-4" />
      <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="kicker !text-[10px]">{P.seasonTrack}</p>
              <p className="text-[11px] text-faint">{P.seasonTrackHint}</p>
            </div>
            <SeasonTrackBar xp={profile.xp} peakRankId={profile.season.peakRankId} />
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
        <BadgeShowcase owned={profile.cosmetics.owned} onOpen={() => openLocker("badge")} className="lg:col-span-2" />
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

/** The season's rank track: every rank emblem, and a progress bar that follows
 *  the player's XP toward the next one. rc.6: no per-rank rewards — rank and
 *  rating rewards are handed out when the season turns over. */
function SeasonTrackBar({ xp, peakRankId }: { xp: number; peakRankId: string }) {
  const { PROFILE_UI: P } = useCopy();
  const ranks = RANKS.filter((r) => r.id !== "unranked");
  const peakIdx = ranks.findIndex((r) => r.id === peakRankId);
  const now = rankForXp(xp);
  const nowIdx = ranks.findIndex((r) => r.id === now.id);
  // Node i sits at the centre of column i; the fill reaches the current rank's
  // node plus the XP progress toward the next one.
  const nodeCenter = (i: number) => ((i + 0.5) / ranks.length) * 100;
  const fill = nowIdx < 0 ? Math.max(0, now.progress * nodeCenter(0)) : nowIdx >= ranks.length - 1 ? 100 : nodeCenter(nowIdx) + now.progress * (nodeCenter(nowIdx + 1) - nodeCenter(nowIdx));
  const next = ranks[Math.max(peakIdx, nowIdx) + 1] ?? null;
  return (
    <div>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${ranks.length}, minmax(0, 1fr))` }}>
        {ranks.map((rank, i) => (
          <li key={rank.id} className={cx("flex flex-col items-center", i > peakIdx && "opacity-55")}>
            <RankBadge rank={rank} variant="menu" size="sm" className="!h-9 !w-9" />
            <span className="mt-0.5 hidden text-center text-[9px] font-semibold uppercase tracking-wider text-faint sm:block">{rank.label}</span>
          </li>
        ))}
      </ol>
      <div className="relative my-2 h-1.5 w-full rounded-full bg-white/8" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-orange to-amber-300 transition-[width] duration-700" style={{ width: `${Math.min(100, fill)}%` }} />
        {ranks.map((rank, i) => (
          <span
            key={rank.id}
            className={cx("absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", i <= peakIdx ? "border-amber-300 bg-amber-300" : "border-line-strong bg-raised")}
            style={{ left: `${nodeCenter(i)}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-sub">{next ? P.seasonTrackNext(next.label) : P.seasonTrackDone}</p>
    </div>
  );
}

/** Max badges the showcase draws before a "+N" tile (layout, not gameplay). */
const SHOWCASE_MAX = 15;

/** rc.6: the locker on display — every badge the player owns, best first
 *  (rarity, then family), with their effects. Tapping opens the locker. */
function BadgeShowcase({ owned, onOpen, className }: { owned: Record<string, string>; onOpen: () => void; className?: string }) {
  const { PROFILE_UI: P } = useCopy();
  const copy = useCosmeticCopy();
  const { owned: badges, locked } = lockerItems(owned, "badge");
  const total = badges.length + locked.length;
  const shown = badges.slice(0, SHOWCASE_MAX);
  const more = badges.length - shown.length;
  return (
    <Panel className={cx("flex flex-col p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker !text-[10px]">{P.showcaseTitle}</p>
        <span className="display text-xs font-bold text-sub">
          {badges.length}
          <span className="text-faint">/{total}</span>
        </span>
      </div>
      {badges.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs leading-relaxed text-faint">{P.showcaseEmpty}</p>
      ) : (
        <div className="grid flex-1 grid-cols-4 content-start gap-x-2 gap-y-3 sm:grid-cols-5">
          {shown.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={onOpen}
              title={`${copy.name(b.id)} · ${copy.tier(b.tier)}`}
              className="flex items-center justify-center rounded-lg py-1 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-orange/70"
            >
              <BadgeEmblem badge={b} size={52} />
            </button>
          ))}
          {more > 0 ? (
            <button
              type="button"
              onClick={onOpen}
              className="display mx-auto flex h-[52px] w-[52px] items-center justify-center self-center rounded-full border border-dashed border-line-strong text-sm font-bold text-sub transition-colors hover:border-orange/50 hover:text-ink"
            >
              +{more}
            </button>
          ) : null}
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 self-center text-[11px] font-semibold uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        {P.openLocker} →
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
