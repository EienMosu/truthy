// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StartFlow, canShow, clearFrom, pathTo, previousStep } from "@/components/start/StartFlow";
import { PENDING_KEY } from "@/src/app-state/pending";
import { SWIPE } from "@/src/input/swipe";
import { INDEX_CACHE_KEY } from "@/src/content/load";
import { INDEX, harness, memoryStorage, storedProgress, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

// The last round on CLF / SEC / Classic, left before the end: it has no score.
const LAST_CLF_SEC = { route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" as const, score: null, total: null };

let h: Harness;

async function start(setup: Harness = harness()) {
  h = setup;
  const view = render(<StartFlow services={h.services} />);
  await screen.findByRole("button", { name: "Cloud, 2 decks" });
  return view;
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

/** Lets the settle time pass: for 250 ms after a step change, presses on its options are ignored. */
function settle() {
  h.clock.time += SWIPE.settleMs;
}

async function choose(name: string | RegExp, nextHeading: string) {
  settle();
  fireEvent.click(screen.getByRole("button", { name }));
  await waitFor(() => expect(heading()).toBe(nextHeading));
}

function passText(): string {
  return (document.querySelector("[data-fill-in-pass]")?.textContent ?? "").replace(/\s+/g, " ");
}

function field(name: string): string | null | undefined {
  return document.querySelector(`[data-fill-in-pass] [data-field="${name}"]`)?.textContent;
}

async function toClasses() {
  await choose("Cloud, 2 decks", "Choose a platform");
  await choose("AWS, 1 deck", "Choose a deck");
  await choose(/^CLF, Cloud Practitioner/, "Choose a section");
  await choose(/^SEC, Security and compliance/, "Choose how to play");
}

describe("the steps (pure)", () => {
  it("clears a step's choice and every later one", () => {
    const all = { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "classic" as const };
    expect(clearFrom(all, 3)).toEqual({ areaId: "cloud", platformId: "aws" });
    expect(clearFrom(all, 6)).toEqual(all);
    expect(clearFrom(all, 1)).toEqual({});
  });

  it("walks every step, and skips the section step for a deck without sections", () => {
    expect(pathTo(6, true)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pathTo(6, false)).toEqual([1, 2, 3, 5, 6]);
    expect(previousStep(5, false)).toBe(3);
    expect(previousStep(5, true)).toBe(4);
    expect(previousStep(2, true)).toBe(1);
  });

  it("knows whether a remembered step can still be shown with the index", () => {
    expect(canShow(INDEX, 4, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" })).toBe(true);
    expect(canShow(INDEX, 4, { areaId: "cloud", platformId: "gcp", deckId: "gcp-cdl" })).toBe(false);
    expect(canShow(INDEX, 3, { areaId: "cloud", platformId: "gone" })).toBe(false);
    expect(canShow(INDEX, 6, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "streak" })).toBe(true);
  });
});

describe("StartFlow: step 1", () => {
  it("shows the logo as the page heading, the line in ink and one card per area", async () => {
    await start();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
    const line = screen.getByText("True or false cards that teach you IT, one swipe at a time.");
    expect(line.className).toContain("text-(--color-ink)");
    expect(line.className).not.toContain("ink-muted");
    expect(heading()).toBe("Choose an area");
    expect(screen.getByRole("button", { name: "Frontend, 1 deck" })).toBeTruthy();
  });

  it("marks an area without decks as not available: a disabled group, not a button", async () => {
    await start();
    expect(screen.queryByRole("button", { name: /DevOps/ })).toBeNull();
    const devops = screen.getByRole("group", { name: "DevOps, no decks yet" });
    expect(devops.getAttribute("aria-disabled")).toBe("true");
    expect(devops.textContent).toBe("DevOpsNo decks yet");
  });

  it("shows quiet placeholders while the index loads", async () => {
    h = harness();
    h.network.hold = true;
    render(<StartFlow services={h.services} />);
    expect(screen.getByRole("status").textContent).toBe("Loading the decks");
    expect(document.querySelectorAll("[data-placeholder]")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
    await act(async () => h.network.release());
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(document.querySelector("[data-placeholder]")).toBeNull();
  });

  it("says the decks did not load and offers Try again when there is no cached index", async () => {
    h = harness();
    h.network.online = false;
    render(<StartFlow services={h.services} />);
    expect((await screen.findByRole("alert")).textContent).toBe("The decks didn't loadCheck your connection and try again.");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says the decks did not load and offers Try again when offline with a cached index of the wrong shape", async () => {
    h = harness(memoryStorage({ [INDEX_CACHE_KEY]: '{"areas":"none"}' }));
    h.network.online = false;
    render(<StartFlow services={h.services} />);
    expect((await screen.findByRole("alert")).textContent).toBe("The decks didn't loadCheck your connection and try again.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cloud, 2 decks" })).toBeNull();
  });

  it("has no Continue line on a first run", async () => {
    await start();
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });
});

describe("StartFlow: choosing a route", () => {
  it("fills the pass step by step and hands the round to /play", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    expect(field("area")).toBe("AreaCloud");
    expect(field("platform")).toBe("Platformnot chosen");
    expect(screen.getByRole("group", { name: "Azure, no decks yet" })).toBeTruthy();

    await choose("AWS, 1 deck", "Choose a deck");
    expect(field("platform")).toBe("PlatformAWS");

    await choose("CLF, Cloud Practitioner, 92 cards, not started", "Choose a section");
    expect(passText()).toContain("Cloud·AWSDeckCLF");
    expect(field("deck")).toBe("DeckCLF");
    const sections = [...document.querySelectorAll("[data-step='4'] [data-option] button")].map((b) => b.getAttribute("aria-label"));
    expect(sections).toEqual([
      "Whole deck, all 2 sections, 92 cards",
      "CON, Cloud concepts, 45 cards",
      "SEC, Security and compliance, 47 cards",
    ]);

    await choose("SEC, Security and compliance, 47 cards", "Choose how to play");
    expect(field("section")).toBe("SectionSEC");

    await choose(/^Classic\./, "Your pass is ready");
    expect(passText()).toContain("CLF");
    expect(passText()).toContain("AWS Cloud Practitioner");
    expect(passText()).toContain("Security and compliance");
    expect(passText()).toContain("ClassClassic");
    expect(passText()).toContain("Cards47");
    expect(screen.getByText("Correct answers out of 10 cards. Swipe right for true, left for false.")).toBeTruthy();

    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("shows how much of a deck has been seen", async () => {
    const cards = Object.fromEntries(Array.from({ length: 23 }, (_, i) => [`aws-clf-c02-t1-${i}`, { seen: 1, lastCorrect: true, lastSeenAt: 1 }]));
    await start(harness(storedProgress({ cards })));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CLF, Cloud Practitioner, 92 cards, 25 percent seen" })).toBeTruthy();
  });

  // Review finding U52: the share counts the deck's current cards, read from its file on the device.
  it("says a deck is not started when the cards seen have since been removed from it", async () => {
    const played = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`aws-clf-c02-old-${i}`, { seen: 1, lastCorrect: true, lastSeenAt: 1 }]));
    const local = storedProgress({ cards: played });
    const card = (id: string) => ({
      id,
      section: "SEC",
      text: { en: { statement: `Statement ${id}`, explanation: `Explanation ${id}` } },
      answer: true,
      source: { title: "Docs", url: "https://docs.aws.amazon.com/" },
      difficulty: 1,
      appliesTo: "",
      conflictGroups: [],
    });
    const cards = Array.from({ length: 92 }, (_, i) => card(`aws-clf-c02-t1-${i}`));
    local.setItem("truthy.deck.aws-clf-c02", JSON.stringify({ id: "aws-clf-c02", hash: "clf-1", cards }));
    await start(harness(local));
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    expect(screen.getByRole("button", { name: "CLF, Cloud Practitioner, 92 cards, not started" })).toBeTruthy();
  });

  it("skips the section step for a deck without sections and plays the whole deck", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    await choose(/^CDL, Cloud Digital Leader/, "Choose how to play");
    expect(field("section")).toBe("SectionWhole deck");
    expect(screen.queryByRole("button", { name: /^Change section/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to decks" })).toBeTruthy();
    await choose(/^Classic\./, "Your pass is ready");
    expect(document.querySelector("[data-leg='deck']")?.textContent).toBe("CDLGoogle Cloud Digital Leader");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("ALLWhole deck");
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic" });
  });

  it("shows every class as a button with the best for this route", async () => {
    await start(
      harness(
        storedProgress({
          records: { "aws-clf-c02/SEC#classic": 9, "aws-clf-c02/SEC#streak": 12, "aws-clf-c02/SEC#lives": 21, "aws-clf-c02/CON#timed": 30 },
        }),
      ),
    );
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. Correct answers out of 10 cards. Your best: 9 of 10." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Streak. Correct answers in a row, until the first wrong one. Your best: 12 in a row." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Three lives. Correct answers before the third wrong one. Your best: 21 cards." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Timed. Correct answers in one minute, wrong ones cost nothing. Not played yet." })).toBeTruthy();
    expect(screen.queryAllByRole("group", { name: /not available yet/ })).toHaveLength(0);
  });

  it.each([
    ["streak", /^Streak\./, "Streak", "Correct answers in a row, until the first wrong one."],
    ["lives", /^Three lives\./, "Three lives", "Correct answers before the third wrong one."],
    ["timed", /^Timed\./, "Timed", "Correct answers in one minute, wrong ones cost nothing."],
  ] as const)("hands the chosen class to /play: %s", async (mode, buttonName, name, rule) => {
    await start();
    await toClasses();
    await choose(buttonName, "Your pass is ready");
    expect(passText()).toContain(`Class${name}`);
    expect(document.body.textContent).toContain(`${rule} Swipe right for true, left for false.`);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode });
  });

  it("says Classic has not been played on a new route", async () => {
    await start();
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. Correct answers out of 10 cards. Not played yet." }).textContent).toContain("Best–not played");
  });

  it("starts the round only once when Start round is pressed twice", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    const button = screen.getByRole("button", { name: "Start round" });
    settle();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  // Review finding U127: the Escape listener sits on the document, so the inert main does not stop it; the
  // boarding check in backTo is all that keeps an Escape from stepping back and moving the history a second
  // time on top of the rewind (in a browser, past the site's first entry).
  describe("ignores Escape while the pass boards", () => {
    async function boardWithEscape(): Promise<number[]> {
      await start();
      await toClasses();
      await choose(/^Classic\./, "Your pass is ready");
      const moves: number[] = [];
      const go = h.history.go.bind(h.history);
      h.history.go = (delta) => {
        moves.push(delta);
        go(delta);
      };
      settle();
      fireEvent.click(screen.getByRole("button", { name: "Start round" }));
      await act(async () => {});
      fireEvent.keyDown(document.body, { key: "Escape" });
      await act(async () => {});
      return moves;
    }

    it("while the browser moves back to the first entry", async () => {
      const moves = await boardWithEscape();
      expect(moves).toEqual([-5]);
      expect(h.history.position).toBe(0);
      expect(heading()).toBe("Your pass is ready");
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
      fireEvent.keyDown(document.body, { key: "Escape" });
      await act(async () => {});
      expect(moves).toEqual([-5]);
      expect(heading()).toBe("Your pass is ready");
      expect(router.push).toHaveBeenCalledTimes(1);
    });

    it("while it waits for a browser that never reports the move", async () => {
      h = harness();
      const dropped: number[] = [];
      h.history.go = (delta) => {
        dropped.push(delta); // a browser that drops the move: the flow falls back on its 1 s timer
      };
      render(<StartFlow services={h.services} />);
      await screen.findByRole("button", { name: "Cloud, 2 decks" });
      await toClasses();
      await choose(/^Classic\./, "Your pass is ready");
      settle();
      fireEvent.click(screen.getByRole("button", { name: "Start round" }));
      await act(async () => {});
      fireEvent.keyDown(document.body, { key: "Escape" });
      await act(async () => {});
      expect(dropped).toEqual([-5]);
      expect(heading()).toBe("Your pass is ready");
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"), { timeout: 2000 });
      expect(router.push).toHaveBeenCalledTimes(1);
    });
  });
});

