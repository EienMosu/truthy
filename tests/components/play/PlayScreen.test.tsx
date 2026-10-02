// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, memoryStorage, type Harness } from "./fixtures";

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

let h: Harness;

async function start(setup: Harness = harness()) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  // findByRole can resolve before React has run the effects of that render (the keydown listener and the
  // card's settle time start there). On a slow machine a key pressed right away then reached no listener.
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time of the first card
  return view;
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

function currentAnswer(): boolean {
  return cardByStatement(statementText()).answer;
}

function swipeCard(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-swipe-card]");
  if (!element) throw new Error("no swipe card");
  return element;
}

/** Lets "Next card" arrive (420 ms after the answer on the test clock), then presses it. */
async function pressNext() {
  const next = await screen.findByRole("button", { name: /^(Next card|See results)$/ });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(next);
}

function status(): string | null {
  return screen.getAllByRole("status").at(-1)?.textContent ?? null;
}

async function answerAndNext(value: boolean) {
  fireEvent.click(screen.getByRole("button", { name: value ? "True" : "False" }));
  await pressNext();
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

describe("PlayScreen: starting", () => {
  it("sends the player to the start when there is no pending round", async () => {
    h = harness(null);
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(h.network.calls).toEqual([]);
  });

  it("sends the player to the start when the section no longer exists", async () => {
    h = harness({ route: { deckId: DECK_ID, sectionId: "OLD" }, mode: "classic" });
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("shows a calm ticket placeholder while loading, then the first card", async () => {
    h = harness();
    h.network.hold = true;
    const { container } = render(<PlayScreen services={h.services} />);
    expect(screen.getByRole("status").textContent).toBe("Loading your round");
    expect(container.querySelector("[data-pass-placeholder]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "True" })).toBeNull();
    await act(async () => {
      h.network.release();
    });
    await waitFor(() => expect(h.network.calls).toHaveLength(2));
    await act(async () => {
      h.network.release();
    });
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: "Card 1 of 10." })).toBeTruthy();
    expect(cardByStatement(statementText()).section).toBe("SEC");
  });

  it("fills the ticket with the route, the class and the card number", async () => {
    const { container } = await start();
    expect(container.querySelector('[data-leg="from"]')?.textContent).toBe("TSTAWS Test deck");
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("SECSecurity and compliance");
    expect(screen.getAllByRole("definition").map((value) => value.textContent?.slice(0, 7))).toEqual(["Classic", "01 / 10", "F ← → T"]);
  });

  it("plays the whole deck as ALL, Whole deck", async () => {
    const { container } = await start(harness({ route: { deckId: DECK_ID, sectionId: "ALL" }, mode: "classic" }));
    expect(container.querySelector('[data-leg="to"]')?.textContent).toBe("ALLWhole deck");
  });

  it("shows the appliesTo line only on a card that has one", async () => {
    await start(harness({ route: { deckId: DECK_ID, sectionId: "APP" }, mode: "classic" }));
    expect(screen.getByText("Applies to Next.js 16")).toBeTruthy();
    cleanup();
    await start();
    expect(screen.queryByText(/^Applies to/)).toBeNull();
  });

  it("removes the stored history of cards that left the deck", async () => {
    const stored = { version: 1, cards: { [`${DECK_ID}-gone-01`]: { seen: 1, lastCorrect: true, lastSeenAt: 1 } }, records: {}, last: null };
    await start(harness(undefined, memoryStorage({ [PROGRESS_KEY]: JSON.stringify(stored) })));
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards).toEqual({});
  });
});

describe("PlayScreen: answering", () => {
  it("answers with the True and False buttons and announces the verdict", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "True" : "False" }));
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);
  });

  it("says Not quite and the right answer after a wrong answer", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "False" : "True" }));
    expect(status()).toBe(`Not quite. The answer is ${right ? "True" : "False"}.`);
  });

  it("answers False with the left arrow and True with the right arrow", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(status()).toBe(`${right ? "Not quite" : "Correct"}. The answer is ${right ? "True" : "False"}.`);
    await pressNext();
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    const second = currentAnswer();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(status()).toBe(`${second ? "Correct" : "Not quite"}. The answer is ${second ? "True" : "False"}.`);
  });

  it("answers with a swipe across the card", async () => {
    await start();
    const right = currentAnswer();
    const card = swipeCard();
    const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch" };
    const from = 200;
    const to = right ? 320 : 80;
    fireEvent.pointerDown(card, { ...pointer, clientX: from, clientY: 400 });
    h.advance(200);
    fireEvent.pointerMove(card, { ...pointer, clientX: (from + to) / 2, clientY: 400 });
    h.advance(200);
    fireEvent.pointerUp(card, { ...pointer, clientX: to, clientY: 400 });
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);
  });

  it("does not answer an accidental short drag", async () => {
    await start();
    const card = swipeCard();
    const pointer = { pointerId: 1, isPrimary: true, pointerType: "touch" };
    fireEvent.pointerDown(card, { ...pointer, clientX: 200, clientY: 400 });
    h.advance(300);
    fireEvent.pointerUp(card, { ...pointer, clientX: 235, clientY: 404 });
    expect(status()).toBe("");
    expect(screen.getByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
  });

  it("ignores an answer in the first 250 ms of a card (a double tap on Next card)", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    await pressNext();
    await screen.findByRole("button", { name: "True" });
    h.advance(100);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(status()).toBe("");
    h.advance(200);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(status()).not.toBe("");
  });

  it("shows the right answer, the verdict stamp, the explanation and the source after an answer", async () => {
    await start();
    const card = cardByStatement(statementText());
    fireEvent.click(screen.getByRole("button", { name: card.answer ? "True" : "False" }));
    expect(screen.getByText("The answer is").textContent).toBe(`The answer is${card.answer ? "True" : "False"}`);
    expect(document.querySelector("[data-verdict]")?.textContent).toBe("Correct");
    expect(screen.getByText(card.text.en.explanation)).toBeTruthy();
    const link = screen.getByRole("link", { name: `${card.source.title} (opens in a new tab)` });
    expect(link.getAttribute("href")).toBe(card.source.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("moves focus to Next card after an answer", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const next = await screen.findByRole("button", { name: "Next card" });
    await waitFor(() => expect(document.activeElement).toBe(next), { timeout: 1500 });
  });

  it("shows the flight path with the tally and marks the answered card", async () => {
    await start();
    const right = currentAnswer();
    fireEvent.click(screen.getByRole("button", { name: right ? "True" : "False" }));
    expect(screen.getByRole("img", { name: "Card 1 of 10. Card 1 correct." })).toBeTruthy();
    expect(document.querySelector("[data-tally]")?.textContent).toBe("1 correct · 0 wrong");
  });
});

