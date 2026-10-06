// @vitest-environment jsdom
// The Timed clock keeps running under the "Leave round?" sheet. When the minute runs out there, the sheet's text
// changes from "won't count toward your best" to "its score is kept", but a screen reader read that text (through
// aria-describedby) when the sheet opened and is never told: the player chooses Leave round believing nothing is
// recorded, and the round is recorded. A polite status inside the dialog now says the new text.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LeaveDialog } from "@/components/play/LeaveDialog";
import { PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

const OPEN_TEXT = "Your answers so far stay in your history. This round won't count toward your best.";
const DECIDED_TEXT = "This round is over and its score is kept. Leaving skips its result.";

function sheetStatus(dialog: HTMLElement): HTMLElement {
  const status = within(dialog).getByRole("status");
  expect(status.getAttribute("aria-live") ?? "polite").toBe("polite");
  return status;
}

function description(dialog: HTMLElement): string | null | undefined {
  const id = dialog.getAttribute("aria-describedby");
  return id ? document.getElementById(id)?.textContent : undefined;
}

describe("the leave sheet when the Timed minute runs out under it", () => {
  it("says the new text through a polite status inside the dialog", async () => {
    const h: Harness = harness(pendingFor("timed"));
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    // One answer, so the round has something to leave and the close button asks first.
    const statement = document.querySelector("[data-statement] p:last-of-type")?.textContent;
    fireEvent.click(screen.getByRole("button", { name: cardByStatement(statement).answer ? "True" : "False" }));
    act(() => h.run(700)); // the stamp holds, then card 2 is dealt
    await screen.findByRole("button", { name: "True" });

    fireEvent.click(screen.getByRole("button", { name: "Leave round" }));
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    expect(description(dialog)).toBe(OPEN_TEXT);
    // In the page, and empty, before the change: a live region added with its text is not announced.
    expect(sheetStatus(dialog).textContent).toBe("");

    act(() => h.run(60_000));
    expect(description(dialog)).toBe(DECIDED_TEXT);
    expect(sheetStatus(dialog).textContent).toBe(DECIDED_TEXT);
  });

  it("says nothing more when the sheet opens on a round that is already decided", () => {
    render(<LeaveDialog open decided onStay={vi.fn()} onLeave={vi.fn()} now={() => 0} />);
    const dialog = screen.getByRole("dialog", { name: "Leave round?" });
    expect(description(dialog)).toBe(DECIDED_TEXT);
    expect(sheetStatus(dialog).textContent).toBe("");
  });

  it("starts empty again when the sheet is opened anew", async () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    const view = render(<LeaveDialog open onStay={onStay} onLeave={onLeave} now={() => 0} />);
    view.rerender(<LeaveDialog open decided onStay={onStay} onLeave={onLeave} now={() => 0} />);
    expect(sheetStatus(screen.getByRole("dialog")).textContent).toBe(DECIDED_TEXT);
    view.rerender(<LeaveDialog open={false} decided onStay={onStay} onLeave={onLeave} now={() => 0} />);
    await act(async () => {});
    view.rerender(<LeaveDialog open decided onStay={onStay} onLeave={onLeave} now={() => 0} />);
    const dialogs = screen.getAllByRole("dialog");
    expect(sheetStatus(dialogs[dialogs.length - 1] as HTMLElement).textContent).toBe("");
  });
});
