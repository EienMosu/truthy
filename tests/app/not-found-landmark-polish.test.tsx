// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

afterEach(cleanup);

// A screen reader that moves by landmarks only reaches what is inside one, and axe's "region" rule flags content
// outside them. The page's one action has to be in <main>, as the action row of /play is.
describe("the page for an unknown address, by landmarks", () => {
  it("puts the Back to start link inside main, as its last child, so it keeps its place at the foot", () => {
    render(<NotFound />);
    const main = screen.getByRole("main");
    const link = screen.getByRole("link", { name: "Back to start" });
    expect(main.contains(link)).toBe(true);
    expect(main.lastElementChild).toBe(link);
    expect(link.className).toContain("mt-auto");
  });

  it("leaves nothing but the backdrop, the header and main in the page", () => {
    const { container } = render(<NotFound />);
    const wrapper = container.querySelector("[data-not-found]");
    const children = Array.from(wrapper?.children ?? []);
    for (const child of children) {
      const inLandmark = child.matches("header, main, [data-sky-backdrop]") || child.getAttribute("aria-hidden") === "true";
      expect(inLandmark, child.outerHTML.slice(0, 80)).toBe(true);
    }
  });
});
