import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES["fantasy"];

export const metadata = contentMetadata(PAGES_EN["fantasy"], { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function FantasyDraftPage() {
  return (
    <ContentPage
      slug="fantasy"
      en={PAGES_EN["fantasy"]}
      pt={PAGES_PT["fantasy"]}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
