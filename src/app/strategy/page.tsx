import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.strategy;

export const metadata = contentMetadata(PAGES_EN.strategy, { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function StrategyPage() {
  return (
    <ContentPage
      en={PAGES_EN.strategy}
      pt={PAGES_PT.strategy}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
