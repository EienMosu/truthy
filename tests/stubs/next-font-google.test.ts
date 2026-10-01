import { describe, expect, it } from "vitest";
import { Overpass, Overpass_Mono } from "next/font/google";

describe("next/font/google under Vitest", () => {
  it("returns class names for Overpass instead of throwing", () => {
    const font = Overpass({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-overpass" });
    expect(font.className).toBe("font-overpass");
    expect(font.variable).toBe("font-overpass-variable");
  });

  it("returns class names for Overpass Mono instead of throwing", () => {
    const font = Overpass_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-overpass-mono" });
    expect(font.className).toBe("font-overpass-mono");
    expect(font.variable).toBe("font-overpass-mono-variable");
  });
});
