// @vitest-environment jsdom
// Review finding U48: in Timed only the first card's statement takes focus. A player who answers by key or by
// swipe has focus there, and that statement leaves with its card, so focus fell to the page for the rest of
// the minute. It now goes to the ticket, which stays mounted; a player who taps True or False keeps focus on
// the pill.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

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
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

const POINTER = { pointerId: 1, isPrimary: true, pointerType: "touch" };
let h: Harness;

async function startTimed() {
  h = harness(pendingFor("timed"));
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** Lets the stamp hold and waits for the next card to be dealt and settle. */
async function onToTheNextCard(previous: string | null | undefined) {
  act(() => h.run(700));
  await vi.waitFor(() => expect(statementText()).not.toBe(previous));
  await act(async () => {});
  h.advance(300);
}

function ticket(): HTMLElement {
  return screen.getByRole("group", { name: "Ticket" });
}

describe("Timed focus from the second card on", () => {
  it.each([false, true])("goes to the ticket after answers by key, not to the page (reduced motion: %s)", async (reduced) => {
    motionPreference.reduced = reduced;
    await startTimed();
    expect(document.activeElement?.closest("[data-statement]")).not.toBeNull();
    for (let card = 1; card <= 3; card += 1) {
      const previous = statementText();
      fireEvent.keyDown(document.body, { key: cardByStatement(previous).answer ? "ArrowRight" : "ArrowLeft" });
      await onToTheNextCard(previous);
      expect(document.activeElement).toBe(ticket());
    }
  });

  it("goes to the ticket after an answer by swipe", async () => {
    await startTimed();
    const previous = statementText();
    const card = document.querySelector<HTMLElement>("[data-swipe-card]");
    if (!card) throw new Error("no swipe card");
    const to = cardByStatement(previous).answer ? 320 : 80;
    fireEvent.pointerDown(card, { ...POINTER, clientX: 200, clientY: 400 });
    h.advance(200);
    fireEvent.pointerMove(card, { ...POINTER, clientX: (200 + to) / 2, clientY: 400 });
    h.advance(200);
    fireEvent.pointerUp(card, { ...POINTER, clientX: to, clientY: 400 });
    await onToTheNextCard(previous);
    expect(document.activeElement).toBe(ticket());
  });

  it("stays on the pill the player tapped", async () => {
    await startTimed();
    const previous = statementText();
    const pill = screen.getByRole("button", { name: cardByStatement(previous).answer ? "True" : "False" });
    pill.focus();
    fireEvent.click(pill);
    await onToTheNextCard(previous);
    expect(document.activeElement).toBe(pill);
  });
});
