import { describe, expect, it } from "vitest";
import { SWIPE, intent } from "@/src/input/swipe";

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
