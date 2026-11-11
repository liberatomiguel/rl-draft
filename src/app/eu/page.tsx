import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.eu;

export const metadata = contentMetadata(PAGES_EN.eu, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function EuPage() {
  return (
    <ContentPage
      slug="eu"
      en={PAGES_EN.eu}
      pt={PAGES_PT.eu}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
