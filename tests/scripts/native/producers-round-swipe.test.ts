import { describe, expect, it } from "vitest";
import { goldenProducers } from "@/scripts/native/registry";
import { golden as roundGolden } from "@/scripts/native/golden/round";
import { golden as swipeGolden } from "@/scripts/native/golden/swipe";

describe("goldenProducers", () => {
  it("runs the round and swipe producers of task 6", () => {
    expect(goldenProducers()).toEqual(expect.arrayContaining([roundGolden, swipeGolden]));
  });
});
