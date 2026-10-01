import { describe, expect, it } from "vitest";
import { MODE_TABLE, isOffered, modeInfo } from "@/src/app-state/modes";
import { MODES, type Mode } from "@/src/content/play";

describe("MODE_TABLE", () => {
  it("lists the four classes in the order of the class step, with their exact copy", () => {
    expect(MODE_TABLE.map((m) => [m.id, m.name, m.description, m.unit])).toEqual([
      ["classic", "Classic", "10 cards, score at the end.", "of 10"],
      ["streak", "Streak", "Keep going until the first wrong answer.", "in a row"],
      ["lives", "Three lives", "The round ends on the third wrong answer.", "cards"],
      ["timed", "Timed", "60 seconds, as many cards as you can.", "correct"],
    ]);
  });

  it("offers only Classic until the other classes are built", () => {
    expect(MODE_TABLE.filter((m) => m.offered).map((m) => m.id)).toEqual(["classic"]);
    expect(isOffered("classic")).toBe(true);
    expect(isOffered("timed")).toBe(false);
  });

  it("has a row for every mode", () => {
    expect(MODE_TABLE.map((m) => m.id)).toEqual([...MODES]);
  });
});

describe("modeInfo", () => {
  it("gives the row of a mode and throws for a mode it does not know", () => {
    expect(modeInfo("lives").name).toBe("Three lives");
    expect(() => modeInfo("blitz" as Mode)).toThrow(/Unknown mode/);
  });
});
