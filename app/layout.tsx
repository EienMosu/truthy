import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { THEME_COLOR, themeScript } from "@/src/app-state/theme";
import { APP_DESCRIPTION, APP_NAME } from "@/src/meta";

// Self-hosted by next/font. The variable names are the ones app/tokens.css points --font-sans and
// --font-mono at (NEXT_FONT_VARIABLES in src/tokens/build.ts). Only the four static weights the design uses.
const overpass = Overpass({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-overpass",
  display: "swap",
});
const overpassMono = Overpass_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
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
  // With a chosen theme, the theme script and the switch give both tags the chosen theme's colour.
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
