// @vitest-environment jsdom
// The start flow offline (offline spec section 8): a deck with no copy on the device cannot be chosen and says
// why, the continue line leads only to a deck that can be played, and the labels go away when the network is back.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { INDEX_CACHE_KEY, deckCacheKey } from "@/src/content/load";
import { SWIPE } from "@/src/input/swipe";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress } from "@/src/progress/progress";
import { oneCardDeck } from "@/tests/support/decks";
import { resetOnline, setOnline } from "@/tests/support/online";
import { INDEX, harness, memoryStorage, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  cleanup();
  resetOnline();
});

const LAST_CLF_SEC = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: 7, total: 10 };

/** A device that has opened Truthy before: the cached index, these deck copies (any hash counts) and this last round. */
function device(decks: readonly string[], last: typeof LAST_CLF_SEC | null = null) {
  const local = memoryStorage({
    [INDEX_CACHE_KEY]: JSON.stringify(INDEX),
    [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), last }),
  });
  for (const id of decks) local.setItem(deckCacheKey(id), JSON.stringify(oneCardDeck(id, "an-older-hash")));
  return local;
}

let h: Harness;

/** Opens the start with the network off (navigator.onLine false, every fetch failing). */
async function startOffline(local: ReturnType<typeof device>) {
  setOnline(false, false);
  h = harness(local);
  h.network.online = false;
  render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

async function choose(name: string | RegExp, nextHeading: string) {
  h.clock.time += SWIPE.settleMs;
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}

describe("StartFlow offline: the deck step", () => {
  it("shows areas and platforms as online, with their counts", async () => {
    await startOffline(device([]));
    expect(screen.getByRole("button", { name: "Frontend, 1 deck" })).toBeTruthy();
    await choose("Cloud, 2 decks", "Choose a platform");
    expect(screen.getByRole("button", { name: "AWS, 1 deck" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google Cloud, 1 deck" })).toBeTruthy();
  });

  it("offers a deck the device holds a copy of, as online", async () => {
    await startOffline(device(["aws-clf-c02"]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CLF, Cloud Practitioner, 92 cards, not started" })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
    await choose(/^CLF, Cloud Practitioner/, "Choose a section");
  });

  it("shows a deck with no copy as unavailable: dimmed, not selectable, Needs a connection in place of its count", async () => {
    await startOffline(device(["aws-clf-c02"]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.queryByRole("button", { name: /^CDL/ })).toBeNull();
    const card = screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toBe("CDLCloud Digital LeaderNot startedNeeds a connection");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(card);
    await act(async () => {});
    expect(heading()).toBe("Choose a deck");
  });

  it("drops the labels without a reload when the network comes back, and takes them back when it goes", async () => {
    await startOffline(device([]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" })).toBeTruthy();
    act(() => setOnline(true));
    expect(screen.getByRole("button", { name: "CDL, Cloud Digital Leader, 133 cards, not started" })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
    act(() => setOnline(false));
    expect(screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" })).toBeTruthy();
  });

  it("offers every deck online, whatever the device holds", async () => {
    h = harness(device([]));
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CDL, Cloud Digital Leader, 133 cards, not started" })).toBeTruthy();
  });
});

describe("StartFlow offline: the continue line", () => {
  it("leads to the last route as online when its deck is on the device", async () => {
    await startOffline(device(["aws-clf-c02"], LAST_CLF_SEC));
    const line = screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(line);
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  it("says Needs a connection and is not a button when its deck has no copy", async () => {
    await startOffline(device([], LAST_CLF_SEC));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
    const line = screen.getByRole("group", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic, needs a connection." });
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Classic · Needs a connection");
    h.clock.time += SWIPE.settleMs;
    fireEvent.click(line);
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
  });

  it("becomes the button again when the network comes back", async () => {
    await startOffline(device([], LAST_CLF_SEC));
    act(() => setOnline(true));
    expect(screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." })).toBeTruthy();
    expect(screen.queryByText("Needs a connection")).toBeNull();
  });
});

// The deck card and the continue line are a button online and a group offline: the focused button leaves the page.
describe("StartFlow offline: the focus when the network goes", () => {
  async function startOnline(local: ReturnType<typeof device>) {
    h = harness(local);
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
  }

  it("moves to the deck step's title when the focused deck card loses its button", async () => {
    await startOnline(device([]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    screen.getByRole("button", { name: /^CDL, Cloud Digital Leader/ }).focus();
    act(() => setOnline(false));
    expect(screen.getByRole("group", { name: "CDL, Cloud Digital Leader, needs a connection" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Choose a deck" }));
  });

  it("moves to step 1's title when the focused continue line loses its button", async () => {
    await startOnline(device([], LAST_CLF_SEC));
    screen.getByRole("button", { name: /^Continue: AWS Cloud Practitioner/ }).focus();
    act(() => setOnline(false));
    expect(screen.getByRole("group", { name: /^Continue: .*, needs a connection\.$/ })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Choose an area" }));
  });

  it("stays on a focused deck card that the device holds, which keeps its button", async () => {
    await startOnline(device(["aws-clf-c02"]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    const card = screen.getByRole("button", { name: /^CLF, Cloud Practitioner/ });
    card.focus();
    act(() => setOnline(false));
    expect(document.activeElement).toBe(card);
  });

  it("does not take a focus that was on nothing", async () => {
    await startOnline(device([]));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    (document.activeElement as HTMLElement).blur();
    act(() => setOnline(false));
    expect(document.activeElement).toBe(document.body);
  });
});
