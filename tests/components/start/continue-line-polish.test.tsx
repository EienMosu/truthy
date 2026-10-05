// @vitest-environment jsdom
// The continue line names the deck by its name on the pass (deckPassName), on screen and in its accessible
// name: six decks are titled "Fundamentals", so the bare title would not say which one is meant.
import { cleanup, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { harness, storedProgress } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

function lastRound(deckId: string, sectionId: string) {
  return storedProgress({ last: { route: { deckId, sectionId }, mode: "classic", score: 7, total: 10 } });
}

describe("the continue line names the deck as the pass does", () => {
  it("puts the platform before a deck title that needs it", async () => {
    // "Rendering" alone could be any platform's; the pass says "Next.js Rendering".
    render(<StartFlow services={harness(lastRound("nextjs-rendering", "RSC")).services} />);
    const line = await screen.findByRole("button", { name: "Continue: Next.js Rendering, Server and client components, Classic. Last score 7 of 10." });
    expect(line.querySelector("[data-continue='deck']")?.textContent).toBe("Next.js Rendering");
  });

  it("uses the deck's own pass name where the catalog gives one", async () => {
    render(<StartFlow services={harness(lastRound("gcp-cdl", "ALL")).services} />);
    const line = await screen.findByRole("button", { name: "Continue: Google Cloud Digital Leader, Whole deck, Classic. Last score 7 of 10." });
    expect(line.querySelector("[data-continue='deck']")?.textContent).toBe("Google Cloud Digital Leader");
  });

  it("keeps the name on one line, so the mono line below always has room for the last score", async () => {
    render(<StartFlow services={harness(lastRound("aws-clf-c02", "SEC")).services} />);
    const line = await screen.findByRole("button", { name: /^Continue: AWS Cloud Practitioner, / });
    expect(line.querySelector("[data-continue='deck']")?.className).toContain("truncate");
    const mono = line.querySelector("[data-continue='line']")?.className ?? "";
    expect(mono).toContain("max-h-[2lh]");
    expect(mono).not.toContain("max-h-[1lh]");
  });
});
