import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EASE, EASE_IN, EASE_OUT, FALL, SPRING_EASE, STAMP_LANDING, STAMP_REST } from "@/components/easing";

const tokens = JSON.parse(readFileSync("design/system/tokens.json", "utf8")) as {
  motion: { easing: Record<string, { $value: number[] }> };
};

describe("easing constants", () => {
  it("are the curves of tokens.json motion.easing", () => {
    const curve = (name: string) => tokens.motion.easing[name]?.$value;
    expect([...EASE]).toEqual(curve("ease"));
    expect([...EASE_OUT]).toEqual(curve("ease-out"));
    expect([...EASE_IN]).toEqual(curve("ease-in"));
    expect([...FALL]).toEqual(curve("fall"));
    expect([...SPRING_EASE]).toEqual(curve("spring"));
  });

  it("describe a stamp that lands from scale 1.9 and rests at -6 degrees", () => {
    expect(STAMP_REST).toEqual({ opacity: 1, scale: 1, rotate: -6 });
    expect(STAMP_LANDING).toEqual({ opacity: 0, scale: 1.9, rotate: -14 });
  });
});
