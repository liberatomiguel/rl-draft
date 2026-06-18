import type { MetadataRoute } from "next";
import { APP } from "@/content/copy.en";
import { SITE } from "@/config/site";

/**
 * Web app manifest (served at /manifest.webmanifest). Rocket Draft bills itself
 * as a free browser game, so it should be installable and declare its identity
 * for the browser / add-to-home-screen. Colors match the app shell (#05080f).
 * Icons reuse the brand hexagon (icon.svg) + the generated apple-icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: APP.description,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05080f",
    theme_color: "#05080f",
    lang: "en",
    categories: ["games", "sports", "entertainment"],
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        type: "image/png",
        sizes: "180x180",
        purpose: "maskable",
      },
    ],
  };
}
