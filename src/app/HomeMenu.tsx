"use client";

/**
 * Home menu v3 (rc.2) — a bento with a real hierarchy. The SEO surface is
 * untouched on purpose (hero copy, `HomeSeoContent`, metadata in page.tsx).
 *   1. Hero (as before) + the identity block: rank emblem, then rank · rating ·
 *      runs · titles as tags (rc.3).
 *   2. PLAY — Classic Draft (the big one, with Quick Draft as its secondary
 *      action) and Road to Worlds, side by side, nothing else competing.
 *   3. TODAY — Daily Challenge, Challenges, today's missions, and the Daily
 *      Quiz as a small tile that opens a MODAL (it is a minigame).
 *   4. YOU — Collection · Achievements · Profile · Leaderboards in one row.
 * Everything that matters is within one screen on desktop and two on a phone.
 * Returning to the menu RESETS any run in progress (v0.2 rule).
 * Player state is mount-gated with reserved heights (CLS), like v1.4.
 */

import { AppLink } from "@/components/ui/AppLink";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { COUNTS, isNationalSpecialId } from "@/data/counts";
import { useCopy } from "@/content/copy";
import { localePath } from "@/content/pageRoutes";
import { useSettings } from "@/store/settingsStore";
import { FEATURES } from "@/config/balance";
import { SITE } from "@/config/site";
import { sfx } from "@/lib/sfx";
import { rankForXp } from "@/engine/progression";
import { quizDayFinished } from "@/engine/quizState";
import { dailyInfo } from "@/lib/dailyPlan";
import { dailyDescription, dailyLabel } from "@/lib/runLabels";
import { cx } from "@/lib/util";
import { useUtcDay } from "@/store/useUtcDay";
import { useMounted } from "@/store/useMounted";
import { useAccountStore } from "@/store/accountStore";
import { clearRunInProgress, loadRunStore, type RunStoreState } from "@/store/lazyRunStore";
import { selectChampionships, selectCollectionUnlocked, selectDailyStreak, useProfileStore } from "@/store/profileStore";
import { useNewDots } from "@/store/useNewItems";
import { Badge } from "@/components/ui/Badge";
import { DiscordIcon } from "@/components/ui/icons";
import { NewDot } from "@/components/ui/NewDot";
import { buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { FirstRunTutorial } from "@/components/screens/FirstRunTutorial";
import { SeasonRecap } from "@/components/screens/SeasonRecap";
import { MissionsPanel } from "@/components/MissionsPanel";

// The home stays off the dataset (#60): the quiz builds its puzzle from it, so
// its panel loads when the modal opens, and the run store (dataset + engine)
// loads when a run is about to start.
const QuizPanel = dynamic(() => import("@/app/quiz/QuizView").then((m) => m.QuizPanel), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-white/5" aria-busy />,
});

/** Hover (mouse) or focus on a play card starts loading the run store, so the
 *  click rarely waits for it. A touch skips the hover: a scroll starts the same way. */
const warmUp = () => void loadRunStore().catch(() => {});
const warmRunStore = {
  onPointerEnter: (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") warmUp();
  },
  onFocus: warmUp,
};

