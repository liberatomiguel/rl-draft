import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { duelShareSrc } from "@/lib/assets";
import { DuelView } from "./DuelView";

// rc9 duel-ui: the team-against-team duel (DESIGN-DECISIONS #294).
const TITLE = `Duel a Friend: Draft RLCS Teams and Play a Best of 7 · ${SITE.name}`;

// The duel itself is in the URL hash (`/duel#c=…`), read on the client: the
// static page is the same file for every link, and the hash never reaches the
// server. Not for search results (it is empty without a link).
export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: `You've been challenged in ${SITE.name}: draft a roster from RLCS history on the same boards as your friend, then watch your two teams play a best of 7. Free, no sign-up.`,
  path: "/duel",
  index: false,
  image: { url: duelShareSrc(), alt: "Rocket Draft friend duel: draft a team from RLCS history and play your friend's team in a best of 7" },
});

export default function DuelPage() {
  return <DuelView />;
}
