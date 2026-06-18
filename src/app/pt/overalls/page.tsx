import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.ratings;

export const metadata = contentMetadata(PAGES_PT.ratings, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtOverallsPage() {
  return (
    <ContentPage
      en={PAGES_EN.ratings}
      pt={PAGES_PT.ratings}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/play"
    />
  );
}