export default function HomeMenu() {
  const { APP, HOME, HOME_SEO, QUIZ_UI, DAILY_TEXT, NAV_UI } = useCopy();
  const mounted = useMounted();
  // rc.33 (COL-02c): the same "something new" dots as the nav.
  const dots = useNewDots();
  const lang = useSettings((s) => s.lang);
  const active = mounted ? lang : "en";
  const router = useRouter();
  const xp = useProfileStore((s) => s.xp);
  const mmr = useProfileStore((s) => s.mmr);
  const runs = useProfileStore((s) => s.runsCompleted);
  const titles = useProfileStore(selectChampionships);
  // National-team cards (v2.0) have their own album — not in this count.
  const unlocked = useProfileStore(
    (s) => Object.keys(s.unlockedSpecials).filter((id) => !isNationalSpecialId(id)).length,
  );
  const achieved = useProfileStore((s) => Object.keys(s.achievements).length);
  const dailyResults = useProfileStore((s) => s.dailyResults);
  const streak = useProfileStore(selectDailyStreak);
  const today = useUtcDay();
  const quizToday = useProfileStore((s) => s.quiz.results[today]);
  const collectionOpen = useProfileStore(selectCollectionUnlocked);
  const rank = rankForXp(xp);
  const [quizOpen, setQuizOpen] = useState(false);

  // The play cards load the run store, set it up, then open /play. If it cannot
  // load (offline, or a deploy replaced the chunk), /play still opens.
  const playWith = (setUp: (run: RunStoreState) => void) =>
    void loadRunStore()
      .then(({ useRunStore }) => setUp(useRunStore.getState()))
      .catch(() => {})
      .then(() => router.push("/play"));

  const goToSetup = (mode: "classic" | "quick") => {
    sfx.click();
    playWith((run) => run.setSetupMode(mode));
  };

  const daily = useMemo(() => dailyInfo(today), [today]);
  const dailyDone = mounted ? Boolean(dailyResults[today]) : false;
  const quizDone = mounted ? quizDayFinished(quizToday) : false;

  useEffect(() => {
    if (mounted) clearRunInProgress();
  }, [mounted]);

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
  // Playtest build: TODAY keeps only Challenges (no daily, missions or quiz).
  const playtest = FEATURES.playtest;

  return (
    <>
      <FirstRunTutorial />
      {playtest ? null : <SeasonRecap />}
      {/* Hero — rendered OUTSIDE the rise-in wrapper so the LCP paints immediately. */}
      <section className="px-2 pb-6 pt-10 text-center md:pt-14">
        <p className="kicker mb-4">{APP.tagline}</p>
        <h1 className="display mx-auto max-w-3xl text-5xl font-bold uppercase leading-[0.95] tracking-[0.08em] md:text-7xl">
          <span className="text-ink">Rocket</span>
          <span className="bg-gradient-to-r from-orange to-orange-bright bg-clip-text text-transparent">Draft</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-sub md:text-base">{APP.description}</p>

        {/* Identity: reserved height, mount-gated (persisted state would mismatch SSR). */}
        <div className="mx-auto mt-7 flex min-h-[132px] max-w-2xl flex-col items-center gap-3">
          {mounted ? (
            <>
              <RankBadge rank={rank} variant="menu" size="md" />
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <Badge tone="blue">{rank.label}</Badge>
                <Badge tone="orange">
                  {HOME.seasonStrip.rating} {mmr}
                </Badge>
                {runs > 0 ? <Badge tone="neutral">{HOME.runs(runs)}</Badge> : null}
                {titles > 0 ? <Badge tone="gold">{HOME.titles(titles)}</Badge> : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Community pills (v2.0): right under the rank tags, where they are seen. */}
        {SITE.discordUrl || SITE.supportUrl ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {SITE.discordUrl ? (
              <a
                href={SITE.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/3 px-3.5 py-1.5 text-xs font-semibold text-sub transition-colors hover:border-blue/50 hover:text-blue-bright"
              >
                <DiscordIcon className="h-4 w-4" /> {HOME.joinDiscord}
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
      </section>

      <div className="rise-in">
        {/* ---- PLAY ------------------------------------------------------------- */}
        <p className="kicker mb-2">{HOME.sectionPlay}</p>
        <section aria-label="Game modes" className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className={cx(careerOn ? "md:col-span-7" : "md:col-span-8")}>
            <Panel
              strong
              glow="orange"
              className="group relative flex h-full min-h-[15rem] flex-col justify-between overflow-hidden !border-orange/40 p-6 transition-all hover:-translate-y-0.5 hover:!border-orange/70 md:p-8"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange/15 blur-3xl" aria-hidden />
              <CardHit label={HOME.playNow} onClick={() => goToSetup("classic")} {...warmRunStore} />
              <div className="pointer-events-none relative">
                <div className="mb-2 flex items-center gap-2.5">
                  <h2 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">{HOME.playClassic}</h2>
                  <Badge tone="orange">{HOME.liveBadge}</Badge>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-sub">{HOME.playClassicDesc}</p>
              </div>
              <div className="pointer-events-none relative mt-6 flex flex-wrap items-center gap-3">
                <span
                  aria-hidden
                  className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all group-hover:brightness-110"
                >
                  {HOME.playNow}
                </span>
                {/* The one exception: Quick Draft sits above the card's hit area. */}
                <button
                  type="button"
                  onClick={() => goToSetup("quick")}
                  {...warmRunStore}
                  title={HOME.quickDraftDesc}
                  className="display pointer-events-auto relative z-10 inline-flex items-center justify-center rounded-xl border border-line-strong px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-sub transition-colors hover:border-orange/50 hover:text-ink"
                >
                  {HOME.quickDraftCta}
                </button>
              </div>
            </Panel>
          </div>

          {careerOn ? (
            <AppLink href="/career" className="group block md:col-span-5">
              <Panel
                strong
                glow="blue"
                className="relative flex h-full min-h-[15rem] flex-col justify-between overflow-hidden !border-blue/40 p-6 transition-all group-hover:-translate-y-0.5 group-hover:!border-blue/70 md:p-8"
              >
                <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue/15 blur-3xl" aria-hidden />
                <div className="relative">
                  <div className="mb-2 flex items-center gap-2.5">
                    <h2 className="display text-2xl font-bold uppercase tracking-wide text-ink md:text-3xl">{HOME.careerTitle}</h2>
                    <Badge tone="blue">{HOME.careerBadge}</Badge>
                    <Badge tone="gold">{NAV_UI.beta}</Badge>
                  </div>
                  <p className="max-w-sm text-sm leading-relaxed text-sub">{HOME.careerDesc}</p>
                  <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-amber-300/80">{HOME.careerBetaNote}</p>
                </div>
                <span className="display relative mt-6 inline-flex w-fit items-center justify-center rounded-xl border border-blue/50 bg-blue/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-ink transition-all group-hover:bg-blue/20">
                  {HOME.careerCta}
                </span>
              </Panel>
            </AppLink>
          ) : (
            <button type="button" onClick={() => goToSetup("quick")} {...warmRunStore} className="group text-left md:col-span-4">
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

        {/* ---- TODAY ------------------------------------------------------------ */}
        <p className="kicker mb-2 mt-7">{HOME.sectionDaily}</p>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-12 md:grid-rows-[auto_auto]">
          {playtest ? null : (
          <Panel className={cx("group relative flex flex-col overflow-hidden p-5 md:col-span-4", !dailyDone && "transition-colors hover:!border-line-strong")}>
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/10 blur-2xl" aria-hidden />
            {!dailyDone ? (
              <CardHit label={HOME.dailyPlay} onClick={() => playWith((run) => run.startDailyRun())} {...warmRunStore} />
            ) : null}
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.daily}
                <span className="ml-2 text-sm text-faint">{mounted ? `#${daily.n}` : ""}</span>
              </h3>
              {mounted && streak > 0 ? <Badge tone="gold">{HOME.dailyStreak(streak)}</Badge> : <Badge tone="blue">{HOME.liveBadge}</Badge>}
            </div>
            <div className="min-h-[56px] flex-1">
              {mounted ? (
                <>
                  <p className="display text-sm font-bold uppercase tracking-wide text-orange-bright">
                    {dailyLabel(daily, DAILY_TEXT)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-sub">
                    {dailyDescription(daily, DAILY_TEXT)}
                  </p>
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
              <span aria-hidden className={cx(buttonClass("secondary", "sm"), "pointer-events-none mt-3 w-fit group-hover:bg-blue/20")}>
                {HOME.dailyPlay}
              </span>
            )}
          </Panel>
          )}

          {locked ? (
            <div className={cx("cursor-not-allowed", playtest ? "sm:col-span-2 md:col-span-12" : "md:col-span-4")} aria-disabled="true" title={HOME.challengesLocked}>
              <Panel className="flex h-full flex-col p-5 opacity-60">
                <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.challenges}</h3>
                <p className="mt-1 text-xs text-sub">{HOME.challengesLocked}</p>
              </Panel>
            </div>
          ) : (
            <AppLink href="/challenges" className={cx("group", playtest ? "sm:col-span-2 md:col-span-12" : "md:col-span-4")}>
              <Panel className="relative flex h-full flex-col p-5 transition-colors group-hover:!border-line-strong">
                {dots.challenges ? <NewDot className="absolute right-2 top-2" label={NAV_UI.newHere} /> : null}
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

          {playtest ? null : (
          <>
          <div className="md:col-span-4 md:row-span-2">
            <MissionsPanel compact />
          </div>

          {/* rc.4: same anatomy as the Daily Challenge — title + Live tag on top,
              the line under it, the CTA (or today's result) at the bottom. */}
          <Panel className="group relative flex h-full flex-col overflow-hidden p-5 transition-colors hover:!border-line-strong sm:col-span-2 md:col-span-8">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl" aria-hidden />
            <CardHit
              label={quizDone ? HOME.quiz : HOME.quizPlay}
              onClick={() => {
                sfx.click();
                setQuizOpen(true);
              }}
            />
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">{HOME.quiz}</h3>
              <Badge tone="blue">{HOME.liveBadge}</Badge>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-sub">{HOME.quizDesc}</p>
            <div className="mt-3">
              {quizDone ? (
                <Badge tone={quizToday?.solved ? "good" : "neutral"}>{quizToday?.solved ? HOME.quizDone : HOME.quizMissed}</Badge>
              ) : (
                <span aria-hidden className={cx(buttonClass("secondary", "sm"), "pointer-events-none w-fit group-hover:bg-blue/20")}>
                  {HOME.quizPlay}
                </span>
              )}
            </div>
          </Panel>
          </>
          )}
        </section>

        {/* ---- YOU --------------------------------------------------------------- */}
        <p className="kicker mb-2 mt-7">{HOME.sectionYou}</p>
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
            <Tile href="/collection" title={HOME.collection} desc={HOME.collectionDesc} dot={dots.collection} dotLabel={NAV_UI.newHere}>
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
          <Tile href="/profile" title={HOME.profile} desc={HOME.profileDesc} dot={dots.profile} dotLabel={NAV_UI.newHere}>
            {mounted ? <RankBadge rank={rank} variant="menu" size="sm" /> : null}
          </Tile>
          <Tile href="/leaderboards" title={HOME.leaderboards} desc={HOME.leaderboardsDesc}>
            <span className="shrink-0 text-cyan" aria-hidden>
              <TrophyGlyph />
            </span>
          </Tile>
        </section>

        {/* Discord once more at the end of the menu (v2.0): one slim strip. */}
        {SITE.discordUrl ? (
          <a
            href={SITE.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-xl border border-[#5865F2]/35 bg-[#5865F2]/[0.08] px-4 py-3 transition-colors hover:border-[#5865F2]/70 hover:bg-[#5865F2]/[0.14]"
          >
            <span className="shrink-0 text-[#aab1ff]" aria-hidden>
              <DiscordIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block text-sm font-bold uppercase tracking-wide text-ink">{HOME.joinDiscord}</span>
              <span className="block text-xs leading-relaxed text-sub">{HOME.discordDesc}</span>
            </span>
            <span className="shrink-0 text-[#aab1ff] transition-transform group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </a>
        ) : null}

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
          <AppLink href="/how-to-play" className="text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline">
            {HOME.howToPlay} →
          </AppLink>
          {SITE.authorUrl ? (
            <a
              href={SITE.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sub underline-offset-4 hover:text-ink hover:underline"
            >
              <XGlyph /> {HOME.followTwitter}
            </a>
          ) : null}
        </p>

        <HomeSignInNudge />
      </div>
      <HomeSeoContent content={HOME_SEO} links={seoLinks} />

      <Modal open={quizOpen && !playtest} title={QUIZ_UI.title} onClose={() => setQuizOpen(false)} wide>
        <QuizPanel compact />
        <p className="mt-3 text-right">
          <AppLink href="/quiz" className="text-[11px] font-semibold text-faint underline-offset-4 hover:text-sub hover:underline">
            {QUIZ_UI.history} →
          </AppLink>
        </p>
      </Modal>
    </>
  );
}

/**
 * rc.6: makes the WHOLE card the action — an invisible button over the card
 * (absolute, so it sits above the card's in-flow content). Anything inside the
 * card that needs its own action sits above it with `relative z-10`.
 */
function CardHit({
  label,
  onClick,
  onPointerEnter,
  onFocus,
}: {
  label: string;
  onClick: () => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onFocus?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-orange/70"
    />
  );
}

function Tile({
  href,
  title,
  desc,
  dot,
  dotLabel,
  children,
}: {
  href: string;
  title: string;
  desc: string;
  /** rc.33: something not opened yet behind this tile. */
  dot?: boolean;
  dotLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <AppLink href={href} className="group">
      <Panel className="relative flex h-full flex-col items-start justify-between gap-2 p-4 transition-colors group-hover:!border-line-strong min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
        {dot ? <NewDot className="absolute right-2 top-2" label={dotLabel} /> : null}
        <div className="min-w-0">
          <h3 className="display text-base font-bold uppercase tracking-wide text-ink">{title}</h3>
          <p className="mt-1 hidden text-xs text-sub sm:block">{desc}</p>
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

function CoffeeGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" strokeLinejoin="round" />
      <path d="M17 9h2.2a2.3 2.3 0 0 1 0 4.6H17" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3c-.5.7-.5 1.3 0 2M11.5 3c-.5.7-.5 1.3 0 2" strokeLinecap="round" />
    </svg>
  );
}
