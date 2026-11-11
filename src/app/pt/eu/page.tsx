import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.eu;

export const metadata = contentMetadata(PAGES_PT.eu, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtEuPage() {
  return (
    <ContentPage
      slug="eu"
      en={PAGES_EN.eu}
      pt={PAGES_PT.eu}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/play"
    />
  );
}
