// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LeaveDialog } from "@/components/play/LeaveDialog";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

function setup(open = true) {
  const onStay = vi.fn();
  const onLeave = vi.fn();
  const view = render(<LeaveDialog open={open} onStay={onStay} onLeave={onLeave} />);
  return { onStay, onLeave, rerender: (next: boolean) => view.rerender(<LeaveDialog open={next} onStay={onStay} onLeave={onLeave} />) };
}

describe("LeaveDialog", () => {
  it("renders nothing while closed", () => {
    setup(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a modal dialog named Leave round? that explains what leaving does", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    const description = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Your answers so far stay in your history. This round won't set a record.");
  });

  it("offers Keep playing first and gives it focus", () => {
    setup();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Keep playing", "Leave round"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep playing" }));
  });

  it("calls onLeave from Leave round and onStay from Keep playing", () => {
    const { onStay, onLeave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("keeps playing on Escape and on a tap outside the sheet", () => {
    let time = 0;
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(<LeaveDialog open onStay={onStay} onLeave={onLeave} now={() => time} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Keep playing" }), { key: "Escape" });
    const scrim = document.querySelector("[data-scrim]");
    if (!scrim) throw new Error("no scrim");
    time = 250; // the scrim takes taps once the sheet has settled (review finding U64)
    fireEvent.click(scrim);
    expect(onStay).toHaveBeenCalledTimes(2);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("keeps Tab and Shift+Tab inside the dialog", () => {
    setup();
    const stay = screen.getByRole("button", { name: "Keep playing" });
    const leave = screen.getByRole("button", { name: "Leave round" });
    leave.focus();
    fireEvent.keyDown(leave, { key: "Tab" });
    expect(document.activeElement).toBe(stay);
    fireEvent.keyDown(stay, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(leave);
  });

  it("goes away when it is closed", async () => {
    const { rerender } = setup();
    rerender(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
