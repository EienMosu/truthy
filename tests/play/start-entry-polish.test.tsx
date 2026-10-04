// @vitest-environment jsdom
// Review finding U26: whether the start flow's first entry is right behind /play lived only in module state,
// which a reload of /play loses; leaving by a control then put a second start entry in the history. /play
// now writes the mark into its own history entry, which a reload keeps.
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type ServicesModule = typeof import("@/src/app-state/services");

/** The module as a fresh page (or a reload) sees it: nothing marked in memory. */
async function freshPage(): Promise<ServicesModule> {
  vi.resetModules();
  return import("@/src/app-state/services");
}

beforeEach(() => {
  // The entry as the router leaves it, with its own keys.
  window.history.replaceState({ __NA: true }, "");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the mark on the /play entry", () => {
  it("survives a reload, so leaving still goes back to the start's entry", async () => {
    const before = await freshPage();
    before.markStartEntryBehind(true);
    before.markPlayEntry();
    expect(window.history.state).toMatchObject({ __NA: true });

    const reloaded = await freshPage();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    expect(reloaded.browserBackToStart()).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("is not written when the start's entry is not behind /play", async () => {
    const before = await freshPage();
    before.markStartEntryBehind(false);
    before.markPlayEntry();
    expect(window.history.state).toEqual({ __NA: true });

    const reloaded = await freshPage();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    expect(reloaded.browserBackToStart()).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it("is written by the play screen as it opens, once", () => {
    const setup = harness();
    const markPlayEntry = vi.fn();
    setup.services = { ...setup.services, markPlayEntry };
    const view = render(<PlayScreen services={setup.services} />);
    expect(markPlayEntry).toHaveBeenCalledTimes(1);
    view.rerender(<PlayScreen services={setup.services} />);
    expect(markPlayEntry).toHaveBeenCalledTimes(1);
  });
});
