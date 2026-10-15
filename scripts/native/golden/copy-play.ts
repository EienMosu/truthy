// Vectors for the words the play screen says: the verdict, what a wrong answer did to the round, the Timed
// status and the Timed card announcer (components/play/PlayScreen.tsx), and the two timings the screen keeps.
// A round given to a function is written as the trace that builds it: {start, events}.
import { NEXT_ARRIVES_MS, SPOKEN_RELEASE_MS, roundStatus, timedCardText, timedStatus, verdictText } from "@/components/play/PlayScreen";
import { Played, startArgs } from "./copy-fixtures";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/PlayScreen";
const SOURCE = "components/play/PlayScreen.tsx";
const TESTS = [
  "tests/components/play/PlayScreenTimed.test.tsx",
  "tests/components/play/timed-applies-to-polish.test.ts",
  "tests/components/play/round-status-voice.test.tsx",
] as const;

function file(name: string, cases: readonly GoldenCase[]): GoldenFile {
  return goldenFile({ module: MODULE, function: name, source: SOURCE, tests: TESTS }, cases);
}

/** A case whose only argument is a round: the input is the trace that builds it. */
function roundCase(name: string, played: Played, output: (round: Played["state"]) => unknown): GoldenCase {
  return { name, input: played.trace(), output: output(played.state) };
}

/** A round of the mode with the Timed clock started, as the screen starts it. */
const timed = (section = "SEC") => new Played(startArgs("timed", section)).tick(0);

function verdictFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (const correct of [true, false]) {
    for (const answer of [true, false]) {
      const label = `${correct ? "correct" : "wrong"} answer, the answer is ${answer ? "True" : "False"}`;
      cases.push({ name: label, input: { correct, answer }, output: verdictText(correct, answer) });
      cases.push({ name: `${label}, new best`, input: { correct, answer, newBest: true }, output: verdictText(correct, answer, true) });
    }
  }
  return file("verdictText", cases);
}

function statusFile(): GoldenFile {
  const status = (round: Played["state"]) => roundStatus(round);
  const lives = () => new Played(startArgs("lives"));
  const streak = () => new Played(startArgs("streak"));
  const thirteen = streak();
  for (let i = 0; i < 13; i += 1) thirteen.right(1000 + i).next();
  thirteen.wrong(2000);
  return file("roundStatus", [
    roundCase("lives: nothing answered yet", lives(), status),
    roundCase("lives: the first wrong answer loses a life", lives().wrong(1000), status),
    roundCase("lives: the words stay while the next card is a question", lives().wrong(1000).next(), status),
    roundCase("lives: a right answer after a lost life says nothing", lives().wrong(1000).next().right(2000), status),
    roundCase("lives: the second wrong answer is the last life", lives().wrong(1000).next().right(2000).next().wrong(3000), status),
    roundCase("lives: the third wrong answer is out of lives", lives().wrong(1000).next().right(2000).next().wrong(3000).next().wrong(4000), status),
    roundCase("streak: wrong after two right answers", streak().right(1000).next().right(2000).next().wrong(3000), status),
    roundCase("streak: wrong on the first card ends at 0", streak().wrong(1000), status),
    roundCase("streak: a right answer says nothing", streak().right(1000), status),
    roundCase("streak: 13 right answers then a wrong one, across a chunk", thirteen, status),
    roundCase("classic: a wrong answer adds nothing", new Played(startArgs("classic")).wrong(1000), status),
    roundCase("timed: a wrong answer adds nothing", timed().wrong(500), status),
  ]);
}

function timedStatusFile(): GoldenFile {
  const status = (round: Played["state"]) => timedStatus(round);
  return file("timedStatus", [
    roundCase("a question says nothing", timed(), status),
    roundCase("the stamp of a right answer says Correct.", timed().right(500), status),
    roundCase("the stamp of a wrong answer says Not quite.", timed().wrong(500), status),
    roundCase("after the stamp the next question says nothing", timed().right(500).tick(1200), status),
    roundCase("time is up on a question", timed().ticks(1000, 60_000), status),
    roundCase("time is up after an answer", timed().right(500).ticks(1000, 60_000), status),
  ]);
}

function timedCardFile(): GoldenFile {
  const text = (round: Played["state"]) => timedCardText(round);
  const second = (section = "SEC") => timed(section).right(500).tick(1200);
  return file("timedCardText", [
    roundCase("the first card is read through focus: nothing", timed(), text),
    roundCase("the stamp on the first card: nothing", timed().right(500), text),
    roundCase("the second card: its number and statement", second(), text),
    roundCase("the second card keeps the text through its stamp", second().right(1500), text),
    roundCase("the third card", second().right(1500).tick(2300), text),
    roundCase("time is up: nothing", second().ticks(2000, 61_000), text),
    roundCase("the second card with an appliesTo says the Applies to line first", second("SCP"), text),
    roundCase("the second card opening with a code fragment is read without its backticks", second("COD"), text),
  ]);
}

function constants(): GoldenFile[] {
  return [
    file("NEXT_ARRIVES_MS", [{ name: "value", input: null, output: NEXT_ARRIVES_MS }]),
    file("SPOKEN_RELEASE_MS", [{ name: "value", input: null, output: SPOKEN_RELEASE_MS }]),
  ];
}

/** The files of this group: verdictText, roundStatus, timedStatus, timedCardText, NEXT_ARRIVES_MS, SPOKEN_RELEASE_MS. */
export function playGolden(): GoldenFile[] {
  return [verdictFile(), statusFile(), timedStatusFile(), timedCardFile(), ...constants()];
}
