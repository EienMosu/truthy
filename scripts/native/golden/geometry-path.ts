// Vectors for the flight path (components/FlightPath.tsx): the curve and the plane on it, the state of every
// waypoint, the card lists and the two sentences that name the header, and the scale of a completed route.
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
import { goldenFile, type GoldenCase, type GoldenFile } from "./format";

const MODULE = "components/FlightPath";
const SOURCE = "components/FlightPath.tsx";
const TESTS = ["tests/components/FlightPath.test.tsx", "tests/components/FlightPath-polish.test.tsx"] as const;

const meta = (name: string) => ({ module: MODULE, function: name, source: SOURCE, tests: TESTS });

/** The routes whose waypoints the vectors visit: one waypoint for each card of these lengths. */
export const ROUTE_LENGTHS = [2, 3, 5, 10, 14, 21, 60] as const;

/** Every t the app uses: the waypoints of the routes above, the quarters of the Timed minute and a few clock moments. */
export function curveParameters(): number[] {
  const values = new Set<number>([0, 0.25, 0.5, 0.75, 1, 12 / 13.6]);
  for (const n of ROUTE_LENGTHS) for (let i = 0; i < n; i += 1) values.add(waypointT(i, n));
  for (const remaining of [60_000, 41_000, 40_001, 30_000, 1]) values.add(Math.min(1, Math.max(0, 1 - remaining / 60_000)));
  return [...values].sort((a, b) => a - b);
}

function onCurve(name: string, run: (t: number) => unknown): GoldenFile {
  return goldenFile(
    meta(name),
    curveParameters().map((t): GoldenCase => ({ name: `t = ${t}`, input: { t }, output: run(t) })),
  );
}

function waypointTFile(): GoldenFile {
  const cases: GoldenCase[] = [{ name: "a route of no cards", input: { i: 0, n: 0 }, output: waypointT(0, 0) }];
  for (const n of [1, ...ROUTE_LENGTHS]) {
    for (let i = 0; i < n; i += 1) cases.push({ name: `waypoint ${i} of ${n}`, input: { i, n }, output: waypointT(i, n) });
  }
  return goldenFile(meta("waypointT"), cases);
}

function statesFile(): GoldenFile {
  const states = (name: string, total: number, results: boolean[], current: number, answered: boolean): GoldenCase => ({
    name,
    input: { total, results, current, answered },
    output: waypointStates(total, results, current, answered),
  });
  return goldenFile(meta("waypointStates"), [
    states("answered cards are correct or wrong, the card on screen current, the rest future", 5, [true, false], 2, false),
    states("the card on screen shows its own mark once it is answered", 4, [true, false, false], 2, true),
    states("before the first answer", 10, [], 0, false),
    states("the last card answered", 3, [true, false, true], 2, true),
    states("a verdict missing before the card on screen reads as future", 4, [true], 2, false),
    states("more cards answered than the route has", 3, [true, true, true, true], 3, false),
    states("a route of no cards", 0, [], 0, false),
    states("a question on the last card", 10, [true, true, true, true, true, true, true, true, true], 9, false),
  ]);
}

function cardListFile(): GoldenFile {
  const list = (numbers: number[]): GoldenCase => ({ name: `cards ${numbers.join(" ")}`, input: { numbers }, output: cardList(numbers) });
  return goldenFile(meta("cardList"), [list([3]), list([1, 2]), list([1, 2, 5]), list([1, 2, 3, 4]), list([6, 15, 21]), list([10, 11, 12, 13, 14, 15])]);
}

function labelFile(): GoldenFile {
  const label = (name: string, total: number, results: boolean[], current: number): GoldenCase => ({
    name,
    input: { total, results, current },
    output: flightPathLabel(total, results, current),
  });
  const run = (length: number, ...wrongOn: number[]) => Array.from({ length }, (_, i) => !wrongOn.includes(i + 1));
  return goldenFile(meta("flightPathLabel"), [
    label("one full sentence with the card numbers of each verdict", 10, [true, true, false], 3),
    label("wrong first, then right", 10, [false, true, true, true], 4),
    label("only where the round is before the first answer", 10, [], 0),
    label("nine right answers", 10, run(9), 9),
    label("two wrong answers on a short route", 3, [false, false], 2),
    label("a route of one card", 1, [], 0),
    label("a long round with three wrong cards", 21, run(20, 6, 15), 20),
  ]);
}

function completedLabelFile(): GoldenFile {
  const label = (name: string, total: number, results: boolean[]): GoldenCase => ({ name, input: { total, results }, output: completedLabel(total, results) });
  const run = (length: number, ...wrongOn: number[]) => Array.from({ length }, (_, i) => !wrongOn.includes(i + 1));
  return goldenFile(meta("completedLabel"), [
    label("names the finished round and lists the missed cards", 10, run(10, 3, 6, 9)),
    label("every card right", 10, run(10)),
    label("three cards, two wrong", 3, [true, false, false]),
    label("a route of no cards", 0, []),
    label("one card, wrong", 1, [false]),
    label("a route not played to the end", 10, []),
    label("fourteen cards, the last one wrong", 14, run(14, 14)),
  ]);
}

function scaleFile(): GoldenFile {
  const cards = [0, 1, 9, 10, 11, 14, 16, 17, 18, 19, 21, 30, 41, 58, 60, 100, 120, 200];
  return goldenFile(
    meta("completedScale"),
    cards.map((count): GoldenCase => ({ name: `${count} cards`, input: { cards: count }, output: completedScale(count) })),
  );
}

/** The files of this group: the nine functions of FlightPath.tsx the native apps port. */
export function pathGolden(): GoldenFile[] {
  return [
    onCurve("pointAt", pointAt),
    waypointTFile(),
    onCurve("flownPath", flownPath),
    onCurve("headingAt", headingAt),
    statesFile(),
    cardListFile(),
    labelFile(),
    completedLabelFile(),
    scaleFile(),
  ];
}
