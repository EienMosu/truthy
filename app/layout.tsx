import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { THEME_COLOR, themeScript } from "@/src/app-state/theme";
import { APP_DESCRIPTION, APP_NAME } from "@/src/meta";

// The font files are in app/fonts, so the build needs no network. The variable names are the ones app/tokens.css
// points --font-sans and --font-mono at (NEXT_FONT_VARIABLES in src/tokens/build.ts). Only the four static weights
// the design uses, each cut to Google's latin range plus the arrows U+2190 to U+2193: Google's own latin files leave
// out the left and right arrows the screens draw, which then came from a stretched Arial. Licence: app/fonts/OFL.txt.
const overpass = localFont({
  src: [
    { path: "./fonts/overpass-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/overpass-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-overpass",
  display: "swap",
});
const overpassMono = localFont({
  src: [
    { path: "./fonts/overpass-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/overpass-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-overpass-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The theme follows the system setting (the night values sit under prefers-color-scheme: dark in app/tokens.css)
  // until the player chooses one with the theme switch (src/app-state/theme.ts).
  colorScheme: "light dark",
  // The top sky band of each theme, --color-sky-1 in app/tokens.css (tests/app/layout.test.tsx checks they agree).
  // With a chosen theme, the theme script and the switch keep both tags' content and set media to "all" on the
  // chosen theme's tag and "not all" on the other (applyTheme in src/app-state/theme.ts says why the content stays).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The font variable classes sit on <html>: --font-sans is declared on :root and resolves its var() there.
  // The theme script runs while <head> is parsed, before the first paint: it puts the player's chosen theme
  // on <html> as data-theme, which React does not render, hence suppressHydrationWarning (one level deep).
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
