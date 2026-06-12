"use client";

/**
 * Home: hero, game modes, collection/achievements/profile shortcuts.
 * Returning to the menu RESETS any run in progress (v0.2 rule) — runs are
 * short; there is no resume system.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { achievements as achievementDefs, specialCards } from "@/data";
import { APP, HOME } from "@/content/copy";
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

export default function HomePage() {
  const mounted = useMounted();
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

  return (
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
              {runs > 0 ? (
                <Badge tone="neutral">
                  {runs} {runs === 1 ? "run" : "runs"}
                </Badge>
              ) : null}
              {titles > 0 ? <Badge tone="gold">{titles} titles</Badge> : null}
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
                <Badge tone="orange">Live</Badge>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-sub">{HOME.playClassicDesc}</p>
            </div>
            <span className="display mt-6 inline-flex w-fit items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all group-hover:brightness-110">
              Play now →
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
                <Badge tone="blue">Live</Badge>
              </div>
              <p className="text-xs leading-relaxed text-sub">{HOME.quickDraftDesc}</p>
            </Panel>
          </button>

          <Panel className="flex-1 p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.daily}
              </h3>
              {mounted && streak > 0 ? (
                <Badge tone="gold">{HOME.dailyStreak(streak)}</Badge>
              ) : (
                <Badge tone="blue">Live</Badge>
              )}
            </div>
            <p className="display text-sm font-bold uppercase tracking-wide text-orange-bright">
              {daily.info.label}
            </p>
            <p className="mb-3 mt-0.5 text-xs leading-relaxed text-sub">{daily.info.description}</p>
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
        <Link href="/collection" className="group">
          <Panel className="flex h-full items-center justify-between gap-4 p-5 transition-colors group-hover:!border-line-strong">
            <div>
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.collection}
              </h3>
              <p className="mt-1 text-xs text-sub">{HOME.collectionDesc}</p>
            </div>
            <span className="display shrink-0 text-2xl font-bold text-cyan">
              {mounted ? unlocked : 0}
              <span className="text-sm text-faint">/{specialCards.length}</span>
            </span>
          </Panel>
        </Link>
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
              <span className="text-sm text-faint">/{achievementDefs.length}</span>
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

      <p className="mt-10 text-center">
        <Link
          href="/how-to-play"
          className="text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
        >
          {HOME.howToPlay} →
        </Link>
      </p>

      <p className="mt-10 text-center text-[11px] leading-relaxed text-faint md:hidden">
        {APP.disclaimer}
      </p>
    </div>
  );
}

