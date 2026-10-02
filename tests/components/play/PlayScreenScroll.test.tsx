// @vitest-environment jsdom
// Where the play screen scrolls its ticket (review findings U44 and U49). The ticket scrolls inside the stage
// when it is taller than the space, and the stage runs on under the opaque action row. jsdom has no layout, so
// the scroller's size and the offsets of the statement and the slip are set by hand (the padding under the
// stage resolves to 0 here, so the visible stage is the scroller's client height); the e2e spec
// ticket-in-view measures the real boxes.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import type { Mode } from "@/src/content/play";
import { PROGRESS_KEY } from "@/src/progress/local";
import { emptyProgress } from "@/src/progress/progress";
import { DECK_ID, cardByStatement, harness, memoryStorage, pendingFor, type Harness } from "./fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

// The geometry: a stage 300 tall over a ticket 900 tall (so it scrolls up to 600); the statement's text runs
// from 400 to 560 in the ticket, the slip starts at `slipTop`.
const VISIBLE = 300;
const HEIGHT = 900;
const TEXT_TOP = 400;
const TEXT_BOTTOM = 560;
let slipTop = 700;
let scrollTop = 0;
let scrolls: ScrollToOptions[] = [];

function isScroller(element: Element): boolean {
  return element.querySelector(":scope > [data-swipe-card]") !== null;
}

function statementChild(element: Element): "first" | "last" | null {
  const parent = element.parentElement;
  if (!parent?.matches("[data-statement]")) return null;
  return parent.firstElementChild === element ? "first" : parent.lastElementChild === element ? "last" : null;
}

const saved = new Map<string, [object, PropertyDescriptor | undefined]>();
function mock(target: object, name: string, descriptor: PropertyDescriptor) {
  saved.set(`${target === Element.prototype ? "Element" : "HTMLElement"}.${name}`, [target, Object.getOwnPropertyDescriptor(target, name)]);
  Object.defineProperty(target, name, { configurable: true, ...descriptor });
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
  slipTop = 700;
  scrollTop = 0;
  scrolls = [];
  mock(Element.prototype, "scrollTo", {
    writable: true,
    value(this: Element, options?: ScrollToOptions) {
      if (!isScroller(this) || options === undefined) return;
      scrolls.push(options);
      scrollTop = options.top ?? scrollTop;
    },
  });
  mock(Element.prototype, "scrollTop", {
    get(this: Element) {
      return isScroller(this) ? scrollTop : 0;
    },
    set(this: Element, value: number) {
      if (isScroller(this)) scrollTop = value;
    },
  });
  mock(Element.prototype, "scrollHeight", {
    get(this: Element) {
      return isScroller(this) ? HEIGHT : 0;
    },
  });
  mock(Element.prototype, "clientHeight", {
    get(this: Element) {
      return isScroller(this) ? VISIBLE : 0;
    },
  });
  mock(HTMLElement.prototype, "offsetTop", {
    get(this: HTMLElement) {
      if (this.matches("[data-slip]")) return slipTop;
      const child = statementChild(this);
      return child === "first" ? TEXT_TOP : child === "last" ? TEXT_TOP + 30 : 0;
    },
  });
  mock(HTMLElement.prototype, "offsetHeight", {
    get(this: HTMLElement) {
      const child = statementChild(this);
      if (child === null) return 0;
      // The last child (or the only one) ends at TEXT_BOTTOM.
      return this.parentElement?.lastElementChild === this ? TEXT_BOTTOM - (child === "first" ? TEXT_TOP : TEXT_TOP + 30) : 30;
    },
  });
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
  for (const [key, [target, descriptor]] of saved) {
    const name = key.split(".")[1] ?? "";
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete (target as Record<string, unknown>)[name];
  }
  saved.clear();
});

let h: Harness;

async function start(mode: Mode = "classic", setup: Harness = harness(pendingFor(mode))) {
  h = setup;
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time of the first card
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** Answers the card on screen right (or wrong) with the buttons, and lets React run the effects. */
async function give(right: boolean) {
  const answer = cardByStatement(statementText()).answer;
  fireEvent.click(screen.getByRole("button", { name: (right ? answer : !answer) ? "True" : "False" }));
  await act(async () => {});
}

async function pressNext() {
  const next = await screen.findByRole("button", { name: /^(Next card|See results)$/ });
  h.advance(NEXT_ARRIVES_MS);
  fireEvent.click(next);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000); // past the settle time of the new card
}

function ticket(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-swipe-card]")?.parentElement;
  if (!element) throw new Error("no ticket");
  return element;
}

describe("PlayScreen: the verdict slip comes into view after an answer (U44)", () => {
  for (const mode of ["classic", "streak", "lives"] as const) {
    it(`scrolls the ticket to its end, smoothly, in ${mode}, so the slip ends above the action row`, async () => {
      await start(mode);
      scrolls = [];
      await give(true);
      expect(scrolls).toEqual([{ top: HEIGHT - VISIBLE, behavior: "smooth" }]);
    });
  }

  it("stops at the top of a slip taller than the stage, so the answer and its stamp stay in view", async () => {
    slipTop = 450;
    await start();
    scrolls = [];
    await give(false);
    expect(scrolls).toEqual([{ top: 450, behavior: "smooth" }]);
  });

  it("jumps at once when the player asks for reduced motion", async () => {
    motionPreference.reduced = true;
    await start();
    scrolls = [];
    await give(true);
    expect(scrolls).toEqual([{ top: HEIGHT - VISIBLE, behavior: "instant" }]);
  });

  it("brings in the New best slip of a Streak", async () => {
    const local = memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), records: { [`${DECK_ID}/SEC#streak`]: 1 } }) });
    await start("streak", harness(pendingFor("streak"), local));
    await give(true);
    await pressNext();
    scrolls = [];
    await give(true);
    expect(document.querySelector('[data-slip] [data-verdict="new-best"]')).not.toBeNull();
    expect(scrolls).toEqual([{ top: HEIGHT - VISIBLE, behavior: "smooth" }]);
  });

  it("scrolls once per answer: the screen rendering again does not pull the ticket back", async () => {
    await start();
    await give(true);
    scrolls = [];
    h.advance(NEXT_ARRIVES_MS);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, NEXT_ARRIVES_MS + 50));
    });
    expect(screen.getByRole("button", { name: "Next card" })).toBe(document.activeElement);
    expect(scrolls).toEqual([]);
  });
});

