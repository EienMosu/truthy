// @vitest-environment jsdom
// Review finding U129: while the chosen card's name travels into the pass, the card's own name is hidden, so
// the name is never on screen twice. jsdom has no layout, so the flow never finds the frame the copy travels
// in; here every element's offsetParent is its parent, which gives the flow one.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StartFlow } from "@/components/start/StartFlow";
import { SWIPE } from "@/src/input/swipe";
import { harness, type Harness } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
});
afterAll(() => {
  if (offsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", offsetParent);
});
afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

let h: Harness;

/** The name on the Cloud card, then the card pressed: the name as the press left it. */
async function chooseCloud(): Promise<HTMLElement> {
  h = harness();
  render(<StartFlow services={h.services} />);
  const card = await screen.findByRole("button", { name: "Cloud, 2 decks" });
  const name = card.querySelector<HTMLElement>("[data-card-name]");
  if (!name) throw new Error("The Cloud card has no name");
  h.clock.time += SWIPE.settleMs;
  fireEvent.click(card);
  return name;
}

function heading(): string | null | undefined {
  return [...document.querySelectorAll("[data-step]:not([inert]) h2")].at(-1)?.textContent;
}

describe("StartFlow: the chosen name travels alone", () => {
  it("hides the chosen card's name while its copy travels into the pass", async () => {
    const name = await chooseCloud();
    expect(name.style.opacity).toBe("0");
    await waitFor(() => expect(heading()).toBe("Choose a platform"));
  });

  it("shows the name again when the player goes back while the card is still leaving", async () => {
    const name = await chooseCloud();
    expect(name.style.opacity).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Back to areas" }));
    await act(async () => {});
    await waitFor(() => expect(heading()).toBe("Choose an area"));
    expect(name.style.opacity).toBe("");
  });

  it("control: with reduced motion nothing travels and the name is not touched", async () => {
    motionPreference.reduced = true;
    const name = await chooseCloud();
    expect(name.style.opacity).toBe("");
  });
});
