// @vitest-environment jsdom
// Review finding U4: the wall clock can be set back in the middle of a round (by hand, or by a large time
// correction). The screen's guards (a card's settle time, the arrival of Next card and of the result's
// actions) run on a clock that never goes back, so a jump of the wall clock does not drop the player's
// presses; the answers keep the wall clock's time, which the card history stores.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { RESULT_ARRIVES_MS } from "@/components/play/ResultView";
import { PROGRESS_KEY } from "@/src/progress/local";
import { parseProgress } from "@/src/progress/progress";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const POINTER = { pointerId: 1, isPrimary: true, pointerType: "touch" };

let h: Harness;
// How far the wall clock (services.now) has been set back; the monotonic clock goes on.
let back = 0;

async function start(mode: "classic" | "streak" | "timed") {
  h = harness(pendingFor(mode));
  back = 0;
  const steady = h.services;
  h.services = { ...steady, now: () => steady.now() - back };
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000); // past the settle time of the first card
}

function answerOnScreen(): boolean {
  return cardByStatement(document.querySelector("[data-statement] p:last-of-type")?.textContent).answer;
}

function status(): string | null {
  return screen.getAllByRole("status").at(-1)?.textContent ?? null;
}

function cardLabel(): string | null {
  return screen.getByRole("img", { name: /^Card \d+ of 10\./ }).getAttribute("aria-label");
}

describe("a wall clock set back in the middle of a round", () => {
  it("still takes a tap, and Next card still moves on once it has arrived", async () => {
    await start("classic");
    back = 60_000;
    const right = answerOnScreen();
    fireEvent.click(screen.getByRole("button", { name: right ? "True" : "False" }));
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);
    const next = await screen.findByRole("button", { name: "Next card" });
    back = 120_000;
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(next);
    await screen.findByRole("button", { name: "True" });
    expect(cardLabel()).toMatch(/^Card 2 of 10\./);
  });

  it("still takes an arrow key and a swipe", async () => {
    await start("classic");
    back = 60_000;
    const right = answerOnScreen();
    fireEvent.keyDown(document.body, { key: right ? "ArrowRight" : "ArrowLeft" });
    expect(status()).toBe(`Correct. The answer is ${right ? "True" : "False"}.`);

    cleanup();
    await start("classic");
    back = 60_000;
    const card = document.querySelector<HTMLElement>("[data-swipe-card]");
    if (!card) throw new Error("no swipe card");
    const to = answerOnScreen() ? 320 : 80;
    fireEvent.pointerDown(card, { ...POINTER, clientX: 200, clientY: 400 });
    h.advance(200);
    fireEvent.pointerMove(card, { ...POINTER, clientX: (200 + to) / 2, clientY: 400 });
    h.advance(200);
    fireEvent.pointerUp(card, { ...POINTER, clientX: to, clientY: 400 });
    expect(status()).toMatch(/^Correct\./);
  });

  it("keeps the wall clock's time in the card history", async () => {
    await start("classic");
    back = 60_000;
    const first = cardByStatement(document.querySelector("[data-statement] p:last-of-type")?.textContent);
    const at = h.services.now();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave round" }));
    expect(parseProgress(h.local.getItem(PROGRESS_KEY)).cards[first.id]?.lastSeenAt).toBe(at);
  });

  it("counts a Timed answer given after the jump", async () => {
    await start("timed");
    back = 300_000;
    fireEvent.click(screen.getByRole("button", { name: answerOnScreen() ? "True" : "False" }));
    expect(document.querySelector("[data-tally]")?.textContent).toBe("1 correct · 0 wrong");
  });

  it("lets the result's Play again take presses once they have arrived", async () => {
    await start("streak");
    fireEvent.click(screen.getByRole("button", { name: answerOnScreen() ? "False" : "True" }));
    const results = await screen.findByRole("button", { name: "See results" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(results);
    const again = await screen.findByRole("button", { name: "Play again" });
    back = 60_000;
    h.advance(RESULT_ARRIVES_MS);
    fireEvent.click(again);
    expect(await screen.findByRole("button", { name: "True" })).toBeTruthy();
  });
});
