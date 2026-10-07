// @vitest-environment jsdom
// Step 3 spec section 10 (as amended in section 14): offline, a stored round (truthy.pending.v1) whose deck has no
// copy on the device. The index is on the device (the start flow loaded it once), the deck is not, and every request
// fails. /play shows the existing load failure message with Try again, and its way back (the header's Leave round)
// goes to the start.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { INDEX_CACHE_KEY, deckCacheKey } from "@/src/content/load";
import { PROGRESS_KEY } from "@/src/progress/local";
import { DECK, DECK_ID, INDEX, harness, memoryStorage, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(cleanup);

/** Offline, with the index on the device and no copy of the deck. */
function offlineWithoutDeck(): Harness {
  const h = harness(undefined, memoryStorage({ [INDEX_CACHE_KEY]: JSON.stringify(INDEX) }));
  h.network.online = false;
  return h;
}

describe("PlayScreen offline: a stored round whose deck has no copy", () => {
  it("shows the load failure message with Try again, deals nothing and stays on /play", async () => {
    const h = offlineWithoutDeck();
    render(<PlayScreen services={h.services} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("This deck didn't loadCheck your connection and try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave round" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    expect(h.network.calls).toEqual(["/decks/index.json", `/decks/${DECK_ID}.json?v=${DECK.hash}`]);
    expect(h.local.data.has(PROGRESS_KEY)).toBe(false);
    expect(h.local.data.has(deckCacheKey(DECK_ID))).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the message on Try again while still offline, and deals the round once the network is back", async () => {
    const h = offlineWithoutDeck();
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(h.network.calls).toHaveLength(4));
    expect((await screen.findByRole("alert")).textContent).toContain("This deck didn't load");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(h.local.data.has(deckCacheKey(DECK_ID))).toBe(true);
  });

  it("goes to the start with Leave round, in place of /play when the start's entry is not behind it", async () => {
    const h = offlineWithoutDeck();
    const backToStart = vi.fn(() => false);
    const markReturnToStart = vi.fn();
    h.services = { ...h.services, backToStart, markReturnToStart };
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(markReturnToStart).toHaveBeenCalledTimes(1);
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(h.local.data.has(PROGRESS_KEY)).toBe(false);
  });

  it("goes back to the start's entry with Leave round when it is right behind /play", async () => {
    const h = offlineWithoutDeck();
    const backToStart = vi.fn(() => true);
    h.services = { ...h.services, backToStart };
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
