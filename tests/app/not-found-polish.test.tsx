// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import NotFound, { metadata } from "@/app/not-found";

afterEach(cleanup);

describe("the page for an unknown address", () => {
  it("exists, so Next does not serve its stock page that ignores the chosen theme", () => {
    expect(existsSync("app/not-found.tsx")).toBe(true);
  });

  it("says the page was not found under the game's logo, on the sky", () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(container.textContent).toContain("Truthy");
    expect(container.querySelector("[data-sky-backdrop]")).not.toBeNull();
  });

  it("links back to the start flow with the primary pill, its arrow hidden from screen readers", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: "Back to start" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.className).toContain("bg-(--color-ink)");
    expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe("→");
  });

  it("names the tab after the missing page, through metadata rather than a <title> of its own", () => {
    expect(metadata.title).toBe("Page not found · Truthy");
    const { container } = render(<NotFound />);
    expect(container.querySelector("title")).toBeNull();
  });
});
