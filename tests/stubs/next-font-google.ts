// next/font/google only works inside the Next.js compiler. Vitest swaps it for this stub
// (see vitest.config.ts) so that components and the root layout can be rendered in tests.
interface StubFont {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

function stubFont(name: string): (options?: unknown) => StubFont {
  return () => ({ className: name, variable: `${name}-variable`, style: { fontFamily: name } });
}

export const Overpass = stubFont("font-overpass");
export const Overpass_Mono = stubFont("font-overpass-mono");
