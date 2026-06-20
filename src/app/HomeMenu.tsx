"use client";

/**
 * Home menu (interactive island): hero, game modes, collection/achievements/
 * profile shortcuts. Returning to the menu RESETS any run in progress (v0.2
 * rule) — runs are short; there is no resume system.
 *
 * v1.3: split out of the route's `page.tsx` so the server page can own metadata
 * + hreflang and render crawlable SEO copy (HomeSeoContent) below this island.
 * The hero text still follows the EN/PT language toggle (useCopy).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { COUNTS } from "@/data/counts";
import { useCopy } from "@/content/copy";
import { localePath } from "@/content/pageRoutes";
import { useSettings } from "@/store/settingsStore";
import { SITE } from "@/config/site";
import { sfx } from "@/lib/sfx";
import { rankForXp } from "@/engine/progression";
import { generateDailyConfig, todayKey } from "@/lib/daily";
import { useMounted } from "@/store/useMounted";
import {
  selectChampionships,
  selectDailyStreak,
  useProfileStore,
} from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { FirstRunTutorial } from "@/components/screens/FirstRunTutorial";

export default function HomeMenu() {
  const { APP, HOME, HOME_SEO } = useCopy();
  const mounted = useMounted();
  const lang = useSettings((s) => s.lang);
  // Active locale (mounted-gated to match SSR EN), used for the SEO content +
  // its internal links so a PT player's links point at the /pt URLs.
  const active = mounted ? lang : "en";
  const router = useRouter();
  const xp = useProfileStore((s) => s.xp);
  const runs = useProfileStore((s) => s.runsCompleted);
  const titles = useProfileStore(selectChampionships);
  const unlocked = useProfileStore((s) => Object.keys(s.unlockedSpecials).length);
  const achieved = useProfileStore((s) => Object.keys(s.achievements).length);
  const dailyResults = useProfileStore((s) => s.dailyResults);
  const streak = useProfileStore(selectDailyStreak);
  const clearRun = useRunStore((s) => s.clearRun);
  const startDailyRun = useRunStore((s) => s.startDailyRun);
  const setSetupMode = useRunStore((s) => s.setSetupMode);
  const rank = rankForXp(xp);

  const goToSetup = (mode: "classic" | "quick") => {
    sfx.click();
    setSetupMode(mode);
    router.push("/play");
  };

  const today = todayKey();
  const daily = useMemo(() => generateDailyConfig(today), [today]);
  const dailyDone = mounted ? Boolean(dailyResults[today]) : false;

  // Arriving at the menu abandons any in-progress run — checked ONCE on
  // mount (not subscribed), so starting a daily from here isn't wiped.
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

  return (
    <>
      <FirstRunTutorial />
      <div className="rise-in">
      {/* Hero */}
      <section className="px-2 py-10 text-center md:py-14">
        <p className="kicker mb-4">{APP.tagline}</p>
        <h1 className="display mx-auto max-w-3xl text-5xl font-bold uppercase leading-[0.95] tracking-[0.08em] md:text-7xl">
          <span className="text-ink">Rocket</span>
          <span className="bg-gradient-to-r from-orange to-orange-bright bg-clip-text text-transparent">
            Draft
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-sub md:text-base">
          {APP.description}
        </p>

        {mounted ? (
          <div className="mt-7 flex flex-col items-center gap-2">
            <RankBadge rank={rank} variant="menu" size="md" />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge tone="blue">{rank.label}</Badge>
              <Badge tone="neutral">{xp} XP</Badge>
              {runs > 0 ? <Badge tone="neutral">{HOME.runs(runs)}</Badge> : null}
              {titles > 0 ? <Badge tone="gold">{HOME.titles(titles)}</Badge> : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* Modes — Classic Draft is THE primary action of the menu */}
      <section aria-label="Game modes" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button type="button" onClick={() => goToSetup("classic")} className="group text-left md:col-span-2">
          <Panel
            strong
            glow="orange"
            className="relative flex h-full flex-col justify-between overflow-hidden !border-orange/40 p-6 transition-all group-hover:-translate-y-0.5 group-hover:!border-orange/70 md:p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange/10 blur-3xl" aria-hidden />
            <div>
              <div className="mb-2 flex items-center gap-2.5">
                <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">
                  {HOME.playClassic}
                </h2>
                <Badge tone="orange">{HOME.liveBadge}</Badge>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-sub">{HOME.playClassicDesc}</p>
            </div>
            <span className="display mt-6 inline-flex w-fit items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all group-hover:brightness-110">
              {HOME.playNow}
            </span>
          </Panel>
        </button>

        <div className="flex flex-col gap-4">
          <button type="button" onClick={() => goToSetup("quick")} className="group flex-1 text-left">
            <Panel className="flex h-full flex-col justify-center p-5 transition-all group-hover:!border-blue/50">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                  {HOME.quickDraft}
                </h3>
                <Badge tone="blue">{HOME.liveBadge}</Badge>
              </div>
              <p className="text-xs leading-relaxed text-sub">{HOME.quickDraftDesc}</p>
            </Panel>
          </button>

          <Panel className="flex-1 p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.daily}
                <span className="ml-2 text-sm text-faint">#{daily.info.n}</span>
              </h3>
              {mounted && streak > 0 ? (
                <Badge tone="gold">{HOME.dailyStreak(streak)}</Badge>
              ) : (
                <Badge tone="blue">{HOME.liveBadge}</Badge>
              )}
            </div>
            <p className="display text-sm font-bold uppercase tracking-wide text-orange-bright">
              {daily.info.label}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-sub">{daily.info.description}</p>
            {daily.info.objective ? (
              <p className="mb-3 mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-cyan">
                <TargetGlyph />
                <span>
                  {daily.info.objective.label}
                  <span className="text-faint"> · +{daily.info.objective.bonusXp} XP</span>
                </span>
              </p>
            ) : (
              <div className="mb-3" />
            )}
            {dailyDone ? (
              <div>
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
                onClick={() => {
                  startDailyRun();
                  router.push("/play");
                }}
              >
                {HOME.dailyPlay}
              </Button>
            )}
          </Panel>
        </div>
      </section>

      {/* Secondary */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(() => {
          // Collection is locked until Bronze — when locked the card is NOT a link
          // (not clickable, not focusable) so it can't be opened (v1.3.5).
          const collectionLocked = mounted && rank.id === "unranked";
          const body = (
            <Panel
              className={`flex h-full items-center justify-between gap-4 p-5 transition-colors ${
                collectionLocked ? "opacity-60" : "group-hover:!border-line-strong"
              }`}
            >
              <div>
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                  {HOME.collection}
                </h3>
                <p className="mt-1 text-xs text-sub">
                  {collectionLocked ? HOME.collectionLocked : HOME.collectionDesc}
                </p>
              </div>
              {collectionLocked ? (
                <span className="shrink-0 text-faint" aria-label={HOME.collectionLocked}>
                  <MenuLockGlyph />
                </span>
              ) : (
                <span className="display shrink-0 text-2xl font-bold text-cyan">
                  {mounted ? unlocked : 0}
                  <span className="text-sm text-faint">/{COUNTS.specialCards}</span>
                </span>
              )}
            </Panel>
          );
          return collectionLocked ? (
            <div className="cursor-not-allowed" aria-disabled="true" title={HOME.collectionLocked}>
              {body}
            </div>
          ) : (
            <Link href="/collection" className="group">
              {body}
            </Link>
          );
        })()}
        <Link href="/achievements" className="group">
          <Panel className="flex h-full items-center justify-between gap-4 p-5 transition-colors group-hover:!border-line-strong">
            <div>
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.achievements}
              </h3>
              <p className="mt-1 text-xs text-sub">{HOME.achievementsDesc}</p>
            </div>
            <span className="display shrink-0 text-2xl font-bold text-orange-bright">
              {mounted ? achieved : 0}
              <span className="text-sm text-faint">/{COUNTS.achievements}</span>
            </span>
          </Panel>
        </Link>
        <Link href="/profile" className="group">
          <Panel className="flex h-full items-center justify-between gap-4 p-5 transition-colors group-hover:!border-line-strong">
            <div>
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.profile}
              </h3>
              <p className="mt-1 text-xs text-sub">{HOME.profileDesc}</p>
            </div>
            {mounted ? <RankBadge rank={rank} variant="menu" size="sm" /> : null}
          </Panel>
        </Link>
      </section>

      {/* Challenges + Leaderboards (v1.4) */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {(() => {
          // Challenges unlock at Bronze too (alongside the Collection) — when
          // locked the card is NOT a link (v1.4).
          const challengesLocked = mounted && rank.id === "unranked";
          const body = (
            <Panel
              className={`flex h-full items-center justify-between gap-4 p-5 transition-colors ${
                challengesLocked ? "opacity-60" : "group-hover:!border-line-strong"
              }`}
            >
              <div>
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                  {HOME.challenges}
                </h3>
                <p className="mt-1 text-xs text-sub">
                  {challengesLocked ? HOME.challengesLocked : HOME.challengesDesc}
                </p>
              </div>
              <span className={`shrink-0 ${challengesLocked ? "text-faint" : "text-orange-bright"}`} aria-hidden>
                {challengesLocked ? <MenuLockGlyph /> : <MissionGlyph />}
              </span>
            </Panel>
          );
          return challengesLocked ? (
            <div className="cursor-not-allowed" aria-disabled="true" title={HOME.challengesLocked}>
              {body}
            </div>
          ) : (
            <Link href="/challenges" className="group">
              {body}
            </Link>
          );
        })()}
        <Link href="/leaderboards" className="group">
          <Panel className="flex h-full items-center justify-between gap-4 p-5 transition-colors group-hover:!border-line-strong">
            <div>
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.leaderboards}
              </h3>
              <p className="mt-1 text-xs text-sub">{HOME.leaderboardsDesc}</p>
            </div>
            <span className="shrink-0 text-cyan" aria-hidden>
              <TrophyGlyph />
            </span>
          </Panel>
        </Link>
      </section>

      <p className="mt-10 text-center">
        <Link
          href="/how-to-play"
          className="text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
        >
          {HOME.howToPlay} →
        </Link>
      </p>

      {/* Subtle community / support row — only renders once the links are set
          in src/config/site.ts (kept low-key by direction). */}
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

function TargetGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function MissionGlyph() {
  // Card-sized target for the Challenges shortcut (v1.4).
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