// Review finding U128: with reduced motion the ready pass does not unroll (spec section 9, every transition
// has a reduced-motion fallback); /play opens without waiting for it. The panels and the travelling name are
// seen in a real browser (e2e/reduced-motion.spec.ts): jsdom has no layout for the name to travel in.
describe("StartFlow: boarding with reduced motion", () => {
  /** Starts the round on the ready pass and says whether the unrolling paper was ever on screen. */
  async function board(): Promise<boolean> {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    let unrolled = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector("[data-unroll]")) unrolled = true;
    });
    observer.observe(document.body, { subtree: true, childList: true });
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    observer.disconnect();
    return unrolled;
  }

  it("opens /play without unrolling the pass", async () => {
    motionPreference.reduced = true;
    expect(await board()).toBe(false);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("control: with full motion the pass unrolls before /play opens", async () => {
    expect(await board()).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});

// Review finding F3: once a round starts, the step entries are spent. The flow moves the browser back to
// its first entry and opens /play from there, so back from /play is the start at step 1.
describe("StartFlow: handing over to /play", () => {
  function positionsAtPush(): number[] {
    const positions: number[] = [];
    router.push.mockImplementation(() => positions.push(h.history.position));
    return positions;
  }

  it("takes the step entries out of the history before it opens /play", async () => {
    await start();
    const positions = positionsAtPush();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    expect(h.history.position).toBe(5);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
    expect(positions).toEqual([0]);
    expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } });
    expect(router.push).toHaveBeenCalledTimes(1);
    // The move back is the flow's own: the screen stays on the ready pass while it boards.
    expect(heading()).toBe("Your pass is ready");
  });

  it("does the same for a deck without sections and for the continue line", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    const positions = positionsAtPush();
    settle();
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(h.history.position).toBe(5);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    cleanup();
    router.push.mockReset();

    await start();
    const second = positionsAtPush();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("Google Cloud, 1 deck", "Choose a deck");
    await choose(/^CDL, Cloud Digital Leader/, "Choose how to play");
    await choose(/^Classic\./, "Your pass is ready");
    expect(h.history.position).toBe(4);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect([...positions, ...second]).toEqual([0, 0]);
  });

  it("still opens /play when the browser never reports the move back", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    h.history.go = () => undefined; // a browser that drops the move
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await act(async () => {});
    expect(router.push).not.toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"), { timeout: 2000 });
  });

  it("opens /play without moving when there is no history", async () => {
    const setup = harness();
    setup.services.history = () => undefined;
    await start(setup);
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
  });
});

