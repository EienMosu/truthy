// @vitest-environment jsdom
// Timed on the play screen (spec section 6, "Timed"; design system 5.10 and 5.11): the clock, the stamp beat
// on the stub and time up. The clock only moves on the harness's ticks and visibility changes.
//
// start() costs the clock one second: the clock starts with the tick useClock sends on mount, then start()
// moves the test clock on by 1000 (the settle time) without a tick, and the next tick or answer counts that
// gap as one full second (the most one step may count). So after start(), run(ms) takes ms + 900 off the
// clock, and an answer given right after start() takes 1000.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen, timedCardText, timedStatus } from "@/components/play/PlayScreen";
import { RESULT_ARRIVES_MS } from "@/components/play/ResultView";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress, parseProgress } from "@/src/progress/progress";
import { reduce, startRound } from "@/src/engine/round";
import { DECK, DECK_ID, cardByStatement, harness, pendingFor, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
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
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

let h: Harness;

async function start(setup: Harness = harness(pendingFor("timed"))) {
  h = setup;
  const view = render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  // findByRole can resolve before React has run the effects of that render (the key listener, the card's
  // settle time and the clock start there): flush them before anything fires.
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time of the first card
  return view;
}

function run(ms: number) {
  act(() => h.run(ms));
}

function tick() {
  act(() => h.tick());
}

function setHidden(hidden: boolean) {
  act(() => h.setHidden(hidden));
}

/** Right after start(): the last tick is the one that reaches zero (1000 + 590 x 100). */
function runToTimeUp() {
  run(59_100);
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

function currentAnswer(): boolean {
  return cardByStatement(statementText()).answer;
}

function button(right: boolean): HTMLElement {
  const answer = currentAnswer();
  return screen.getByRole("button", { name: (right ? answer : !answer) ? "True" : "False" });
}

/** Clicks the button that is right (or wrong) for the card on screen. */
function give(right: boolean) {
  fireEvent.click(button(right));
}

/** Waits until the answered card has left and the next one is the only card. */
async function nextCard(previous: string | null | undefined) {
  await waitFor(() => {
    expect(document.querySelectorAll("[data-statement]")).toHaveLength(1);
    expect(statementText()).not.toBe(previous);
  });
  await act(async () => {});
}

function status(): string | null {
  return screen.getAllByRole("status").at(-1)?.textContent ?? null;
}

function headerName(): string | null | undefined {
  return document.querySelector("[data-flight-path]")?.getAttribute("aria-label");
}

function progressText(): string | null | undefined {
  return document.querySelector("[data-progress]")?.textContent;
}

function tally(): string | null | undefined {
  return document.querySelector("[data-tally]")?.textContent;
}

function fields(): string[] {
  return screen.getAllByRole("definition").map((value) => value.textContent?.slice(0, 7) ?? "");
}

function hint(): string | null | undefined {
  return document.querySelector("[data-hint]")?.textContent;
}

function stubStamps(): (string | null)[] {
  return [...document.querySelectorAll("[data-stub-stamp]")].map((stamp) => stamp.getAttribute("data-stub-stamp"));
}

function swipeCard(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-swipe-card]");
  if (!element) throw new Error("no swipe card");
  return element;
}

function stored() {
  return parseProgress(h.local.getItem(PROGRESS_KEY));
}

const POINTER = { pointerId: 1, isPrimary: true, pointerType: "touch" };

/** One answer, then on to the next card and past its settle time. */
async function answerAndOn(right: boolean) {
  const previous = statementText();
  give(right);
  run(700);
  await nextCard(previous);
  h.advance(300);
}

describe("PlayScreen Timed: the clock", () => {
  it("shows the Timer header from the first card", async () => {
    await start();
    expect(headerName()).toBe("60 seconds left of 60. 0 correct, 0 wrong.");
    expect(progressText()).toBe("1:00 left");
    expect(tally()).toBe("0 correct · 0 wrong");
    expect(fields()).toEqual(["Timed", "01", "F ← → T"]);
  });

  it("counts the clock down from the first card", async () => {
    await start();
    run(19_000);
    expect(progressText()).toBe("0:41 left");
    expect(headerName()).toBe("41 seconds left of 60. 0 correct, 0 wrong.");
  });

  it("pauses the clock while the page is hidden", async () => {
    await start();
    run(5_000);
    setHidden(true);
    run(30_000);
    expect(progressText()).toBe("0:55 left");
    setHidden(false);
    run(1_000);
    expect(progressText()).toBe("0:54 left");
  });

  it("counts one second for a long gap between two ticks", async () => {
    await start();
    h.advance(45_000);
    tick();
    expect(progressText()).toBe("0:59 left");
  });
});

describe("PlayScreen Timed: the stamp beat", () => {
  it("stamps an answer on the stub: no slip, no Next card, the buttons dimmed", async () => {
    await start();
    give(true);
    expect(stubStamps()).toEqual(["correct"]);
    expect(hint()).toBe("Next card coming up");
    expect(document.querySelector("[data-slip]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    expect(screen.getByRole("button", { name: "True" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "False" }).getAttribute("aria-disabled")).toBe("true");
    expect(status()).toBe("Correct.");
    expect(tally()).toBe("1 correct · 0 wrong");
    expect(document.querySelector("[data-plane]")?.getAttribute("class")).not.toContain("opacity-0");

    cleanup();
    await start();
    give(false);
    expect(stubStamps()).toEqual(["wrong"]);
    expect(hint()).toBe("Wrong, saved for review at the end");
    expect(status()).toBe("Not quite.");
    expect(tally()).toBe("0 correct · 1 wrong");
  });

  it("ignores True and False during the stamp", async () => {
    await start();
    give(true);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(screen.getByRole("button", { name: "False" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(tally()).toBe("1 correct · 0 wrong");
    expect(status()).toBe("Correct.");
  });

  it("does nothing on Enter during the stamp", async () => {
    await start();
    const first = statementText();
    give(true);
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(statementText()).toBe(first);
    expect(stubStamps()).toEqual(["correct"]);
  });

  it("takes a swipe and the arrow keys like every mode", async () => {
    await start();
    const first = statementText();
    const right = currentAnswer();
    const card = swipeCard();
    const to = right ? 320 : 80;
    fireEvent.pointerDown(card, { ...POINTER, clientX: 200, clientY: 400 });
    h.advance(200);
    fireEvent.pointerMove(card, { ...POINTER, clientX: (200 + to) / 2, clientY: 400 });
    h.advance(200);
    fireEvent.pointerUp(card, { ...POINTER, clientX: to, clientY: 400 });
    expect(stubStamps()).toEqual(["correct"]);
    run(700);
    await nextCard(first);
    h.advance(300);
    expect(stubStamps()).toEqual([]);
    const second = currentAnswer();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(stubStamps()).toEqual([second ? "wrong" : "correct"]);
  });

  // Review finding U3: a held arrow key answered every new card about 250 ms after it settled.
  it("answers once for a held arrow key: its repeats do not answer the next card", async () => {
    await start();
    const first = statementText();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(stubStamps()).toHaveLength(1);
    run(700);
    await nextCard(first);
    h.advance(300);
    fireEvent.keyDown(window, { key: "ArrowRight", repeat: true });
    expect(stubStamps()).toEqual([]);
    expect(tally()).toMatch(/^(1 correct · 0 wrong|0 correct · 1 wrong)$/);
  });

  it("shows the next card 700 ms after the answer, not before", async () => {
    await start();
    const first = statementText();
    give(true);
    run(600);
    expect(statementText()).toBe(first);
    expect(stubStamps()).toEqual(["correct"]);
    run(100);
    await nextCard(first);
    expect(fields()[1]).toBe("02");
    expect(screen.getByRole("button", { name: "True" }).hasAttribute("aria-disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "False" }).hasAttribute("aria-disabled")).toBe(false);
    expect(stubStamps()).toEqual([]);
    expect(hint()).toBeUndefined();
    expect(status()).toBe("");
  });

  it("keeps the settle time on the new card", async () => {
    await start();
    const first = statementText();
    give(true);
    run(700);
    await nextCard(first);
    give(true);
    expect(stubStamps()).toEqual([]);
    h.advance(250);
    give(true);
    expect(stubStamps()).toEqual(["correct"]);
  });

  it("never shows an explanation or the answer during play", async () => {
    await start();
    const explanation = /^Explanation /;
    const noAnswer = () => {
      expect(screen.queryByText("The answer is")).toBeNull();
      expect(screen.queryByText(explanation)).toBeNull();
      expect(status() ?? "").not.toMatch(/answer is/);
    };
    noAnswer();
    give(true);
    noAnswer();
    run(700);
    await nextCard(null);
    h.advance(300);
    give(false);
    noAnswer();
    run(60_000);
    expect(stubStamps()).toContain("time-up");
    noAnswer();
  });

  // Each card is a new element (the swap keys it by round.index), and a live region that arrives with its
  // text is not reliably read by screen readers. So the statement is announced from a region that stays
  // mounted outside the card, and the card's own statement is not live (nothing is read twice).
  it("announces each new card from a live region that stays mounted; the statement takes focus on the first card only", async () => {
    await start();
    const announcer = document.querySelector("[data-card-announcer]");
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
    expect(announcer?.getAttribute("aria-atomic")).toBe("true");
    expect(announcer?.textContent).toBe("");
    const statement = document.querySelector("[data-statement]");
    expect(statement?.hasAttribute("aria-live")).toBe(false);
    expect(document.activeElement).toBe(statement);

    const first = statementText();
    const pill = button(true);
    pill.focus();
    fireEvent.click(pill);
    expect(announcer?.textContent).toBe("");
    run(700);
    await nextCard(first);
    expect(document.querySelector("[data-card-announcer]")).toBe(announcer);
    expect(announcer?.textContent).toBe(`Card 2. ${statementText()}`);
    const next = document.querySelector("[data-statement]");
    expect(next?.hasAttribute("aria-live")).toBe(false);
    expect(document.activeElement).not.toBe(next);
    expect(document.activeElement?.textContent).toMatch(/^(True|False)$/);

    // The stamp does not change it (so it is not read again); the third card replaces it.
    const second = statementText();
    h.advance(300);
    give(false);
    expect(announcer?.textContent).toBe(`Card 2. ${second}`);
    run(700);
    await nextCard(second);
    expect(announcer?.textContent).toBe(`Card 3. ${statementText()}`);

    // At time up the card does not count: the status says so and the region falls silent.
    runToTimeUp();
    expect(announcer?.textContent).toBe("");
    expect(status()).toBe("Time is up. This card doesn't count.");
  });

  it("has no card announcer outside Timed", async () => {
    await start(harness(pendingFor("classic")));
    expect(document.querySelector("[data-card-announcer]")).toBeNull();
  });
});

describe("PlayScreen Timed: time up", () => {
  it("at time up keeps the card, closes the gate and offers only See results", async () => {
    await start();
    const first = statementText();
    runToTimeUp();
    expect(statementText()).toBe(first);
    expect(stubStamps()).toEqual(["time-up"]);
    expect(fields()[2]).toBe("Closed");
    const statement = document.querySelector("[data-statement][data-muted]");
    expect(statement).not.toBeNull();
    expect(statement?.hasAttribute("aria-live")).toBe(false);
    expect(hint()).toBe("This card doesn't count · 0 answered");
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "True" })).toBeNull());
    expect(screen.queryByRole("button", { name: "False" })).toBeNull();
    expect(headerName()).toBe("Time is up. 0 cards answered: 0 correct, 0 wrong.");
    expect(progressText()).toBe("0:00 left");
    expect([...document.querySelectorAll("[data-quarter]")].map((mark) => mark.getAttribute("data-quarter"))).toEqual(["passed", "passed", "passed"]);
    expect(status()).toBe("Time is up. This card doesn't count.");
    expect(h.ticking()).toBe(0);
  });

  it("a tap right after time is up does not open the result", async () => {
    await start();
    runToTimeUp();
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
    h.advance(NEXT_ARRIVES_MS - 1);
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
    h.advance(1);
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });

  it("See results takes taps once it has arrived", async () => {
    await start();
    runToTimeUp();
    const wrapper = screen.getByRole("button", { name: "See results" }).parentElement;
    if (!wrapper) throw new Error("no wrapper");
    expect(wrapper.className).toContain("pointer-events-none");
    await waitFor(() => expect(wrapper.className).not.toContain("pointer-events-none"), { timeout: 1500 });
  });

  it("Enter opens the result once See results has arrived", async () => {
    await start();
    runToTimeUp();
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "Round complete" })).toBeTruthy();
  });

  it("time running out during the stamp keeps that answer and shows a card that does not count", async () => {
    await start();
    const first = statementText();
    run(59_000); // 1000 + 589 x 100 counted: 100 ms are left
    expect(progressText()).toBe("0:01 left");
    give(true);
    run(100);
    await nextCard(first);
    expect(fields()[1]).toBe("02");
    expect(stubStamps()).toEqual(["time-up"]);
    expect(hint()).toBe("This card doesn't count · 1 answered");
    expect(tally()).toBe("1 correct · 0 wrong");
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("records the finished round: the correct answers as the record, the card at zero not in the history", async () => {
    await start();
    const first = cardByStatement(statementText());
    await answerAndOn(true);
    const second = cardByStatement(statementText());
    await answerAndOn(false);
    const third = cardByStatement(statementText());
    run(60_000);
    expect(stubStamps()).toEqual(["time-up"]);
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    await screen.findByRole("heading", { name: "Round complete" });
    const progress = stored();
    expect(progress.records).toEqual({ [`${DECK_ID}/SEC#timed`]: 1 });
    expect(Object.keys(progress.cards).sort()).toEqual([first.id, second.id].sort());
    expect(progress.cards[third.id]).toBeUndefined();
    expect(progress.last).toEqual({ route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "timed", score: 1, total: 2 });
  });
});

// On a short phone (320 by 568) the ticket is taller than the stage and the stub lies under the answer row.
// jsdom has no layout: the ticket's scroll calls are recorded with a scroll height of 900, and the e2e spec
// small-screens measures where the stamp ends up.
describe("PlayScreen Timed: bringing the stamped stub into view", () => {
  const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo");
  const originalScrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
  let scrolls: unknown[] = [];
  beforeEach(() => {
    scrolls = [];
    Object.defineProperty(Element.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value(this: Element, options?: unknown) {
        if (this.querySelector(":scope > [data-swipe-card]")) scrolls.push(options);
      },
    });
    Object.defineProperty(Element.prototype, "scrollHeight", { configurable: true, get: () => 900 });
  });
  afterEach(() => {
    if (originalScrollTo) Object.defineProperty(Element.prototype, "scrollTo", originalScrollTo);
    else delete (Element.prototype as Partial<Element>).scrollTo;
    if (originalScrollHeight) Object.defineProperty(Element.prototype, "scrollHeight", originalScrollHeight);
  });

  it("scrolls the ticket to its end, smoothly, when an answer is stamped, and the next card back to the top", async () => {
    await start();
    scrolls = [];
    const first = statementText();
    give(true);
    await act(async () => {});
    expect(scrolls).toEqual([{ top: 900, behavior: "smooth" }]);
    run(700);
    await nextCard(first);
    expect(scrolls.at(-1)).toEqual({ top: 0, behavior: "smooth" });
  });

  it("scrolls the ticket to its end at time up", async () => {
    await start();
    scrolls = [];
    runToTimeUp();
    await act(async () => {});
    expect(scrolls).toEqual([{ top: 900, behavior: "smooth" }]);
  });

  it("jumps at once when the player asks for reduced motion", async () => {
    motionPreference.reduced = true;
    await start();
    scrolls = [];
    const first = statementText();
    give(false);
    await act(async () => {});
    expect(scrolls).toEqual([{ top: 900, behavior: "instant" }]);
    run(700);
    await nextCard(first);
    expect(scrolls.at(-1)).toEqual({ top: 0, behavior: "instant" });
  });

  // Outside Timed an answer brings the slip into view instead (review finding U44): one smooth scroll, which
  // stops at the slip's top (0 here, jsdom has no layout; PlayScreenScroll.test.tsx sets the geometry). The
  // slip is given a height so that it runs under the action row (the stage here is 0 tall): a slip that ends
  // above the row leaves the ticket where it is.
  it("scrolls once to the slip after an answer outside Timed, not to the end of the ticket", async () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.matches("[data-slip]") ? 100 : 0;
      },
    });
    onTestFinished(() => {
      if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    });
    await start(harness(pendingFor("classic")));
    scrolls = [];
    give(true);
    await act(async () => {});
    expect(scrolls).toEqual([{ top: 0, behavior: "smooth" }]);
  });
});

