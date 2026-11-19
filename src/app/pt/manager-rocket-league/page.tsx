import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { careerShareSrc } from "@/lib/assets";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.manager;

// The Road to Worlds landing page: it exists only in a build that ships the
// career mode. With the flag off it is a 404 boundary (never indexed) and
// scripts/postexport.mjs deletes the exported file, as it does for /career.
export const metadata = FEATURES.careerMode
  ? contentMetadata(PAGES_PT.manager, {
      enPath: R.en,
      ptPath: R.pt,
      locale: "pt",
      // v2.0.33: its own share image (scripts/build-og-career.mjs).
      image: { url: careerShareSrc("pt"), alt: PAGES_PT.manager.title },
    })
  : { robots: { index: false, follow: false } };

export default function PtManagerPage() {
  if (!FEATURES.careerMode) notFound();
  return (
    <ContentPage
      slug="manager"
      en={PAGES_EN.manager}
      pt={PAGES_PT.manager}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/career"
    />
  );
}
