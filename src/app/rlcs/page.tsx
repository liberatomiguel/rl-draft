import type { Metadata } from "next";
import { DATABASE_UI } from "@/content/copy.en";
import { DatabaseHubView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_LINEUPS, DB_REGIONS, DB_SEASONS, DB_TEAMS, DB_TOTALS } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

/** The public RLCS database hub (v2.0, WEB-01): seasons, regions, teams, players. */
export const metadata: Metadata = pageMetadata({
  title: withBrand(DATABASE_UI.hubTitle),
  description: DATABASE_UI.hubDescription(DB_TOTALS.lineups, DB_TOTALS.teams, DB_TOTALS.players),
  path: "/rlcs",
});

export default function DatabaseHubPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: DATABASE_UI.hubTitle, path: "/rlcs" }])} />
      <DatabaseHubView
        totals={DB_TOTALS}
        seasons={[...DB_SEASONS].reverse().map((s) => ({ slug: s.slug, label: s.label, rosters: s.lineups.length }))}
        regions={DB_REGIONS.map((id) => ({
          id,
          rosters: DB_LINEUPS.filter((l) => l.region === id).length,
          teams: DB_TEAMS.filter((t) => t.region === id).length,
        }))}
      />
    </>
  );
}
