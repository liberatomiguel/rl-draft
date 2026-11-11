import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATABASE_UI, SETUP } from "@/content/copy.en";
import { TeamView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_TEAMS, dbTeam } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

// Static export: every team page is written at build time, nothing else exists.
export const dynamicParams = false;
export function generateStaticParams() {
  return DB_TEAMS.map((t) => ({ team: t.id }));
}

type Props = { params: Promise<{ team: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = dbTeam((await params).team);
  if (!team) return {};
  return pageMetadata({
    title: withBrand(DATABASE_UI.teamTitle(team.name)),
    description: DATABASE_UI.teamIntro(
      team.name,
      SETUP.regionNames[team.region] ?? team.region,
      team.lineups.length,
      team.lineups[0].season.label,
      team.lineups[team.lineups.length - 1].season.label,
    ),
    path: `/rlcs/teams/${team.id}`,
  });
}

export default async function TeamPage({ params }: Props) {
  const team = dbTeam((await params).team);
  if (!team) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: DATABASE_UI.hubTitle, path: "/rlcs" },
          { name: DATABASE_UI.teams, path: "/rlcs/teams" },
          { name: team.name, path: `/rlcs/teams/${team.id}` },
        ])}
      />
      <TeamView team={team} />
    </>
  );
}
