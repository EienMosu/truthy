import { describe, expect, it } from "vitest";
import { pointAt } from "@/components/FlightPath";
import { livesLabel, trailLayout } from "@/components/LivesPath";
import { streakLabel, streakLayout } from "@/components/StreakPath";
import { clockText, timedLabel } from "@/components/TimedPath";
import { headersGolden } from "@/scripts/native/golden/geometry-headers";
import { byName, fileAt, outputFor, view } from "./golden-view";

const FILES = headersGolden();
const at = (module: string, name: string) => fileAt(FILES, `native-data/golden/components.${module}.${name}.json`);

type Layout = { dot: number; ticks: boolean; ring: number | null; target: boolean; future: number[]; t: Record<string, number> };
type Trail = { r: number; side: number; cross: boolean; x: Record<string, number> };

describe("the header vectors", () => {
  it("makes a file for each of the six functions", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "native-data/golden/components.StreakPath.streakLayout.json",
      "native-data/golden/components.StreakPath.streakLabel.json",
      "native-data/golden/components.LivesPath.trailLayout.json",
      "native-data/golden/components.LivesPath.livesLabel.json",
      "native-data/golden/components.TimedPath.clockText.json",
      "native-data/golden/components.TimedPath.timedLabel.json",
    ]);
  });
});

describe("streakLayout (the pinned cases of StreakPath.test.tsx and StreakPath-polish.test.tsx)", () => {
  const file = at("StreakPath", "streakLayout");
  const layout = (done: number, best: number | null) => outputFor(file, { done, best }) as Layout;

  it("spaces the slots 24 px apart and ends on the ring when the best is 12", () => {
    const out = layout(8, 12);
    expect([0, 1, 8, 11].map((slot) => pointAt(out.t[String(slot)] ?? Number.NaN).x)).toEqual([6, 30, 198, 270]);
    expect(out).toMatchObject({ dot: 6, ticks: true, ring: 11, target: true, future: [9, 10] });
  });

  it("ends on the ring for any best: three slots for a best of 3", () => {
    const out = layout(1, 3);
    expect([0, 1, 2].map((slot) => out.t[String(slot)])).toEqual([0, 0.5, 1]);
    expect(out).toMatchObject({ ring: 2, target: true, future: [] });
  });

  it("keeps the plane on the ring slot while the next right answer would equal the best", () => {
    expect(layout(11, 12)).toMatchObject({ target: true, future: [] });
    expect(layout(11, 12).t["11"]).toBe(1);
  });

  it("runs on into open sky at and past the best", () => {
    expect(layout(12, 12)).toMatchObject({ ring: 11, target: false, future: [], dot: 6 });
    expect(layout(12, 12).t["12"]).toBeCloseTo(12 / 13.6, 5);
  });

  it("has no ring without a best, and a best of 1 on the first slot", () => {
    expect(layout(0, null)).toMatchObject({ ring: null, target: false, future: [], dot: 6 });
    expect(layout(0, null).t["0"]).toBe(0);
    expect(layout(0, 1)).toMatchObject({ ring: 0, target: true, future: [] });
    expect(layout(0, 1).t["0"]).toBe(0);
  });

  it("shrinks the dots of a long streak and drops their ticks", () => {
    expect(layout(40, 12)).toMatchObject({ dot: 2, ticks: false });
    expect(layout(13, 40)).toMatchObject({ dot: 2.1, ticks: false, target: true });
  });

  it("every recorded output is what the function says, at the probe points the output names", () => {
    for (const recorded of view(file).cases) {
      const { done, best } = recorded.input as { done: number; best: number | null };
      const made = streakLayout(done, best);
      const out = recorded.output as Layout;
      expect({ dot: out.dot, ticks: out.ticks, ring: out.ring, target: out.target, future: out.future }, recorded.name).toEqual({
        dot: made.dot,
        ticks: made.ticks,
        ring: made.ring,
        target: made.target,
        future: made.future,
      });
      expect(Object.keys(out.t).length, recorded.name).toBeGreaterThanOrEqual(3);
      for (const [slot, value] of Object.entries(out.t)) expect(made.t(Number(slot)), `${recorded.name} slot ${slot}`).toBe(value);
    }
  });
});

describe("streakLabel (the pinned table of StreakPath.test.tsx)", () => {
  const file = at("StreakPath", "streakLabel");

  it.each([
    [8, 12, false, "Streak of 8 correct answers. Your best on this route is 12."],
    [12, 12, false, "Streak of 12 correct answers, equal to your best on this route."],
    [13, 12, false, "Streak of 13 correct answers. New best on this route, previous best 12."],
    [1, null, false, "Streak of 1 correct answer."],
    [0, null, false, "Streak of 0 correct answers."],
    [8, 12, true, "Streak ended at 8. Your best on this route is 12."],
    [12, 12, true, "Streak ended at 12, equal to your best on this route."],
    [13, 12, true, "Streak ended at 13. New best on this route, previous best 12."],
    [3, null, true, "Streak ended at 3."],
    [0, 0, false, "Streak of 0 correct answers."],
    [1, 0, false, "Streak of 1 correct answer."],
    [0, 0, true, "Streak ended at 0."],
  ])("streak %s, best %s, ended %s", (streak, best, ended, text) => {
    expect(outputFor(file, { streak, best, ended })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const { streak, best, ended } = recorded.input as { streak: number; best: number | null; ended: boolean };
      expect(streakLabel(streak, best, ended), recorded.name).toBe(recorded.output);
    }
  });
});

