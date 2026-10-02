// @vitest-environment jsdom
// The stamps of the play screen land when they appear (design system 5.11 and 7, "Stamp lands", "Timed beat",
// "Time is up"): the slip stamp and the stub stamp start large, turned and invisible, and only reduced motion
// shows them at rest. The card is a child of an AnimatePresence with initial={false} (the Timed swap), and
// Motion lets that block the first animation of everything mounted inside it, so these tests read the
// stamp's inline style in the frame it appears, before any animation has run.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NEXT_ARRIVES_MS, PlayScreen } from "@/components/play/PlayScreen";
import { TIMED } from "@/src/engine/round";
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
beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

let h: Harness;

async function start(setup: Harness) {
  h = setup;
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  // findByRole can resolve before React has run the effects of that render: flush them before anything fires.
  await act(async () => {});
  h.advance(1000); // past the 250 ms settle time
}

function statementText(): string | null | undefined {
  return document.querySelector("[data-statement] p:last-of-type")?.textContent;
}

/** Answers the card on screen right (or wrong). */
function answer(right = true) {
  const truth = cardByStatement(statementText()).answer;
  fireEvent.click(screen.getByRole("button", { name: (right ? truth : !truth) ? "True" : "False" }));
}

function only(selector: string): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>(selector);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function expectLanding(stamp: HTMLElement) {
  expect(stamp.style.opacity).toBe("0");
  expect(stamp.style.transform).toContain("scale(1.9)");
  expect(stamp.style.transform).toContain("rotate(-14deg)");
}

function expectAtRest(stamp: HTMLElement) {
  expect(stamp.style.opacity).toBe("1");
  expect(stamp.style.transform).not.toContain("scale(1.9)");
  expect(stamp.style.transform).toContain("rotate(-6deg)");
}

describe("PlayScreen: the slip stamp lands", () => {
  it("in Classic, on the first card and on the next one", async () => {
    await start(harness(pendingFor("classic")));
    answer(true);
    expectLanding(only("[data-verdict]"));

    const next = await screen.findByRole("button", { name: "Next card" });
    h.advance(NEXT_ARRIVES_MS);
    fireEvent.click(next);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    answer(false);
    const stamp = only("[data-verdict]");
    expect(stamp.getAttribute("data-verdict")).toBe("wrong");
    expectLanding(stamp);
  });

  it("in Streak, on the deciding answer", async () => {
    await start(harness(pendingFor("streak")));
    answer(false);
    // Read the stamp in the frame it appears: waiting for "See results" first lets a frame pass, and with
    // animations skipped the stamp is then already at rest (this failed on the slower CI machine).
    expectLanding(only("[data-verdict]"));
    expect(await screen.findByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("with reduced motion it is shown at rest and the slip fades in", async () => {
    motionPreference.reduced = true;
    await start(harness(pendingFor("classic")));
    answer(true);
    expectAtRest(only("[data-verdict]"));
    expect(only("[data-slip]").style.opacity).toBe("0");
  });
});

describe("PlayScreen: the stub stamp lands in Timed", () => {
  it("on the first card, on the next one and at time up", async () => {
    await start(harness(pendingFor("timed")));
    answer(true);
    expectLanding(only('[data-stub-stamp="correct"]'));

    // The stamp holds, then the next card is dealt; its stamp lands too.
    act(() => {
      h.advance(TIMED.holdMs);
      h.tick();
    });
    await act(async () => {});
    h.advance(1000);
    answer(false);
    expectLanding(only('[data-stub-stamp="wrong"]'));

    act(() => h.run(TIMED.roundMs));
    expectLanding(only('[data-stub-stamp="time-up"]'));
  });

  it("with reduced motion it is shown at rest", async () => {
    motionPreference.reduced = true;
    await start(harness(pendingFor("timed")));
    answer(true);
    expectAtRest(only('[data-stub-stamp="correct"]'));
  });
});
