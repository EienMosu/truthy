import { describe, expect, it } from "vitest";
import { SWIPE, canStart, intent, type SwipeContext } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };

describe("swipe constants", () => {
  it("match the values in the spec's input table", () => {
    expect(SWIPE).toEqual({ commitPx: 90, flingPx: 40, flingVelocity: 0.5, settleMs: 250, edgePx: 24 });
  });
});

describe("intent (drag preview)", () => {
  it("is zero when the card has not moved", () => {
    expect(intent(0)).toBe(0);
  });

  it("is proportional to dx inside 110 px", () => {
    expect(intent(55)).toBe(0.5);
    expect(intent(-55)).toBe(-0.5);
  });

  it("reaches exactly 1 and -1 at 110 px", () => {
    expect(intent(110)).toBe(1);
    expect(intent(-110)).toBe(-1);
  });

  it("clamps beyond 110 px at both ends", () => {
    expect(intent(500)).toBe(1);
    expect(intent(-500)).toBe(-1);
  });
});

describe("canStart: settle time", () => {
  const at = (t: number) => ({ x: 195, y: 400, t });

  it("ignores a touch 249 ms after the card appeared", () => {
    expect(canStart(at(249), context)).toBe(false);
  });

  it("accepts a touch exactly 250 ms after the card appeared", () => {
    expect(canStart(at(250), context)).toBe(true);
  });

  it("measures from cardShownAt, not from zero", () => {
    const later: SwipeContext = { viewportWidth: 390, cardShownAt: 10_000 };
    expect(canStart(at(10_100), later)).toBe(false);
    expect(canStart(at(10_250), later)).toBe(true);
  });
});

describe("canStart: edges", () => {
  const atX = (x: number) => ({ x, y: 400, t: 1000 });

  it("ignores a touch at x 23 (inside the left edge zone)", () => {
    expect(canStart(atX(23), context)).toBe(false);
  });

  it("accepts a touch at x 24", () => {
    expect(canStart(atX(24), context)).toBe(true);
  });

  it("ignores a touch at viewportWidth minus 23 (inside the right edge zone)", () => {
    expect(canStart(atX(390 - 23), context)).toBe(false);
  });

  it("accepts a touch at viewportWidth minus 24", () => {
    expect(canStart(atX(390 - 24), context)).toBe(true);
  });

  it("ignores a touch at x 0", () => {
    expect(canStart(atX(0), context)).toBe(false);
  });
});
