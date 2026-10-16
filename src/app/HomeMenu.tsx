"use client";

/**
 * Home menu v2 (v2.0). The SEO surface is untouched on purpose (hero copy,
 * `HomeSeoContent`, metadata in page.tsx); only the menu is reorganised:
 *   1. Hero (as before) + the SEASON STRIP (rank · rating · week · streak).
 *   2. Featured: Classic Draft and Road to Worlds.
 *   3. More ways to play: Quick Draft, Daily Challenge, Challenges, Daily Quiz.
 *   4. Your progress: today's missions + Collection / Achievements / Profile /
 *      Leaderboards.
 * Returning to the menu RESETS any run in progress (v0.2 rule).
 * Player state is mount-gated with reserved heights (CLS), like v1.4.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { COUNTS } from "@/data/counts";
import { useCopy } from "@/content/copy";
import { localePath } from "@/content/pageRoutes";
import { useSettings } from "@/store/settingsStore";
import { FEATURES } from "@/config/balance";
import { SEASON, seasonDaysLeft, seasonWeek } from "@/config/season";
import { SITE } from "@/config/site";
import { sfx } from "@/lib/sfx";
import { rankForXp } from "@/engine/progression";
import { resolveEquipped } from "@/engine/cosmetics";
import { generateDailyConfig, todayKey } from "@/lib/daily";
import { useMounted } from "@/store/useMounted";
import { useAccountStore } from "@/store/accountStore";
import { selectChampionships, selectCollectionUnlocked, selectDailyStreak, useProfileStore } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { FirstRunTutorial } from "@/components/screens/FirstRunTutorial";
import { SeasonRecap } from "@/components/screens/SeasonRecap";
import { MissionsPanel } from "@/components/MissionsPanel";
import { BadgeRow, FrameRing, TitleTag } from "@/components/cosmetics/CosmeticViews";

export default function HomeMenu() {
  const { APP, HOME, HOME_SEO } = useCopy();
  const mounted = useMounted();
  const lang = useSettings((s) => s.lang);
  const active = mounted ? lang : "en";
  const router = useRouter();
  const xp = useProfileStore((s) => s.xp);
  const mmr = useProfileStore((s) => s.mmr);
  const runs = useProfileStore((s) => s.runsCompleted);
  const titles = useProfileStore(selectChampionships);
  const unlocked = useProfileStore((s) => Object.keys(s.unlockedSpecials).length);
  const achieved = useProfileStore((s) => Object.keys(s.achievements).length);
  const dailyResults = useProfileStore((s) => s.dailyResults);
  const streak = useProfileStore(selectDailyStreak);
  const loginStreak = useProfileStore((s) => s.login.streak);
  const cosmetics = useProfileStore((s) => s.cosmetics);
  const quizToday = useProfileStore((s) => s.quiz.results[todayKey()]);
  const collectionOpen = useProfileStore(selectCollectionUnlocked);
  const clearRun = useRunStore((s) => s.clearRun);
  const startDailyRun = useRunStore((s) => s.startDailyRun);
  const setSetupMode = useRunStore((s) => s.setSetupMode);
  const rank = rankForXp(xp);
  const shown = resolveEquipped(cosmetics);

  const goToSetup = (mode: "classic" | "quick") => {
    sfx.click();
    setSetupMode(mode);
    router.push("/play");
  };

  const today = todayKey();
  const daily = useMemo(() => generateDailyConfig(today), [today]);
  const dailyDone = mounted ? Boolean(dailyResults[today]) : false;
  const quizDone = mounted ? Boolean(quizToday && (quizToday.solved || quizToday.attempts >= 3)) : false;
  const daysLeft = seasonDaysLeft();

  useEffect(() => {
    if (mounted && useRunStore.getState().run) clearRun();
  }, [mounted, clearRun]);

  const seoLinks = [
    { label: HOME_SEO.links.play, href: "/play" },
    { label: HOME_SEO.links.howToPlay, href: "/how-to-play" },
    { label: HOME_SEO.links.ratings, href: localePath("ratings", active) },
    { label: HOME_SEO.links.specialCards, href: localePath("special-cards", active) },
    { label: HOME_SEO.links.strategy, href: localePath("strategy", active) },
    { label: HOME_SEO.links.sam, href: localePath("sam", active) },
    { label: HOME_SEO.links.faq, href: localePath("faq", active) },
    { label: HOME_SEO.links.about, href: localePath("about", active) },
  ];

  const locked = mounted && !collectionOpen && rank.id === "unranked";
  const careerOn = FEATURES.careerMode;

  return (
    <>
      <FirstRunTutorial />
      <SeasonRecap />
      {/* Hero — rendered OUTSIDE the rise-in wrapper so the LCP paints immediately. */}
      <section className="px-2 py-10 text-center md:py-14">
        <p className="kicker mb-4">{APP.tagline}</p>
        <h1 className="display mx-auto max-w-3xl text-5xl font-bold uppercase leading-[0.95] tracking-[0.08em] md:text-7xl">
          <span className="text-ink">Rocket</span>
          <span className="bg-gradient-to-r from-orange to-orange-bright bg-clip-text text-transparent">Draft</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-sub md:text-base">{APP.description}</p>

        {/* Season strip: reserved height, mount-gated (persisted state would mismatch SSR). */}
        <div className="mx-auto mt-7 flex min-h-[132px] max-w-2xl flex-col items-center gap-3">
          {mounted ? (
            <>
              <FrameRing frame={shown.frame} width={3}>
                <RankBadge rank={rank} variant="menu" size="md" />
              </FrameRing>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <TitleTag title={shown.title} size="xs" />
                <BadgeRow badges={shown.badges} size="xs" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <Badge tone="blue">{rank.label}</Badge>
                <Badge tone="orange">{HOME.seasonStrip.rating} {mmr}</Badge>
                <Badge tone="neutral">{xp} XP</Badge>
                {runs > 0 ? <Badge tone="neutral">{HOME.runs(runs)}</Badge> : null}
                {titles > 0 ? <Badge tone="gold">{HOME.titles(titles)}</Badge> : null}
                {loginStreak > 1 ? <Badge tone="good">{HOME.seasonStrip.streak} · {HOME.seasonStrip.days(loginStreak)}</Badge> : null}
              </div>
              <p className="text-[11px] text-faint">
                {SEASON.name} · {daysLeft > 0 ? `${HOME.seasonStrip.week(seasonWeek(), SEASON.weeks)} · ${HOME.seasonStrip.daysLeft(daysLeft)}` : ""}
              </p>
            </>
          ) : null}
        </div>
      </section>

      <div className="rise-in">
        {/* ---- Featured: Classic Draft + Road to Worlds ----------------------- */}
        <section aria-label="Game modes" className={cxGrid(careerOn)}>
          <button type="button" onClick={() => goToSetup("classic")} className="group text-left">
            <Panel
              strong
              glow="orange"
              className="relative flex h-full flex-col justify-between overflow-hidden !border-orange/40 p-6 transition-all group-hover:-translate-y-0.5 group-hover:!border-orange/70 md:p-8"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange/10 blur-3xl" aria-hidden />
              <div>
                <div className="mb-2 flex items-center gap-2.5">
                  <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">{HOME.playClassic}</h2>
                  <Badge tone="orange">{HOME.liveBadge}</Badge>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-sub">{HOME.playClassicDesc}</p>
              </div>
              <span className="display mt-6 inline-flex w-fit items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all group-hover:brightness-110">
                {HOME.playNow}
              </span>
            </Panel>
          </button>

          {careerOn ? (
            <AppLink href="/career" className="group block text-left">
              <Panel
                strong
                glow="blue"
                className="relative flex h-full flex-col justify-between overflow-hidden !border-blue/40 p-6 transition-all group-hover:-translate-y-0.5 group-hover:!border-blue/70 md:p-8"
              >
                <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue/10 blur-3xl" aria-hidden />
                <div>
                  <div className="mb-2 flex items-center gap-2.5">
                    <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">{HOME.careerTitle}</h2>
                    <Badge tone="blue">{HOME.careerBadge}</Badge>
                  </div>
                  <p className="max-w-sm text-sm leading-relaxed text-sub">{HOME.careerDesc}</p>
                </div>
                <span className="display mt-6 inline-flex w-fit items-center justify-center rounded-xl border border-blue/50 bg-blue/10 px-7 py-3 text-sm font-bold uppercase tracking-[0.14em] text-ink transition-all group-hover:bg-blue/20">
                  {HOME.careerCta}
                </span>
              </Panel>
            </AppLink>
          ) : (
            <button type="button" onClick={() => goToSetup("quick")} className="group text-left">
              <Panel className="flex h-full flex-col justify-center p-5 transition-all group-hover:!border-blue/50">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.quickDraft}</h3>
                  <Badge tone="blue">{HOME.liveBadge}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-sub">{HOME.quickDraftDesc}</p>
              </Panel>
            </button>
          )}
        </section>

        {/* ---- More ways to play ------------------------------------------------ */}
        <p className="kicker mb-2 mt-6">{HOME.moreModes}</p>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {careerOn ? (
            <button type="button" onClick={() => goToSetup("quick")} className="group text-left">
              <Panel className="flex h-full flex-col p-5 transition-all group-hover:!border-blue/50">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.quickDraft}</h3>
                  <Badge tone="blue">{HOME.liveBadge}</Badge>
                </div>
                <p className="text-xs leading-relaxed text-sub">{HOME.quickDraftDesc}</p>
              </Panel>
            </button>
          ) : null}

          <Panel className="flex h-full flex-col p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.daily}
                <span className="ml-2 text-sm text-faint">{mounted ? `#${daily.info.n}` : ""}</span>
              </h3>
              {mounted && streak > 0 ? <Badge tone="gold">{HOME.dailyStreak(streak)}</Badge> : <Badge tone="blue">{HOME.liveBadge}</Badge>}
            </div>
            <div className="min-h-[56px] flex-1">
              {mounted ? (
                <>
                  <p className="display text-sm font-bold uppercase tracking-wide text-orange-bright">{daily.info.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-sub">{daily.info.description}</p>
                </>
              ) : null}
            </div>
            {dailyDone ? (
              <div className="mt-3">
                {dailyResults[today]?.placement === "champion" ? (
                  <Badge tone="good">{HOME.dailyVictory} · +{dailyResults[today]?.xp} XP</Badge>
                ) : (
                  <Badge tone="bad">{HOME.dailyDefeat}</Badge>
                )}
                <p className="mt-2 text-[11px] text-faint">{HOME.dailyComeBack}</p>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-fit"
                onClick={() => {
                  startDailyRun();
                  router.push("/play");
                }}
              >
                {HOME.dailyPlay}
              </Button>
            )}
          </Panel>

          {locked ? (
            <div className="cursor-not-allowed" aria-disabled="true" title={HOME.challengesLocked}>
              <Panel className="flex h-full flex-col p-5 opacity-60">
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.challenges}</h3>
                <p className="mt-1 text-xs text-sub">{HOME.challengesLocked}</p>
              </Panel>
            </div>
          ) : (
            <AppLink href="/challenges" className="group">
              <Panel className="flex h-full flex-col p-5 transition-colors group-hover:!border-line-strong">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.challenges}</h3>
                  <span className="text-orange-bright" aria-hidden>
                    <MissionGlyph />
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-sub">{HOME.challengesDesc}</p>
              </Panel>
            </AppLink>
          )}

          <AppLink href="/quiz" className="group">
            <Panel className="flex h-full flex-col p-5 transition-colors group-hover:!border-violet-400/50">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.quiz}</h3>
                {quizDone ? (
                  <Badge tone={quizToday?.solved ? "good" : "neutral"}>{quizToday?.solved ? HOME.quizDone : HOME.quizMissed}</Badge>
                ) : (
                  <Badge tone="blue">{HOME.newBadge}</Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-sub">{HOME.quizDesc}</p>
              {!quizDone ? (
                <span className="display mt-3 text-xs font-bold uppercase tracking-[0.12em] text-violet-300">{HOME.quizPlay} →</span>
              ) : null}
            </Panel>
          </AppLink>
        </section>

        {/* ---- Your progress ------------------------------------------------------ */}
        <p className="kicker mb-2 mt-6">{HOME.yourProgress}</p>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <MissionsPanel compact />
          </div>
          <div className="grid grid-cols-2 gap-4 md:col-span-3">
            {locked ? (
              <div className="cursor-not-allowed" aria-disabled="true" title={HOME.collectionLocked}>
                <Panel className="flex h-full items-center justify-between gap-3 p-4 opacity-60">
                  <div>
                    <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{HOME.collection}</h3>
                    <p className="mt-1 text-xs text-sub">{HOME.collectionLocked}</p>
                  </div>
                  <span className="shrink-0 text-faint" aria-hidden>
                    <MenuLockGlyph />
                  </span>
                </Panel>
              </div>
            ) : (
              <Tile href="/collection" title={HOME.collection} desc={HOME.collectionDesc}>
                <span className="display shrink-0 text-2xl font-bold text-cyan">
                  {mounted ? unlocked : 0}
                  <span className="text-sm text-faint">/{COUNTS.specialCards}</span>
                </span>
              </Tile>
            )}
            <Tile href="/achievements" title={HOME.achievements} desc={HOME.achievementsDesc}>
              <span className="display shrink-0 text-2xl font-bold text-orange-bright">
                {mounted ? achieved : 0}
                <span className="text-sm text-faint">/{COUNTS.achievements}</span>
              </span>
            </Tile>
            <Tile href="/profile" title={HOME.profile} desc={HOME.profileDesc}>
              {mounted ? (
                <FrameRing frame={shown.frame} width={2}>
                  <RankBadge rank={rank} variant="menu" size="sm" />
                </FrameRing>
              ) : null}
            </Tile>
            <Tile href="/leaderboards" title={HOME.leaderboards} desc={HOME.leaderboardsDesc}>
              <span className="shrink-0 text-cyan" aria-hidden>
                <TrophyGlyph />
              </span>
            </Tile>
          </div>
        </section>

        <p className="mt-10 text-center">
          <AppLink href="/how-to-play" className="text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline">
            {HOME.howToPlay} →
          </AppLink>
        </p>

        <HomeSignInNudge />

        {SITE.discordUrl || SITE.supportUrl ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {SITE.discordUrl ? (
              <a
                href={SITE.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/3 px-3.5 py-1.5 text-xs font-semibold text-sub transition-colors hover:border-blue/50 hover:text-blue-bright"
              >
                <DiscordGlyph /> {HOME.joinDiscord}
              </a>
            ) : null}
            {SITE.authorUrl ? (
              <a
                href={SITE.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/3 px-3.5 py-1.5 text-xs font-semibold text-sub transition-colors hover:border-line-strong hover:text-ink"
              >
                <XGlyph /> {HOME.followTwitter}
              </a>
            ) : null}
            {SITE.supportUrl ? (
              <a
                href={SITE.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/3 px-3.5 py-1.5 text-xs font-semibold text-sub transition-colors hover:border-orange/50 hover:text-orange-bright"
              >
                <CoffeeGlyph /> {HOME.support}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <HomeSeoContent content={HOME_SEO} links={seoLinks} />
    </>
  );
}

function cxGrid(careerOn: boolean): string {
  return careerOn ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4 md:grid-cols-3 [&>*:first-child]:md:col-span-2";
}

function Tile({ href, title, desc, children }: { href: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <AppLink href={href} className="group">
      <Panel className="flex h-full items-center justify-between gap-3 p-4 transition-colors group-hover:!border-line-strong">
        <div className="min-w-0">
          <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{title}</h3>
          <p className="mt-1 text-xs text-sub">{desc}</p>
        </div>
        {children}
      </Panel>
    </AppLink>
  );
}

/** Discreet, low-key sign-in nudge (v1.4) — renders only when accounts are
 *  configured AND the player is signed out. */
function HomeSignInNudge() {
  const { HOME: H } = useCopy();
  const mounted = useMounted();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  if (!mounted || !enabled || status !== "signedOut") return null;
  return (
    <p className="mt-3 text-center">
      <AppLink href="/profile" className="text-xs text-faint underline-offset-4 transition-colors hover:text-sub hover:underline">
        {H.signInNudge} →
      </AppLink>
    </p>
  );
}

function MenuLockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function MissionGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrophyGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 5H4.6a2.4 2.4 0 0 0 0 4.8H7M17 5h2.4a2.4 2.4 0 0 1 0 4.8H17" strokeLinecap="round" />
      <path d="M12 12v4M9 20h6M10.2 20l.5-4M13.8 20l-.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiscordGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M19.3 5.3a16 16 0 0 0-4-1.2l-.2.4a11 11 0 0 1 3.5 1.2 13 13 0 0 0-11.2 0A11 11 0 0 1 11 4.5l-.3-.4a16 16 0 0 0-4 1.2C4 8.5 3.4 11.7 3.6 14.8a16 16 0 0 0 4.9 2.5l.4-.5c-.4-.2-.9-.4-1.3-.7l.3-.2a9.3 9.3 0 0 0 8 0l.3.2c-.4.3-.9.5-1.3.7l.4.5a16 16 0 0 0 4.9-2.5c.3-3.6-.6-6.8-2.9-9.5ZM9.5 13c-.8 0-1.4-.7-1.4-1.6 0-.9.6-1.6 1.4-1.6s1.5.7 1.4 1.6c0 .9-.6 1.6-1.4 1.6Zm5 0c-.8 0-1.4-.7-1.4-1.6 0-.9.6-1.6 1.4-1.6s1.5.7 1.4 1.6c0 .9-.6 1.6-1.4 1.6Z" />
    </svg>
  );
}

function CoffeeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" strokeLinejoin="round" />
      <path d="M17 9h2.2a2.3 2.3 0 0 1 0 4.6H17" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3c-.5.7-.5 1.3 0 2M11.5 3c-.5.7-.5 1.3 0 2" strokeLinecap="round" />
    </svg>
  );
}
