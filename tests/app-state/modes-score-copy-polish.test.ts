import { describe, expect, it } from "vitest";
import { modeInfo } from "@/src/app-state/modes";
import type { Answered, Mode } from "@/src/content/play";
import { scoreOf } from "@/src/engine/round";

// The class sentence names what the record keeps (review finding U140). A sentence that says "Correct
// answers" next to a score that also counts wrong ones is the mismatch U140 reported, so each sentence is
// held to what scoreOf counts on one round with wrong answers in it.
function answered(correct: boolean, index: number): Answered {
  return { card: { id: `c${index}` } as Answered["card"], given: true, correct, at: index };
}

// Right, right, wrong, right, wrong, wrong: four cards before the end, three of them right.
const ROUND = [true, true, false, true, false, false].map(answered);
const CORRECT = ROUND.filter((answer) => answer.correct).length;

describe("the class sentence and the score", () => {
  it("says Cards answered for Three lives, whose score counts the wrong answers too", () => {
    expect(scoreOf("lives", ROUND)).toBe(ROUND.length);
    expect(modeInfo("lives").description).toMatch(/^Cards answered /);
    expect(modeInfo("lives").description).not.toMatch(/correct/i);
  });

  it.each<Mode>(["classic", "timed"])("says Correct answers for %s, whose score counts only the right ones", (mode) => {
    expect(scoreOf(mode, ROUND)).toBe(CORRECT);
    expect(modeInfo(mode).description).toMatch(/^Correct answers /);
  });

  it("says Correct answers in a row for Streak, whose score is the longest run of right ones", () => {
    expect(scoreOf("streak", ROUND)).toBe(2);
    expect(modeInfo("streak").description).toMatch(/^Correct answers in a row/);
  });
});
