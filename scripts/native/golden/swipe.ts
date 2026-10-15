// Golden vectors of swipe interpretation (reference 3.4 and 3.9), computed by running src/input/swipe.ts:
// every gesture of the web's swipe tests, and boundary tables around each threshold (settle time, edge
// zones, commit distance, fling distance and velocity, the 80 ms window), also with fractional times.
import { SWIPE, canStart, intent, interpret, type SwipeContext, type SwipeSample } from "@/src/input/swipe";
import { goldenFile, type GoldenCase, type GoldenFile, type GoldenMeta } from "./format";

const TESTS = [
  "tests/input/swipe.test.ts",
  "tests/input/swipe-polish.test.ts",
  "tests/input/swipe-early-touch-polish.test.ts",
] as const;

function meta(name: string): GoldenMeta {
  return { module: "src/input/swipe", function: name, source: "src/input/swipe.ts", tests: TESTS };
}

// The web tests' phone: a 390 wide window whose card appeared at t = 0; gestures start mid-screen at t = 1000.
const PHONE: SwipeContext = { viewportWidth: 390, cardShownAt: 0 };
const START = { x: 195, y: 400, t: 1000 };

// Samples from offsets relative to START, each one [dx, dy, dt], as the web tests' gesture() builds them.
function gesture(...offsets: [number, number, number][]): SwipeSample[] {
  return offsets.map(([dx, dy, dt]) => ({ x: START.x + dx, y: START.y + dy, t: START.t + dt }));
}

function intentCases(): GoldenCase[] {
  const table: readonly [string, number][] = [
    ["swipe.test: zero when the card has not moved", 0],
    ["swipe.test: proportional inside 110 px (55)", 55],
    ["swipe.test: proportional inside 110 px (-55)", -55],
    ["swipe.test: exactly 1 at 110 px", 110],
    ["swipe.test: exactly -1 at -110 px", -110],
    ["swipe.test: clamped beyond 110 px (500)", 500],
    ["swipe.test: clamped beyond 110 px (-500)", -500],
    ["boundary: 1 px", 1],
    ["boundary: -1 px", -1],
    ["boundary: 33 px (0.3, which has no exact binary form)", 33],
    ["boundary: just inside 110 px", 109.99],
    ["boundary: just past 110 px", 110.01],
    ["boundary: just inside -110 px", -109.99],
    ["boundary: a fractional drag", 12.345],
    ["boundary: the commit line", 90],
    ["boundary: the fling line to the left", -40],
  ];
  return table.map(([name, dx]) => ({ name, input: { dx }, output: intent(dx) }));
}

function canStartCases(): GoldenCase[] {
  const at = (x: number, t: number, viewportWidth = 390, cardShownAt = 0) => ({
    sample: { x, y: 400, t },
    context: { viewportWidth, cardShownAt },
  });
  const table: readonly [string, ReturnType<typeof at>][] = [
    ["swipe.test: ignores a touch 249 ms after the card appeared", at(195, 249)],
    ["swipe.test: accepts a touch exactly 250 ms after the card appeared", at(195, 250)],
    ["swipe.test: measures from cardShownAt, not from zero (100 ms after)", at(195, 10_100, 390, 10_000)],
    ["swipe.test: measures from cardShownAt, not from zero (250 ms after)", at(195, 10_250, 390, 10_000)],
    ["swipe.test: ignores a touch at x 23 (inside the left edge zone)", at(23, 1000)],
    ["swipe.test: accepts a touch at x 24", at(24, 1000)],
    ["swipe.test: ignores a touch at viewportWidth minus 23", at(367, 1000)],
    ["swipe.test: accepts a touch at viewportWidth minus 24", at(366, 1000)],
    ["swipe.test: ignores a touch at x 0", at(0, 1000)],
    ["swipe.test: ignores a touch that began before the card appeared", at(195, 4990, 390, 5000)],
    ["swipe-early-touch-polish.test: ignores a touch a whole second before the card appeared", at(100, 0, 390, 1000)],
    ["swipe-early-touch-polish.test: ignores a touch more than the settle time before the card", at(100, 749, 390, 1000)],
    ["boundary: 251 ms after the card appeared", at(195, 251)],
    ["boundary: a touch at the card's own moment", at(195, 0)],
    ["boundary: fractional times, exactly 250 ms apart", at(195, 350.25, 390, 100.25)],
    ["boundary: fractional times, just under 250 ms apart", at(195, 350.24, 390, 100.25)],
    ["boundary: x 23.5, inside the left edge zone", at(23.5, 1000)],
    ["boundary: x 366.5, inside the right edge zone", at(366.5, 1000)],
    ["boundary: x at the window's right edge", at(390, 1000)],
    ["boundary: x left of the window", at(-1, 1000)],
    ["boundary: a 430 wide window, x 406 (its last allowed x)", at(406, 1000, 430)],
    ["boundary: a 430 wide window, x 407", at(407, 1000, 430)],
    ["boundary: a 1024 wide window (tablet), x 1000", at(1000, 1000, 1024)],
    ["boundary: a 1024 wide window (tablet), x 1001", at(1001, 1000, 1024)],
    ["boundary: too early and inside the edge zone", at(10, 100)],
  ];
  return table.map(([name, input]) => ({ name, input, output: canStart(input.sample, input.context) }));
}

