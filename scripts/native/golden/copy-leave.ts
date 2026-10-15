// Vectors for leaving a round (components/play/leave.ts): whether leaving saves anything, and what is saved.
// A round given to a function is written as the trace that builds it: {start, events}. A stored progress is
// the JSON the progress key holds before the call, and the output is the JSON it holds after.
import { leavesSomething, saveLeftRound } from "@/components/play/leave";
import { PROGRESS_KEY, createLocalStore } from "@/src/progress/local";
import { emptyProgress, type Progress } from "@/src/progress/progress";
import { Played, startArgs } from "./copy-fixtures";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/play/leave";
const SOURCE = "components/play/leave.ts";
const TESTS = ["tests/components/play/leave.test.ts"] as const;

const timed = () => new Played(startArgs("timed")).tick(0);

function leavesFile(): GoldenFile {
  const leaves = (name: string, played: Played): GoldenCase => ({ name, input: played.trace(), output: leavesSomething(played.state) });
  const classic = () => new Played(startArgs("classic"));
  const wholeClassic = classic();
  for (let i = 0; i < 9; i += 1) wholeClassic.right(1000 + i).next();
  wholeClassic.right(2000);
  return goldenFile({ module: MODULE, function: "leavesSomething", source: SOURCE, tests: TESTS }, [
    leaves("Classic: nothing answered yet", classic()),
    leaves("Classic: one answer given", classic().right(1000)),
    leaves("Classic: one answer given and the next card on screen", classic().right(1000).next()),
    leaves("Classic: the last card answered, the round is decided", wholeClassic),
    leaves("Three lives: one wrong answer", new Played(startArgs("lives")).wrong(1000)),
    leaves("Streak: the deciding wrong answer", new Played(startArgs("streak")).wrong(1000)),
    leaves("Timed: the minute is running and nothing is answered", timed()),
    leaves("Timed: the minute ran out with nothing answered", timed().ticks(1000, 60_000)),
    leaves("Timed: one answer stamped", timed().right(500)),
    leaves("Classic: abandoned with nothing answered", classic().send({ type: "abandon" })),
  ]);
}

/** What the progress key holds after saving the left round into a store over `progress`; `full` makes every write throw. */
function savedFrom(played: Played, progress: Progress | null, full: boolean): unknown {
  const data = new Map<string, string>();
  if (progress !== null) data.set(PROGRESS_KEY, JSON.stringify(progress));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (full) throw new Error("quota");
      data.set(key, value);
    },
  };
  saveLeftRound(played.state, createLocalStore(storage));
  const raw = data.get(PROGRESS_KEY);
  return raw === undefined ? null : JSON.parse(raw);
}

function saveFile(): GoldenFile {
  const save = (name: string, played: Played, progress: Progress | null = null, storage: "works" | "full" = "works"): GoldenCase => ({
    name,
    input: { ...played.trace(), progress, storage },
    output: { stored: savedFrom(played, progress, storage === "full") },
  });
  const classic = () => new Played(startArgs("classic"));
  // The pinned round of leave.test.ts: the two answers are True and False whatever the cards say.
  const twoAnswers = classic().send({ type: "answer", value: true, at: 1000 }).next().send({ type: "answer", value: false, at: 2000 }).next();
  const streakDecided = new Played(startArgs("streak"));
  for (let i = 0; i < 3; i += 1) streakDecided.right(1000 * (i + 1)).next();
  streakDecided.wrong(5000);
  const livesDecided = new Played(startArgs("lives")).wrong(1000).next().wrong(2000).next().wrong(3000);
  const wholeClassic = classic();
  for (let i = 0; i < 9; i += 1) wholeClassic.right(1000 + i).next();
  wholeClassic.right(2000);
  const before: Progress = {
    ...emptyProgress(),
    cards: { "test-deck-sec-10": { seen: 1, lastCorrect: false, lastSeenAt: 500 } },
    records: { "test-deck/SEC#classic": 5, "test-deck/SEC#streak": 9 },
  };
  return goldenFile({ module: MODULE, function: "saveLeftRound", source: SOURCE, tests: TESTS }, [
    save("Classic: two answers kept in the history, no record, the route without a score", twoAnswers),
    save("Streak: left after the deciding answer, recorded as its result would be", streakDecided),
    save("the store cannot save: nothing is written and nothing throws", twoAnswers, null, "full"),
    save("the store cannot save over stored progress: the stored value stays", twoAnswers, before, "full"),
    save("Three lives: left after the third wrong answer", livesDecided),
    save("Classic: left after the last card was answered, the record is set", wholeClassic),
    save("Timed: the minute ran out with nothing answered, a record of 0", timed().ticks(1000, 60_000)),
    save("Classic: an open round over stored progress keeps the records and counts a card seen before once more", classic().right(1000), before),
    save("Streak: a decided round below the stored record leaves the record alone", new Played(startArgs("streak")).wrong(1000), before),
    save("Classic: nothing answered still remembers the route, which the screen never asks for", classic()),
  ]);
}

/** The files of this group: leavesSomething and saveLeftRound. */
export function leaveGolden(): GoldenFile[] {
  return [leavesFile(), saveFile()];
}
