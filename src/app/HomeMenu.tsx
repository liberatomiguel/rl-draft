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
import { useSignInDialog } from "@/store/signInDialog";
import { partnerLogoSrc } from "@/lib/assets";
import { Badge } from "@/components/ui/Badge";
import { DiscordIcon } from "@/components/ui/icons";
import { NewDot } from "@/components/ui/NewDot";
import { buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel } from "@/components/ui/Panel";
import { RankBadge } from "@/components/ui/RankBadge";
import { HomeSeoContent } from "@/components/content/HomeSeoContent";
import { FirstRunTutorial } from "@/components/screens/FirstRunTutorial";
import { LaunchNotice } from "@/components/screens/LaunchNotice";
import { SEASON } from "@/config/season";
import { SeasonRecap } from "@/components/screens/SeasonRecap";
import { MissionsPanel } from "@/components/MissionsPanel";
import { FriendsSection } from "@/components/share/FriendsSection";

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

/** One row of the TODAY rundown: title and line on the left, action on the right. */
/** Phone: the row itself is the control (the whole row is the hit area), so it
 *  ends in a chevron and the outlined button that repeated its title is off. */
const ROW =
  "group relative flex items-center justify-between gap-3 border-b border-line px-1 py-4 transition-colors sm:gap-6 sm:px-3 sm:py-5";
