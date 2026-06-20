import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Rajdhani } from "next/font/google";
import { APP } from "@/content/copy.en";
import { SITE } from "@/config/site";
import { AppShell } from "@/components/layout/AppShell";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} h-full antialiased`}
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
