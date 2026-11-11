import { notFound } from "next/navigation";
import { FEATURES } from "@/config/balance";
import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.manager;

// The Road to Worlds landing page: it exists only in a build that ships the
// career mode. With the flag off it is a 404 boundary (never indexed) and
// scripts/postexport.mjs deletes the exported file, as it does for /career.
export const metadata = FEATURES.careerMode
  ? contentMetadata(PAGES_EN.manager, { enPath: R.en, ptPath: R.pt, locale: "en" })
  : { robots: { index: false, follow: false } };

export default function ManagerPage() {
  if (!FEATURES.careerMode) notFound();
  return (
    <ContentPage
      slug="manager"
      en={PAGES_EN.manager}
      pt={PAGES_PT.manager}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/career"
    />
  );
}
