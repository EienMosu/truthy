// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo, LogoMark } from "@/components/Logo";

afterEach(cleanup);

describe("Logo", () => {
  it("reads as Truthy, with the mark hidden from screen readers", () => {
    const { container } = render(<Logo />);
    expect(container.textContent).toBe("Truthy");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("can be the page heading", () => {
    render(<Logo as="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Truthy" })).toBeTruthy();
  });

  it("is not a heading by default", () => {
    render(<Logo />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("uses the logo type role at its default size", () => {
    const { container } = render(<Logo />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("text-(length:--type-logo-size)");
    expect(root.style.fontSize).toBe("");
  });

  it("scales the wordmark, and with it the mark, to a given size", () => {
    const { container } = render(<Logo size={24} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.fontSize).toBe("24px");
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("w-[1.2222em]");
  });

  it("draws the full mark: amber ticket, tear line and check", () => {
    const { container } = render(<Logo />);
    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(3);
    expect(paths[0]?.getAttribute("class")).toBe("fill-(--color-accent)");
    expect(paths[1]?.getAttribute("stroke-dasharray")).toBe("2.5 3");
  });
});

describe("LogoMark", () => {
  it("is 44 by 30 and decorative by default", () => {
    const svg = render(<LogoMark />).container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("44");
    expect(svg?.getAttribute("height")).toBe("30");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the 44 by 30 proportion at the continue line size", () => {
    const svg = render(<LogoMark width={26} />).container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("26");
    expect(svg?.getAttribute("height")).toBe("17.73");
  });

  it("draws the compact mark as an on-accent ticket with an amber check and no tear line", () => {
    const paths = render(<LogoMark width={20} variant="compact" />).container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute("class")).toBe("fill-(--color-on-accent)");
    expect(paths[1]?.getAttribute("class")).toBe("stroke-(--color-accent)");
    expect(paths[1]?.getAttribute("stroke-width")).toBe("3.4");
  });
});
