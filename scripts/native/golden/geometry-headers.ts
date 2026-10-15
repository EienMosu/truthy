// Vectors for the headers of the unbounded modes and Timed: where the Streak dots sit and how the header is
// named (components/StreakPath.tsx), where the Three lives trail sits and how it is named
// (components/LivesPath.tsx), and the Timed clock and its name (components/TimedPath.tsx).
// A layout is a function in the web code, so its vector lists the values of the function at the probe
// points named in the output: a native layout is checked at the same points.
import { livesLabel, trailLayout } from "@/components/LivesPath";
import { streakLabel, streakLayout } from "@/components/StreakPath";
import { clockText, timedLabel } from "@/components/TimedPath";
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const STREAK = { module: "components/StreakPath", source: "components/StreakPath.tsx", tests: ["tests/components/StreakPath.test.tsx", "tests/components/StreakPath-polish.test.tsx"] };
const LIVES = { module: "components/LivesPath", source: "components/LivesPath.tsx", tests: ["tests/components/LivesPath.test.tsx", "tests/components/LivesPath-polish.test.tsx"] };
const TIMED = { module: "components/TimedPath", source: "components/TimedPath.tsx", tests: ["tests/components/TimedPath.test.tsx", "tests/components/TimedPath-polish.test.tsx"] };

/** The values of `at` at the given indexes, as an object keyed by index (ascending), indexes outside 0 to limit - 1 left out. */
function probed(indexes: readonly number[], limit: number, at: (index: number) => number): Record<string, number> {
  const kept = [...new Set(indexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < limit).sort((a, b) => a - b);
  return Object.fromEntries(kept.map((index) => [String(index), at(index)]));
}

/** [done, best] pairs: the pinned ones of StreakPath.test.tsx and StreakPath-polish.test.tsx, then the edges around them. */
const LAYOUTS: readonly (readonly [number, number | null])[] = [
  [8, 12], [1, 3], [11, 12], [12, 12], [0, null], [40, 12], [13, 40], [0, 1],
  [3, 60], [3, 28], [3, 29], [60, null], [300, null], [300, 12], [66, 67],
  [0, 0], [5, 0], [0, 2], [1, 2], [2, 2], [3, 2], [5, 5], [6, 5], [10, 12], [0, 12],
];

function streakLayoutFile(): GoldenFile {
  const cases = LAYOUTS.map(([done, best]): GoldenCase => {
    const layout = streakLayout(done, best);
    const slots = [0, 1, 2, done - 1, done, done + 1, layout.ring ?? -1];
    return {
      name: `${done} done, best ${best === null ? "none" : best}`,
      input: { done, best },
      output: {
        dot: layout.dot,
        ticks: layout.ticks,
        ring: layout.ring,
        target: layout.target,
        future: layout.future,
        t: probed(slots, Number.MAX_SAFE_INTEGER, layout.t),
      },
    };
  });
  return goldenFile({ ...STREAK, function: "streakLayout" }, cases);
}

function streakLabelFile(): GoldenFile {
  const label = (streak: number, best: number | null, ended: boolean): GoldenCase => ({
    name: `streak ${streak}, best ${best === null ? "none" : best}, ${ended ? "ended" : "running"}`,
    input: { streak, best, ended },
    output: streakLabel(streak, best, ended),
  });
  const pinned: [number, number | null, boolean][] = [
    [8, 12, false], [12, 12, false], [13, 12, false], [1, null, false], [0, null, false],
    [8, 12, true], [12, 12, true], [13, 12, true], [3, null, true], [0, 0, false], [1, 0, false], [0, 0, true],
  ];
  const more: [number, number | null, boolean][] = [[0, 5, false], [1, 1, false], [2, 1, true], [1, 2, true], [100, 99, false]];
  return goldenFile({ ...STREAK, function: "streakLabel" }, [...pinned, ...more].map(([streak, best, ended]) => label(streak, best, ended)));
}

function trailLayoutFile(): GoldenFile {
  const cases: GoldenCase[] = [];
  for (let marks = 0; marks <= 200; marks += 1) {
    const layout = trailLayout(marks);
    const indexes = [0, 1, 2, Math.floor(marks / 2), marks - 2, marks - 1];
    cases.push({
      name: `${marks} marks`,
      input: { marks },
      output: { r: layout.r, side: layout.side, cross: layout.cross, x: probed(indexes, marks, layout.x) },
    });
  }
  return goldenFile({ ...LIVES, function: "trailLayout" }, cases);
}

function livesLabelFile(): GoldenFile {
  const round = (n: number, ...wrongOn: number[]) => Array.from({ length: n }, (_, i) => !wrongOn.includes(i + 1));
  const label = (name: string, results: boolean[]): GoldenCase => ({ name, input: { results }, output: livesLabel(results) });
  return goldenFile({ ...LIVES, function: "livesLabel" }, [
    label("no cards answered yet", round(0)),
    label("one card answered", round(1)),
    label("five cards answered", round(5)),
    label("one wrong card among 14", round(14, 6)),
    label("two wrong cards among 20", round(20, 6, 15)),
    label("no lives left after 21 cards", round(21, 6, 15, 21)),
    label("one wrong card, the only one answered", round(1, 1)),
    label("two wrong cards, the only ones answered", round(2, 1, 2)),
    label("three wrong cards in a row", round(3, 1, 2, 3)),
    label("four wrong cards: no lives left, whatever the count", round(4, 1, 2, 3, 4)),
  ]);
}

function clockFile(): GoldenFile {
  const values = [60_000, 59_999, 59_000, 41_000, 40_001, 1_001, 1_000, 999, 1, 0, 60_001, 61_000, 125_000, 599_000, -1, -5_000, 0.5, 29_999.9, 60_000.5];
  return goldenFile(
    { ...TIMED, function: "clockText" },
    values.map((remainingMs): GoldenCase => ({ name: `${remainingMs} ms`, input: { remainingMs }, output: clockText(remainingMs) })),
  );
}

function timedLabelFile(): GoldenFile {
  const label = (remainingMs: number, correct: number, wrong: number): GoldenCase => ({
    name: `${remainingMs} ms, ${correct} correct, ${wrong} wrong`,
    input: { remainingMs, correct, wrong },
    output: timedLabel(remainingMs, correct, wrong),
  });
  return goldenFile({ ...TIMED, function: "timedLabel" }, [
    label(41_000, 9, 2),
    label(60_000, 0, 0),
    label(900, 3, 0),
    label(0, 14, 3),
    label(0, 1, 0),
    label(1_000, 0, 0),
    label(1_001, 5, 1),
    label(59_999.5, 0, 0),
    label(90_000, 1, 1),
    label(-5, 3, 1),
    label(0, 0, 0),
    label(0, 0, 1),
  ]);
}

/** The files of this group: streakLayout, streakLabel, trailLayout, livesLabel, clockText, timedLabel. */
export function headersGolden(): GoldenFile[] {
  return [streakLayoutFile(), streakLabelFile(), trailLayoutFile(), livesLabelFile(), clockFile(), timedLabelFile()];
}
