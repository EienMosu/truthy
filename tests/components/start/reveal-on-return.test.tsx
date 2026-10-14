// @vitest-environment jsdom
// Going back on a long list (recent-decks spec section 6): the card chosen before is brought into view in its list
// before it takes focus. jsdom has no layout, so the scroll is checked end to end (e2e/recent-decks.spec.ts); this
// pins the order and the card.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { SWIPE } from "@/src/input/swipe";
import { harness, playedDecks } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const reveals = vi.hoisted(() => [] as { option: string | null; focused: string | null | undefined }[]);
vi.mock("@/components/start/listCue", async (original) => ({
  ...(await original<typeof import("@/components/start/listCue")>()),
  revealInList: (_list: HTMLElement, _content: HTMLElement, item: HTMLElement) => {
    reveals.push({ option: item.getAttribute("data-option") ?? (item.hasAttribute("data-recent") ? "recent" : null), focused: document.activeElement?.getAttribute("aria-label") });
  },
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  reveals.length = 0;
});

describe("StartFlow: going back brings the chosen card into view first", () => {
  it("reveals the card chosen before, then focuses it, and reveals nothing going forward", async () => {
    const h = harness(playedDecks({ "aws-clf-c02": 100, "gcp-cdl": 200 }));
    render(<StartFlow services={h.services} />);
    // The settle time starts when the options appear, so the clock moves once the card is there.
    const pick = async (name: string | RegExp, next: string) => {
      const card = await screen.findByRole("button", { name });
      h.clock.time += SWIPE.settleMs;
      fireEvent.click(card);
      await screen.findByRole("heading", { name: next });
    };
    await pick("Cloud, 2 decks", "Choose a platform");
    await pick("AWS, 1 deck", "Choose a deck");
    expect(reveals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Back to platforms" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("AWS, 1 deck"));
    expect(reveals).toEqual([{ option: "aws", focused: expect.not.stringMatching(/^AWS/) }]);
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Cloud, 2 decks"));
    expect(reveals.at(-1)?.option).toBe("cloud");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(screen.getByRole("button", { name: "Recent, 2 decks" }));
    await screen.findByRole("heading", { name: "Choose a deck" });
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Recent, 2 decks"));
    expect(reveals.at(-1)?.option).toBe("recent");
  });
});
