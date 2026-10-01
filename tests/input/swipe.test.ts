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

describe("interpret: fling (a fast release commits only after at least 40 px)", () => {
  it("commits a fast fling that travelled 40 px", () => {
    // 40 px in 40 ms: 1 px/ms, twice the fling velocity.
    expect(interpret(gesture([0, 0, 0], [20, 0, 20], [40, 0, 40]), context)).toBe("true");
  });

  it("cancels a fast fling that travelled 39 px", () => {
    expect(interpret(gesture([0, 0, 0], [20, 0, 20], [39, 0, 40]), context)).toBe("cancel");
  });

  it("commits a fast fling of 40 px to the left as false", () => {
    expect(interpret(gesture([0, 0, 0], [-20, 0, 20], [-40, 0, 40]), context)).toBe("false");
  });

  it("cancels a slow release at 60 px (pointer moves sampled every 16 ms)", () => {
    // 2 px every 16 ms is 0.125 px/ms, a quarter of the fling velocity.
    const slow = Array.from({ length: 31 }, (_, i): [number, number, number] => [2 * i, 0, 16 * i]);
    expect(slow.at(-1)).toEqual([60, 0, 480]);
    expect(interpret(gesture(...slow), context)).toBe("cancel");
  });

  it("cancels a slow release at 60 px with sparse samples", () => {
    expect(interpret(gesture([0, 0, 0], [30, 0, 200], [60, 0, 400]), context)).toBe("cancel");
  });

  it("uses only the last 80 ms: a fast start followed by a slow finish cancels", () => {
    // 0 to 50 px in 50 ms, then 50 to 60 px over the last 100 ms (0.1 px/ms).
    expect(interpret(gesture([0, 0, 0], [50, 0, 50], [55, 0, 100], [60, 0, 150]), context)).toBe("cancel");
  });

  it("cancels a fast flick back towards the start", () => {
    // Out to 80 px slowly, then flicked back to 50 px at 0.75 px/ms against dx.
    expect(interpret(gesture([0, 0, 0], [80, 0, 400], [65, 0, 420], [50, 0, 440]), context)).toBe("cancel");
  });
});

describe("interpret: identical timestamps", () => {
  it("cancels two samples with the same timestamp below the fling distance, without dividing by zero", () => {
    expect(interpret(gesture([0, 0, 0], [50, 0, 0]), context)).toBe("cancel");
  });

  it("commits two samples with the same timestamp at 100 px by distance", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 0]), context)).toBe("true");
  });

  it("cancels when every sample in the last 80 ms shares the release timestamp", () => {
    expect(interpret(gesture([0, 0, 0], [50, 0, 200], [60, 0, 200]), context)).toBe("cancel");
  });
});

describe("interpret: zig-zag gestures", () => {
  it("commits a zig-zag that is released 95 px to the right", () => {
    expect(
      interpret(gesture([0, 0, 0], [40, 0, 20], [-40, 0, 40], [40, 0, 60], [-40, 0, 80], [95, 0, 100]), context),
    ).toBe("true");
  });

  it("cancels a fast zig-zag released near the start", () => {
    expect(
      interpret(gesture([0, 0, 0], [60, 0, 20], [-60, 0, 40], [60, 0, 60], [-60, 0, 80], [10, 0, 100]), context),
    ).toBe("cancel");
  });

  it("cancels a zig-zag released at 50 px while moving back towards the start", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 100], [20, 0, 200], [90, 0, 300], [50, 0, 340]), context)).toBe(
      "cancel",
    );
  });

  it("commits a zig-zag released at 50 px while moving fast away from the start", () => {
    expect(interpret(gesture([0, 0, 0], [100, 0, 100], [-20, 0, 200], [10, 0, 300], [50, 0, 340]), context)).toBe(
      "true",
    );
  });
});

describe("interpret: gestures that should never have started", () => {
  it("cancels a 120 px swipe that started inside the settle time", () => {
    const justShown: SwipeContext = { viewportWidth: 390, cardShownAt: 900 };
    // Starts 100 ms after the card appeared and ends well past the commit distance.
    expect(interpret(gesture([0, 0, 0], [120, 0, 300]), justShown)).toBe("cancel");
  });

  it("cancels a 120 px swipe that started in the left edge zone", () => {
    const fromEdge = [
      { x: 10, y: 400, t: 1000 },
      { x: 130, y: 400, t: 1300 },
    ];
    expect(interpret(fromEdge, context)).toBe("cancel");
  });

  it("canStart ignores a touch that began before the card appeared", () => {
    const shown: SwipeContext = { viewportWidth: 390, cardShownAt: 5000 };
    expect(canStart({ x: 195, y: 400, t: 4990 }, shown)).toBe(false);
  });
});

describe("interpret: fling velocity boundary", () => {
  it("commits at exactly 0.5 px/ms measured over exactly 80 ms", () => {
    // Slow to 20 px, then 40 px more in the last 80 ms: 60 px total, 0.5 px/ms.
    expect(interpret(gesture([0, 0, 0], [20, 0, 400], [60, 0, 480]), context)).toBe("true");
  });

  it("cancels just below 0.5 px/ms", () => {
    expect(interpret(gesture([0, 0, 0], [20, 0, 400], [59, 0, 480]), context)).toBe("cancel");
  });
});
