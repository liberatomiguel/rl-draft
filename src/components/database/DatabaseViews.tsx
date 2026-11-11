"use client";

/**
 * The public RLCS database screens (v2.0, WEB-01): /rlcs and the season, team
 * and player pages under it. Client Components only so the labels follow the
 * EN/PT toggle (`useCopy`); every record arrives as props from the Server
 * Component route, which reads `@/lib/database` at build time, so the dataset
 * itself never enters a client bundle and the HTML is complete without JS.
 */

import { AppLink } from "@/components/ui/AppLink";
import { useCopy, useUiLocale } from "@/content/copy";
import { PAGE_ROUTES, REGION_PAGES, localePath, type PageSlug } from "@/content/pageRoutes";
import type { DbLineup, DbPlayer, DbTeam } from "@/lib/database";

const linkCls = "text-blue-bright underline-offset-4 transition-colors hover:text-cyan hover:underline";

/** The regional content page of a dataset region, when it has one. */
function regionSlug(region: string): PageSlug | null {
  const found = (Object.keys(REGION_PAGES) as PageSlug[]).find((slug) => REGION_PAGES[slug] === region);
  return found && PAGE_ROUTES[found] ? found : null;
}

function RegionName({ region }: { region: string }) {
  const { SETUP } = useCopy();
  const locale = useUiLocale();
  const slug = regionSlug(region);
  const name = SETUP.regionNames[region] ?? region;
  const label = name === region ? region : `${region} · ${name}`;
  return slug ? (
    <AppLink href={localePath(slug, locale)} className={linkCls}>
      {label}
    </AppLink>
  ) : (
    <>{label}</>
  );
}

function Shell({
  title,
  intro,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  intro: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  const { DATABASE_UI: D } = useCopy();
  const locale = useUiLocale();
  return (
    <article className="mx-auto max-w-4xl">
      <AppLink
        href={backHref}
        className="display inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sub transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> {backLabel}
      </AppLink>
      <header className="mt-6">
        <p className="kicker mb-2">{D.kicker}</p>
        <h1 className="display text-3xl font-bold uppercase leading-tight tracking-wide text-ink md:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-sub">{intro}</p>
      </header>
      <div className="mt-10 space-y-10">{children}</div>
      <p className="mt-10 text-sm leading-relaxed text-sub">
        {D.ratingsNote}{" "}
        {/* Underlined: a link inside a sentence must not rely on colour alone. */}
        <AppLink href={localePath("ratings", locale)} className={`${linkCls} underline`}>
          {D.ratingsLink}
        </AppLink>
      </p>
      <p className="mt-10 text-center">
        <AppLink
          href="/play"
          className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.3)] transition-all hover:brightness-110"
        >
          {D.cta}
        </AppLink>
      </p>
    </article>
  );
}

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="display scroll-mt-24 text-lg font-bold uppercase tracking-wide text-orange-bright">
      {children}
    </h2>
  );
}