describe("StartFlow: going back", () => {
  it("steps back with the Back pill, clearing the choice of that step, and focuses the card chosen before", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    fireEvent.click(screen.getByRole("button", { name: "Back to platforms" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(field("platform")).toBe("Platformnot chosen");
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("AWS, 1 deck"));
  });

  it("jumps back through a filled field and clears every later choice", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Change deck, now CLF" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(field("deck")).toBe("Decknot chosen");
    await choose(/^CLF/, "Choose a section");
    expect(field("section")).toBe("Sectionnot chosen");
    expect(field("mode")).toBe("Classnot chosen");
  });

  it("jumps back from the ready pass to the class step", async () => {
    await start();
    await toClasses();
    await choose(/^Classic\./, "Your pass is ready");
    fireEvent.click(screen.getByRole("button", { name: "Change class, now Classic" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    expect(field("mode")).toBe("Classnot chosen");
    expect(screen.queryByRole("button", { name: "Start round" })).toBeNull();
  });

  it("steps back on Escape", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Truthy");
  });
});

// Review finding U56: back on the start from /play (Choose another route, Close results, Leave round), focus
// lands on the step 1 title instead of the body. A fresh page load moves no focus, as before.
describe("StartFlow: arriving from a round", () => {
  function arriving(fromRound: boolean): Harness {
    const setup = harness();
    let mark = fromRound;
    setup.services = {
      ...setup.services,
      returnedFromPlay: () => {
        const was = mark;
        mark = false;
        return was;
      },
    } as Harness["services"];
    return setup;
  }

  it("focuses the step 1 title when the player comes back from a round", async () => {
    await start(arriving(true));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Choose an area"));
    expect(document.activeElement?.tagName).toBe("H2");
  });

  it("focuses the title already while the index loads, and keeps it there once the areas appear", async () => {
    h = arriving(true);
    h.network.hold = true;
    render(<StartFlow services={h.services} />);
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Choose an area"));
    await act(async () => h.network.release());
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    expect(document.activeElement?.textContent).toBe("Choose an area");
  });

  it("moves no focus on a fresh page load", async () => {
    await start(arriving(false));
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });
});

describe("StartFlow: the browser history", () => {
  it("keeps one entry per step, without changing the URL path", async () => {
    await start();
    await toClasses();
    expect(h.history.position).toBe(4);
    expect(h.history.entries).toHaveLength(5);
    expect(h.history.state).toEqual({
      truthyStart: { step: 5, choice: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC" } },
    });
  });

  it("steps back on the browser's back button and forward again on forward", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    await choose("AWS, 1 deck", "Choose a deck");
    act(() => h.history.back());
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(field("platform")).toBe("Platformnot chosen");
    act(() => h.history.forward());
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(field("platform")).toBe("PlatformAWS");
  });

  it("drops the entries of the steps that Back and the fields leave behind", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.position).toBe(1);
    await act(async () => {}); // the history reports the move; the flow must stay where it is
    expect(heading()).toBe("Choose a platform");
  });

  it("starts at step 1 after a reload, whatever step the entry remembered", async () => {
    h = harness();
    h.history.replace({ truthyStart: { step: 4, choice: { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02" } } });
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    expect(heading()).toBe("Choose an area");
    expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } });
  });
});

describe("StartFlow: a history entry from before an update", () => {
  it("goes to step 1 when the browser steps back to a route the index no longer has", async () => {
    h = harness();
    h.history.replace({ truthyStart: { step: 3, choice: { areaId: "cloud", platformId: "oracle" } } });
    h.history.push({ truthyStart: { step: 2, choice: { areaId: "cloud" } } });
    render(<StartFlow services={h.services} />);
    await screen.findByRole("button", { name: "Cloud, 2 decks" });
    await choose("Frontend, 1 deck", "Choose a platform");
    act(() => h.history.go(-2));
    await waitFor(() => expect(h.history.state).toEqual({ truthyStart: { step: 1, choice: {} } }));
    expect(heading()).toBe("Choose an area");
    expect(screen.getByRole("button", { name: "Cloud, 2 decks" })).toBeTruthy();
  });
});

describe("StartFlow: continue", () => {
  it("offers the last route and class, and lands on the ready pass with them filled in", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    const line = screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic." });
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Classic");
    settle();
    fireEvent.click(line);
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(document.querySelector("[data-leg='deck']")?.textContent).toBe("CLFAWS Cloud Practitioner");
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getByRole("button", { name: "Start round" })).toBeTruthy();
    expect(h.history.entries.map((e) => (e as { truthyStart: { step: number } }).truthyStart.step)).toEqual([1, 2, 3, 4, 5, 6]);
    fireEvent.click(screen.getByRole("button", { name: "Back to classes" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    expect(field("section")).toBe("SectionSEC");
  });

  it("retraces a whole-deck route of a deck without sections without a section step", async () => {
    await start(harness(storedProgress({ last: { route: { deckId: "gcp-cdl", sectionId: "ALL" }, mode: "classic", score: null, total: null } })));
    settle();
    fireEvent.click(screen.getByRole("button", { name: "Continue: Google Cloud Digital Leader, Whole deck, Classic." }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(document.querySelector("[data-leg='section']")?.textContent).toBe("ALLWhole deck");
    expect(h.history.entries.map((e) => (e as { truthyStart: { step: number } }).truthyStart.step)).toEqual([1, 2, 3, 5, 6]);
    fireEvent.click(screen.getByRole("button", { name: "Back to classes" }));
    await waitFor(() => expect(heading()).toBe("Choose how to play"));
    fireEvent.click(screen.getByRole("button", { name: "Back to decks" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
    expect(h.history.position).toBe(2);
  });

  it("shows the score of the last round when it was finished", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, score: 7, total: 10 } })));
    const line = screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Classic · last 7 of 10");
  });

  it("is not shown when the last route is gone from the index", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });

  it("continues a round of another class with its own score", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, mode: "lives", score: 21, total: 21 } })));
    const line = screen.getByRole("button", { name: "Continue: AWS Cloud Practitioner, Security and compliance, Three lives. Last score 21 cards." });
    expect(line.textContent).toBe("AWS Cloud PractitionerCLF → SEC · Three lives · last 21 cards");
    settle();
    fireEvent.click(line);
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    expect(passText()).toContain("ClassThree lives");
  });
});

