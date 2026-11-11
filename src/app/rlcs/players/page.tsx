import type { Metadata } from "next";
import { DATABASE_UI } from "@/content/copy.en";
import { PlayersIndexView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_PLAYERS, DB_REGIONS } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = pageMetadata({
  title: withBrand(DATABASE_UI.playersIndexTitle),
  description: DATABASE_UI.playersIndexIntro(DB_PLAYERS.length),
  path: "/rlcs/players",
});

export default function PlayersIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: DATABASE_UI.hubTitle, path: "/rlcs" },
          { name: DATABASE_UI.players, path: "/rlcs/players" },
        ])}
      />
      <PlayersIndexView
        total={DB_PLAYERS.length}
        groups={DB_REGIONS.map((region) => ({
          region,
          players: DB_PLAYERS.filter((p) => p.region === region).map((p) => ({
            id: p.id,
            nickname: p.nickname,
            peak: p.peak,
          })),
        })).filter((g) => g.players.length > 0)}
      />
    </>
  );
}
