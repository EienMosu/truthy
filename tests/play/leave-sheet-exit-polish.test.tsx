// @vitest-environment jsdom
// The "Leave round?" sheet hears Escape and Tab on the document (review finding U23). After Keep playing it
// stays in the page for its exit animation, and for that time it must leave the keys to the round screen:
// Tab from the close button stays with the browser, and Escape reaches the round, which asks again.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LeaveDialog } from "@/components/play/LeaveDialog";

beforeAll(() => {
  // The exit animation is what keeps the sheet in the page, so this file plays it.
  MotionGlobalConfig.skipAnimations = false;
});
afterEach(cleanup);

/** The round screen in small: its close button, its own Escape on the window, and the sheet. */
function Round({ onEscape }: { onEscape: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" aria-label="Close" onClick={() => setOpen(true)} />
      <LeaveDialog
        open={open}
        onStay={() => {
          setOpen(false);
          (document.querySelector('[aria-label="Close"]') as HTMLElement | null)?.focus();
        }}
        onLeave={vi.fn()}
      />
      <Escape onEscape={onEscape} />
    </>
  );
}

function Escape({ onEscape }: { onEscape: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
  return null;
}

describe("LeaveDialog while it leaves", () => {
  it("leaves Tab and Escape to the round screen once Keep playing has closed it", async () => {
    const onEscape = vi.fn();
    render(<Round onEscape={onEscape} />);
    const close = screen.getByRole("button", { name: "Close" });
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(document.activeElement).toBe(close);
    // The sheet is still in the page, on its way out.
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    const tab = fireEvent.keyDown(close, { key: "Tab" });
    expect(tab).toBe(true); // not cancelled: the browser moves focus as it would without the sheet
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {});
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull(), { timeout: 2_000 });
  });
});
