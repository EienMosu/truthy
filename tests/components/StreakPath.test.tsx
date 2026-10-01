// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { pointAt } from "@/components/FlightPath";
import { StreakPath, streakLabel, streakLayout } from "@/components/StreakPath";

afterEach(cleanup);

describe("streakLayout", () => {
  it("spaces the slots 24 px apart and ends on the ring when the best is 12", () => {
    const layout = streakLayout(8, 12);
    expect([0, 1, 8, 11].map((slot) => pointAt(layout.t(slot)).x)).toEqual([6, 30, 198, 270]);
    expect(layout).toMatchObject({ dot: 6, ticks: true, ring: 11, target: true, future: [9, 10] });
  });

  it("ends on the ring for any best: three slots for a best of 3", () => {
    const layout = streakLayout(1, 3);
    expect([0, 1, 2].map((slot) => layout.t(slot))).toEqual([0, 0.5, 1]);
    expect(layout).toMatchObject({ ring: 2, target: true, future: [] });
  });

  it("keeps the plane on the ring slot while the next right answer would equal the best", () => {
    expect(streakLayout(11, 12)).toMatchObject({ target: true, future: [] });
    expect(streakLayout(11, 12).t(11)).toBe(1);
  });

  it("runs on into open sky at and past the best", () => {
    const layout = streakLayout(12, 12);
    expect(layout).toMatchObject({ ring: 11, target: false, future: [], dot: 6 });
    expect(layout.t(12)).toBeCloseTo(12 / 13.6, 5);
  });

  it("has no ring without a best", () => {
    expect(streakLayout(0, null)).toMatchObject({ ring: null, target: false, future: [], dot: 6 });
    expect(streakLayout(0, null).t(0)).toBe(0);
  });

  it("shrinks the dots of a long streak and drops their ticks", () => {
    expect(streakLayout(40, 12)).toMatchObject({ dot: 2, ticks: false });
    expect(streakLayout(13, 40)).toMatchObject({ dot: 2.1, ticks: false, target: true });
  });

  it("puts a best of 1 on the first slot", () => {
    expect(streakLayout(0, 1)).toMatchObject({ ring: 0, target: true, future: [] });
    expect(streakLayout(0, 1).t(0)).toBe(0);
  });
});

describe("streakLabel", () => {
  it.each([
    [8, 12, false, "Streak of 8 correct answers. Your best on this route is 12."],
    [12, 12, false, "Streak of 12 correct answers, equal to your best on this route."],
    [13, 12, false, "Streak of 13 correct answers. New best on this route, previous best 12."],
    [1, null, false, "Streak of 1 correct answer."],
    [0, null, false, "Streak of 0 correct answers."],
    [8, 12, true, "Streak ended at 8. Your best on this route is 12."],
    [12, 12, true, "Streak ended at 12, equal to your best on this route."],
    [13, 12, true, "Streak ended at 13. New best on this route, previous best 12."],
    [3, null, true, "Streak ended at 3."],
    [0, 0, false, "Streak of 0 correct answers."],
    [1, 0, false, "Streak of 1 correct answer."],
    [0, 0, true, "Streak ended at 0."],
  ])("streak %s, best %s, ended %s", (streak, best, ended, text) => {
    expect(streakLabel(streak, best, ended)).toBe(text);
  });
});

describe("StreakPath", () => {
  it("is one image named by streakLabel, with Streak and Best in the label row", () => {
    const { container } = render(<StreakPath streak={8} best={12} answered={null} />);
    expect(screen.getByRole("img", { name: "Streak of 8 correct answers. Your best on this route is 12." })).toBeTruthy();
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Streak 8");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("Best 12");
    expect(container.querySelectorAll("[data-streak-dot]")).toHaveLength(8);
    expect(container.querySelectorAll('[data-ring="target"]')).toHaveLength(1);
    expect(container.querySelector("[data-plane]")?.getAttribute("class")).not.toContain("opacity-0");
  });

  it("after a right answer shows the mark of that card, hides the plane and counts it", () => {
    const { container } = render(<StreakPath streak={9} best={12} answered="correct" />);
    expect(container.querySelectorAll("[data-streak-dot]")).toHaveLength(8);
    const fresh = container.querySelectorAll("[data-waypoint][data-fresh]");
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.getAttribute("data-waypoint")).toBe("correct");
    expect(fresh[0]?.querySelector("circle")?.getAttribute("class")).toContain("fill-(--color-correct)");
    expect(container.querySelector("[data-plane]")?.getAttribute("class")).toContain("opacity-0");
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Streak 9");
  });

  it("after the wrong answer reads Streak ended at", () => {
    const { container } = render(<StreakPath streak={8} best={12} answered="wrong" />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("Streak ended at 8");
    const wrong = container.querySelectorAll('[data-waypoint="wrong"]');
    expect(wrong).toHaveLength(1);
    expect(wrong[0]?.hasAttribute("data-fresh")).toBe(true);
    expect(container.querySelector("[data-tally]")?.textContent).toBe("Best 12");
  });

  it("past the best reads Previous best and keeps the ring where the best was reached", () => {
    const { container } = render(<StreakPath streak={13} best={12} answered="correct" />);
    expect(container.querySelector("[data-tally]")?.textContent).toBe("Previous best 12");
    expect(container.querySelectorAll('[data-ring="reached"]')).toHaveLength(1);
    expect(container.querySelector('[data-ring="target"]')).toBeNull();
  });

  it("rings the mark itself when the right answer equals the best", () => {
    const { container } = render(<StreakPath streak={12} best={12} answered="correct" />);
    const ring = container.querySelector('[data-ring="reached"]');
    expect(ring?.getAttribute("r")).toBe("10.5");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("Best 12");
  });

  it("draws no ring and no right label on a first round", () => {
    const { container } = render(<StreakPath streak={3} best={null} answered={null} />);
    expect(container.querySelector("[data-ring]")).toBeNull();
    expect(container.querySelector("[data-tally]")).toBeNull();
  });

  it("treats a best of 0 like no best", () => {
    const { container } = render(<StreakPath streak={2} best={0} answered={null} />);
    expect(container.querySelector("[data-ring]")).toBeNull();
    expect(container.querySelector("[data-tally]")).toBeNull();
    expect(screen.getByRole("img", { name: "Streak of 2 correct answers." })).toBeTruthy();
  });
});
