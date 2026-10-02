// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ICON_PATHS } from "@/components/icons";
import { LivesPath, livesLabel, trailLayout } from "@/components/LivesPath";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motionPreference.reduced,
}));

afterEach(() => {
  cleanup();
  motionPreference.reduced = false;
});

describe("trailLayout", () => {
  it("keeps 9 px between marks and the newest at x 219, up to 14 marks", () => {
    const layout = trailLayout(14);
    expect([layout.x(0), layout.x(1), layout.x(13)]).toEqual([102, 111, 219]);
    expect(layout).toMatchObject({ r: 2.6, side: 9, cross: true });
    expect(trailLayout(1).x(0)).toBe(219);
    expect(trailLayout(3).x(0)).toBe(201);
  });

  it("squeezes more marks between x 100 and x 219", () => {
    const layout = trailLayout(20);
    expect([layout.x(0), layout.x(1), layout.x(19)]).toEqual([100, 106.3, 219]);
    expect(layout).toMatchObject({ r: 2.2, side: 8, cross: true });
  });

  it("keeps a wrong mark a square with its x however long the round, so it is never told by colour alone", () => {
    expect(trailLayout(60)).toMatchObject({ r: 0.9, side: 6, cross: true });
    for (let marks = 15; marks <= 200; marks++) {
      const layout = trailLayout(marks);
      expect(layout.cross, `${marks} marks`).toBe(true);
      expect(layout.side, `${marks} marks`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("livesLabel", () => {
  const round = (wrongAt: number[], n: number) => Array.from({ length: n }, (_, i) => !wrongAt.includes(i + 1));
  it.each([
    [[], 0, "3 of 3 lives left. No cards answered yet."],
    [[], 1, "3 of 3 lives left. 1 card answered."],
    [[], 5, "3 of 3 lives left. 5 cards answered."],
    [[6], 14, "2 of 3 lives left. 14 cards answered, card 6 was wrong."],
    [[6, 15], 20, "1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong."],
    [[6, 15, 21], 21, "No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong."],
  ])("wrong on %j of %i", (wrongAt, n, text) => {
    expect(livesLabel(round(wrongAt, n))).toBe(text);
  });
});

const results = (wrongAt: number[], n: number) => Array.from({ length: n }, (_, i) => !wrongAt.includes(i + 1));
const hearts = (container: HTMLElement) => [...container.querySelectorAll("[data-heart]")].map((heart) => heart.getAttribute("data-heart"));

describe("LivesPath", () => {
  it("shows three full hearts, the plane and no trail on the first card", () => {
    const { container } = render(<LivesPath results={[]} answered={false} />);
    expect(container.querySelectorAll('[data-heart="full"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-heart="lost"]')).toHaveLength(0);
    expect(container.querySelectorAll("[data-trail]")).toHaveLength(0);
    expect(container.querySelector("[data-plane]")?.getAttribute("class")).not.toContain("opacity-0");
    expect(container.querySelector("[data-progress]")?.textContent).toBe("3 of 3 lives left");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("0 answered");
    expect(screen.getByRole("img", { name: "3 of 3 lives left. No cards answered yet." })).toBeTruthy();
  });

  it("loses the hearts from the right", () => {
    const one = render(<LivesPath results={results([2], 3)} answered={false} />);
    expect(hearts(one.container)).toEqual(["full", "full", "lost"]);
    one.unmount();
    const two = render(<LivesPath results={results([2, 3], 3)} answered={false} />);
    expect(hearts(two.container)).toEqual(["full", "lost", "lost"]);
  });

  it("tells a lost life by shape: an outline and a slash", () => {
    const { container } = render(<LivesPath results={results([1], 1)} answered={false} />);
    const lost = container.querySelector('[data-heart="lost"]');
    const paths = lost?.querySelectorAll("path") ?? [];
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute("fill")).toBe("none");
    expect(paths[0]?.getAttribute("d")).toBe(ICON_PATHS.heart);
    expect(paths[1]?.getAttribute("d")).toBe(ICON_PATHS.heartSlash);
    expect(container.querySelector('[data-heart="full"] path')?.getAttribute("d")).toBe(ICON_PATHS.heart);
  });

  it("marks every answered card on the trail and tells wrong from right by shape", () => {
    const { container } = render(<LivesPath results={results([6], 14)} answered={false} />);
    expect(container.querySelectorAll('[data-trail="correct"]')).toHaveLength(13);
    const wrong = container.querySelectorAll('[data-trail="wrong"]');
    expect(wrong).toHaveLength(1);
    expect([...container.querySelectorAll('[data-trail="correct"]')].every((mark) => mark.tagName === "circle")).toBe(true);
    expect(wrong[0]?.querySelector("rect")).toBeTruthy();
    expect(wrong[0]?.querySelector("path")).toBeTruthy();
    expect(container.querySelector("[data-tally]")?.textContent).toBe("14 answered");
    expect(container.querySelector("[data-progress]")?.textContent).toBe("2 of 3 lives left");
  });

  it.each([60, 119])("in a round of %i marks draws each wrong card as a square with its x, on top of the dots", (n) => {
    const { container } = render(<LivesPath results={results([30, n - 1], n)} answered={false} />);
    const wrong = [...container.querySelectorAll('[data-trail="wrong"]')];
    expect(wrong).toHaveLength(2);
    for (const mark of wrong) {
      const rect = mark.querySelector("rect");
      const width = Number(rect?.getAttribute("width"));
      expect(width).toBeGreaterThanOrEqual(6);
      // A corner radius of half the side would draw the square as a circle.
      expect(Number(rect?.getAttribute("rx"))).toBeLessThanOrEqual(width * 0.25);
      expect(mark.querySelector("path")).toBeTruthy();
    }
    // The dots of the neighbouring cards must not cover the x: the wrong marks come after every dot.
    const trail = [...container.querySelectorAll("[data-trail]")].map((mark) => mark.getAttribute("data-trail"));
    expect(trail.slice(-2)).toEqual(["wrong", "wrong"]);
  });

  it("after an answer shows its mark where the plane was and counts it", () => {
    const { container } = render(<LivesPath results={results([], 15)} answered />);
    expect(container.querySelectorAll("[data-trail]")).toHaveLength(14);
    expect(container.querySelector("[data-plane]")?.getAttribute("class")).toContain("opacity-0");
    expect(container.querySelectorAll("[data-waypoint]")).toHaveLength(1);
    expect(container.querySelector("[data-waypoint]")?.getAttribute("data-waypoint")).toBe("correct");
    expect(container.querySelector("[data-tally]")?.textContent).toBe("15 answered");
  });

  it("reads No lives left after the third wrong answer", () => {
    const { container } = render(<LivesPath results={results([6, 15, 21], 21)} answered />);
    expect(container.querySelector("[data-progress]")?.textContent).toBe("No lives left");
    expect(hearts(container)).toEqual(["lost", "lost", "lost"]);
    expect(
      screen.getByRole("img", { name: "No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong." }),
    ).toBeTruthy();
  });

  it("draws the slash of the life just lost and leaves the earlier ones at rest", () => {
    const { container, rerender } = render(<LivesPath results={[false, true, false]} answered />);
    expect(hearts(container)).toEqual(["full", "lost", "lost"]);
    const [, middle, right] = [...container.querySelectorAll("[data-heart]")];
    expect(middle?.querySelector('[data-strike="draw"]')).toBeTruthy();
    expect(right?.querySelector('[data-strike="rest"]')).toBeTruthy();
    expect(right?.querySelector('[data-strike="draw"]')).toBeNull();
    rerender(<LivesPath results={[false, true, false]} answered={false} />);
    expect(container.querySelectorAll('[data-strike="draw"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-strike="rest"]')).toHaveLength(2);
  });

  it("draws the slash of the third life as well", () => {
    const { container } = render(<LivesPath results={[false, false, false]} answered />);
    expect(container.querySelectorAll('[data-strike="draw"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-strike="rest"]')).toHaveLength(2);
    expect(container.querySelector('[data-heart]')?.querySelector('[data-strike="draw"]')).toBeTruthy();
  });

  it("with reduced motion every slash is at rest", () => {
    motionPreference.reduced = true;
    const { container } = render(<LivesPath results={[false, true, false]} answered />);
    expect(container.querySelectorAll('[data-strike="draw"]')).toHaveLength(0);
    const rest = [...container.querySelectorAll('[data-strike="rest"]')];
    expect(rest).toHaveLength(2);
    for (const slash of rest) {
      expect(slash.tagName).toBe("path");
      expect(slash.getAttribute("d")).toBe(ICON_PATHS.heartSlash);
    }
  });
});
