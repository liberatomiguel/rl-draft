import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { duelShareSrc } from "@/lib/assets";
import { DuelView } from "./DuelView";

const TITLE = `Friend Duel: the Same RLCS Draft, Head to Head · ${SITE.name}`;

// The duel itself is in the URL hash (`/duel#c=…`), read on the client: the
// static page is the same file for every link, and the hash never reaches the
// server. Not for search results (it is empty without a link).
export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: `You've been challenged in ${SITE.name}: the same seed, the same draft offers and the same bracket field as your friend. Draft a roster from RLCS history and see whose run holds up. Free, no sign-up.`,
  path: "/duel",
  index: false,
  image: { url: duelShareSrc(), alt: "Rocket Draft friend duel: same draft, same bracket" },
});

export default function DuelPage() {
  return <DuelView />;
}
