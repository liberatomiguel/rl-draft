import { PAGES_EN, PAGES_PT, PAGE_ROUTES } from "@/content/pages";
import { contentMetadata } from "@/lib/contentMeta";
import { ContentPage } from "@/components/content/ContentPage";

const R = PAGE_ROUTES.about;

export const metadata = contentMetadata(PAGES_PT.about, { enPath: R.en, ptPath: R.pt, locale: "pt" });

export default function PtSobrePage() {
  return (
    <ContentPage
      en={PAGES_EN.about}
      pt={PAGES_PT.about}
      initialLocale="pt"
      path={R.pt}
      backHref="/pt"
      ctaHref="/play"
    />
  );
}
