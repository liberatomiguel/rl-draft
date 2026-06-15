"use client";

/** Client view so the notes follow the EN/PT language switch (v1.1.0).
 *  Metadata stays on the server page.tsx for SEO. Version numbers, codenames
 *  and dates are language-agnostic; only the bullet notes + labels translate. */

import { useCopy } from "@/content/copy";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";

export function ChangelogView() {
  const { CHANGELOG_PAGE } = useCopy();

  return (
    <div className="rise-in mx-auto max-w-3xl">
      <BackToMenu />
      <header className="mb-8">
        <p className="kicker mb-1">{CHANGELOG_PAGE.kicker}</p>
        <h1 className="display text-3xl font-bold uppercase tracking-wide text-ink md:text-4xl">
          {CHANGELOG_PAGE.title}
        </h1>
      </header>

      <ol className="space-y-6">
        {CHANGELOG_PAGE.releases.map((r) => (
          <li key={r.version} className="panel relative p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="display text-lg font-bold text-ink">
                v{r.version}
                {r.name ? <span className="ml-2 text-orange-bright">{r.name}</span> : null}
              </span>
              {r.current ? (
                <span className="display rounded-md border border-orange/40 bg-orange/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-bright">
                  {CHANGELOG_PAGE.latest}
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
