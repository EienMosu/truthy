import { describe, expect, it } from "vitest";
import { SWIPE, canStart, type SwipeContext } from "@/src/input/swipe";

// Spec section 8: a new card ignores input for its settle time. A touch that began long before the card appeared
// (a finger left on the screen) is not a settled touch, however far back it began.
describe("canStart: a touch long before the card", () => {
  const shown: SwipeContext = { viewportWidth: 390, cardShownAt: 1_000 };

  it("ignores a touch that began a whole second before the card appeared", () => {
    expect(canStart({ x: 100, y: 400, t: 0 }, shown)).toBe(false);
  });

  it("ignores a touch that began more than the settle time before the card appeared", () => {
    expect(canStart({ x: 100, y: 400, t: shown.cardShownAt - SWIPE.settleMs - 1 }, shown)).toBe(false);
  });
});
