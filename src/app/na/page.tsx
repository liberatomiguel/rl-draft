import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.na;

export const metadata = contentMetadata(PAGES_EN.na, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function NaPage() {
  return (
    <ContentPage
      slug="na"
      en={PAGES_EN.na}
      pt={PAGES_PT.na}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