const ROW_BUTTON = "pointer-events-none shrink-0 max-sm:hidden group-hover:border-orange group-hover:bg-orange/15";

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
    // /quiz is indexable and in the sitemap, but its only other link sits in a
    // modal: without this one no exported HTML links to it. Cut with the route.
    ...(FEATURES.playtest ? [] : [{ label: QUIZ_UI.kicker, href: "/quiz" }]),
    { label: HOME_SEO.links.ratings, href: localePath("ratings", active) },
    { label: HOME_SEO.links.specialCards, href: localePath("special-cards", active) },
    { label: HOME_SEO.links.strategy, href: localePath("strategy", active) },
    { label: HOME_SEO.links.sam, href: localePath("sam", active) },
    { label: HOME_SEO.links.simulator, href: localePath("simulator", active) },
    { label: HOME_SEO.links.fantasy, href: localePath("fantasy", active) },
    { label: HOME_SEO.links.database, href: "/rlcs" },
    ...(FEATURES.careerMode
      ? [
          { label: HOME_SEO.links.manager, href: localePath("manager", active) },
          { label: HOME_SEO.links.careerGuide, href: localePath("career-guide", active) },
        ]
      : []),
    { label: HOME_SEO.links.faq, href: localePath("faq", active) },
    { label: HOME_SEO.links.about, href: localePath("about", active) },
  ];

  const locked = mounted && !collectionOpen && rank.id === "unranked";
  const fiftyFifty = partnerLogoSrc("fiftyfifty");
  const careerOn = FEATURES.careerMode;
  // Playtest build: TODAY keeps only Challenges (no daily, missions or quiz).
  const playtest = FEATURES.playtest;

  return (
    <>
      <FirstRunTutorial />
      {playtest ? null : <LaunchNotice />}
      {playtest ? null : <SeasonRecap />}
      {/* Hero — rendered OUTSIDE the rise-in wrapper so the LCP paints immediately.
          DESIGN.md: the wordmark is the only italic in the game and the only
          large orange; the player's own line (rank art, season rating, rank)
          sits beside it on one quiet board. Nothing else competes here. */}
      {/* Phone (design/mobile-redesign): the first screen is the wordmark, the
          player's line and the draft card with its button. The pitch is two
          lines there (the whole text is in the section under the menu) and the
          community links sit with the other ways out at the end of the menu. */}
      <section className="grid grid-cols-1 items-end gap-x-12 gap-y-4 pb-5 pt-1 sm:gap-y-6 sm:pb-8 sm:pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:pb-10 md:pt-6">
        <div className="min-w-0">
          {/* Fluid under 375px: at 320px a fixed 44px wordmark ran 9px past the screen. */}
          <h1 className="display text-[clamp(2.25rem,13.2vw,2.75rem)] font-extrabold uppercase italic leading-[0.9] sm:text-7xl md:text-[5.25rem]">
            <span className="text-ink">Rocket</span>
            <span className="text-orange">Draft</span>
          </h1>
          <p className="mt-3 line-clamp-2 max-w-md text-sm leading-snug text-sub sm:mt-4 sm:line-clamp-none sm:leading-relaxed md:text-[15px]">{APP.description}</p>

          {/* Community links (v2.0): under the pitch, where they are seen. */}
          {SITE.discordUrl || SITE.supportUrl ? (
            <div className="mt-4 hidden flex-wrap items-center gap-2.5 sm:flex">
              {SITE.discordUrl ? (
                <a
                  href={SITE.discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3.5 py-1.5 text-sm text-sub transition-colors hover:border-line-strong hover:text-ink sm:min-h-9"
                >
                  <DiscordIcon className="h-4 w-4" /> {HOME.joinDiscord}
                </a>
              ) : null}
              {SITE.supportUrl ? (
                <a
                  href={SITE.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3.5 py-1.5 text-sm text-sub transition-colors hover:border-line-strong hover:text-ink sm:min-h-9"
                >
                  <CoffeeGlyph /> {HOME.support}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="w-full md:w-auto md:min-w-[23rem] md:max-w-[30rem]">
          {/* The partner line sits over the scorebug, beside the wordmark. */}
          {fiftyFifty ? (
            <p className="mb-2 flex items-center gap-2.5 sm:mb-3 md:justify-end">
              <span className="display text-xs font-medium uppercase tracking-[0.05em] text-sub">{HOME.presentedBy}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- a static-export asset URL from assets.ts (WebP in production) */}
              <img src={fiftyFifty} alt="50/50" width={92} height={36} className="h-6 w-auto object-contain sm:h-9" />
            </p>
          ) : null}
          {/* Identity: reserved height, mount-gated (persisted state would mismatch SSR).
              Read in this order: the rating (the number that moves), the rank, the season line.
              Phone: a shorter bug (5.25rem), the rating label on two lines so the paper
              cell stays narrow and the rank name has room ("BRONZE" was cut to "BRON"). */}
          <div className="flex min-h-[5.25rem] w-full items-stretch overflow-hidden rounded-xl border border-line-strong sm:min-h-[6.75rem]">
            {mounted ? (
              <>
                {/* Dark cell on the left: the rank art (drawn for a dark ground), the rank, the quiet line.
                    A long rank name ("Supersonic Legend") wraps to two lines instead of pushing the rating. */}
                <div className="flex min-w-0 flex-1 items-center gap-3 bg-surface-strong px-3 py-2.5 sm:gap-3.5 sm:px-4 sm:py-3">
                  {/* Under 360px the art steps down to 56px, so the rank name keeps its line. */}
                  <span className="shrink-0">
                    <RankBadge rank={rank} variant="menu" size="md" className="max-[359px]:!h-14 max-[359px]:!w-14" />
                  </span>
                  <div className="min-w-0">
                    {playtest ? null : <p className="whitespace-nowrap text-xs text-sub">{SEASON.name}</p>}
                    <p className="display mt-0.5 text-[clamp(1.05rem,5.2vw,1.25rem)] font-bold uppercase leading-[1.02] text-ink [overflow-wrap:anywhere] sm:mt-1 sm:text-2xl">{rank.label}</p>
                    {runs > 0 || titles > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs sm:mt-2">
                        {runs > 0 ? <span className="text-sub">{HOME.runs(runs)}</span> : null}
                        {titles > 0 ? <span className="font-semibold text-amber-300">{HOME.titles(titles)}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
                {/* Paper cell on the right: the season rating, the one figure of the screen.
                    Five digits or more step the figure down so the cell keeps its width. */}
                <div className="flex shrink-0 flex-col justify-center bg-paper px-3 py-2.5 text-right text-paper-ink min-[360px]:px-4 sm:px-5 sm:py-3">
                  <p className="display ml-auto max-w-[6.5rem] text-xs font-bold uppercase leading-[1.05] tracking-[0.04em] sm:max-w-none sm:leading-none">{HOME.seasonStrip.rating}</p>
                  <p className={cx("display mt-1 font-extrabold leading-[0.85] tabular-nums sm:mt-1.5", String(mmr).length > 4 ? "text-[clamp(1.6rem,8.5vw,2rem)] sm:text-[2.5rem]" : "text-[clamp(2.25rem,12vw,3rem)] sm:text-6xl")}>{mmr}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="rise-in">
        {/* ---- PLAY ------------------------------------------------------------- */}
        {/* The two modes are solid fields in the two sides' colours, the draft
            on orange and the career on blue, finished like a card (`.solid`:
            the card's corner, sheen and texture). Upright Bold titles; the
            action on each is the inverse of its field. */}
        <section aria-label="Game modes" className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className={cx(careerOn ? "md:col-span-7" : "md:col-span-8")}>
            {/* Phone: the card is as tall as its content and its two actions
                share one row, so the button sits inside the first screen. */}
            <div className="solid solid-orange group flex h-full flex-col justify-between p-5 transition-transform duration-200 hover:-translate-y-0.5 sm:min-h-[17rem] sm:p-7 md:p-9">
              <CardHit label={HOME.playNow} onClick={() => goToSetup("classic")} {...warmRunStore} />
              <div className="pointer-events-none relative">
                <h2 className="display text-4xl uppercase leading-[0.92] sm:text-5xl md:text-6xl">{HOME.playClassic}</h2>
                <p className="mt-2.5 max-w-md text-[15px] font-semibold leading-snug sm:mt-3">{HOME.playClassicDesc}</p>
              </div>
              {/* One row from 360px; under it the two wrap to a row each (nothing breaks mid-label). */}
              <div className="pointer-events-none relative mt-5 flex flex-wrap items-stretch gap-2.5 sm:mt-8 sm:items-center sm:gap-3">
                <span aria-hidden className={cx(buttonClass("primary", "lg"), "max-sm:flex-[1.15] max-sm:whitespace-nowrap max-sm:px-3 sm:px-8 !bg-paper-ink !text-paper group-hover:!bg-[#1b2030]")}>
                  {HOME.playNow}
                </span>
                {/* The one exception: Quick Draft sits above the card's hit area. */}
                <button
                  type="button"
                  onClick={() => goToSetup("quick")}
                  {...warmRunStore}
                  title={HOME.quickDraftDesc}
                  className="display pointer-events-auto relative z-10 inline-flex min-h-12 items-center justify-center rounded-lg border-[1.5px] border-paper-ink/70 px-5 text-base font-bold uppercase leading-none tracking-[0.04em] text-paper-ink transition-colors hover:bg-paper-ink hover:text-paper max-sm:flex-1 max-sm:whitespace-nowrap max-sm:px-2 max-sm:text-[15px]"
                >
                  {HOME.quickDraftCta}
                </button>
              </div>
            </div>
          </div>

          {careerOn ? (
            <AppLink href="/career" className="group block md:col-span-5">
              <div className="solid solid-blue flex h-full flex-col justify-between p-5 transition-transform duration-200 group-hover:-translate-y-0.5 sm:min-h-[14rem] sm:p-7 md:p-9">
                {/* Read like the draft card beside it: the title on one line, one
                    line of pitch, the BETA note under it, and the action at the
                    foot on the same line as the draft card's. Phone: BETA is a
                    mark beside the title; its note is said again by the notice
                    that opens with the career. */}
                <div className="relative">
                  <h2 className="display flex flex-wrap items-center gap-x-2 gap-y-1.5 text-3xl uppercase leading-[0.92] sm:flex-nowrap sm:whitespace-nowrap sm:text-4xl lg:text-[2.6rem]">
                    {HOME.careerTitle}
                    <span className="rounded-sm border border-white/50 px-1 py-1 text-[11px] font-bold leading-none tracking-[0.04em] sm:hidden">{NAV_UI.beta}</span>
                  </h2>
                  {/* Light text on blue reads a step heavier than dark on orange: Medium here matches the draft card's line. */}
                  <p className="mt-2.5 max-w-sm text-[15px] font-medium leading-snug sm:mt-3">{HOME.careerDesc}</p>
                  {/* The mode's status is one framed strip under the pitch: the BETA mark, a rule, its note. */}
                  <p className="mt-4 hidden max-w-sm items-center gap-3 rounded-lg border border-white/40 px-3 py-2 text-xs leading-snug sm:flex">
                    <span className="display shrink-0 text-base font-bold uppercase leading-none tracking-[0.04em]">{NAV_UI.beta}</span>
                    <span className="min-w-0 border-l border-white/35 pl-3">{HOME.careerBetaNote}</span>
                  </p>
                </div>
                <span className={cx(buttonClass("primary", "lg"), "relative mt-5 w-fit px-8 sm:mt-8 !bg-paper !text-paper-ink group-hover:!bg-white")}>
                  {HOME.careerPlay}
                </span>
              </div>
            </AppLink>
          ) : (
            <button type="button" onClick={() => goToSetup("quick")} {...warmRunStore} className="group text-left md:col-span-4">
              <Panel className="flex h-full flex-col justify-center p-5 transition-all group-hover:!border-blue/50">
                <h3 className="display mb-1 text-lg font-bold uppercase tracking-wide text-ink">{HOME.quickDraft}</h3>
                <p className="text-xs leading-relaxed text-sub">{HOME.quickDraftDesc}</p>
              </Panel>
            </button>
          )}
        </section>

        {/* ---- TODAY ------------------------------------------------------------ */}
        {/* TODAY is a rundown, not a grid of boxes: one row per thing that
            resets today, title and line on the left, the action or today's
            result on the right. Missions keep their board beside it. */}
        <h2 className="title-slab mt-12 text-xl md:text-2xl">{HOME.sectionDaily}</h2>
        <section className="mt-4 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-12 md:items-stretch">
          {/* The rows share the height of the missions board beside them. */}
          <div className={cx("flex flex-col border-t border-line [&>*]:flex-1", playtest ? "md:col-span-12" : "md:col-span-8")}>
            {locked ? (
              <div className={cx(ROW, "cursor-not-allowed opacity-60")} aria-disabled="true" title={HOME.challengesLocked}>
                <div className="min-w-0 flex-1">
                  <h3 className="display text-lg uppercase leading-none text-ink">{HOME.challenges}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-sub">{HOME.challengesLocked}</p>
                </div>
                <span className="shrink-0 text-faint" aria-hidden>
                  <MenuLockGlyph />
                </span>
              </div>
            ) : (
              <AppLink href="/challenges" className={cx(ROW, "hover:bg-white/[0.04]")}>
                <div className="min-w-0 flex-1">
                  <h3 className="display flex items-center gap-2.5 text-lg uppercase leading-none text-ink">
                    {HOME.challenges}
                    {dots.challenges ? <NewDot label={NAV_UI.newHere} /> : null}
                  </h3>
                  <p className="mt-1.5 text-sm leading-snug text-sub">{HOME.challengesDesc}</p>
                </div>
                <span aria-hidden className={cx(buttonClass("secondary", "md"), ROW_BUTTON)}>
                  {HOME.challenges}
                </span>
                <RowChevron />
              </AppLink>
            )}

            {playtest ? null : (
              <div className={cx(ROW, !dailyDone && "hover:bg-white/[0.04]")}>
                {!dailyDone ? (
                  <CardHit label={HOME.dailyPlay} onClick={() => playWith((run) => run.startDailyRun())} {...warmRunStore} />
                ) : null}
                <div className="min-h-[4.25rem] min-w-0 flex-1">
                  <h3 className="display flex flex-wrap items-baseline gap-x-2.5 text-lg uppercase leading-none text-ink">
                    {HOME.daily}
                    <span className="text-sm text-faint">{mounted ? `#${daily.n}` : ""}</span>
                    {mounted && streak > 0 ? <Badge tone="gold">{HOME.dailyStreak(streak)}</Badge> : null}
                  </h3>
                  {mounted ? (
                    <p className="mt-1.5 text-sm leading-snug text-sub">
                      <span className="text-ink">{dailyLabel(daily, DAILY_TEXT)}.</span>{" "}
                      {dailyDescription(daily, DAILY_TEXT)}
                    </p>
                  ) : null}
                </div>
                {dailyDone ? (
                  <div className="max-w-[42%] shrink-0 text-right sm:max-w-none">
                    {dailyResults[today]?.placement === "champion" ? (
                      <Badge tone="good">{HOME.dailyVictory} +{dailyResults[today]?.xp} XP</Badge>
                    ) : (
                      <Badge tone="bad">{HOME.dailyDefeat}</Badge>
                    )}
                    <p className="mt-1.5 text-xs text-faint">{HOME.dailyComeBack}</p>
                  </div>
                ) : (
                  <>
                    <span aria-hidden className={cx(buttonClass("secondary", "md"), ROW_BUTTON)}>
                      {HOME.dailyPlay}
                    </span>
                    <RowChevron />
                  </>
                )}
              </div>
            )}

            {playtest ? null : (
              <div className={cx(ROW, "hover:bg-white/[0.04]")}>
                <CardHit
                  label={quizDone ? HOME.quiz : HOME.quizPlay}
                  onClick={() => {
                    sfx.click();
                    setQuizOpen(true);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="display text-lg uppercase leading-none text-ink">{HOME.quiz}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-sub">{HOME.quizDesc}</p>
                </div>
                {quizDone ? (
                  <Badge tone={quizToday?.solved ? "good" : "neutral"} className="shrink-0">{quizToday?.solved ? HOME.quizDone : HOME.quizMissed}</Badge>
                ) : (
                  <>
                    <span aria-hidden className={cx(buttonClass("secondary", "md"), ROW_BUTTON)}>
                      {HOME.quizPlay}
                    </span>
                    <RowChevron />
                  </>
                )}
              </div>
            )}

          </div>

          {playtest ? null : (
            <div className="md:col-span-4 [&>*]:h-full">
              <MissionsPanel compact />
            </div>
          )}
        </section>

        {/* ---- WITH FRIENDS (v2.2 share kit): the duel and the invitation. ------- */}
        {playtest ? null : <FriendsSection />}

        {/* ---- YOU --------------------------------------------------------------- */}
        {/* YOUR PROGRESS is one stat strip: four cells on a single board, the
            figure first and large, the label under it. The 1px gaps are the
            board's dividers. */}
        <h2 className="title-slab mt-12 text-xl md:text-2xl">{HOME.yourProgress}</h2>
        <section className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {locked ? (
            <div className="flex cursor-not-allowed flex-col justify-between gap-3 bg-surface p-4 opacity-70 sm:p-5" aria-disabled="true" title={HOME.collectionLocked}>
              <span className="text-faint" aria-hidden>
                <MenuLockGlyph />
              </span>
              <div>
                <h3 className="display text-base uppercase leading-none text-ink">{HOME.collection}</h3>
                <p className="mt-1.5 text-xs leading-snug text-sub">{HOME.collectionLocked}</p>
              </div>
            </div>
          ) : (
            <Tile href="/collection" title={HOME.collection} desc={HOME.collectionDesc} dot={dots.collection} dotLabel={NAV_UI.newHere}>
              <span className="display text-5xl font-extrabold leading-none text-ink">
                {mounted ? unlocked : 0}
                <span className="text-base text-faint">/{COUNTS.specialCards}</span>
              </span>
            </Tile>
          )}
          <Tile href="/achievements" title={HOME.achievements} desc={HOME.achievementsDesc}>
            <span className="display text-5xl font-extrabold leading-none text-ink">
              {mounted ? achieved : 0}
              <span className="text-base text-faint">/{COUNTS.achievements}</span>
            </span>
          </Tile>
          <Tile href="/profile" title={HOME.profile} desc={HOME.profileDesc} dot={dots.profile} dotLabel={NAV_UI.newHere}>
            {mounted ? <RankBadge rank={rank} variant="menu" size="sm" /> : <span className="h-12" />}
          </Tile>
          <Tile href="/leaderboards" title={HOME.leaderboards} desc={HOME.leaderboardsDesc}>
            <span className="flex h-12 items-center text-ink" aria-hidden>
              <TrophyGlyph />
            </span>
          </Tile>
        </section>

        {/* The two ways out at the end of the menu, side by side: the community Discord and the partner's site. */}
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {SITE.discordUrl ? (
          <a
            href={SITE.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-[#5865F2]/35 bg-[#5865F2]/[0.08] px-4 py-3 transition-colors hover:border-[#5865F2]/70 hover:bg-[#5865F2]/[0.14]"
          >
            <span className="shrink-0 text-[#aab1ff]" aria-hidden>
              <DiscordIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block text-sm uppercase tracking-wide text-ink">{HOME.joinDiscord}</span>
              <span className="block text-xs leading-relaxed text-sub">{HOME.discordDesc}</span>
            </span>
            <span className="shrink-0 text-[#aab1ff] transition-transform group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </a>
        ) : null}
        {fiftyFifty ? (
          SITE.partnerUrl ? (
            <a
              href={SITE.partnerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-line-strong bg-surface px-4 py-3 transition-colors hover:border-ink/50 hover:bg-surface-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a static-export asset URL from assets.ts (WebP in production) */}
              <img src={fiftyFifty} alt="50/50" width={72} height={28} className="h-7 w-auto shrink-0 object-contain" />
              <span className="min-w-0 flex-1">
                <span className="display block text-sm uppercase tracking-wide text-ink">{HOME.partnerVisit}</span>
                <span className="block text-xs leading-relaxed text-sub">{HOME.partnerDesc}</span>
              </span>
              <span className="shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </a>
          ) : (
            // TODO: set SITE.partnerUrl (config/site.ts) when Miguel has the 50/50 link; the card becomes a link.
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static-export asset URL from assets.ts (WebP in production) */}
              <img src={fiftyFifty} alt="50/50" width={72} height={28} className="h-7 w-auto shrink-0 object-contain" />
              <span className="min-w-0 flex-1">
                <span className="display block text-sm uppercase tracking-wide text-ink">{HOME.presentedBy} 50/50</span>
                <span className="block text-xs leading-relaxed text-sub">{HOME.partnerDesc}</span>
              </span>
              <span className="display shrink-0 rounded-sm bg-white/[0.06] px-1.5 py-1 text-[11px] font-medium uppercase leading-none tracking-[0.05em] text-sub">{HOME.partnerSoon}</span>
            </div>
          )
        ) : null}
        </div>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
          <AppLink href="/how-to-play" className="text-sm text-sub underline-offset-4 hover:text-ink hover:underline">
            {HOME.howToPlay}
          </AppLink>
          {SITE.authorUrl ? (
            <a
              href={SITE.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-sub underline-offset-4 hover:text-ink hover:underline"
            >
              <XGlyph /> {HOME.followTwitter}
            </a>
          ) : null}
          {/* Phone: the support link left the hero, so it sits with the other ways out. */}
          {SITE.supportUrl ? (
            <a
              href={SITE.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-sub underline-offset-4 hover:text-ink hover:underline sm:hidden"
            >
              <CoffeeGlyph className="h-3.5 w-3.5" /> {HOME.support}
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
            {QUIZ_UI.history}
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
    <AppLink href={href} className="group relative flex flex-col justify-between gap-4 bg-surface p-4 transition-colors hover:bg-surface-strong sm:p-5">
      {dot ? <NewDot className="absolute right-3 top-3" label={dotLabel} /> : null}
      {children}
      <div className="min-w-0">
        <h3 className="display text-base uppercase leading-none text-ink">{title}</h3>
        <p className="mt-1.5 hidden text-xs leading-snug text-sub sm:block">{desc}</p>
      </div>
    </AppLink>
  );
}

/** Discreet, low-key sign-in nudge (v1.4) — renders only when accounts are
 *  configured AND the player is signed out. Opens login without leaving home. */
function HomeSignInNudge() {
  const { HOME: H } = useCopy();
  const mounted = useMounted();
  const enabled = useAccountStore((s) => s.enabled);
  const status = useAccountStore((s) => s.status);
  if (!mounted || !enabled || status !== "signedOut") return null;
  return (
    <p className="mt-3 text-center">
      <button
        type="button"
        onClick={() => useSignInDialog.getState().show()}
        className="text-xs text-faint underline-offset-4 transition-colors hover:text-sub hover:underline"
      >
        {H.signInNudge}
      </button>
    </p>
  );
}

/** The phone's row affordance: this row opens something. Desktop rows keep their button. */
function RowChevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-faint sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