describe("trailLayout (the pinned cases of LivesPath.test.tsx)", () => {
  const file = at("LivesPath", "trailLayout");
  const trail = (marks: number) => outputFor(file, { marks }) as Trail;

  it("has a case for every number of marks from 0 to 200", () => {
    expect(view(file).cases.map((recorded) => (recorded.input as { marks: number }).marks)).toEqual(Array.from({ length: 201 }, (_, i) => i));
  });

  it("keeps 9 px between marks and the newest at x 219, up to 14 marks", () => {
    const out = trail(14);
    expect([out.x["0"], out.x["1"], out.x["13"]]).toEqual([102, 111, 219]);
    expect(out).toMatchObject({ r: 2.6, side: 9, cross: true });
    expect(trail(1).x["0"]).toBe(219);
    expect(trail(3).x["0"]).toBe(201);
  });

  it("squeezes more marks between x 100 and x 219", () => {
    const out = trail(20);
    expect([out.x["0"], out.x["1"], out.x["19"]]).toEqual([100, 106.3, 219]);
    expect(out).toMatchObject({ r: 2.2, side: 8, cross: true });
  });

  it("keeps a wrong mark a square with its x however long the round", () => {
    expect(trail(60)).toMatchObject({ r: 0.9, side: 6, cross: true });
    for (let marks = 15; marks <= 200; marks += 1) {
      expect(trail(marks).cross, `${marks} marks`).toBe(true);
      expect(trail(marks).side, `${marks} marks`).toBeGreaterThanOrEqual(6);
    }
  });

  it("every recorded output is what the function says, at the probe points the output names", () => {
    for (const recorded of view(file).cases) {
      const { marks } = recorded.input as { marks: number };
      const made = trailLayout(marks);
      const out = recorded.output as Trail;
      expect({ r: out.r, side: out.side, cross: out.cross }, recorded.name).toEqual({ r: made.r, side: made.side, cross: made.cross });
      const probes = [...new Set([0, 1, 2, Math.floor(marks / 2), marks - 2, marks - 1])].filter((index) => index >= 0 && index < marks).sort((a, b) => a - b);
      expect(Object.keys(out.x).map(Number), recorded.name).toEqual(probes);
      for (const [index, value] of Object.entries(out.x)) expect(made.x(Number(index)), `${recorded.name} mark ${index}`).toBe(value);
    }
  });
});

describe("livesLabel (the pinned table of LivesPath.test.tsx)", () => {
  const file = at("LivesPath", "livesLabel");
  const round = (n: number, ...wrongOn: number[]) => Array.from({ length: n }, (_, i) => !wrongOn.includes(i + 1));

  it.each([
    [[], 0, "3 of 3 lives left. No cards answered yet."],
    [[], 1, "3 of 3 lives left. 1 card answered."],
    [[], 5, "3 of 3 lives left. 5 cards answered."],
    [[6], 14, "2 of 3 lives left. 14 cards answered, card 6 was wrong."],
    [[6, 15], 20, "1 of 3 lives left. 20 cards answered, cards 6 and 15 were wrong."],
    [[6, 15, 21], 21, "No lives left. The round is over after 21 cards: cards 6, 15 and 21 were wrong."],
  ])("wrong on %j of %i", (wrongAt, n, text) => {
    expect(outputFor(file, { results: round(n, ...wrongAt) })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) expect(livesLabel((recorded.input as { results: boolean[] }).results), recorded.name).toBe(recorded.output);
  });
});

describe("clockText (the pinned table of TimedPath.test.tsx)", () => {
  const file = at("TimedPath", "clockText");

  it.each([
    [60_000, "1:00"],
    [59_999, "1:00"],
    [59_000, "0:59"],
    [40_001, "0:41"],
    [41_000, "0:41"],
    [1, "0:01"],
    [0, "0:00"],
  ])("%i ms reads %s", (remainingMs, text) => {
    expect(outputFor(file, { remainingMs })).toBe(text);
  });

  it("reads whole seconds rounded up, and never less than 0:00", () => {
    expect(outputFor(file, { remainingMs: 1_001 })).toBe("0:02");
    expect(outputFor(file, { remainingMs: -5_000 })).toBe("0:00");
    expect(outputFor(file, { remainingMs: 125_000 })).toBe("2:05");
    for (const recorded of view(file).cases) expect(clockText((recorded.input as { remainingMs: number }).remainingMs), recorded.name).toBe(recorded.output);
  });
});

describe("timedLabel (the pinned table of TimedPath.test.tsx)", () => {
  const file = at("TimedPath", "timedLabel");

  it.each([
    [41_000, 9, 2, "41 seconds left of 60. 9 correct, 2 wrong."],
    [60_000, 0, 0, "60 seconds left of 60. 0 correct, 0 wrong."],
    [900, 3, 0, "1 second left of 60. 3 correct, 0 wrong."],
    [0, 14, 3, "Time is up. 17 cards answered: 14 correct, 3 wrong."],
    [0, 1, 0, "Time is up. 1 card answered: 1 correct, 0 wrong."],
  ])("%i ms, %i correct, %i wrong", (remainingMs, correct, wrong, text) => {
    expect(outputFor(file, { remainingMs, correct, wrong })).toBe(text);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const { remainingMs, correct, wrong } = recorded.input as { remainingMs: number; correct: number; wrong: number };
      expect(timedLabel(remainingMs, correct, wrong), recorded.name).toBe(recorded.output);
    }
    expect(byName(file, "-5 ms, 3 correct, 1 wrong").output).toBe("Time is up. 4 cards answered: 3 correct, 1 wrong.");
  });
});
