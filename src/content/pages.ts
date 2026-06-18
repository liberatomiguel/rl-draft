/**
 * SEO content-page copy (server-only). These long-form pages (/about, /faq,
 * /ratings, /strategy, /special-cards, /sam and their /pt mirrors) are rendered
 * server-side per locale, so their copy lives HERE rather than in the runtime
 * `copy.{en,pt}.ts` dictionary — that dictionary is imported by the client
 * `useCopy()` layer and ships in the client bundle, so adding ~3k words of page
 * prose to it would bloat every page's JS. Keeping it in JSON imported only by
 * the server routes keeps it out of the client bundle while staying fully
 * translated and shape-checked. (Documented in DESIGN-DECISIONS.)
 */
import type { ContentPageCopy } from "@/components/content/ContentArticle";
import type { PageSlug } from "./pageRoutes";
import enJson from "./pages.en.json";
import ptJson from "./pages.pt.json";

// Re-export the (JSON-free) route map so route files keep a single import.
export { PAGE_ROUTES, type PageSlug } from "./pageRoutes";

export const PAGES_EN = enJson as unknown as Record<PageSlug, ContentPageCopy>;
export const PAGES_PT = ptJson as unknown as Record<PageSlug, ContentPageCopy>;

