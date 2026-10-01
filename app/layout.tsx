import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import type { ReactNode } from "react";
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
  colorScheme: "light",
  // The top sky band, --color-sky-1 in app/tokens.css (tests/app/layout.test.tsx checks they agree).
  themeColor: "#a9d6f0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The font variable classes sit on <html>: --font-sans is declared on :root and resolves its var() there.
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable}`}>
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
