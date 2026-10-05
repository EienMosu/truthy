// @vitest-environment jsdom
// Review finding U68: the round screens had no heading for those who move by headings (axe
// page-has-heading-one). Each state of a round, and the loading screen, now has one level 1 heading.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "@/components/play/PlayScreen";
import { harness, pendingFor, type Harness } from "../components/play/fixtures";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterEach(cleanup);

let h: Harness;

function headingOne(): string | null {
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  return headings[0]?.textContent ?? null;
}

const MODES = [
  ["classic", "Classic"],
  ["streak", "Streak"],
  ["lives", "Three lives"],
  ["timed", "Timed"],
] as const;

describe("the play screen's heading", () => {
  it("is there while the round loads", () => {
    h = harness();
    h.network.hold = true;
    render(<PlayScreen services={h.services} />);
    expect(headingOne()).toBe("Your round");
  });

  it.each(MODES)("names the route and the class on a question and after an answer: %s", async (mode, label) => {
    h = harness(pendingFor(mode));
    render(<PlayScreen services={h.services} />);
    await screen.findByRole("button", { name: "True" });
    await act(async () => {});
    h.advance(1000);
    const name = `AWS Test deck, Security and compliance: ${label} round`;
    expect(headingOne()).toBe(name);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(headingOne()).toBe(name);
    if (mode === "timed") {
      act(() => h.run(61_000));
      expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
      expect(headingOne()).toBe(name);
    }
  });
});
