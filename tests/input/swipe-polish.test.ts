import { describe, expect, it } from "vitest";
import { interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0. Gestures start mid-screen, well after the settle time.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };
const START = { x: 195, y: 400, t: 1000 };

function gesture(...offsets: [number, number, number][]): SwipeSample[] {
  return offsets.map(([dx, dy, dt]) => ({ x: START.x + dx, y: START.y + dy, t: START.t + dt }));
}

// Review finding U110: the 80 ms window and the choice of its oldest sample were not pinned.
describe("interpret: the fling velocity window", () => {
  it("does not count a reference sample 81 ms before the release, even when it would make a fling", () => {
    // 45 px in 81 ms is 0.56 px/ms, a fling if the window were any wider than 80 ms.
    expect(interpret(gesture([0, 0, 0], [5, 0, 400], [50, 0, 481]), context)).toBe("cancel");
  });

  it("counts a reference sample exactly 80 ms before the release", () => {
    expect(interpret(gesture([0, 0, 0], [5, 0, 401], [50, 0, 481]), context)).toBe("true");
  });

  it("takes the oldest sample inside the window, so a fast stretch followed by a pause still flings", () => {
    // Oldest in the window: 40 px in 70 ms is 0.57 px/ms. The newest one, 2 px in 10 ms, would read 0.2.
    expect(interpret(gesture([0, 0, 0], [10, 0, 400], [48, 0, 460], [50, 0, 470]), context)).toBe("true");
  });

  it("takes the oldest sample inside the window, so a slow drag that ends in a one-frame jerk does not fling", () => {
    // Oldest in the window: 20 px in 70 ms is 0.29 px/ms. The newest one, 20 px in 10 ms, would read 2.
    expect(interpret(gesture([0, 0, 0], [30, 0, 400], [30, 0, 460], [50, 0, 470]), context)).toBe("cancel");
  });
});
