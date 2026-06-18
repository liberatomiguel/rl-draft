import Link from "next/link";

/**
 * Shape every SEO content page's copy conforms to (lives in copy.en/copy.pt).
 * metaTitle/metaDescription feed the route's <metadata>; the rest renders here.
 */
export type ContentPageCopy = {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  /** Only the FAQ page populates this; renders visible Q/A that mirrors the
   *  FAQPage JSON-LD so the rich result and the page agree. */
  faqs?: { q: string; a: string }[];
  ctaLabel: string;
};

/**
 * Server-rendered article shell for content pages (/about, /faq, /ratings,
 * /strategy, /special-cards, /sam and their /pt mirrors). Static HTML → fully
 * crawlable, renders the active locale's dict. The H1 is the page title; each
 * section is an H2; FAQ questions are H3.
 */
export function ContentArticle({
  copy,
  ctaHref,
  backHref,
  backLabel,
  children,
}: {
  copy: ContentPageCopy;
  ctaHref: string;
  backHref: string;
  backLabel: string;
  /** Optional extra blocks rendered after the CTA (e.g. card showcase). */
  children?: React.ReactNode;
}) {
  return (
    <article className="rise-in mx-auto max-w-3xl">
      <Link
        href={backHref}
        className="display inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sub transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> {backLabel}
      </Link>

      <header className="mt-6">
        <p className="kicker mb-2">{copy.kicker}</p>
        <h1 className="display text-3xl font-bold uppercase leading-tight tracking-wide text-ink md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-sub">{copy.intro}</p>
      </header>

      <div className="mt-10 space-y-8">
        {copy.sections.map((s, i) => (
          <section key={i}>
            <h2 className="display text-lg font-bold uppercase tracking-wide text-orange-bright">
              {s.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sub md:text-[15px]">{s.body}</p>
          </section>
        ))}
      </div>

      {copy.faqs && copy.faqs.length > 0 ? (
        <div className="mt-10 space-y-4">
          {copy.faqs.map((f, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white/[0.02] p-5">
              <h3 className="display text-base font-bold uppercase tracking-wide text-ink">
                {f.q}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-sub">{f.a}</p>
            </div>
          ))}
        </div>
      ) : null}

      {children}

      <p className="mt-12 text-center">
        <Link
          href={ctaHref}
          className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.3)] transition-all hover:brightness-110"
        >
          {copy.ctaLabel}
        </Link>
      </p>
    </article>
  );
}
