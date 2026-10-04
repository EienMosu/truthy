// @vitest-environment jsdom
// Review finding U25: the Timed clock keeps running while the "Leave round?" sheet is open, and <main> is
// inert then, so its live regions are not exposed. Time running out under the sheet changed the status there
// and was never heard. The live regions now keep what they said when the sheet opened, and say what is new
// once the sheet has closed and <main> can be heard again.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { cardByStatement, harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

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

    // The order of the changes: <main> stops being inert first, then the status says time is up.
    const changes: string[] = [];
    const note = (records: MutationRecord[]) => {
      for (const record of records) changes.push(record.type === "attributes" ? "inert" : "status");
    };
    const observer = new MutationObserver(note);
    observer.observe(main(), { attributes: true, attributeFilter: ["inert"] });
    const region = main().querySelector('[role="status"]');
    if (!region) throw new Error("no status");
    observer.observe(region, { childList: true, characterData: true, subtree: true });

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep playing" }));
    await waitFor(() => expect(status()).toBe(TIME_UP));
    note(observer.takeRecords());
    observer.disconnect();
    expect(changes[0]).toBe("inert");
    expect(changes.slice(1)).toContain("status");
    expect(announcer()).toBe("");
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
