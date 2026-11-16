import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES["career-finances"];

// A Road to Worlds guide: like the landing page, it exists only in a build that ships the
// career mode. With the flag off it is a 404 boundary (never indexed) and
// scripts/postexport.mjs deletes the exported file, as it does for /career.
export const metadata = FEATURES.careerMode
  ? contentMetadata(PAGES_EN["career-finances"], { enPath: R.en, ptPath: R.pt, locale: "en" })
  : { robots: { index: false, follow: false } };

export default function CareerFinancesGuidePage() {
  if (!FEATURES.careerMode) notFound();
  return (
    <ContentPage
      slug="career-finances"
      en={PAGES_EN["career-finances"]}
      pt={PAGES_PT["career-finances"]}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/"
    />
  );
}
