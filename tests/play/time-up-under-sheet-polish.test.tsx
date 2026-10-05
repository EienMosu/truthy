// @vitest-environment jsdom
// Review finding U25: the Timed clock keeps running while the "Leave round?" sheet is open, and <main> is
// inert then, so its live regions are not exposed. Time running out under the sheet changed the status there
// and was never heard. The live regions now keep what they said when the sheet opened, and say what is new
// SPOKEN_RELEASE_MS after the sheet has closed, so a few frames pass between <main> being exposed again and
// the change (a browser builds its accessibility tree once per frame).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayScreen, SPOKEN_RELEASE_MS } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const TIME_UP = "Time is up. This card doesn't count.";
let h: Harness;

async function startTimed() {
  h = harness(pendingFor("timed"));
  render(<PlayScreen services={h.services} />);
  await screen.findByRole("button", { name: "True" });
  await act(async () => {});
  h.advance(1000);
}

function main(): HTMLElement {
  const element = document.querySelector("main");
  if (!element) throw new Error("no main");
  return element;
}

function status(): string | null | undefined {
  return main().querySelector('[role="status"]')?.textContent;
}

function announcer(): string | null | undefined {
  return main().querySelector("[data-card-announcer]")?.textContent;
}

// The round's close button, not the sheet's own "Leave round" (which may still be on its way out).
function closeButton(): HTMLElement {
  const button = main().querySelector<HTMLElement>('button[aria-label="Leave round"]');
  if (!button) throw new Error("no close button");
  return button;
}

function answerRight() {
  const statement = document.querySelector("[data-statement] p:last-of-type")?.textContent;
  fireEvent.click(screen.getByRole("button", { name: cardByStatement(statement).answer ? "True" : "False" }));
}

describe("time up while the leave sheet is open", () => {
  it("is said once the sheet has closed, after <main> has stopped being inert", async () => {
    await startTimed();
    answerRight();
    act(() => h.run(700)); // the stamp holds, then card 2 is dealt
    await screen.findByRole("button", { name: "True" });
    const before = { status: status(), card: announcer() };
    expect(before.card).toMatch(/^Card 2\. /);

    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    act(() => h.run(60_000));
    expect(screen.getByRole("button", { name: "See results", hidden: true })).toBeTruthy();
    // Under the sheet nothing changes in the regions nobody can hear.
    expect(main().hasAttribute("inert")).toBe(true);
    expect({ status: status(), card: announcer() }).toEqual(before);

    // The order of the changes: <main> stops being inert first, and the status says time is up only
    // SPOKEN_RELEASE_MS later, not in the same frame.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
    expect(main().hasAttribute("inert")).toBe(false);
    expect({ status: status(), card: announcer() }).toEqual(before);
    act(() => vi.advanceTimersByTime(SPOKEN_RELEASE_MS - 1));
    expect({ status: status(), card: announcer() }).toEqual(before);
    act(() => vi.advanceTimersByTime(1));
    expect(status()).toBe(TIME_UP);
    expect(announcer()).toBe("");
  });

  it("keeps what was last said when the sheet is opened again before the regions were released", async () => {
    await startTimed();
    answerRight();
    act(() => h.run(700));
    await screen.findByRole("button", { name: "True" });
    const before = { status: status(), card: announcer() };

    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    act(() => h.run(60_000));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" }));
    act(() => vi.advanceTimersByTime(SPOKEN_RELEASE_MS / 2));
    // Opened again in the wait: time up was never said, so it is still held back under the sheet.
    fireEvent.click(closeButton());
    expect(main().hasAttribute("inert")).toBe(true);
    act(() => vi.advanceTimersByTime(SPOKEN_RELEASE_MS * 2));
    expect({ status: status(), card: announcer() }).toEqual(before);

    const sheets = screen.getAllByRole("dialog");
    fireEvent.click(within(sheets[sheets.length - 1] as HTMLElement).getByRole("button", { name: "Keep playing" }));
    act(() => vi.advanceTimersByTime(SPOKEN_RELEASE_MS));
    expect(status()).toBe(TIME_UP);
  });

  it("keeps the verdict said before the sheet opened, and says it again only if it changed", async () => {
    h = harness(pendingFor("classic"));
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    answerRight();
    const verdict = status();
    expect(verdict).toMatch(/^Correct\./);
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(status()).toBe(verdict);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(status()).toBe(verdict);
  });
});
