// @vitest-environment jsdom
// The "Leave round?" sheet: Escape from wherever focus has gone (review finding U23) and the scrim's settle
// time against the second tap of a double tap on the close button (review finding U64).
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LeaveDialog } from "@/components/play/LeaveDialog";
import { SWIPE } from "@/src/input/swipe";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

function open(now: () => number = () => 0) {
  const onStay = vi.fn();
  const onLeave = vi.fn();
  const view = render(<LeaveDialog open onStay={onStay} onLeave={onLeave} now={now} />);
  return { onStay, onLeave, view };
}

function scrim(): Element {
  const element = document.querySelector("[data-scrim]");
  if (!element) throw new Error("no scrim");
  return element;
}

describe("LeaveDialog: Escape after a tap on the sheet's text (U23)", () => {
  it("keeps playing on Escape when focus has fallen to the body", () => {
    const { onStay } = open();
    // A tap on the title or the text moves focus to the body, outside the sheet.
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("brings Tab and Shift+Tab back into the sheet from the body", () => {
    open();
    const stay = screen.getByRole("button", { name: "Keep playing" });
    const leave = screen.getByRole("button", { name: "Leave round" });
    act(() => stay.blur());
    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(document.activeElement).toBe(stay);
    act(() => stay.blur());
    fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(leave);
  });

  it("stops listening once it has closed", async () => {
    const { onStay, view } = open();
    view.rerender(<LeaveDialog open={false} onStay={onStay} onLeave={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onStay).not.toHaveBeenCalled();
  });
});

describe("LeaveDialog: the scrim's settle time (U64)", () => {
  it("does not keep playing on a scrim tap right after the sheet opened, but does once it has settled", () => {
    let time = 5_000;
    const { onStay } = open(() => time);
    time += 80; // the second tap of a double tap on the close button, where the scrim now lies
    fireEvent.click(scrim());
    time += SWIPE.settleMs - 81;
    fireEvent.click(scrim());
    expect(onStay).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Leave round?" })).toBeTruthy();
    time += 1;
    fireEvent.click(scrim());
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("takes Keep playing and Escape at once: only the scrim waits", () => {
    const { onStay } = open(() => 0);
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(onStay).toHaveBeenCalledTimes(2);
  });
});
