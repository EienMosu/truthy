import { describe, expect, it } from "vitest";
import {
  cardList,
  completedLabel,
  completedScale,
  flightPathLabel,
  flownPath,
  headingAt,
  pointAt,
  waypointStates,
  waypointT,
} from "@/components/FlightPath";
import { curveParameters, pathGolden } from "@/scripts/native/golden/geometry-path";
import { fileAt, outputFor, view } from "./golden-view";

const FILES = pathGolden();
const at = (name: string) => fileAt(FILES, `native-data/golden/components.FlightPath.${name}.json`);

describe("the flight path vectors", () => {
  it("makes a file for each of the nine functions", () => {
    expect(FILES.map((file) => file.path)).toEqual(
      ["pointAt", "waypointT", "flownPath", "headingAt", "waypointStates", "cardList", "flightPathLabel", "completedLabel", "completedScale"].map(
        (name) => `native-data/golden/components.FlightPath.${name}.json`,
      ),
    );
    for (const file of FILES) expect(view(file).tests).toEqual(["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"]);
  });

  it("visits the ends, the quarters, the middle and the waypoints of routes of 2 to 60 cards", () => {
    const values = curveParameters();
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    for (const t of [0.25, 0.5, 0.75, waypointT(3, 10), waypointT(11, 14), waypointT(59, 60)]) expect(values).toContain(t);
    expect(new Set(values).size).toBe(values.length);
    expect(view(at("pointAt")).cases).toHaveLength(values.length);
  });
});

describe("the curve (the pinned cases of FlightPath.test.tsx)", () => {
  it("runs along M6 24 Q138 -6 270 24, waypoints evenly spread in t", () => {
    expect(outputFor(at("pointAt"), { t: 0 })).toEqual({ x: 6, y: 24 });
    expect(outputFor(at("pointAt"), { t: 1 })).toEqual({ x: 270, y: 24 });
    expect(outputFor(at("pointAt"), { t: 0.5 })).toEqual({ x: 138, y: 9 });
    expect(outputFor(at("waypointT"), { i: 0, n: 10 })).toBe(0);
    expect(outputFor(at("waypointT"), { i: 9, n: 10 })).toBe(1);
    expect(outputFor(at("waypointT"), { i: 3, n: 10 })).toBeCloseTo(1 / 3);
    expect(outputFor(at("waypointT"), { i: 0, n: 1 })).toBe(0);
  });

  it("draws the flown part as the same curve cut at the plane", () => {
    expect(outputFor(at("flownPath"), { t: 1 })).toBe("M6 24 Q138 -6 270 24");
    expect(outputFor(at("flownPath"), { t: 0.5 })).toBe("M6 24 Q72 9 138 9");
  });

  it("points the plane along the curve: climbing at the start, level in the middle, descending at the end", () => {
    expect(outputFor(at("headingAt"), { t: 0 }) as number).toBeLessThan(0);
    expect(outputFor(at("headingAt"), { t: 0.5 })).toBe(0);
    expect(outputFor(at("headingAt"), { t: 1 }) as number).toBeGreaterThan(0);
  });

  it("every recorded output is what the function says for the recorded t", () => {
    for (const [name, run] of [["pointAt", pointAt], ["flownPath", flownPath], ["headingAt", headingAt]] as const) {
      for (const recorded of view(at(name)).cases) expect(run((recorded.input as { t: number }).t), `${name} ${recorded.name}`).toEqual(recorded.output);
    }
    for (const recorded of view(at("waypointT")).cases) {
      const { i, n } = recorded.input as { i: number; n: number };
      expect(waypointT(i, n), recorded.name).toBe(recorded.output);
    }
  });
});

describe("waypointStates (the pinned cases of FlightPath.test.tsx)", () => {
  const file = at("waypointStates");

  it("marks answered cards correct or wrong, the card on screen current, the rest future", () => {
    expect(outputFor(file, { total: 5, results: [true, false], current: 2, answered: false })).toEqual(["correct", "wrong", "current", "future", "future"]);
  });

  it("shows the card on screen with its own mark once it is answered", () => {
    expect(outputFor(file, { total: 4, results: [true, false, false], current: 2, answered: true })).toEqual(["correct", "wrong", "wrong", "future"]);
  });

  it("every recorded output is what the function says", () => {
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[]; current: number; answered: boolean };
      expect(waypointStates(input.total, input.results, input.current, input.answered), recorded.name).toEqual(recorded.output);
    }
  });
});

describe("the labels (the pinned cases of FlightPath.test.tsx)", () => {
  it("flightPathLabel is one full sentence with the card numbers of each verdict", () => {
    const file = at("flightPathLabel");
    expect(outputFor(file, { total: 10, results: [true, true, false], current: 3 })).toBe("Card 4 of 10. Cards 1 and 2 correct, card 3 wrong.");
    expect(outputFor(file, { total: 10, results: [false, true, true, true], current: 4 })).toBe("Card 5 of 10. Cards 2, 3 and 4 correct, card 1 wrong.");
    expect(outputFor(file, { total: 10, results: [], current: 0 })).toBe("Card 1 of 10.");
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[]; current: number };
      expect(flightPathLabel(input.total, input.results, input.current), recorded.name).toBe(recorded.output);
    }
  });

  it("completedLabel names the finished round and lists the missed cards", () => {
    const file = at("completedLabel");
    const results = [true, true, false, true, true, false, true, true, false, true];
    expect(outputFor(file, { total: 10, results })).toBe("Round complete. 10 of 10 cards. 7 correct, 3 wrong: cards 3, 6 and 9.");
    expect(outputFor(file, { total: 10, results: results.map(() => true) })).toBe("Round complete. 10 of 10 cards. 10 correct, 0 wrong.");
    expect(outputFor(file, { total: 3, results: [true, false, false] })).toBe("Round complete. 3 of 3 cards. 1 correct, 2 wrong: cards 2 and 3.");
    for (const recorded of view(file).cases) {
      const input = recorded.input as { total: number; results: boolean[] };
      expect(completedLabel(input.total, input.results), recorded.name).toBe(recorded.output);
    }
  });

  it("cardList reads one, two and many cards", () => {
    const file = at("cardList");
    expect(outputFor(file, { numbers: [3] })).toBe("card 3");
    expect(outputFor(file, { numbers: [1, 2] })).toBe("cards 1 and 2");
    expect(outputFor(file, { numbers: [1, 2, 5] })).toBe("cards 1, 2 and 5");
    for (const recorded of view(file).cases) expect(cardList((recorded.input as { numbers: number[] }).numbers), recorded.name).toBe(recorded.output);
  });
});

describe("completedScale (the pinned radii of FlightPath.test.tsx)", () => {
  it("scales the marks so that they never touch", () => {
    const file = at("completedScale");
    const expected: [number, number][] = [
      [10, 7],
      [11, 6],
      [14, 6],
      [17, 6],
      [18, 5.435],
      [21, 4.62],
      [60, 1.566],
    ];
    for (const [cards, radius] of expected) expect(7 * (outputFor(file, { cards }) as number)).toBeCloseTo(radius, 2);
    for (const recorded of view(file).cases) expect(completedScale((recorded.input as { cards: number }).cards), recorded.name).toBe(recorded.output);
  });
});