describe("PlayScreen Timed: leaving", () => {
  const LEFT = { route: { deckId: DECK_ID, sectionId: "SEC" }, mode: "timed", score: null, total: null };

  async function leaveThroughTheSheet() {
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave round" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  }

  // Owner decision D1: at time up only the result is left, so leaving records the round; earlier it does not.
  it("leaving at time up records the round as its result would, leaving earlier sets no record", async () => {
    await start();
    const first = cardByStatement(statementText());
    await answerAndOn(true);
    run(60_000);
    expect(stubStamps()).toEqual(["time-up"]);
    await leaveThroughTheSheet();
    const atTimeUp = stored();
    expect(atTimeUp.records).toEqual({ "test-deck/SEC#timed": 1 });
    expect(Object.keys(atTimeUp.cards)).toEqual([first.id]);
    expect(atTimeUp.cards[first.id]?.seen).toBe(1);
    expect(atTimeUp.last).toEqual({ ...LEFT, score: 1, total: 1 });

    cleanup();
    router.replace.mockReset();
    await start();
    const midRound = cardByStatement(statementText());
    await answerAndOn(true);
    await leaveThroughTheSheet();
    const earlier = stored();
    expect(earlier.records).toEqual({});
    expect(Object.keys(earlier.cards)).toEqual([midRound.id]);
    expect(earlier.cards[midRound.id]?.seen).toBe(1);
    expect(earlier.last).toEqual(LEFT);
  });

  // Owner decision D1: the minute ran out, so the round is decided and recorded even with nothing answered,
  // as its result would record it. With no answer to lose the close button still leaves at once.
  it("leaving at time up with nothing answered leaves at once and records the round of 0", async () => {
    await start();
    runToTimeUp();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(stored()).toEqual({
      ...emptyProgress(),
      records: { "test-deck/SEC#timed": 0 },
      last: { ...LEFT, score: 0, total: 0 },
    });
  });

  it("keeps the clock running while the leave sheet is open", async () => {
    await start();
    give(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    run(60_000);
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(stubStamps()).toContain("time-up");
    expect(progressText()).toBe("0:00 left");
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("stops ticking after leaving and after unmounting", async () => {
    await start();
    give(true);
    expect(h.ticking()).toBe(1);
    await leaveThroughTheSheet();
    expect(h.ticking()).toBe(0);

    cleanup();
    const view = await start();
    expect(h.ticking()).toBe(1);
    view.unmount();
    expect(h.ticking()).toBe(0);
  });
});

describe("PlayScreen Timed: focus and input at time up", () => {
  it("moves focus to See results at time up when True or False had it, and leaves it alone otherwise", async () => {
    await start();
    screen.getByRole("button", { name: "True" }).focus();
    runToTimeUp();
    const action = screen.getByRole("button", { name: "See results" });
    await waitFor(() => expect(document.activeElement).toBe(action), { timeout: 1500 });

    cleanup();
    await start();
    const statement = document.querySelector("[data-statement]");
    expect(document.activeElement).toBe(statement);
    runToTimeUp();
    const later = screen.getByRole("button", { name: "See results" });
    const wrapper = later.parentElement;
    await waitFor(() => expect(wrapper?.className).not.toContain("pointer-events-none"), { timeout: 1500 });
    await act(async () => {});
    expect(document.activeElement).not.toBe(later);
    expect(document.activeElement).toBe(statement);
  });

  it("a drag that is under way when time runs out springs back and answers nothing", async () => {
    await start();
    const card = swipeCard();
    fireEvent.pointerDown(card, { ...POINTER, clientX: 200, clientY: 400 });
    fireEvent.pointerMove(card, { ...POINTER, clientX: 260, clientY: 400 });
    expect(card.style.getPropertyValue("--drag-x")).toBe("60");
    runToTimeUp();
    fireEvent.pointerUp(card, { ...POINTER, clientX: 300, clientY: 400 });
    expect(hint()).toBe("This card doesn't count · 0 answered");
    expect(stubStamps()).toEqual(["time-up"]);
    expect(tally()).toBe("0 correct · 0 wrong");
    expect(card.hasAttribute("data-dragging")).toBe(false);
    expect(card.style.getPropertyValue("--drag-x")).toBe("0");
  });

  it("Play again after a Timed result starts a full minute", async () => {
    await start();
    give(true);
    run(60_000);
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    const again = await screen.findByRole("button", { name: "Play again" });
    h.advance(RESULT_ARRIVES_MS); // the result's actions take presses once they have arrived
    fireEvent.click(again);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    expect(headerName()).toBe("60 seconds left of 60. 0 correct, 0 wrong.");
    expect(h.ticking()).toBe(1);
    give(true);
    expect(stubStamps()).toEqual(["correct"]);
    run(59_000);
    expect(progressText()).toBe("0:00 left");
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    expect(screen.queryByRole("heading", { name: "Round complete" })).toBeNull();
  });
});

describe("timedStatus", () => {
  it("says nothing on a question, the verdict alone during the stamp and that the card does not count at time up", () => {
    const pool = DECK.cards.filter((card) => card.section === "SEC");
    const question = reduce(startRound({ mode: "timed", route: { deckId: DECK_ID, sectionId: "SEC" }, pool, history: {}, seed: 1 }), { type: "tick", now: 0 });
    expect(timedStatus(question)).toBe("");
    const card = question.cards[0];
    if (!card) throw new Error("no card");
    expect(timedStatus(reduce(question, { type: "answer", value: card.answer, at: 500 }))).toBe("Correct.");
    expect(timedStatus(reduce(question, { type: "answer", value: !card.answer, at: 500 }))).toBe("Not quite.");
    let up = question;
    for (let now = 1000; now <= 60_000; now += 1000) up = reduce(up, { type: "tick", now });
    expect(timedStatus(up)).toBe("Time is up. This card doesn't count.");
  });
});

describe("timedCardText", () => {
  it("says nothing on the first card, the card number and statement from the second on, and nothing at time up", () => {
    const pool = DECK.cards.filter((card) => card.section === "SEC");
    const question = reduce(startRound({ mode: "timed", route: { deckId: DECK_ID, sectionId: "SEC" }, pool, history: {}, seed: 1 }), { type: "tick", now: 0 });
    expect(timedCardText(question)).toBe("");
    const first = question.cards[0];
    if (!first) throw new Error("no card");
    const stamped = reduce(question, { type: "answer", value: first.answer, at: 500 });
    expect(timedCardText(stamped)).toBe("");
    const second = reduce(stamped, { type: "tick", now: 1200 });
    const card = second.cards[second.index];
    if (second.index !== 1 || !card) throw new Error("the second card was not dealt");
    expect(timedCardText(second)).toBe(`Card 2. ${card.text.en.statement}`);
    expect(timedCardText(reduce(second, { type: "answer", value: card.answer, at: 1500 }))).toBe(`Card 2. ${card.text.en.statement}`);
    let up = second;
    for (let now = 2000; now <= 61_000; now += 1000) up = reduce(up, { type: "tick", now });
    expect(timedCardText(up)).toBe("");
  });

  it("reads a code fragment as it is shown, without its backticks", () => {
    const pool = DECK.cards
      .filter((card) => card.section === "SEC")
      .map((card) => ({ ...card, text: { en: { ...card.text.en, statement: `\`docker run\` ${card.text.en.statement}` } } }));
    const question = reduce(startRound({ mode: "timed", route: { deckId: DECK_ID, sectionId: "SEC" }, pool, history: {}, seed: 1 }), { type: "tick", now: 0 });
    const first = question.cards[0];
    if (!first) throw new Error("no card");
    const second = reduce(reduce(question, { type: "answer", value: first.answer, at: 500 }), { type: "tick", now: 1200 });
    const card = second.cards[second.index];
    if (second.index !== 1 || !card) throw new Error("the second card was not dealt");
    expect(timedCardText(second)).toBe(`Card 2. docker run ${card.text.en.statement.slice("`docker run` ".length)}`);
  });
});