/** One roster: team, season, the three players with their overalls, the staff. */
function RosterCard({ lineup, show }: { lineup: DbLineup; show: "team" | "season" }) {
  const { DATABASE_UI: D } = useCopy();
  return (
    <li className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="display text-base font-bold uppercase tracking-wide text-ink">
          {show === "team" ? (
            <AppLink href={`/rlcs/teams/${lineup.team.id}`} className="hover:underline">
              {lineup.name}
            </AppLink>
          ) : (
            <AppLink href={`/rlcs/${lineup.season.slug}`} className="hover:underline">
              {lineup.season.label}
            </AppLink>
          )}
        </h3>
        <p className="text-xs text-sub">
          {show === "season" && lineup.name !== lineup.team.name ? `${lineup.name} · ` : ""}
          {show === "season" ? `${lineup.region} · ` : ""}
          {D.colAverage}: <span className="display text-sm font-bold text-ink">{lineup.average}</span>
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {lineup.players.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-2">
            <AppLink href={`/rlcs/players/${p.id}`} className={linkCls}>
              {p.nickname}
            </AppLink>
            <span className="display font-bold text-ink">{p.overall}</span>
          </li>
        ))}
      </ul>
      {lineup.coach || lineup.sub || lineup.regionOnly ? (
        <p className="mt-3 text-xs leading-relaxed text-sub">
          {[
            lineup.coach ? `${D.coach}: ${lineup.coach}` : null,
            lineup.sub ? `${D.sub}: ${lineup.sub}` : null,
            lineup.regionOnly ? D.regionOnly : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

// ───────────────────────────── Hub ─────────────────────────────

export function DatabaseHubView({
  totals,
  seasons,
  regions,
}: {
  totals: { lineups: number; teams: number; players: number; seasons: number };
  seasons: { slug: string; label: string; rosters: number }[];
  regions: { id: string; rosters: number; teams: number }[];
}) {
  const { DATABASE_UI: D, NAV_UI } = useCopy();
  return (
    <Shell
      title={D.hubTitle}
      intro={D.hubIntro(totals.lineups, totals.teams, totals.players, totals.seasons)}
      backHref="/"
      backLabel={NAV_UI.backToMenu}
    >
      <section>
        <SectionHeading>{D.seasons}</SectionHeading>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
          {seasons.map((s) => (
            <li key={s.slug} className="flex items-baseline justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <AppLink href={`/rlcs/${s.slug}`} className={linkCls}>
                {s.label}
              </AppLink>
              <span className="text-xs text-sub">{D.rosterCount(s.rosters)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionHeading>{D.regions}</SectionHeading>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {regions.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <span>
                <RegionName region={r.id} />
              </span>
              <AppLink href={`/rlcs/teams#${r.id}`} className="text-xs text-sub hover:text-ink hover:underline">
                {D.teamCount(r.teams)} · {D.rosterCount(r.rosters)}
              </AppLink>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <SectionHeading>
          {D.teams} · {D.players}
        </SectionHeading>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <li>
            <AppLink href="/rlcs/teams" className={linkCls}>
              {D.allTeams} ({totals.teams})
            </AppLink>
          </li>
          <li>
            <AppLink href="/rlcs/players" className={linkCls}>
              {D.allPlayers} ({totals.players})
            </AppLink>
          </li>
        </ul>
      </section>
    </Shell>
  );
}

// ───────────────────────────── Season ─────────────────────────────

export function SeasonView({
  label,
  rosters,
  groups,
  previous,
  next,
}: {
  label: string;
  rosters: number;
  groups: { region: string; lineups: DbLineup[] }[];
  previous: { slug: string; label: string } | null;
  next: { slug: string; label: string } | null;
}) {
  const { DATABASE_UI: D } = useCopy();
  return (
    <Shell
      title={D.seasonTitle(label)}
      intro={D.seasonIntro(label, rosters, groups.length)}
      backHref="/rlcs"
      backLabel={D.backToDatabase}
    >
      {groups.map((g) => (
        <section key={g.region}>
          <SectionHeading id={g.region}>
            <RegionName region={g.region} />
          </SectionHeading>
          <ul className="mt-3 space-y-3">
            {g.lineups.map((l) => (
              <RosterCard key={l.id} lineup={l} show="team" />
            ))}
          </ul>
        </section>
      ))}
      {previous || next ? (
        <nav aria-label={D.seasons} className="flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-sm font-semibold">
          {previous ? (
            <AppLink href={`/rlcs/${previous.slug}`} className={linkCls}>
              ← {previous.label}
            </AppLink>
          ) : (
            <span />
          )}
          {next ? (
            <AppLink href={`/rlcs/${next.slug}`} className={linkCls}>
              {next.label} →
            </AppLink>
          ) : null}
        </nav>
      ) : null}
    </Shell>
  );
}

// ───────────────────────────── Team ─────────────────────────────

export function TeamView({ team }: { team: DbTeam }) {
  const { DATABASE_UI: D, SETUP } = useCopy();
  const first = team.lineups[0].season.label;
  const last = team.lineups[team.lineups.length - 1].season.label;
  return (
    <Shell
      title={D.teamTitle(team.name)}
      intro={D.teamIntro(team.name, SETUP.regionNames[team.region] ?? team.region, team.lineups.length, first, last)}
      backHref="/rlcs/teams"
      backLabel={D.allTeams}
    >
      <section>
        <SectionHeading>
          <RegionName region={team.region} />
        </SectionHeading>
        <ul className="mt-3 space-y-3">
          {[...team.lineups].reverse().map((l) => (
            <RosterCard key={l.id} lineup={l} show="season" />
          ))}
        </ul>
      </section>
    </Shell>
  );
}

// ───────────────────────────── Player ─────────────────────────────

export function PlayerView({ player }: { player: DbPlayer }) {
  const { DATABASE_UI: D, SETUP } = useCopy();
  const peak = player.entries.reduce((best, e) => (e.overall > best.overall ? e : best), player.entries[0]);
  return (
    <Shell
      title={D.playerTitle(player.nickname)}
      intro={D.playerIntro(
        player.nickname,
        SETUP.regionNames[player.region] ?? player.region,
        new Set(player.entries.map((e) => e.season.slug)).size,
        peak.overall,
        peak.team.name,
        peak.season.label,
      )}
      backHref="/rlcs/players"
      backLabel={D.allPlayers}
    >
      <section>
        <SectionHeading>
          <RegionName region={player.region} /> · {player.country}
        </SectionHeading>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-sub">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">{D.colSeason}</th>
                <th scope="col" className="px-4 py-2 font-semibold">{D.colTeam}</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">{D.colOverall}</th>
              </tr>
            </thead>
            <tbody>
              {[...player.entries].reverse().map((e) => (
                <tr key={`${e.season.slug}-${e.team.id}`} className="border-t border-line">
                  <td className="px-4 py-2">
                    <AppLink href={`/rlcs/${e.season.slug}`} className={linkCls}>
                      {e.season.label}
                    </AppLink>
                  </td>
                  <td className="px-4 py-2">
                    <AppLink href={`/rlcs/teams/${e.team.id}`} className={linkCls}>
                      {e.team.name}
                    </AppLink>
                  </td>
                  <td className="display px-4 py-2 text-right font-bold text-ink">{e.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

// ───────────────────────────── Indexes ─────────────────────────────

export function TeamsIndexView({
  total,
  groups,
}: {
  total: number;
  groups: { region: string; teams: { id: string; name: string; rosters: number }[] }[];
}) {
  const { DATABASE_UI: D } = useCopy();
  return (
    <Shell title={D.teamsIndexTitle} intro={D.teamsIndexIntro(total)} backHref="/rlcs" backLabel={D.backToDatabase}>
      {groups.map((g) => (
        <section key={g.region}>
          <SectionHeading id={g.region}>
            <RegionName region={g.region} /> <span className="text-sm text-sub">({g.teams.length})</span>
          </SectionHeading>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 md:grid-cols-3">
            {g.teams.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-2">
                <AppLink href={`/rlcs/teams/${t.id}`} className={linkCls}>
                  {t.name}
                </AppLink>
                <span className="text-xs text-sub">{t.rosters}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}

export function PlayersIndexView({
  total,
  groups,
}: {
  total: number;
  groups: { region: string; players: { id: string; nickname: string; peak: number }[] }[];
}) {
  const { DATABASE_UI: D } = useCopy();
  return (
    <Shell title={D.playersIndexTitle} intro={D.playersIndexIntro(total)} backHref="/rlcs" backLabel={D.backToDatabase}>
      {groups.map((g) => (
        <section key={g.region}>
          <SectionHeading id={g.region}>
            <RegionName region={g.region} /> <span className="text-sm text-sub">({g.players.length})</span>
          </SectionHeading>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 md:grid-cols-4">
            {g.players.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2">
                <AppLink href={`/rlcs/players/${p.id}`} className={linkCls}>
                  {p.nickname}
                </AppLink>
                <span className="display text-xs font-bold text-ink">{p.peak}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
