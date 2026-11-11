import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES["simulator"];

export const metadata = contentMetadata(PAGES_EN["simulator"], { enPath: R.en, ptPath: R.pt, locale: "en" });

export default function SimulatorPage() {
  return (
    <ContentPage
      slug="simulator"
      en={PAGES_EN["simulator"]}
      pt={PAGES_PT["simulator"]}
      initialLocale="en"
      path={R.en}
      backHref="/"
      ctaHref="/play"
    />
  );
}
