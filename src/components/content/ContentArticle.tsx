import { AppLink } from "@/components/ui/AppLink";
import { CAREER_SHOT_SIZE, careerShotSrc, type CareerShotId } from "@/lib/assets";

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
  /** Landing pages only (v2.0.33): the second hero button's label (the Quick start). */
  ctaAltLabel?: string;
  /** Landing pages only: short selling points beside the hero button. */
  badges?: string[];
  /** Landing pages only: heading of the guide cards. */
  guidesLabel?: string;
};

/**
 * A landing layout (v2.0.21, /rocket-league-manager): the button and a capture
 * of the game above the fold, a capture beside the sections that have one, and
 * the guides as cards. The copy, the headings and the FAQ are the article's.
 */
export type LandingConfig = {
  hero: CareerShotId;
  /** Section index → the capture shown beside it. */
  shots: Partial<Record<number, CareerShotId>>;
  guides: RelatedLink[];
  /** v2.0.33: a second, quieter button beside the hero one (the Quick start). */
  secondaryCta?: RelatedLink;
};

const CTA_CLS =
  "display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] transition-transform hover:-translate-y-0.5";
const CTA_ALT_CLS =
  "display inline-flex items-center justify-center rounded-xl border border-line-strong px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-ink transition-colors hover:border-orange-bright hover:text-orange-bright";

function Shot({ id, alt, eager = false, sizes }: { id: CareerShotId; alt: string; eager?: boolean; sizes: string }) {
  const { src, srcSet } = careerShotSrc(id);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP in public/landing (static export, no optimizer)
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={CAREER_SHOT_SIZE.width}
      height={CAREER_SHOT_SIZE.height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className="h-auto w-full rounded-2xl border border-line"
    />
  );
}

/** A link to another content page, in the article's language. */
export type RelatedLink = { href: string; label: string };

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
  related,
  relatedLabel,
  landing,
  children,
}: {
  copy: ContentPageCopy;
  ctaHref: string;
  backHref: string;
  backLabel: string;
  /** The other content pages, in this article's language (v2.0, WEB-01). */
  related?: RelatedLink[];
  relatedLabel?: string;
  /** Renders the landing layout instead of the plain article. */
  landing?: LandingConfig;
  /** Optional extra blocks rendered after the CTA (e.g. card showcase). */
  children?: React.ReactNode;
}) {
  return (
    <article className={landing ? "rise-in mx-auto max-w-5xl" : "rise-in mx-auto max-w-3xl"}>
      <AppLink
        href={backHref}
        className="display inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sub transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> {backLabel}
      </AppLink>

      <header className="mt-6">
        <p className="kicker mb-2">{copy.kicker}</p>
        <h1 className="display text-3xl font-bold uppercase leading-tight tracking-wide text-ink md:text-4xl">
          {copy.title}
        </h1>
        <p className={landing ? "mt-4 max-w-3xl text-base leading-relaxed text-sub md:text-lg" : "mt-4 text-base leading-relaxed text-sub"}>
          {copy.intro}
        </p>
        {landing ? (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <AppLink href={ctaHref} className={CTA_CLS}>
                  {copy.ctaLabel}
                </AppLink>
                {landing.secondaryCta ? (
                  <AppLink href={landing.secondaryCta.href} className={CTA_ALT_CLS}>
                    {landing.secondaryCta.label}
                  </AppLink>
                ) : null}
              </div>
              {copy.badges && copy.badges.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-wider text-sub">
                  {copy.badges.map((b) => (
                    <li key={b} className="flex items-center gap-1.5">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange-bright" />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-8">
              <Shot id={landing.hero} alt={copy.title} eager sizes="(min-width: 1024px) 1024px, 100vw" />
            </div>
          </>
        ) : null}
      </header>

      <div className={landing ? "mt-14 space-y-14" : "mt-10 space-y-8"}>
        {copy.sections.map((s, i) => {
          const shot = landing?.shots[i];
          const text = (
            <div>
              <h2
                className={
                  landing
                    ? "display text-xl font-bold uppercase tracking-wide text-orange-bright md:text-2xl"
                    : "display text-lg font-bold uppercase tracking-wide text-orange-bright"
                }
              >
                {s.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-sub md:text-[15px]">{s.body}</p>
            </div>
          );
          if (!landing) return <section key={i}>{text}</section>;
          if (!shot)
            return (
              <section key={i} className="max-w-3xl">
                {text}
              </section>
            );
          return (
            <section key={i} className="grid items-center gap-6 md:grid-cols-5 md:gap-10">
              <div className={i % 2 === 1 ? "md:order-2 md:col-span-2" : "md:col-span-2"}>{text}</div>
              <div className="md:col-span-3">
                <Shot id={shot} alt={s.heading} sizes="(min-width: 768px) 600px, 100vw" />
              </div>
            </section>
          );
        })}
      </div>

      {landing && landing.guides.length > 0 ? (
        <nav aria-label={copy.guidesLabel} className="mt-14">
          <h2 className="kicker mb-3">{copy.guidesLabel}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {landing.guides.map((g) => (
              <li key={g.href}>
                <AppLink
                  href={g.href}
                  className="flex h-full items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.02] p-4 text-sm font-semibold text-ink transition-colors hover:border-orange-bright/60"
                >
                  {g.label}
                  <span aria-hidden className="text-orange-bright">
                    →
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {copy.faqs && copy.faqs.length > 0 ? (
        <div className={landing ? "mt-14 max-w-3xl space-y-4" : "mt-10 space-y-4"}>
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
        <AppLink
          href={ctaHref}
          className="display inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-bright to-orange px-8 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#1a0d02] shadow-[0_0_28px_rgba(249,115,22,0.3)] transition-all hover:brightness-110"
        >
          {copy.ctaLabel}
        </AppLink>
      </p>

      {related && related.length > 0 ? (
        <nav aria-label={relatedLabel} className="mt-12 border-t border-line pt-8">
          <h2 className="kicker mb-3">{relatedLabel}</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            {related.map((l) => (
              <li key={l.href}>
                <AppLink
                  href={l.href}
                  className="text-blue-bright underline-offset-4 transition-colors hover:text-cyan hover:underline"
                >
                  {l.label}
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
