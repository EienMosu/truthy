import { describe, expect, it } from "vitest";
import { SWIPE, canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";

// A phone-sized viewport whose card appeared at t = 0.
const context: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };

// Gestures start in the middle of the screen, 1000 ms after the card appeared.
const START = { x: 195, y: 400, t: 1000 };

// Builds samples from offsets relative to START, each one [dx, dy, dt].
function gesture(...offsets: [number, number, number][]): SwipeSample[] {
  return offsets.map(([dx, dy, dt]) => ({ x: START.x + dx, y: START.y + dy, t: START.t + dt }));
}

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

describe("interpret: too little input", () => {
  it("cancels with no samples", () => {
    expect(interpret([], context)).toBe("cancel");
  });

  it("cancels with a single sample", () => {
    expect(interpret(gesture([0, 0, 0]), context)).toBe("cancel");
  });

  it("cancels when the card did not move", () => {
    expect(interpret(gesture([0, 0, 0], [0, 0, 500]), context)).toBe("cancel");
  });
});

describe("interpret: commit (released at least 90 px from its start)", () => {
  // Slow drags: 300 ms per step, far below fling speed, so only distance decides.
  it("commits at exactly 90 px", () => {
    expect(interpret(gesture([0, 0, 0], [45, 0, 300], [90, 0, 600]), context)).toBe("true");
  });

  it("cancels at 89 px", () => {
    expect(interpret(gesture([0, 0, 0], [45, 0, 300], [89, 0, 600]), context)).toBe("cancel");
  });

  it("commits at exactly 90 px to the left", () => {
    expect(interpret(gesture([0, 0, 0], [-45, 0, 300], [-90, 0, 600]), context)).toBe("false");
  });

  it("cancels when dragged past 90 px and back inside before release", () => {
    expect(interpret(gesture([0, 0, 0], [150, 0, 300], [60, 0, 900]), context)).toBe("cancel");
  });

  it("cancels when dragged past 90 px and released exactly at the start", () => {
    expect(interpret(gesture([0, 0, 0], [150, 0, 300], [0, 0, 900]), context)).toBe("cancel");
  });
});

describe("interpret: direction (right is True, left is False)", () => {
  it("a release 120 px to the right is true", () => {
    expect(interpret(gesture([0, 0, 0], [120, 5, 600]), context)).toBe("true");
  });

  it("a release 120 px to the left is false", () => {
    expect(interpret(gesture([0, 0, 0], [-120, 5, 600]), context)).toBe("false");
  });

  it("the side at release wins, not the side first visited", () => {
    expect(interpret(gesture([0, 0, 0], [120, 0, 300], [-100, 0, 900]), context)).toBe("false");
  });
});

describe("interpret: a gesture more vertical than horizontal is not a swipe", () => {
  it("cancels a mostly vertical gesture even when it ends 100 px to the side", () => {
    expect(interpret(gesture([0, 0, 0], [50, 150, 300], [100, 300, 600]), context)).toBe("cancel");
  });

  it("cancels a mostly vertical gesture upwards", () => {
    expect(interpret(gesture([0, 0, 0], [-100, -101, 600]), context)).toBe("cancel");
  });

  it("commits an exactly diagonal gesture (vertical travel does not exceed horizontal)", () => {
    expect(interpret(gesture([0, 0, 0], [100, 100, 600]), context)).toBe("true");
  });

  it("commits a horizontal swipe with some vertical drift", () => {
    expect(interpret(gesture([0, 0, 0], [60, 20, 300], [120, 40, 600]), context)).toBe("true");
  });
});
