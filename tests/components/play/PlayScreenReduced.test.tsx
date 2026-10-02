// @vitest-environment jsdom
// Review finding U128: the play screen with reduced motion (spec section 9, "Motion": every transition has a
// reduced-motion fallback; plan: every end state is correct without its animation). Focus reaches Next card
// at once rather than when the row has come in, and the Timed card changes in place instead of being swapped.
// The Next row's fade without delay is seen in a real browser (e2e/reduced-motion.spec.ts).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "./fixtures";

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

let h: Harness;

async function start(setup: Harness = harness()) {
  h = setup;
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time of the first card
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** The wrapper of the card on the stage (CardSlot): in Timed with full motion it is the swap's animated layer. */
function cardSlots(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-swipe-card] > div > div")];
}

describe("PlayScreen with reduced motion: focus after an answer", () => {
  it("moves focus to Next card at once, without waiting for the row to come in", async () => {
    motionPreference.reduced = true;
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next card" }));
  });

  it("control: with full motion focus waits for the row to come in", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    await act(async () => {});
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Next card" }));
  });
});

describe("PlayScreen with reduced motion: the Timed card", () => {
  it("changes in place: one plain card wrapper, before and after the next card is dealt", async () => {
    motionPreference.reduced = true;
    await start(harness(pendingFor("timed")));
    expect(cardSlots()).toHaveLength(1);
    expect(cardSlots()[0]?.style.zIndex).toBe("");
    const first = statementText();
    fireEvent.click(screen.getByRole("button", { name: cardByStatement(first).answer ? "True" : "False" }));
    act(() => h.run(800)); // the stamp beat (700 ms), then the next card is dealt
    await act(async () => {});
    expect(statementText()).not.toBe(first);
    expect(cardSlots()).toHaveLength(1);
    expect(cardSlots()[0]?.style.zIndex).toBe("");
    expect(document.querySelectorAll("[data-statement]")).toHaveLength(1);
  });

  it("control: with full motion the Timed card is the swap's layer", async () => {
    await start(harness(pendingFor("timed")));
    expect(cardSlots()).toHaveLength(1);
    expect(cardSlots()[0]?.style.zIndex).toBe("0");
  });
});