describe("PlayScreen: a new card shows its statement above the action row (U49)", () => {
  it("scrolls the first card so its statement ends above True and False", async () => {
    // The first card's effect runs inside start(): the ticket is already where it should be.
    await start();
    expect(scrolls.at(-1)).toEqual({ top: TEXT_BOTTOM - VISIBLE, behavior: "instant" });
    expect(scrollTop).toBe(TEXT_BOTTOM - VISIBLE);
  });

  it("does the same for each next card in Classic, at once", async () => {
    await start();
    await give(true);
    scrolls = [];
    await pressNext();
    expect(scrolls).toEqual([{ top: TEXT_BOTTOM - VISIBLE, behavior: "instant" }]);
  });

  it("glides there in Timed from the stamped stub", async () => {
    await start("timed");
    const first = statementText();
    await give(true);
    act(() => h.run(700));
    await waitFor(() => {
      expect(document.querySelectorAll("[data-statement]")).toHaveLength(1);
      expect(statementText()).not.toBe(first);
    });
    await act(async () => {});
    expect(scrolls.at(-1)).toEqual({ top: TEXT_BOTTOM - VISIBLE, behavior: "smooth" });
  });
});

describe("PlayScreen: the ticket scrolls by keyboard in every mode (U49)", () => {
  it("is a stop of its own in the Tab order, named Ticket", async () => {
    await start("timed");
    const group = screen.getByRole("group", { name: "Ticket" });
    expect(group).toBe(ticket());
    expect(group.tabIndex).toBe(0);
  });

  it("scrolls with the arrow keys, Page Up and Down, Space, Home and End when focus is outside the ticket", async () => {
    await start("timed");
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    scrollTop = 100;
    scrolls = [];
    const press = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key, ...init });
    press("ArrowDown");
    expect(scrollTop).toBe(140);
    press("ArrowUp");
    expect(scrollTop).toBe(100);
    press("PageDown");
    expect(scrollTop).toBe(100 + VISIBLE - 40);
    press("PageUp");
    expect(scrollTop).toBe(100);
    press(" ");
    expect(scrollTop).toBe(100 + VISIBLE - 40);
    press(" ", { shiftKey: true });
    expect(scrollTop).toBe(100);
    press("End");
    expect(scrollTop).toBe(HEIGHT - VISIBLE);
    press("ArrowDown");
    expect(scrollTop).toBe(HEIGHT - VISIBLE);
    press("Home");
    expect(scrollTop).toBe(0);
    press("ArrowUp");
    expect(scrollTop).toBe(0);
    expect(scrolls.every((options) => options.behavior === "instant")).toBe(true);
  });

  it("scrolls with the arrow keys from the pill the player used, and leaves Space to the pill", async () => {
    await start("timed");
    const trueButton = screen.getByRole("button", { name: "True" });
    trueButton.focus();
    scrollTop = 0;
    scrolls = [];
    fireEvent.keyDown(trueButton, { key: "ArrowDown" });
    expect(scrollTop).toBe(40);
    fireEvent.keyDown(trueButton, { key: " " });
    expect(scrollTop).toBe(40);
  });

  // Safari does not scroll a focused scroller by keys, so the screen does it there too.
  it("scrolls the same way when focus is in the ticket: the ticket itself, the statement, the source link", async () => {
    await start();
    expect(document.activeElement?.matches("[data-statement]")).toBe(true);
    scrollTop = 0;
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowDown" });
    expect(scrollTop).toBe(40);
    fireEvent.keyDown(ticket(), { key: "PageDown" });
    expect(scrollTop).toBe(40 + VISIBLE - 40);
    fireEvent.keyDown(ticket(), { key: " " });
    expect(scrollTop).toBe(40 + 2 * (VISIBLE - 40));
    await give(true);
    const link = screen.getByRole("link", { name: /\(opens in a new tab\)$/ });
    scrollTop = 0;
    fireEvent.keyDown(link, { key: "ArrowDown" });
    expect(scrollTop).toBe(40);
    fireEvent.keyDown(link, { key: " " });
    expect(scrollTop).toBe(40);
  });

  it("does not scroll with a modifier key or while the Leave round sheet is open", async () => {
    await start();
    (document.activeElement as HTMLElement | null)?.blur();
    scrolls = [];
    fireEvent.keyDown(document.body, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(document.body, { key: "ArrowDown", metaKey: true });
    fireEvent.keyDown(document.body, { key: "ArrowDown", ctrlKey: true });
    expect(scrolls).toEqual([]);
    await give(true);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    scrolls = [];
    fireEvent.keyDown(within(dialog).getByRole("button", { name: "Keep playing" }), { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "End" });
    expect(scrolls).toEqual([]);
  });
});
