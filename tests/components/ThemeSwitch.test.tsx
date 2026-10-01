// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ICON_PATHS } from "@/components/icons";
import type { MatchMedia } from "@/src/app-state/theme";

/** A prefers-color-scheme: dark query whose answer a test can change. */
function fakeMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_type: "change", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "change", listener: () => void) => listeners.delete(listener),
  };
  const matchMedia: MatchMedia = () => query;
  return {
    matchMedia: () => matchMedia,
    flip(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

function storage(fail = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((key: string) => {
      if (fail) throw new DOMException("The operation is insecure.", "SecurityError");
      return data.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (fail) throw new DOMException("The operation is insecure.", "SecurityError");
      data.set(key, value);
    }),
  };
}

/** The icon on the button: "moon", "sun", or both while the theme is not known yet. */
function icons(button: HTMLElement): string[] {
  return [...button.querySelectorAll("[data-icon]")].map((el) => el.getAttribute("data-icon") ?? "");
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitch", () => {
  it("offers the dark theme with a moon while the day theme is shown", () => {
    render(<ThemeSwitch storage={() => storage()} matchMedia={fakeMedia(false).matchMedia} />);
    const button = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(icons(button)).toEqual(["moon"]);
    expect(button.querySelector("path")?.getAttribute("d")).toBe(ICON_PATHS.moon);
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("offers the light theme with a sun while the system shows the night theme", () => {
    render(<ThemeSwitch storage={() => storage()} matchMedia={fakeMedia(true).matchMedia} />);
    const button = screen.getByRole("button", { name: "Switch to light theme" });
    expect(icons(button)).toEqual(["sun"]);
  });

  it("reads a choice already on the page before the system setting", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeSwitch storage={() => storage()} matchMedia={fakeMedia(false).matchMedia} />);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
  });

  it("flips the theme on screen and remembers the choice on the device", async () => {
    const local = storage();
    render(<ThemeSwitch storage={() => local} matchMedia={fakeMedia(false).matchMedia} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(local.setItem).toHaveBeenLastCalledWith("truthy.theme", "dark");
    const button = await screen.findByRole("button", { name: "Switch to light theme" });
    expect(icons(button)).toEqual(["sun"]);

    fireEvent.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(local.setItem).toHaveBeenLastCalledWith("truthy.theme", "light");
    expect(await screen.findByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
  });

  it("still flips the theme for this page when storage throws", async () => {
    const blocked = storage(true);
    render(<ThemeSwitch storage={() => blocked} matchMedia={fakeMedia(true).matchMedia} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("follows the system setting while there is no choice", async () => {
    const media = fakeMedia(false);
    render(<ThemeSwitch storage={() => storage()} matchMedia={media.matchMedia} />);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
    act(() => media.flip(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy());
  });

  it("puts a stored choice back on the page when it is missing (React's development remount clears it)", () => {
    const local = storage();
    local.data.set("truthy.theme", "dark");
    render(<ThemeSwitch storage={() => local} matchMedia={fakeMedia(false).matchMedia} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
  });

  it("is the 48 px raised round button", () => {
    render(<ThemeSwitch storage={() => storage()} matchMedia={fakeMedia(false).matchMedia} />);
    const button = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(button.className).toContain("size-(--size-round-button)");
    expect(button.dataset.variant).toBe("raised");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("renders both icons, chosen by CSS, before the page knows the theme (prerendering)", () => {
    const html = renderToString(<ThemeSwitch />);
    const host = document.createElement("div");
    host.innerHTML = html;
    const button = host.querySelector("button");
    if (!button) throw new Error("no button");
    expect(button.getAttribute("aria-label")).toBe("Switch theme");
    expect(icons(button)).toEqual(["moon", "sun"]);
    expect(button.querySelector('[data-icon="moon"]')?.className).toContain("night:hidden");
    expect(button.querySelector('[data-icon="sun"]')?.className).toMatch(/(^| )hidden( |$)/);
    expect(button.querySelector('[data-icon="sun"]')?.className).toContain("night:contents");
  });
});
