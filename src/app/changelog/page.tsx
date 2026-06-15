import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${SITE.name} — release history and notable changes.`,
  alternates: { canonical: "/changelog" },
};

interface Release {
  version: string;
  name?: string;
  date: string;
  current?: boolean;
  notes: string[];
}

/** Player-facing release notes (curated — dev detail lives in docs/CHANGELOG.md). */
const RELEASES: Release[] = [
  {
    version: "1.0.0",
    name: "Kickoff",
    date: "2026",
    current: true,
    notes: [
      "Public launch on rocketdraft.app.",
      "Full Portuguese (PT-BR) translation with a language switcher.",
      "Settings: volume, reduced motion, animation speed and language.",
      "Subtle sound effects throughout the draft and tournament.",
      "Richer daily challenges with a fixed seed and a daily number.",
      "Card polish: rarity-colored overalls, holographic special cards on the field, sharper layouts.",
      "Export / import your progress so it's never lost.",
    ],
  },
  {
    version: "0.6.x",
    name: "Main Stage",
    date: "2026",
    notes: [
      "Reworked special-card rarities (legendary white-gold, mythic red, epic, rare) with effects that ramp by tier.",
      "Rank-up and card-unlock celebrations; first-Hard-win unlocks the Legacy gauntlet.",
      "Smoother mobile play and a one-tap run reset.",
    ],
  },
  {
    version: "0.5.x",
    date: "2026",
    notes: [
      "First live playtest round: balance overhaul and a more readable tournament playback.",
      "Special cards belong to the player; slot-machine lineup reveal in the draft.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026",
    notes: ["Full RLCS finals dataset — 208 lineups, 624 cards, 2016–2026."],
  },
  {
    version: "0.1.0 – 0.3.0",
    date: "2025–2026",
    notes: [
      "Core draft, Swiss + double-elimination tournament, collection, achievements and progression.",
      "Quick Draft and Daily Challenge modes.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="rise-in mx-auto max-w-3xl">
      <BackToMenu />
      <header className="mb-8">
        <p className="kicker mb-1">Release notes</p>
        <h1 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">
          Changelog
        </h1>
      </header>

      <ol className="space-y-6">
        {RELEASES.map((r) => (
          <li
            key={r.version}
            className="panel relative p-5"
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="display text-lg font-bold text-ink">
                v{r.version}
                {r.name ? <span className="ml-2 text-orange-bright">{r.name}</span> : null}
              </span>
              {r.current ? (
                <span className="display rounded-md border border-orange/40 bg-orange/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-bright">
                  Latest
                </span>
              ) : null}
              <span className="ml-auto text-xs text-faint">{r.date}</span>
            </div>
            <ul className="space-y-1.5">
              {r.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-sub">
                  <span className="mt-2 h-1 w-1.5 shrink-0 -skew-x-12 bg-blue" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
