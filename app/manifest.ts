import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/src/meta";

// The web app manifest (spec section 9, "Installability"), served by Next.js at /manifest.webmanifest.
// A manifest cannot read CSS variables, so the day sky colours are written out here:
//   theme_color       --color-sky-1, the top sky band (the same value as the light themeColor in app/layout.tsx)
//   background_color  --color-surface, the page background behind the sky (the splash screen)
// tests/app/manifest.test.ts checks both against design/system/tokens.json.
// The manifest is static and has no media queries, so it keeps the day colours even when the system is
// dark: the splash screen is day, and once the page loads its theme-color meta tags take over.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#c4e3f5",
    theme_color: "#a9d6f0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // The mark covers 60 percent of the width, inside the 80 percent safe circle of a maskable icon.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
