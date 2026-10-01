// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimedPath, clockText, timedLabel } from "@/components/TimedPath";

afterEach(cleanup);

describe("clockText", () => {
  it.each([
    [60_000, "1:00"],
    [59_999, "1:00"],
    [59_000, "0:59"],
    [40_001, "0:41"],
    [41_000, "0:41"],
    [1, "0:01"],
    [0, "0:00"],
  ])("%i ms reads %s", (ms, text) => {
    expect(clockText(ms)).toBe(text);
  });
});

describe("timedLabel", () => {
  it.each([
    [41_000, 9, 2, "41 seconds left of 60. 9 correct, 2 wrong."],
    [60_000, 0, 0, "60 seconds left of 60. 0 correct, 0 wrong."],
    [900, 3, 0, "1 second left of 60. 3 correct, 0 wrong."],
    [0, 14, 3, "No time left. 17 cards answered: 14 correct, 3 wrong."],
    [0, 1, 0, "No time left. 1 card answered: 1 correct, 0 wrong."],
  ])("%i ms, %i correct, %i wrong", (ms, correct, wrong, text) => {
    expect(timedLabel(ms, correct, wrong)).toBe(text);
  });
});

describe("TimedPath", () => {
  it("is one image named by timedLabel", () => {
    render(<TimedPath remainingMs={41_000} correct={9} wrong={2} />);
    expect(screen.getByRole("img", { name: "41 seconds left of 60. 9 correct, 2 wrong." })).toBeTruthy();
  });

  it("puts the plane where the time is: at the start with 60 s, on the destination at zero", () => {
    const start = render(<TimedPath remainingMs={60_000} correct={0} wrong={0} />);
    expect(start.container.querySelector("[data-plane]")?.getAttribute("transform")).toMatch(/^translate\(6 24\)/);
    cleanup();
    const end = render(<TimedPath remainingMs={0} correct={14} wrong={3} />);
    expect(end.container.querySelector("[data-plane]")?.getAttribute("transform")).toMatch(/^translate\(270 24\)/);
    expect(end.container.querySelector("[data-plane]")?.getAttribute("class")).not.toContain("opacity-0");
  });

  it("fills the quarter marks as they are passed", () => {
    const states = (container: HTMLElement) => [...container.querySelectorAll("[data-quarter]")].map((mark) => mark.getAttribute("data-quarter"));
    const mid = render(<TimedPath remainingMs={41_000} correct={9} wrong={2} />);
    expect(states(mid.container)).toEqual(["passed", "ahead", "ahead"]);
    const marks = [...mid.container.querySelectorAll("[data-quarter]")];
    expect(marks.map((mark) => [mark.getAttribute("cx"), mark.getAttribute("cy"), mark.getAttribute("r")])).toEqual([
      ["72", "12.75", "3.5"],
      ["138", "9", "3.5"],
      ["204", "12.75", "3.5"],
    ]);
    expect(marks[0]?.getAttribute("class")).toContain("fill-(--color-ink)");
    expect(marks[1]?.getAttribute("class")).toContain("fill-(--color-surface-raised)");
    cleanup();
    const end = render(<TimedPath remainingMs={0} correct={14} wrong={3} />);
    expect(states(end.container)).toEqual(["passed", "passed", "passed"]);
  });

  it("shows the clock and the tally", () => {
    const { container } = render(<TimedPath remainingMs={41_000} correct={9} wrong={2} />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("0:41 left");
    expect(container.querySelector("[data-progress] b")?.className).toContain("tabular-nums");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("9 correct · 2 wrong");
  });

  it("has no flown line at the start", () => {
    const start = render(<TimedPath remainingMs={60_000} correct={0} wrong={0} />);
    expect(start.container.querySelectorAll('path[stroke-width="2.4"]')).toHaveLength(0);
    cleanup();
    const later = render(<TimedPath remainingMs={30_000} correct={0} wrong={0} />);
    expect(later.container.querySelectorAll('path[stroke-width="2.4"]')).toHaveLength(1);
  });
});
