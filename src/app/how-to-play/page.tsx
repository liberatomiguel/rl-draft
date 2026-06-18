import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { HOWTO } from "@/content/copy.en";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, howToJsonLd } from "@/lib/jsonld";
import { HowToPlayView } from "./HowToPlayView";

export const metadata: Metadata = {
  title: "How to Play",
  description: `Learn how to play ${SITE.name}: draft a roster from iconic RLCS lineups, build team chemistry, and survive an RLCS-style tournament bracket. Rules, chemistry and difficulty modes explained.`,
  alternates: { canonical: "/how-to-play" },
  robots: { index: true, follow: true },
};

const HOW_TO = howToJsonLd({
  name: `How to play ${SITE.name}`,
  description:
    "Draft a roster from historical RLCS lineups, build chemistry, and survive an RLCS-style tournament bracket.",
  steps: HOWTO.steps.map((s) => ({ name: s.title, text: s.body })),
});

export default function HowToPlayPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: HOWTO.title, path: "/how-to-play" }])} />
      <JsonLd data={HOW_TO} />
      <HowToPlayView />
    </>
  );
}