describe("PlayScreen: moving on", () => {
  it("goes to the next card with Next card", async () => {
    await start();
    const first = statementText();
    await answerAndNext(true);
    expect(statementText()).not.toBe(first);
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
    expect(screen.getAllByRole("definition")[1]?.textContent).toBe("02 / 10");
    expect(document.activeElement).toBe(document.querySelector("[data-statement]"));
  });

  // Review finding F1: the "Next card" row comes in where True and False were, so a double tap on an
  // answer must not land on it before it has arrived (420 ms after the answer) and skip the verdict.
  it("ignores Next card until it has arrived, 420 ms after the answer", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const verdict = status();
    h.advance(150);
    fireEvent.click(await screen.findByRole("button", { name: "Next card" }));
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
    expect(status()).toBe(verdict);
    expect(screen.getByText(cardByStatement(statementText()).text.en.explanation)).toBeTruthy();
    h.advance(269);
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
    h.advance(1);
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
  });

  it("ignores Enter until Next card has arrived", async () => {
    await start();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("button", { name: "Next card" });
    h.advance(150);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
    expect(status()).not.toBe("");
    h.advance(270);
    fireEvent.keyDown(document.body, { key: "Enter" });
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
  });

  it("goes to the next card with Enter", async () => {
    await start();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("button", { name: "Next card" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.keyDown(document.body, { key: "Enter" });
    await screen.findByRole("button", { name: "True" });
    expect(screen.getByRole("img", { name: /^Card 2 of 10\./ })).toBeTruthy();
  });

  it("finishes the round after the tenth card and shows its result", async () => {
    await start();
    for (let i = 0; i < 9; i++) await answerAndNext(true);
    expect(screen.getByRole("img", { name: /^Card 10 of 10\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    await pressNext();
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Round complete\. 10 of 10 cards\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave round" })).toBeNull();
  });
});

// Review finding U3: a held key sends repeated keydowns (event.repeat). One press is one answer or one
// action: the repeats are ignored, also the browser's own Enter on a focused True, False or Next card.
describe("PlayScreen: a held key", () => {
  it("does not answer with a repeated arrow key", async () => {
    await start();
    fireEvent.keyDown(window, { key: "ArrowRight", repeat: true });
    fireEvent.keyDown(window, { key: "ArrowLeft", repeat: true });
    expect(status()).toBe("");
    expect(screen.getByRole("button", { name: "True" })).toBeTruthy();
  });

  it("a held Enter does not press Next card and skip the verdict", async () => {
    await start();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    const verdict = status();
    const next = await screen.findByRole("button", { name: "Next card" });
    h.advance(NEXT_ARRIVES_MS + 100);
    fireEvent.keyDown(document.body, { key: "Enter", repeat: true });
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
    expect(status()).toBe(verdict);
    // The browser presses a focused button on Enter unless the keydown is cancelled.
    next.focus();
    expect(fireEvent.keyDown(next, { key: "Enter", repeat: true })).toBe(false);
    expect(fireEvent.keyDown(next, { key: "Enter" })).toBe(true);
  });

  it("cancels a repeated Enter on a focused True or False, so the browser does not press it again", async () => {
    await start();
    const trueButton = screen.getByRole("button", { name: "True" });
    trueButton.focus();
    expect(fireEvent.keyDown(trueButton, { key: "Enter", repeat: true })).toBe(false);
    expect(fireEvent.keyDown(screen.getByRole("button", { name: "False" }), { key: "Enter", repeat: true })).toBe(false);
  });
});

describe("PlayScreen: leaving", () => {
  it("leaves at once, recording nothing, when no card has been answered", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).last).toBeNull();
  });

  it("asks once after an answer; Keep playing goes back to the card", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const close = screen.getByRole("button", { name: "Leave round" });
    fireEvent.click(close);
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(close);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not answer with the arrow keys while the dialog is open", async () => {
    await start();
    await answerAndNext(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(status()).toBe("");
  });

  // Review finding U57 (design system 8: on step 7 Escape leaves the round): Escape does what the close
  // button does.
  it("leaves at once on Escape before the first answer", async () => {
    await start();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).last).toBeNull();
  });

  it("asks on Escape after an answer; Escape in the sheet keeps playing", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const verdict = status();
    fireEvent.keyDown(document.body, { key: "Escape" });
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    await act(async () => {});
    const stay = within(dialog).getByRole("button", { name: "Keep playing" });
    expect(document.activeElement).toBe(stay);
    fireEvent.keyDown(stay, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Leave round" }));
    expect(status()).toBe(verdict);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("asks on Escape on a decided round too", async () => {
    await start(harness({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "streak" }));
    fireEvent.click(screen.getByRole("button", { name: currentAnswer() ? "False" : "True" }));
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Leave round?" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens the sheet once for a held Escape: its repeats do not close it", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await act(async () => {});
    const stay = within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" });
    fireEvent.keyDown(stay, { key: "Escape", repeat: true });
    await act(async () => {});
    expect(screen.getByRole("dialog", { name: "Leave round?" })).toBeTruthy();
  });

  it("ignores Escape with a modifier key", async () => {
    await start();
    fireEvent.keyDown(document.body, { key: "Escape", shiftKey: true });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("records the answers given so far, but no record, when the player leaves", async () => {
    await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards)).toEqual([first.id]);
    expect(progress.cards[first.id]?.lastCorrect).toBe(true);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });
});

// Review finding F3: when the start flow opened /play on top of its own first entry, leaving goes back to
// that entry instead of adding a new one, so nothing stale piles up in the history.
describe("PlayScreen: leaving to the start's entry", () => {
  it("goes back to the start's entry when the start flow is right behind /play", async () => {
    const setup = harness();
    const backToStart = vi.fn(() => true);
    setup.services = { ...setup.services, backToStart };
    await start(setup);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  // Review finding U56: the start focuses its step 1 title when the player comes back from a round.
  it("tells the start that the player comes back from a round when they leave it", async () => {
    const setup = harness();
    const markReturnToStart = vi.fn();
    setup.services = { ...setup.services, markReturnToStart };
    await start(setup);
    expect(markReturnToStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(markReturnToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("does not when /play sends a page load without a round to the start", async () => {
    const setup = harness(null);
    const markReturnToStart = vi.fn();
    setup.services = { ...setup.services, markReturnToStart };
    h = setup;
    render(<PlayScreen services={h.services} />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(markReturnToStart).not.toHaveBeenCalled();
  });

  it("opens the start in place of /play when the start flow is not behind it", async () => {
    const setup = harness();
    const backToStart = vi.fn(() => false);
    setup.services = { ...setup.services, backToStart };
    await start(setup);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(backToStart).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("PlayScreen: load failure", () => {
  it("says the deck did not load and tries again", async () => {
    h = harness();
    h.network.online = false;
    render(<PlayScreen services={h.services} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This deck didn't load");
    h.network.online = true;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PlayScreen: review focus", () => {
  it("lets Enter open the source link instead of moving to the next card", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    const link = screen.getByRole("link");
    link.focus();
    fireEvent.keyDown(link, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Card 1 of 10\./ })).toBeTruthy();
  });

  it("plays from the copies on the device when the network is gone", async () => {
    const local = memoryStorage();
    await start(harness(undefined, local));
    cleanup();
    const offline = harness(undefined, local);
    offline.network.online = false;
    await start(offline);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(cardByStatement(statementText()).section).toBe("SEC");
  });
});

describe("PlayScreen: leaving with the back gesture", () => {
  // The phone's back gesture (or the browser's back button) leaves /play without the close control, so no
  // dialog is shown. Spec section 6: a round that is left sets no record, and the answers already given
  // stay in the card history.
  it("keeps the answers given so far in the card history, but sets no record, when the screen goes away mid-round", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    view.unmount();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards)).toEqual([first.id]);
    expect(progress.cards[first.id]?.lastCorrect).toBe(true);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
  });

  it("records nothing when the screen goes away before the first answer", async () => {
    const view = await start();
    view.unmount();
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.cards).toEqual({});
    expect(progress.last).toBeNull();
  });

  // Review finding U2: when leaving unloads the page (a back step to another document, another site, a
  // reload, a closed tab) no React cleanup runs; the page's pagehide leaves the round instead.
  it("keeps the answers given so far, once and without a record, when the page is hidden for good", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: false }));
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(Object.keys(progress.cards)).toEqual([first.id]);
    expect(progress.cards[first.id]?.seen).toBe(1);
    expect(progress.records).toEqual({});
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "classic", score: null, total: null });
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: false }));
    view.unmount();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.seen).toBe(1);
  });

  it("saves nothing on pagehide before the first answer", async () => {
    await start();
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: true }));
    const progress = parseProgress(h.local.getItem(PROGRESS_KEY));
    expect(progress.cards).toEqual({});
    expect(progress.last).toBeNull();
  });

  it("does not go on with a round whose answers were saved when the page comes back from the back-forward cache", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    fireEvent.click(screen.getByRole("button", { name: first.answer ? "True" : "False" }));
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: true }));
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    view.unmount();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.seen).toBe(1);
  });

  it("never saves a round twice once pagehide has saved it, also when the screen renders again before it goes away", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    fireEvent.click(screen.getByRole("button", { name: first.answer ? "True" : "False" }));
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: true }));
    await pressNext();
    await act(async () => {});
    view.unmount();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.seen).toBe(1);
  });

  it("goes on with a round that had nothing to save when the page comes back from the back-forward cache", async () => {
    await start();
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: true }));
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    await act(async () => {});
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "True" })).toBeTruthy();
  });

  it("does not record the answers twice when the round was already left with Leave round", async () => {
    const view = await start();
    const first = cardByStatement(statementText());
    await answerAndNext(first.answer);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    view.unmount();
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.seen).toBe(1);
  });
});
