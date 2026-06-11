"use client";

/** Home: hero, game modes, quick profile strip. */

import Link from "next/link";
import { specialCards } from "@/data";
import { APP, HOME } from "@/content/copy";
import { rankForXp } from "@/engine/progression";
import { cx } from "@/lib/util";
import { useMounted } from "@/store/useMounted";
import { useProfileStore, selectChampionships } from "@/store/profileStore";
import { useRunStore } from "@/store/runStore";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";

export default function HomePage() {
  const mounted = useMounted();
  const xp = useProfileStore((s) => s.xp);
  const runs = useProfileStore((s) => s.runsCompleted);
  const titles = useProfileStore(selectChampionships);
  const unlocked = useProfileStore((s) => Object.keys(s.unlockedSpecials).length);
  const activeRun = useRunStore((s) => s.run);
  const rank = rankForXp(xp);

  return (
    <div className="rise-in">
      {/* Hero */}
      <section className="px-2 py-10 text-center md:py-16">
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

        <div className="mt-8 flex justify-center">
          <Link
            href="/play"
            className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-10 py-3.5 text-base font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_36px_rgba(249,115,22,0.35)] transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            {mounted && activeRun ? "Continue run" : "Play now"}
          </Link>
        </div>

        {mounted && runs > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <Badge tone="blue">{rank.label}</Badge>
            <Badge tone="neutral">{xp} XP</Badge>
            <Badge tone="neutral">{runs} runs</Badge>
            {titles > 0 ? <Badge tone="gold">{titles} titles</Badge> : null}
          </div>
        ) : null}
      </section>

      {/* Modes */}
      <section aria-label="Game modes" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ModeCard
          href="/play"
          title={HOME.playClassic}
          description={HOME.playClassicDesc}
          accent
        />
        <ModeCard title={HOME.quickDraft} description={HOME.quickDraftDesc} soon />
        <ModeCard title={HOME.daily} description={HOME.dailyDesc} soon />
      </section>

      {/* Secondary */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <Link href="/profile" className="group">
          <Panel className="flex h-full items-center justify-between gap-4 p-5 transition-colors group-hover:!border-line-strong">
            <div>
              <h3 className="display text-lg font-bold uppercase tracking-wide text-ink">
                {HOME.profile}
              </h3>
              <p className="mt-1 text-xs text-sub">{HOME.profileDesc}</p>
            </div>
            <span className="display shrink-0 text-lg font-bold uppercase text-orange-bright">
              {mounted ? rank.label : "—"}
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

      <p className="mt-10 text-center text-[11px] leading-relaxed text-faint md:hidden">
        {APP.disclaimer}
      </p>
    </div>
  );
}

function ModeCard({
  href,
  title,
  description,
  accent,
  soon,
}: {
  href?: string;
  title: string;
  description: string;
  accent?: boolean;
  soon?: boolean;
}) {
  const inner = (
    <Panel
      strong={accent}
      glow={accent ? "orange" : undefined}
      className={cx(
        "relative h-full p-5 transition-all",
        accent && "!border-orange/40",
        href && "hover:-translate-y-0.5 hover:!border-orange/60",
        soon && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="display text-xl font-bold uppercase tracking-wide text-ink">{title}</h3>
        {soon ? <Badge tone="neutral">{HOME.comingSoon}</Badge> : accent ? <Badge tone="orange">Live</Badge> : null}
      </div>
      <p className="text-xs leading-relaxed text-sub">{description}</p>
    </Panel>
  );
  return href ? <Link href={href}>{inner}</Link> : <div aria-disabled>{inner}</div>;
}
