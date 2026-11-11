import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { CollectionView } from "./CollectionView";

export const metadata: Metadata = pageMetadata({
  title: `RLCS Card Collection — Special Cards Album · ${SITE.name}`,
  description: `Browse the ${SITE.name} special-card album — legendary RLCS players and moments to unlock by finishing runs. Track your collection by rarity, from rare to legendary.`,
  path: "/collection",
});

export default function CollectionPage() {
  return <CollectionView />;
}
