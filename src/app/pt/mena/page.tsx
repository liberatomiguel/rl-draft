import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.mena;

export const metadata = contentMetadata(PAGES_PT.mena, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtMenaPage() {
  return (
    <ContentPage
      slug="mena"
      en={PAGES_EN.mena}
      pt={PAGES_PT.mena}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/"
    />
  );
}