describe("StartFlow: keyboard", () => {
  // Tab moves to the next focusable element in document order (no positive tabindex is used);
  // Enter on a button activates it, as browsers do.
  function tabbables(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !el.closest("[inert]") && !el.hasAttribute("disabled"),
    );
  }
  function tab() {
    const list = tabbables();
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[(at + 1) % list.length]?.focus();
  }
  function enter() {
    const active = document.activeElement as HTMLElement;
    fireEvent.keyDown(active, { key: "Enter" });
    if (active.tagName === "BUTTON") fireEvent.click(active);
  }
  async function tabTo(name: RegExp) {
    for (let i = 0; i < 20; i++) {
      tab();
      if (name.test(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "")) return;
    }
    throw new Error(`Tab never reached ${name}`);
  }

  it("plays the whole path with Tab and Enter only, the step title taking focus after each step", async () => {
    await start();
    const steps: [RegExp, string][] = [
      [/^Cloud, 2 decks$/, "Choose a platform"],
      [/^AWS, 1 deck$/, "Choose a deck"],
      [/^CLF, /, "Choose a section"],
      [/^SEC, /, "Choose how to play"],
      [/^Classic\./, "Your pass is ready"],
    ];
    for (const [option, next] of steps) {
      await tabTo(option);
      settle();
      enter();
      await waitFor(() => expect(document.activeElement?.textContent).toBe(next));
      expect(document.activeElement?.tagName).toBe("H2");
    }
    await tabTo(/^Start round/);
    settle();
    enter();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play"));
  });
});