function interpretCases(): GoldenCase[] {
  const slow = Array.from({ length: 31 }, (_, i): [number, number, number] => [2 * i, 0, 16 * i]);
  const table: readonly [string, readonly SwipeSample[], SwipeContext][] = [
    // tests/input/swipe.test.ts
    ["swipe.test: cancels with no samples", [], PHONE],
    ["swipe.test: cancels with a single sample", gesture([0, 0, 0]), PHONE],
    ["swipe.test: cancels when the card did not move", gesture([0, 0, 0], [0, 0, 500]), PHONE],
    ["swipe.test: commits at exactly 90 px", gesture([0, 0, 0], [45, 0, 300], [90, 0, 600]), PHONE],
    ["swipe.test: cancels at 89 px", gesture([0, 0, 0], [45, 0, 300], [89, 0, 600]), PHONE],
    ["swipe.test: commits at exactly 90 px to the left", gesture([0, 0, 0], [-45, 0, 300], [-90, 0, 600]), PHONE],
    ["swipe.test: cancels when dragged past 90 px and back inside before release", gesture([0, 0, 0], [150, 0, 300], [60, 0, 900]), PHONE],
    ["swipe.test: cancels when dragged past 90 px and released exactly at the start", gesture([0, 0, 0], [150, 0, 300], [0, 0, 900]), PHONE],
    ["swipe.test: a release 120 px to the right is true", gesture([0, 0, 0], [120, 5, 600]), PHONE],
    ["swipe.test: a release 120 px to the left is false", gesture([0, 0, 0], [-120, 5, 600]), PHONE],
    ["swipe.test: the side at release wins, not the side first visited", gesture([0, 0, 0], [120, 0, 300], [-100, 0, 900]), PHONE],
    ["swipe.test: cancels a mostly vertical gesture even when it ends 100 px to the side", gesture([0, 0, 0], [50, 150, 300], [100, 300, 600]), PHONE],
    ["swipe.test: cancels a mostly vertical gesture upwards", gesture([0, 0, 0], [-100, -101, 600]), PHONE],
    ["swipe.test: commits an exactly diagonal gesture", gesture([0, 0, 0], [100, 100, 600]), PHONE],
    ["swipe.test: commits a horizontal swipe with some vertical drift", gesture([0, 0, 0], [60, 20, 300], [120, 40, 600]), PHONE],
    ["swipe.test: commits a fast fling that travelled 40 px", gesture([0, 0, 0], [20, 0, 20], [40, 0, 40]), PHONE],
    ["swipe.test: cancels a fast fling that travelled 39 px", gesture([0, 0, 0], [20, 0, 20], [39, 0, 40]), PHONE],
    ["swipe.test: commits a fast fling of 40 px to the left as false", gesture([0, 0, 0], [-20, 0, 20], [-40, 0, 40]), PHONE],
    ["swipe.test: cancels a slow release at 60 px (pointer moves sampled every 16 ms)", gesture(...slow), PHONE],
    ["swipe.test: cancels a slow release at 60 px with sparse samples", gesture([0, 0, 0], [30, 0, 200], [60, 0, 400]), PHONE],
    ["swipe.test: uses only the last 80 ms: a fast start followed by a slow finish cancels", gesture([0, 0, 0], [50, 0, 50], [55, 0, 100], [60, 0, 150]), PHONE],
    ["swipe.test: cancels a fast flick back towards the start", gesture([0, 0, 0], [80, 0, 400], [65, 0, 420], [50, 0, 440]), PHONE],
    ["swipe.test: cancels two samples with the same timestamp below the fling distance", gesture([0, 0, 0], [50, 0, 0]), PHONE],
    ["swipe.test: commits two samples with the same timestamp at 100 px by distance", gesture([0, 0, 0], [100, 0, 0]), PHONE],
    ["swipe.test: cancels when every sample in the last 80 ms shares the release timestamp", gesture([0, 0, 0], [50, 0, 200], [60, 0, 200]), PHONE],
    ["swipe.test: commits a zig-zag that is released 95 px to the right", gesture([0, 0, 0], [40, 0, 20], [-40, 0, 40], [40, 0, 60], [-40, 0, 80], [95, 0, 100]), PHONE],
    ["swipe.test: cancels a fast zig-zag released near the start", gesture([0, 0, 0], [60, 0, 20], [-60, 0, 40], [60, 0, 60], [-60, 0, 80], [10, 0, 100]), PHONE],
    ["swipe.test: cancels a zig-zag released at 50 px while moving back towards the start", gesture([0, 0, 0], [100, 0, 100], [20, 0, 200], [90, 0, 300], [50, 0, 340]), PHONE],
    ["swipe.test: commits a zig-zag released at 50 px while moving fast away from the start", gesture([0, 0, 0], [100, 0, 100], [-20, 0, 200], [10, 0, 300], [50, 0, 340]), PHONE],
    ["swipe.test: cancels a 120 px swipe that started inside the settle time", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 900 }],
    ["swipe.test: cancels a 120 px swipe that started in the left edge zone", [{ x: 10, y: 400, t: 1000 }, { x: 130, y: 400, t: 1300 }], PHONE],
    ["swipe.test: commits at exactly 0.5 px/ms measured over exactly 80 ms", gesture([0, 0, 0], [20, 0, 400], [60, 0, 480]), PHONE],
    ["swipe.test: cancels just below 0.5 px/ms", gesture([0, 0, 0], [20, 0, 400], [59, 0, 480]), PHONE],
    // tests/input/swipe-polish.test.ts
    ["swipe-polish.test: does not count a reference sample 81 ms before the release", gesture([0, 0, 0], [5, 0, 400], [50, 0, 481]), PHONE],
    ["swipe-polish.test: counts a reference sample exactly 80 ms before the release", gesture([0, 0, 0], [5, 0, 401], [50, 0, 481]), PHONE],
    ["swipe-polish.test: takes the oldest sample inside the window, so a fast stretch followed by a pause still flings", gesture([0, 0, 0], [10, 0, 400], [48, 0, 460], [50, 0, 470]), PHONE],
    ["swipe-polish.test: takes the oldest sample inside the window, so a slow drag that ends in a one-frame jerk does not fling", gesture([0, 0, 0], [30, 0, 400], [30, 0, 460], [50, 0, 470]), PHONE],
    // Boundary tables
    ["boundary: commits at exactly -90 px with no speed", gesture([0, 0, 0], [-90, 0, 600]), PHONE],
    ["boundary: cancels at -89 px with no speed", gesture([0, 0, 0], [-89, 0, 600]), PHONE],
    ["boundary: cancels at 89.5 px with no speed", gesture([0, 0, 0], [89.5, 0, 600]), PHONE],
    ["boundary: an exact diagonal to the upper left is false", gesture([0, 0, 0], [-100, -100, 600]), PHONE],
    ["boundary: vertical travel one more than horizontal cancels", gesture([0, 0, 0], [100, 101, 600]), PHONE],
    ["boundary: a purely vertical move cancels (dx is 0)", gesture([0, 0, 0], [0, 50, 300]), PHONE],
    ["boundary: exactly 0.5 px/ms to the left over 80 ms is false", gesture([0, 0, 0], [-20, 0, 400], [-60, 0, 480]), PHONE],
    ["boundary: a fast release towards the side under 40 px cancels", gesture([0, 0, 0], [39.9, 0, 10]), PHONE],
    ["boundary: fractional times inside the window fling", gesture([0, 0, 0], [5, 0, 400.5], [50, 0, 480.5]), PHONE],
    ["boundary: a fractional reference 80.5 ms before the release is outside the window", gesture([0, 0, 0], [5, 0, 400], [50, 0, 480.5]), PHONE],
    ["boundary: a start at x 24 commits", [{ x: 24, y: 400, t: 1000 }, { x: 144, y: 400, t: 1600 }], PHONE],
    ["boundary: a start at x 366 commits to the left", [{ x: 366, y: 400, t: 1000 }, { x: 246, y: 400, t: 1600 }], PHONE],
    ["boundary: a start at x 367 cancels", [{ x: 367, y: 400, t: 1000 }, { x: 247, y: 400, t: 1600 }], PHONE],
    ["boundary: a start exactly 250 ms after the card commits", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 750 }],
    ["boundary: a start 249 ms after the card cancels", gesture([0, 0, 0], [120, 0, 300]), { viewportWidth: 390, cardShownAt: 751 }],
    ["boundary: a release beyond the window edge still commits (only the start is checked)", [{ x: 300, y: 400, t: 1000 }, { x: 400, y: 400, t: 1600 }], PHONE],
    ["boundary: a tablet window measures the edge zone from the window, not the card", [{ x: 1000, y: 400, t: 1000 }, { x: 880, y: 400, t: 1600 }], { viewportWidth: 1024, cardShownAt: 0 }],
  ];
  return table.map(([name, samples, context]) => ({ name, input: { samples, context }, output: interpret(samples, context) }));
}

export function golden(): GoldenFile[] {
  return [
    goldenFile(meta("intent"), intentCases()),
    goldenFile(meta("canStart"), canStartCases()),
    goldenFile(meta("interpret"), interpretCases()),
    goldenFile(meta("SWIPE"), [{ name: "SWIPE", input: null, output: SWIPE }]),
  ];
}
