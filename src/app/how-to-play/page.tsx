/** Static rules explainer. Server component — no store access needed. */

import type { Metadata } from "next";
import Link from "next/link";
import { DIFFICULTY } from "@/config/balance";
import { Panel, SectionTitle } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "How to Play" };

const STEPS = [
  {
    title: "Draft your roster",
    body: "Each round shows one real historical RLCS lineup. Take exactly one card — a player, the coach, the substitute or the organization. The lineup pool is always fully random, on every difficulty.",
  },
  {
    title: "Free choice, six slots",
    body: "You need 3 players, 1 coach, 1 substitute and 1 org. Pick in any order. Once a person is on your roster, their other versions can't be drafted again this run. If your player slots are full, player cards can still be drafted as your substitute.",
  },
  {
    title: "Build chemistry",
    body: "Same historical lineup is the strongest link, same country is strong, same organization counts too. Coaches and subs connected to your players add a little more. Chemistry adds rating — more on higher difficulties.",
  },
  {
    title: "Survive the bracket",
    body: "16 teams. Swiss stage in best-of-5: 3 wins to advance, 3 losses and you're out. Top 8 seed into a single-elimination best-of-7 bracket. Your team rating is driven mostly by player overalls — chemistry, org buffs, coach and special effects add the edge.",
  },
  {
    title: "Collect special cards",
    body: "Rare special versions of cards can appear in any draft: iconic moments, MVP runs, legends. Draft one and finish the run — win or lose — and it's unlocked in your collection forever.",
  },
] as const;

export default function HowToPlayPage() {
  return (
    <div className="rise-in mx-auto max-w-3xl">
      <SectionTitle kicker="Rules of the game" title="How to Play" className="mb-8" />

      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={i}>
            <Panel className="flex gap-4 p-5">
              <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue/15 text-base font-bold text-blue-bright">
                {i + 1}
              </span>
              <div>
                <h2 className="display mb-1 text-lg font-bold uppercase tracking-wide text-ink">
                  {step.title}
                </h2>
                <p className="text-sm leading-relaxed text-sub">{step.body}</p>
              </div>
            </Panel>
          </li>
        ))}
      </ol>

      <SectionTitle title="Difficulties" className="mb-4 mt-10" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((id) => {
          const d = DIFFICULTY[id];
          return (
            <Panel key={id} className="p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="display text-base font-bold uppercase tracking-wide text-ink">
                  {d.label}
                </h3>
                {d.requiresLegacyUnlock ? <Badge tone="gold">Unlockable</Badge> : null}
              </div>
              <p className="mb-3 text-xs leading-relaxed text-sub">{d.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="blue">
                  {d.rerolls} reroll{d.rerolls === 1 ? "" : "s"}
                </Badge>
                <Badge tone="neutral">{d.overallLockedHidden ? "OVR locked hidden" : "OVR optional"}</Badge>
                <Badge tone="neutral">XP ×{d.xpMultiplier}</Badge>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-10 p-5 text-sm leading-relaxed text-sub">
        <h3 className="display mb-2 text-base font-bold uppercase tracking-wide text-ink">
          Card rarities
        </h3>
        <p>
          Base cards are <span className="font-semibold text-slate-300">Silver</span> (79 or
          below), <span className="font-semibold text-amber-300">Gold</span> (80–89) and{" "}
          <span className="font-semibold text-cyan">Blue</span> (90+). With overalls hidden,
          base cards turn black and show <span className="display font-bold">??</span> — special
          cards keep their look, but the number stays hidden until the results screen.
        </p>
      </Panel>

      <p className="mt-10 text-center">
        <Link
          href="/play"
          className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.3)] transition-all hover:brightness-110"
        >
          Start your first draft
        </Link>
      </p>
    </div>
  );
}
