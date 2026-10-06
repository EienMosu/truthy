import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

// The installed app turns with the phone (WCAG 1.3.4, Orientation): every screen works held sideways
// (e2e/short-heights-layout.spec.ts), so the manifest locks no orientation.
describe("web app manifest: orientation", () => {
  it("does not lock the orientation", () => {
    expect(manifest()).not.toHaveProperty("orientation");
  });
});
