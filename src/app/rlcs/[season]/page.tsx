import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATABASE_UI } from "@/content/copy.en";
import { SeasonView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_REGIONS, DB_SEASONS, dbSeason } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

// Static export: every season page is written at build time, nothing else exists.
export const dynamicParams = false;
export function generateStaticParams() {
  return DB_SEASONS.map((s) => ({ season: s.slug }));
}

type Props = { params: Promise<{ season: string }> };

function regionsOf(slug: string) {
  const season = dbSeason(slug);
  if (!season) return [];
  return DB_REGIONS.map((region) => ({ region, lineups: season.lineups.filter((l) => l.region === region) })).filter(
    (g) => g.lineups.length > 0,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const season = dbSeason((await params).season);
  if (!season) return {};
  return pageMetadata({
    title: withBrand(DATABASE_UI.seasonTitle(season.label)),
    description: DATABASE_UI.seasonIntro(season.label, season.lineups.length, regionsOf(season.slug).length),
    path: `/rlcs/${season.slug}`,
  });
}

export default async function SeasonPage({ params }: Props) {
  const season = dbSeason((await params).season);
  if (!season) notFound();
  const i = DB_SEASONS.indexOf(season);
  const neighbour = (s: (typeof DB_SEASONS)[number] | undefined) => (s ? { slug: s.slug, label: s.label } : null);
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: DATABASE_UI.hubTitle, path: "/rlcs" },
          { name: season.label, path: `/rlcs/${season.slug}` },
        ])}
      />
      <SeasonView
        label={season.label}
        rosters={season.lineups.length}
        groups={regionsOf(season.slug)}
        previous={neighbour(DB_SEASONS[i - 1])}
        next={neighbour(DB_SEASONS[i + 1])}
      />
    </>
  );
}
