import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { CollectionView } from "./CollectionView";

export const metadata: Metadata = {
  title: "Card Collection",
  description: `Browse the ${SITE.name} special-card album — legendary RLCS players and moments to unlock by winning runs. Track your collection by rarity, from rare to legendary.`,
  alternates: { canonical: "/collection" },
  robots: { index: true, follow: true },
};

export default function CollectionPage() {
  return <CollectionView />;
}