describe("StartFlow: the settle time", () => {
  // As on the play screen (spec section 8): for 250 ms after a step becomes current, its options, the
  // continue line and Start round ignore presses. The next step's cards appear where the chosen card was.
  it("ignores a second tap 100 ms after a step change, so a double tap cannot choose unseen", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    expect(field("platform")).toBe("Platformnot chosen");
    expect(h.history.position).toBe(1);
  });

  it("takes a press once 250 ms have passed", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    h.clock.time += 249;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    h.clock.time += 1;
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
  });

  it("holds back Enter on the keyboard in the same way", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    const aws = screen.getByRole("button", { name: "AWS, 1 deck" });
    aws.focus();
    h.clock.time += 100;
    fireEvent.keyDown(aws, { key: "Enter" });
    fireEvent.click(aws); // Enter on a button activates it, as browsers do
    await act(async () => {});
    expect(heading()).toBe("Choose a platform");
    h.clock.time += 150;
    fireEvent.keyDown(aws, { key: "Enter" });
    fireEvent.click(aws);
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
  });

  it("holds back Start round right after the continue line has filled the pass", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    settle();
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(h.session.data.get(PENDING_KEY)).toBeUndefined();
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(JSON.parse(h.session.data.get(PENDING_KEY) ?? "null")).toEqual({ route: { deckId: "aws-clf-c02", sectionId: "SEC" }, mode: "classic" });
  });

  it("holds back the continue line right after going back to step 1", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    await choose("Cloud, 2 decks", "Choose a platform");
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  // Review finding U6: the start screen opened from /play ("Choose another route", Leave round) shows the
  // continue line where the button just pressed was. Step 1 appearing starts the settle time like any step.
  it("holds back the continue line and the area cards right after step 1's options appear", async () => {
    await start(harness(storedProgress({ last: LAST_CLF_SEC })));
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    fireEvent.click(screen.getByRole("button", { name: "Cloud, 2 decks" }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    expect(h.history.position).toBe(0);
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  it("counts step 1's settle time from when its options appear, not from the first render", async () => {
    h = harness(storedProgress({ last: LAST_CLF_SEC }));
    h.network.hold = true;
    render(<StartFlow services={h.services} />);
    h.clock.time += 1000; // the index takes a second to load
    await act(async () => h.network.release());
    await screen.findByRole("button", { name: /^Continue/ });
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await act(async () => {});
    expect(heading()).toBe("Choose an area");
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(heading()).toBe("Your pass is ready"));
  });

  it("never holds back Back, the pass fields or Escape", async () => {
    await start();
    await toClasses();
    fireEvent.click(screen.getByRole("button", { name: "Back to sections" }));
    await waitFor(() => expect(heading()).toBe("Choose a section"));
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose an area"));
  });
});

describe("StartFlow: the theme switch", () => {
  afterEach(() => document.documentElement.removeAttribute("data-theme"));

  function themeSwitch(): HTMLElement {
    return screen.getByRole("button", { name: /^Switch to (dark|light) theme$/ });
  }

  it("sits in the header on every step, after the logo or the Back pill, and never takes the focus", async () => {
    await start();
    expect(themeSwitch().closest("header")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(themeSwitch()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    const steps: [string | RegExp, string][] = [
      ["Cloud, 2 decks", "Choose a platform"],
      ["AWS, 1 deck", "Choose a deck"],
      [/^CLF, Cloud Practitioner/, "Choose a section"],
      [/^SEC, Security and compliance/, "Choose how to play"],
      [/^Classic\./, "Your pass is ready"],
    ];
    for (const [option, next] of steps) {
      await choose(option, next);
      expect(themeSwitch().closest("header")).not.toBeNull();
      const back = screen.getByRole("button", { name: /^Back to / });
      expect(back.compareDocumentPosition(themeSwitch()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await waitFor(() => expect(document.activeElement?.textContent).toBe(next));
    }
  });

  it("flips the theme and keeps the choice in the flow's local storage, without moving a step or the settle time", async () => {
    await start();
    await choose("Cloud, 2 decks", "Choose a platform");
    settle();
    const position = h.history.position;
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(h.local.data.get("truthy.theme")).toBe("dark");
    expect(await screen.findByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    expect(heading()).toBe("Choose a platform");
    expect(h.history.position).toBe(position);
    // The settle time has passed and the switch did not start a new one: the next press counts at once.
    fireEvent.click(screen.getByRole("button", { name: "AWS, 1 deck" }));
    await waitFor(() => expect(heading()).toBe("Choose a deck"));
  });
});

// Review finding U118: a step's list that goes on below the fold fades out at its bottom edge. jsdom has no
// layout, so each list here is 400 tall and its cards together are as tall as `cardsHeight` says.
describe("StartFlow: the cue that a list goes on", () => {
  function listOfStep(): HTMLElement {
    const list = document.querySelector<HTMLElement>("[data-step]:not([inert]) [data-list]");
    if (!list) throw new Error("No list on the current step");
    return list;
  }

  async function withCardsHeight(cardsHeight: number, run: () => Promise<void>) {
    const rect = HTMLElement.prototype.getBoundingClientRect;
    const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.hasAttribute("data-list")) return DOMRect.fromRect({ x: 0, y: 292, width: 358, height: 400 });
      if (this.parentElement?.hasAttribute("data-list")) return DOMRect.fromRect({ x: 0, y: 298, width: 358, height: cardsHeight });
      return rect.call(this);
    };
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute("data-list") ? 400 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement?.hasAttribute("data-list") ? cardsHeight : 0;
      },
    });
    try {
      await run();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rect;
      if (clientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeight);
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
    }
  }

  it("marks the list of classes and fades its bottom edge when the cards run on below it", async () => {
    await withCardsHeight(480, async () => {
      await start();
      await toClasses();
      await act(async () => {});
      const list = listOfStep();
      expect(list.hasAttribute("data-more")).toBe(true);
      expect(list.className).toContain("data-more:[mask-image:linear-gradient(to_bottom,var(--color-ink)_calc(100%_-_28px_-_var(--list-fade-lift,0px)),transparent_calc(100%_-_var(--list-fade-lift,0px)))]");
    });
  });

  it("leaves the edge plain when the cards fit", async () => {
    await withCardsHeight(300, async () => {
      await start();
      await toClasses();
      await act(async () => {});
      expect(listOfStep().hasAttribute("data-more")).toBe(false);
    });
  });
});

// Review finding U79: under 568 tall the start screen scrolls as one column. A step that arrives starts at the
// top of the column, with the pass and the new title in view (and the travelling name lands where it is measured).
describe("StartFlow: the column of a short screen", () => {
  function scrollable(main: HTMLElement): { top: number } {
    const state = { top: 0 };
    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      get: () => state.top,
      set: (value: number) => {
        state.top = value;
      },
    });
    return state;
  }

  it("goes back to the top of the column when a step arrives, forward or back", async () => {
    await start();
    const main = document.querySelector("main");
    if (!main) throw new Error("No main");
    const scroll = scrollable(main);
    scroll.top = 240;
    await choose("Cloud, 2 decks", "Choose a platform");
    expect(scroll.top).toBe(0);
    scroll.top = 180;
    settle(); // the column jumped, so Back is held back for the settle time (the test below)
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    expect(scroll.top).toBe(0);
  });

  // Fix round 1 of F1a: going back to the top puts the Back pill and the pass where the finger just was, so the
  // second tap of a double tap would land on a way back the player has not seen. While the settle time runs
  // after such a jump, a press on them is ignored; Escape and the browser's back button are not.
  it("holds back the pass fields and Back for the settle time after the column jumped to its top", async () => {
    await start();
    const main = document.querySelector("main");
    if (!main) throw new Error("No main");
    const scroll = scrollable(main);
    await choose("Cloud, 2 decks", "Choose a platform");
    scroll.top = 160;
    await choose("AWS, 1 deck", "Choose a deck");
    expect(scroll.top).toBe(0);
    h.clock.time += 100;
    fireEvent.click(screen.getByRole("button", { name: "Back to platforms" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a deck");
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await act(async () => {});
    expect(heading()).toBe("Choose a deck");
    expect(h.history.position).toBe(2);
    h.clock.time += 150;
    fireEvent.click(screen.getByRole("button", { name: "Change platform, now AWS" }));
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
    expect(h.history.position).toBe(1);
  });

  // Fix round 2 of F1a: bringing the focused card into view after a tap on Back moved an option card under the
  // finger, so "Back, Back" chose it. Only a way back from the keyboard scrolls the column to the focused card.
  describe("the card focused on the way back", () => {
    function columnOverCard(main: HTMLElement) {
      main.style.overflowY = "auto";
      Object.defineProperty(main, "clientHeight", { configurable: true, get: () => 200 });
      const scroll = scrollable(main);
      // The Timed card lies 400 px down the column, below its 200 px fold.
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const top = this.closest('[data-option="timed"]') && this.tagName === "BUTTON" ? 400 - scroll.top : 0;
        const height = top === 0 ? 0 : 90;
        return { x: 0, y: top, left: 0, top, width: 0, height, right: 0, bottom: top + height, toJSON: () => ({}) } as DOMRect;
      });
      // jsdom has no DOMMatrixReadOnly; the cards are at rest (skipAnimations), so their rise-in shift is 0.
      vi.stubGlobal("DOMMatrixReadOnly", class {
        m42 = 0;
      });
      return scroll;
    }
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    async function toReadyWithTimed(): Promise<{ main: HTMLElement; scroll: { top: number } }> {
      await start();
      await toClasses();
      await choose(/^Timed\. /, "Your pass is ready");
      settle();
      const main = document.querySelector("main");
      if (!main) throw new Error("No main");
      return { main, scroll: columnOverCard(main) };
    }

    it("keeps the column at its top after a tap on Back", async () => {
      const { scroll } = await toReadyWithTimed();
      const back = screen.getByRole("button", { name: "Back to classes" });
      fireEvent.pointerDown(back);
      fireEvent.click(back);
      await waitFor(() => expect(heading()).toBe("Choose how to play"));
      await act(async () => {});
      expect(document.activeElement?.closest('[data-option="timed"]')).not.toBeNull();
      expect(scroll.top).toBe(0);
    });

    it("keeps the column at its top after a tap on a field of the pass", async () => {
      const { scroll } = await toReadyWithTimed();
      const field = screen.getByRole("button", { name: "Change class, now Timed" });
      fireEvent.pointerDown(field);
      fireEvent.click(field);
      await waitFor(() => expect(heading()).toBe("Choose how to play"));
      await act(async () => {});
      expect(scroll.top).toBe(0);
    });

    it("brings the card into view after Escape", async () => {
      const { scroll } = await toReadyWithTimed();
      await act(async () => {});
      fireEvent.keyDown(document.body, { key: "Escape" });
      await waitFor(() => expect(heading()).toBe("Choose how to play"));
      await act(async () => {});
      expect(document.activeElement?.closest('[data-option="timed"]')).not.toBeNull();
      expect(scroll.top).toBe(298); // 400 + 90 + 8 for the focus ring - 200
    });

    it("brings the card into view after Enter on Back, even when the last press before it was a tap", async () => {
      const { scroll } = await toReadyWithTimed();
      const back = screen.getByRole("button", { name: "Back to classes" });
      fireEvent.pointerDown(document.body);
      fireEvent.keyDown(back, { key: "Enter" });
      fireEvent.click(back); // Enter on a button activates it, as browsers do
      await waitFor(() => expect(heading()).toBe("Choose how to play"));
      await act(async () => {});
      expect(scroll.top).toBe(298);
    });
  });

  it("never holds back Escape after the column jumped to its top", async () => {
    await start();
    const main = document.querySelector("main");
    if (!main) throw new Error("No main");
    const scroll = scrollable(main);
    scroll.top = 160;
    await choose("Cloud, 2 decks", "Choose a platform");
    await act(async () => {});
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(heading()).toBe("Choose an area"));
  });
});
