import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.oce;

export const metadata = contentMetadata(PAGES_PT.oce, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtOcePage() {
  return (
    <ContentPage
      slug="oce"
      en={PAGES_EN.oce}
      pt={PAGES_PT.oce}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/"
    />
  );
}
