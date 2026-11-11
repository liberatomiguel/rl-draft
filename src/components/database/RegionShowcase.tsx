"use client";

/**
 * A regional page's own data (v2.0, WEB-01): the region's strongest rosters,
 * the teams with the most rosters and the highest-rated players, each a link
 * into the public database. It is what makes /na differ from /eu beyond the
 * prose, and it gives every team and player of note an inbound link. Rendered
 * inside the article; the labels follow the EN/PT toggle.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useCopy } from "@/content/copy";
import type { DbRegionShowcase } from "@/lib/database";

const linkCls = "text-blue-bright underline-offset-4 transition-colors hover:text-cyan hover:underline";
const headingCls = "display text-lg font-bold uppercase tracking-wide text-orange-bright";

export function RegionShowcase({ data }: { data: DbRegionShowcase }) {
  const { DATABASE_UI: D } = useCopy();
  const { region } = data;
  return (
    <div className="mt-10 space-y-8">
      <section>
        <h2 className={headingCls}>{D.regionBest(region)}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          {data.rosters.map((r) => (
            <li key={`${r.team.id}-${r.season.slug}`} className="flex items-baseline justify-between gap-2">
              <span>
                <AppLink href={`/rlcs/teams/${r.team.id}`} className={linkCls}>
                  {r.team.name}
                </AppLink>{" "}
                <AppLink href={`/rlcs/${r.season.slug}#${region}`} className="text-xs text-sub hover:text-ink hover:underline">
                  {r.season.label}
                </AppLink>
              </span>
              <span className="display font-bold text-ink">{r.average}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className={headingCls}>{D.regionMost(region)}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          {data.teams.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-2">
              <AppLink href={`/rlcs/teams/${t.id}`} className={linkCls}>
                {t.name}
              </AppLink>
              <span className="text-xs text-sub">{D.rosterCount(t.rosters)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className={headingCls}>{D.regionTop(region)}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-4">
          {data.players.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-2">
              <AppLink href={`/rlcs/players/${p.id}`} className={linkCls}>
                {p.nickname}
              </AppLink>
              <span className="display text-xs font-bold text-ink">{p.peak}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <AppLink href={`/rlcs/teams#${region}`} className={linkCls}>
            {D.regionTeams(region)}
          </AppLink>
          <AppLink href={`/rlcs/players#${region}`} className={linkCls}>
            {D.regionAllPlayers(region)}
          </AppLink>
        </p>
      </section>
    </div>
  );
}
