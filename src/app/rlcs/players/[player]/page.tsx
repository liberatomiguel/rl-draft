import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATABASE_UI, SETUP } from "@/content/copy.en";
import { PlayerView } from "@/components/database/DatabaseViews";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, withBrand } from "@/lib/contentMeta";
import { DB_PLAYERS, dbPlayer } from "@/lib/database";
import { breadcrumbJsonLd } from "@/lib/jsonld";

// Static export: every player page is written at build time, nothing else exists.
export const dynamicParams = false;
export function generateStaticParams() {
  return DB_PLAYERS.map((p) => ({ player: p.id }));
}

type Props = { params: Promise<{ player: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const player = dbPlayer((await params).player);
  if (!player) return {};
  const peak = player.entries.reduce((best, e) => (e.overall > best.overall ? e : best), player.entries[0]);
  return pageMetadata({
    title: withBrand(DATABASE_UI.playerTitle(player.nickname)),
    description: DATABASE_UI.playerIntro(
      player.nickname,
      SETUP.regionNames[player.region] ?? player.region,
      new Set(player.entries.map((e) => e.season.slug)).size,
      peak.overall,
      peak.team.name,
      peak.season.label,
    ),
    path: `/rlcs/players/${player.id}`,
  });
}

export default async function PlayerPage({ params }: Props) {
  const player = dbPlayer((await params).player);
  if (!player) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: DATABASE_UI.hubTitle, path: "/rlcs" },
          { name: DATABASE_UI.players, path: "/rlcs/players" },
          { name: player.nickname, path: `/rlcs/players/${player.id}` },
        ])}
      />
      <PlayerView player={player} />
    </>
  );
}
