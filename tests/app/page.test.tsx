// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { INDEX } from "../components/start/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("home page", () => {
  it("is a server component: the start flow is the client part", () => {
    expect(readFileSync("app/page.tsx", "utf8")).not.toContain("use client");
  });

  it("shows the start flow with the browser's own services, the game name as the only top-level heading", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => INDEX }));
    vi.stubGlobal("fetch", fetch);
    render(<Home />);
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/decks/index.json");
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("Truthy");
    expect(screen.getByRole("main").textContent).toContain("Choose an area");
  });
});
