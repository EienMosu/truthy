import { describe, expect, it } from "vitest";
import { lastScoreText } from "@/src/app-state/modes";

// Review finding U131: Classic names its own total, so a round that dealt fewer than ten cards (a small
// section) says "5 of 7", not the "of 10" of the class card.
describe("lastScoreText: the Classic total", () => {
  it("uses the total of the round, not the ten of the class card", () => {
    expect(lastScoreText("classic", 5, 7)).toBe("5 of 7");
    expect(lastScoreText("classic", 0, 12)).toBe("0 of 12");
  });

  it("does not use the total in the other classes", () => {
    expect(lastScoreText("streak", 5, 7)).toBe("5 in a row");
  });
});
