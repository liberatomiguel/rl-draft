import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES["simulator"];

export const metadata = contentMetadata(PAGES_PT["simulator"], { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtSimuladorPage() {
  return (
    <ContentPage
      slug="simulator"
      en={PAGES_EN["simulator"]}
      pt={PAGES_PT["simulator"]}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/"
    />
  );
}
