import { describe, expect, it } from "vitest";
import { MODE_TABLE, isOffered, lastScoreText, modeInfo } from "@/src/app-state/modes";
import { MODES, type Mode } from "@/src/content/play";

describe("MODE_TABLE", () => {
  it("lists the four classes in the order of the class step, with their exact copy", () => {
    expect(MODE_TABLE.map((m) => [m.id, m.name, m.description, m.unit])).toEqual([
      ["classic", "Classic", "Correct answers out of 10 cards.", "of 10"],
      ["streak", "Streak", "Correct answers in a row, until the first wrong one.", "in a row"],
      ["lives", "Three lives", "Cards answered until the third wrong one.", "cards"],
      ["timed", "Timed", "Correct answers in one minute, wrong ones cost nothing.", "correct"],
    ]);
  });

  it("offers all four classes", () => {
    expect(MODE_TABLE.every((m) => m.offered)).toBe(true);
    expect(isOffered("classic")).toBe(true);
    expect(isOffered("timed")).toBe(true);
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

describe("lastScoreText", () => {
  it("words the last score the way each class counts", () => {
    expect(lastScoreText("classic", 7, 10)).toBe("7 of 10");
    expect(lastScoreText("streak", 13, 14)).toBe("13 in a row");
    expect(lastScoreText("streak", 1, 2)).toBe("1 in a row");
    expect(lastScoreText("lives", 21, 21)).toBe("21 cards");
    expect(lastScoreText("timed", 14, 17)).toBe("14 correct");
    expect(lastScoreText("timed", 0, 0)).toBe("0 correct");
  });
});
