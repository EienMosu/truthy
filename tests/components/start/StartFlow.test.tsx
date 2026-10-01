// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StartFlow, canShow, clearFrom, pathTo, previousStep } from "@/components/start/StartFlow";
import { PENDING_KEY } from "@/src/app-state/pending";
import { SWIPE } from "@/src/input/swipe";
import { INDEX, harness, storedProgress, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
});
afterEach(cleanup);

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
    expect(canShow(INDEX, 6, { areaId: "cloud", platformId: "aws", deckId: "aws-clf-c02", sectionId: "SEC", mode: "streak" })).toBe(false);
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
    expect(screen.getByText("10 cards, score at the end. Swipe right for true, left for false.")).toBeTruthy();

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

  it("shows the best for this route on Classic, and the other classes as not available", async () => {
    await start(harness(storedProgress({ records: { "aws-clf-c02/SEC#classic": 9, "aws-clf-c02/CON#classic": 4 } })));
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Your best: 9 of 10." })).toBeTruthy();
    for (const name of ["Streak", "Three lives", "Timed"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${name}`) })).toBeNull();
      const group = screen.getByRole("group", { name: `${name}, not available yet` });
      expect(group.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(group);
    }
    expect(heading()).toBe("Choose how to play");
  });

  it("says Classic has not been played on a new route", async () => {
    await start();
    await toClasses();
    expect(screen.getByRole("button", { name: "Classic. 10 cards, score at the end. Not played yet." }).textContent).toContain("Best–not played");
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
    const line = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic." });
    expect(line.textContent).toBe("Continue where you left offCLF → SEC · Classic");
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
    fireEvent.click(screen.getByRole("button", { name: "Continue: Cloud Digital Leader, Whole deck, Classic." }));
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
    const line = screen.getByRole("button", { name: "Continue: Cloud Practitioner, Security and compliance, Classic. Last score 7 of 10." });
    expect(line.textContent).toBe("Continue where you left offCLF → SEC · Classic · last 7 of 10");
  });

  it("is not shown when the last route is gone from the index", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, route: { deckId: "aws-clf-c02", sectionId: "OLD" } } })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
  });

  it("is not shown when the last class cannot be played in this version", async () => {
    await start(harness(storedProgress({ last: { ...LAST_CLF_SEC, mode: "streak" } })));
    expect(screen.queryByRole("button", { name: /^Continue/ })).toBeNull();
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
