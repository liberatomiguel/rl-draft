import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/contentMeta";
import { PlayView } from "./PlayView";

export const metadata: Metadata = pageMetadata({
  title: `Play the RLCS Draft Online — Free · ${SITE.name}`,
  description: `Start a ${SITE.name} run: choose Classic or Quick Draft, a difficulty and a region, draft a roster from RLCS history and take it through an RLCS-style bracket. Free, no download.`,
  path: "/play",
});

export default function PlayPage() {
  return <PlayView />;
}
