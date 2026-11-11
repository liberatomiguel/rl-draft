import type { Metadata } from "next";
import { DATABASE_UI } from "@/content/copy.en";
import { TeamsIndexView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_REGIONS, DB_TEAMS } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = pageMetadata({
  title: withBrand(DATABASE_UI.teamsIndexTitle),
  description: DATABASE_UI.teamsIndexIntro(DB_TEAMS.length),
  path: "/rlcs/teams",
});

export default function TeamsIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: DATABASE_UI.hubTitle, path: "/rlcs" },
          { name: DATABASE_UI.teams, path: "/rlcs/teams" },
        ])}
      />
      <TeamsIndexView
        total={DB_TEAMS.length}
        groups={DB_REGIONS.map((region) => ({
          region,
          teams: DB_TEAMS.filter((t) => t.region === region).map((t) => ({
            id: t.id,
            name: t.name,
            rosters: t.lineups.length,
          })),
        })).filter((g) => g.teams.length > 0)}
      />
    </>
  );
}
