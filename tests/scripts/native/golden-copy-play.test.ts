import { describe, expect, it } from "vitest";
import { roundStatus, timedCardText, timedStatus } from "@/components/play/PlayScreen";
import { playGolden } from "@/scripts/native/golden/copy-play";
import { byName, fileAt, outputFor, replay, view } from "./golden-view";

const FILES = playGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.play.PlayScreen.${name}.json`);

describe("the play copy vectors", () => {
  it("makes one file for each function and constant of the play screen's copy", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["verdictText", "roundStatus", "timedStatus", "timedCardText", "NEXT_ARRIVES_MS", "SPOKEN_RELEASE_MS"].map(
        (name) => `native-data/golden/components.play.PlayScreen.${name}.json`,
      ),
    );
    for (const file of FILES) {
      expect(view(file)).toMatchObject({ format: 1, module: "components/play/PlayScreen", source: "components/play/PlayScreen.tsx" });
      expect(view(file).tests).toContain("tests/components/play/round-status-voice.test.tsx");
    }
  });

  it("keeps the two timings of the screen as constants", () => {
    expect(view(at("NEXT_ARRIVES_MS")).cases).toEqual([{ name: "value", input: null, output: 420 }]);
    expect(view(at("SPOKEN_RELEASE_MS")).cases).toEqual([{ name: "value", input: null, output: 150 }]);
  });
});

describe("verdictText", () => {
  it("says the verdict and the answer, and New best. after them, for every combination", () => {
    const file = at("verdictText");
    expect(view(file).cases).toHaveLength(8);
    for (const correct of [true, false]) {
      for (const answer of [true, false]) {
        const verdict = `${correct ? "Correct" : "Not quite"}. The answer is ${answer ? "True" : "False"}.`;
        expect(outputFor(file, { correct, answer })).toBe(verdict);
        expect(outputFor(file, { correct, answer, newBest: true })).toBe(`${verdict} New best.`);
      }
    }
  });
});

describe("roundStatus (the pinned cases of round-status-voice.test.tsx)", () => {
  const file = at("roundStatus");
  const text = (name: string) => byName(file, name).output;

  it("Three lives: a lost life, the last life, the end, and nothing after a right answer", () => {
    expect(text("lives: the first wrong answer loses a life")).toBe("Life lost, 2 left.");
    expect(text("lives: a right answer after a lost life says nothing")).toBe("");
    expect(text("lives: the second wrong answer is the last life")).toBe("Last life.");
    expect(text("lives: the third wrong answer is out of lives")).toBe("Out of lives.");
  });

  it("Streak: the end with the streak it reached, and 0 for a wrong first card", () => {
    expect(text("streak: wrong after two right answers")).toBe("Streak ended at 2.");
    expect(text("streak: wrong on the first card ends at 0")).toBe("Streak ended at 0.");
    expect(text("streak: 13 right answers then a wrong one, across a chunk")).toBe("Streak ended at 13.");
  });

  it("Classic and Timed add nothing", () => {
    expect(text("classic: a wrong answer adds nothing")).toBe("");
    expect(text("timed: a wrong answer adds nothing")).toBe("");
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(roundStatus(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("timedStatus (the pinned cases of PlayScreenTimed.test.tsx)", () => {
  const file = at("timedStatus");

  it("says nothing on a question, the verdict alone during the stamp, and that the card does not count at time up", () => {
    expect(byName(file, "a question says nothing").output).toBe("");
    expect(byName(file, "the stamp of a right answer says Correct.").output).toBe("Correct.");
    expect(byName(file, "the stamp of a wrong answer says Not quite.").output).toBe("Not quite.");
    expect(byName(file, "time is up on a question").output).toBe("Time is up. This card doesn't count.");
    expect(byName(file, "time is up after an answer").output).toBe("Time is up. This card doesn't count.");
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(timedStatus(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});

describe("timedCardText (the pinned cases of PlayScreenTimed.test.tsx and timed-applies-to-polish.test.ts)", () => {
  const file = at("timedCardText");
  const statementOfSecond = (name: string) => replay(file, byName(file, name).input).cards[1]?.text.en.statement ?? "";

  it("says nothing on the first card, its number and statement from the second on, and nothing at time up", () => {
    expect(byName(file, "the first card is read through focus: nothing").output).toBe("");
    expect(byName(file, "the stamp on the first card: nothing").output).toBe("");
    expect(byName(file, "the second card: its number and statement").output).toBe(`Card 2. ${statementOfSecond("the second card: its number and statement")}`);
    expect(byName(file, "the second card keeps the text through its stamp").output).toBe(
      `Card 2. ${statementOfSecond("the second card keeps the text through its stamp")}`,
    );
    expect(byName(file, "time is up: nothing").output).toBe("");
  });

  it("says the Applies to line before the statement", () => {
    const name = "the second card with an appliesTo says the Applies to line first";
    expect(byName(file, name).output).toBe(`Card 2. Applies to Next.js 16 with cacheComponents: true. ${statementOfSecond(name)}`);
  });

  it("reads a code fragment as it is shown, without its backticks", () => {
    const name = "the second card opening with a code fragment is read without its backticks";
    const statement = statementOfSecond(name);
    expect(statement.startsWith("`docker run` ")).toBe(true);
    expect(byName(file, name).output).toBe(`Card 2. docker run ${statement.slice("`docker run` ".length)}`);
  });

  it("every recorded output is what the function says on the round its trace replays to", () => {
    for (const recorded of view(file).cases) expect(timedCardText(replay(file, recorded.input)), recorded.name).toBe(recorded.output);
  });
});
