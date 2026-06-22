import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { APP } from "@/content/copy.en";
import { SITE } from "@/config/site";
import { AppShell } from "@/components/layout/AppShell";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

// Self-hosted fonts (v1.4 "World Stage"). Previously fetched from
// fonts.googleapis.com at build time via next/font/google — the most likely
// cause of the 45-min Vercel build timeout (a build-network stall on the Google
// Fonts request; the build itself is ~45s locally). Bundling them locally makes
// the build deterministic / offline-proof and drops an external request at
// runtime. Geist + Geist Mono come from the official `geist` package (the same
// files Google serves) and expose the same --font-geist-sans / --font-geist-mono
// CSS variables globals.css already targets; Rajdhani is committed woff2 in
// ./fonts (sourced from @fontsource), wired via next/font/local.
const rajdhani = localFont({
  variable: "--font-rajdhani",
  display: "swap",
  src: [
    { path: "./fonts/rajdhani-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/rajdhani-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/rajdhani-700.woff2", weight: "700", style: "normal" },
  ],
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
  alternates: { canonical: "/" },
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
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/icon.svg", shortcut: "/favicon.ico" },
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
  themeColor: "#05080f",
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
  author: { "@type": "Person", name: SITE.author, url: SITE.authorUrl },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <PostHogProvider>
          <AppShell>{children}</AppShell>
        </PostHogProvider>
      </body>
    </html>
  );
}
