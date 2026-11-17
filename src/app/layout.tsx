import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP } from "@/content/copy.en";
import { SITE } from "@/config/site";
import { webSiteJsonLd } from "@/lib/jsonld";
import { AppShell } from "@/components/layout/AppShell";
import { LocaleRoot } from "@/components/layout/LocaleRoot";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

// Self-hosted fonts (v1.4 "World Stage"). Previously fetched from
// fonts.googleapis.com at build time via next/font/google — the most likely
// cause of the 45-min Vercel build timeout (a build-network stall on the Google
// Fonts request; the build itself is ~45s locally). Bundling them locally makes
// the build deterministic / offline-proof and drops an external request at
// runtime. Geist Mono comes from the official `geist` package (the same file
// Google serves) and exposes the --font-geist-mono variable globals.css
// targets. Geist Sans is no longer loaded.
//
// Broadcast package (DESIGN.md): Barlow Condensed is the display face and
// Barlow the text face, committed woff2 in ./fonts (from @fontsource, OFL,
// licence beside them). Only the latin files are declared here and preloaded;
// the latin-ext files are plain @font-face rules in globals.css with a
// unicode-range, so they are fetched only when a name needs them.
// Weights (DESIGN.md, "weight"): Bold is the heaviest upright file. Labels and
// tags use 600, text 400 and 600, and globals.css turns off synthetic
// bold, so nothing can go heavier by accident. Titles ask
// for 800 and get the Bold file too. The one italic file serves the Home wordmark.
// Six files are preloaded.
const barlowCondensed = localFont({
  variable: "--font-barlow-condensed",
  display: "swap",
  // The sizes in the interface were set with Industry (wider). A condensed
  // stand-in at the same size reads a step smaller, so it is scaled up a
  // little to keep titles and labels near the designed presence.
  declarations: [{ prop: "size-adjust", value: "106%" }],
  src: [
    { path: "./fonts/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal" },
    // The Bold file answers 700 and 800: `font-bold` and titles.
    { path: "./fonts/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-condensed-latin-700-normal.woff2", weight: "700 800", style: "normal" },
    { path: "./fonts/barlow-condensed-latin-800-italic.woff2", weight: "800", style: "italic" },
  ],
});

const barlow = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "./fonts/barlow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

// Rajdhani is no longer an interface face. It stays declared, not preloaded,
// for the share card: lib/shareCard.ts draws its canvas text in "Rajdhani" and
// loads it on demand (next/font names the family after this const).
const rajdhani = localFont({
  variable: "--font-rajdhani",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/rajdhani-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/rajdhani-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/rajdhani-700.woff2", weight: "700", style: "normal" },
  ],
});

// Geist Mono — the SAME file + options as `geist/font/mono`'s GeistMono (keep
// in sync if that package changes them), redeclared only to add
// `preload: false`: it styles a little small mono text, so it no longer costs
// every first visit a 71 KB <link rel="preload">; the browser fetches it when
// mono text first renders (display: swap). Keep the const NAMED `GeistMono`:
// next/font derives the font-family name from it. Do not also import
// `geist/font/mono` — that would bring back the preloaded copy.
const GeistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  preload: false,
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  weight: "100 900",
});

const TITLE = `${SITE.name} — RLCS Draft Game · Rocket League Esports History`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: TITLE,
    template: `%s · ${SITE.name}`,
  },
  description: APP.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.authorUrl }],
  creator: SITE.author,
  keywords: [
    "RLCS draft",
    "RLCS draft game",
    "RLCS draft simulator",
    "draft RLCS teams",
    "RLCS fantasy draft",
    "Rocket League",
    "RLCS",
    "Rocket League esports",
    "RLCS history",
    "esports draft game",
    "fantasy draft",
    "roster builder",
    "tournament simulator",
    "Rocket League draft game",
    "Rocket Draft",
    "free browser game",
  ],
  // No `alternates` here on purpose: a canonical set in the root layout is
  // inherited by every page without its own (it pointed /profile, /settings
  // and /missions at the home page). Each page declares its own canonical.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: TITLE,
    description: APP.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: APP.description,
    creator: "@liberatoRL_",
  },
  // NEXT_PUBLIC_NOINDEX=1 → staging build: never indexed (production omits it).
  robots:
    process.env.NEXT_PUBLIC_NOINDEX === "1"
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large" },
        },
  // No `icons` / `openGraph.images` here: favicon.ico, icon.svg, apple-icon.png
  // and opengraph-image.png in src/app are file conventions Next links itself
  // (with cache-busting hashes). A manual entry only duplicated those tags/requests.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Drop your Google Search Console HTML-tag token in GOOGLE_SITE_VERIFICATION
  // (env) to verify domain ownership; or use the DNS method and skip this.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#070a11",
};

/** Structured data so search engines understand this is a (free) web game. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: SITE.name,
  url: SITE.url,
  description: APP.description,
  applicationCategory: "Game",
  operatingSystem: "Web browser",
  genre: ["Sports", "Strategy", "Esports", "Card game"],
  gamePlatform: "Web",
  inLanguage: ["en", "pt-BR"],
  playMode: "SinglePlayer",
  image: `${SITE.url}/opengraph-image.png`,
  author: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
};

/** The site's name in search results (and its one-word spelling). */
const SITE_JSON_LD = webSiteJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // <html> comes from LocaleRoot (a Client Component): it reads the URL, so
  // the /pt pages export lang="pt-BR" and PT chrome (rc.32, DRAFT-11, #148).
  return (
    <LocaleRoot
      className={`${barlow.variable} ${barlowCondensed.variable} ${GeistMono.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Development only: the Industry trial font for local preview. The
            file and the fonts sit in a git-ignored folder, so a checkout
            without them gets one 404 in dev and nothing else; a production
            build never emits this tag (see the note in globals.css). */}
        {process.env.NODE_ENV === "development" ? (
          // eslint-disable-next-line @next/next/no-css-tags
          <link rel="stylesheet" href="/fonts-trial/industry.css" />
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        <PostHogProvider>
          <AppShell>{children}</AppShell>
        </PostHogProvider>
      </body>
    </LocaleRoot>
  );
}
