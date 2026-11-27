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
 *  · Lifetime — three headline figures between hairlines, then every other
 *    number as a row of a plain list (no boxes).
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
import { PhoneFold } from "@/components/ui/PhoneFold";
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

/** The quiet text actions under the rank bar (sign out, connect, change banner). */
const HERO_LINK = "text-xs text-sub underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline";

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

  // Job: the player's season at a glance. The one decision: which rank reward
  // to chase next (and what to wear from the locker). So the banner with the
  // rating leads, the season track is the strong board, and the lifetime
  // numbers, feats and run history read below it as plain strips and lists.
  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        title={P.title}
        right={
          extras ? (
          <Button variant="secondary" size="sm" onClick={() => openLocker("title")} className="relative">
            <LockerGlyph /> {P.openLocker}
            {unseen > 0 ? <NewDot className="absolute -right-1 -top-1 !h-2.5 !w-2.5" label={CC.newItems} /> : null}
          </Button>
          ) : undefined
        }
        className="mb-5"
      />

      {/* ---- HERO (the v2 banner, with every cosmetic slot tappable) --------- */}
      <BannerSurface banner={extras ? shown.banner : null} glow className="mb-6 rounded-xl border border-line-strong" plainClassName="panel-strong">
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
                        className="display rounded-md border border-dashed border-line-strong px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-faint transition-colors hover:border-orange/50 hover:text-sub"
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
              {/* The season rating stands straight on the banner, under the rank's name. */}
              <div className="flex shrink-0 justify-center">
                <div className="text-center [text-shadow:0_1px_10px_rgb(0_0_0/0.65)] sm:text-right">
                  <p className="display whitespace-nowrap text-sm font-bold uppercase leading-none tracking-[0.04em] text-ink">{rank.label}</p>
                  <p className="display mt-1.5 whitespace-nowrap text-5xl font-extrabold leading-[0.9] tabular-nums text-ink">
                    {lastDelta !== null && lastDelta !== 0 ? (
                      <span className={cx("mr-2 text-sm font-bold", lastDelta > 0 ? "text-good" : "text-bad")}>
                        {lastDelta > 0 ? "+" : ""}
                        {lastDelta}
                      </span>
                    ) : null}
                    {profile.mmr}
                  </p>
                  <p className="display mt-1.5 whitespace-nowrap text-xs font-semibold uppercase leading-none tracking-[0.04em] text-sub">{P.seasonRating}</p>
                </div>
              </div>
            </div>

            <ProgressBar value={rank.progress} tone="orange" label={P.rank} />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {signedIn ? (
                  <button
                    type="button"
                    onClick={accountSignOut}
                    className={HERO_LINK}
                  >
                    {L.signOut}
                  </button>
                ) : null}
                {signedIn ? (
                  <ConnectProviders className={HERO_LINK} />
                ) : null}
                {extras ? (
                <button
                  type="button"
                  onClick={() => openLocker("banner")}
                  className={cx("relative", HERO_LINK)}
                >
                  {P.editBanner}
                  {fresh.banner ? <NewDot className="absolute -right-2.5 -top-1" label={CC.newItems} /> : null}
                </button>
                ) : null}
              </span>
              <p className="text-xs text-sub">
                <span className="display mr-2 text-sm font-bold uppercase text-ink">{rank.label}</span>
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
      {/* The track is the strong board (the thing to chase). The season's four
          numbers and the rating line are ONE board under it: a strip of
          figures, then the sparkline below a hairline. */}
      <SectionTitle title={SEASON.name} className="mb-4" />
      <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {/* Phone: the eight-rank ladder (900px) opens on demand. The banner at the
              top already says the rank and how far the next one is. */}
          <PhoneFold label={P.seasonTrack}>
            <Panel strong className="p-4 sm:p-5">
              <h3 className="phone-fold-head card-title mb-4">{P.seasonTrack}</h3>
              <SeasonRankTrack xp={profile.xp} peakRankId={profile.season.peakRankId} />
            </Panel>
          </PhoneFold>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              <Figure label={P.seasonRating} value={String(profile.mmr)} />
              <Figure label={P.peakRating} value={String(Math.max(profile.season.peakMmr, profile.mmr))} />
              <Figure label={P.seasonRuns} value={String(profile.season.runs)} />
              <Figure label={P.seasonTitles} value={String(profile.season.titles)} tone="gold" />
            </div>
            <div className="border-t border-line bg-surface p-4">
              <h3 className="display mb-2 text-sm uppercase leading-none text-sub">{P.ratingHistory}</h3>
              {profile.season.ratingHistory.length < 2 ? (
                <p className="text-sm text-sub">{P.ratingHistoryEmpty}</p>
              ) : (
                <RatingSparkline history={profile.season.ratingHistory} />
              )}
            </div>
          </div>
        </div>
        <div className="relative lg:col-span-2">
          <BadgeShowcase owned={profile.cosmetics.owned} onOpen={() => openLocker("badge")} className="h-80 lg:absolute lg:inset-0 lg:h-auto" />
        </div>
      </div>
      </>
      ) : null}

      {/* ---- Lifetime ---------------------------------------------------------- */}
      {/* No boxes here: three headline figures between two hairlines, then
          every other number as a row of a plain list. */}
      <SectionTitle title={P.lifetime} className="mb-4" />
      <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
        <Headline label={P.runs} value={String(profile.runsCompleted)} />
        <Headline label={P.titles} value={String(titles)} tone="gold" />
        <Headline label={P.titleRate} value={pct(titles, profile.runsCompleted)} />
      </div>
      <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        <StatRow label={P.bestClear} value={bestClear ? DIFFICULTY_LABELS[bestClear].label : P.none} />
        <StatRow label={P.specials} value={`${unlockedCount}/${COUNTS.specialCards}`} />
        <StatRow label={P.playoffRate} value={pct(profile.playoffAppearances, profile.runsCompleted)} />
        <StatRow label={P.achievements} value={`${achTotals.earned}/${achTotals.total}`} />
        <StatRow label={P.podiums} value={String(profile.podiums)} />
        <StatRow label={P.swissWins} value={String(profile.swissWinsTotal)} />
        <StatRow label={P.gamesWon} value={String(profile.gamesWon)} />
        <StatRow label={P.goals} value={String(profile.goalsScored)} />
        <StatRow label={P.lifetimeXp} value={String(profile.lifetime.xp)} />
        {extras ? (
          <>
            <StatRow label={P.quizSolved} value={String(profile.quiz.solved)} />
            <StatRow label={P.missionsDone} value={String(profile.missions.completedTotal)} />
            <StatRow label={P.loginBest} value={String(profile.login.best)} />
          </>
        ) : null}
        <StatRow
          label={P.winsBy}
          value={(["easy", "normal", "hard", "legacy"] as const).map((d) => `${DIFFICULTY_LABELS[d].label.slice(0, 1)} ${profile.wins[d]}`).join(" · ")}
        />
      </dl>
      {extras && profile.legacy.preseason ? (
        <div className="mb-12 mt-3 flex">
          <Button variant="ghost" size="sm" onClick={() => setReplayRecap(true)} className="-ml-3.5">
            {R.replay}
          </Button>
        </div>
      ) : (
        <div className="mb-12" />
      )}

      {/* ---- Achievements ------------------------------------------------------ */}
      <SectionTitle
        title={P.achievements}
        right={
          <AppLink href="/achievements" className="text-sm text-blue-bright underline-offset-2 hover:underline">
            {P.viewAll(achTotals.earned, achTotals.total)}
          </AppLink>
        }
        className="mb-4"
      />
      <div className="mb-12">
        {gridReady ? (
          <AchievementsGrid earned={earned} careerMarks={profile.careerMarks} />
        ) : (
          <div className="h-96 animate-pulse rounded-xl bg-white/5" aria-busy />
        )}
      </div>

      {/* ---- Run history ------------------------------------------------------ */}
      {/* A list, one hairline per run: result, record, roster, then the quiet
          facts (difficulty, hidden overall, XP, date) as text. */}
      <SectionTitle title={P.history} className="mb-4" />
      {profile.runHistory.length === 0 ? (
        <p className="border-y border-line py-8 text-center text-sm text-sub">{P.emptyHistory}</p>
      ) : (
        <ul className="border-t border-line">
          {profile.runHistory.slice(0, 10).map((run) => (
            <li key={run.runId}>
              <button
                type="button"
                onClick={() => setRecapRun(run)}
                aria-label={P.viewRun}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-1 py-3 text-left text-sm transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] sm:px-2"
              >
                <Badge tone={run.placement === "champion" ? "gold" : "neutral"} className="w-20 justify-center">
                  {P.placement[run.placement as Placement] ?? run.placement}
                </Badge>
                <span className="display text-base font-bold text-ink">
                  {run.swissRecord.wins}–{run.swissRecord.losses}
                </span>
                <span className="min-w-0 flex-1 basis-40 truncate text-sm text-sub">{run.rosterNames.join(" · ")}</span>
                <span className="text-xs text-sub">
                  {DIFFICULTY_LABELS[run.difficulty].label}
                  {run.hiddenOverall ? ` · ${P.hidden}` : ""}
                </span>
                <span className="display text-sm font-bold text-ink">+{run.xpGained} XP</span>
                <span className="text-xs text-faint">{formatDate(run.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Preview tools (dev / staging only) ---------------------------------- */}
      {FEATURES.previewTools ? (
        <Panel className="mt-10 border-dashed p-4">
          <h3 className="display mb-2 text-sm uppercase leading-none text-sub">{CC.previewTitle}</h3>
          <Toggle checked={profile.previewUnlockAll} onChange={(on) => profile.setPreviewUnlockAll(on)} label={CC.previewUnlockAll} hint={CC.previewHint} />
        </Panel>
      ) : null}

      {/* ---- Danger zone --------------------------------------------------------- */}
      <div className="mt-12 flex flex-wrap justify-center gap-3 border-t border-line pt-6">
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
            {/* The result is the one tag; the run's settings read as a line. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge tone={recapRun.placement === "champion" ? "gold" : "neutral"}>
                {P.placement[recapRun.placement as Placement] ?? recapRun.placement}
              </Badge>
              <span className="text-sm text-sub">
                {[DIFFICULTY_LABELS[recapRun.difficulty].label, recapRun.region, recapRun.hiddenOverall ? P.hidden : null].filter(Boolean).join(" · ")}
              </span>
              <span className="ml-auto text-xs text-faint">{formatDate(recapRun.date)}</span>
            </div>
            {recapRun.recap?.championName && recapRun.placement !== "champion" ? (
              <p className="text-sm text-sub">{P.wonBy(recapRun.recap.championName)}</p>
            ) : null}
            {recapRun.recap ? <FieldView roster={recapRun.recap.roster} showOverall showBench /> : <p className="text-sm text-sub">{P.olderRun}</p>}
            <dl className="grid grid-cols-1 gap-x-10 border-t border-line sm:grid-cols-2">
              <StatRow label={P.teamOverallLabel} value={String(recapRun.teamOverall)} />
              <StatRow label={P.swissWins} value={`${recapRun.swissRecord.wins}–${recapRun.swissRecord.losses}`} />
              {recapRun.recap ? <StatRow label={P.chemistry} value={recapRun.recap.chemistryTier} /> : null}
              {recapRun.recap ? <StatRow label={P.conceded} value={String(recapRun.recap.goalsConceded)} /> : null}
              <StatRow label={P.xp} value={`+${recapRun.xpGained}`} />
            </dl>
            {!recapRun.recap ? <p className="text-sm text-sub">{recapRun.rosterNames.join(" · ")}</p> : null}
          </div>
        ) : null}
      </Modal>

      {replayRecap ? <SeasonRecap force onClose={() => setReplayRecap(false)} /> : null}
    </div>
  );
}

/** A cell of a stat strip: the figure first, its quiet label under it. The
 *  strip's 1px gaps are the dividers (the Home's YOUR PROGRESS). Gold is kept
 *  for titles, the one reward among the numbers. */
function Figure({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="min-w-0 bg-surface p-4">
      <p className={cx("display truncate text-3xl font-bold leading-none", tone === "gold" ? "text-amber-300" : "text-ink")}>{value}</p>
      <p className="mt-1.5 text-xs text-sub">{label}</p>
    </div>
  );
}

/** A lifetime headline: a large figure on the floor, no box. */
function Headline({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="min-w-0 px-3 py-5 first:pl-0 sm:px-6">
      <p className={cx("display truncate text-4xl font-extrabold leading-none sm:text-5xl", tone === "gold" ? "text-amber-300" : "text-ink")}>{value}</p>
      <p className="mt-2 text-xs text-sub sm:text-sm">{label}</p>
    </div>
  );
}

/** One row of a plain stat list: label on the left, value on the right. */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="min-w-0 text-sm text-sub">{label}</dt>
      <dd className="display shrink-0 text-base font-bold text-ink">{value}</dd>
    </div>
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
        {/* A plain line: no gradient area under it. */}
        <path d={d} fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="shrink-0 text-right text-xs leading-tight text-faint">
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
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="display text-lg uppercase leading-none text-ink">{P.showcaseTitle}</h3>
        <span className="display text-lg font-bold leading-none text-ink">
          {badges.length}
          <span className="text-sm text-faint">/{total}</span>
        </span>
      </div>
      {badges.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm leading-relaxed text-sub">{P.showcaseEmpty}</p>
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
      <Button variant="ghost" size="sm" onClick={onOpen} aria-haspopup="dialog" className="mt-3 shrink-0 self-center">
        {more > 0 ? P.showcaseMore(more) : P.openLocker}
      </Button>
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
