import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES["special-cards"];

export const metadata = contentMetadata(PAGES_EN["special-cards"], {
  enPath: R.en,
  ptPath: R.pt,
  locale: "en",
});

export default function SpecialCardsPage() {
  return (
    <ContentPage
      en={PAGES_EN["special-cards"]}
      pt={PAGES_PT["special-cards"]}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
